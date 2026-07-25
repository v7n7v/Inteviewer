const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

test('Stripe customer communications use the durable typed outbox', () => {
  const webhook = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'stripe', 'webhook', 'route.ts'), 'utf8');
  assert.match(webhook, /enqueueEmail/);
  assert.match(webhook, /await queueBillingEmailAndLog/);
  assert.doesNotMatch(webhook, /void \(async \(\) =>/);
  assert.doesNotMatch(webhook, /sendCustomEmailResult|sendSubscriptionEmailResult|sendCancellationEmailResult|sendTrialEndingEmailResult/);
  for (const event of [
    'billing.subscription_activated',
    'billing.renewal_upcoming',
    'billing.renewal_succeeded',
    'billing.payment_failed',
    'billing.payment_action_required',
    'billing.plan_changed',
    'billing.interval_changed',
    'billing.cancellation_scheduled',
    'billing.cancellation_reversed',
    'billing.subscription_ended',
    'billing.refund_succeeded',
    'billing.refund_failed',
    'billing.dispute_received',
    'billing.dispute_won',
    'billing.dispute_lost',
  ]) {
    assert.match(webhook, new RegExp(event.replace('.', '\\.')), event);
  }
});

test('Stripe authoritative documents are linked and duplicate initial invoice companions are avoided', () => {
  const webhook = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'stripe', 'webhook', 'route.ts'), 'utf8');
  assert.match(webhook, /invoice\.billing_reason === 'subscription_cycle'/);
  assert.match(webhook, /invoice\.hosted_invoice_url/);
  assert.match(webhook, /logicalDedupeKey/);
  assert.match(webhook, /`refund:\$\{refund\.id\}:\$\{refund\.status/);
  assert.match(webhook, /`dispute:\$\{dispute\.id\}:\$\{dispute\.status\}`/);
});

test('handled Stripe events include upcoming renewal and payment authentication', () => {
  const events = fs.readFileSync(path.join(repoRoot, 'lib', 'billing', 'stripe-webhook-events.ts'), 'utf8');
  assert.match(events, /invoice\.upcoming/);
  assert.match(events, /invoice\.payment_action_required/);
});
