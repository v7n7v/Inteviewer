# Privacy-Safe User Observability Implementation Plan

Status: challenged and approved for implementation on July 24, 2026.

## Outcome

Build a scalable, privacy-safe observability system that helps TalentConsulting understand product adoption, reliability, and support issues without becoming a surveillance system.

The Admin experience will provide:

- coarse, privacy-suppressed aggregate activity and reliability evidence;
- case-bound, content-free diagnostic metadata for one user only when that user has granted access;
- explicit evidence of consent, retention, staleness, partial data, and authorization state.

Raw prompts, Taco responses, resumes, cover letters, job descriptions, filenames, user-entered titles, search terms, company names, job titles, URLs, email addresses, names, phone numbers, raw Firebase UIDs, provider identifiers, tokens, secrets, stack traces, and provider error messages are outside the observability event model.

This is a high-risk privacy and security change. Production ingestion, Admin reads, aggregate materialization, and the Admin navigation entry remain disabled by default behind one server-controlled feature flag. No deployment or production enablement is part of this implementation.

## Evidence and constraints

The design follows current Firebase guidance on random document IDs, bounded indexes, TTL limitations, distributed counters, query cursors, and server SDK authorization. HMAC subject identifiers are treated as pseudonymous personal data, not anonymous data.

Current project constraints:

- Admin authorization already verifies revoked Firebase tokens, active Firestore Admin records, role/version parity, permissions, and MFA enrollment.
- Current MFA evidence proves a second factor was used, but not that it was used recently.
- Existing general feedback writes are not transactional and cannot be the authorization root for diagnostic access.
- Current GA4 loading is unconditional and several events accept user-controlled values.
- Account deletion is an existing manual workflow and remains unchanged.
- The working tree contains extensive user-owned changes. Implementation must use bounded patches and must not stage, revert, or overwrite unrelated work.

No formal Codex goal is created because the user requested implementation, not creation of a host-managed goal.

## Milestone 1 scope

Milestone 1 builds the disabled foundation and a very small allowlisted event set:

1. Strict observability contracts, pseudonymous subject derivation, consent evidence, idempotent recording, and bounded sharded counters.
2. Typed transactional diagnostic support cases and user grants.
3. An explicit recent-MFA Admin step-up lease.
4. Aggregate Admin API and Option 2 Admin interface.
5. Case-derived, metadata-only user timeline.
6. Central GA4 consent and event sanitation.
7. Firestore rules, indexes, retention configuration, and focused tests.
8. Initial instrumentation only for a few server-confirmed success/failure events that do not require broad edits to product stores.

Broad Taco conversation, artifact-save, and document inventory instrumentation is deferred until the foundation passes independent audit. No historical raw-event backfill is allowed.

## Architecture

### 1. Strict event contracts

Create `lib/observability/` as a server-first package with:

- versioned Zod schemas;
- an enumerated producer registry;
- event-specific schemas with no arbitrary metadata object;
- enumerated tools, actions, outcomes, coarse latency/size/quota bands, plan snapshots, and allowlisted error codes;
- server timestamps and server-generated trace IDs;
- request body and serialized event limits;
- value-free validation logging;
- rejection of unknown fields and out-of-taxonomy values.

Client timestamps, IP addresses, user agents, URLs, user content, and provider identifiers are neither stored nor used in aggregate calculations.

### 2. Pseudonymous subjects and rotation

Derive:

`subjectKey = HMAC(secretVersion, firebaseUid)`

Requirements:

- keys are server-only and supplied by managed runtime secrets in production;
- retained records store only `subjectKey` and `keyVersion`;
- no reverse lookup table is created;
- every key version represented by retained data stays available for authorized reads, export, and reset;
- configured key versions are bounded and validated at startup;
- no subject key is returned by an Admin or user API.

### 3. Purpose and consent separation

Maintain separate purposes:

- `service_reliability`: narrowly enumerated, server-authored operational outcomes only;
- `product_analytics`: optional behavior events, off by default, requires a versioned opt-in receipt;
- `support_diagnostics`: case-bound access to already retained metadata;
- `admin_access_audit`: immutable evidence of sensitive Admin reads.

An analytics preference never authorizes prompt or document inspection. Consent changes go through authenticated server APIs and record notice version, purpose, decision, effective time, and withdrawal time. `privacyControls` is excluded from generic client-writable settings.

GA4 does not load before product-analytics opt-in. Event-specific schemas centrally strip unknown or user-controlled parameters. Existing raw job search terms, company/job titles, resume version IDs, and fabricated timestamp transaction IDs are removed.

### 4. Storage

Server-authoritative collections:

- `user_observability_events/{eventId}`
- `user_observability_summaries/{subjectKey}`
- `user_observability_daily/{day}/shards/{shardId}`
- `diagnostic_support_cases/{caseId}`
- `diagnostic_access_receipts/{receiptId}`
- `observability_reset_jobs/{jobId}`

