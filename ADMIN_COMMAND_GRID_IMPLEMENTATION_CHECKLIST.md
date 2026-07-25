# TalentConsulting Admin Command Grid — completion checklist

Last reconciled: 2026-07-23

This is the completion contract for Option 2, the Midnight Command Grid. `[x]` means implemented and verified in the current working tree. `[!]` means code is fail-closed and an external production prerequisite still requires an owner/operator action.

## 0. Source and preservation

- [x] Selected Option 2 reference recorded.
- [x] Existing TalentConsulting and Taco assets reused.
- [x] Current dirty worktree preserved.
- [x] Work isolated on `codex/admin-command-grid`.
- [x] Legacy Access/Audit rollback component preserved.

Evidence: `components/admin/legacy/LegacyAdminAccessRollback.tsx`, `components/admin/visual-review/AdminCommandGridVisualReview.tsx`.

## 1. Dedicated Admin shell

- [x] Persistent `/suite/admin` layout and verified Admin session.
- [x] Overview, Users, Access, Finance, Support, Operations, Email, Calibration, and Audit routes.
- [x] Dedicated Admin workspace rail; consumer Taco/context/onboarding/mobile quick tools suppressed.
- [x] Command bar with role, session posture, permission-aware search, saved landing view, and theme.
- [x] Horizontal permission-aware module navigation with `aria-current`.
- [x] Saved view redirects `/suite/admin` to the selected default module.
- [x] Deep links, browser history, refresh behavior, and denied modules fail closed.

Evidence: `app/suite/admin/layout.tsx`, `components/admin/shell`, `components/workspace/WorkspaceFrame.tsx`.

## 2. Option 2 light/dark visual system

- [x] Isolated semantic Admin tokens.
- [x] Deep navy/cobalt/violet dark palette.
- [x] Deliberately authored cool-white light palette.
- [x] Compact 8px rhythm, 10–12px radii, crisp borders, restrained elevation.
- [x] Google Sans Flex, Inter, and JetBrains Mono roles.
- [x] Existing brand and Material Symbols assets; no replacement CSS art.
- [x] Body and mobile form typography remains readable.

Evidence: `components/admin/admin-command-grid.css`, module-specific Admin CSS, browser captures under `output/admin-command-grid-qa`.

## 3. Shared component and state system

- [x] Shell, topbar, module nav, panel, metric, data table, badge, freshness, sparkline, filters, state boundary, confirmation dialog, detail drawer, segmented control, and pagination primitives.
- [x] Loading, refreshing, empty, partial, stale, disconnected, unauthorized, pending, success, and failure states.
- [x] Icon/text status semantics supplement color.
- [x] Layout-preserving skeletons.

Evidence: `components/admin/primitives`, `hooks/useAdminResource.ts`.

## 4. Typed truthful data

- [x] Canonical `generatedAt`, `staleAfterMs`, `requestId`, `partial`, and `truncated` metadata.
- [x] Canonical `healthy | degraded | blocked | unknown` health.
- [x] Runtime schemas at materialized aggregate boundaries.
- [x] Unknown financial and operational evidence remains null/unknown.
- [x] Abort, latest-request protection, last-good preservation, offline/visibility pause, backoff, and manual refresh.
- [x] Polling limited to the active module.
- [x] Routine refresh performs no external provider probe.
- [x] UI preferences only in versioned `tc_admin_ui_v1`.

Evidence: `lib/admin/contracts.ts`, `lib/admin/aggregate-contracts.ts`, `hooks/useAdminResource.ts`.

## 5. Overview

- [x] Desktop Command Grid and Today rail.
- [x] Verified MRR, readiness, alert, support, and signal-freshness KPIs.
- [x] Revenue/Stripe, Job Supply, Taco, Notifications, and Security lanes.
- [x] Status, evidence age, source, message, and permission-safe drill-down.
- [x] Honest time-range availability, filters, refresh, and bounded snapshot export.
- [x] Priority Queue and redacted aggregate Event Stream with real pause.
- [x] No user/admin email exposure.
- [x] Incident Room is evidence/runbook only and cannot mutate providers or accounts.

Evidence: `components/admin/overview/AdminOverview.tsx`, `components/admin/overview/admin-overview.css`.

## 6. Access and Users

