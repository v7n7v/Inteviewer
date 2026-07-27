#!/usr/bin/env bash
# =============================================================================
# Multi-project VPS bootstrap — Hostinger, 16 GB / 100 GB
#
# Run ONCE, as root, on a freshly reinstalled Ubuntu.
#
#   ssh root@187.77.8.98
#   cat > setup.sh <<'EOF'      <- paste, then EOF on its own line, then Enter
#   bash setup.sh
#
# (`cat > file <<'EOF'` beats nano on a phone: one paste, no cursor work.)
#
# Two projects, two Linux accounts. Neither can read the other's .env or SSH
# keys, and neither can eat all 16 GB and take the other down with it.
#
# What it does NOT do, deliberately:
#   · it does not disable password SSH login. Locking yourself out of a box you
#     only reach from a phone is not a recoverable afternoon. That is a later
#     step in the runbook, after key login is proven from the phone itself.
#   · it does not touch secrets, tokens or passwords. It prints the exact
#     commands for those and stops.
#
# Safe to re-run: every step checks before it acts.
# =============================================================================
set -euo pipefail

# ----------------------------------------------------------------- projects
# name : linux user : directory : dev-server port : public hostname
#
# Project 2's hostname is empty on purpose - you do not have a name for it yet.
# Leave it empty and Caddy simply will not serve it; fill it in and reload.
PROJECTS=(
  "talent:dev:talent:3000:srv1680197.hstgr.cloud"
  "app2:dev2:app2:3001:"
)

NODE_MAJOR=22           # package.json engines: node 22
SWAP_GB=4               # insurance, not a substitute for RAM
MEM_HIGH=6G             # soft cap per account: throttle here
MEM_MAX=7G              # hard cap per account: 2x7 leaves ~2 GB for the OS

say()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m!!\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || { echo "run this as root"; exit 1; }

# ------------------------------------------------------------------ 1. base
say "Updating and installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates gnupg git build-essential ufw tmux htop unzip jq \
  debian-keyring debian-archive-keyring apt-transport-https

# ------------------------------------------------------------------ 2. swap
# 16 GB is plenty until two Next.js builds overlap. Swap is the difference
# between "that was slow" and "the OOM killer chose a victim".
if swapon --show | grep -q .; then
  say "Swap already configured"
else
  say "Adding ${SWAP_GB}G swap"
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap -q /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -qw vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi
free -h | head -3

# ------------------------------------------------------------------ 3. node
if have node && [ "$(node -v | cut -c2- | cut -d. -f1)" = "$NODE_MAJOR" ]; then
  say "Node $(node -v) already installed"
else
  say "Installing Node ${NODE_MAJOR}.x from NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
node -v; npm -v

# ---------------------------------------------------------- 4. claude code
# System-wide, so it updates once for both accounts. Authentication is still
# per-user - it lives in each account's ~/.claude - so the two projects do not
# share a session.
if have claude; then
  say "Claude Code already installed"
else
  say "Installing Claude Code system-wide"
  npm install -g @anthropic-ai/claude-code
fi

# --------------------------------------------------------------- 5. accounts
for spec in "${PROJECTS[@]}"; do
  IFS=: read -r name user dir port host <<< "$spec"

  if id "$user" >/dev/null 2>&1; then
    say "User '$user' exists, leaving it alone"
  else
    say "Creating '$user' for project '$name'"
    adduser --disabled-password --gecos "" "$user"
    usermod -aG sudo "$user"
  fi

  # Home directories are 750, not the Ubuntu default 755. With two accounts on
  # one box the default means dev2 can read /home/dev/talent/.env.
  chmod 750 "/home/$user"
  install -d -m 700 -o "$user" -g "$user" "/home/$user/.ssh"

  # your existing root key keeps working, so you are never locked out
  if [ -s /root/.ssh/authorized_keys ] && [ ! -s "/home/$user/.ssh/authorized_keys" ]; then
    cp /root/.ssh/authorized_keys "/home/$user/.ssh/authorized_keys"
    chown "$user:$user" "/home/$user/.ssh/authorized_keys"
    chmod 600 "/home/$user/.ssh/authorized_keys"
  fi

  # --- memory ceiling, per account -----------------------------------------
  # Applies to everything the account runs, tmux sessions included, because
  # systemd puts every one of that user's processes in this slice. A runaway
  # build gets throttled at MemoryHigh and killed at MemoryMax instead of
  # taking the other project down with it.
  uid=$(id -u "$user")
  d="/etc/systemd/system/user-${uid}.slice.d"
  install -d "$d"
  cat > "$d/50-memory.conf" <<EOF
[Slice]
MemoryAccounting=yes
MemoryHigh=${MEM_HIGH}
MemoryMax=${MEM_MAX}
EOF

  # --- shell setup ---------------------------------------------------------
  bashrc="/home/$user/.bashrc"
  grep -q 'PROJECT_DIR' "$bashrc" 2>/dev/null || cat >> "$bashrc" <<EOF

# --- project ---
export PROJECT_NAME="$name"
export PROJECT_DIR="\$HOME/$dir"
export PORT=$port
cd "\$PROJECT_DIR" 2>/dev/null || true
EOF

  # tmux: mobile SSH drops constantly - a tunnel, the screen locking. This is
  # what makes that a non-event rather than a lost build.
  if [ ! -f "/home/$user/.tmux.conf" ]; then
    cat > "/home/$user/.tmux.conf" <<'EOF'
