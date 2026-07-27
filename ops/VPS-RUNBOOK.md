# The VPS — two projects, one box

Hostinger, 16 GB, 100 GB, at `187.77.8.98` (`srv1680197.hstgr.cloud`).

Two projects, two Linux accounts, hard memory ceilings so neither can starve
the other. Read this on the phone, paste into the SSH app.

**Paste tip:** every block below is meant to be copied whole. For multi-line
files use `cat > name <<'EOF'` → paste → `EOF` on its own line. That is one
paste with no cursor work, which `nano` is not.

---

## Step 0 — push, before the box exists

Already committed for you: two commits on `landing/talent-landing`. Nothing is
pushed, because the shell I have on your machine has no network.

From **Windows**, in the repo:

```powershell
git push -u origin landing/talent-landing
```

If git complains about `index.lock`, delete `.git\index.lock` and retry — git
could not remove its own lock files through the bridge, and I left a few
`zz-stale-*` files in `.git\` that `Remove-Item .git\zz-stale-*` will clear.

Until this runs, tonight's landing page exists in exactly one place, and that
place is a OneDrive folder that already reverted `app/globals.css` once.

---

## Step 1 — reinstall the OS

hPanel → your VPS → **Operating System** → **Reinstall OS** → Ubuntu 24.04.

You said the box is empty. If there is any doubt at all, take a snapshot first
— it is one click and it costs nothing.

The reinstall gives you a new root password and **changes the host key**, so
your SSH client will refuse to connect with a scary warning the first time.
That is expected. On Windows:

```powershell
ssh-keygen -R 187.77.8.98
ssh-keygen -R srv1680197.hstgr.cloud
```

---

## Step 2 — bootstrap

```bash
ssh root@187.77.8.98
cat > setup.sh <<'EOF'
```

…paste `vps-setup.sh`, then `EOF` on its own line, then:

```bash
bash setup.sh
```

Ten minutes, mostly `apt`. It is safe to re-run if something goes wrong
partway. What it leaves behind:

| | project 1 | project 2 |
|---|---|---|
| account | `dev` | `dev2` |
| directory | `~/talent` | `~/app2` |
| dev port | 3000 | 3001 |
| hostname | `srv1680197.hstgr.cloud` | not set yet |
| memory | 6 GB soft / 7 GB hard | 6 GB soft / 7 GB hard |

Plus Node 22, Claude Code, Caddy, a firewall, 4 GB of swap and a
phone-friendly tmux config for each account.

### What the memory ceilings actually do

Each account gets a systemd slice with `MemoryHigh=6G` and `MemoryMax=7G`.
Every process that account starts lands in it — tmux sessions included — so a
Next.js build that runs away gets throttled at 6 GB and killed at 7 GB rather
than dragging the other project down with it. Two accounts at 7 GB leaves
about 2 GB for the OS and Caddy, and the 4 GB swapfile absorbs the overlap
when both build at once.

Adjust later by editing `/etc/systemd/system/user-<uid>.slice.d/50-memory.conf`
and running `systemctl daemon-reload`.

### Why two accounts and not two folders

`/home/dev` is `750`, so `dev2` cannot read `/home/dev/talent/.env` — or the
SSH key, or the Claude session. That is the whole point. One mistake in the
second project does not become an incident in the first.

---

## Step 3 — the five manual pieces

The script prints these and stops. Repeated here so they are in one place.

```bash
passwd dev
passwd dev2
```

**Deploy keys — one per project, not one shared.** Revoking one must not
disturb the other:

```bash
su - dev
ssh-keygen -t ed25519 -C "vps-deploy-talent" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Paste that at `github.com/v7n7v/Inteviewer` → **Settings** → **Deploy keys** →
**Add deploy key**, ticking **Allow write access** so Claude can push from the
box. Repeat as `dev2` against that project's own repo.

**Password hashes for the preview sites.** Pick the passwords yourself, and do
not paste them into a chat window — not to me, not to anyone:

```bash
caddy hash-password
```

Put each hash into the matching `/etc/caddy/sites/<name>.caddy`, replacing
`REPLACE_WITH_HASH`, then `sudo systemctl reload caddy`.

**DNS.** Nothing needed for project 1 — `srv1680197.hstgr.cloud` already
resolves to the box, which is all Let's Encrypt needs. Project 2 needs its own
hostname: an A record at `187.77.8.98`. `talentconsulting.io` points at
Firebase Hosting (`199.36.158.100`) and is untouched by any of this; a `dev.`
or other subdomain sits alongside it and collides with nothing.

---

## Step 4 — clone project 1

```bash
su - dev
git clone git@github.com:v7n7v/Inteviewer.git ~/talent
cd ~/talent
git checkout landing/talent-landing
npm ci
```

`npm ci` rather than `npm install` — it installs exactly the lockfile, which
is the only reason to have one.

---

## Step 5 — the secrets the clone does not carry

