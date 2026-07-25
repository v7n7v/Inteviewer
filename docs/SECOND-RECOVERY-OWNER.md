# Second admin recovery owner — provisioning handover

**Named owner:** `quantumsec01@gmail.com`
**Named by:** alula2006@gmail.com (existing owner), 25 July 2026
**Prepared:** 25 July 2026

> I cannot send email from this session. Forward this file to `quantumsec01@gmail.com`, or work from it directly — the commands are run by the **existing** owner, not by the new one.

---

## Why this matters

This single provisioning unblocks more than anything else outstanding:

| Blocked item | Unblocked by this |
| --- | --- |
| Admin Command Grid §17 — production activation | yes (one of five prerequisites) |
| Admin RBAC — MFA enforcement rollout | yes (the only remaining blocker) |
| Owner recovery safety — currently a single point of failure | yes |

Right now there is **one** owner account. If it loses access, admin recovery is CLI-only from a trusted environment with the production service account. The runbook's own deployment checklist requires *"at least two owners exist before removing or rotating the bootstrap operator."*

---

## Before you start

- [ ] `quantumsec01@gmail.com` must have a **verified** email on Firebase Auth. An existing account with an unverified email cannot be promoted. A brand-new account receives a one-time password setup link.
- [ ] Run from a **trusted environment** — this uses the production Firebase service account.
- [ ] `.env.local` must contain a valid `FIREBASE_SERVICE_ACCOUNT_JSON` for the correct project (`talent-consulting-acf16`). The npm script loads it with `node --env-file=.env.local`.
- [ ] Resend security sender and root domain verified, or the security invitation will not send.
- [ ] Confirm the address is exactly right. Provisioning an owner is the highest-privilege action in this system and it revokes refresh tokens as a side effect.

---

## Step 1 — dry run

The command is **dry-run-only** unless every apply flag is present. Run this first and read the output:

```powershell
npm.cmd run admin:accounts -- --email=quantumsec01@gmail.com
```

Expect a safe inspection report and an `APPLY_HINT` line echoing the exact apply command. If the output is not what you expect, stop here — nothing has changed.

## Step 2 — apply

```powershell
npm.cmd run admin:accounts -- --email=quantumsec01@gmail.com --apply --bootstrap-owner --confirm=quantumsec01@gmail.com
```

All three flags are mandatory and `--confirm` must match `--email` exactly — the script throws `apply:--confirm_must_match_email` otherwise. That guard exists precisely so a mistyped address cannot silently create an owner.

This will:

1. Create or promote the Firebase user
2. Write the versioned `admin_accounts/{uid}` Firestore record
3. Set custom claims (`admin`, `adminRole`, `adminVersion`)
4. Revoke previous refresh tokens
5. Write an audit event to `admin_audit_log`
6. Send a branded security invitation

## Step 3 — the new owner signs in

`quantumsec01@gmail.com` must **sign out and sign back in**. Claims are minted at sign-in; without this the account has the Firestore record but not the token claims, and every admin route will correctly reject it.

## Step 4 — verify

```powershell
npm.cmd run test:admin-accounts
npm.cmd run admin:smoke
```

Then confirm from the app: sign in as `quantumsec01@gmail.com`, open `/suite/admin`, and check the Access module lists **two** active owners.

---

## Step 5 — MFA rollout (this is the part that was actually blocked)

Do **not** flip `ADMIN_MFA_ENFORCED=true` first. The runbook's order exists to avoid locking both owners out of an admin plane that only owners can repair.

Current state:

```dotenv
NEXT_PUBLIC_MFA_ENABLED=false
FIREBASE_MFA_PROJECT_ENABLED=false
ADMIN_MFA_ENFORCED=false
```

Correct order:

1. **Enable MFA in the Firebase console** for `talent-consulting-acf16`.
2. **Set `NEXT_PUBLIC_MFA_ENABLED=true`** and deploy. Note this is a `NEXT_PUBLIC_*` value — it is baked at Docker build time, so this needs a **rebuild**, not just a redeploy.
3. **Both owners enrol a second factor** and confirm they can sign in. This is the step the second owner existed for.
4. **Only then** set `ADMIN_MFA_ENFORCED=true` in the server environment and deploy.

Between steps 3 and 4 you have a working two-owner MFA setup with enforcement still off — that is the safe place to stop and confirm before committing.

---

## What this does *not* unblock

Admin Command Grid §17 has four other prerequisites, none affected by this:

- `ADMIN_AGGREGATE_CRON_SECRET` provisioned in the production GitHub environment, and the scheduled workflow proven to reach production
- A strong production `ADMIN_REFERENCE_SECRET` installed
- Production auth-domain and admin rollout environment values aligned
- Live recovery-owner proof and authenticated MFA smoke token run

And it does nothing for Email V2, which is waiting on Cloudflare MX + `_dmarc` records and `.env.production` credentials.

---

## Security notes

- **Owner is the highest privilege in the system** — full permissions including creating other admin accounts. There is no higher role to recover from a mistake here.
- **An owner cannot edit their own access or another owner from the web console.** That is deliberate. Owner changes are CLI-only from a trusted environment.
- **Never delete the final owner** before confirming a second owner can actually sign in — not just that the record exists.
- `isMasterAccount` in `lib/pricing-tiers.ts` is a commercial-entitlement override and has nothing to do with this. It must never be used to authorise an admin route.
- Provisioning revokes refresh tokens, so expect to sign in again on other devices.
