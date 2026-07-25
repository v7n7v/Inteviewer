const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const {
  initializeApp: initializeClientApp,
  deleteApp: deleteClientApp,
} = require('firebase/app');
const {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
} = require('firebase/auth');
const {
  getFirestore: getClientFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
} = require('firebase/firestore');
const {
  initializeApp: initializeAdminApp,
  deleteApp: deleteAdminApp,
} = require('firebase-admin/app');
const {
  getFirestore: getAdminFirestore,
  Timestamp,
} = require('firebase-admin/firestore');

const PROJECT_ID = 'demo-talent-consulting-observability';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

let clientApp;
let adminApp;
let clientDb;
let adminDb;
let uid;
let timeline;
let subjects;
let diagnostics;
let resets;
const temporaryDirectories = [];

async function loadTypescript(relativePath) {
  const repoRoot = path.resolve(__dirname, '..');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-observability-emulator-'));
  temporaryDirectories.push(directory);
  const outfile = path.join(directory, 'module.cjs');
  await build({
    entryPoints: [path.join(repoRoot, relativePath)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [{
      name: 'observability-emulator-aliases',
      setup(builder) {
        builder.onResolve({ filter: /^firebase-admin(?:\/.*)?$/ }, args => ({
          path: require.resolve(args.path, { paths: [repoRoot] }),
          external: true,
        }));
        builder.onResolve({ filter: /^server-only$/ }, () => ({
          path: 'server-only',
          namespace: 'empty',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({
          contents: 'export {};',
          loader: 'js',
        }));
        builder.onResolve({ filter: /^@\// }, args => {
          const target = path.join(repoRoot, args.path.slice(2));
          const resolved = [target, `${target}.ts`, `${target}.tsx`]
            .find(candidate => fs.existsSync(candidate));
          return { path: resolved || target };
        });
      },
    }],
  });
  return require(outfile);
}

function isPermissionDenied(error) {
  return String(error?.code || error?.message || '').includes('permission-denied');
}

test.before(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;
  process.env.OBSERVABILITY_HMAC_ACTIVE_VERSION = 'v1';
  process.env.OBSERVABILITY_HMAC_KEYS_JSON = JSON.stringify({ v1: 'a'.repeat(32) });
  process.env.OBSERVABILITY_CURSOR_SECRET = 'cursor-secret-that-is-at-least-32-characters';
  [timeline, subjects, diagnostics, resets] = await Promise.all([
    loadTypescript('lib/observability/timeline.ts'),
    loadTypescript('lib/observability/subject.ts'),
    loadTypescript('lib/observability/diagnostics.ts'),
    loadTypescript('lib/observability/reset.ts'),
  ]);

  adminApp = initializeAdminApp({ projectId: PROJECT_ID }, `observability-admin-${Date.now()}`);
  adminDb = getAdminFirestore(adminApp);

  clientApp = initializeClientApp({
    projectId: PROJECT_ID,
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
  }, `observability-client-${Date.now()}`);
  const auth = getAuth(clientApp);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const credential = await signInAnonymously(auth);
  uid = credential.user.uid;

  clientDb = getClientFirestore(clientApp);
  const [firestoreHostname, firestorePort] = FIRESTORE_HOST.split(':');
  connectFirestoreEmulator(clientDb, firestoreHostname, Number(firestorePort));

  await adminDb.doc(`users/${uid}/settings/privacyControls`).set({
    productAnalytics: false,
    noticeVersion: 'observability-privacy-v1',
  });
  await adminDb.doc('users/someone-else/settings/privacyControls').set({
    productAnalytics: true,
    noticeVersion: 'observability-privacy-v1',
  });
  await adminDb.doc('user_observability_events/test-event').set({
    subjectKey: 'pseudonymous-only',
  });
});

test.after(async () => {
  if (clientApp) await deleteClientApp(clientApp);
  if (adminApp) await deleteAdminApp(adminApp);
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('owner cannot read or forge server-authored privacy evidence', async () => {
  const ownPrivacy = doc(clientDb, `users/${uid}/settings/privacyControls`);
  await assert.rejects(getDoc(ownPrivacy), isPermissionDenied);
  await assert.rejects(
    setDoc(ownPrivacy, { productAnalytics: true }, { merge: true }),
    isPermissionDenied,
  );
});

test('timeline query returns live retained metadata and filters TTL-pending rows', async () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const subject = subjects.deriveObservabilitySubjectKey(uid, 'v1', 'a'.repeat(32));
  const baseEvent = {
    subjectKey: subject.subjectKey,
    keyVersion: 'v1',
    occurredAt: '2026-07-24T09:00:00.000Z',
    purpose: 'service_reliability',
    eventName: 'tool_failed',
    category: 'reliability',
    action: 'complete',
    outcome: 'failure',
    plan: 'free',
    tool: 'resume_builder',
    latencyBand: 'unknown',
    errorCode: 'internal_failure',
  };
  await Promise.all([
    adminDb.doc('user_observability_events/live-timeline-event').set({
      ...baseEvent,
      expiresAt: Timestamp.fromDate(new Date('2026-07-25T10:00:00.000Z')),
    }),
    adminDb.doc('user_observability_events/expired-timeline-event').set({
      ...baseEvent,
      occurredAt: '2026-07-24T08:00:00.000Z',
      expiresAt: Timestamp.fromDate(new Date('2026-07-24T09:00:00.000Z')),
    }),
    adminDb.doc('user_observability_events/malformed-expiry-timeline-event').set({
      ...baseEvent,
      occurredAt: '2026-07-24T07:00:00.000Z',
      expiresAt: 'invalid-retention-evidence',
    }),
  ]);
  const result = await timeline.readObservabilityTimeline(adminDb, {
    uid,
    caseId: 'emulator-case',
    cursorContext: 'emulator-case:admin',
    limit: 10,
    now,
  });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventName, 'tool_failed');
  assert.equal(result.nextCursor, null);
});

test('reset fence denies every old grant and permits only a post-cutoff case', async () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const cutoff = '2026-07-24T09:30:00.000Z';
  const actor = {
    uid: 'support-admin',
    email: 'support@example.test',
    displayName: 'Support Admin',
    role: 'support_admin',
    permissions: ['admin.access', 'diagnostics.metadata.read'],
    mfaSatisfied: true,
  };
  const evidence = {
    uid: actor.uid,
    email: actor.email,
    role: actor.role,
    adminVersion: 1,
    authTimeMs: now.getTime() - 60_000,
    secondFactor: 'totp',
  };
  await Promise.all([
    adminDb.doc(`users/${uid}/observabilityControl/state`).set({ resetCutoffAt: cutoff }),
    adminDb.doc(`admin_accounts/${actor.uid}`).set({
      status: 'active',
      version: 1,
      role: actor.role,
      email: actor.email,
    }),
    adminDb.doc(`admin_accounts/${actor.uid}/stepUpLeases/observability`).set({
      state: 'active',
      scope: diagnostics.DIAGNOSTIC_METADATA_SCOPE,
      adminUid: actor.uid,
      adminVersion: 1,
      secondFactor: true,
      expiresAt: Timestamp.fromDate(new Date('2026-07-24T10:15:00.000Z')),
    }),
  ]);
  const seedCase = async (caseId, createdAt) => {
    await Promise.all([
      adminDb.doc(`diagnostic_support_cases/${caseId}`).set({
        targetUid: uid,
        category: 'tool_failure',
        status: 'open',
        scope: diagnostics.DIAGNOSTIC_METADATA_SCOPE,
        createdAt,
        updatedAt: createdAt,
        expiresAt: Timestamp.fromDate(new Date('2026-08-24T10:00:00.000Z')),
      }),
      adminDb.doc(`users/${uid}/diagnosticGrants/${caseId}`).set({
        targetUid: uid,
        caseId,
        state: 'active',
        scope: diagnostics.DIAGNOSTIC_METADATA_SCOPE,
        updatedAt: createdAt,
        expiresAt: Timestamp.fromDate(new Date('2026-07-24T11:00:00.000Z')),
      }),
    ]);
  };
  await seedCase('case-101-old', '2026-07-24T09:00:00.000Z');
  await seedCase('case-post-reset', '2026-07-24T09:31:00.000Z');

  await assert.rejects(
    diagnostics.assertDiagnosticAccessPreflight(adminDb, {
      actor,
      evidence,
      caseId: 'case-101-old',
      expectedTargetUid: uid,
    }, now),
    /OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED/,
  );
  await diagnostics.assertDiagnosticAccessPreflight(adminDb, {
    actor,
    evidence,
    caseId: 'case-post-reset',
    expectedTargetUid: uid,
  }, now);
  await adminDb.doc(`users/${uid}/diagnosticGrants/case-post-reset`).update({
    expiresAt: 'malformed-grant-expiry',
  });
  await assert.rejects(
    diagnostics.assertDiagnosticAccessPreflight(adminDb, {
      actor,
      evidence,
      caseId: 'case-post-reset',
      expectedTargetUid: uid,
    }, now),
    /OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED/,
  );
  await adminDb.doc(`users/${uid}/diagnosticGrants/case-post-reset`).update({
    expiresAt: Timestamp.fromDate(new Date('2026-07-24T11:00:00.000Z')),
  });
  await adminDb.doc(`admin_accounts/${actor.uid}/stepUpLeases/observability`).update({
    expiresAt: 'malformed-step-up-expiry',
  });
  await assert.rejects(
    diagnostics.assertDiagnosticAccessPreflight(adminDb, {
      actor,
      evidence,
      caseId: 'case-post-reset',
      expectedTargetUid: uid,
    }, now),
    /OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED/,
  );
  await adminDb.doc(`admin_accounts/${actor.uid}/stepUpLeases/observability`).update({
    expiresAt: Timestamp.fromDate(new Date('2026-07-24T10:15:00.000Z')),
  });

  const receiptsBefore = await adminDb.collection('diagnostic_access_receipts').get();
  await assert.rejects(
    diagnostics.createDiagnosticAccessReceipt(adminDb, {
      actor,
      evidence,
      caseId: 'case-101-old',
      expectedTargetUid: uid,
      returnedEvents: 0,
      cursorUsed: false,
    }, now),
    /OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED/,
  );
  const receiptsAfter = await adminDb.collection('diagnostic_access_receipts').get();
  assert.equal(receiptsAfter.size, receiptsBefore.size);
});

test('reset cleanup deletes cutoff-bounded grants and preserves post-reset grants', async () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const jobId = 'd'.repeat(64);
  const cutoff = '2026-07-24T09:30:00.000Z';
  await Promise.all([
    adminDb.doc(`observability_reset_jobs/${jobId}`).set({
      targetUid: uid,
      subjectKeys: ['A'.repeat(43)],
      keyVersions: ['v1'],
      status: 'queued',
      attempts: 0,
      deletedEvents: 0,
      cutoffAt: cutoff,
      createdAt: cutoff,
      updatedAt: cutoff,
      expiresAt: Timestamp.fromDate(new Date('2026-08-24T10:00:00.000Z')),
    }),
    adminDb.doc(`users/${uid}/diagnosticGrants/pre-reset-cleanup`).set({
      updatedAt: '2026-07-24T09:00:00.000Z',
      state: 'revoked',
    }),
    adminDb.doc(`users/${uid}/diagnosticGrants/post-reset-preserved`).set({
      updatedAt: '2026-07-24T09:31:00.000Z',
      state: 'active',
    }),
  ]);
  const first = await resets.processObservabilityResetJob(adminDb, jobId, 200, now);
  assert.equal(first.status, 'running');
  assert.equal(
    (await adminDb.doc(`users/${uid}/diagnosticGrants/pre-reset-cleanup`).get()).exists,
    false,
  );
  assert.equal(
    (await adminDb.doc(`users/${uid}/diagnosticGrants/post-reset-preserved`).get()).exists,
    true,
  );
  const second = await resets.processObservabilityResetJob(
    adminDb,
    jobId,
    200,
    new Date('2026-07-24T10:02:00.000Z'),
  );
  assert.equal(second.status, 'complete');
});

