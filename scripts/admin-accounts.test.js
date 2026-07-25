const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');
const { parseArgs } = require('./admin-account-provision');
const { parseArgs: parseSmokeArgs, productionOrigin } = require('./admin-production-smoke');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function loadPermissionsRuntime() {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'tc-admin-test-'));
  const outfile = path.join(directory, 'permissions.cjs');
  buildSync({
    entryPoints: [path.join(repoRoot, 'lib', 'admin-permissions.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const runtime = require(outfile);
  const resolved = path.resolve(directory);
  assert.ok(resolved.startsWith(`${temporaryRoot}${path.sep}`));
  assert.ok(path.basename(resolved).startsWith('tc-admin-test-'));
  fs.rmSync(resolved, { recursive: true, force: true });
  return runtime;
}

const permissions = loadPermissionsRuntime();

function alignedIdentity(overrides = {}) {
  return {
    claims: { admin: true, adminRole: 'administrator', adminVersion: 3 },
    record: {
      uid: 'firebase-user-1',
      email: 'admin@talentconsulting.io',
      displayName: 'Admin',
      role: 'administrator',
      status: 'active',
      version: 3,
      requireMfa: true,
      createdAt: '2026-07-23T00:00:00.000Z',
      createdBy: 'owner@talentconsulting.io',
      updatedAt: '2026-07-23T00:00:00.000Z',
      updatedBy: 'owner@talentconsulting.io',
    },
    tokenEmail: 'admin@talentconsulting.io',
    emailVerified: true,
    mfaSatisfied: true,
    enforceMfa: true,
    ...overrides,
  };
}

test('role matrix preserves owner-only account management', () => {
  assert.equal(permissions.hasAdminPermission('owner', 'admin.accounts.manage'), true);
  assert.equal(permissions.hasAdminPermission('administrator', 'admin.accounts.manage'), false);
  assert.equal(permissions.hasAdminPermission('billing_admin', 'billing.manage'), true);
  assert.equal(permissions.hasAdminPermission('billing_admin', 'settings.manage'), false);
  assert.equal(permissions.hasAdminPermission('support_admin', 'email.send'), true);
  assert.equal(permissions.hasAdminPermission('analyst', 'users.read'), false);
});

test('admin identity is granted only when verified token claims and record align', () => {
  const result = permissions.evaluateAdminIdentity(alignedIdentity());
  assert.equal(result.allowed, true);
  assert.equal(result.role, 'administrator');
});

test('admin identity denies missing claims or missing server record', () => {
  const claimsMissing = permissions.evaluateAdminIdentity(alignedIdentity({ claims: {} }));
  assert.deepEqual(claimsMissing, { allowed: false, reason: 'claims_missing' });

  const recordMissing = permissions.evaluateAdminIdentity(alignedIdentity({ record: null }));
  assert.deepEqual(recordMissing, { allowed: false, reason: 'record_missing' });
});

test('admin identity denies inactive, mismatched, stale, and non-MFA sessions', () => {
  const suspended = permissions.evaluateAdminIdentity(alignedIdentity({
    record: { ...alignedIdentity().record, status: 'suspended' },
  }));
  assert.deepEqual(suspended, { allowed: false, reason: 'record_inactive' });

  const mismatch = permissions.evaluateAdminIdentity(alignedIdentity({
    tokenEmail: 'different@talentconsulting.io',
  }));
  assert.deepEqual(mismatch, { allowed: false, reason: 'identity_mismatch' });

  const stale = permissions.evaluateAdminIdentity(alignedIdentity({
    claims: { admin: true, adminRole: 'administrator', adminVersion: 2 },
  }));
  assert.deepEqual(stale, { allowed: false, reason: 'version_mismatch' });

  const noMfa = permissions.evaluateAdminIdentity(alignedIdentity({ mfaSatisfied: false }));
  assert.deepEqual(noMfa, { allowed: false, reason: 'mfa_required' });
});

test('owner bootstrap defaults to dry-run and apply requires matching confirmation', () => {
  const dryRun = parseArgs(['--email=Owner@TalentConsulting.io']);
  assert.equal(dryRun.email, 'owner@talentconsulting.io');
  assert.equal(dryRun.apply, false);
  assert.equal(dryRun.role, 'owner');

  assert.throws(
    () => parseArgs(['--email=owner@talentconsulting.io', '--apply']),
    /requires_--bootstrap-owner/,
  );
  assert.throws(
    () => parseArgs([
      '--email=owner@talentconsulting.io',
      '--apply',
      '--bootstrap-owner',
      '--confirm=someone@talentconsulting.io',
    ]),
    /confirm_must_match_email/,
  );

  const apply = parseArgs([
    '--email=owner@talentconsulting.io',
    '--apply',
    '--bootstrap-owner',
    '--confirm=owner@talentconsulting.io',
  ]);
  assert.equal(apply.apply, true);
  assert.equal(apply.bootstrapOwner, true);
});

test('production smoke is dry-run by default and restricted to approved HTTPS hosts', () => {
  const dryRun = parseSmokeArgs(['--email=owner@talentconsulting.io']);
  assert.equal(dryRun.online, false);
  assert.equal(dryRun.origin, 'https://talentconsulting.io');
  assert.equal(
    productionOrigin('https://talent-consulting-acf16.web.app/'),
    'https://talent-consulting-acf16.web.app',
  );
  assert.throws(() => productionOrigin('http://talentconsulting.io/'), /approved_https/);
  assert.throws(() => productionOrigin('https://talentconsulting.io.evil.test/'), /approved_https/);
  assert.throws(() => productionOrigin('https://talentconsulting.io/path'), /approved_https/);
  const source = fs.readFileSync(path.join(repoRoot, 'scripts/admin-production-smoke.js'), 'utf8');
  assert.match(source, /ADMIN_SMOKE_MFA_ID_TOKEN/);
  assert.match(source, /sign_in_second_factor/);
});

test('admin surfaces contain no email-address authorization bypass', () => {
  const protectedSources = [
    'components/SuiteSidebar.tsx',
    'app/suite/admin/page.tsx',
    'app/api/admin/session/route.ts',
    'app/api/admin/accounts/route.ts',
    'app/api/admin/accounts/[uid]/route.ts',
    'app/api/admin/audit/route.ts',
    'lib/admin-billing-auth.ts',
  ].map(read).join('\n');

  assert.doesNotMatch(protectedSources, /alula2006@gmail\.com/i);
  assert.doesNotMatch(protectedSources, /isMasterAccount/);
  assert.match(read('components/SuiteSidebar.tsx'), /authFetch\('\/api\/admin\/session'/);
  assert.match(read('lib/admin-auth.ts'), /verifyIdToken\(tokenValue,\s*true\)/);
  assert.match(read('lib/admin-auth.ts'), /collection\('admin_accounts'\)/);
  assert.match(read('proxy.ts'), /Cache-Control', 'private, no-store, max-age=0'/);
});

test('privileged account collections deny all Firebase client access', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /match \/admin_accounts\/\{document=\*\*\}[\s\S]*?allow read, write: if false;/);
  assert.match(rules, /match \/admin_audit_log\/\{document=\*\*\}[\s\S]*?allow read, write: if false;/);
});

test('admin invitation is a registered transactional security event', () => {
  assert.match(read('lib/email/contracts.ts'), /'security\.admin_invitation'/);
  assert.match(read('lib/email/catalog.ts'), /'security\.admin_invitation': template\(/);
  assert.match(read('lib/admin-accounts.ts'), /revokeRefreshTokens/);
  assert.match(read('lib/admin-accounts.ts'), /setCustomUserClaims/);
});
