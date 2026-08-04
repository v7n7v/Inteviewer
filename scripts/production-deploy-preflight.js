const fs = require('fs');
const path = require('path');
const { createPrivateKey } = require('crypto');
const { spawnSync } = require('child_process');
const PRODUCTION_FIREBASE_PROJECT = 'talent-consulting-acf16';

const PUBLIC_BUILD_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_GOOGLE_AUTH_ENABLED',
  'NEXT_PUBLIC_MFA_ENABLED',
  'NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
];

const OPTIONAL_PUBLIC_BUILD_KEYS = ['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'];
const BUILD_ASSERTION_KEYS = ['FIREBASE_MFA_PROJECT_ENABLED'];
const ALLOWED_BUILD_KEYS = [...PUBLIC_BUILD_KEYS, ...OPTIONAL_PUBLIC_BUILD_KEYS, ...BUILD_ASSERTION_KEYS];
const FIREBASE_FRAMEWORK_RUNTIME_ALIASES = [
  {
    alias: 'firebase-admin-a14c8a5423a75469',
    target: 'firebase-admin',
    subpaths: ['app', 'auth', 'firestore', 'storage'],
  },
  {
    alias: 'prettier-3c69a91af3bc4731',
    target: 'prettier',
    subpaths: ['plugins/html', 'standalone'],
  },
  {
    alias: 'mammoth-ea033c5d84d0b9b2',
    target: 'mammoth',
    subpaths: [''],
  },
  {
    alias: '@react-pdf/renderer-5f716e9bc7d68b8a',
    target: '@react-pdf/renderer',
    subpaths: [''],
  },
];

const STRIPE_PRICE_KEYS = [
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_PRO_ANNUAL_PRICE_ID',
  'STRIPE_STUDIO_PRICE_ID',
  'STRIPE_STUDIO_ANNUAL_PRICE_ID',
];

function cleanValue(value = '') {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseDotEnv(content) {
  return Object.fromEntries(content.split(/\r?\n/).flatMap(line => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) return [];
    const separator = line.indexOf('=');
    return [[line.slice(0, separator), cleanValue(line.slice(separator + 1))]];
  }));
}

function parseFlatYaml(content) {
  return Object.fromEntries(content.split(/\r?\n/).flatMap(line => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*:/.test(line)) return [];
    const separator = line.indexOf(':');
    return [[line.slice(0, separator), cleanValue(line.slice(separator + 1))]];
  }));
}

