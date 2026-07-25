const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(repoRoot, 'app', 'api', 'cron', 'weekly-suggestions', 'route.ts'),
  'utf8',
);

test('weekly suggestions authenticates and proves tracked delivery before account enumeration', () => {
  const authorization = source.indexOf('if (!authorizedCronRequest(request))');
  const database = source.indexOf('const db = getAdminDb()');
  const readiness = source.indexOf('await getJobNotificationDeliveryReadinessForStore(db)');
  const failClosed = source.indexOf('EMAIL_DELIVERY_NOT_READY');
  const enumeration = source.indexOf("collection('users').listDocuments()");

  assert.ok(authorization >= 0);
  assert.ok(database > authorization);
  assert.ok(readiness > database);
  assert.ok(failClosed > readiness);
  assert.ok(enumeration > failClosed);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /selectDailyCronBatch\(userDocuments, boundedUserLimit\(request\), now\)/);
  assert.match(source, /Math\.min\(MAX_USER_LIMIT/);
});

test('weekly suggestions rechecks consent, cadence, and ownership inside its delivery claim', () => {
  assert.match(source, /db\.runTransaction/);
  assert.match(source, /getJobAlertEmailConsent\(latestData\)/);
  assert.match(source, /latestData\.jobAlertsLastAcceptedAt/);
  assert.match(source, /latestData\.jobAlertsLastAttemptAt/);
  assert.match(source, /shouldSendJobAlertDigest\(\{/);
  assert.match(source, /isJobEmailDeliveryLockActive\(latestData\.jobAlertsDeliveryLockUntil/);
  assert.match(source, /planJobEmailDeliveryClaim\(\{/);
  assert.match(source, /collection\('notificationClaims'\)/);
  assert.match(source, /authUser\?\.emailVerified \? authUser\.email : null/);
});

test('weekly suggestions sends only trusted review recommendations with receipt tracking', () => {
  assert.match(source, /getTrustedTalentJobApplyUrl\(job\)/);
  assert.match(source, /createJobEmailDeliveryAttempt\(db/);
  assert.match(source, /getResendDeliveryTags\(attemptId, 'job_alert'\)/);
  assert.match(source, /idempotencyKey:\s*`sona-picks-/);
  assert.match(source, /acceptJobEmailDeliveryAttempt\(db/);
  assert.match(source, /failJobEmailDeliveryAttempt\(db/);
  assert.match(source, /collection\('jobAlertEvents'\)/);
  assert.match(source, /logUserCommunication\(\{/);
  assert.doesNotMatch(source, /searchJobsAdzuna|GoogleGenerativeAI|new Resend/);
  assert.doesNotMatch(source, /submitApplication|applyToJob|contactEmployer/);
});

test('weekly suggestions returns bounded operational outcomes without recipient or provider identifiers', () => {
  assert.match(source, /type CronResult = \{\s*status: string;\s*jobCount\?: number;\s*\}/s);
  assert.doesNotMatch(source, /results\.push\(\{\s*(?:uid|email|providerMessageId):/);
  assert.match(source, /status\.startsWith\('error'\)/);
  assert.match(source, /'Cache-Control': 'private, no-store, max-age=0'/);
});
