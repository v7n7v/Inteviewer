# TalentConsulting Enterprise Email Runbook

Owner: TalentConsulting operations  
System of record: `EMAIL_SYSTEM_IMPLEMENTATION_TRACKER.md`  
Transactional sending domain: `talentconsulting.io`  
Reserved marketing domain: `news.talentconsulting.io` (disabled)

## 1. Architecture and ownership

Application events render code-owned React Email templates into both HTML and plain text. Security actions send immediately because action codes and secure URLs must never enter a durable queue. Account, billing, support, product, and internal messages use the Firestore `email_outbox` unless they already belong to the older Career Picks/Taco provider-receipt state machine. Every provider send passes through `lib/email.ts`; no route owns a Resend send client.

Stripe remains the source of truth for receipts, invoices, refunds, and dispute evidence. TalentConsulting billing emails are lifecycle companions and link to Stripe-hosted documents when Stripe provides them. They must not restate card evidence or imply that a companion message is the financial record.

Streams and senders:

| Stream | Examples | Sender |
| --- | --- | --- |
| Security | reset, password/email change, MFA, sign-in alert | `security@talentconsulting.io` |
| Account | welcome, access, privacy, deactivation/deletion | `account@talentconsulting.io` |
| Billing | subscription, payment, refund, dispute | `billing@talentconsulting.io` |
| Product | Career Picks, Taco, reminders, recaps | `taco@talentconsulting.io` |
| Support | customer case receipts and updates | `support@talentconsulting.io` |
| Internal | delivery, Stripe, support, security escalation | `operations@talentconsulting.io` to the private ops destination |
| Marketing | announcements/newsletters | Reserved and hard-disabled |

