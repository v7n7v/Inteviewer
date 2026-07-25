# Changelog

All notable changes to Talent Studio (`talentconsulting-io`).

**Maintenance note:** the previous version of this file stopped at the January 2026 "Hirely.ai" era and described a Supabase/IndexedDB stack that was never shipped. It has been rebuilt from git history and the implementation trackers. Entries from 2026-05-06 onward were reconstructed from the four workstream trackers, because that work is **not yet committed** — see [Unreleased](#unreleased).

Format follows [Keep a Changelog](https://keepachangelog.com/). Dates are ISO-8601.

---

## [Unreleased]

> **These changes exist in the working tree only.** Last commit is `6bfd9a6` (2026-05-06). Roughly 2.5 months of work — 552 modified and 352 untracked files — has not been committed. See `GIT-RECOVERY-RUNBOOK.md` for the recovery and commit procedure.

All four workstreams below are **code-complete and test-passing, but gated on external prerequisites**. None are live.

### Added — Admin Command Grid ("Midnight Command Grid")

Nine-module admin console: Overview, Users, Access, Finance, Support, Operations, Email, Calibration, Audit.

- Firestore-backed RBAC replacing email-based admin checks — six roles (`owner`, `administrator`, `billing_admin`, `support_admin`, `operations_admin`, `analyst`) across 17 permissions (`lib/admin-permissions.ts`, `lib/admin-auth.ts`)
- Revocation-checked token verification with custom-claim cross-check and MFA gating
- Admin audit log, mutation claims, aggregate cache, CLI account bootstrap
- API surface under `app/api/admin/**` — accounts, audit, billing reconciliation, support cases, diagnostic cases, ops, observability, promo, settings, stats
- Security, privacy, performance and accessibility re-audits: **PASS**, no P0/P1

**Blocked on:** `ADMIN_AGGREGATE_CRON_SECRET`, `ADMIN_REFERENCE_SECRET`, a named second MFA recovery owner, production auth-domain alignment, and an explicit deploy request.

### Added — Email system V2

- React Email catalog of 74 events (72 live; 2 marketing templates hard-disabled pending `EMAIL_MAILING_ADDRESS`)
- Firestore outbox with leases, retries and a dead-letter path (`app/api/cron/email-outbox/`)
- Stripe lifecycle → email mapping; signed unsubscribe links; Resend delivery receipts
- Root-domain sender alignment on `talentconsulting.io`, verified and sending
- 71/71 live sample templates accepted by Resend

**Blocked on:** Cloudflare Email Routing MX and `_dmarc` records for `support@` / `ops@` / `dmarc@`; `.env.production` missing V2 API and webhook credentials, sender/reply routing, signing secrets, ops destination, app origin and cutover flags.

### Added — User Observability v1

- Event, summary and daily-rollup collections with TTL policies
- Diagnostic authorization requiring MFA step-up, with access receipts and user-facing grant control
- GA4 gating, privacy export and reset endpoints (`app/api/privacy/observability/**`)
- Admin Observability module
- Independent Auditor, Skeptic and UI-Verifier reviews: all **PASS**

**Blocked on:** retention-policy approval, managed HMAC secrets, and an approved smoke/rollback runbook. Ships behind `USER_OBSERVABILITY_V1_ENABLED` (currently disabled).

### Added — Jobs, recommendations and packets

- Talent Fit v2: one versioned score shared across search, Taco, scheduled work and email
- Recommendation ledger, impressions and calibration review loop
- Job supply health monitoring; Ever Jobs staging canary
- Packet identity, state and recovery paths
- Notification delivery with receipt contracts and consent handoff

### Changed — Resume Studio

- Source Arrival Console, Review Workbench, Proof Engine Compact Cockpit
- Integrated Source Confirmation flow
- Truth locks re-applied at the PDF and DOCX export boundary (`lib/resume-export-truth.ts`)
- Resume review ledger and provenance tracking
- Three signature resume templates

### Fixed

- Theme-contrast regressions across Resume Studio surfaces

### Known blocked item

- **Three Signature Resume Templates** design-QA section is `blocked`. The in-app browser refused `localhost` under its URL security policy, so Technical Signal and Brutalist Voltage have no rendered captures. Closeout needs A4 captures per template, combined comparisons, and verification of selection, reload mapping, 390px mobile, dark-paper isolation and console state. The other nine design-QA sections pass.

### Test posture at time of writing

| Suite | Result |
| --- | --- |
| `test:release-safety` | 244/244 |
| `test:assistant-harness` | 329/329 |
| `test:admin-command-grid` | 24/24 |
| `test:email-system` | 59/59 |
| `test:observability` | 31/31 |
| `npm run build` | 180–181 static pages |
| `security:cve:ci` | 0 high/critical |

---

## [2.0.0] — 2026-05-06

### Fixed
- Voice switching and transcript sync in the interview simulator
- Real-time admin tier updates

## [2026-05-02]

### Added
- Deterministic data-science analytics layer
- Market Oracle 3D polish, tier filters, Avatar Interview, industries dropdown
- Skill Graph PNG export; Avatar Interview activated (removed "Coming Soon")

### Changed
- Comprehensive mobile responsiveness overhaul
- SEO metadata layouts for nine suite pages (agent, cover-letter, interview-sim, negotiate, network, linkedin, gallery, vault, jd-generator)
- AI Humanizer updates

## [2026-04-26]

### Fixed
- Lazy-init Stripe, Firebase and Resend clients to prevent build-time crashes
- `package-lock.json` regenerated for Cloud Build compatibility
- `.env.production` added with public Firebase config for build-time SSG

### Added
- Admin Command Center overhaul — design-system alignment, cost analyzer, email notifications

## [2026-04-25]

### Security
- Cloudflare Turnstile bot protection **(P0)**
- In-memory rate limiter replaced with Upstash Redis **(P0)** — the in-memory limiter was unsound on multi-instance Cloud Run

### Added
- Cloud Run deployment setup
- Gemini Live WebSocket for real-time interview voice, with binary message handling and live transcript persistence
- Unified `ResumeLibraryPicker` across all tools; Sona resume awareness
- No-navigate Cover Letter / LinkedIn flows; Saved Blueprints panel
- LAUNCH50 promo banner (50% off Pro)
- Sidebar consolidation, ATS auto-fix, typewriter hints

### Fixed
- **Strict guardrail: never fabricate certifications in morphed resumes**
- Usage tracker migrated from Client SDK to Admin SDK
- Removed dev-user fallback; fixed Firestore `PERMISSION_DENIED`
- Audio stuttering; voice model switched to `gemini-2.5-flash-native-audio-latest`
- Modal design consistency; card colors, search icon, `PageHelp` position

## [2026-04-23]

### Added
- Discord monitoring, 7-day trial, referral system, promo codes
- Emerald branding unification; free tool limits set to 3/day

## [2026-04-22]

### Added
- ATS Match Score Dashboard, Multi-Detector Scan, Humanize & Verify loop

## [2026-04-21]

### Security
- Platform hardened against OWASP Top 10

### Added
- Cover Letter Studio persistence; AI detection engine upgrade

## [2026-04-19] — 1.0.0

### Added
- Landing page redesign, Free Tools Hub, mobile optimization

## [2026-04-13]

### Added
- Max tier system
- Security hardening, session persistence, theming, freemium caps

## [2026-03-16] – [2026-03-27]

### Added
- Full light mode with theme toggle
- Structural canvas/card UI separation

### Security
- Comprehensive API hardening

### Changed
- Eliminated hardcoded dark hex backgrounds; consolidated CSS overrides
