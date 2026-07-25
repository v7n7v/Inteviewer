# TalentConsulting Enterprise Email System Tracker

Last updated: 2026-07-23

This tracker is the source of truth for the enterprise email-system implementation. A task is marked complete only when the implementation and its listed verification evidence both exist.

## Status Legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete and verified
- `[!]` Blocked by an external prerequisite

## 1. Baseline and Governance

- [x] Inventory the existing Resend, Firebase Auth, Stripe webhook, notification-preference, communication-log, and brand-asset paths.
  - Evidence: reviewed `lib/email.ts`, `lib/email-templates.ts`, `lib/firebase.ts`, `app/auth/reset-password/page.tsx`, `app/api/webhooks/resend/route.ts`, `app/api/stripe/webhook/route.ts`, `app/suite/settings/page.tsx`, and `public/brand/` on 2026-07-19.
- [x] Record the approved implementation scope and decisions.
  - Evidence: this tracker reflects code-owned React Email templates, separate transactional/marketing streams, root-domain transactional delivery on the current one-domain Resend plan, Stripe-authoritative financial documents, free support routing, immediate transactional cutover after pre-production gates, and deferred marketing sends.
- [x] Create a maintained implementation tracker with completion evidence.
  - Evidence: `EMAIL_SYSTEM_IMPLEMENTATION_TRACKER.md`.

## 2. Template Foundation and Brand System

- [x] Add React Email dependencies and local preview/render/test commands.
  - Evidence: pinned `react-email@6.9.0`; `npm run email:export` rendered the preview directory successfully on 2026-07-19; `email:dev`, `email:export`, and `test:email-system` commands are present.
- [x] Add shared email tokens, layout, logo header, preheader, CTA, details table, callout, and compliant footer components.
  - Evidence: `emails/tokens.ts` and `emails/components/`; the shared layout uses the canonical logo and `#2E3FFF` / `#5A6BFF` brand colors.
- [x] Establish the official gradient “A” as the labeled Taco email identity and add a stream-safe social footer.
  - Evidence: `TalentEmailLayout` renders the production-hosted official “A” only inside a clearly labeled Taco hero/byline; `account.welcome` and all eight product templates opt in. X, Bluesky, and Reddit URLs are environment-controlled, HTTPS/platform-host validated, and fail-closed behind `EMAIL_SOCIAL_LINKS_ENABLED`. Security, billing, disputes, support, deletion, incidents, and internal templates never request the footer.
  - Verification (2026-07-22): typecheck, eight-template React Email export, and the complete 59/59 email regression suite passed. Three mock-labeled owner review messages—production welcome, Career Picks, and weekly recap—were accepted and subsequently reported `delivered` by Resend.
- [x] Add typed event keys, streams, senders, preferences, payload schemas, and rendered-email contracts.
  - Evidence: `lib/email/contracts.ts` reserves the complete event vocabulary and declares stream, sender, preference, structured-content, definition, and rendered-message contracts; implemented definitions carry Zod payload schemas in `lib/email/catalog.ts`.
- [x] Implement HTML and plain-text rendering with safe URL, subject, and content handling.
  - Evidence: `lib/email/render.tsx`; `npm run test:email-system` passed 6 renderer/security cases and `npm run type-check` passed on 2026-07-19.
- [x] Add preview fixtures for security, account, billing, support, product, and internal templates.
  - Evidence: six category previews in `emails/previews/`; `npm run email:export` generated all six HTML files and representative 500px/desktop renders were visually inspected on 2026-07-19.
- [x] Retire legacy builders from active delivery and preserve typed compatibility sender adapters over the new renderer.
  - Evidence: no application route calls a legacy HTML builder for delivery; the retained public helpers in `lib/email.ts` render typed catalog events. The legacy template module remains only as a temporary type/reference compatibility surface.

## 3. Transactional Template Catalog

