# User Observability Implementation Checklist

Source of truth: `docs/user-observability-implementation-plan.md`

## Plan gates

- [x] Baseline captured.
- [x] External primary-source research completed.
- [x] High-risk plan challenged by a read-only Skeptic.
- [x] Plan revised to address every blocking challenge.
- [x] Foundation build complete.
- [x] Independent code/security audit complete.
- [x] Independent challenge complete.
- [x] UI verification complete.
- [x] Acceptance contract reconciled.

## Foundation

- [x] AC-01 strict event schemas and size/body limits.
- [x] AC-02 versioned HMAC subject registry and rotation support.
- [x] AC-03 transactional idempotent recorder and sharded increments.
- [x] AC-04 versioned consent evidence; optional analytics off by default.
- [x] AC-05 fail-open product helper and fail-closed ingestion limiter.
- [x] AC-06 bounded aggregate materialization and cache preservation.
- [x] AC-07 minimum-cell suppression and aggregate metadata.
- [x] AC-12 explicit Firestore denies, TTL, indexes, and emulator tests.
- [x] AC-14 one disabled-by-default feature flag across all surfaces.

## Diagnostic authorization

- [x] Typed transactional diagnostic support case.
- [x] Visible, revocable, case-bound user grant.
- [x] `diagnostics.metadata.read` permission.
- [x] Recent-MFA reauthentication evidence and 15-minute Admin step-up lease.
- [x] Case-derived metadata activity endpoint.
- [x] Signed multi-key cursor and expiry filtering.
- [x] Transactional final recheck plus immutable access receipt.
- [x] Owner-bypass negative tests.

## Product and analytics

- [x] Central event-specific GA4 schemas.
- [x] GA4 blocked before product-analytics opt-in.
- [x] Raw search/company/title/resume-ID/timestamp-ID parameters removed.
- [x] Tiny milestone-1 server-confirmed observability producers.
- [x] Broad Taco/artifact instrumentation remains deferred.

## Interfaces

- [x] Option 2 Admin Observability module.
- [x] Aggregate disabled/loading/empty/sparse/partial/stale/error states.
- [x] Diagnostic case/grant/step-up/timeline states.
- [x] Data & Privacy consent control.
- [x] Bug-feedback diagnostic-sharing control.
- [x] Observability-only export/reset request surface.
- [x] Light/dark, reduced motion, keyboard, 320/390/1440 verification.

## Verification

- [x] `npm run type-check`
- [x] `npm run test:observability`
- [x] `npm run test:admin-command-grid`
- [x] `npm run test:user-tier-safety`
- [x] `npm run test:release-safety`
- [x] `npm run security:cve:ci`
- [x] `npm run build`
- [x] Firestore emulator allow/deny tests.
- [x] Shard contention/load evidence.
- [x] Independent Auditor: no unresolved Critical/High.
- [x] Independent Skeptic: no unresolved Critical/High.
- [x] Independent UI Verifier: pass.

## Acceptance evidence — July 24, 2026

- TypeScript: pass.
- Observability contracts: 31/31 pass.
- Firestore/Auth emulator: 8/8 pass, including expired-job starvation and malformed-expiry denial.
- Admin Command Grid: 24/24 pass.
- User tier safety: 3/3 pass.
- Release safety: 244/244 pass.
- Security CVE audit: 0 High/Critical findings.
- Production build: 181 pages generated.
- Independent Auditor: PASS, 0 Critical/High.
- Independent Skeptic: PASS, AC-01 through AC-16, 0 Critical/High.
- Independent UI Verifier: PASS at 320/390/1440 in light/dark, 0 Critical/High.
- `USER_OBSERVABILITY_V1_ENABLED` remains disabled; no deployment or production enablement occurred.

## Production boundary

- [x] No deployment authorized by this request.
- [x] No production enablement authorized by this request.
- [ ] Retention policy approved before any future production enablement.
- [ ] Managed HMAC secrets installed before any future production enablement.
- [ ] Production smoke and rollback runbook approved before deployment.
