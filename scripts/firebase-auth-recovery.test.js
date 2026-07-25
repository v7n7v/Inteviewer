const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { build } = require('esbuild');
const { runPreflight } = require('./firebase-auth-preflight');

const repoRoot = path.join(__dirname, '..');

async function bundleModule(entry, name, options = {}) {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), `tc-${name}-`));
  const outfile = path.join(outdir, `${name}.cjs`);
  await build({
    entryPoints: [path.join(repoRoot, entry)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    ...options,
  });
  return require(outfile);
}

const authFlowModule = bundleModule('lib/auth-flow.ts', 'auth-flow');
const redirectModule = bundleModule('lib/auth-redirect.ts', 'auth-redirect');

function mockFirebasePlugin() {
  const modules = {
    'firebase/app': `
      exports.initializeApp = (config) => ({ config });
      exports.getApps = () => [];
      exports.getApp = () => ({ config: {} });
    `,
    'firebase/auth': `
      const mocks = () => globalThis.__firebaseAuthMocks;
      exports.getAuth = () => ({ currentUser: null });
      exports.GoogleAuthProvider = class { setCustomParameters() {} };
      exports.createUserWithEmailAndPassword = (...args) => mocks().createUserWithEmailAndPassword(...args);
      exports.signInWithEmailAndPassword = (...args) => mocks().signInWithEmailAndPassword(...args);
      exports.signInWithPopup = (...args) => mocks().signInWithPopup(...args);
      exports.signInWithRedirect = (...args) => mocks().signInWithRedirect(...args);
      exports.getRedirectResult = (...args) => mocks().getRedirectResult(...args);
      exports.getAdditionalUserInfo = (credential) => credential.info || null;
      exports.signOut = async () => {};
      exports.verifyPasswordResetCode = (...args) => mocks().verifyPasswordResetCode(...args);
      exports.confirmPasswordReset = (...args) => mocks().confirmPasswordReset(...args);
      exports.validatePassword = (...args) => mocks().validatePassword(...args);
      exports.checkActionCode = (...args) => mocks().checkActionCode(...args);
      exports.applyActionCode = (...args) => mocks().applyActionCode(...args);
      exports.verifyBeforeUpdateEmail = async () => {};
      exports.updatePassword = async () => {};
      exports.updateProfile = (...args) => mocks().updateProfile(...args);
      exports.onAuthStateChanged = (_auth, callback) => { queueMicrotask(() => callback(null)); return () => {}; };
      exports.reauthenticateWithCredential = async () => {};
      exports.EmailAuthProvider = { credential: () => ({}) };
      exports.TotpMultiFactorGenerator = { generateSecret: async () => ({}), assertionForEnrollment: () => ({}), assertionForSignIn: () => ({}) };
      exports.multiFactor = (...args) => mocks().multiFactor(...args);
      exports.getMultiFactorResolver = () => ({});
    `,
    'firebase/firestore': `
      const mocks = () => globalThis.__firebaseAuthMocks;
      exports.getFirestore = () => ({});
      exports.doc = (...parts) => parts.join('/');
      exports.setDoc = (...args) => mocks().setDoc(...args);
      exports.getDoc = (...args) => mocks().getDoc(...args);
      exports.updateDoc = async () => {};
      exports.deleteDoc = async () => {};
      exports.collection = () => ({});
      exports.query = () => ({});
      exports.where = () => ({});
      exports.orderBy = () => ({});
      exports.getDocs = async () => ({});
      exports.addDoc = async () => ({});
      exports.serverTimestamp = () => 'timestamp';
    `,
    'firebase/storage': `exports.getStorage = () => ({});`,
  };
  return {
    name: 'firebase-auth-mocks',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^firebase\/(app|auth|firestore|storage)$/ }, (args) => ({ path: args.path, namespace: 'firebase-mock' }));
      buildApi.onLoad({ filter: /.*/, namespace: 'firebase-mock' }, (args) => ({ contents: modules[args.path], loader: 'js' }));
    },
  };
}

let firebaseModule;
async function loadFirebaseModule() {
  if (!firebaseModule) {
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'talentconsulting.io';
    firebaseModule = bundleModule('lib/firebase.ts', 'firebase-auth', { plugins: [mockFirebasePlugin()] });
  }
  return firebaseModule;
}