- [x] Security: verification, password reset, password changed, email change/recovery, new sign-in, MFA, recovery codes, sessions revoked, account lock, and administrator invitation.
- [x] Account/privacy: welcome, preferences receipt, deactivation/reactivation, deletion, export, and material policy notices.
- [x] Billing/Stripe: subscription, trial, renewal, invoice/payment, plan/interval, cancellation, payment method, price change, refund, and dispute lifecycle.
- [x] Support/service: feedback receipt, case lifecycle, billing review, maintenance, and incident lifecycle.
- [x] Product: Career Picks, Taco digest, study reminder, application/interview/offer updates, workflow results, and weekly recap.
- [x] Internal operations: refund/dispute escalation, Stripe reconciliation, delivery failures, queue backlog, complaints, support requests, and security anomalies.
  - Evidence: `lib/email/catalog.ts` implements every reserved event; the exhaustive renderer contract test renders every event to branded HTML and plain text. The catalog now contains 74 events: 72 permitted transactional/product/internal templates and two hard-disabled marketing templates.
- [x] Keep marketing event keys reserved but prevent marketing rendering/sending until a valid postal address and explicit launch approval exist.
  - Evidence: marketing is present in the catalog, live rendering and outbox enqueueing fail closed, `EMAIL_MARKETING_ENABLED=false` is documented, and `EMAIL_MAILING_ADDRESS` remains blank.

## 4. Firebase Authentication and Account Actions

- [x] Add an enumeration-safe, rate-limited password-reset request route using Firebase Admin action links and the branded Security template.
  - Evidence: `app/api/auth/password-reset/route.ts` returns before user lookup/send work via Next `after()`, rate-limits hashed IP and email identifiers, suppresses user-not-found differences, and sends `security.password_reset_requested` using the Admin-generated action code.
- [x] Replace the signed-in-user reset page with a custom action-code handler for `resetPassword`, `verifyEmail`, and `recoverEmail`.
  - Evidence: `app/auth/reset-password/page.tsx` validates and applies Firebase action codes for all three modes instead of requiring an authenticated user.
- [x] Enforce Firebase password policy, safe continuation URLs, invalid/expired/used-code states, and accessible success/error UI.
  - Evidence: the handler uses Firebase `validatePassword`, only forwards an allowlist of Firebase action parameters, drops untrusted continuation URLs, maps invalid/expired codes, and includes labelled inputs, focus states, and live status/alert regions.
- [x] Emit password/email action confirmations without trusting a client-supplied recipient.
  - Evidence: `/api/auth/password-reset/complete` completes the Firebase REST reset and derives the confirmation address from Firebase's response; email-change completion verifies the signed state against the current Firebase Admin user before sending changed/recovery notices. Settings password changes use an authenticated UID-derived confirmation route.
- [x] Implement signed, single-use, expiring account deactivation/deletion confirmation links.
  - Evidence: `lib/account-action-tokens.ts`, `/api/account/lifecycle`, `/api/account/lifecycle/confirm`, and `/account/action`; HMAC validation is timing-safe, pending-state consumption is transactional, links expire after 30 minutes, optional email is paused, and deletion confirmation creates a safe operations workflow instead of silently purging retained data.
- [x] Remove the client Firebase generic reset-email send path after verified cutover.
  - Evidence: `lib/firebase.ts` no longer imports or calls Firebase `sendPasswordResetEmail`; its public helper calls `/api/auth/password-reset`. `npm run test:auth` passed 19 tests and `npm run test:email-system` passed 11 tests on 2026-07-19.

## 5. Preferences and Optional Product Email

- [x] Add a durable `CommunicationPreferences` contract and Firestore document.
  - Evidence: `lib/communication-preferences.ts` defines the versioned, revisioned contract and `users/{uid}/settings/communicationPreferences` storage path with all optional categories defaulted off.
- [x] Add authenticated preference GET/PATCH routes.
  - Evidence: `app/api/communication-preferences/route.ts` derives the UID from verified auth, validates strict partial patches, writes transactionally, and refuses marketing activation.