Four files are gitignored, correctly, so they are **not** in what you cloned:

| file | what it is |
|---|---|
| `.env` | server-side config |
| `.env.local` | local overrides |
| `.env.cloudrun.yaml` | deployment config |
| `hermes-agent-keys.txt` | agent keys |

`.env.production` **is** tracked and did come across — correctly. Read key by
key, it holds only `NEXT_PUBLIC_*` Firebase config and the Stripe
**publishable** key, all of which ship in the browser bundle anyway.

From Windows:

```powershell
scp .env dev@187.77.8.98:/home/dev/talent/.env
scp .env.local dev@187.77.8.98:/home/dev/talent/.env.local
```

Then on the box:

```bash
chmod 600 ~/talent/.env ~/talent/.env.local
```

### Rotate `hermes-agent-keys.txt` while you are here

It was captured inside a tarball delivered earlier in this project. Gitignoring
it now does not undo that, and you are about to put it on a second machine.
Copying an exposed key to a new host is how one leak becomes two.

The old Supabase item is closed on the repo side: this project runs on
Firestore, there is no `@supabase/*` dependency, no `SUPABASE_*` variable in
any of the five env files, and the only two mentions left are comments in
`lib/firebase.ts` describing the migration. If the hosted project
`qsriqbphmvnnbterqnsv` still exists in your Supabase account, delete it
outright rather than rotating a key for something nothing uses.

---

## Step 6 — run it

```bash
tmux new -s dev
cd ~/talent
npm run dev -- -H 127.0.0.1 -p 3000
```

Detach with **Ctrl-b** then **d**. Reattach from anywhere with
`tmux attach -t dev`.

`-H 127.0.0.1` binds the server to the box's own loopback. Port 3000 is not
open in the firewall and is not reachable from outside — Caddy is the only
thing that can see it.

---

## Step 7 — HTTPS and a password

The site file already exists. Put your hash in it:

```bash
sudo nano /etc/caddy/sites/talent.caddy    # replace REPLACE_WITH_HASH
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

`validate` before `reload`, always. A reload with a broken config takes the
site down and tells you why in the journal; validate tells you why while the
site is still up. If it complains about an **unrecognized directive
`basic_auth`**, the installed Caddy is older than 2.8 — the setup script picks
the right spelling automatically, so this only bites if you hand-edit.

Open **https://srv1680197.hstgr.cloud** on the phone. The certificate is
automatic — Caddy fetches one from Let's Encrypt on the first request, which is
why port 80 had to be open.

**This is the gate I could not run for you.** The landing page has passed the
JS-off render, all fourteen viewport and reduced-motion configurations, the
security scan and the design audit — but nobody has yet looked at it in a real
browser on a real phone.

---

## Step 8 — close the door

Only after key login has worked from the phone at least once.

```bash
sudo nano /etc/ssh/sshd_config
```

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```

```bash
sudo systemctl restart ssh
```

**Keep the current session open** while you test a new one from a second tab.
If key login fails you still have a working shell to undo it in. Hostinger's
browser console is the backstop if it goes wrong anyway. Snapshot after this.

---

## Step 9 — working with Claude on the box

```bash
tmux new -s claude
cd ~/talent
claude
```

First run sends you to a browser to authenticate. After that it is the same
conversation you are used to, except it is *on the box*: it can run
`npm run dev`, `npm run build`, `git push` and
`node scripts/design-audit.js --ci` itself and see the results. None of that
works from where I am now.

Claude Code is installed system-wide but authenticates per account, so `dev`
and `dev2` are separate sessions that cannot see each other's work.

Two tmux windows is the comfortable shape on a phone — Claude in one, the dev
server in the other:

- **Ctrl-b c** — new window
- **Ctrl-b n** / **Ctrl-b p** — next / previous
- **Ctrl-b d** — detach

---

## Adding the second project

When you know what it is:

```bash
su - dev2
git clone git@github.com:you/that-repo.git ~/app2
cd ~/app2 && npm ci
tmux new -s dev2
npm run dev -- -H 127.0.0.1 -p 3001
```

Then give it a hostname — an A record at `187.77.8.98` — and fill in
`/etc/caddy/sites/app2.caddy`, which the script left as a commented stub with
the right port already in it. Uncomment, add hostname and hash,
`systemctl reload caddy`.

If it needs its own database, install it once system-wide and give each project
its own DB and user rather than running two servers.

---

## Worth knowing

- **`next build --webpack` is single-threaded and slow.** A couple of minutes
  is normal and not the VPS struggling.
- **Snapshots.** Take one after step 8, and before anything you would describe
  as "let me just try something".
- **The gaming PC stays the safety net** until the first successful push *from*
  the VPS. Do not wipe the Windows working copy before then.
- **`docs/DECISIONS.md`** is still uncommitted on Windows. It was already
  modified before this session, so I left it alone — it is yours to look at.