set -g mouse on                 # scroll and select with a thumb
set -g history-limit 50000      # long build output survives
set -g base-index 1
setw -g mode-keys vi
set -g status-bg colour17
set -g status-fg colour51
set -g status-left '#[bold] #S '
set -g status-right ' %H:%M '
set -sg escape-time 0
EOF
    chown "$user:$user" "/home/$user/.tmux.conf"
  fi
done
systemctl daemon-reload

# ----------------------------------------------------------------- 6. caddy
if have caddy; then
  say "Caddy already installed"
else
  say "Installing Caddy (this is what gives you HTTPS and the password prompt)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# Caddy renamed `basicauth` to `basic_auth` in v2.8. The stable repo serves
# current, but pinning the name to the installed version costs six lines and
# saves an "unrecognized directive" wall that is very hard to diagnose from a
# phone.
CADDY_VER=$(caddy version 2>/dev/null | head -1 | sed 's/^v//' | cut -d' ' -f1)
CADDY_MINOR=$(echo "${CADDY_VER:-2.0.0}" | cut -d. -f2)
if [ "${CADDY_MINOR:-0}" -ge 8 ] 2>/dev/null; then AUTH_DIRECTIVE=basic_auth; else AUTH_DIRECTIVE=basicauth; fi
say "Caddy ${CADDY_VER:-unknown}, using '$AUTH_DIRECTIVE'"

# One file per project, so adding or removing a site is one file and a reload
# rather than an edit to a shared blob you have to get right on a phone.
install -d /etc/caddy/sites
grep -q 'import sites/' /etc/caddy/Caddyfile 2>/dev/null || \
  printf '\n# one file per project\nimport sites/*.caddy\n' >> /etc/caddy/Caddyfile

for spec in "${PROJECTS[@]}"; do
  IFS=: read -r name user dir port host <<< "$spec"
  f="/etc/caddy/sites/${name}.caddy"
  if [ -z "$host" ]; then
    [ -f "$f" ] || cat > "$f" <<EOF
# Project '$name' has no hostname yet, so nothing is served for it.
# When you have one: put the hostname in, add the password hash from
# \`caddy hash-password\`, uncomment, then \`systemctl reload caddy\`.
#
# HOSTNAME_GOES_HERE {
# 	encode zstd gzip
# 	$AUTH_DIRECTIVE { you HASH_GOES_HERE }
# 	reverse_proxy 127.0.0.1:$port
# 	@ws { header Connection *Upgrade*
# 	      header Upgrade websocket }
# 	reverse_proxy @ws 127.0.0.1:$port
# }
EOF
    say "Project '$name': no hostname set, wrote a commented stub"
  else
    [ -f "$f" ] || cat > "$f" <<EOF
$host {
	encode zstd gzip

	# Replace the hash with what \`caddy hash-password\` prints. The password
	# itself is never written down here.
	$AUTH_DIRECTIVE {
		you REPLACE_WITH_HASH
	}

	reverse_proxy 127.0.0.1:$port

	# next dev drives hot reload over a websocket; without this the page
	# loads once and then never updates, which looks like a broken build.
	@ws {
		header Connection *Upgrade*
		header Upgrade websocket
	}
	reverse_proxy @ws 127.0.0.1:$port
}
EOF
    say "Project '$name': wrote $f for $host"
  fi
done

say "Validating the generated Caddy config"
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -3 \
  || warn "Caddy config did not validate - fix it before reloading, the site files are in /etc/caddy/sites/"

# --------------------------------------------------------------- 7. firewall
say "Firewall: 22, 80, 443 in; everything else denied"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp  >/dev/null   # ssh
ufw allow 80/tcp  >/dev/null   # http - Let's Encrypt challenge, then redirect
ufw allow 443/tcp >/dev/null   # https
ufw --force enable >/dev/null
ufw status verbose

# Dev server ports are NOT opened. They bind to 127.0.0.1 and only Caddy, from
# inside the box, can reach them.

# ------------------------------------------------------------------- done
echo
say "Base is ready. Accounts, memory ceilings and Caddy site files are in place."
echo
for spec in "${PROJECTS[@]}"; do
  IFS=: read -r name user dir port host <<< "$spec"
  printf '  %-8s user=%-6s dir=~/%-8s port=%-5s host=%s\n' \
    "$name" "$user" "$dir" "$port" "${host:-<not set>}"
done
cat <<EOF

Five things only you can do:

  1. Passwords for the accounts (sudo needs one):
         passwd dev
         passwd dev2

  2. Deploy key for each project, so the box can clone the private repo:
         su - dev
         ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519 -N ""
         cat ~/.ssh/id_ed25519.pub
     Paste at  github.com/v7n7v/Inteviewer  ->  Settings  ->  Deploy keys
     ->  Add deploy key  ->  tick "Allow write access".
     Repeat as dev2 against that project's own repo. Separate keys on
     purpose: revoking one must not disturb the other.

  3. Password hash for each preview site. Pick the passwords yourself and do
     not paste them into a chat window - not to me, not to anyone:
         caddy hash-password
     Put each hash in the matching /etc/caddy/sites/<name>.caddy, then:
         systemctl reload caddy

  4. DNS: nothing needed for '$( echo "${PROJECTS[0]}" | cut -d: -f1 )'.
     srv1680197.hstgr.cloud already resolves to this box, which is all
     Let's Encrypt needs. Project 2 needs its own hostname before Caddy will
     serve it - an A record at 187.77.8.98.

  5. Snapshot the box in hPanel once SSH is locked down. It costs nothing and
     turns "I broke sshd" into a five-minute problem.

Then follow VPS-RUNBOOK.md from step 3.

EOF
