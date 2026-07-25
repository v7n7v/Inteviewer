const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const ALLOWED_PRODUCTION_HOSTS = new Set([
  'talentconsulting.io',
  'www.talentconsulting.io',
  'talent-consulting-acf16.web.app',
]);

function validEmail(value) {
  return /^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/.test(String(value || '').trim());
}

function productionOrigin(value) {
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
    throw new Error('origin:approved_https_production_origin_required');
  }
  return parsed.origin;
}

function parseArgs(argv) {
  const options = {
    origin: 'https://talentconsulting.io',
    email: String(process.env.ADMIN_SMOKE_OWNER_EMAIL || '').trim().toLowerCase(),
    online: false,
  };
  for (const argument of argv) {
    if (argument === '--online') options.online = true;
    else if (argument.startsWith('--origin=')) options.origin = productionOrigin(argument.slice(9));
    else if (argument.startsWith('--email=')) options.email = argument.slice(8).trim().toLowerCase();
    else throw new Error(`argument:unknown:${argument}`);
  }
  options.origin = productionOrigin(options.origin);
  if (!validEmail(options.email)) throw new Error('email:valid_address_required');
  return options;
}

function loadFirebaseRuntime() {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'tc-admin-smoke-'));
  const outfile = path.join(directory, 'runtime.cjs');
  buildSync({
    stdin: {
      contents: "export { getAdminAuth } from './lib/firebase-admin';",
      resolveDir: repoRoot,
      sourcefile: 'admin-smoke-runtime.ts',
      loader: 'ts',
    },
    absWorkingDir: repoRoot,
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    logLevel: 'silent',
  });
  return {
    runtime: require(outfile),
    cleanup: () => {
      const resolved = path.resolve(directory);
      const owned = resolved.startsWith(`${temporaryRoot}${path.sep}`)
        && path.basename(resolved).startsWith('tc-admin-smoke-');
      if (!owned) throw new Error('temporary_cleanup:unsafe_path');
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}

async function jsonResponse(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function mintOwnerIdToken(email, runtime) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('firebase:public_api_key_missing');
  const user = await runtime.getAdminAuth().getUserByEmail(email);
  if (!user.emailVerified || user.disabled) throw new Error('firebase:owner_account_not_active_and_verified');
  const customToken = await runtime.getAdminAuth().createCustomToken(user.uid, {
    productionAdminSmoke: true,
  });
  const { response, body } = await jsonResponse(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!response.ok || typeof body?.idToken !== 'string') {
    throw new Error(`firebase:custom_token_exchange_failed:http_${response.status}`);
  }
  return body.idToken;
}

async function ownerSmokeIdToken(email, runtime) {
  if (process.env.ADMIN_MFA_ENFORCED !== 'true') {
    return mintOwnerIdToken(email, runtime);
  }
  const token = String(process.env.ADMIN_SMOKE_MFA_ID_TOKEN || '').trim();
  if (!token) throw new Error('firebase:mfa_smoke_id_token_required');
  const decoded = await runtime.getAdminAuth().verifyIdToken(token, true);
  const user = await runtime.getAdminAuth().getUser(decoded.uid);
  const secondFactor = decoded.firebase?.sign_in_second_factor;
  if (
    user.email?.toLowerCase() !== email
    || user.disabled
    || !user.emailVerified
    || typeof secondFactor !== 'string'
    || !secondFactor
  ) {
    throw new Error('firebase:mfa_smoke_token_not_owner_bound');
  }
  return token;
}

function assert(condition, message) {
  if (!condition) throw new Error(`smoke:${message}`);
}

async function runOnlineSmoke(options, runtime) {
  const health = await jsonResponse(`${options.origin}/api/health`, { cache: 'no-store' });
  assert(health.response.status === 200 && health.body?.status === 'ok', 'health_check_failed');

  const page = await fetch(`${options.origin}/suite/admin`, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  assert(page.status === 200, `admin_page_http_${page.status}`);
  assert(String(page.headers.get('content-type')).includes('text/html'), 'admin_page_not_html');
  assert(String(page.headers.get('x-frame-options')).toUpperCase() === 'DENY', 'admin_page_frame_protection_missing');

  const unauthorized = await jsonResponse(`${options.origin}/api/admin/session`, { cache: 'no-store' });
  assert(unauthorized.response.status === 401, `anonymous_session_http_${unauthorized.response.status}`);
  assert(
    unauthorized.body?.code === 'admin_auth_required'
      || unauthorized.body?.error === 'Authentication required. Please sign in.',
    'anonymous_session_did_not_fail_closed',
  );

  const idToken = await ownerSmokeIdToken(options.email, runtime);
  const headers = { Authorization: `Bearer ${idToken}` };
  const session = await jsonResponse(`${options.origin}/api/admin/session`, { headers, cache: 'no-store' });
  assert(session.response.status === 200, `owner_session_http_${session.response.status}`);
  assert(session.body?.admin?.email === options.email, 'owner_session_email_mismatch');
  assert(session.body?.admin?.role === 'owner', 'owner_session_role_mismatch');
  assert(session.body?.admin?.permissions?.includes('admin.accounts.manage'), 'owner_permission_missing');
  const expectedMfaEnforced = process.env.ADMIN_MFA_ENFORCED === 'true';
  assert(session.body?.admin?.mfaEnforced === expectedMfaEnforced, 'mfa_enforcement_posture_mismatch');

  const accounts = await jsonResponse(`${options.origin}/api/admin/accounts`, { headers, cache: 'no-store' });
  assert(accounts.response.status === 200, `accounts_http_${accounts.response.status}`);
  const owner = accounts.body?.accounts?.find(account => account.email === options.email);
  assert(owner?.role === 'owner' && owner?.status === 'active', 'owner_record_not_active');
  assert(Number.isInteger(owner?.version) && owner.version >= 1, 'owner_version_missing');

  const audit = await jsonResponse(`${options.origin}/api/admin/audit`, { headers, cache: 'no-store' });
  assert(audit.response.status === 200 && Array.isArray(audit.body?.audit), `audit_http_${audit.response.status}`);

  return {
    origin: options.origin,
    health: 'ok',
    adminPage: 'ok',
    anonymousBoundary: 'denied',
    ownerSession: 'authorized',
    ownerRole: session.body.admin.role,
    ownerRecord: owner.status,
    ownerVersion: owner.version,
    auditReadable: true,
    mfaEnforced: session.body.admin.mfaEnforced,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.online) {
    process.stdout.write(`DRY_RUN production admin smoke planned for ${options.origin}; no token minted and no requests sent.\n`);
    return;
  }
  const loaded = loadFirebaseRuntime();
  try {
    const result = await runOnlineSmoke(options, loaded.runtime);
    process.stdout.write(`ADMIN_PRODUCTION_SMOKE ${JSON.stringify(result)}\n`);
  } finally {
    loaded.cleanup();
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Admin production smoke failed: ${error instanceof Error ? error.message : 'unexpected_failure'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  productionOrigin,
  validEmail,
};
