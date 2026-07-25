const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns').promises;

const RESEND_DOMAINS_URL = 'https://api.resend.com/domains';
const RESEND_WEBHOOKS_URL = 'https://api.resend.com/webhooks';
const TRANSACTIONAL_DOMAIN = 'talentconsulting.io';
const PRODUCTION_HOST = 'talentconsulting.io';
const WEBHOOK_PATH = '/api/webhooks/resend';
const CRON_PATH = '/api/cron/email-outbox?limit=1';
const REQUIRED_RECEIPT_EVENTS = [
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.failed',
  'email.suppressed',
  'email.complained',
];

const EXPECTED_SENDERS = {
  EMAIL_FROM_SECURITY: 'TalentConsulting Security <security@talentconsulting.io>',
  EMAIL_FROM_ACCOUNT: 'TalentConsulting <account@talentconsulting.io>',
  EMAIL_FROM_BILLING: 'TalentConsulting Billing <billing@talentconsulting.io>',
  EMAIL_FROM_TACO: 'Taco at TalentConsulting <taco@talentconsulting.io>',
  EMAIL_FROM_SUPPORT: 'TalentConsulting Support <support@talentconsulting.io>',
  EMAIL_FROM_OPERATIONS: 'TalentConsulting Operations <operations@talentconsulting.io>',
  EMAIL_FROM_MARKETING: 'TalentConsulting <updates@news.talentconsulting.io>',
};

function parseDotEnv(source) {
  const env = {};
  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    env[match[1]] = value;
  }
  return env;
}

function readEnvFile(selectedPath) {
  if (!selectedPath) return { env: null, error: 'env_file:not_selected' };
  const resolved = path.resolve(selectedPath);
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return { env: null, error: 'env_file:not_regular' };
    if (stat.size > 256 * 1024) return { env: null, error: 'env_file:too_large' };
    return { env: parseDotEnv(fs.readFileSync(resolved, 'utf8')), error: null };
  } catch {
    return { env: null, error: 'env_file:not_found' };
  }
}

function check(name, passed, detail) {
  return { name, status: passed ? 'pass' : 'fail', detail };
}

function operational(value, options = {}) {
  const normalized = String(value || '').trim();
  const minLength = options.minLength || 1;
  if (normalized.length < minLength) return false;
  if (options.prefix && !normalized.startsWith(options.prefix)) return false;
  return !/(?:your[_-]?|replace[_-]?|change[_-]?me|placeholder|example|todo|xxxx|\$\{)/i.test(normalized);
}

function validEmail(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || '').trim());
}

function senderContractReady(env) {
  return Object.entries(EXPECTED_SENDERS).every(([key, expected]) => env[key] === expected);
}

function privateOpsDestinationReady(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!validEmail(normalized)) return false;
  return !new Set([
    'support@talentconsulting.io',
    'ops@talentconsulting.io',
    'dmarc@talentconsulting.io',
    'operations@talentconsulting.io',
  ]).has(normalized);
}

function runConfigurationChecks(env, mode = 'shadow') {
  const checks = [];
  checks.push(check(
    'resend_api_key',
    operational(env.RESEND_API_KEY, { prefix: 're_', minLength: 12 }),
    operational(env.RESEND_API_KEY, { prefix: 're_', minLength: 12 }) ? 'configured' : 'missing_or_placeholder',
  ));
  checks.push(check(
    'resend_webhook_secret',
    operational(env.RESEND_WEBHOOK_SECRET, { prefix: 'whsec_', minLength: 16 }),
    operational(env.RESEND_WEBHOOK_SECRET, { prefix: 'whsec_', minLength: 16 }) ? 'configured' : 'missing_or_placeholder',
  ));
  checks.push(check(
    'sender_contract',
    senderContractReady(env),
    senderContractReady(env) ? 'all_transactional_and_reserved_senders_exact' : 'sender_value_missing_or_drifted',
  ));

  const repliesReady = env.EMAIL_SUPPORT_REPLY_TO === 'support@talentconsulting.io'
    && env.EMAIL_OPS_REPLY_TO === 'ops@talentconsulting.io';
  checks.push(check('reply_routing', repliesReady, repliesReady ? 'support_and_ops_exact' : 'reply_address_missing_or_drifted'));
  checks.push(check(
    'private_ops_destination',
    privateOpsDestinationReady(env.EMAIL_OPS_DESTINATION),
    privateOpsDestinationReady(env.EMAIL_OPS_DESTINATION) ? 'configured' : 'missing_invalid_or_public_alias',
  ));

  const secretValues = [env.EMAIL_UNSUBSCRIBE_SECRET, env.ACCOUNT_ACTION_SECRET, env.CRON_SECRET];
  const strongSecrets = secretValues.every(value => operational(value, { minLength: 32 }));
  const distinctSecrets = new Set(secretValues.map(value => String(value || '').trim())).size === secretValues.length;
  checks.push(check(
    'application_signing_secrets',
    strongSecrets && distinctSecrets,
    strongSecrets && distinctSecrets ? 'strong_and_distinct' : 'missing_placeholder_short_or_reused',
  ));

  const authOriginReady = env.EMAIL_AUTH_ACTION_ORIGIN === 'https://talentconsulting.io';
  checks.push(check('auth_action_origin', authOriginReady, authOriginReady ? 'production_origin_exact' : 'origin_missing_or_drifted'));

  const expectedV2 = mode === 'cutover' ? 'true' : 'false';
  const flagsReady = env.EMAIL_SYSTEM_V2_ENABLED === expectedV2
    && env.EMAIL_MARKETING_ENABLED === 'false'
    && String(env.EMAIL_MAILING_ADDRESS || '').trim() === '';
  checks.push(check(
    'release_flags',
    flagsReady,
    flagsReady ? `${mode}_mode_and_marketing_disabled` : 'transactional_or_marketing_gate_mismatch',
  ));
  return checks;
}