- [x] Wire every Settings email toggle to durable preferences; default visual-only legacy toggles off.
  - Evidence: `app/suite/settings/page.tsx` loads/saves Study, Application, Interview, Offer, and Newsletter email controls; formerly visual-only activity defaults are now false.
- [x] Preserve existing Career Picks consent and cadence.
  - Evidence: Career Picks remains on `/api/jobs/preferences` with its explicit consent/version, frequency, provider-pause, and tier rules; the unified read model reflects it without weakening that path.
- [x] Add signed category unsubscribe links for optional product email without requiring login.
  - Evidence: `lib/email/unsubscribe.ts`, `/api/email/unsubscribe`, and `/email/unsubscribe`; outbox delivery creates the category-scoped link at dispatch so the signed token is not stored in the message payload.
- [x] Recheck preferences at dispatch time.
  - Evidence: `getOptionalEmailPermission` reloads both unified and Career Picks preferences, and `lib/email/outbox.ts` invokes it after leasing and immediately before recipient resolution/render/send.

## 6. Delivery, Outbox, and Receipts

- [x] Add deterministic message IDs and a Firestore outbox/message schema.
  - Evidence: `lib/email/outbox.ts` derives stable SHA-256 message IDs from event/recipient/dedupe scope and creates immutable-identity `email_outbox` documents transactionally.
- [x] Add transactional leasing, retry schedule, dead-letter handling, and protected cron dispatch.
  - Evidence: transactional claims, five-minute leases, expired-lease recovery, seven bounded retry delays, eight-attempt dead-lettering, and timing-safe `CRON_SECRET` protection in `app/api/cron/email-outbox/route.ts`.
- [x] Centralize all Resend sends behind lazy client initialization and one delivery API.
  - Evidence: repository contract test confirms `lib/email.ts` is the only file under `app/` or `lib/` that invokes `.emails.send()` and contains exactly one such call. The Resend webhook route initializes the SDK only for signature verification.
- [x] Add message/template/stream/category tags and deterministic Resend idempotency keys.
  - Evidence: rendered messages carry event/stream/category/template tags; outbox delivery adds the deterministic message tag and `tc-{messageId}` provider idempotency key.
- [x] Generalize verified Resend webhook receipts to every email category.
  - Evidence: `lib/email/receipts.ts` normalizes and applies signed outbox receipts with replay, message-ID, provider-ID, recipient-hash, and monotonic-order checks; the webhook preserves the existing Career Picks receipt path.
- [x] Pause optional delivery after hard bounce, suppression, or complaint.
  - Evidence: generic receipt application pauses unified optional email and legacy Career Picks email transactionally for user recipients on bounce, suppression, or complaint.
- [x] Store safe communication metadata only; never persist full HTML, passwords, action codes, or raw security links.
  - Evidence: the outbox resolves addresses from authenticated UIDs at dispatch, stores only a recipient hash after sending, caps metadata/payload size, rejects sensitive field names, never stores rendered bodies, and refuses all Security payload persistence.

## 7. Stripe, Support, and Operations Wiring

- [x] Map supported Stripe events to the typed billing catalog without duplicate customer messages.
  - Evidence: `app/api/stripe/webhook/route.ts` maps subscription, trial, invoice/payment, plan/interval, cancellation, refund, and dispute events to deterministic outbox messages; the initial subscription invoice companion is intentionally suppressed.
- [x] Keep Stripe-hosted receipts/invoices/refund receipts authoritative and link companions to those documents.
  - Evidence: customer companions link `hosted_invoice_url` or Stripe-hosted billing documents when present, and the templates state that Stripe remains the source of record.
- [x] Add missing upcoming renewal and payment-action-required handling.
  - Evidence: `invoice.upcoming` and `invoice.payment_action_required` are in the handled event contract and have typed customer templates.
- [x] Add customer-safe and internal refund/dispute variants with evidence kept internal.
  - Evidence: customer templates use amount/status summaries; operations variants carry bounded internal reference/details and point staff to Stripe for evidence.
