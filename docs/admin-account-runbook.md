# TalentConsulting Admin Account Runbook

## Security model

Admin access is granted only when all of these checks pass on the server:

1. Firebase verifies the ID token and checks token revocation.
2. The email address in the token is verified.
3. Custom claims contain `admin: true`, a supported role, and an integer role version.
4. A server-only `admin_accounts/{uid}` Firestore record is active.
5. Email, role, and version match between the token and Firestore.
6. The role contains the permission required by the requested API route.
7. MFA is present when `ADMIN_MFA_ENFORCED=true`.
8. The admin request is within the protected rate limit.

The sidebar is only a discovery surface. It is not an authorization boundary.

## Roles

| Role | Intended access |
| --- | --- |
| Owner | All permissions, including creating other admin accounts |
| Administrator | User, billing, support, operations, settings, email, and analytics administration |
| Billing administrator | Customer and billing read/write access |
| Support administrator | Customer support and approved customer communications |
| Operations administrator | Platform operations, settings, billing visibility, and analytics |
| Analyst | Aggregate analytics only |

Only an owner can create admin accounts. Owner creation or recovery is CLI-only.

## Create the first owner

The command is dry-run-only unless every apply flag is present.

```powershell
npm.cmd run admin:accounts -- --email=owner@example.com
```

Review the safe inspection output. Apply only to the exact verified owner:

```powershell
npm.cmd run admin:accounts -- --email=owner@example.com --apply --bootstrap-owner --confirm=owner@example.com
```

The workflow creates or promotes the Firebase user, writes the versioned Firestore admin record, sets custom claims, revokes previous refresh tokens, writes an audit event, and sends a branded security invitation.

After provisioning, the owner must sign out and sign back in to obtain the current claims.

## Create additional administrators

1. Sign in as an owner.
2. Open `/suite/admin`.
3. Enter the verified work email and select the least-privilege role.
4. Select **Create and invite**.
5. Ask the administrator to follow the secure invitation and then sign in again.

Existing Firebase accounts must have a verified email before they can be promoted. New accounts receive a one-time password setup link.

## Suspend or change access

Use the Admin command center. Every role or status change increments the role version, updates custom claims, revokes refresh tokens, and writes an audit event. An owner cannot edit their own access or another owner from the web console.

For owner recovery, use the guarded CLI from a trusted environment. Never delete the final owner before confirming a second owner can sign in.

## MFA rollout

Keep both values false until Firebase MFA is enabled and an enrollment flow is tested:

```dotenv
NEXT_PUBLIC_MFA_ENABLED=false
ADMIN_MFA_ENFORCED=false
```

After enrollment is available, enable the client enrollment flow first. Confirm at least two owners can enroll and sign in. Then set `ADMIN_MFA_ENFORCED=true` in the server environment and deploy.

## Deployment checklist

- `FIREBASE_SERVICE_ACCOUNT_JSON` is server-only and belongs to the correct project.
- `ADMIN_MFA_ENFORCED` matches the tested Firebase MFA state.
- Resend security sender and root domain are verified.
- Firestore rules deny client access to `admin_accounts` and `admin_audit_log`.
- `npm run test:admin-accounts`, `npm run test:email-system`, and `npm run type-check` pass.
- At least two owners exist before removing or rotating the bootstrap operator.
- No email address is used as an admin authorization condition.

## Production verification

Run the smoke test in dry-run mode first:

```powershell
npm.cmd run admin:smoke -- --email=owner@example.com
```

Then authorize the live, read-only production checks for the exact owner:

```powershell
npm.cmd run admin:smoke -- --email=owner@example.com --online
```

The online check verifies health, the admin page, anonymous denial, the authenticated role and permissions, the active administrator directory record, audit access, and the current MFA posture. It mints a short-lived Firebase custom token for verification but never prints the token.

The Firebase framework deploy wrapper temporarily stages the approved runtime variables for function packaging and always restores the local root `.env` in `finally`. After a deploy, compare environment key names only; never print values. A successful release must show no expected live keys missing and an unchanged local `.env` hash.

Production evidence from 2026-07-23:

- Firebase Hosting, the generated Node.js 22 server function, and Firestore rules deployed successfully.
- The first owner session was authorized as `owner`, with an active version-1 directory record and readable audit log.
- Anonymous `/api/admin/session` access was denied.
- The post-deploy runtime comparison reported `missingLive: []`.
- MFA remains deliberately disabled until a second owner and tested enrollment/recovery path exist.

## Incident response

If an admin credential is suspected compromised:

1. A second owner suspends the account in `/suite/admin`.
2. Confirm the account record is suspended and its claims are removed.
3. Reset the Firebase password and revoke provider sessions as applicable.
4. Review `admin_audit_log` and application/provider logs for activity.
5. Restore access only after the identity is secured and MFA is enrolled.
