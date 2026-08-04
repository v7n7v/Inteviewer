const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');

const firebaseJsonPath = './firebase.json';
const firebaseEnvPath = './.env';
const localEnvPath = './.env.local';
const FIREBASE_RESERVED_ENV_PREFIX = /^(?:FIREBASE_|EXT_|X_GOOGLE_)/;
const DEPLOY_LOCAL_ONLY_ENV_KEYS = new Set([
  'ADMIN_SMOKE_MFA_ID_TOKEN',
  'ADMIN_SMOKE_OWNER_EMAIL',
  'ADMIN_AGGREGATE_BASE_URL',
]);
const PRODUCTION_FIREBASE_PROJECT = 'talent-consulting-acf16';
const PRODUCTION_SSR_SERVICE = 'ssrtalentconsultingacf1';
const PRODUCTION_REGION = 'us-east1';
const ROLLBACK_CHANNEL = 'admin-command-grid-rollback';

function parseEnvLines(content) {
  const lines = content.split(/\r?\n/);
  const entries = new Map();
  for (const line of lines) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) entries.set(match[1], line);
  }
  return entries;
}

function buildFirebaseRuntimeEnv(originalContent, localContent) {
  const merged = parseEnvLines(originalContent);
  for (const [key, line] of parseEnvLines(localContent)) {
    if (FIREBASE_RESERVED_ENV_PREFIX.test(key) || DEPLOY_LOCAL_ONLY_ENV_KEYS.has(key)) continue;
    merged.set(key, line);
  }
  for (const key of [...merged.keys()]) {
    if (FIREBASE_RESERVED_ENV_PREFIX.test(key) || DEPLOY_LOCAL_ONLY_ENV_KEYS.has(key)) {
      merged.delete(key);
    }
  }
  return `${[...merged.values()].join('\n')}\n`;
}

function buildFrameworksConfig(original) {
  return {
    ...original,
    hosting: {
      ...(original.hosting || {}),
      source: '.',
      frameworksBackend: {
        ...(original.hosting?.frameworksBackend || {}),
        region: 'us-east1',
      },
    },
  };
}

function buildStaticFallbackConfig(original) {
  const { source: _source, frameworksBackend: _frameworksBackend, ...hosting } = original.hosting || {};
  return {
    ...original,
    hosting: {
      ...hosting,
      public: '.firebase/talent-consulting-acf16/hosting',
      rewrites: [{
        source: '**',
        run: { serviceId: 'ssrtalentconsultingacf1', region: 'us-east1' },
      }],
    },
  };
}

function runFirebase(args) {
  const cliArgs = ['--yes', 'firebase-tools@15.24.0', ...args];
  const executable = process.platform === 'win32'
    ? (process.env.ComSpec || 'cmd.exe')
    : 'npx';
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx.cmd', ...cliArgs]
    : cliArgs;
  const result = spawnSync(
    executable,
    executableArgs,
    { encoding: 'utf8' },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`Firebase CLI launch failed: ${result.error.code || result.error.name || 'unknown_error'}\n`);
  }
  return result;
}

function runGcloud(args) {
  const executable = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
  return spawnSync(executable, args, { encoding: 'utf8' });
}

function runProductionPreflight() {
  execFileSync(
    process.execPath,
    ['scripts/production-deploy-preflight.js', 'firebase'],
    { stdio: 'inherit' },
  );
}

