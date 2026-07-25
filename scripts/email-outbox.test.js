const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-email-outbox-'));
const outfile = path.join(outdir, 'email-outbox.cjs');
buildSync({
  entryPoints: [path.join(repoRoot, 'lib', 'email', 'outbox.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const outbox = require(outfile);
const receiptsOutfile = path.join(outdir, 'email-receipts.cjs');
buildSync({
  entryPoints: [path.join(repoRoot, 'lib', 'email', 'receipts.ts')],
  outfile: receiptsOutfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const receipts = require(receiptsOutfile);

test('message identity is deterministic for a logical event and recipient', () => {
  const input = {
    event: 'billing.subscription_activated',
    recipient: { kind: 'user', uid: 'user-123' },
    dedupeKey: 'stripe-event-123',
  };
  const first = outbox.createEmailMessageId(input);
  assert.equal(first, outbox.createEmailMessageId(input));
  assert.notEqual(first, outbox.createEmailMessageId({ ...input, dedupeKey: 'stripe-event-124' }));
  assert.notEqual(first, outbox.createEmailMessageId({ ...input, recipient: { kind: 'user', uid: 'user-456' } }));
  assert.match(first, /^em_[a-f0-9]{40}$/);
});

test('outbox payload validation is schema-backed and refuses security action material', () => {
  assert.throws(
    () => outbox.assertSafeOutboxPayload('security.password_reset_requested', {
      actionUrl: 'https://talentconsulting.io/auth/reset-password?oobCode=secret',
    }),
    /without persisting its payload/,
  );
  assert.throws(
    () => outbox.assertSafeOutboxPayload('account.deletion_requested', {
      actionUrl: 'https://talentconsulting.io/account/delete?signature=secret',
    }),
    /without persisting its payload/,
  );
  assert.throws(
    () => outbox.assertSafeOutboxPayload('billing.subscription_activated', {
      planName: 'pro', interval: 'year', passwordToken: 'secret',
    }),
  );
  const parsed = outbox.assertSafeOutboxPayload('billing.subscription_activated', {
    planName: 'pro',
    interval: 'year',
    price: '$159/year',
  });
  assert.equal(parsed.billingUrl, 'https://talentconsulting.io/suite/settings?tab=billing');
});

test('retry schedule is bounded and becomes dead-letter eligible', () => {
  const now = Date.parse('2026-07-19T12:00:00.000Z');
  assert.equal(outbox.nextEmailRetryAt(1, now), '2026-07-19T12:01:00.000Z');
  assert.equal(outbox.nextEmailRetryAt(2, now), '2026-07-19T12:05:00.000Z');
  assert.equal(outbox.nextEmailRetryAt(7, now), '2026-07-20T12:00:00.000Z');
  assert.equal(outbox.nextEmailRetryAt(8, now), null);
});

test('outbox implementation leases transactionally, recovers expired work, and uses provider idempotency', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'lib', 'email', 'outbox.ts'), 'utf8');
  const cron = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'cron', 'email-outbox', 'route.ts'), 'utf8');
  assert.match(source, /transaction\.create\(docRef, document\)/);
  assert.match(source, /status: 'leased'/);
  assert.match(source, /recoverExpiredEmailLeases/);
  assert.match(source, /inspectEmailOutboxBacklog/);
  assert.match(source, /internal\.email_delivery_failed/);
  assert.match(source, /internal\.email_queue_backlog/);
  assert.match(source, /idempotencyKey: `tc-\$\{message\.messageId\}`/);
  assert.match(source, /getOptionalEmailPermission/);
  assert.match(source, /email_suppressions/);
  assert.match(source, /completeLease\(message\.messageId, leaseOwner, 'dead'/);
  assert.match(cron, /timingSafeEqual/);
  assert.match(cron, /CRON_SECRET/);
});

test('generic Resend receipts require the outbox message tag and normalize terminal events', () => {
  const event = {
    type: 'email.complained',
    created_at: '2026-07-19T13:00:00.000Z',
    data: {
      email_id: 'provider-123',
      to: ['Person@Example.com'],
      tags: { message: 'em_0123456789abcdef0123456789abcdef01234567' },
    },
  };
  const receipt = receipts.normalizeResendEmailReceipt(event);
  assert.equal(receipt.messageId, 'em_0123456789abcdef0123456789abcdef01234567');
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.pauseOptionalEmail, true);
  assert.deepEqual(receipt.recipients, ['person@example.com']);
  assert.equal(receipts.normalizeResendEmailReceipt({ ...event, data: { ...event.data, tags: {} } }), null);
});

test('generic receipt ordering is monotonic and webhook routing preserves legacy receipts', () => {
  assert.equal(receipts.shouldApplyReceipt(null, '2026-07-19T13:00:00Z', 'accepted', 'delivered'), true);
  assert.equal(receipts.shouldApplyReceipt('2026-07-19T13:01:00Z', '2026-07-19T13:00:00Z', 'delivered', 'failed'), false);
  assert.equal(receipts.shouldApplyReceipt('2026-07-19T13:00:00Z', '2026-07-19T13:00:00Z', 'delivered', 'failed'), true);
  const webhook = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'webhooks', 'resend', 'route.ts'), 'utf8');
  assert.match(webhook, /normalizeResendEmailReceipt/);
  assert.match(webhook, /applyEmailDeliveryReceipt/);
  assert.match(webhook, /normalizeResendJobEmailReceipt/);
});
