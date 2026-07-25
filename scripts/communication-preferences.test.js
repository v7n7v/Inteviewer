const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-communication-preferences-'));
const outfile = path.join(outdir, 'communication-preferences.cjs');
buildSync({
  entryPoints: [path.join(repoRoot, 'lib', 'communication-preferences.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const preferences = require(outfile);

test('optional email categories default off while explicit Career Picks consent is preserved', () => {
  const defaults = preferences.normalizeCommunicationPreferences(undefined, false);
  assert.equal(defaults.jobDigest, false);
  for (const key of ['studyReminders', 'applicationUpdates', 'interviewReminders', 'offerUpdates', 'weeklyRecap', 'marketing']) {
    assert.equal(defaults[key], false, key);
  }

  const optedIn = preferences.normalizeCommunicationPreferences({ studyReminders: true }, true);
  assert.equal(optedIn.jobDigest, true);
  assert.equal(optedIn.studyReminders, true);
});

test('marketing preferences remain disabled until the launch feature flag is explicit', () => {
  const original = process.env.EMAIL_MARKETING_ENABLED;
  try {
    delete process.env.EMAIL_MARKETING_ENABLED;
    assert.equal(preferences.normalizeCommunicationPreferences({ marketing: true }).marketing, false);
    process.env.EMAIL_MARKETING_ENABLED = 'true';
    assert.equal(preferences.normalizeCommunicationPreferences({ marketing: true }).marketing, true);
  } finally {
    if (original === undefined) delete process.env.EMAIL_MARKETING_ENABLED;
    else process.env.EMAIL_MARKETING_ENABLED = original;
  }
});

test('preference patches are partial, bounded, and reject unknown or empty updates', () => {
  assert.deepEqual(preferences.communicationPreferencePatchSchema.parse({ studyReminders: true }), { studyReminders: true });
  assert.equal(preferences.communicationPreferencePatchSchema.safeParse({}).success, false);
  assert.equal(preferences.communicationPreferencePatchSchema.safeParse({ arbitrary: true }).success, false);
  assert.equal(preferences.communicationPreferencePatchSchema.safeParse({ offerUpdates: 'yes' }).success, false);
});

test('settings UI persists every email toggle and keeps legacy optional defaults off', () => {
  const settings = fs.readFileSync(path.join(repoRoot, 'app', 'suite', 'settings', 'page.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(repoRoot, 'app', 'api', 'communication-preferences', 'route.ts'), 'utf8');
  assert.match(settings, /authFetch\('\/api\/communication-preferences'/);
  assert.match(settings, /emailApplications: false/);
  assert.match(settings, /emailInterviews: false/);
  assert.match(settings, /emailOffers: false/);
  for (const key of ['studyReminders', 'applicationUpdates', 'interviewReminders', 'offerUpdates', 'marketing']) {
    assert.match(settings, new RegExp(key));
  }
  assert.match(route, /MARKETING_EMAIL_DISABLED/);
  assert.match(route, /runTransaction/);
  assert.doesNotMatch(route, /body\.(?:uid|userId)/);
});