function captureProductionRollbackPoint(dependencies = {}) {
  const run = dependencies.runFirebase || runFirebase;
  const gcloud = dependencies.runGcloud || runGcloud;
  assertSucceeded(run([
    'hosting:clone',
    `${PRODUCTION_FIREBASE_PROJECT}:live`,
    `${PRODUCTION_FIREBASE_PROJECT}:${ROLLBACK_CHANNEL}`,
    '--project',
    PRODUCTION_FIREBASE_PROJECT,
    // No --force here. hosting:clone takes no options beyond --help in the
    // firebase-tools version pinned in runFirebase, and --force is not a global
    // either, so passing it made commander exit 1 with "unknown option
    // '--force'" before the clone ran. --non-interactive is a real global and is
    // what actually makes this safe to run unattended: it errors out rather than
    // waiting on a prompt.
    '--non-interactive',
  ]), 'Firebase Hosting rollback capture');
  const revisionResult = gcloud([
    'run',
    'services',
    'describe',
    PRODUCTION_SSR_SERVICE,
    '--region',
    PRODUCTION_REGION,
    '--project',
    PRODUCTION_FIREBASE_PROJECT,
    '--format=json(status.traffic)',
  ]);
  assertSucceeded(revisionResult, 'Cloud Run rollback revision capture');
  let parsedTraffic;
  try {
    const parsed = JSON.parse(String(revisionResult.stdout || ''));
    parsedTraffic = parsed?.status?.traffic || parsed?.traffic || parsed;
  } catch {
    throw new Error('Cloud Run rollback traffic capture returned invalid JSON.');
  }
  if (!Array.isArray(parsedTraffic)) {
    throw new Error('Cloud Run rollback traffic capture did not return a traffic assignment.');
  }
  const trafficByRevision = new Map();
  for (const entry of parsedTraffic) {
    const revision = String(entry?.revisionName || '').trim();
    const percent = Number(entry?.percent);
    // Tag-only entries carry no `percent`, and Number(undefined) is NaN. NaN <= 0
    // is false, so a bare `percent <= 0` did NOT skip them: each one added
    // 0 + NaN, Number.isInteger(NaN) failed the check below, and the whole
    // capture threw. Firebase Hosting leaves one `fh-`-tagged revision behind per
    // preview channel it has ever created — production carries 69 of them against
    // a single revision actually serving traffic, so this threw every time on real
    // data while the fixtures, which only ever had percent-bearing entries, passed.
    if (!Number.isFinite(percent) || percent <= 0) continue;
    trafficByRevision.set(revision, (trafficByRevision.get(revision) || 0) + percent);
  }
  const traffic = [...trafficByRevision].map(([revision, percent]) => ({ revision, percent }));
  if (
    traffic.length < 1
    || traffic.some(entry => !/^[a-z][a-z0-9-]{0,62}$/.test(entry.revision)
      || !Number.isInteger(entry.percent)
      || entry.percent < 1
      || entry.percent > 100)
    || traffic.reduce((sum, entry) => sum + entry.percent, 0) !== 100
  ) {
    throw new Error('Cloud Run rollback traffic capture returned an invalid resolved traffic assignment.');
  }
  return { traffic };
}

function restoreProductionRollbackPoint(rollback, dependencies = {}) {
  const run = dependencies.runFirebase || runFirebase;
  const gcloud = dependencies.runGcloud || runGcloud;
  assertSucceeded(run([
    'hosting:clone',
    `${PRODUCTION_FIREBASE_PROJECT}:${ROLLBACK_CHANNEL}`,
    `${PRODUCTION_FIREBASE_PROJECT}:live`,
    '--project',
    PRODUCTION_FIREBASE_PROJECT,
    // Same as the capture path above — no --force. This one matters more: it is
    // the automatic restore, so an unknown-option exit here would strand
    // production on a half-deployed state instead of rolling it back.
    '--non-interactive',
  ]), 'Firebase Hosting rollback');
  assertSucceeded(gcloud([
    'run',
    'services',
    'update-traffic',
    PRODUCTION_SSR_SERVICE,
    `--to-revisions=${rollback.traffic.map(entry => `${entry.revision}=${entry.percent}`).join(',')}`,
    '--region',
    PRODUCTION_REGION,
    '--project',
    PRODUCTION_FIREBASE_PROJECT,
    '--quiet',
  ]), 'Cloud Run rollback');
}

function isExpectedHostingConflict(result) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  return result.status !== 0
    && /409/i.test(output)
    && /ALREADY_EXISTS/i.test(output)
    && /hosting|hosting\s+version|sites\//i.test(output);
}

function assertSucceeded(result, label) {
  if (result.status === 0) return;
  const launchDetail = result.error?.code ? ` (${result.error.code})` : '';
  throw new Error(`${label} failed with exit status ${result.status ?? 'unknown'}${launchDetail}.`);
}

// Neither of these is used at runtime: `next dev` fills .next/dev, `next build`
// leaves .next/cache. Firebase's framework adapter copies .next wholesale into
// the function bundle, and nothing in firebase.json excludes them — hosting.ignore
// only governs hosting, and there is no functions key or .gcloudignore.
//
// One local dev-server run was enough to push .next to 7.4 GB (5.9 GB of it
// .next/dev), the packaged upload to 4.67 GB, and the Cloud Run function update
// to `Task index 0 failed: timed out after 1500000ms` — 25 minutes, then a failed
// deploy. The parts actually needed are .next/server, .next/standalone and
// .next/static, together about 180 MB.
//
// Pruning is safe: both directories are pure caches, are gitignored, and are
// regenerated by the build that runs immediately after this.
const DISPOSABLE_BUILD_CACHES = ['.next/dev', '.next/cache'];