function installFirebaseMocks(overrides = {}) {
  const user = { uid: 'test-uid', email: 'qa@example.invalid', displayName: 'QA User', getIdToken: async () => 'redacted' };
  globalThis.__firebaseAuthMocks = {
    createUserWithEmailAndPassword: async () => ({ user }),
    signInWithEmailAndPassword: async () => ({ user }),
    signInWithPopup: async () => ({ user, info: { isNewUser: false } }),
    signInWithRedirect: async () => {},
    getRedirectResult: async () => null,
    verifyPasswordResetCode: async () => 'qa@example.invalid',
    confirmPasswordReset: async () => {},
    validatePassword: async () => ({ isValid: true, passwordPolicy: { customStrengthOptions: {} } }),
    checkActionCode: async () => ({ data: { email: 'qa@example.invalid' } }),
    applyActionCode: async () => {},
    updateProfile: async () => {},
    getDoc: async () => ({ exists: () => true }),
    setDoc: async () => {},
    multiFactor: () => ({ enrolledFactors: [], getSession: async () => ({}), enroll: async () => {}, unenroll: async () => {} }),
    ...overrides,
  };
  return user;
}

test('redirect fallback requires an exact auth-domain/hostname match', async () => {
  const { canUseSameOriginAuthRedirect } = await authFlowModule;
  assert.equal(canUseSameOriginAuthRedirect('talentconsulting.io', 'talentconsulting.io'), true);
  assert.equal(canUseSameOriginAuthRedirect('talentconsulting.io', 'www.talentconsulting.io'), false);
  assert.equal(canUseSameOriginAuthRedirect('talentconsulting.io', 'localhost'), false);
  assert.equal(canUseSameOriginAuthRedirect('https://talentconsulting.io', 'talentconsulting.io'), false);
  assert.equal(canUseSameOriginAuthRedirect('talentconsulting.io:443', 'talentconsulting.io'), false);
});

test('popup cancellation and errors are classified without exposing raw messages', async () => {
  const { isPopupCancellation, normalizeAuthError, shouldUseRedirectFallback } = await authFlowModule;
  assert.equal(isPopupCancellation({ code: 'auth/popup-closed-by-user' }), true);
  assert.equal(shouldUseRedirectFallback({ code: 'auth/popup-blocked' }), true);
  assert.equal(shouldUseRedirectFallback({ code: 'auth/popup-closed-by-user' }), false);
  assert.deepEqual(normalizeAuthError({ code: 'auth/invalid-credential', message: 'secret@example.com' }), {
    code: 'auth/invalid-credential',
    message: 'Invalid email or password.',
  });
  assert.deepEqual(normalizeAuthError({ message: 'token=do-not-log' }), {
    code: 'auth/unknown',
    message: 'Authentication could not finish. Please try again.',
  });
});

test('post-auth redirects accept local destinations and reject hostile or malformed paths', async () => {
  const { isSafeLocalPath } = await redirectModule;
  assert.equal(isSafeLocalPath('/suite/agent?pendingResume=1#target'), true);
  for (const unsafe of [
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    '/suite\n/agent',
    '/suite\u0000/agent',
    '/suite/%',
    '/suite/%2',
  ]) {
    assert.equal(isSafeLocalPath(unsafe), false, unsafe);
  }
});

test('pending redirect is tab-scoped, safe, and consumed once', async () => {
  const storage = new Map();
  global.window = {
    sessionStorage: {
      setItem: (key, value) => storage.set(key, value),
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
    },
  };
  const { setPendingAuthRedirect, consumePendingAuthRedirect } = await redirectModule;
  setPendingAuthRedirect('/suite/resume?pendingResume=1');
  assert.equal(consumePendingAuthRedirect(), '/suite/resume?pendingResume=1');
  assert.equal(consumePendingAuthRedirect(), null);
  setPendingAuthRedirect('//evil.example');
  assert.equal(consumePendingAuthRedirect(), null);
  setPendingAuthRedirect('/suite/stale');
  setPendingAuthRedirect(null);
  assert.equal(consumePendingAuthRedirect(), null);
  delete global.window;
});

test('redirect completion is skipped entirely outside the same-origin fallback host', async () => {
  const firebase = await loadFirebaseModule();
  let redirectReads = 0;
  installFirebaseMocks({ getRedirectResult: async () => { redirectReads += 1; return null; } });
  global.window = { location: { hostname: 'localhost' } };
  const result = await firebase.authHelpers.completeGoogleRedirect();
  assert.equal(result.status, 'none');
  assert.equal(redirectReads, 0);
  delete global.window;
});

