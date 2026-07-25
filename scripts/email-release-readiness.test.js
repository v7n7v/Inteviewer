const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const readiness = require('./email-release-readiness');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(__dirname, 'email-release-readiness.js');

function validEnvironment(overrides = {}) {
  return {
    RESEND_API_KEY: 're_operational_fixture_key',
    RESEND_WEBHOOK_SECRET: 'whsec_operational_fixture_secret',
    EMAIL_SYSTEM_V2_ENABLED: 'false',
    EMAIL_MARKETING_ENABLED: 'false',
    EMAIL_AUTH_ACTION_ORIGIN: 'https://talentconsulting.io',
    ...readiness.EXPECTED_SENDERS,
    EMAIL_SUPPORT_REPLY_TO: 'support@talentconsulting.io',
    EMAIL_OPS_REPLY_TO: 'ops@talentconsulting.io',
    EMAIL_OPS_DESTINATION: 'owner@example.net',
    EMAIL_UNSUBSCRIBE_SECRET: 'unsubscribe-fixture-secret-000000001',
    ACCOUNT_ACTION_SECRET: 'account-action-fixture-secret-000000002',
    CRON_SECRET: 'cron-fixture-secret-0000000000000003',
    EMAIL_MAILING_ADDRESS: '',
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    readJson: async url => url === readiness.RESEND_DOMAINS_URL
      ? { data: [{ name: readiness.TRANSACTIONAL_DOMAIN, status: 'verified', capabilities: { sending: 'enabled' } }] }
      : { data: [{
        endpoint: 'https://talentconsulting.io/api/webhooks/resend',
        status: 'enabled',
        events: [...readiness.REQUIRED_RECEIPT_EVENTS],
      }] },
    resolveMx: async () => [
      { priority: 10, exchange: 'route1.mx.cloudflare.net' },
      { priority: 20, exchange: 'route2.mx.cloudflare.net' },
    ],
    resolveTxt: async () => [['v=DMARC1; p=none; rua=mailto:dmarc@talentconsulting.io; adkim=r; aspf=r; pct=100']],
    resolveNs: async () => ['one.ns.cloudflare.com', 'two.ns.cloudflare.com'],
    fetchImpl: async url => ({ status: String(url).includes('/webhooks/') ? 405 : 401 }),
    ...overrides,
  };
}

test('shadow configuration requires the exact sender and safety contract', () => {
  const checks = readiness.runConfigurationChecks(validEnvironment(), 'shadow');
  assert.equal(checks.every(item => item.status === 'pass'), true);

  const failed = readiness.runConfigurationChecks(validEnvironment({
    EMAIL_FROM_BILLING: 'Billing <billing@example.com>',
    EMAIL_OPS_DESTINATION: 'ops@talentconsulting.io',
    ACCOUNT_ACTION_SECRET: 'unsubscribe-fixture-secret-000000001',
    EMAIL_MARKETING_ENABLED: 'true',
  }), 'shadow');
  assert.deepEqual(
    failed.filter(item => item.status === 'fail').map(item => item.name),
    ['sender_contract', 'private_ops_destination', 'application_signing_secrets', 'release_flags'],
  );
});

test('every active transactional sender uses the single verified root domain', () => {
  assert.equal(readiness.TRANSACTIONAL_DOMAIN, 'talentconsulting.io');
  const transactionalSenders = Object.entries(readiness.EXPECTED_SENDERS)
    .filter(([key]) => key !== 'EMAIL_FROM_MARKETING')
    .map(([, sender]) => sender);
  assert.equal(transactionalSenders.length, 6);
  for (const sender of transactionalSenders) {
    assert.match(sender, /@talentconsulting\.io>$/);
    assert.doesNotMatch(sender, /@[^>]*\.talentconsulting\.io>$/);
  }
  assert.match(readiness.EXPECTED_SENDERS.EMAIL_FROM_MARKETING, /@news\.talentconsulting\.io>$/);
});

test('cutover mode requires V2 on while marketing remains off', () => {
  const ready = readiness.runConfigurationChecks(validEnvironment({ EMAIL_SYSTEM_V2_ENABLED: 'true' }), 'cutover');
  assert.equal(ready.every(item => item.status === 'pass'), true);
  const shadow = readiness.runConfigurationChecks(validEnvironment(), 'cutover');
  assert.equal(shadow.find(item => item.name === 'release_flags').status, 'fail');
});

test('complete online evidence passes without provider writes or email sends', async () => {
  const result = await readiness.runReleaseReadiness({
    env: validEnvironment(),
    mode: 'shadow',
    online: true,
    dependencies: dependencies(),
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.evidence, {
    providerReadsAttempted: 2,
    dnsReadsAttempted: 3,
    deploymentReadsAttempted: 2,
    providerWritesAttempted: 0,
    emailsSent: 0,
  });
});

test('provider, DNS, and deployment gaps remain independently visible', async () => {
  const result = await readiness.runReleaseReadiness({
    env: validEnvironment(),
    mode: 'shadow',
    online: true,
    dependencies: dependencies({
      readJson: async () => ({ data: [] }),
      resolveMx: async () => [],
      resolveTxt: async () => [],
      fetchImpl: async () => ({ status: 404 }),
    }),
  });
  assert.equal(result.ready, false);
  assert.deepEqual(
    result.checks.filter(item => item.status === 'fail').map(item => item.name),
    [
      'resend_transactional_domain',
      'resend_delivery_webhook',
      'cloudflare_email_routing_mx',
      'root_dmarc',
      'deployed_resend_webhook_route',
      'deployed_email_cron_guard',
    ],
  );
});

test('invalid API configuration blocks provider reads while DNS and deployment probes continue', async () => {
  let providerReads = 0;
  const result = await readiness.runReleaseReadiness({
    env: validEnvironment({ RESEND_API_KEY: 'replace_me' }),
    online: true,
    dependencies: dependencies({ readJson: async () => { providerReads += 1; return { data: [] }; } }),
  });
  assert.equal(providerReads, 0);
  assert.equal(result.evidence.providerReadsAttempted, 0);
  assert.equal(result.checks.find(item => item.name === 'resend_transactional_domain').detail, 'blocked_by_invalid_api_key');
});

test('CLI never falls back to shell credentials or prints secrets', () => {
  const marker = 're_shell_secret_marker';
  const missing = path.join(os.tmpdir(), 'missing-email-release-readiness.env');
  const result = spawnSync(process.execPath, [scriptPath, `--config-file=${missing}`, '--online'], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH || '', RESEND_API_KEY: marker },
    encoding: 'utf8',
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /env_file:not_found/);
  assert.match(output, /Provider reads attempted: 0/);
  assert.match(output, /Provider writes attempted: 0/);
  assert.match(output, /Emails sent: 0/);
  assert.doesNotMatch(output, new RegExp(marker));
});

test('operator implementation is read-only and contains no send or provider mutation path', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.doesNotMatch(source, /method:\s*'POST'|emails\.send|webhooks\.create|domains\.create/);
  assert.doesNotMatch(source, /process\.env/);
  assert.match(source, /providerWritesAttempted:\s*0/);
  assert.match(source, /emailsSent:\s*0/);
});
