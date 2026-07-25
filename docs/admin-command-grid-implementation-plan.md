# TalentConsulting Admin Command Grid — implementation plan

Last reconciled: 2026-07-23

## 1. Product outcome

Build Option 2, the Midnight Command Grid, as a dedicated operational application inside TalentConsulting. It must feel like a high-end command center without becoming a decorative dashboard: every status is evidence-backed, every privileged action is permission-scoped and auditable, and unavailable data remains visibly unavailable.

The implementation is complete when:

- all nine Admin modules share one responsive light/dark design system;
- the Overview gives a fast, truthful operational picture without exposing user content;
- high-risk actions are bounded, versioned, idempotent, MFA-gated, and recoverable;
- expensive reads are materialized on a repository-owned schedule rather than repeated per viewer;
- desktop, tablet, and mobile interaction models remain usable and accessible;
- independent architecture, security/privacy, performance, and visual reviews find no unresolved P0/P1 release defect;
- production activation remains fail-closed until the external recovery-owner, MFA, secret, scheduler, and deployment proofs exist.

## 2. System architecture

### 2.1 Application shell

`/suite/admin` owns a dedicated shell instead of inheriting the consumer workspace chrome. The shell includes:

- a compact command bar with current role, authentication posture, theme, module search, saved landing view, and freshness context;
- permission-aware horizontal module navigation;
- the existing TalentConsulting workspace rail, reduced to Admin-safe navigation;
- lazy rollback UI when the command-grid release flag is disabled;
- no Taco orb, consumer context panel, onboarding modal, consumer command palette, or mobile quick-tools rail.

The shell is rendered once by `app/suite/admin/layout.tsx`. Module pages own only their operational content.

### 2.2 Shared contract boundary

All Admin read responses use a canonical envelope:

- `generatedAt`
- `staleAfterMs`
- `requestId`
- `partial`
- `truncated`

Health is one of `healthy`, `degraded`, `blocked`, or `unknown`. Unknown or unavailable evidence is never converted to a zero, a green status, or an inferred success.

Runtime schemas validate materialized statistics, finance, and email snapshots before a stored payload crosses an API boundary. Responses are private and non-cacheable in browsers.

### 2.3 Data acquisition and scale

Routine Admin reads are split into two classes:

1. Bounded request-time reads for small operational datasets, cursor-based lists, and explicitly requested single-account workflows.
2. Scheduled aggregate materialization for population metrics and email counters.

The aggregate scheduler runs every ten minutes, below the 15-minute snapshot TTL. A global lease prevents overlapping materializations, a fencing token prevents older workers from overwriting newer evidence, and deployment primes the snapshots before smoke testing.

The UI polls only the visible module, pauses while hidden or offline, aborts superseded requests, preserves the last good payload, and applies jittered exponential backoff after failures.

### 2.4 Mutation safety

Every Admin mutation passes:

- verified Firebase authentication;
- active server-side Admin account lookup;
- exact role permission;
- rollout and mutation feature gates;
- MFA posture;
- recovery-owner production proof;
- strict distributed rate limiting;
- bounded schema validation;
- a reason and explicit confirmation for consequential changes;
- a version precondition where concurrent state matters;
- a fingerprint-bound idempotency key;
- transactional audit evidence.

Long-running mutations use short execution leases with attempt counters and fencing IDs. A crashed worker does not strand the operation for the retention lifetime: a retry can reclaim an expired lease and resume or reconcile the original operation.

## 3. Design system

### 3.1 Visual language

The visual system follows the selected Option 2 reference:

- deep navy canvas and header in dark mode;
- layered navy panels, cobalt selection, violet Taco accent, and saturated but semantic telemetry colors;
- deliberate cool-white light mode with navy text and the same information hierarchy;
- compact 8px rhythm, 10–12px radii, crisp one-pixel borders, restrained elevation, and dense operational tables;
- Google Sans Flex for major headings, Inter for UI copy, and JetBrains Mono for identifiers, timestamps, versions, latency, rates, and exact finance values.

Light mode is separately authored, not mechanically inverted.

### 3.2 Motion

Motion explains state:

- module indicator: 160–200ms;
- row response: 120–160ms with no more than 1px lift;
- drawer/sheet: 200–240ms;
- restrained fresh-data wash and event insertion;
- no continuous chart drawing or pulsing critical alerts.

`prefers-reduced-motion` removes translation, pulse, number rolling, and chart animation.

### 3.3 Responsive behavior

Desktop uses the full command-grid composition. Tablet converts the Today rail to a KPI strip and stacks secondary panels. Mobile uses:

- a compact sticky header;
- horizontally scrollable module tabs;
- two-column KPIs, then one column below 390px;
- card representations of operations, queue, and stream rows;
- full-screen detail and incident sheets;
- safe-area-aware sticky actions;
- minimum 44×44px action targets;
- 16px form controls;
- zero page-level horizontal overflow at 320px and 390px.

## 4. Module implementation

### 4.1 Overview

The Overview combines:

- a Today rail for verified MRR, readiness, alerts, support volume, and selected-signal freshness;
- a five-lane Operations Map for Revenue & Stripe, Job Supply, Taco Providers, Notifications, and Security;
- honest 1H/6H/24H/7D availability;
- a permission-safe Priority Queue;
- a redacted aggregate Event Stream with true pause/resume behavior;
- an Incident Room that explains evidence, freshness, related signals, and runbook links without performing a provider or destructive mutation.

### 4.2 Users

Users supports bounded cursor search, allowlisted operational summaries, a permission-scoped detail drawer, and a safe enable/disable flow. It deliberately excludes one-click entitlement changes. Billing inconsistencies route to reconciliation evidence.

### 4.3 Access

Access preserves the hardened Admin Accounts implementation:

- owner-only invite and account lifecycle controls;
- role/version claim reconciliation;
- token revocation;
- self-lockout and last-owner protection;
- MFA posture;
- server-written audit records;
- CLI-only bootstrap and recovery.

### 4.4 Finance

Finance displays authoritative subscription and cost evidence with explicit provenance: verified, calculated, estimated, stale, or unavailable. It supports:

- a bounded single-account evidence sync;
- a read-only reconciliation preview capped at 20 accounts and four concurrent provider lookups;
- accessible chart summaries;
- promotion and pricing economics reviews bound to provider-verified evidence;
- no price, promotion, trial, entitlement, or Stripe mutation authority.

The earlier broad legacy preview/export endpoints are retired with authenticated `410 Gone` responses.

### 4.5 Support

Support restores `stripe_account_review_required` cases with the strict lifecycle `new → reviewing → resolved`. Verification is read-only and returns aggregate counts only. Closure requires:

- fresh evidence no older than 15 minutes;
- account-history and checkout-safety attestations;
- an operator note;
- exact phrase `CLOSE BILLING REVIEW`.

Current case history is bounded, detailed history is append-only in a subcollection, resolved cases reject later transitions, and the private user receipt remains synchronized.

### 4.6 Operations

Operations exposes private, aggregate readiness for Stripe, Ever Jobs, Taco providers, Resend, authentication, and security posture. Forced job-supply verification is explicit and strictly rate-limited. Settings mutations require permission, version, reason, confirmation, idempotency, and audit evidence.

### 4.7 Email

Email reads scheduled status counters instead of issuing repeated population queries. It shows configuration fingerprint and receipt freshness without returning secrets. Canary sending reserves a durable claim before the provider call and commits completion, audit, and health evidence transactionally. Sending is explicit, bounded, consent-aware, audited, and never triggered by an Overview refresh.

### 4.8 Calibration

Calibration is owner-only and aggregate-only. It includes top-three calibration, score buckets, cohort and exclusion evidence, ordering checks, missing evidence, small-cohort suppression, stale export blocking, and a bounded review packet. It explicitly authorizes no automatic score-weight or threshold change.

### 4.9 Audit

Audit uses bounded cursor pagination and allowlisted filters. Deterministic secondary ordering prevents equal timestamps from skipping records. Detailed identities remain permission-scoped. Export is bounded, private, and formula-injection safe. The product accurately describes the evidence as application append-only, not cryptographically immutable.

## 5. Accessibility and state model

Every resource has explicit loading, refreshing, empty, partial, stale, disconnected, unauthorized, pending, success, and error handling. Status always has text/icon semantics in addition to color. Drawers trap focus, close on Escape, return focus, and preserve the page scroll position. Navigation uses links and `aria-current`; data tables remain semantic; charts have text/table summaries; icon-only controls have accessible names and tooltips.

## 6. Verification strategy

### Automated gates

- TypeScript and production build
- Admin accounts and Admin Command Grid contracts
- Sona/Taco harness and release safety
- billing, checkout, notification, calibration, career twin, resume, recovery, and job-supply contracts
- mobile review, mobile action inbox, and sidebar parity
- CVE audit and package audit
- SEO unit and local crawl checks

### Browser/design gates

- source and implementation in one normalized comparison image;
- dark and light at desktop;
- tablet at 768px;
- mobile at 390×844 and 320×844;
- no runtime overlay, console errors, clipped actions, or page-level overflow;
- keyboard, Escape, focus return, reduced motion, and 200% zoom checks.

### Independent gates

- architecture/scalability reviewer;
- security/privacy red team;
- performance reviewer;
- completion checklist reconciliation.

## 7. Rollout and rollback

The release flag is `NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2`. Production mutation surfaces additionally require the Admin mutation, MFA, recovery-owner, and reference-secret gates.

Deployment is pinned to Firebase project `talent-consulting-acf16`. Before deployment, the release script captures:

- the current Hosting release into a dedicated rollback channel;
- the current Cloud Run SSR revision.

After deployment it primes Admin aggregates, checks freshness, and runs public/anonymous smoke tests. A critical smoke failure restores Hosting and Cloud Run to the captured rollback point.

Production deployment remains intentionally blocked until all external items in the implementation checklist are proven and the user explicitly requests deployment.