Per-user server-authoritative records:

- `users/{uid}/settings/privacyControls`
- `users/{uid}/diagnosticGrants/{caseId}`
- `users/{uid}/adminStepUp/current` is not used; Admin step-up records belong to the Admin identity.

Per-Admin server-authoritative records:

- `admin_accounts/{adminUid}/stepUpLeases/observability`

All privileged collections are explicitly denied to Firestore clients. Admin SDK access remains protected by route authorization and Cloud IAM because the Admin SDK bypasses Firestore Rules.

### 5. Idempotent event recording

Every producer supplies a stable operation ID. The recorder derives a uniformly distributed deterministic event document ID from the subject, schema version, producer, and operation ID.

One Firestore transaction:

1. reads the deterministic event reference;
2. rejects operation-ID reuse with a different request fingerprint;
3. creates a new accepted event when absent;
4. applies grouped increments to the per-subject summary and one deterministic daily shard;
5. records expiry and policy versions.

Duplicate retries are successful no-ops. Mixed duplicate/new batches apply only new increments. Optional telemetry failures never fail the product action.

### 6. Ingestion

`POST /api/observability/events` is authenticated and:

- derives the Firebase UID on the server;
- accepts at most 20 events and a tightly bounded JSON body;
- validates each event against its producer-specific schema;
- checks purpose and current consent;
- uses strict distributed rate limiting and fails closed when that limiter is unavailable;
- returns accepted, duplicate, rejected, and disabled counts without exposing storage identifiers.

Callers use a fire-and-forget client helper. The endpoint remains disabled safely while the feature flag is off.

### 7. Scalable aggregates

Daily counters use a configurable shard count with a conservative development default, deterministic shard selection, fixed counter maps, and load evidence before production enablement.

The scheduled Admin aggregate materializer:

- reads bounded daily shards, never raw event population scans;
- produces immutable `observability_v1` cache snapshots;
- preserves the last complete valid snapshot when a refresh is partial or empty;
- applies minimum-cell suppression of counts below 10;
- exposes observation start/end, freshness, completeness, suppressed cells, metric definitions, and limitations;
- labels volume as `observed activity`, not unique users or complete usage.

The Admin API is permissioned, private, no-store, and identity-free. It offers no arbitrary cross-filter builder that could enable differencing attacks.

### 8. Diagnostic cases, grants, and recent MFA

Diagnostic access starts from a new typed, transactional support case. The case is bound to the authenticated user and a fixed metadata-only scope.

User grant:

- visible and revocable;
- bound to one case;
- has an explicit practical expiry;
- never authorizes prompt/document content;
- may be created only through an authenticated server transaction.

Admin step-up:

- requires global Admin MFA enforcement;
- requires a second-factor claim and recent Firebase `auth_time` after explicit reauthentication;
- creates a 15-minute server-side step-up lease;
- remains unavailable to every role, including owner, when these requirements are not met.

`GET /api/admin/diagnostic-cases/{caseId}/activity`:

- derives the target user from the case rather than accepting email or UID lookup;
- requires the distinct `diagnostics.metadata.read` permission;
- reads a bounded deterministic page across every retained HMAC key version;
- filters `expiresAt > now` because TTL deletion is asynchronous;
- uses a signed multi-key cursor;
- immediately before returning data, transactionally rechecks the Admin record/version, permission, recent step-up lease, case state, user grant, and expiry while creating an immutable access receipt;
- returns metadata only and never returns content, raw UID, email, or subject key.

Artifact inventory counts are not scanned from product stores in milestone 1. The UI shows observed events only.

### 9. Admin experience

Add an Option 2 `Observability` Admin module with light/dark and mobile support.

Aggregate view:

- observed activity;
- tool/category mix from coarse allowlisted dimensions;
- success/degraded/failure outcomes;
- aggregate lag, suppression, retention, and consent coverage;
- explicit disabled, loading, empty, sparse, partial, stale, disconnected, and error states.

Diagnostic view:

- starts from a specific support case;
- shows case/grant/step-up state;
- presents a content-free event timeline;
- clearly states that the timeline is partial observed metadata, not a complete user history;
- handles revoked/expired grant, case mismatch, step-up required, mid-pagination expiry, and permission loss;
- supports keyboard navigation, reduced motion, 320px mobile width, and desktop layouts.

### 10. User controls

Add a focused privacy control to Data & Privacy:

- optional product analytics, off by default;
- current notice version and last decision time;
- withdrawal action;
- link to request an observability-only export/reset without claiming full account deletion.

Bug feedback may offer “Share privacy-safe diagnostics for this case.” It states exactly what is shared and what is excluded. The authorization record is transactional with the diagnostic case.

