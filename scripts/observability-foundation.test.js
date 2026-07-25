const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { build } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const temporaryDirectories = [];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

async function loadTypescript(relativePath) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-observability-test-'));
  temporaryDirectories.push(directory);
  const outfile = path.join(directory, 'module.cjs');
  await build({
    entryPoints: [path.join(repoRoot, relativePath)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [{
      name: 'observability-test-aliases',
      setup(builder) {
        builder.onResolve({ filter: /^server-only$/ }, () => ({
          path: 'server-only',
          namespace: 'empty',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({
          contents: 'export {};',
          loader: 'js',
        }));
        builder.onResolve({ filter: /^@\// }, args => {
          const target = path.join(repoRoot, args.path.slice(2));
          const resolved = [target, `${target}.ts`, `${target}.tsx`]
            .find(candidate => fs.existsSync(candidate));
          return { path: resolved || target };
        });
      },
    }],
  });
  return require(outfile);
}

test.after(() => {
  for (const directory of temporaryDirectories) {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`));
    assert.ok(path.basename(resolved).startsWith('tc-observability-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

let contracts;
let subjects;
let cursors;
let aggregates;
let permissions;
let recorder;
let consents;
let config;

test.before(async () => {
  [
    contracts,
    subjects,
    cursors,
    aggregates,
    permissions,
    recorder,
    consents,
    config,
  ] = await Promise.all([
    loadTypescript('lib/observability/contracts.ts'),
    loadTypescript('lib/observability/subject.ts'),
    loadTypescript('lib/observability/cursor.ts'),
    loadTypescript('lib/observability/aggregate.ts'),
    loadTypescript('lib/admin-permissions.ts'),
    loadTypescript('lib/observability/recorder.ts'),
    loadTypescript('lib/observability/consent.ts'),
    loadTypescript('lib/observability/config.ts'),
  ]);
});

function validToolEvent(overrides = {}) {
  return {
    schemaVersion: 1,
    purpose: 'product_analytics',
    producer: 'product_tool',
    eventName: 'tool_completed',
    operationId: 'operation_123456',
    category: 'tool_usage',
    tool: 'resume_check',
    action: 'complete',
    outcome: 'success',
    plan: 'free',
    latencyBand: '250ms_1s',
    sizeBand: 'small',
    quotaBand: 'available',
    ...overrides,
  };
}

test('strict event schemas accept only bounded taxonomy and reject content, PII, secrets, and unknowns', () => {
  assert.equal(contracts.validateObservabilityEvent(validToolEvent()).ok, true);
  assert.equal(contracts.validateObservabilityEvent({
    ...validToolEvent(),
    prompt: 'Improve my private resume',
  }).code, 'forbidden_data');
  assert.equal(contracts.validateObservabilityEvent({
    ...validToolEvent(),
    email: 'person@example.com',
  }).code, 'forbidden_data');
  assert.equal(contracts.validateObservabilityEvent({
    ...validToolEvent(),
    clientTimestamp: new Date().toISOString(),
  }).code, 'forbidden_data');
  assert.equal(contracts.validateObservabilityEvent({
    ...validToolEvent(),
    extra: 'unknown',
  }).code, 'schema_invalid');
  assert.equal(contracts.validateObservabilityEvent(validToolEvent({
    tool: 'unregistered_tool',
  })).code, 'schema_invalid');
  assert.equal(contracts.validateObservabilityEvent(validToolEvent({
    operationId: 'Bearer abcdefghijklmnopqrstuvwxyz',
  })).code, 'forbidden_data');
});

test('batch schema is strict and limited to twenty events', () => {
  assert.equal(contracts.validateObservabilityBatch({ events: [validToolEvent()] }).ok, true);
  assert.equal(contracts.validateObservabilityBatch({
    events: Array.from({ length: 21 }, (_, index) => validToolEvent({
      operationId: `operation_${String(index).padStart(6, '0')}`,
    })),
  }).ok, false);
  assert.equal(contracts.validateObservabilityBatch({
    uid: 'spoofed-user',
    events: [validToolEvent()],
  }).code, 'forbidden_data');
});

test('versioned HMAC subjects are stable, different by version, and contain no raw UID', () => {
  const uid = 'firebase-user-sensitive-id';
  const first = subjects.deriveObservabilitySubjectKey(uid, 'v1', 'a'.repeat(32));
  const repeat = subjects.deriveObservabilitySubjectKey(uid, 'v1', 'a'.repeat(32));
  const rotated = subjects.deriveObservabilitySubjectKey(uid, 'v2', 'b'.repeat(32));
  assert.deepEqual(first, repeat);
  assert.notEqual(first.subjectKey, rotated.subjectKey);
  assert.equal(first.subjectKey.includes(uid), false);

  const registry = subjects.parseObservabilityKeyRegistry({
    keysJson: JSON.stringify({ v1: 'a'.repeat(32), v2: 'b'.repeat(32) }),
    activeVersion: 'v2',
  });
  assert.equal(registry.activeVersion, 'v2');
  assert.throws(() => subjects.parseObservabilityKeyRegistry({
    keysJson: JSON.stringify({ v1: 'short' }),
    activeVersion: 'v1',
  }), /CONFIGURATION_INVALID/);
});

test('signed cursor binds context, expires, rejects tampering, and exposes no raw context', () => {
  const secret = 'cursor-secret-that-is-at-least-32-characters';
  const cursor = cursors.signObservabilityCursor({
    context: 'case-1:admin-sensitive-id',
    positions: [{
      keyVersion: 'v1',
      occurredAt: '2026-07-24T10:00:00.000Z',
      documentId: 'a'.repeat(64),
    }],
    expiresAt: new Date('2026-07-24T10:15:00.000Z'),
  }, secret);
  assert.equal(cursor.includes('admin-sensitive-id'), false);
  assert.equal(cursor.includes('a'.repeat(64)), false);
  assert.equal(cursor.split('.').length, 4);
  assert.equal(cursor.startsWith('v1.'), true);
  assert.equal(cursors.verifyObservabilityCursor(
    cursor,
    'case-1:admin-sensitive-id',
    new Date('2026-07-24T10:01:00.000Z'),
    secret,
  ).ok, true);
  assert.equal(cursors.verifyObservabilityCursor(
    cursor,
    'other-case',
    new Date('2026-07-24T10:01:00.000Z'),
    secret,
  ).ok, false);
  assert.equal(cursors.verifyObservabilityCursor(
    `${cursor.slice(0, -1)}x`,
    'case-1:admin-sensitive-id',
    new Date('2026-07-24T10:01:00.000Z'),
    secret,
  ).ok, false);
  assert.equal(cursors.verifyObservabilityCursor(
    cursor,
    'case-1:admin-sensitive-id',
    new Date('2026-07-24T10:16:00.000Z'),
    secret,
  ).ok, false);
});

test('aggregate privacy suppresses every cell below ten', () => {
  const result = aggregates.suppressObservabilityCounts({
    hidden: 9,
    visible: 10,
    larger: 42,
  });
  assert.deepEqual(result.values, { hidden: null, larger: 40, visible: null });
  assert.equal(result.suppressedCells, 2);
});

function createFakeFirestore() {
  const documents = new Map();
  class FakeRef {
    constructor(pathname) {
      this.path = pathname;
      this.id = pathname.split('/').at(-1);
    }
    collection(name) {
      return new FakeCollection(`${this.path}/${name}`);
    }
  }
  class FakeCollection {
    constructor(pathname) {
      this.path = pathname;
    }
    doc(id) {
      return new FakeRef(`${this.path}/${id}`);
    }
  }
  const snapshot = ref => ({
    exists: documents.has(ref.path),
    data: () => documents.get(ref.path),
    ref,
    id: ref.id,
  });
  const db = {
    collection(name) {
      return new FakeCollection(name);
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          return snapshot(ref);
        },
        create(ref, data) {
          if (documents.has(ref.path)) throw new Error('ALREADY_EXISTS');
          documents.set(ref.path, data);
        },
        set(ref, data, options) {
          const current = options?.merge ? documents.get(ref.path) || {} : {};
          documents.set(ref.path, { ...current, ...data });
        },
      });
    },
    documents,
  };
  return db;
}

function seedGrantedConsent(db, uid) {
  db.documents.set(`users/${uid}/settings/privacyControls`, {
    version: 1,
    revision: 1,
    productAnalytics: true,
    noticeVersion: 'observability-privacy-v1',
    decisionAt: '2026-07-24T09:00:00.000Z',
    withdrawnAt: null,
  });
}

test('transactional recorder is deterministic across retry and HMAC rotation', async () => {
  const db = createFakeFirestore();
  seedGrantedConsent(db, 'firebase-user-1');
  const registryV1 = subjects.parseObservabilityKeyRegistry({
    keysJson: JSON.stringify({ v1: 'a'.repeat(32) }),
    activeVersion: 'v1',
  });
  const input = {
    db,
    uid: 'firebase-user-1',
    events: [validToolEvent()],
    author: 'client',
    productAnalyticsConsent: true,
    enabled: true,
    registry: registryV1,
    now: new Date('2026-07-24T10:00:00.000Z'),
    retentionDays: 7,
    shardCount: 16,
  };
  const first = await recorder.recordObservabilityBatch(input);
  const duplicate = await recorder.recordObservabilityBatch(input);
  assert.equal(first.accepted, 1);
  assert.equal(duplicate.duplicate, 1);
  assert.equal(
    [...db.documents.keys()].filter(key => key.startsWith('user_observability_events/')).length,
    1,
  );

  const registryV2 = subjects.parseObservabilityKeyRegistry({
    keysJson: JSON.stringify({ v1: 'a'.repeat(32), v2: 'b'.repeat(32) }),
    activeVersion: 'v2',
  });
  const rotatedRetry = await recorder.recordObservabilityBatch({ ...input, registry: registryV2 });
  assert.equal(rotatedRetry.duplicate, 1);
  assert.equal(
    [...db.documents.keys()].filter(key => key.startsWith('user_observability_events/')).length,
    1,
  );
});

test('altered operation replay conflicts and consent denial records nothing', async () => {
  const db = createFakeFirestore();
  seedGrantedConsent(db, 'firebase-user-2');
  const registry = subjects.parseObservabilityKeyRegistry({
    keysJson: JSON.stringify({ v1: 'a'.repeat(32) }),
    activeVersion: 'v1',
  });
  const base = {
    db,
    uid: 'firebase-user-2',
    author: 'client',
    enabled: true,
    registry,
    now: new Date('2026-07-24T10:00:00.000Z'),
  };
  await recorder.recordObservabilityBatch({
    ...base,
    productAnalyticsConsent: true,
    events: [validToolEvent()],
  });
  const conflict = await recorder.recordObservabilityBatch({
    ...base,
    productAnalyticsConsent: true,
    events: [validToolEvent({ plan: 'pro' })],
  });
  assert.equal(conflict.rejectionCodes.operation_conflict, 1);

  const deniedDb = createFakeFirestore();
  const denied = await recorder.recordObservabilityBatch({
    ...base,
    db: deniedDb,
    productAnalyticsConsent: false,
    events: [validToolEvent()],
  });
  assert.equal(denied.rejectionCodes.purpose_not_authorized, 1);
  assert.equal(deniedDb.documents.size, 0);
});

test('transactional recorder fails closed after consent withdrawal or a reset fence', async () => {
  const registry = subjects.parseObservabilityKeyRegistry({
    keysJson: JSON.stringify({ v1: 'a'.repeat(32) }),
    activeVersion: 'v1',
  });
  const withdrawnDb = createFakeFirestore();
  withdrawnDb.documents.set('users/firebase-user-3/settings/privacyControls', {
    version: 1,
    revision: 2,
    productAnalytics: false,
    noticeVersion: 'observability-privacy-v1',
    decisionAt: '2026-07-24T09:59:00.000Z',
    withdrawnAt: '2026-07-24T09:59:00.000Z',
  });
  const withdrawn = await recorder.recordObservabilityBatch({
    db: withdrawnDb,
    uid: 'firebase-user-3',
    events: [validToolEvent()],
    author: 'client',
    productAnalyticsConsent: true,
    enabled: true,
    registry,
    now: new Date('2026-07-24T10:00:00.000Z'),
  });
  assert.equal(withdrawn.rejectionCodes.purpose_not_authorized, 1);
  assert.equal(
    [...withdrawnDb.documents.keys()].some(key => key.startsWith('user_observability_events/')),
    false,
  );

  const resetDb = createFakeFirestore();
  seedGrantedConsent(resetDb, 'firebase-user-4');
  resetDb.documents.set('users/firebase-user-4/observabilityControl/state', {
    resetCutoffAt: '2026-07-24T10:00:00.000Z',
  });
  const fenced = await recorder.recordObservabilityBatch({
    db: resetDb,
    uid: 'firebase-user-4',
    events: [validToolEvent()],
    author: 'client',
    productAnalyticsConsent: true,
    enabled: true,
    registry,
    now: new Date('2026-07-24T10:00:00.000Z'),
  });
  assert.equal(fenced.rejectionCodes.purpose_not_authorized, 1);
  assert.equal(
    [...resetDb.documents.keys()].some(key => key.startsWith('user_observability_events/')),
    false,
  );
});

test('stale privacy notices revoke effective consent', () => {
  const normalized = consents.normalizeObservabilityConsent({
    revision: 9,
    productAnalytics: true,
    noticeVersion: 'observability-privacy-old',
  });
  assert.equal(normalized.productAnalytics, false);
  assert.equal(normalized.noticeVersion, 'observability-privacy-old');
});

test('production readiness rejects placeholders and requires retained key evidence', () => {
  const before = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      OBSERVABILITY_RETENTION_DAYS: '7',
      OBSERVABILITY_DAILY_SHARDS: '16',
      OBSERVABILITY_CASE_RETENTION_DAYS: '30',
      OBSERVABILITY_ACCESS_AUDIT_RETENTION_DAYS: '30',
      OBSERVABILITY_RESET_JOB_RETENTION_DAYS: '30',
      OBSERVABILITY_RETENTION_POLICY_APPROVED: 'true',
      OBSERVABILITY_RETENTION_POLICY_VERSION: 'approved-v1',
      OBSERVABILITY_NOTICE_VERSION: 'observability-privacy-v1',
      OBSERVABILITY_HMAC_ACTIVE_VERSION: 'v1',
      OBSERVABILITY_HMAC_KEYS_JSON: JSON.stringify({
        v1: 'replace_with_a_managed_random_secret_of_at_least_48_characters',
      }),
      OBSERVABILITY_CURSOR_SECRET: 'replace_with_another_managed_random_secret_of_at_least_48_characters',
      OBSERVABILITY_RETAINED_KEY_VERSIONS_JSON: '["v1"]',
      ADMIN_MFA_ENFORCED: 'true',
      FIREBASE_MFA_PROJECT_ENABLED: 'true',
    });
    assert.equal(config.observabilityProductionReady(), false);
    process.env.OBSERVABILITY_HMAC_KEYS_JSON = JSON.stringify({
      v1: 'M6cDq1wJ9sRf4Xy8Lp2Va7Nk5Tu0Hb3Ze6GiQm4Ko9Wx7Pa3',
    });
    process.env.OBSERVABILITY_CURSOR_SECRET =
      'Z4pLm8Qv2Rt7Ys1Kd5Ha9Nx3Uc6We0Bj4Fg8So2Vi7Er5Lm9';
    assert.equal(config.observabilityProductionReady(), true);
    process.env.OBSERVABILITY_RETAINED_KEY_VERSIONS_JSON = '["v2"]';
    assert.equal(config.observabilityProductionReady(), false);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in before)) delete process.env[key];
    }
    Object.assign(process.env, before);
  }
});

test('diagnostic permission is narrow and owner has no bypass around route checks', () => {
  assert.equal(permissions.hasAdminPermission('owner', 'diagnostics.metadata.read'), true);
  assert.equal(permissions.hasAdminPermission('administrator', 'diagnostics.metadata.read'), true);
  assert.equal(permissions.hasAdminPermission('support_admin', 'diagnostics.metadata.read'), true);
  assert.equal(permissions.hasAdminPermission('analyst', 'diagnostics.metadata.read'), false);
  assert.equal(permissions.hasAdminPermission('billing_admin', 'diagnostics.metadata.read'), false);
  assert.equal(permissions.hasAdminPermission('operations_admin', 'diagnostics.metadata.read'), false);

  const activity = read('app/api/admin/diagnostic-cases/[caseId]/activity/route.ts');
  assert.match(activity, /assertDiagnosticAccessPreflight/);
  assert.match(activity, /createDiagnosticAccessReceipt/);
  assert.match(activity, /expectedTargetUid: targetUid/);
  assert.doesNotMatch(activity, /isMasterAccount|role === ['"]owner['"]/);
});

test('ingestion authenticates before strict limiting and refuses limiter outage', () => {
  const route = read('app/api/observability/events/route.ts');
  assert.ok(
    route.indexOf('const auth = await requireObservabilityUser')
      < route.indexOf('const limiter = await checkObservabilityRateLimitStrict'),
  );
  assert.match(route, /if \(limiter\.unavailable\)/);
  assert.doesNotMatch(route, /observability-ingest:\$\{auth\.token\.uid\}/);
  assert.match(route, /observability_rate_limit_unavailable/);
  assert.match(route, /isClientAuthoredEvent/);
  assert.doesNotMatch(route, /console\.(?:log|error|warn)/);
});

test('retention, shard, step-up, and grant defaults are bounded and production requires explicit policy', () => {
  const config = read('lib/observability/config.ts');
  assert.match(config, /DEFAULT_RETENTION_DAYS = 7/);
  assert.match(config, /DEFAULT_SHARD_COUNT = 16/);
  assert.match(config, /OBSERVABILITY_RETENTION_POLICY_VERSION/);
  assert.match(config, /OBSERVABILITY_GRANT_MS = 24 \* 60 \* 60_000/);
  assert.match(config, /OBSERVABILITY_STEP_UP_MS = 15 \* 60_000/);
  assert.match(config, /USER_OBSERVABILITY_V1_ENABLED === 'true'/);
});
