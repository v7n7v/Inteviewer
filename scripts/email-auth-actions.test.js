const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-auth-action-links-'));
const outfile = path.join(outdir, 'auth-action-links.cjs');
buildSync({
  entryPoints: [path.join(repoRoot, 'lib', 'auth-action-links.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const links = require(outfile);

test('auth email normalization is bounded and stable for rate-limit keys', () => {
  assert.equal(links.normalizeAuthEmail(' Person@Example.COM '), 'person@example.com');
  assert.equal(links.normalizeAuthEmail('not-an-email'), null);
  assert.equal(links.hashAuthIdentifier(' Person@Example.COM '), links.hashAuthIdentifier('person@example.com'));
  assert.equal(links.hashAuthIdentifier('person@example.com').length, 64);
});

test('Firebase action links are converted to the first-party handler without forwarding arbitrary input', () => {
  const generated = 'https://talent-consulting-acf16.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=secret-code&apiKey=public-key&continueUrl=https%3A%2F%2Fevil.example&tenantId=unexpected';
  const custom = new URL(links.buildCustomAuthActionUrl(generated, 'https://talentconsulting.io', 'resetPassword'));
  assert.equal(custom.origin, 'https://talentconsulting.io');
  assert.equal(custom.pathname, '/auth/reset-password');
  assert.equal(custom.searchParams.get('mode'), 'resetPassword');
  assert.equal(custom.searchParams.get('oobCode'), 'secret-code');
  assert.equal(custom.searchParams.get('apiKey'), 'public-key');
  assert.equal(custom.searchParams.has('continueUrl'), false);
  assert.equal(custom.searchParams.has('tenantId'), false);
});

test('action-link conversion rejects missing codes and conflicting modes', () => {
  assert.throws(
    () => links.buildCustomAuthActionUrl('https://example.test/?mode=verifyEmail&oobCode=code', 'https://talentconsulting.io', 'resetPassword'),
    /invalid auth action link/,
  );
  assert.throws(
    () => links.buildCustomAuthActionUrl('https://example.test/?mode=resetPassword', 'https://talentconsulting.io', 'resetPassword'),
    /invalid auth action link/,
  );
});

test('production action origins require HTTPS and ignore request-host input', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalConfigured = process.env.EMAIL_AUTH_ACTION_ORIGIN;
  const originalPublic = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_AUTH_ACTION_ORIGIN;
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(links.resolveAuthActionOrigin('https://attacker.example'), 'https://talentconsulting.io');
    process.env.EMAIL_AUTH_ACTION_ORIGIN = 'http://talentconsulting.io';
    assert.throws(() => links.resolveAuthActionOrigin(), /must use HTTPS/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
    if (originalConfigured === undefined) delete process.env.EMAIL_AUTH_ACTION_ORIGIN; else process.env.EMAIL_AUTH_ACTION_ORIGIN = originalConfigured;
    if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = originalPublic;
  }
});

test('password reset request and action UI retain enumeration and security boundaries', () => {
  const route = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'auth', 'password-reset', 'route.ts'), 'utf8');
  const page = fs.readFileSync(path.join(repoRoot, 'app', 'auth', 'reset-password', 'page.tsx'), 'utf8');
  const firebase = fs.readFileSync(path.join(repoRoot, 'lib', 'firebase.ts'), 'utf8');

  assert.match(route, /after\(async \(\) =>/);
  assert.match(route, /hashAuthIdentifier\(email\)/);
  assert.match(route, /auth\/user-not-found/);
  assert.match(route, /GENERIC_RESPONSE/);
  assert.match(route, /status: 202/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)\([^\n]*,\s*(?:email|user\.email)\b/);
  assert.match(page, /'resetPassword' \| 'verifyEmail' \| 'recoverEmail'/);
  assert.match(page, /validateNewPassword/);
  assert.match(page, /confirmPasswordReset/);
  assert.match(page, /applyEmailActionCode/);
  assert.doesNotMatch(firebase, /sendPasswordResetEmail/);
  assert.match(firebase, /\/api\/auth\/password-reset/);
});
