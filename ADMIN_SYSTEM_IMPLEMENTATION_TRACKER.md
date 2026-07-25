# TalentConsulting Admin System Implementation Tracker

Last updated: 2026-07-23

This tracker is the source of truth for the administrator account system. A task is complete only when its implementation and verification evidence both exist.

## Status Legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete and verified
- `[!]` Blocked by a required owner decision or external prerequisite

## 1. Authorization Model

- [x] Replace email-address authorization with server-enforced role-based access control.
  - Evidence: `lib/admin-permissions.ts` defines the role and permission matrix; `lib/admin-auth.ts` enforces permissions on the server. No email address is an authorization condition.
- [x] Require a verified, non-revoked Firebase identity and a matching server-only administrator record.
  - Evidence: access requires verified Firebase ID-token claims plus an active `admin_accounts/{uid}` record with matching email, role, and role version.
- [x] Invalidate stale sessions after role or status changes.
  - Evidence: every mutation increments the role version, updates claims, and revokes refresh tokens.
- [x] Add rate limits and mutation-specific authorization.
  - Evidence: protected admin APIs use shared read/mutation guards and permission checks.
- [x] Deny client access to administrator records and audit entries.
  - Evidence: production `firestore.rules` explicitly denies client reads and writes to `admin_accounts` and `admin_audit_log`; the rules compiled and were released on 2026-07-23.

## 2. Roles and Least Privilege

- [x] Implement Owner, Administrator, Billing Administrator, Support Administrator, Operations Administrator, and Analyst roles.
  - Evidence: `lib/admin-permissions.ts` contains the complete role-to-permission map.
- [x] Restrict administrator creation to owners.
  - Evidence: the accounts POST API and provisioning service require the owner-only account-management permission.
- [x] Prevent unsafe web changes to owner accounts.
  - Evidence: owners cannot change their own access or modify another owner through the web console; bootstrap/recovery remains guarded CLI-only.
- [x] Keep the sidebar and page UI as discovery surfaces rather than security boundaries.
  - Evidence: all protected data and mutations are authorized again in the API layer.

## 3. Account Lifecycle and Audit

- [x] Add administrator directory, create/invite, role change, suspend, reactivate, and inspect workflows.
  - Evidence: `lib/admin-accounts.ts`, `/api/admin/accounts`, and `/api/admin/accounts/[uid]`.
- [x] Add immutable security audit events for provisioning and access changes.
  - Evidence: `admin_audit_log` writes are server-only and `/api/admin/audit` exposes permission-checked reads.
- [x] Add a branded administrator invitation.
  - Evidence: `security.admin_invitation` is a typed transactional security event; new administrators receive a one-time setup invitation through the central email delivery system.
- [x] Add guarded first-owner bootstrap and recovery tooling.
  - Evidence: `scripts/admin-account-provision.js` defaults to dry run and requires the exact email, `--apply`, `--bootstrap-owner`, and matching confirmation.

## 4. Administrator Command Center

- [x] Add an authenticated administrator page.
  - Evidence: `/suite/admin` renders the account directory, creation form, role/status controls, and audit history.
- [x] Discover access from the current server-authorized session.
  - Evidence: `/api/admin/session` returns only the verified administrator role and permissions; the sidebar uses this endpoint.
- [x] Keep anonymous and non-admin callers out of all administrator APIs.
  - Live evidence (2026-07-23): the production anonymous session probe returns `401` with private no-store caching.

## 5. First Production Owner

- [x] Provision and invite the first production owner.
  - Evidence: `alula2006@gmail.com` has active Firebase owner claims and a matching active version-1 Firestore administrator record. Previous refresh tokens were revoked and the branded invitation was sent.
- [x] Verify the owner against the deployed production APIs.
  - Live evidence (2026-07-23): health and `/suite/admin` passed; the owner session was authorized as `owner`; the active directory record was readable at version 1; audit access passed; anonymous access was denied.
- [!] Provision and verify a second recovery owner.
  - Required owner decision: provide the exact verified email address for the second trusted owner. No security principal will be guessed or created without that selection.

## 6. MFA Rollout

- [x] Add fail-closed MFA enforcement support.
  - Evidence: the server requires an MFA-authenticated identity whenever `ADMIN_MFA_ENFORCED=true`; deployment preflight rejects enforcement when the Firebase project MFA capability is not enabled.
- [x] Keep enforcement disabled until recovery safety exists.
  - Evidence: `NEXT_PUBLIC_MFA_ENABLED=false`, `FIREBASE_MFA_PROJECT_ENABLED=false`, and `ADMIN_MFA_ENFORCED=false` are the verified current production posture.
- [!] Enable Firebase MFA, enroll two owners, and enforce MFA for administrator access.
  - Prerequisites: select and verify the second owner, enable the Firebase project MFA capability, test enrollment and recovery, then turn on server enforcement.

## 7. Verification and Production Deployment

- [x] Add focused administrator account and deployment safety tests.
  - Evidence: the latest focused run passes 23/23; the complete auth suite passes 27/27.
- [x] Pass application gates.
  - Evidence: TypeScript, the 59/59 email regression suite, and the 168-route production build pass.
- [x] Deploy the application, generated server function, Hosting assets, and Firestore rules.
  - Evidence: Firebase completed the Node.js 22 second-generation function update in `us-east1`, finalized and released Hosting, and released Firestore rules on 2026-07-23.
- [x] Preserve the complete production runtime configuration during framework deployment.
  - Evidence: the deploy wrapper stages the approved runtime environment only during Firebase packaging and restores the local root `.env` in `finally`. Post-deploy comparison found `missingLive: []`, and the local file hash matched before and after deployment.
- [x] Run the authenticated production smoke test after the final runtime refresh.
  - Evidence: `npm run admin:smoke -- --email=alula2006@gmail.com --online` passed health, page, anonymous boundary, owner session, owner record, audit, and MFA-posture assertions.

## Next Security Milestone

The administrator system is live and operational. The next safe milestone is to provision a second named owner, verify that owner can sign in, then enable and test Firebase MFA enrollment before enforcing MFA for administrator APIs.

## Update Log

- 2026-07-23: Completed the role/permission model, dual claims-and-record authorization, protected APIs, command center, audit log, invitation template, guarded bootstrap workflow, tests, production deployment, and authenticated production smoke test. First owner is active. Second-owner selection and MFA rollout remain intentionally pending.