- [x] Replace fire-and-forget billing email work with durable enqueueing.
  - Evidence: the Stripe webhook awaits deterministic `enqueueEmail` work; no direct or unawaited Resend send remains.
- [x] Route support replies and internal alerts through configured addresses.
  - Evidence: sender/reply-to resolution uses `EMAIL_SUPPORT_REPLY_TO`, `EMAIL_OPS_REPLY_TO`, and private `EMAIL_OPS_DESTINATION`; contact and authenticated feedback routes queue both customer receipts and operations alerts without hard-coded personal inboxes.

## 8. Configuration and External Readiness

- [x] Add documented environment variables for transactional senders, support reply-to, ops destination, feature flag, signing secrets, cron, and mailing-address gate.
  - Evidence: `.env.example` and `docs/email-system-runbook.md`.
- [x] Align every transactional sender with the verified `talentconsulting.io` root domain.
  - Evidence: after Resend rejected a second domain on the current one-domain plan, the owner approved a root-domain architecture on 2026-07-22. `.env.example`, `scripts/email-release-readiness.js`, its regression tests, and the runbook now require `security@`, `account@`, `billing@`, `taco@`, `support@`, and `operations@` on the exact verified root domain. A live read-only Resend inventory check reports `verified_and_sending_enabled`; marketing remains reserved on the disabled `news` subdomain.
- [!] Configure free Cloudflare Email Routing for `support@`, `ops@`, and `dmarc@` to an owner-controlled destination.
  - Provider evidence (2026-07-19): Cloudflare nameservers are authoritative, but root Cloudflare Email Routing MX records are absent and `_dmarc.talentconsulting.io` is absent/incomplete. No Cloudflare API credential or verified destination inbox is available in the deployment configuration.
  - External prerequisite: Cloudflare dashboard access and destination inbox verification.
- [!] Configure branded `support@talentconsulting.io` replies through Resend SMTP in the destination mailbox.
  - External prerequisite: the owner-controlled destination mailbox, completed Cloudflare forwarding, and a scoped Resend SMTP credential. No mailbox-side change was attempted without those resources.
- [x] Keep `news.talentconsulting.io` and all marketing sends disabled.
  - Evidence: marketing render/enqueue gates fail closed; the runbook explicitly prohibits verifying or sending from the reserved marketing domain during transactional cutover.

## 9. Verification and Cutover

- [x] Add renderer contract coverage for every in-scope event.
  - Evidence: `scripts/email-system.test.js` derives every reserved event key and renders each from a schema-complete fixture to HTML and plain text; catalog completeness independently checks versioned definitions.
- [x] Add injection, unsafe URL, header, long-content, Unicode, missing-optional, and narrow-width structural cases.
  - Evidence: renderer/security tests cover HTML injection, header newlines, unsafe schemes, Unicode, omitted fields, bounded schemas, viewport metadata, fixed table layout, and fail-closed sender configuration.
- [x] Add auth action-flow and account-enumeration tests.
  - Evidence: `scripts/email-auth-actions.test.js` and `scripts/email-account-actions.test.js`; `npm run test:auth` passed 19 tests.
- [x] Add outbox concurrency, retry, idempotency, preference, dead-letter, and webhook replay tests.
  - Evidence: `scripts/email-outbox.test.js`, `scripts/communication-preferences.test.js`, and generalized receipt tests validate transactional claims, expired lease recovery, bounded retries, deterministic identity, dispatch-time preference checks, dead-letter escalation, monotonic receipts, and replay rejection.
- [x] Extend Stripe fixture coverage for every mapped communication event.
  - Evidence: `scripts/stripe-email-outbox.test.js`, exhaustive billing renderer fixtures, and `npm run test:stripe-envelope` (9/9 passed).