function pruneBuildCaches(fileSystem = fs) {
  const pruned = [];
  for (const target of DISPOSABLE_BUILD_CACHES) {
    if (!fileSystem.existsSync(target)) continue;
    fileSystem.rmSync(target, { recursive: true, force: true });
    pruned.push(target);
  }
  if (pruned.length) console.log(`Pruned build caches before deploy: ${pruned.join(', ')}.`);
  return pruned;
}

function deployFirebase(dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const run = dependencies.runFirebase || runFirebase;
  const runPreflight = dependencies.runPreflight || runProductionPreflight;
  const prune = dependencies.pruneBuildCaches || (() => pruneBuildCaches(fileSystem));
  const hostingArtifactExists = dependencies.hostingArtifactExists || (() => {
    return fileSystem.existsSync('.firebase/talent-consulting-acf16/hosting');
  });

  console.log('Starting Firebase production deployment...');
  runPreflight();
  // Before the adapter's `next build`, not after — it copies whatever .next holds.
  prune();

  const originalContent = fileSystem.readFileSync(firebaseJsonPath, 'utf8');
  const originalEnvContent = fileSystem.readFileSync(firebaseEnvPath, 'utf8');
  const localEnvContent = fileSystem.readFileSync(localEnvPath, 'utf8');
  const original = JSON.parse(originalContent);

  try {
    fileSystem.writeFileSync(
      firebaseEnvPath,
      buildFirebaseRuntimeEnv(originalEnvContent, localEnvContent),
    );
    fileSystem.writeFileSync(firebaseJsonPath, `${JSON.stringify(buildFrameworksConfig(original), null, 2)}\n`);
    const initial = run([
      'deploy',
      '--only',
      'hosting,firestore',
      '--project',
      PRODUCTION_FIREBASE_PROJECT,
      '--non-interactive',
    ]);
    if (initial.status === 0) {
      console.log('Firebase production deployment completed.');
      return;
    }
    if (!isExpectedHostingConflict(initial)) {
      assertSucceeded(initial, 'Firebase deployment');
    }

    if (!hostingArtifactExists()) {
      throw new Error('Firebase Hosting fallback stopped because no freshly built hosting artifact exists.');
    }

    console.log('Firebase Hosting returned the known 409 conflict. Running the bounded hosting finalization fallback...');
    fileSystem.writeFileSync(firebaseJsonPath, `${JSON.stringify(buildStaticFallbackConfig(original), null, 2)}\n`);
    assertSucceeded(run([
      'deploy',
      '--only',
      'hosting',
      '--project',
      PRODUCTION_FIREBASE_PROJECT,
      '--non-interactive',
    ]), 'Firebase Hosting fallback');
    console.log('Firebase production deployment completed through the hosting fallback.');
  } finally {
    fileSystem.writeFileSync(firebaseJsonPath, originalContent);
    fileSystem.writeFileSync(firebaseEnvPath, originalEnvContent);
  }
}

function primeAdminAggregates() {
  execFileSync(
    process.execPath,
    ['--env-file=.env.local', 'scripts/admin-aggregate-prime.js'],
    { stdio: 'inherit' },
  );
}

function runPostDeploySmoke() {
  execFileSync(
    process.execPath,
    ['scripts/admin-public-production-smoke.js'],
    { stdio: 'inherit' },
  );
  execFileSync(
    process.execPath,
    [
      '--env-file=.env.local',
      'scripts/admin-production-smoke.js',
      '--online',
    ],
    { stdio: 'inherit' },
  );
}

function main() {
  runProductionPreflight();
  const rollback = captureProductionRollbackPoint();
  try {
    deployFirebase({ runPreflight: () => {} });
    primeAdminAggregates();
    runPostDeploySmoke();
  } catch (error) {
    try {
      restoreProductionRollbackPoint(rollback);
    } catch (rollbackError) {
      throw new Error(
        `Production release failed and rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        { cause: error },
      );
    }
    throw error;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  buildFrameworksConfig,
  buildFirebaseRuntimeEnv,
  buildStaticFallbackConfig,
  captureProductionRollbackPoint,
  deployFirebase,
  DISPOSABLE_BUILD_CACHES,
  isExpectedHostingConflict,
  primeAdminAggregates,
  pruneBuildCaches,
  PRODUCTION_FIREBASE_PROJECT,
  restoreProductionRollbackPoint,
  runFirebase,
  runGcloud,
  runPostDeploySmoke,
  runProductionPreflight,
};
