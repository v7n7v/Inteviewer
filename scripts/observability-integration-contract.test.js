const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('admin activity access is case-bound, MFA-backed, transactional, and never accepts identity lookup', () => {
  const activityRoute = source('app/api/admin/diagnostic-cases/[caseId]/activity/route.ts');
  const diagnostics = source('lib/observability/diagnostics.ts');

  assert.match(activityRoute, /caseId/);
  assert.doesNotMatch(activityRoute, /searchParams\.get\(['"](?:uid|email)['"]\)/);
  assert.match(diagnostics, /sign_in_second_factor/);
  assert.match(diagnostics, /authTimeMs/);
  assert.match(diagnostics, /OBSERVABILITY_RECENT_AUTH_MS/);
  assert.match(diagnostics, /OBSERVABILITY_STEP_UP_MS/);
  assert.match(diagnostics, /runTransaction/);
  assert.match(diagnostics, /diagnostic_access_receipts/);
});

test('bug feedback creates one server-linked diagnostic case that Admin can discover without identity lookup', () => {
  const feedbackRoute = source('app/api/feedback/route.ts');
  const feedbackPage = source('app/suite/feedback/page.tsx');
  const settingsPage = source('app/suite/settings/page.tsx');
  const adminCasesRoute = source('app/api/admin/diagnostic-cases/route.ts');
  const commandCenter = source('components/admin/observability/ObservabilityCommandCenter.tsx');

  assert.match(feedbackRoute, /diagnosticsRequested === true/);
  assert.match(feedbackRoute, /acknowledgedDiagnosticsNotice !== observabilityNoticeVersion\(\)/);
  assert.match(feedbackRoute, /noticeVersion:\s*acknowledgedDiagnosticsNotice/);
  assert.match(feedbackRoute, /prepareDiagnosticCase/);
  assert.match(feedbackRoute, /diagnosticCaseId/);
  assert.match(feedbackRoute, /transaction\.create\([\s\S]*diagnostic_support_cases/);
  assert.match(feedbackRoute, /Diagnostic case/);
  assert.doesNotMatch(feedbackPage, /createPrivacySafeBugDiagnosticCase/);
  assert.match(feedbackPage, /data\.diagnosticCaseId/);
  assert.match(feedbackPage, /diagnosticsNoticeVersion/);
  assert.match(feedbackPage, /readPrivacySafeDiagnosticNoticeVersion/);
  assert.match(feedbackPage, /diagnosticAcknowledgement\?\.uid === submittingUid/);
  assert.match(feedbackPage, /auth\.currentUser\?\.uid !== requestingUid/);
  assert.doesNotMatch(settingsPage, /createPrivacySafeBugDiagnosticCase/);
  assert.match(settingsPage, /data\.diagnosticCaseId/);
  assert.match(settingsPage, /diagnosticsNoticeVersion/);
  assert.match(settingsPage, /readPrivacySafeDiagnosticNoticeVersion/);
  assert.match(settingsPage, /diagnosticAcknowledgement\?\.uid === submittingUid/);
  assert.match(settingsPage, /auth\.currentUser\?\.uid !== requestingUid/);
  assert.match(adminCasesRoute, /diagnostics\.metadata\.read/);
  assert.doesNotMatch(adminCasesRoute, /targetUid|email/);
  assert.match(commandCenter, /Recent open diagnostic cases/);
  assert.match(commandCenter, /bounded to 50 metadata-only cases/);
});

test('scheduled aggregate and reset workers use bounded, fenced execution', () => {
  const aggregate = source('lib/observability/aggregate.ts');
  const reset = source('lib/observability/reset.ts');
  const cron = source('app/api/cron/admin-aggregates/route.ts');

  assert.match(aggregate, /claimAdminAggregateRefresh/);
  assert.match(aggregate, /publishAdminAggregateGeneration/);
  assert.match(aggregate, /releaseAdminAggregateRefresh/);
  assert.match(reset, /leaseId/);
  assert.match(reset, /OBSERVABILITY_RESET_LEASE_SUPERSEDED/);
  assert.match(reset, /processQueuedObservabilityResetJobs/);
  assert.match(reset, /where\('expiresAt', '>', Timestamp\.fromDate\(now\)\)/);
  assert.match(reset, /orderBy\('expiresAt', 'asc'\)/);
  assert.match(reset, /passLimit \|\| 200/);
  assert.match(reset, /Promise\.all\(round\.map/);
  assert.match(reset, /where\('updatedAt', '<=', cutoffAt\)/);
  assert.match(reset, /overdue/);
  assert.match(cron, /materializeObservabilityAggregate/);
  assert.match(cron, /processQueuedObservabilityResetJobs/);
});

test('reset fence revokes every pre-reset case without deleting post-reset grants', () => {
  const diagnostics = source('lib/observability/diagnostics.ts');
  const reset = source('lib/observability/reset.ts');
  assert.match(diagnostics, /observabilityControlRef/);
  assert.match(diagnostics, /caseCreatedAtMs <= resetCutoffMs/);
  assert.match(reset, /where\('updatedAt', '<=', cutoffAt\)/);
  assert.match(reset, /transaction\.set\(controlRef,[\s\S]*resetCutoffAt/);
  assert.match(reset, /observabilityResetJobIsRetained/);
  assert.match(reset, /OBSERVABILITY_RESET_EXPIRED/);
  assert.match(reset, /processObservabilityResetJob[\s\S]*observabilityResetJobIsRetained/);
  assert.match(reset, /diagnostic_support_cases/);
  assert.match(source('app/api/privacy/observability/reset/route.ts'), /observabilityResetJobIsRetained/);
});

test('milestone-one producers are server-confirmed and broad workspace instrumentation remains deferred', () => {
  const client = source('lib/observability/client.ts');
  const contracts = source('lib/observability/contracts.ts');
  const workspace = source('components/workspace/WorkspaceFrame.tsx');
  const feedbackRoute = source('app/api/feedback/route.ts');
  const failureRoute = source('app/api/resume/ai/route.ts');
  assert.match(client, /sendProductObservabilityEvent/);
  assert.match(client, /keepalive:\s*true/);
  assert.doesNotMatch(workspace, /sendProductObservabilityEvent|workspace_opened/);
  assert.doesNotMatch(client, /workspace_opened|producer:\s*'workspace'/);
  assert.doesNotMatch(contracts, /workspaceOpenedSchema|workspace_opened/);
  assert.match(feedbackRoute, /eventName:\s*'feedback_accepted'/);
  assert.match(feedbackRoute, /author:\s*'server'/);
  assert.match(failureRoute, /eventName:\s*'tool_failed'/);
  assert.match(failureRoute, /recordObservabilitySafely/);
  assert.match(failureRoute, /author:\s*'server'/);
});

test('rate-limit infrastructure receives opaque observability subjects, never raw UIDs', () => {
  const helper = source('lib/observability/rate-limit.ts');
  assert.match(helper, /observabilityRateLimitKey/);
  for (const route of [
    'app/api/observability/events/route.ts',
    'app/api/observability/consent/route.ts',
    'app/api/observability/diagnostic-cases/route.ts',
    'app/api/observability/diagnostic-cases/[caseId]/grant/route.ts',
    'app/api/privacy/observability/export/route.ts',
    'app/api/privacy/observability/reset/route.ts',
    'app/api/admin/observability-step-up/route.ts',
    'app/api/admin/diagnostic-cases/[caseId]/activity/route.ts',
  ]) {
    const contents = source(route);
    assert.doesNotMatch(contents, /checkRateLimitStrict\([^)]*(?:token|actor)\.uid/);
  }
});

test('production scheduler scopes its secret and pins reviewed action commits', () => {
  const workflow = source('.github/workflows/admin-aggregate-materialization.yml');
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.doesNotMatch(workflow, /\n    env:/);
  assert.match(workflow, /Materialize and verify Admin snapshots[\s\S]*?CRON_SECRET:/);
});

test('client rules deny privileged observability roots and server-authored privacy evidence', () => {
  const rules = source('firestore.rules');
  const deniedRoots = [
    'user_observability_events',
    'user_observability_summaries',
    'user_observability_daily',
    'diagnostic_support_cases',
    'diagnostic_access_receipts',
    'observability_reset_jobs',
  ];

  assert.match(rules, /privacyControls/);
  assert.match(rules, /diagnosticGrants/);
  for (const collection of deniedRoots) {
    assert.match(rules, new RegExp(`match /${collection.replaceAll('_', '\\_')}`));
  }
});

test('index and TTL policy cover the observability lifecycle', () => {
  const indexes = JSON.parse(source('firestore.indexes.json'));
  const composite = indexes.indexes.find(index => (
    index.collectionGroup === 'user_observability_events'
    && index.fields.some(field => field.fieldPath === 'subjectKey')
    && index.fields.some(field => field.fieldPath === 'occurredAt')
    && index.fields.some(field => (
      field.fieldPath === '__name__' && field.order === 'DESCENDING'
    ))
  ));
  assert.ok(composite, 'timeline composite index is required');

  const ttlGroups = new Set(
    indexes.fieldOverrides
      .filter(override => override.ttl === true && override.fieldPath === 'expiresAt')
      .map(override => override.collectionGroup),
  );
  for (const group of [
    'user_observability_events',
    'user_observability_summaries',
    'shards',
    'diagnostic_support_cases',
    'diagnostic_access_receipts',
    'observability_reset_jobs',
    'diagnosticGrants',
    'stepUpLeases',
  ]) {
    assert.ok(ttlGroups.has(group), `missing TTL policy for ${group}`);
  }
});

test('user settings expose bounded export and typed observability-only reset controls', () => {
  const controls = source('components/privacy/ObservabilityPrivacyControls.tsx');
  const exportRoute = source('app/api/privacy/observability/export/route.ts');
  const resetRoute = source('app/api/privacy/observability/reset/route.ts');

  assert.match(controls, /Download metadata/);
  assert.match(controls, /RESET OBSERVABILITY DATA/);
  assert.match(controls, /does not delete your Talent Consulting account or documents/);
  assert.match(controls, /key=\{`diagnostic-grants:\$\{activeUserUid\}`\}/);
  assert.match(controls, /key=\{`observability-data:\$\{activeUserUid\}`\}/);
  assert.match(controls, /lifecycleGeneration/);
  assert.match(controls, /auth\.currentUser\?\.uid !== uid/);
  assert.match(exportRoute, /observability_metadata_only/);
  assert.match(exportRoute, /not a complete account or document export/i);
  assert.match(resetRoute, /accountDeletionRequested:\s*false/);
  assert.match(resetRoute, /De-identified, rounded daily aggregates are not subtracted/);
});