- [x] Owner-only Admin account management.
- [x] Role/version claim reconciliation and token revocation.
- [x] Invite, suspend, reactivate, MFA posture, self-lockout, and last-owner safety.
- [x] CLI-only bootstrap/recovery and server audit evidence.
- [x] Bounded cursor user search and allowlisted summaries.
- [x] Permission-scoped detail drawer.
- [x] Enable/disable workflow with reason, confirmation, version, lease, fingerprint-bound idempotency, audit, and refetch.
- [x] No one-click entitlement writes or full-population/N+1 user scans.

Evidence: `components/admin/access`, `components/admin/users`, `app/api/admin/accounts`, `app/api/admin/users`, `lib/admin-accounts.ts`, `lib/admin/mutation-claims.ts`.

## 7. Finance

- [x] Statistics and costs are cache-only request paths.
- [x] Verified subscription evidence drives MRR.
- [x] Provenance distinguishes verified, calculated, estimated, stale, and unavailable.
- [x] Bounded single-account evidence synchronization.
- [x] Read-only reconciliation preview: maximum 20, concurrency four, deadlines, no writes.
- [x] Accessible finance visualization summaries and exact source windows.
- [x] Promotion/pricing review is evidence-bound and grants no product/provider mutation authority.
- [x] Legacy broad payment preview/export endpoints retired with authenticated 410 responses.

Evidence: `components/admin/finance`, `app/api/admin/stats`, `app/api/admin/costs`, `app/api/admin/billing`, release-safety tests.

## 8. Billing support

- [x] Bounded `stripe_account_review_required` list.
- [x] Strict `new → reviewing → resolved` lifecycle.
- [x] Resolved cases reject later mutation.
- [x] Transactions, bounded current history, append-only detail history, billing audit, and private user receipt sync.
- [x] Start-review and read-only customer-evidence verification.
- [x] Aggregate Stripe counts only; no customer IDs.
- [x] Fifteen-minute evidence lifetime.
- [x] Both attestations, operator note, and exact closure phrase.
- [x] Provider/evidence failure blocks closure without Stripe/reservation mutation.
- [x] Mobile-safe stacked closure controls.

Evidence: `components/admin/support`, `app/api/admin/billing/support-cases`, `scripts/stripe-account-review-case.test.js`.

## 9. Operations and settings

- [x] Aggregate private Operations readiness.
- [x] Strict-rate-limited forced job-supply verification.
- [x] Stripe, Ever Jobs, Taco, Resend, authentication, and security posture without secrets.
- [x] Feature flag, announcement, and maintenance controls behind `settings.manage`.
- [x] Consequential settings require reason, confirmation, version, fingerprint-bound idempotency, and audit.
- [x] Readiness refresh performs no provider mutation.

Evidence: `components/admin/operations`, `app/api/admin/ops`, `app/api/admin/settings`.

## 10. Email

- [x] Configuration fingerprint and webhook/receipt freshness without credentials.
- [x] Scheduled status aggregates replace per-view population counts.
- [x] Durable claim is reserved before a canary provider side effect.
- [x] Provider completion, audit, health, and claim evidence are committed transactionally.
- [x] Consent and delivery-paused states respected.
- [x] Explicit bounded audited idempotent sending only; no Overview sends.
- [x] Mobile-safe controls.

Evidence: `components/admin/email`, `app/api/admin/email`, `lib/admin/aggregate-materializer.ts`.

## 11. Calibration

- [x] Owner-only navigation, search, UI, and API.
- [x] Aggregate-only results with no resume, company, user content, or display names.
- [x] Top-three calibration, score buckets, cohort/exclusion evidence, ordering checks, and missing evidence.
- [x] Small cohorts suppressed.
- [x] Stale evidence disables export.
- [x] Bounded review packet and explicit no-automatic-score-change contract.
- [x] Score-weight and threshold mutation authority fixed to false.

Evidence: `components/admin/calibration`, `app/api/admin/ops/recommendation-calibration`, calibration tests.

## 12. Audit

- [x] Bounded cursor pagination, deterministic secondary ordering, and allowlisted filters.
- [x] Detailed identities permission-scoped.
- [x] Actor, target, action, request/idempotency ID, reason, timestamp, and allowlisted changes.
- [x] Product copy says append-only, not cryptographically immutable.
- [x] Bounded, private, permission-scoped, formula-injection-safe export.

Evidence: `components/admin/audit`, `app/api/admin/audit`.

## 13. Motion, accessibility, and responsive behavior

