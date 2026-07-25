const assert = require('node:assert/strict');
const test = require('node:test');
const {
  approvedOrigin,
  runPublicProductionSmoke,
} = require('./admin-public-production-smoke');
const {
  captureProductionRollbackPoint,
  restoreProductionRollbackPoint,
} = require('../deploy-fix');
const {
  approvedAggregateOrigin,
} = require('./admin-aggregate-prime');
const {
  verifyRecoveryOwners,
} = require('./admin-recovery-owner-proof');

function result(status = 0, stdout = '') {
  return { status, stdout, stderr: '' };
}

test('release capture and rollback pin Hosting and Cloud Run to production', () => {
  const firebaseCalls = [];
  const gcloudCalls = [];
  const dependencies = {
    runFirebase: args => {
      firebaseCalls.push(args);
      return result();
    },
    runGcloud: args => {
      gcloudCalls.push(args);
      return args.includes('describe')
        ? result(0, JSON.stringify({
            status: {
              traffic: [
                { revisionName: 'ssrtalentconsultingacf1-00041-stable', percent: 60 },
                { revisionName: 'ssrtalentconsultingacf1-00041-stable', percent: 20 },
                { revisionName: 'ssrtalentconsultingacf1-00042-canary', percent: 20 },
              ],
            },
          }))
        : result();
    },
  };
  const rollback = captureProductionRollbackPoint(dependencies);
  restoreProductionRollbackPoint(rollback, dependencies);
  assert.deepEqual(rollback.traffic, [
    { revision: 'ssrtalentconsultingacf1-00041-stable', percent: 80 },
    { revision: 'ssrtalentconsultingacf1-00042-canary', percent: 20 },
  ]);
  assert.ok(firebaseCalls.every(call => call.includes('talent-consulting-acf16')));
  assert.ok(firebaseCalls[0].includes('talent-consulting-acf16:live'));
  assert.ok(firebaseCalls[1].includes('talent-consulting-acf16:live'));
  assert.ok(gcloudCalls.at(-1).includes(
    '--to-revisions=ssrtalentconsultingacf1-00041-stable=80,ssrtalentconsultingacf1-00042-canary=20',
  ));
});

test('aggregate prime sends the cron secret only to approved production origins', () => {
  assert.equal(approvedAggregateOrigin('https://talentconsulting.io'), 'https://talentconsulting.io');
  assert.throws(() => approvedAggregateOrigin('https://attacker.example'), /approved HTTPS production/);
  assert.throws(() => approvedAggregateOrigin('http://talentconsulting.io'), /approved HTTPS production/);
  assert.throws(() => approvedAggregateOrigin('https://user:pass@talentconsulting.io'), /approved HTTPS production/);
});

test('recovery-owner proof binds Firestore records to Auth claims, email, version, and MFA', async () => {
  const records = [
    { id: 'owner-a', data: () => ({ role: 'owner', status: 'active', email: 'a@example.com', version: 4 }) },
    { id: 'owner-b', data: () => ({ role: 'owner', status: 'active', email: 'b@example.com', version: 7 }) },
  ];
  const db = {
    collection: () => ({
      where: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({ size: records.length, docs: records }),
          }),
        }),
      }),
    }),
  };
  const validUsers = {
    'owner-a': {
      email: 'a@example.com',
      emailVerified: true,
      disabled: false,
      multiFactor: { enrolledFactors: [{}] },
      customClaims: { admin: true, adminRole: 'owner', adminVersion: 4 },
    },
    'owner-b': {
      email: 'b@example.com',
      emailVerified: true,
      disabled: false,
      multiFactor: { enrolledFactors: [{}] },
      customClaims: { admin: true, adminRole: 'owner', adminVersion: 7 },
    },
  };
  const serviceAccount = { project_id: 'talent-consulting-acf16' };
  const proof = await verifyRecoveryOwners({
    serviceAccount,
    db,
    auth: { getUser: async uid => validUsers[uid] },
    app: {},
  });
  assert.equal(proof.mfaReadyOwners, 2);

  await assert.rejects(
    verifyRecoveryOwners({
      serviceAccount,
      db,
      auth: {
        getUser: async uid => uid === 'owner-a'
          ? { ...validUsers[uid], customClaims: {} }
          : { ...validUsers[uid], email: 'mismatch@example.com' },
      },
      app: {},
    }),
    /matching active records, claims, verified email, version, and enrolled MFA/,
  );
});

test('public smoke permits only approved production origins', () => {
  assert.equal(approvedOrigin('https://talentconsulting.io'), 'https://talentconsulting.io');
  assert.throws(() => approvedOrigin('http://talentconsulting.io'), /approved HTTPS/);
  assert.throws(() => approvedOrigin('https://evil.example'), /approved HTTPS/);
});

test('public smoke proves pages, health, and anonymous fail-closed boundaries', async () => {
  const headers = {
    get(name) {
      if (name === 'content-type') return 'text/html; charset=utf-8';
      if (name === 'x-frame-options') return 'DENY';
      if (name === 'cache-control') return 'private, no-store, max-age=0';
      return null;
    },
  };
  const smoke = await runPublicProductionSmoke({
    origin: 'https://talentconsulting.io',
    fetchImpl: async url => ({
      status: url.endsWith('/api/health') || !url.includes('/api/') ? 200 : 401,
      headers,
    }),
  });
  assert.equal(smoke.status, 'passed');
});

test('authenticated smoke reads deploy-local owner evidence without staging it into runtime', () => {
  const deploy = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'deploy-fix.js'),
    'utf8',
  );
  const smoke = require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'admin-production-smoke.js'),
    'utf8',
  );
  assert.match(deploy, /'--env-file=\.env\.local',[\s\S]*'scripts\/admin-production-smoke\.js',[\s\S]*'--online'/);
  assert.match(smoke, /process\.env\.ADMIN_SMOKE_OWNER_EMAIL/);
  assert.match(deploy, /DEPLOY_LOCAL_ONLY_ENV_KEYS/);
  assert.match(deploy, /'ADMIN_SMOKE_MFA_ID_TOKEN'/);
});
