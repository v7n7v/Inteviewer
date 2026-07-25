const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

test('contact submissions queue a customer receipt and an internal triage alert', () => {
  const route = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'contact', 'route.ts'), 'utf8');
  assert.match(route, /support\.feedback_received/);
  assert.match(route, /internal\.support_request_received/);
  assert.match(route, /kind: 'contact'/);
  assert.match(route, /kind: 'operations'/);
  assert.doesNotMatch(route, /new Resend|emails\.send/);
  assert.doesNotMatch(route, /alula\.gebre@gmail\.com/);
});
