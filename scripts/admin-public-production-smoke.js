const DEFAULT_ORIGIN = 'https://talentconsulting.io';
const ALLOWED_HOSTS = new Set([
  'talentconsulting.io',
  'www.talentconsulting.io',
  'talent-consulting-acf16.web.app',
]);

function approvedOrigin(value) {
  const url = new URL(String(value || DEFAULT_ORIGIN));
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.port
    || url.pathname !== '/'
    || url.search
    || url.hash
    || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error('An approved HTTPS production origin is required.');
  }
  return url.origin;
}

async function request(url, accept = 'application/json') {
  const response = await fetch(url, {
    headers: { Accept: accept },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  return response;
}

async function runPublicProductionSmoke(options = {}) {
  const origin = approvedOrigin(options.origin || process.env.ADMIN_PRODUCTION_ORIGIN);
  const fetchImpl = options.fetchImpl || request;
  const health = await fetchImpl(`${origin}/api/health`);
  if (health.status !== 200) throw new Error(`Production health returned HTTP ${health.status}.`);

  for (const route of ['/', '/suite/admin']) {
    const response = await fetchImpl(`${origin}${route}`, 'text/html');
    if (response.status !== 200) throw new Error(`${route} returned HTTP ${response.status}.`);
    if (!String(response.headers.get('content-type') || '').includes('text/html')) {
      throw new Error(`${route} did not return HTML.`);
    }
    if (String(response.headers.get('x-frame-options') || '').toUpperCase() !== 'DENY') {
      throw new Error(`${route} is missing frame protection.`);
    }
  }

  for (const route of [
    '/api/admin/session',
    '/api/admin/stats',
    '/api/admin/costs',
    '/api/stripe/checkout/status',
    '/api/agent/harness/preflight',
  ]) {
    const response = await fetchImpl(`${origin}${route}`);
    if (response.status !== 401) throw new Error(`${route} did not fail closed for anonymous access.`);
    if (!/private|no-store/i.test(String(response.headers.get('cache-control') || ''))) {
      throw new Error(`${route} is missing private no-store cache protection.`);
    }
  }
  return { origin, status: 'passed' };
}

async function main() {
  const result = await runPublicProductionSmoke();
  process.stdout.write(`Admin public production smoke passed for ${result.origin}.\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  approvedOrigin,
  runPublicProductionSmoke,
};