function usable(value, prefix, minimumLength = prefix.length + 8) {
  return typeof value === 'string'
    && value.length >= minimumLength
    && value.startsWith(prefix)
    && !/(?:your[_-]?|replace[_-]?|change[_-]?me|placeholder|example|todo|\$\{)/i.test(value);
}

function strongSecret(value) {
  return typeof value === 'string'
    && value.length >= 32
    && !/(?:change[_-]?me|replace[_-]?me|placeholder|example|todo|secret123|password)/i.test(value);
}

function strongObservabilitySecret(value) {
  if (
    typeof value !== 'string'
    || value.length < 48
    || Buffer.byteLength(value, 'utf8') > 256
    || /(?:change[_ -]?me|replace|placeholder|example|todo|password|secret123|managed[_ -]?random|at[_ -]?\d+)/i.test(value)
  ) {
    return false;
  }
  return new Set(value).size >= 12 && !/^(.{1,8})\1+$/.test(value);
}

function validateObservabilityConfiguration(runtimeEnv, errors) {
  if (!['true', 'false'].includes(runtimeEnv.USER_OBSERVABILITY_V1_ENABLED || 'false')) {
    errors.push('observability:feature_flag:boolean_required');
    return;
  }
  if (runtimeEnv.USER_OBSERVABILITY_V1_ENABLED !== 'true') return;
  if (
    runtimeEnv.ADMIN_MFA_ENFORCED !== 'true'
    || runtimeEnv.FIREBASE_MFA_PROJECT_ENABLED !== 'true'
  ) {
    errors.push('observability:diagnostics:admin_mfa_enforcement_required');
  }
  if (runtimeEnv.OBSERVABILITY_RETENTION_POLICY_APPROVED !== 'true') {
    errors.push('observability:retention_policy:approval_required');
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(runtimeEnv.OBSERVABILITY_RETENTION_POLICY_VERSION || '')) {
    errors.push('observability:retention_policy:version_required');
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(runtimeEnv.OBSERVABILITY_NOTICE_VERSION || '')) {
    errors.push('observability:notice:version_required');
  }
  const boundedInteger = (key, minimum, maximum) => {
    const value = Number(runtimeEnv[key]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      errors.push(`observability:${key}:bounded_integer_required`);
    }
  };
  boundedInteger('OBSERVABILITY_RETENTION_DAYS', 7, 90);
  boundedInteger('OBSERVABILITY_DAILY_SHARDS', 4, 32);
  boundedInteger('OBSERVABILITY_CASE_RETENTION_DAYS', 30, 730);
  boundedInteger('OBSERVABILITY_ACCESS_AUDIT_RETENTION_DAYS', 30, 730);
  boundedInteger('OBSERVABILITY_RESET_JOB_RETENTION_DAYS', 30, 730);
  let keys;
  try {
    keys = JSON.parse(runtimeEnv.OBSERVABILITY_HMAC_KEYS_JSON || '');
  } catch {
    errors.push('observability:hmac_registry:invalid_json');
    return;
  }
  const entries = keys && typeof keys === 'object' && !Array.isArray(keys)
    ? Object.entries(keys)
    : [];
  if (
    entries.length < 1
    || entries.length > 3
    || entries.some(([version, secret]) => (
      !/^[a-z0-9][a-z0-9_-]{0,15}$/i.test(version)
      || !strongObservabilitySecret(secret)
    ))
    || new Set(entries.map(([, secret]) => secret)).size !== entries.length
  ) {
    errors.push('observability:hmac_registry:strong_unique_keys_required');
  }
  const activeVersion = runtimeEnv.OBSERVABILITY_HMAC_ACTIVE_VERSION;
  if (!entries.some(([version]) => version === activeVersion)) {
    errors.push('observability:hmac_registry:active_version_missing');
  }
  let retainedVersions;
  try {
    retainedVersions = JSON.parse(runtimeEnv.OBSERVABILITY_RETAINED_KEY_VERSIONS_JSON || '');
  } catch {
    retainedVersions = null;
  }
  if (
    !Array.isArray(retainedVersions)
    || retainedVersions.length < 1
    || retainedVersions.length > 3
    || new Set(retainedVersions).size !== retainedVersions.length
    || !retainedVersions.includes(activeVersion)
    || retainedVersions.some(version => !entries.some(([candidate]) => candidate === version))
  ) {
    errors.push('observability:hmac_registry:retained_versions_manifest_invalid');
  }
  if (
    !strongObservabilitySecret(runtimeEnv.OBSERVABILITY_CURSOR_SECRET)
    || entries.some(([, secret]) => secret === runtimeEnv.OBSERVABILITY_CURSOR_SECRET)
  ) {
    errors.push('observability:cursor_secret:strong_independent_secret_required');
  }
}

function validateProductionDeploy(buildEnv, runtimeEnv) {
  const errors = [];
  if (buildEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== PRODUCTION_FIREBASE_PROJECT) {
    errors.push('firebase:build_project:production_target_required');
  }
  if (runtimeEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== PRODUCTION_FIREBASE_PROJECT) {
    errors.push('firebase:runtime_project:production_target_required');
  }
  for (const key of Object.keys(buildEnv)) {
    if (!ALLOWED_BUILD_KEYS.includes(key)) errors.push(`build:${key}:not_public_allowlisted`);
  }
  for (const key of PUBLIC_BUILD_KEYS) {
    if (!buildEnv[key]) errors.push(`build:${key}:missing`);
    if (!runtimeEnv[key]) errors.push(`runtime:${key}:missing`);
    if (buildEnv[key] && runtimeEnv[key] && buildEnv[key] !== runtimeEnv[key]) {
      errors.push(`public:${key}:mismatch`);
    }
  }
  for (const key of ['NEXT_PUBLIC_GOOGLE_AUTH_ENABLED', 'NEXT_PUBLIC_MFA_ENABLED']) {
    if (!['true', 'false'].includes(buildEnv[key])) errors.push(`build:${key}:boolean_required`);
    if (!['true', 'false'].includes(runtimeEnv[key])) errors.push(`runtime:${key}:boolean_required`);
  }
  if (runtimeEnv.NODE_ENV !== 'production') errors.push('runtime:NODE_ENV:must_be_production');
  if (runtimeEnv.STAGING_HOSTNAME) errors.push('runtime:STAGING_HOSTNAME:must_be_absent');
  if (!usable(runtimeEnv.STRIPE_SECRET_KEY, 'sk_live_', 20)) errors.push('stripe:secret_key:live_required');
  if (!usable(runtimeEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, 'pk_live_', 20)) errors.push('stripe:publishable_key:live_required');
  if (!usable(runtimeEnv.STRIPE_WEBHOOK_SECRET, 'whsec_')) errors.push('stripe:webhook_secret:missing_or_placeholder');
  for (const key of STRIPE_PRICE_KEYS) {
    if (!usable(runtimeEnv[key], 'price_')) errors.push(`stripe:${key}:missing_or_placeholder`);
  }
  const prices = STRIPE_PRICE_KEYS.map(key => runtimeEnv[key]).filter(Boolean);
  if (new Set(prices).size !== prices.length) errors.push('stripe:price_ids:must_be_unique');
  if (!runtimeEnv.FIREBASE_SERVICE_ACCOUNT_JSON) {
    errors.push('runtime:FIREBASE_SERVICE_ACCOUNT_JSON:missing');
  } else {
    try {
      const normalizedServiceAccount = runtimeEnv.FIREBASE_SERVICE_ACCOUNT_JSON
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
      const serviceAccount = JSON.parse(normalizedServiceAccount);
      if (!serviceAccount.project_id || serviceAccount.project_id !== runtimeEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        errors.push('runtime:FIREBASE_SERVICE_ACCOUNT_JSON:project_mismatch');
      }
      let credentialShapeValid = typeof serviceAccount.client_email === 'string'
        && /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(serviceAccount.client_email);
      try {
        createPrivateKey(serviceAccount.private_key);
      } catch {
        credentialShapeValid = false;
      }
      if (!credentialShapeValid) {
        errors.push('runtime:FIREBASE_SERVICE_ACCOUNT_JSON:invalid_shape');
      }
    } catch {
      errors.push('runtime:FIREBASE_SERVICE_ACCOUNT_JSON:invalid_json');
    }
  }
  if (!strongSecret(runtimeEnv.CRON_SECRET)) errors.push('runtime:CRON_SECRET:weak_or_missing');
  if (!['true', 'false'].includes(buildEnv.FIREBASE_MFA_PROJECT_ENABLED)) {
    errors.push('build:FIREBASE_MFA_PROJECT_ENABLED:boolean_required');
  }
  if (!['true', 'false'].includes(runtimeEnv.FIREBASE_MFA_PROJECT_ENABLED)) {
    errors.push('runtime:FIREBASE_MFA_PROJECT_ENABLED:boolean_required');
  }
  if (
    buildEnv.FIREBASE_MFA_PROJECT_ENABLED
    && runtimeEnv.FIREBASE_MFA_PROJECT_ENABLED
    && buildEnv.FIREBASE_MFA_PROJECT_ENABLED !== runtimeEnv.FIREBASE_MFA_PROJECT_ENABLED
  ) {
    errors.push('mfa:project_assertion_mismatch');
  }
  if (!['true', 'false'].includes(runtimeEnv.ADMIN_MFA_ENFORCED)) {
    errors.push('runtime:ADMIN_MFA_ENFORCED:boolean_required');
  }
  if (runtimeEnv.ADMIN_MFA_ENFORCED === 'true' && runtimeEnv.FIREBASE_MFA_PROJECT_ENABLED !== 'true') {
    errors.push('mfa:admin_enforcement_requires_project_mfa');
  }
  if (!['true', 'false'].includes(buildEnv.NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2)) {
    errors.push('build:NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2:boolean_required');
  }
  for (const key of ['ADMIN_MUTATIONS_V2_ENABLED', 'ADMIN_RECOVERY_OWNERS_VERIFIED']) {
    if (!['true', 'false'].includes(runtimeEnv[key])) {
      errors.push(`runtime:${key}:boolean_required`);
    }
  }
  if (runtimeEnv.ADMIN_MUTATIONS_V2_ENABLED === 'true') {
    if (runtimeEnv.ADMIN_MFA_ENFORCED !== 'true') {
      errors.push('admin:mutations_require_mfa_enforcement');
    }
    if (runtimeEnv.ADMIN_RECOVERY_OWNERS_VERIFIED !== 'true') {
      errors.push('admin:mutations_require_verified_recovery_owners');
    }
    if (buildEnv.NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2 !== 'true') {
      errors.push('admin:mutations_require_command_grid_rollout');
    }
  }
  // These two used to live inside the mutations block above, which meant that with
  // ADMIN_MUTATIONS_V2_ENABLED=false they were never evaluated. But deploy-fix.js
  // runs scripts/admin-production-smoke.js after EVERY deploy, and a throw there
  // triggers the automatic rollback — so a missing ADMIN_SMOKE_OWNER_EMAIL passed
  // preflight and then reverted a deploy that had already fully succeeded: hosting
  // released, Cloud Run function updated, aggregates primed. Preflight has to
  // assert whatever post-deploy verification needs, or the cheapest possible
  // failure surfaces at the most expensive possible moment.
  if (!/^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/.test(runtimeEnv.ADMIN_SMOKE_OWNER_EMAIL || '')) {
    errors.push('admin:smoke_owner_email_required');
  }
  // The smoke only takes its MFA branch when enforcement is on, and that branch
  // hard-requires a token it cannot mint for itself. Mutations already require MFA
  // enforcement above, so this still covers the mutation-enabled case it came from.
  if (runtimeEnv.ADMIN_MFA_ENFORCED === 'true'
    && (!runtimeEnv.ADMIN_SMOKE_MFA_ID_TOKEN || runtimeEnv.ADMIN_SMOKE_MFA_ID_TOKEN.length < 100)) {
    errors.push('admin:fresh_mfa_smoke_token_required');
  }
  if (runtimeEnv.ADMIN_AGGREGATE_BASE_URL) {
    try {
      const aggregateOrigin = new URL(runtimeEnv.ADMIN_AGGREGATE_BASE_URL);
      if (
        aggregateOrigin.protocol !== 'https:'
        || aggregateOrigin.username
        || aggregateOrigin.password
        || aggregateOrigin.port
        || aggregateOrigin.pathname !== '/'
        || aggregateOrigin.search
        || aggregateOrigin.hash
        || ![
          'talentconsulting.io',
          'www.talentconsulting.io',
          'talent-consulting-acf16.web.app',
        ].includes(aggregateOrigin.hostname.toLowerCase())
      ) {
        errors.push('runtime:ADMIN_AGGREGATE_BASE_URL:approved_production_origin_required');
      }
    } catch {
      errors.push('runtime:ADMIN_AGGREGATE_BASE_URL:approved_production_origin_required');
    }
  }
  if (!strongSecret(runtimeEnv.ADMIN_REFERENCE_SECRET)) {
    errors.push('runtime:ADMIN_REFERENCE_SECRET:weak_or_missing');
  }
  validateObservabilityConfiguration(runtimeEnv, errors);
  return { ready: errors.length === 0, errors };
}

function loadProductionDeployEnvironment(mode, root = process.cwd()) {
  const buildEnv = parseDotEnv(fs.readFileSync(path.join(root, '.env.production'), 'utf8'));
  const runtimePath = mode === 'cloudrun' ? '.env.cloudrun.yaml' : '.env.local';
  const runtimeContent = fs.readFileSync(path.join(root, runtimePath), 'utf8');
  const runtimeEnv = mode === 'cloudrun' ? parseFlatYaml(runtimeContent) : parseDotEnv(runtimeContent);
  if (mode === 'firebase' && !runtimeEnv.NODE_ENV) runtimeEnv.NODE_ENV = 'production';
  return { buildEnv, runtimeEnv, runtimePath };
}

function validateFirebaseFrameworkPackage(root = process.cwd()) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const errors = [];
  for (const configuration of FIREBASE_FRAMEWORK_RUNTIME_ALIASES) {
    const alias = packageJson.dependencies?.[configuration.alias];
    if (typeof alias !== 'string' || !alias.startsWith(`npm:${configuration.target}@`)) {
      errors.push(`framework:${configuration.alias}:missing_runtime_alias`);
      continue;
    }
    try {
      for (const subpath of configuration.subpaths) {
        require.resolve(
          subpath ? `${configuration.alias}/${subpath}` : configuration.alias,
          { paths: [root] },
        );
      }
    } catch {
      errors.push(`framework:${configuration.alias}:subpaths_unresolvable`);
    }
  }
  return { ready: errors.length === 0, errors };
}

