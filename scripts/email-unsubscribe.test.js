const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-email-unsubscribe-'));
const outfile = path.join(outdir, 'unsubscribe.cjs');
buildSync({ entryPoints: [path.join(repoRoot, 'lib', 'email', 'unsubscribe.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
const unsubscribe = require(outfile);

function withSecret(callback) {
  const original = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';
  try { return callback(); }
  finally {
    if (original === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    else process.env.EMAIL_UNSUBSCRIBE_SECRET = original;
  }
}

test('category unsubscribe tokens are signed, scoped, and expiring', () => withSecret(() => {
  const token = unsubscribe.createEmailUnsubscribeToken('firebase_user-123', 'studyReminders', Date.now() + 60_000);
  const claims = unsubscribe.verifyEmailUnsubscribeToken(token);
  assert.equal(claims.uid, 'firebase_user-123');
  assert.equal(claims.preference, 'studyReminders');
  const [payload, signature] = token.split('.');
  assert.equal(unsubscribe.verifyEmailUnsubscribeToken(`${payload}.${signature.slice(0, -1)}x`), null);
  assert.equal(unsubscribe.verifyEmailUnsubscribeToken(token, Date.now() + 120_000), null);
}));

test('unsubscribe signing fails closed without a dedicated strong secret', () => {
  const original = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  try {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    assert.throws(() => unsubscribe.createEmailUnsubscribeToken('user-123', 'weeklyRecap'), /EMAIL_UNSUBSCRIBE_SECRET/);
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'replace_me_with_a_real_secret_123456789';
    assert.throws(() => unsubscribe.createEmailUnsubscribeToken('user-123', 'weeklyRecap'), /EMAIL_UNSUBSCRIBE_SECRET/);
  } finally {
    if (original === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    else process.env.EMAIL_UNSUBSCRIBE_SECRET = original;
  }
});

test('unsubscribe route derives identity and category only from verified claims', () => {
  const route = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'email', 'unsubscribe', 'route.ts'), 'utf8');
  const page = fs.readFileSync(path.join(repoRoot, 'app', 'email', 'unsubscribe', 'page.tsx'), 'utf8');
  assert.match(route, /verifyEmailUnsubscribeToken/);
  assert.match(route, /claims\.uid/);
  assert.match(route, /claims\.preference/);
  assert.doesNotMatch(route, /body\.(?:uid|preference)/);
  assert.match(route, /jobAlertsEnabled: false/);
  assert.match(page, /Required account, security, billing, and service messages are not affected/);
});