Official references: [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Resend DMARC guidance](https://resend.com/docs/dashboard/domains/dmarc), [Cloudflare Email Routing addresses](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/), and [Resend SMTP](https://resend.com/docs/send-with-smtp).

## 2. DNS and receiving-address setup

These steps require Cloudflare and Resend dashboard access and are not performed by the application deployment.

Architecture revision (2026-07-22): after Resend rejected a second domain on the current plan, the owner approved using the already verified `talentconsulting.io` root domain for all transactional streams. Stream isolation is preserved through distinct local parts, provider tags, outbox metadata, preferences, and operational reporting, but domain-level reputation isolation is intentionally deferred. Marketing remains isolated in the catalog and disabled because `news.talentconsulting.io` is not verified.

1. Confirm Resend continues to report `talentconsulting.io` as verified with sending enabled. Preserve its provider-supplied SPF/MX return-path and DKIM records. Do not replace or proxy them when adding inbound routing.
2. Send no V2 traffic if the root domain, SPF, or DKIM becomes unverified.
3. In Cloudflare, open Compute > Email Service > Email Routing. Add the owner-controlled destination inbox and complete its verification email.
4. Create exact-address routes for `support@talentconsulting.io`, `ops@talentconsulting.io`, and `dmarc@talentconsulting.io` to that verified destination. Avoid a catch-all until unwanted-mail handling is defined.
5. Allow Cloudflare to install the root MX records required for Email Routing. Recheck any existing MX records before accepting changes.
6. Add root DMARC in monitoring mode after `dmarc@` receives successfully:

   `v=DMARC1; p=none; rua=mailto:dmarc@talentconsulting.io; adkim=r; aspf=r; pct=100`

7. Send from every legitimate service, inspect headers for SPF, DKIM, and DMARC pass, and monitor aggregate reports for at least two normal business cycles. Move to `p=quarantine`, then `p=reject`, only after all legitimate sources align.
8. Cloudflare Email Routing is inbound forwarding, not a hosted mailbox. To reply as `support@talentconsulting.io` from the destination mailbox, configure that mailbox's “send as” feature with Resend SMTP: host `smtp.resend.com`, username `resend`, the scoped Resend API key as password, and TLS on port 465 or STARTTLS on 587. Test reply threading and From alignment.
9. Do not verify, publish senders for, or send from `news.talentconsulting.io`. It is reserved until a later marketing launch.

## 3. Environment configuration

Copy the email variables from `.env.example` into the pre-production secret store. Generate independent high-entropy values for `EMAIL_UNSUBSCRIBE_SECRET`, `ACCOUNT_ACTION_SECRET`, and `CRON_SECRET`. Never reuse the Resend API key as an application signing secret.

Keep `EMAIL_SYSTEM_V2_ENABLED=false` and `EMAIL_MARKETING_ENABLED=false` initially. Configure `EMAIL_OPS_DESTINATION` only in the secret store; it is the private address that receives internal alerts. `EMAIL_MAILING_ADDRESS` stays blank because marketing is not approved.

Social profile links are separately fail-closed. Keep `EMAIL_SOCIAL_LINKS_ENABLED=false` until the official X, Bluesky, and Reddit destinations are live, consistently branded, and reviewed. Configure only canonical HTTPS profile/community URLs in `EMAIL_SOCIAL_X_URL`, `EMAIL_SOCIAL_BLUESKY_URL`, and `EMAIL_SOCIAL_REDDIT_URL`; the renderer rejects non-platform hosts. When enabled, the social footer appears only on welcome, Taco/product, and approved marketing templates. Security, billing, dispute, support, deletion, incident, and internal emails remain distraction-free.

Configure the Resend webhook at:

`https://talentconsulting.io/api/webhooks/resend`

Subscribe to delivered, delayed, bounced, failed, suppressed, and complained events supported by the account. Store its signing secret as `RESEND_WEBHOOK_SECRET` and verify that a test event updates the matching delivery record.

Schedule the outbox dispatcher at least once per minute using the deployed platform's scheduler:

`POST https://talentconsulting.io/api/cron/email-outbox?limit=20`

Send `Authorization: Bearer <CRON_SECRET>`. The route may also be invoked with GET by schedulers that cannot POST. Alert on non-2xx responses, backlog above 100, or any `dead` result.

Deploy `firestore.indexes.json` so account/email-change request TTL policies are active.

## 4. Pre-production verification gate

Use a non-production Firebase project and a verified Resend test destination.

1. Install and statically verify:

   - `npm run type-check`
   - `npm run test:email-system`
   - `npm run test:auth`
   - `npm run email:export`
   - `npm run build`

   Then run the value-safe, read-only provider/DNS/deployment gate:

   - shadow: `npm run email:release-check`
   - cutover candidate: `node scripts/email-release-readiness.js --config-file=.env.production --mode=cutover --online`

   The gate prints only bounded status codes and operation counts. It performs two Resend inventory reads, three DNS reads, and two unauthenticated deployment probes; it performs zero provider writes and sends zero emails. A failure is a release stop, not a prompt to bypass sender validation.

2. Render at least one message per category and inspect desktop and narrow mobile widths. Check logo loading, image-disabled fallback, dark-mode legibility, Unicode, long company/job names, plain text, and action URL destinations.

   For an explicitly authorized owner inbox, the guarded catalog sampler provides a dry run first and requires a separate send flag:

   - dry render: `npm run email:samples -- --to=<approved-review-address>`
   - real samples: `npm run email:samples -- --to=<approved-review-address> --send --run-id=<unique_review_id>`
   - targeted review: append `--events=account.welcome,product.career_picks,product.weekly_recap`

   The operator uses synthetic payloads, mock-prefixed subjects, deterministic idempotency, one recipient, and central delivery. It sends all live non-marketing templates and reports the disabled marketing templates as skipped; it must never be used to bypass marketing consent, postal-address, sender-domain, or launch gates.

   Four sample-only first-impression welcome concepts are available for an owner review inbox:

   - dry render: `npm run email:welcome-concepts -- --to=<approved-review-address>`
   - real review copies: `npm run email:welcome-concepts -- --to=<approved-review-address> --send --run-id=<unique_review_id>`

   These concepts are deliberately not connected to signup or the event catalog. Promote a selected concept into `account.welcome` only after explicit approval, copy review, and a regression update.
3. Exercise password reset with valid, expired, invalid, and reused Firebase codes. Confirm the completion email goes to the Firebase-returned address and no endpoint accepts a recipient address for that confirmation.
4. Exercise email change and recovery. Confirm the new address receives the branded verification, the prior address receives recovery after the change, and replaying either state fails.
5. Exercise account deactivate and delete-request links. Confirm expiration and single use. Deletion confirmation must record an operations request; it must not silently purge data before the retention workflow is approved.
6. Generate duplicate Stripe webhook fixtures. Confirm deterministic message IDs prevent duplicate customer notices and that hosted invoice/receipt links remain Stripe-owned.
7. Exercise two concurrent dispatcher calls against the same message. Only one lease may send. Force provider failures through every retry step and confirm dead-letter and operations escalation behavior.
8. Deliver an optional product email, then apply bounce/complaint test receipts. Confirm preferences are paused and later optional messages skip at dispatch.
9. Inspect provider tags (`event`, `stream`, `category`, `template`, plus message/attempt identifiers) and verify no message stores rendered HTML, passwords, Firebase action codes, or raw security links in Firestore.

## 5. Transactional cutover

Cut over only when all pre-production checks pass and `talentconsulting.io` remains verified for sending.

1. Deploy the code and required secrets with `EMAIL_SYSTEM_V2_ENABLED=false`.
2. Run renderer/auth/outbox/Stripe smoke tests against the deployed preview.
3. Set `EMAIL_SYSTEM_V2_ENABLED=true` and redeploy. This is the approved full transactional cutover; missing sender variables now fail closed.
4. Trigger one low-risk welcome or support receipt and one internal test alert. Confirm From, Reply-To, authentication, tags, webhook receipt, and ops routing.
5. Trigger password reset and a Stripe test-mode event. Confirm security and billing senders independently.
6. Watch provider acceptance, bounce/complaint, dispatcher backlog, and dead-letter signals closely for the first business day.

Rollback: set `EMAIL_SYSTEM_V2_ENABLED=false` and redeploy. This returns typed templates to the legacy verified sender while preserving the outbox, idempotency, preferences, and receipts. Do not disable the dispatcher while queued messages exist unless incident response explicitly freezes email. Never turn on marketing as part of rollback or cutover.

## 6. Marketing launch gate

Marketing is intentionally unavailable. Rendering and enqueueing fail while disabled. A later launch requires separate written approval, a real `EMAIL_MAILING_ADDRESS`, a verified `news.talentconsulting.io` sending domain, documented consent/import provenance, unsubscribe testing, suppression reconciliation, volume warm-up, and setting `EMAIL_MARKETING_ENABLED=true`. Transactional consent must never be treated as marketing consent.

## 7. Operations playbooks

Delivery incident: inspect the outbox record by message ID, provider message ID, stream/event tags, and latest signed receipt. Never copy HTML or security links into tickets. Retry by repairing the root cause and allowing the scheduled lease to recover; do not create a new dedupe key to force a duplicate.

Complaint or hard bounce: keep the suppression record, verify optional preferences paused, and do not manually re-enable delivery without evidence that the address issue and consent are resolved.

Stripe reconciliation: use the internal reference ID to inspect the Stripe event and billing ledger. Customer messages contain only safe summaries; evidence and dispute artifacts stay in Stripe/internal systems.

Support request: respond from `support@talentconsulting.io`, retain the case/reference ID in the subject or thread, and never send from the private `EMAIL_OPS_DESTINATION` address.

Deletion request: operations must verify the lifecycle request, retention obligations, Stripe/financial records, Firebase Auth state, Firestore subcollections, Storage objects, and downstream processors before deletion. Send `account.deleted` only after completion, never at request confirmation.