test('MFA enrollment fails closed while challenge compatibility remains callable', async () => {
  const firebase = await loadFirebaseModule();
  let multiFactorCalls = 0;
  installFirebaseMocks({
    multiFactor: () => { multiFactorCalls += 1; return { enrolledFactors: [] }; },
  });
  const generated = await firebase.authHelpers.generateTOTPSecret();
  const completed = await firebase.authHelpers.completeTOTPEnrollment({}, '123456');
  assert.equal(generated.error.code, 'auth/operation-not-allowed');
  assert.equal(completed.error.code, 'auth/operation-not-allowed');
  assert.equal(multiFactorCalls, 0);
  assert.equal(typeof firebase.authHelpers.resolveTOTPSignIn, 'function');
});

test('successful signup is not converted to failure by profile bootstrap errors', async () => {
  const firebase = await loadFirebaseModule();
  const user = installFirebaseMocks({
    updateProfile: async () => { throw Object.assign(new Error('contains PII'), { code: 'auth/network-request-failed' }); },
    getDoc: async () => { throw Object.assign(new Error('contains PII'), { code: 'permission-denied' }); },
  });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await firebase.authHelpers.signUp('qa@example.invalid', 'not-a-real-password', 'QA User');
    assert.equal(result.error, null);
    assert.equal(result.data.user, user);
    assert.equal(result.data.profileBootstrap, 'scheduled');
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.warn = originalWarn;
  }
});

test('Google auth is popup-first, distinguishes new users, and only safely falls back', async () => {
  const firebase = await loadFirebaseModule();
  const user = installFirebaseMocks({ signInWithPopup: async () => ({ user, info: { isNewUser: true } }) });
  global.window = { location: { hostname: 'localhost' } };
  const success = await firebase.authHelpers.signInWithGoogle();
  assert.equal(success.status, 'success');
  assert.equal(success.isNewUser, true);

  let redirects = 0;
  installFirebaseMocks({
    signInWithPopup: async () => { throw Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' }); },
    signInWithRedirect: async () => { redirects += 1; },
  });
  const localBlocked = await firebase.authHelpers.signInWithGoogle();
  assert.equal(localBlocked.status, 'error');
  assert.equal(redirects, 0);

  global.window = { location: { hostname: 'talentconsulting.io' } };
  const sameOriginBlocked = await firebase.authHelpers.signInWithGoogle();
  assert.equal(sameOriginBlocked.status, 'redirecting');
  assert.equal(redirects, 1);

  installFirebaseMocks({
    signInWithPopup: async () => { throw Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' }); },
    signInWithRedirect: async () => { redirects += 1; },
  });
  const cancelled = await firebase.authHelpers.signInWithGoogle();
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(redirects, 1);
  delete global.window;
});

function response(status, body = null, textBody = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => textBody,
  };
}

test('online preflight verifies project, domains, Google provider, helper, and MFA gate', async () => {
  const env = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'public-test-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'project',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456:web:abcdef',
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_MFA_ENABLED: 'false',
    FIREBASE_MFA_PROJECT_ENABLED: 'false',
  };
  const fetchImpl = async (url) => {
    if (url.includes('/v1/projects?')) {
      return response(200, { projectId: '123456', authorizedDomains: ['localhost', '127.0.0.1', 'talentconsulting.io', 'project.firebaseapp.com', 'project.web.app'] });
    }
    if (url.includes('accounts:createAuthUri')) return response(200, { providerId: 'google.com' });
    if (url.includes('accounts:signInWithPassword')) return response(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
    if (url.includes('/__/auth/handler')) return response(200, null, '<script src="handler.js"></script><!-- fireauth.oauthhelper -->');
    return response(404);
  };
  const checks = await runPreflight({ env, fetchImpl, online: true });
  assert.equal(checks.some((item) => item.status === 'fail'), false);
  assert.equal(checks.find((item) => item.name === 'production_redirect_mode').status, 'warn');
  for (const name of ['authorized_domains', 'project_identity', 'google_provider', 'email_password_provider', 'auth_helper', 'mfa_readiness']) {
    assert.equal(checks.find((item) => item.name === name).status, 'pass', name);
  }
});

test('preflight rejects disabled email provider, missing local loopback and hosting alias, and handler catch-all HTML', async () => {
  const env = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'public-test-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'project',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456:web:abcdef',
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_MFA_ENABLED: 'false',
    FIREBASE_MFA_PROJECT_ENABLED: 'false',
  };
  const fetchImpl = async (url) => {
    if (url.includes('/v1/projects?')) {
      return response(200, { projectId: '123456', authorizedDomains: ['localhost', 'talentconsulting.io', 'project.firebaseapp.com'] });
    }
    if (url.includes('accounts:createAuthUri')) return response(200, { providerId: 'google.com' });
    if (url.includes('accounts:signInWithPassword')) return response(400, { error: { message: 'OPERATION_NOT_ALLOWED' } });
    if (url.includes('/__/auth/handler')) return response(200, null, '<html>application catch-all</html>');
    return response(404);
  };
  const checks = await runPreflight({ env, fetchImpl, online: true });
  assert.match(checks.find((item) => item.name === 'authorized_domains').detail, /127\.0\.0\.1/);
  assert.match(checks.find((item) => item.name === 'authorized_domains').detail, /project\.web\.app/);
  assert.equal(checks.find((item) => item.name === 'email_password_provider').detail, 'email_password_provider_disabled');
  assert.equal(checks.find((item) => item.name === 'auth_helper').detail, 'missing_firebase_helper_signature');
  assert.equal(checks.filter((item) => item.status === 'fail').length >= 3, true);
});