Observability export/reset is separate from account deletion. A reset is an idempotent job that covers retained key versions, events, summaries, dedupe evidence, and grants. Aggregate data is not promised to be subtractable or legally anonymous. The existing account-deletion workflow remains unchanged.

### 11. Retention and rollback

Production enablement requires an approved, versioned retention policy for every purpose. Development may use a short explicit test period while the global feature flag is off.

TTL is cleanup only. Every normal read filters expired records. Verified reset jobs explicitly delete and verify targeted records.

Rollback is one feature flag that disables:

- ingestion;
- materialization;
- Admin APIs;
- diagnostic activity reads;
- the Admin navigation entry.

Rollback does not silently delete retained records.

## Acceptance contract

- **AC-01 Schema:** Unknown fields, arbitrary metadata, user content, PII/secrets, out-of-taxonomy values, oversized bodies/batches, and invalid value lengths are rejected without logging rejected values.
- **AC-02 Subjects:** Server-derived, versioned HMAC subject keys are used; all retained key versions remain readable/resettable; raw UID/email/subject key never appears in event-facing APIs.
- **AC-03 Idempotency:** Stable operation replay is a no-op, altered replay is rejected, and mixed batches increment accepted events exactly once under transaction retries.
- **AC-04 Consent:** Optional analytics defaults off, GA4 does not load pre-consent, withdrawal stops future optional events, and essential telemetry is server-only and non-behavioral.
- **AC-05 Failure:** Optional telemetry cannot break product workflows; ingestion limiter outage fails the ingestion request closed; diagnostic authorization/audit failures deny access.
- **AC-06 Scale:** Configurable sharded counters and scheduled cached aggregates avoid raw scans and hot global documents; partial refreshes preserve the last complete snapshot.
- **AC-07 Aggregate privacy:** Counts below 10 are suppressed; dimensions are coarse; API returns definitions, observation window, staleness, truncation, completeness, and suppression without identities.
- **AC-08 Diagnostics:** Access is case-derived, permissioned, recent-MFA step-up gated, grant-bound, bounded, cursor-safe across key versions, rechecked transactionally, and receipted; owner cannot bypass.
- **AC-09 UI:** Aggregate and diagnostic states work in light/dark, desktop/mobile, keyboard, and reduced-motion modes without implying completeness or exposing content.
- **AC-10 Instrumentation:** Milestone 1 uses only a small server-confirmed allowlist; broad Taco/artifact instrumentation remains deferred until audit.
- **AC-11 GA4:** Event-specific schemas prevent unknown/user strings, raw searches, company/title, resume IDs, URLs, PII, and fabricated transaction IDs from reaching `gtag`.
- **AC-12 Rules/IAM:** Firestore clients cannot read/write privileged collections or consent evidence; emulator tests verify allow/deny behavior; server authorization is tested independently.
- **AC-13 Export/reset:** Observability-only export/reset covers all retained key versions with deterministic pagination, idempotent status/retries, and no claim of full account deletion.
- **AC-14 Retention/rollback:** Production stays disabled without approved policy and secrets; expiry filters are mandatory; one flag disables every observability surface without deleting data.
- **AC-15 Gates:** Typecheck, focused observability tests, Admin tests, release-safety, user-tier safety, CVE scan, production build, API negative tests, and shard contention evidence pass.
- **AC-16 Independent acceptance:** A distinct Auditor, Skeptic, and UI Verifier find no unresolved Critical or High issue; payloads, queries, logs, GA4 network behavior, consent withdrawal, owner bypass, mobile, and keyboard states are inspected.

## Required verification

Focused tests must cover:

- PII/secret/content injection and unknown fields;
- spoofed UID and client timestamp;
- oversized body/batch;
- duplicate, altered replay, mixed batch, and transaction retry;
- optional telemetry outage and strict limiter outage;
- sparse-cell suppression and aggregate retry;
- role/version revocation;
- MFA absent, stale, and recent;
- case/grant mismatch and mid-pagination expiry;
- HMAC key rotation;
- expired-but-not-yet-TTL-deleted records;
- reset retry;
- GA4 pre-consent loading and unknown/user parameter stripping;
- Firestore emulator client denial;
- configurable shard contention/load behavior.

Repository gates:

```bash
npm run type-check
npm run test:observability
npm run test:admin-command-grid
npm run test:user-tier-safety
npm run test:release-safety
npm run security:cve:ci
npm run build
```

Browser verification covers the Admin module and user controls at 320×844, 390×844, and 1440×900 in light/dark and reduced-motion modes, with console and network inspection.

## Deferred work

- Prompt or document content inspection.
- Session replay or keylogging.
- Broad per-artifact and per-Taco instrumentation.
- Historical raw-event backfill.
- External warehouse integration.
- Production secrets, policy approval, enablement, deployment, or live data mutation.

