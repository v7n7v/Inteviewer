const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sampler = require('./send-email-template-samples');

const repoRoot = path.resolve(__dirname, '..');

test('sample plan covers every live template and preserves the marketing gate', () => {
  const events = sampler.readEmailEventKeys(repoRoot);
  const plan = sampler.buildSamplePlan(events);
  assert.equal(events.length, 74);
  assert.equal(plan.permitted.length, 72);
  assert.deepEqual(plan.skippedMarketing, [
    'marketing.product_announcement',
    'marketing.educational_newsletter',
  ]);
  assert.equal(plan.permitted.some(event => event.startsWith('marketing.')), false);
});

test('sample subjects are unmistakably mock content and remain bounded', () => {
  const subject = sampler.mockSubject(1, 72, 'security.password_reset_requested', 'Reset your password');
  assert.match(subject, /^\[MOCK TEMPLATE 1\/72 \| security\.password_reset_requested\]/);
  assert.ok(subject.length <= 200);
});

test('idempotency is stable per run, event, and recipient but isolated across recipients', () => {
  const first = sampler.previewIdempotencyKey('one@example.com', 'account.welcome', 'preview_run_1');
  assert.equal(first, sampler.previewIdempotencyKey('ONE@example.com', 'account.welcome', 'preview_run_1'));
  assert.notEqual(first, sampler.previewIdempotencyKey('two@example.com', 'account.welcome', 'preview_run_1'));
  assert.notEqual(first, sampler.previewIdempotencyKey('one@example.com', 'billing.payment_failed', 'preview_run_1'));
});

test('CLI is dry-run by default and accepts exactly one bounded recipient', () => {
  const dry = sampler.parseArgs(['--to=reviewer@example.com']);
  assert.equal(dry.send, false);
  assert.equal(dry.delayMs, 850);
  assert.equal(dry.events, null);
  const targeted = sampler.parseArgs([
    '--to=reviewer@example.com',
    '--events=account.welcome,product.career_picks,product.weekly_recap',
  ]);
  assert.deepEqual(targeted.events, ['account.welcome', 'product.career_picks', 'product.weekly_recap']);
  assert.throws(() => sampler.parseArgs(['--to=one@example.com,two@example.com']), /single_valid_email_required/);
  assert.throws(() => sampler.parseArgs(['--to=reviewer@example.com', '--delay-ms=100']), /delay_ms/);
});

test('targeted sample selection preserves order, removes duplicates, and rejects unknown events', () => {
  const available = sampler.readEmailEventKeys(repoRoot);
  assert.deepEqual(
    sampler.selectEvents(available, ['account.welcome', 'product.career_picks', 'account.welcome']),
    ['account.welcome', 'product.career_picks'],
  );
  assert.throws(() => sampler.selectEvents(available, ['product.not_real']), /events:unknown/);
});

test('operator source uses central delivery and never enables marketing', () => {
  const source = fs.readFileSync(path.join(__dirname, 'send-email-template-samples.js'), 'utf8');
  assert.match(source, /sendRenderedEmailResult/);
  assert.match(source, /EMAIL_MARKETING_ENABLED: 'false'/);
  assert.doesNotMatch(source, /emails\.send|batch\.send|EMAIL_MARKETING_ENABLED:\s*'true'/);
});
