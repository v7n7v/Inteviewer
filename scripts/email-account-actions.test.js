const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('password reset completion derives the confirmation recipient from Firebase', () => {
  const route = read('app', 'api', 'auth', 'password-reset', 'complete', 'route.ts');
  assert.match(route, /accounts:resetPassword/);
  assert.match(route, /provider\.email/);
  assert.match(route, /provider\.requestType !== 'PASSWORD_RESET'/);
  assert.match(route, /getUserByEmail\(email\)/);
  assert.match(route, /'security\.password_changed'/);
  assert.doesNotMatch(route, /body\.email/);
  assert.doesNotMatch(route, /console\.[a-z]+\([^\n]*(?:newPassword|oobCode)/);
});

test('email change and recovery use branded Admin links and server-verified state', () => {
  const request = read('app', 'api', 'auth', 'email-change', 'route.ts');
  const complete = read('app', 'api', 'auth', 'email-change', 'complete', 'route.ts');
  const state = read('lib', 'email-change-state.ts');
  const client = read('lib', 'firebase.ts');
  assert.match(request, /generateVerifyAndChangeEmailLink/);
  assert.match(request, /security\.email_change_requested/);
  assert.match(complete, /security\.email_changed/);
  assert.match(complete, /security\.email_recovery_requested/);
  assert.match(state, /getAdminAuth\(\)\.getUser/);
  assert.match(state, /hashEmail\(user\.email\).*targetEmailHash/);
  assert.match(state, /currentEmail:\s*null/);
  assert.match(state, /targetEmail:\s*null/);
  assert.doesNotMatch(client, /verifyBeforeUpdateEmail/);
  assert.match(client, /\/api\/auth\/email-change/);
});

test('account lifecycle links are signed, expiring, single use, and non-destructive at confirmation', () => {
  const tokens = read('lib', 'account-action-tokens.ts');
  const request = read('app', 'api', 'account', 'lifecycle', 'route.ts');
  const confirm = read('app', 'api', 'account', 'lifecycle', 'confirm', 'route.ts');
  assert.match(tokens, /createHmac/);
  assert.match(tokens, /timingSafeEqual/);
  assert.match(tokens, /TOKEN_TTL_MS = 30 \* 60 \* 1000/);
  assert.match(tokens, /data\.status !== 'pending'/);
  assert.match(tokens, /status: 'confirmed'/);
  assert.match(request, /account\.deactivation_requested/);
  assert.match(request, /account\.deletion_requested/);
  assert.match(confirm, /deletion_confirmed/);
  assert.match(confirm, /internal\.support_request_received/);
  assert.doesNotMatch(confirm, /deleteUser\(|recursiveDelete\(/);
});

test('only the central delivery module invokes Resend send', () => {
  const roots = ['app', 'lib'];
  const sendCallFiles = [];
  for (const root of roots) walk(path.join(repoRoot, root), sendCallFiles);
  assert.deepEqual(sendCallFiles.map(file => path.relative(repoRoot, file).replaceAll('\\', '/')), ['lib/email.ts']);
  const central = read('lib', 'email.ts');
  assert.equal((central.match(/\.emails\.send\(/g) || []).length, 1);
  assert.doesNotMatch(central, /sendCustomEmail|bodyHtml|buildCustomEmail/);
});

function walk(directory, matches) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, matches);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && /\.emails\.send\(/.test(fs.readFileSync(target, 'utf8'))) matches.push(target);
  }
}