- [x] Add a value-safe, read-only transactional release-readiness gate.
  - Evidence: `scripts/email-release-readiness.js`, `scripts/email-release-readiness.test.js`, and `npm run email:release-check`; eight focused tests verify the single-root-domain sender contract, strong/distinct secrets, fail-closed flags, Resend inventory, Cloudflare MX/DMARC, deployment probes, no shell-secret fallback, zero provider writes, and zero email sends.
- [x] Add and execute a guarded complete-catalog owner sample-delivery workflow.
  - Evidence: `scripts/send-email-template-samples.js`, synthetic fixture data, `npm run email:samples`, and five focused tests. The operator is dry-run by default, accepts exactly one recipient, labels every subject as mock, uses deterministic recipient/run/event idempotency, rate-limits central delivery, and cannot enable marketing.
  - Live evidence (2026-07-22): dry-rendered all 71 permitted templates, then Resend accepted 71/71 samples for the owner-selected evaluation inbox with zero provider errors. Both hard-disabled marketing templates were correctly skipped. The post-send provider snapshot reported 30 `delivered` and 41 `sent`, with zero failed, bounced, complained, or canceled messages; mailbox placement remains for the owner to evaluate.
- [x] Create and deliver four elevated first-impression welcome concepts for owner evaluation.
  - Evidence: `emails/concepts/WelcomeConcepts.tsx`, `scripts/send-welcome-email-concepts.js`, and four focused regressions. The concepts explore career-command-center, first-10-minute-win, Taco-introduction, and confidence/story-led positions through the production brand system. They remain sample-only and have no signup, catalog, queue, or marketing trigger.
  - Live evidence (2026-07-22): all four labeled review copies were accepted and subsequently reported `delivered` by Resend for the owner-selected evaluation inbox, with zero failures.
- [-] Run the existing auth, notification, billing, release-safety, type-check, and production-build gates.
  - Passing evidence (2026-07-23): email system 59/59, auth 27/27, Stripe envelope 9/9, TypeScript, preview export, and the 168-route production build. The focused admin/deployment safety suite also passes 23/23.
  - Existing repository gaps outside this email scope: notification suite passes 31/32 but references a missing `app/api/cron/weekly-suggestions/route.ts`; release-safety passes 220/237 with failures caused by already-missing admin/checkout routes, tracked production-env drift, and Windows owner-only permission expectations.
- [x] Render representative emails and visually inspect desktop and narrow layouts.
  - Evidence: security, billing, product, support, account, and internal HTML previews were inspected at desktop and 500px widths. The shared layout includes a mobile viewport, percent-width wrapper, fixed table layout, logo alt text, and plain-text fallbacks. Image-disabled behavior is covered by the canonical logo alt text; dark-mode colors remain deliberately explicit for transactional consistency.
- [!] Run deployed shadow rendering, then perform the approved full transactional cutover with the rollback flag.
  - Live evidence (2026-07-23): Resend's root transactional domain was previously verified with sending enabled. The deployed Resend webhook now returns the expected post-only `405`, and the unauthenticated outbox cron probe returns the expected guarded `401` with `private, no-store`. The value-safe release gate performs zero provider writes and sends zero email, but correctly fails because `.env.production` does not yet contain the V2 API/webhook credentials, sender and reply routing, signing secrets, private operations destination, application origin, or cutover flags.
  - External prerequisite: complete Cloudflare inbound MX/DMARC and mailbox routing, populate the tracked production V2 configuration, configure the scheduler with the production cron secret, and run shadow verification before enabling transactional cutover. The exact procedure and rollback are in `docs/email-system-runbook.md`.
- [x] Confirm no direct Resend sends, generic Firebase reset emails, arbitrary HTML sends, or duplicate Stripe financial notices remain.
  - Evidence: central-delivery source scan test, Firebase helper source test, removal of `sendCustomEmail`, Stripe deterministic outbox tests, and successful production build.

## Update Log

