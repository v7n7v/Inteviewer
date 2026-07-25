const fs = require('node:fs');
const path = require('node:path');

function parseDotEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function normalizeHost(value) {
  const host = String(value || '').trim().toLowerCase();
  return host && !host.includes('/') && !host.includes(':') ? host : null;
}

function check(name, status, detail) {
  return { name, status, detail };
}

async function fetchJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  let body = null;
  try { body = await response.json(); } catch { /* response shape is checked below */ }
  return { response, body };
}

async function runPreflight({
  env,
  fetchImpl = global.fetch,
  online = false,
  productionHost = 'talentconsulting.io',
  requireSameOriginRedirect = false,
}) {
  const checks = [];
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];
  const missing = required.filter((key) => !env[key]);
  checks.push(check(
    'firebase_config',
    missing.length ? 'fail' : 'pass',
    missing.length ? `missing:${missing.join(',')}` : 'required_public_config_present',
  ));

  const authDomain = normalizeHost(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const canonicalHost = normalizeHost(productionHost);
  checks.push(check('auth_domain_format', authDomain ? 'pass' : 'fail', authDomain || 'invalid_hostname'));
  checks.push(check(
    'google_ui_enabled',
    env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'false' ? 'fail' : 'pass',
    env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'false' ? 'google_ui_disabled' : 'google_ui_enabled',
  ));

  const sameOriginReady = Boolean(authDomain && canonicalHost && authDomain === canonicalHost);
  checks.push(check(
    'production_redirect_mode',
    sameOriginReady ? 'pass' : requireSameOriginRedirect ? 'fail' : 'warn',
    sameOriginReady ? 'same_origin_redirect_ready' : 'popup_only_until_custom_auth_domain_is_configured',
  ));

  const mfaUiEnabled = env.NEXT_PUBLIC_MFA_ENABLED === 'true';
  const mfaProjectAssertion = env.FIREBASE_MFA_PROJECT_ENABLED;
  if (mfaProjectAssertion === 'true' || mfaProjectAssertion === 'false') {
    const mfaProjectEnabled = mfaProjectAssertion === 'true';
    checks.push(check(
      'mfa_readiness',
      mfaProjectEnabled === mfaUiEnabled ? 'pass' : 'fail',
      mfaProjectEnabled === mfaUiEnabled ? 'ui_matches_project_assertion' : 'ui_project_mismatch',
    ));
  } else {
    checks.push(check(
      'mfa_readiness',
      'fail',
      'missing_FIREBASE_MFA_PROJECT_ENABLED_assertion',
    ));
  }

  if (!online || missing.length || !authDomain || !canonicalHost) return checks;

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  try {
    const { response, body } = await fetchJson(
      fetchImpl,
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(apiKey)}`,
    );
    const domains = Array.isArray(body?.authorizedDomains) ? body.authorizedDomains : [];
    const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const expectedDomains = [
      'localhost',
      '127.0.0.1',
      canonicalHost,
      authDomain,
      `${projectId}.firebaseapp.com`,
      `${projectId}.web.app`,
    ];
    const absentDomains = expectedDomains.filter((domain) => !domains.includes(domain));
    checks.push(check(
      'authorized_domains',
      response.ok && !absentDomains.length ? 'pass' : 'fail',
      response.ok ? (absentDomains.length ? `missing:${absentDomains.join(',')}` : 'required_domains_authorized') : `http_${response.status}`,
    ));

    const appProjectNumber = String(env.NEXT_PUBLIC_FIREBASE_APP_ID).split(':')[1] || '';
    checks.push(check(
      'project_identity',
      response.ok && body?.projectId === appProjectNumber ? 'pass' : 'fail',
      response.ok && body?.projectId === appProjectNumber ? 'app_id_matches_project_number' : 'app_id_project_mismatch',
    ));
  } catch {
    checks.push(check('authorized_domains', 'fail', 'network_or_invalid_response'));
    checks.push(check('project_identity', 'fail', 'not_verified'));
  }

  try {
    const { response, body } = await fetchJson(
      fetchImpl,
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: 'google.com', continueUri: `https://${canonicalHost}` }),
      },
    );
    checks.push(check(
      'google_provider',
      response.ok && body?.providerId === 'google.com' ? 'pass' : 'fail',
      response.ok && body?.providerId === 'google.com' ? 'google_provider_available' : `http_${response.status}`,
    ));
  } catch {
    checks.push(check('google_provider', 'fail', 'network_or_invalid_response'));
  }

  try {
    const { response, body } = await fetchJson(
      fetchImpl,
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: `firebase-auth-preflight-${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}@invalid.invalid`,
          password: 'firebase-auth-preflight-not-a-credential',
          returnSecureToken: false,
        }),
      },
    );
    const message = String(body?.error?.message || '').split(' : ')[0];
    const enabledSignals = new Set([
      'EMAIL_NOT_FOUND',
      'INVALID_LOGIN_CREDENTIALS',
      'INVALID_PASSWORD',
      'USER_DISABLED',
    ]);
    const providerEnabled = enabledSignals.has(message);
    checks.push(check(
      'email_password_provider',
      providerEnabled ? 'pass' : 'fail',
      providerEnabled
        ? 'email_password_provider_available'
        : message === 'OPERATION_NOT_ALLOWED' ? 'email_password_provider_disabled' : `http_${response.status}`,
    ));
  } catch {
    checks.push(check('email_password_provider', 'fail', 'network_or_invalid_response'));
  }

  try {
    const response = await fetchImpl(`https://${authDomain}/__/auth/handler`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const helperBody = await response.text();
    const hasFirebaseHelperSignature = /fireauth\.oauthhelper|<script[^>]+src=["']handler\.js["']/i.test(helperBody);
    checks.push(check(
      'auth_helper',
      response.status >= 200 && response.status < 400 && hasFirebaseHelperSignature ? 'pass' : 'fail',
      response.status >= 200 && response.status < 400 && hasFirebaseHelperSignature
        ? 'firebase_auth_helper_verified'
        : response.status >= 200 && response.status < 400 ? 'missing_firebase_helper_signature' : `http_${response.status}`,
    ));
  } catch {
    checks.push(check('auth_helper', 'fail', 'network_or_invalid_response'));
  }

  return checks;
}

function parseArgs(argv) {
  const options = {
    online: false,
    productionHost: 'talentconsulting.io',
    requireSameOriginRedirect: false,
    envFile: null,
  };
  for (const argument of argv) {
    if (argument === '--online') options.online = true;
    else if (argument === '--require-same-origin-redirect') options.requireSameOriginRedirect = true;
    else if (argument.startsWith('--production-host=')) options.productionHost = argument.slice(18);
    else if (argument.startsWith('--env-file=')) options.envFile = argument.slice(11);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let env = { ...process.env };
  if (options.envFile) {
    const resolved = path.resolve(options.envFile);
    env = { ...env, ...parseDotEnv(fs.readFileSync(resolved, 'utf8')) };
  }
  const checks = await runPreflight({ env, ...options });
  for (const item of checks) {
    process.stdout.write(`${item.status.toUpperCase()} ${item.name}: ${item.detail}\n`);
  }
  if (checks.some((item) => item.status === 'fail')) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write('Firebase auth preflight failed before checks completed.\n');
    process.exitCode = 1;
  });
}

module.exports = { normalizeHost, parseArgs, parseDotEnv, runPreflight };