function main() {
  const mode = process.argv[2];
  if (!['cloudrun', 'firebase'].includes(mode)) {
    throw new Error('Usage: node scripts/production-deploy-preflight.js cloudrun|firebase');
  }
  const { buildEnv, runtimeEnv, runtimePath } = loadProductionDeployEnvironment(mode);
  const result = validateProductionDeploy(buildEnv, runtimeEnv);
  const frameworkResult = mode === 'firebase'
    ? validateFirebaseFrameworkPackage()
    : { ready: true, errors: [] };
  const errors = [...result.errors, ...frameworkResult.errors];
  if (errors.length) {
    console.error(`Production deploy preflight failed for ${mode}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  if (runtimeEnv.ADMIN_MUTATIONS_V2_ENABLED === 'true') {
    const proof = spawnSync(
      process.execPath,
      ['scripts/admin-recovery-owner-proof.js'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, ...runtimeEnv },
      },
    );
    if (proof.stdout) process.stdout.write(proof.stdout);
    if (proof.status !== 0) {
      console.error('Production deploy preflight failed for firebase:');
      console.error('- admin:recovery_owner_live_proof_failed');
      process.exitCode = 1;
      return;
    }
  }
  console.log(`Production deploy preflight passed for ${mode}: public build/runtime values match; live Stripe, Firebase Admin and cron configuration are present in ${runtimePath}.`);
}

if (require.main === module) main();

module.exports = {
  PUBLIC_BUILD_KEYS,
  BUILD_ASSERTION_KEYS,
  FIREBASE_FRAMEWORK_RUNTIME_ALIASES,
  ALLOWED_BUILD_KEYS,
  STRIPE_PRICE_KEYS,
  PRODUCTION_FIREBASE_PROJECT,
  parseDotEnv,
  parseFlatYaml,
  validateProductionDeploy,
  validateFirebaseFrameworkPackage,
  strongObservabilitySecret,
  validateObservabilityConfiguration,
};