async function getJson(url, headers, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json', ...headers },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function listData(payload) {
  return payload && Array.isArray(payload.data) ? payload.data : null;
}

async function runProviderChecks(env, productionHost, dependencies = {}) {
  const readJson = dependencies.readJson || ((url, headers) => getJson(url, headers, dependencies.fetchImpl));
  const headers = { authorization: `Bearer ${env.RESEND_API_KEY}` };
  const [domainPayload, webhookPayload] = await Promise.all([
    readJson(RESEND_DOMAINS_URL, headers).catch(() => null),
    readJson(RESEND_WEBHOOKS_URL, headers).catch(() => null),
  ]);
  const domains = listData(domainPayload);
  const webhooks = listData(webhookPayload);
  const domain = domains?.find(item => String(item?.name || '').toLowerCase() === TRANSACTIONAL_DOMAIN);
  const domainReady = Boolean(
    domain
    && domain.status === 'verified'
    && (!domain.capabilities || domain.capabilities.sending === 'enabled'),
  );

  const expectedEndpoint = `https://${productionHost}${WEBHOOK_PATH}`;
  const matchingWebhooks = webhooks?.filter(item => item?.endpoint === expectedEndpoint) || [];
  const webhook = matchingWebhooks.length === 1 ? matchingWebhooks[0] : null;
  const events = new Set(Array.isArray(webhook?.events) ? webhook.events : []);
  const webhookReady = Boolean(
    webhook
    && webhook.status === 'enabled'
    && REQUIRED_RECEIPT_EVENTS.every(event => events.has(event)),
  );

  return [
    check('resend_transactional_domain', domainReady, domainReady ? 'verified_and_sending_enabled' : 'missing_pending_or_sending_disabled'),
    check(
      'resend_delivery_webhook',
      webhookReady,
      webhookReady
        ? 'single_enabled_endpoint_with_all_receipt_events'
        : matchingWebhooks.length > 1 ? 'duplicate_endpoint_records' : 'missing_disabled_or_incomplete',
    ),
  ];
}

async function safeResolve(resolver, hostname) {
  try {
    return await resolver(hostname);
  } catch {
    return null;
  }
}

async function runDnsChecks(dependencies = {}) {
  const resolveMx = dependencies.resolveMx || dns.resolveMx;
  const resolveTxt = dependencies.resolveTxt || dns.resolveTxt;
  const resolveNs = dependencies.resolveNs || dns.resolveNs;
  const [mxRecords, txtRecords, nameServers] = await Promise.all([
    safeResolve(resolveMx, 'talentconsulting.io'),
    safeResolve(resolveTxt, '_dmarc.talentconsulting.io'),
    safeResolve(resolveNs, 'talentconsulting.io'),
  ]);
  const cloudflareMxReady = Array.isArray(mxRecords)
    && mxRecords.length > 0
    && mxRecords.every(record => String(record.exchange || '').toLowerCase().endsWith('.mx.cloudflare.net'));
  const dmarc = Array.isArray(txtRecords) ? txtRecords.flat().join('') : '';
  const dmarcReady = /^v=dmarc1;/i.test(dmarc)
    && /(?:^|;)\s*p=(?:none|quarantine|reject)(?:;|$)/i.test(dmarc)
    && /rua=mailto:dmarc@talentconsulting\.io/i.test(dmarc);
  const cloudflareNsReady = Array.isArray(nameServers)
    && nameServers.length >= 2
    && nameServers.every(server => String(server).toLowerCase().endsWith('.ns.cloudflare.com'));
  return [
    check('cloudflare_authoritative_dns', cloudflareNsReady, cloudflareNsReady ? 'cloudflare_nameservers_active' : 'nameservers_not_confirmed'),
    check('cloudflare_email_routing_mx', cloudflareMxReady, cloudflareMxReady ? 'root_inbound_mx_active' : 'root_inbound_mx_missing_or_mixed'),
    check('root_dmarc', dmarcReady, dmarcReady ? 'policy_and_aggregate_destination_present' : 'record_missing_or_incomplete'),
  ];
}