test('preflight fails email-provider readiness on network errors', async () => {
  const env = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'public-test-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'project',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456:web:abcdef',
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_MFA_ENABLED: 'false',
    FIREBASE_MFA_PROJECT_ENABLED: 'false',
  };
  const fetchImpl = async (url) => {
    if (url.includes('/v1/projects?')) return response(200, { projectId: '123456', authorizedDomains: ['localhost', '127.0.0.1', 'talentconsulting.io', 'project.firebaseapp.com', 'project.web.app'] });
    if (url.includes('accounts:createAuthUri')) return response(200, { providerId: 'google.com' });
    if (url.includes('accounts:signInWithPassword')) throw new Error('offline');
    if (url.includes('/__/auth/handler')) return response(200, null, 'fireauth.oauthhelper');
    return response(404);
  };
  const checks = await runPreflight({ env, fetchImpl, online: true });
  assert.equal(checks.find((item) => item.name === 'email_password_provider').detail, 'network_or_invalid_response');
});

test('preflight fails closed for unsafe readiness claims', async () => {
  const base = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'public-test-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'project',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456:web:abcdef',
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false',
    NEXT_PUBLIC_MFA_ENABLED: 'true',
  };
  const checks = await runPreflight({ env: base, requireSameOriginRedirect: true });
  assert.equal(checks.find((item) => item.name === 'google_ui_enabled').status, 'fail');
  assert.equal(checks.find((item) => item.name === 'production_redirect_mode').status, 'fail');
  assert.equal(checks.find((item) => item.name === 'mfa_readiness').status, 'fail');
  assert.equal(checks.find((item) => item.name === 'mfa_readiness').detail, 'missing_FIREBASE_MFA_PROJECT_ENABLED_assertion');
});

test('auth surfaces retain challenge support while gating enrollment and avoiding raw error logging', () => {
  const firebase = fs.readFileSync(path.join(repoRoot, 'lib/firebase.ts'), 'utf8');
  const modal = fs.readFileSync(path.join(repoRoot, 'components/modals/AuthModal.tsx'), 'utf8');
  const providers = fs.readFileSync(path.join(repoRoot, 'components/ClientProviders.tsx'), 'utf8');
  const settings = fs.readFileSync(path.join(repoRoot, 'app/settings/page.tsx'), 'utf8');
  const suiteSettings = fs.readFileSync(path.join(repoRoot, 'app/suite/settings/page.tsx'), 'utf8');

  assert.match(firebase, /signInWithPopup\(auth, googleProvider\)/);
  assert.match(firebase, /canUseSameOriginAuthRedirect\(firebaseConfig\.authDomain, hostname\)/);
  assert.match(firebase, /scheduleUserProfileBootstrap\(auth\.currentUser\)/);
  assert.match(firebase, /scheduleUserProfileBootstrap\(userCredential\.user\)/);
  assert.match(modal, /result\.status === 'cancelled'/);
  assert.match(modal, /result\.isNewUser/);
  assert.match(modal, /if \(loading \|\| oauthLoading\) return/);
  assert.match(modal, /disabled=\{loading \|\| oauthLoading\}/);
  assert.match(modal, /<fieldset disabled=\{loading \|\| oauthLoading\}/);
  assert.match(modal, /<button disabled=\{loading \|\| oauthLoading\} onClick=\{onSwitchMode\}/);
  assert.match(modal, /resolveTOTPSignIn/);
  assert.match(providers, /result\.isNewUser/);
  assert.match(settings, /mfaEnrollmentEnabled && <MFASection/);
  assert.match(suiteSettings, /mfaEnrollmentEnabled && <div/);
  assert.match(suiteSettings, /description: mfaEnrollmentEnabled \? 'Password, 2FA & login' : 'Password & login'/);
  for (const source of [firebase, modal, providers, settings]) {
    assert.doesNotMatch(source, /console\.(?:error|warn)\([^\n]*,\s*(?:err|error|e)\b/);
  }
});