- [x] Bounded module, row, drawer, fresh-data, and event transitions.
- [x] No permanent chart animation or critical pulse.
- [x] Reduced-motion overrides.
- [x] Light/dark contrast, visible focus, semantic links/tables, chart summaries, and named controls.
- [x] Drawer Escape, focus trap, focus return, and scroll preservation.
- [x] Desktop, tablet, 390×844, and 320×844 layouts.
- [x] KPI strip/cards/full-screen sheets/safe-area actions at narrow widths.
- [x] Minimum 44×44px actions and no page-level mobile overflow.

Evidence: Admin CSS, Admin primitives, `output/admin-command-grid-qa`, `design-qa.md`.

## 14. Security, privacy, and scale

- [x] Every Admin route has a server guard.
- [x] Consequential mutations use `requireAdminMutation`.
- [x] No email-address authorization bypass.
- [x] Private/no-store responses and anonymous fail-closed behavior.
- [x] Mutation claims use short leases, attempt counters, fencing, and operation replay.
- [x] Common bounded idempotency keys and actor/target/request fingerprint binding.
- [x] Support data has 365-day TTL; current history is bounded.
- [x] Aggregate materialization has a ten-minute schedule, global lease, fencing, deploy-time prime, and freshness proof.
- [x] Deployment is pinned; Hosting/Cloud Run rollback and public smoke logic are automated.
- [x] Live recovery-owner proof verifies two active, verified, MFA-enrolled owners when mutations are enabled.
- [x] Legacy unbounded/identifying billing endpoints are retired.

Evidence: `lib/admin-auth.ts`, `lib/admin/mutation-claims.ts`, `lib/admin/aggregate-*`, `.github/workflows/admin-aggregate-materialization.yml`, `deploy-fix.js`, `firestore.indexes.json`.

## 15. Automated verification

- [x] `npm run type-check`
- [x] `npm run test:admin-command-grid` — 24/24
- [x] `npm run test:release-safety` — 243/243
- [x] `npm run test:sona-harness` — 329/329
- [x] `npm run test:notifications` — 32/32
- [x] `npm run test:recommendation-calibration` — 11/11
- [x] `npm run test:career-twin` — 3/3
- [x] `npm run test:resume-guardrails` — 17/17
- [x] `npm run test:job-recovery` — 19/19
- [x] `npm run test:job-supply` — 18/18
- [x] `npm run test:mobile-review` — 11/11
- [x] `npm run test:mobile-action-inbox` — 28/28
- [x] `npm run test:sidebar-parity` — 6/6
- [x] `npm run security:cve:test` — 6/6
- [x] `npm run security:cve:ci` — 0 high/critical
- [x] `npm audit --audit-level=high --omit=dev` — 0 vulnerabilities
- [x] `npm run seo:audit:test` — 6/6
- [x] `npm run build` — 180 static pages, all Admin routes included

## 16. Browser and independent review

- [x] Same-state dark desktop comparison with selected source.
- [x] Light desktop, tablet, 390×844, and 320×844 captures.
- [x] Combined source/implementation comparison input.
- [x] Console, runtime overlay, overflow, sticky navigation, drawer, focus, Escape, and touch-target checks.
- [x] Architecture re-audit after final remediation: PASS, no P0/P1.
- [x] Security/privacy red-team re-audit after final remediation: code PASS, no P0/P1.
- [x] Performance/scalability re-audit after final remediation: PASS, no P0/P1.
- [x] Visual/accessibility re-audit after final remediation: PASS, no P0/P1/P2.
- [x] Final checklist reconciliation and `design-qa.md` Admin result.

## 17. External production activation

- [!] Provision `ADMIN_AGGREGATE_CRON_SECRET` in the production GitHub environment and prove the scheduled workflow can reach production.
- [!] Provision and verify a second active recovery owner with MFA. Owner `quantumsec01@gmail.com` provisioned and sign-in verified 25 July 2026; **MFA not yet enrolled** - Firebase project MFA is still disabled, so no second factor exists on either owner. This item stays open until both owners have enrolled.
- [!] Align the production auth-domain and Admin rollout environment values.
- [!] Install a strong production `ADMIN_REFERENCE_SECRET`.
- [!] Run the live recovery-owner proof and authenticated MFA smoke token.
- [!] Capture the live rollback point, deploy, prime aggregates, and run smoke tests only after the user explicitly requests production deployment.

No external prerequisite is represented as complete by a Boolean assertion alone. Production stays fail-closed until the live proof commands succeed.