test('expired reset jobs cannot occupy the bounded worker queue', async () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const cutoff = '2026-07-24T09:30:00.000Z';
  const expiredIds = Array.from({ length: 10 }, (_, index) => (
    (index + 1).toString(16).padStart(64, '0')
  ));
  const validId = 'f'.repeat(64);
  await Promise.all([
    ...expiredIds.map(jobId => adminDb.doc(`observability_reset_jobs/${jobId}`).set({
      targetUid: uid,
      subjectKeys: ['B'.repeat(43)],
      keyVersions: ['v1'],
      status: 'queued',
      attempts: 0,
      deletedEvents: 0,
      cutoffAt: cutoff,
      createdAt: cutoff,
      updatedAt: cutoff,
      expiresAt: Timestamp.fromDate(new Date('2026-07-24T09:59:00.000Z')),
    })),
    adminDb.doc(`observability_reset_jobs/${validId}`).set({
      targetUid: uid,
      subjectKeys: ['C'.repeat(43)],
      keyVersions: ['v1'],
      status: 'queued',
      attempts: 0,
      deletedEvents: 0,
      cutoffAt: cutoff,
      createdAt: cutoff,
      updatedAt: cutoff,
      expiresAt: Timestamp.fromDate(new Date('2026-08-24T10:00:00.000Z')),
    }),
  ]);

  const result = await resets.processQueuedObservabilityResetJobs(adminDb, {
    jobLimit: 1,
    passLimit: 2,
    now,
  });
  assert.equal(result.inspected, 1);
  assert.equal(result.completed, 1);
  assert.equal(result.failed, 0);
  assert.equal(
    (await adminDb.doc(`observability_reset_jobs/${validId}`).get()).data()?.status,
    'complete',
  );
  assert.equal(
    (await adminDb.doc(`observability_reset_jobs/${expiredIds[0]}`).get()).data()?.status,
    'queued',
  );
});

test('ordinary owner settings remain writable as a control', async () => {
  const display = doc(clientDb, `users/${uid}/settings/display`);
  await setDoc(display, { density: 'comfortable' });
  const snapshot = await getDoc(display);
  assert.equal(snapshot.data().density, 'comfortable');
});

test('another user privacy receipt is not readable', async () => {
  await assert.rejects(
    getDoc(doc(clientDb, 'users/someone-else/settings/privacyControls')),
    isPermissionDenied,
  );
});

test('diagnostic grants and privileged observability collections deny client access', async () => {
  await assert.rejects(
    setDoc(doc(clientDb, `users/${uid}/diagnosticGrants/case-1`), {
      state: 'active',
    }),
    isPermissionDenied,
  );
  await assert.rejects(
    getDoc(doc(clientDb, 'user_observability_events/test-event')),
    isPermissionDenied,
  );
  await assert.rejects(
    setDoc(doc(clientDb, 'diagnostic_support_cases/case-1'), {
      targetUid: uid,
    }),
    isPermissionDenied,
  );
});
