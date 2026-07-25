const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sender = require('./send-welcome-email-concepts');

test('welcome concept review is dry-run by default and single-recipient only', () => {
  const options = sender.parseArgs(['--to=reviewer@example.com']);
  assert.equal(options.send, false);
  assert.throws(() => sender.parseArgs(['--to=one@example.com,two@example.com']), /single_valid_email_required/);
});

test('welcome concept labels are unmistakable and idempotent per recipient', () => {
  const subject = sender.conceptSubject(1, 4, 'Career command center', 'Your career command center is ready');
  assert.match(subject, /^\[WELCOME CONCEPT 1\/4 \| CAREER COMMAND CENTER\]/);
  assert.ok(subject.length <= 200);
  const first = sender.conceptIdempotencyKey('reviewer@example.com', 'command_center', 'welcome_run_1');
  assert.equal(first, sender.conceptIdempotencyKey('REVIEWER@example.com', 'command_center', 'welcome_run_1'));
  assert.notEqual(first, sender.conceptIdempotencyKey('reviewer@example.com', 'meet_taco', 'welcome_run_1'));
});

test('concept source contains four distinct value propositions and no production trigger', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'emails', 'concepts', 'WelcomeConcepts.tsx'), 'utf8');
  assert.match(source, /command_center/);
  assert.match(source, /first_win/);
  assert.match(source, /meet_taco/);
  assert.match(source, /your_story/);
  assert.equal((source.match(/id: '/g) || []).length, 4);
  assert.doesNotMatch(source, /enqueueEmail|emails\.send/);
});

test('sender uses central delivery and has no marketing path', () => {
  const source = fs.readFileSync(path.join(__dirname, 'send-welcome-email-concepts.js'), 'utf8');
  assert.match(source, /sendRenderedEmailResult/);
  assert.doesNotMatch(source, /emails\.send|batch\.send|marketing/);
});
