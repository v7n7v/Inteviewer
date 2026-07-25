const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('user tier reads server-authoritative billing data without a Firestore watch', () => {
  const hook = read('hooks/use-user-tier.ts');

  assert.match(hook, /authFetch\('\/api\/usage'\)/);
  assert.doesNotMatch(hook, /firebase\/firestore|onSnapshot|users.*subscription.*current/);
  assert.match(hook, /addEventListener\('focus', refreshUsage\)/);
  assert.match(hook, /addEventListener\('visibilitychange', refreshWhenVisible\)/);
  assert.match(hook, /addEventListener\('talent:subscription-updated', refreshUsage\)/);
});

test('Firestore rules keep subscription records server-only', () => {
  const rules = read('firestore.rules');

  assert.match(
    rules,
    /match \/users\/\{userId\}\/subscription\/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/
  );
});

test('Firebase includes the ca9 pending-response race fix', () => {
  const packageJson = JSON.parse(read('package.json'));
  const version = packageJson.dependencies.firebase.match(/\d+\.\d+\.\d+/)?.[0];

  assert.ok(version, 'Firebase dependency must contain a semver version');
  const [major, minor] = version.split('.').map(Number);
  assert.ok(
    major > 12 || (major === 12 && minor >= 13),
    `Firebase ${version} predates the ca9 race fix in 12.13.0`
  );
});
