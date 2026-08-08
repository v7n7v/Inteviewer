const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');

/**
 * Executes the real module. Not a source-text scan.
 *
 * Ten of the twenty-four tests in test:admin-command-grid assert that a regex matches a
 * file, including one that checks an English comment sentence is present. Those pass
 * whether or not the code works. This file bundles and runs the thing.
 */
function loadMetersRuntime() {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'tc-meters-test-'));
  const outfile = path.join(directory, 'meters.cjs');
  buildSync({
    entryPoints: [path.join(repoRoot, 'lib', 'admin', 'user-usage-meters.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    // The '@/lib/...' specifier the source uses is a tsconfig path, not a node one.
    alias: { '@': repoRoot },
  });
  const runtime = require(outfile);
  fs.rmSync(path.resolve(directory), { recursive: true, force: true });
  return runtime;
}

const { usageMeters, planOf } = loadMetersRuntime();
const meterFor = (meters, key) => meters.find(meter => meter.key === key);

test('planOf accepts only the two paid tiers and defaults everything else to free', () => {
  assert.equal(planOf({ plan: 'pro' }), 'pro');
  assert.equal(planOf({ plan: 'studio' }), 'studio');
  assert.equal(planOf({ plan: 'free' }), 'free');
  assert.equal(planOf({}), 'free');
  // 'god' is an entitlement override resolved elsewhere; it is not a subscription plan.
  assert.equal(planOf({ plan: 'god' }), 'free');
  assert.equal(planOf({ plan: 'enterprise' }), 'free');
});

test('a free user gets a real numeric cap on every lifetime counter', () => {
  const meters = usageMeters({ resumeParses: 4 }, undefined, undefined, undefined, 'free');
  const parses = meterFor(meters, 'resumeParses');
  assert.equal(parses.used, 4);
  assert.equal(parses.cap, 10, 'FREE_CAPS.resumeParses is 10, not 3 - the upload path is deliberately wider');
  assert.equal(parses.unit, 'count');
});

test('an unmetered counter reports cap null, never zero', () => {
  // This is the whole reason the module exists. A paid tier has no lifetime cap, and
  // rendering that as `cap: 0` would read to an operator as "limit reached" on a user
  // who in fact has no limit at all.
  for (const plan of ['pro', 'studio']) {
    const meters = usageMeters({ morphs: 900 }, undefined, undefined, undefined, plan);
    const morphs = meterFor(meters, 'morphs');
    assert.equal(morphs.cap, null, `${plan} must be unmetered on lifetime counters`);
    assert.notEqual(morphs.cap, 0, `${plan} cap must not collapse to a measured zero`);
    assert.equal(morphs.used, 900);
  }
});

test('a counter absent from Firestore is a measured zero, because absence means never incremented', () => {
  const meters = usageMeters(undefined, undefined, undefined, undefined, 'free');
  for (const meter of meters) {
    assert.equal(meter.used, 0, `${meter.key} should report zero use`);
    assert.equal(typeof meter.used, 'number');
  }
});

test('non-numeric and hostile counter values do not leak into the response', () => {
  const meters = usageMeters(
    { morphs: 'lots', gauntlets: null, flashcards: NaN, coverLetters: Infinity, resumeChecks: -0 },
    undefined,
    undefined,
    undefined,
    'free',
  );
  for (const key of ['morphs', 'gauntlets', 'flashcards', 'coverLetters']) {
    assert.equal(meterFor(meters, key).used, 0, `${key} must coerce to 0`);
  }
  assert.ok(meters.every(meter => Number.isFinite(meter.used)), 'no meter may report a non-finite value');
});

test('voice is reported in whole minutes, converted from stored seconds', () => {
  const meters = usageMeters(undefined, { usedSeconds: 754 }, undefined, undefined, 'pro');
  const voice = meterFor(meters, 'voiceMonthly');
  assert.equal(voice.used, 13, '754s rounds to 13 minutes');
  assert.equal(voice.cap, 15, 'VOICE_MINUTE_CAPS.pro');
  assert.equal(voice.unit, 'minutes');
});

test('a free user has no voice allowance at all, and that is a cap of zero rather than null', () => {
  const voice = meterFor(usageMeters(undefined, undefined, undefined, undefined, 'free'), 'voiceMonthly');
  assert.equal(voice.cap, 0, 'zero here is a real measured limit, not an absent one');
  assert.notEqual(voice.cap, null);
});

test('writing words are reported raw against the per-plan monthly cap', () => {
  assert.equal(meterFor(usageMeters(undefined, undefined, { usedWords: 480 }, undefined, 'free'), 'writingMonthly').cap, 500);
  assert.equal(meterFor(usageMeters(undefined, undefined, {}, undefined, 'pro'), 'writingMonthly').cap, 4000);
  assert.equal(meterFor(usageMeters(undefined, undefined, {}, undefined, 'studio'), 'writingMonthly').cap, 50000);
});

test('the Taco session cap is lifetime on free and unmetered above it', () => {
  assert.equal(meterFor(usageMeters(undefined, undefined, undefined, { lifetimeCount: 2 }, 'free'), 'agentLifetime').cap, 2);
  // pro is a weekly allowance, not a lifetime one - reporting the weekly number as a
  // lifetime cap would be a wrong figure, so it is reported uncapped instead.
  assert.equal(meterFor(usageMeters(undefined, undefined, undefined, {}, 'pro'), 'agentLifetime').cap, null);
  assert.equal(meterFor(usageMeters(undefined, undefined, undefined, {}, 'studio'), 'agentLifetime').cap, null);
});

test('every meter is well formed, whatever the plan', () => {
  for (const plan of ['free', 'pro', 'studio']) {
    const meters = usageMeters({}, {}, {}, {}, plan);
    assert.ok(meters.length >= 9, `${plan} should report at least nine meters`);
    assert.equal(new Set(meters.map(meter => meter.key)).size, meters.length, 'meter keys must be unique');
    for (const meter of meters) {
      assert.ok(meter.label && typeof meter.label === 'string', `${meter.key} needs a human label`);
      assert.ok(['count', 'minutes', 'words'].includes(meter.unit), `${meter.key} unit`);
      assert.ok(meter.cap === null || Number.isInteger(meter.cap), `${meter.key} cap must be null or an integer`);
    }
  }
});

test('no meter carries resume text, application contents or any other free-form user data', () => {
  // The detail panel reads profile/main, which holds base_resume_text. Counts and meters
  // are the only things allowed out of this module.
  const meters = usageMeters({ morphs: 1 }, { usedSeconds: 60 }, { usedWords: 10 }, { lifetimeCount: 1 }, 'free');
  const allowed = new Set(['key', 'label', 'used', 'cap', 'unit']);
  for (const meter of meters) {
    for (const field of Object.keys(meter)) {
      assert.ok(allowed.has(field), `${meter.key} exposes an unexpected field: ${field}`);
    }
  }
});