async function probeStatus(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    return response.status;
  } catch {
    return null;
  }
}

async function runDeploymentChecks(productionHost, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const webhookStatus = await probeStatus(fetchImpl, `https://${productionHost}${WEBHOOK_PATH}`);
  const cronStatus = await probeStatus(fetchImpl, `https://${productionHost}${CRON_PATH}`);
  return [
    check('deployed_resend_webhook_route', webhookStatus === 405, webhookStatus === 405 ? 'post_only_route_present' : `unexpected_status_${webhookStatus ?? 'unreachable'}`),
    check('deployed_email_cron_guard', cronStatus === 401, cronStatus === 401 ? 'route_present_and_unauthorized_without_secret' : `unexpected_status_${cronStatus ?? 'unreachable'}`),
  ];
}

async function runReleaseReadiness({ env, mode = 'shadow', online = false, productionHost = PRODUCTION_HOST, dependencies = {} }) {
  const checks = runConfigurationChecks(env, mode);
  let providerReadsAttempted = 0;
  let dnsReadsAttempted = 0;
  let deploymentReadsAttempted = 0;
  if (online && checks.find(item => item.name === 'resend_api_key')?.status === 'pass') {
    checks.push(...await runProviderChecks(env, productionHost, dependencies));
    providerReadsAttempted = 2;
  } else if (online) {
    checks.push(check('resend_transactional_domain', false, 'blocked_by_invalid_api_key'));
    checks.push(check('resend_delivery_webhook', false, 'blocked_by_invalid_api_key'));
  }
  if (online) {
    checks.push(...await runDnsChecks(dependencies));
    checks.push(...await runDeploymentChecks(productionHost, dependencies));
    dnsReadsAttempted = 3;
    deploymentReadsAttempted = 2;
  }
  return {
    ready: checks.every(item => item.status === 'pass'),
    mode,
    checks,
    evidence: {
      providerReadsAttempted,
      dnsReadsAttempted,
      deploymentReadsAttempted,
      providerWritesAttempted: 0,
      emailsSent: 0,
    },
  };
}

function parseArgs(argv) {
  const options = { envFile: '.env.production', mode: 'shadow', online: false, productionHost: PRODUCTION_HOST };
  for (const argument of argv) {
    if (argument === '--online') options.online = true;
    else if (argument.startsWith('--config-file=')) options.envFile = argument.slice('--config-file='.length);
    else if (argument.startsWith('--mode=')) options.mode = argument.slice('--mode='.length);
    else if (argument.startsWith('--production-host=')) options.productionHost = argument.slice('--production-host='.length).toLowerCase();
  }
  if (!['shadow', 'cutover'].includes(options.mode)) throw new Error('mode:invalid');
  if (!/^[a-z0-9.-]+$/.test(options.productionHost)) throw new Error('production_host:invalid');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selected = readEnvFile(options.envFile);
  if (!selected.env) {
    process.stderr.write(`Email release readiness blocked: ${selected.error}\n`);
    process.stderr.write('Provider reads attempted: 0\nProvider writes attempted: 0\nEmails sent: 0\n');
    process.exitCode = 1;
    return;
  }
  const result = await runReleaseReadiness({ env: selected.env, ...options });
  for (const item of result.checks) {
    process.stdout.write(`${item.status.toUpperCase()} ${item.name}: ${item.detail}\n`);
  }
  process.stdout.write(`Provider reads attempted: ${result.evidence.providerReadsAttempted}\n`);
  process.stdout.write(`DNS reads attempted: ${result.evidence.dnsReadsAttempted}\n`);
  process.stdout.write(`Deployment reads attempted: ${result.evidence.deploymentReadsAttempted}\n`);
  process.stdout.write('Provider writes attempted: 0\nEmails sent: 0\n');
  if (!result.ready) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    const detail = error instanceof Error && /^(?:mode|production_host):/.test(error.message)
      ? error.message
      : 'unexpected_failure';
    process.stderr.write(`Email release readiness failed: ${detail}\n`);
    process.stderr.write('Provider writes attempted: 0\nEmails sent: 0\n');
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_SENDERS,
  REQUIRED_RECEIPT_EVENTS,
  RESEND_DOMAINS_URL,
  RESEND_WEBHOOKS_URL,
  TRANSACTIONAL_DOMAIN,
  parseArgs,
  parseDotEnv,
  privateOpsDestinationReady,
  runConfigurationChecks,
  runDeploymentChecks,
  runDnsChecks,
  runProviderChecks,
  runReleaseReadiness,
};
