const DEFAULT_BASE_URL = 'https://talentconsulting.io';
const REQUIRED_WINDOWS = [7, 30, 90];
const MAX_RECEIPT_AGE_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;
const ALLOWED_PRODUCTION_HOSTS = new Set([
  'talentconsulting.io',
  'www.talentconsulting.io',
  'talent-consulting-acf16.web.app',
]);

function approvedAggregateOrigin(value) {
  const parsed = new URL(String(value || '').trim());
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
    || !ALLOWED_PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    throw new Error('ADMIN_AGGREGATE_BASE_URL must be an approved HTTPS production origin.');
  }
  return parsed.origin;
}

function validateAdminAggregateReceipt(payload, now = Date.now()) {
  if (!payload || payload.success !== true) {
    throw new Error('Admin aggregate materialization did not return a success receipt.');
  }
  if (payload.skipped) {
    throw new Error('Admin aggregate materialization is already running.');
  }
  const generatedAt = Date.parse(String(payload.generatedAt || ''));
  if (!Number.isFinite(generatedAt) || generatedAt > now + 30_000 || now - generatedAt > MAX_RECEIPT_AGE_MS) {
    throw new Error('Admin aggregate materialization returned a stale or invalid generatedAt value.');
  }
  const windows = Array.isArray(payload.windows)
    ? [...payload.windows].sort((left, right) => left - right)
    : [];
  if (JSON.stringify(windows) !== JSON.stringify(REQUIRED_WINDOWS)) {
    throw new Error('Admin aggregate materialization did not refresh every required finance window.');
  }
  if (payload.providerWritesPerformed !== false) {
    throw new Error('Admin aggregate materialization violated its read-only provider contract.');
  }
  if (Number(payload.observabilityResets?.failed || 0) > 0) {
    throw new Error('The observability reset worker reported a failed or unavailable job.');
  }
  if (Number(payload.observabilityResets?.overdue || 0) > 0) {
    throw new Error('One or more observability resets exceeded the 24-hour completion SLA.');
  }
  return {
    generatedAt: new Date(generatedAt).toISOString(),
    partial: payload.partial === true,
    windows,
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function primeAdminAggregates(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const secret = String(options.secret || process.env.CRON_SECRET || '').trim();
  const baseUrl = approvedAggregateOrigin(
    options.baseUrl || process.env.ADMIN_AGGREGATE_BASE_URL || DEFAULT_BASE_URL,
  );
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable in this Node runtime.');
  if (secret.length < 32) throw new Error('CRON_SECRET must contain at least 32 characters.');

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${baseUrl}/api/cron/admin-aggregates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok && response.status !== 202) {
        throw new Error(`Admin aggregate materialization failed with HTTP ${response.status}.`);
      }
      const receipt = validateAdminAggregateReceipt(payload);
      return receipt;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS && /already running/i.test(String(error?.message || error))) {
        await wait(attempt * 2_000);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('Admin aggregate materialization failed.');
}

async function main() {
  const receipt = await primeAdminAggregates();
  process.stdout.write(
    `Admin aggregate snapshots refreshed at ${receipt.generatedAt}`
      + `${receipt.partial ? ' with partial source evidence' : ''}.\n`,
  );
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  approvedAggregateOrigin,
  primeAdminAggregates,
  validateAdminAggregateReceipt,
};