- 2026-07-19: Created tracker; completed baseline inventory and recorded approved architectural decisions. Template foundation started.
- 2026-07-19: Completed the React Email dependency/tooling, shared brand components, typed contracts, and safe dual-format renderer. Added security and billing previews plus six passing renderer/security tests.
- 2026-07-19: Migrated welcome, account-access, subscription, trial, plan-change, and cancellation senders to the typed renderer without changing their public function signatures.
- 2026-07-19: Implemented the branded password-reset request and custom Firebase action-code experience. Removed the generic client reset sender; focused auth and email tests pass.
- 2026-07-19: Added durable communication preferences and wired every Settings email toggle; marketing remains hard-disabled and legacy opt-ins default off.
- 2026-07-19: Added the Firestore email outbox, transactional leases/recovery/retries/dead letters, protected dispatcher, deterministic provider idempotency, and generalized signed Resend receipts with optional-email suppression.
- 2026-07-19: Completed the full security/account/billing/support/product/internal catalog, six category previews, signed unsubscribe, and hard-disabled marketing gate.
- 2026-07-19: Centralized every provider send, migrated welcome/study/outcome/feedback and preserved tracked Career Picks/Taco receipt semantics through the central renderer.
- 2026-07-19: Completed trustworthy password/email confirmations plus branded email-change recovery and signed single-use account lifecycle confirmation flows.
- 2026-07-19: Completed Stripe lifecycle mapping, support/operations routing, deployment environment contract, DNS/cutover runbook, exhaustive event rendering, production build, and visual QA. External DNS/dashboard and deployed cutover gates remain blocked.
- 2026-07-19: Added the value-safe release gate and expanded the email suite to 45/45. Live read-only checks proved Cloudflare authority and the protected cron route, and precisely identified absent MX/DMARC, incomplete deployment configuration, an unhealthy webhook route, no Resend webhook, and the one-domain Resend plan constraint. No email was sent and no provider state changed.
- 2026-07-19: Re-ran the value-safe gate against both `.env.local` and `.env.production` after two prior blocked audits. External state is unchanged: the transactional domain/webhook, Cloudflare inbound MX/DMARC, mailbox routing, production secrets, and healthy deployed webhook remain unavailable. Both audits again performed zero provider writes and sent zero emails; further cutover work now requires an external account/configuration change or user-provided access.
- 2026-07-22: Owner approved replacing the rejected transactional-subdomain design with the already verified root domain. Updated all active sender contracts, environment examples, release checks, tests, and operator instructions while preserving stream separation and keeping marketing hard-disabled.
- 2026-07-22: Verified the revision end to end: focused readiness tests pass 8/8, the full email suite passes 46/46, TypeScript and the 167-page production build pass, no active `notify` reference remains, and the live zero-write provider gate confirms the root domain is verified with sending enabled. The Resend domain-capacity blocker is closed.
- 2026-07-22: Added the reusable guarded catalog-sample operator and sent the authorized evaluation run. Resend accepted all 71 live non-marketing templates with zero errors; two disabled marketing templates remained blocked. Expanded the email regression suite to 51/51 and recorded provider state without storing the review address or message bodies.
- 2026-07-22: Created four sample-only high-impact welcome concepts and delivered all four to the authorized review inbox. Resend confirms all four delivered; the production `account.welcome` trigger remains unchanged pending the owner's selection. Expanded the email regression suite to 55/55.
- 2026-07-22: After owner approval, promoted the elevated career-command-center/Taco experience into production `account.welcome`, added labeled Taco identity blocks to all product templates, and added a separately gated social footer for welcome/product/future approved marketing only. Delivered three targeted review samples successfully and expanded the email regression suite to 59/59.
- 2026-07-23: Added `security.admin_invitation`, bringing the catalog to 74 total events and 72 permitted live templates, and connected it to the owner-only administrator provisioning workflow. Deployed the admin-enabled 168-route application and Firestore rules to production. The live webhook and cron boundary probes now pass (`405`/`401`), while the zero-write release audit continues to block transactional V2 cutover on missing tracked production configuration plus Cloudflare MX/DMARC.
