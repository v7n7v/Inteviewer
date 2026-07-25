/**
 * Career Picks by Taco cron
 *
 * Cloud Scheduler calls this route on weekdays. Delivery cadence is resolved
 * per account (weekly for most plans, weekdays for eligible Max accounts).
 * This route only discovers and recommends roles. It never applies, submits,
 * contacts an employer, or prepares application materials.
 */
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';
import { sendRenderedEmailResult } from '@/lib/email';
import { renderEmail } from '@/lib/email/render';
import { buildEmailUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { logUserCommunication } from '@/lib/communications';
import {
  getJobAlertEmailConsent,
  sanitizeJobDeliveryError,
} from '@/lib/job-notification-delivery';
import { getJobNotificationDeliveryReadinessForStore } from '@/lib/job-notification-readiness';
import {
  getJobAlertSendLimit,
  normalizeJobAlertsFrequency,
  shouldSendJobAlertDigest,
  withSonaPicksUtm,
} from '@/lib/job-alerts';
import { getResendDeliveryTags, isJobEmailDeliveryLockActive } from '@/lib/job-notification-receipt-contract';
import {
  acceptJobEmailDeliveryAttempt,
  buildJobEmailIdempotencyKey,
  createJobEmailDeliveryAttempt,
  failJobEmailDeliveryAttempt,
  planJobEmailDeliveryClaim,
} from '@/lib/job-notification-receipts';
import {
  dedupeTalentJobs,
  finalizeTalentRecommendations,
  getTrustedTalentJobApplyUrl,
  isJobSupplyOperational,
  loadRecommendationLedger,
  recordRecommendationImpressions,
  searchTalentJobSupply,
  suppressLedgerMatches,
  type TalentJob,
} from '@/lib/job-recommendation-platform';
import { scoreAllGhostRisks } from '@/lib/ghost-filter';
import {
  extractResumeSkills,
  getLatestVerifiedResumeForUser as getLatestResumeForUser,
} from '@/lib/server-resume';
import { getUserTier, type PlanTier } from '@/lib/pricing-tiers';
import { selectDailyCronBatch } from '@/lib/assistant/cron-user-batch';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_USER_LIMIT = 10;
const MAX_USER_LIMIT = 25;
const MAX_SEARCH_COMBINATIONS = 4;
const DELIVERY_LOCK_MS = 15 * 60 * 1000;
const PLATFORM_ORIGIN = 'https://talentconsulting.io';

type CronResult = {
  status: string;
  jobCount?: number;
};

type PreferenceRecord = Record<string, unknown>;

function cronJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function authorizedCronRequest(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() || '';
  if (!expected) return false;
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}

function boundedUserLimit(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get('limit') || DEFAULT_USER_LIMIT);
  return Number.isFinite(requested)
    ? Math.min(MAX_USER_LIMIT, Math.max(1, Math.floor(requested)))
    : DEFAULT_USER_LIMIT;
}

function boundedStrings(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.replace(/\s+/g, ' ').trim().slice(0, 120))
      .filter(Boolean),
  )].slice(0, limit);
}

function boundedSalary(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(500_000, Math.max(0, Math.round(parsed))) : 0;
}

function platformUrl(path: string, campaignPart: string) {
  return withSonaPicksUtm(new URL(path, PLATFORM_ORIGIN).toString(), campaignPart);
}

function mostRecentCadenceTimestamp(...values: unknown[]) {
  const valid = values
    .filter((value): value is string => typeof value === 'string')
    .map(value => ({ value, timestamp: Date.parse(value) }))
    .filter(item => Number.isFinite(item.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp);
  return valid[0]?.value;
}

function deliveryCadence(
  latestData: PreferenceRecord,
  tier: PlanTier,
  now: Date,
) {
  const consent = getJobAlertEmailConsent(latestData);
  const frequency = normalizeJobAlertsFrequency(latestData.jobAlertsFrequency, tier);
  return shouldSendJobAlertDigest({
    enabled: consent.granted,
    emailNotifications: consent.granted,
    frequency,
    tier,
    lastSentAt: mostRecentCadenceTimestamp(
      latestData.jobAlertsLastAcceptedAt,
      latestData.jobAlertsLastAttemptAt,
    ),
    now,
  });
}

async function discoverRecommendations(
  db: Firestore,
  uid: string,
  preferences: PreferenceRecord,
  tier: PlanTier,
) {
  const targetRoles = boundedStrings(preferences.targetRoles, 3);
  if (targetRoles.length === 0) {
    return { status: 'skip:no-target-role' as const, jobs: [] as TalentJob[] };
  }
  const preferredCities = boundedStrings(preferences.preferredCities, 2);
  const locations = preferredCities.length > 0 ? preferredCities : [''];
  const remotePref = typeof preferences.remotePref === 'string'
    && ['remote', 'hybrid', 'onsite', 'any'].includes(preferences.remotePref)
    ? preferences.remotePref
    : 'any';
  const salaryMin = boundedSalary(preferences.salaryMin);

  let userSkills: string[] = [];
  try {
    const latestResume = await getLatestResumeForUser(db, uid);
    userSkills = extractResumeSkills(latestResume.resume).slice(0, 80);
  } catch {
    userSkills = boundedStrings(preferences.manualSkills, 80);
  }

  const ledger = await loadRecommendationLedger(db, uid);
  const searches = targetRoles
    .flatMap(role => locations.map(location => ({ role, location })))
    .slice(0, MAX_SEARCH_COMBINATIONS);
  const settled = await Promise.allSettled(searches.map(({ role, location }) => {
    return searchTalentJobSupply({
      query: role,
      location,
      country: 'us',
      page: 1,
      resultsPerPage: 10,
      sortBy: 'relevance',
      salaryMin: salaryMin || undefined,
      remote: remotePref === 'remote' || undefined,
    });
  }));

  const discovered: TalentJob[] = [];
  let unavailableSearches = 0;
  for (const result of settled) {
    if (result.status === 'rejected' || !isJobSupplyOperational(result.value.providerStatus)) {
      unavailableSearches += 1;
      continue;
    }
    discovered.push(...suppressLedgerMatches(result.value.jobs, ledger));
  }
  if (discovered.length === 0) {
    return {
      status: unavailableSearches === settled.length ? 'error:job-supply-unavailable' as const : 'skip:no-matches' as const,
      jobs: [] as TalentJob[],
    };
  }

  const deduped = dedupeTalentJobs(discovered).slice(0, 40);
  const ghostAssessments = scoreAllGhostRisks(deduped.map(job => ({
    title: job.title,
    company: job.company,
    postedDate: job.postedDate,
    description: job.description,
    salary: job.salary,
    url: job.url,
    location: job.location,
  })));
  const ranked = finalizeTalentRecommendations(
    deduped.map((job, index) => ({ ...job, ghostRisk: ghostAssessments[index] })),
    {
      userSkills,
      targetRoles,
      preferredCities,
      remotePref,
      salaryMin,
      ledger,
    },
  );

  const trusted = ranked
    .flatMap(job => {
      const trustedApplyUrl = getTrustedTalentJobApplyUrl(job);
      return trustedApplyUrl
        ? [{ ...job, url: trustedApplyUrl, outboundLinkVerified: true }]
        : [];
    })
    .slice(0, getJobAlertSendLimit(tier));

  if (trusted.length === 0) {
    return { status: 'skip:no-trusted-matches' as const, jobs: [] as TalentJob[] };
  }
  await recordRecommendationImpressions(db, uid, trusted);
  return { status: 'ready' as const, jobs: trusted };
}

async function recordDeliveryEvent(
  db: Firestore,
  uid: string,
  input: {
    status: string;
    attemptId: string;
    jobCount: number;
    topScore: number;
    error?: string | null;
  },
) {
  await db.collection('users').doc(uid).collection('jobAlertEvents').add({
    type: 'digest_delivery',
    channel: 'email',
    source: 'weekly_suggestions_cron',
    status: input.status,
    attemptId: input.attemptId,
    jobCount: input.jobCount,
    topScore: input.topScore,
    error: input.error || null,
    createdAt: new Date().toISOString(),
  }).catch(() => {});
}

async function processUser(
  db: Firestore,
  userRef: DocumentReference,
  now: Date,
): Promise<CronResult> {
  const uid = userRef.id;
  const prefsRef = db.collection('users').doc(uid).collection('settings').doc('jobPreferences');
  const initialSnapshot = await prefsRef.get();
  if (!initialSnapshot.exists) return { status: 'skip:no-preferences' };
  const initialData = initialSnapshot.data() || {};
  if (!getJobAlertEmailConsent(initialData).granted) return { status: 'skip:no-consent' };

  const authUser = await getAdminAuth().getUser(uid).catch(() => null);
  const verifiedAuthEmail = authUser?.emailVerified ? authUser.email : null;
  if (!verifiedAuthEmail) return { status: 'skip:no-verified-email' };
  const tier = await getUserTier(uid, verifiedAuthEmail);
  if (!deliveryCadence(initialData, tier, now).send) return { status: 'skip:cadence' };

  const recommendationResult = await discoverRecommendations(db, uid, initialData, tier);
  if (recommendationResult.status !== 'ready') return { status: recommendationResult.status };
  const jobs = recommendationResult.jobs;
  const topScore = Math.max(...jobs.map(job => job.fitScore?.overall || 0));
  const rendered = await renderEmail('product.career_picks', {
    recipientName: authUser?.displayName?.split(/\s+/)[0] || undefined,
    summary: `${jobs.length} verified role${jobs.length === 1 ? '' : 's'} matched your current profile. The strongest Talent Fit score is ${topScore}%.`,
    items: jobs.map(job => {
      const score = job.fitScore?.overall || 0;
      const reason = job.recommendationReason || 'Review the evidence and decide whether this role belongs in your pipeline.';
      return `${job.title} at ${job.company} — ${job.location} — ${score}% Talent Fit — ${reason}`.slice(0, 300);
    }),
    actionUrl: platformUrl('/suite/job-search', 'open_picks'),
    preferenceUrl: platformUrl('/suite/settings', 'preferences'),
    unsubscribeUrl: buildEmailUnsubscribeUrl(uid, 'jobDigest'),
  });

  const dayKey = now.toISOString().slice(0, 10);
  const idempotencyKey = buildJobEmailIdempotencyKey('sona-picks', [uid, dayKey]);
  const claimRef = db.collection('users').doc(uid).collection('notificationClaims').doc(idempotencyKey);
  const proposedAttemptId = randomUUID();
  const requestedAt = now.toISOString();
  const claim = await db.runTransaction(async transaction => {
    const [latestSnapshot, claimSnapshot] = await Promise.all([
      transaction.get(prefsRef),
      transaction.get(claimRef),
    ]);
    const latestData = latestSnapshot.data() || {};
    if (!getJobAlertEmailConsent(latestData).granted) {
      return { outcome: 'consent_revoked' as const };
    }
    const cadence = shouldSendJobAlertDigest({
      enabled: latestData.jobAlertsEnabled === true,
      emailNotifications: latestData.emailNotifications === true,
      frequency: normalizeJobAlertsFrequency(latestData.jobAlertsFrequency, tier),
      tier,
      lastSentAt: mostRecentCadenceTimestamp(
        latestData.jobAlertsLastAcceptedAt,
        latestData.jobAlertsLastAttemptAt,
      ),
      now,
    });
    if (!cadence.send) return { outcome: 'cadence_blocked' as const };
    if (isJobEmailDeliveryLockActive(latestData.jobAlertsDeliveryLockUntil, now.getTime())) {
      return { outcome: 'delivery_in_progress' as const };
    }

    const existingClaim = claimSnapshot.data() || {};
    const existingAttemptId = typeof existingClaim.attemptId === 'string' ? existingClaim.attemptId : '';
    const existingAttemptSnapshot = existingAttemptId
      ? await transaction.get(db.collection('emailDeliveryAttempts').doc(existingAttemptId))
      : null;
    const deliveryPlan = planJobEmailDeliveryClaim({
      baseIdempotencyKey: idempotencyKey,
      proposedAttemptId,
      existingAttemptId,
      existingClaimStatus: existingClaim.status,
      existingAttemptStatus: existingAttemptSnapshot?.data()?.status,
      existingProviderIdempotencyKey: existingClaim.providerIdempotencyKey,
      existingRetryCount: existingClaim.retryCount,
      lockUntil: existingClaim.lockUntil,
      now: now.getTime(),
    });
    if (deliveryPlan.outcome !== 'acquired') return deliveryPlan;

    const lockUntil = new Date(now.getTime() + DELIVERY_LOCK_MS).toISOString();
    transaction.set(claimRef, {
      status: 'sending',
      idempotencyKey,
      providerIdempotencyKey: deliveryPlan.providerIdempotencyKey,
      attemptId: deliveryPlan.attemptId,
      retryCount: deliveryPlan.retryCount,
      lockUntil,
      createdAt: existingClaim.createdAt || requestedAt,
      updatedAt: requestedAt,
    }, { merge: true });
    transaction.set(prefsRef, {
      jobAlertsDeliveryStatus: 'sending',
      jobAlertsDeliveryAttemptId: deliveryPlan.attemptId,
      jobAlertsDeliveryUpdatedAt: requestedAt,
      jobAlertsDeliveryError: null,
      jobAlertsDeliveryLockUntil: lockUntil,
      jobAlertsLastAttemptAt: requestedAt,
    }, { merge: true });
    return deliveryPlan;
  });

  if (claim.outcome === 'duplicate') return { status: 'duplicate', jobCount: jobs.length };
  if (claim.outcome !== 'acquired') return { status: `skip:${claim.outcome}` };
  const attemptId = claim.attemptId;
  await recordDeliveryEvent(db, uid, {
    status: 'sending',
    attemptId,
    jobCount: jobs.length,
    topScore,
  });

  try {
    await createJobEmailDeliveryAttempt(db, {
      uid,
      attemptId,
      purpose: 'job_alert',
      source: 'weekly_cron',
      createdAt: requestedAt,
      recipientEmail: verifiedAuthEmail,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const safeError = sanitizeJobDeliveryError(error);
    await db.runTransaction(async transaction => {
      const [latestPreferences, latestClaim] = await Promise.all([
        transaction.get(prefsRef),
        transaction.get(claimRef),
      ]);
      if (latestPreferences.data()?.jobAlertsDeliveryAttemptId === attemptId) {
        transaction.set(prefsRef, {
          jobAlertsDeliveryStatus: 'failed',
          jobAlertsDeliveryUpdatedAt: failedAt,
          jobAlertsDeliveryError: safeError,
          jobAlertsDeliveryLockUntil: null,
          jobAlertsLastAttemptAt: null,
        }, { merge: true });
      }
      if (latestClaim.data()?.attemptId === attemptId) {
        transaction.set(claimRef, {
          status: 'failed',
          error: safeError,
          lockUntil: null,
          updatedAt: failedAt,
        }, { merge: true });
      }
    }).catch(() => {});
    await recordDeliveryEvent(db, uid, {
      status: 'failed',
      attemptId,
      jobCount: jobs.length,
      topScore,
      error: safeError,
    });
    await logUserCommunication({
      uid,
      email: verifiedAuthEmail,
      subject: rendered.subject,
      bodyPreview: `Career Picks by Taco delivery failed before provider submission for ${jobs.length} recommendations.`,
      template: 'sona_picks_weekly_digest',
      sentBy: 'cron/weekly-suggestions',
      status: 'failed',
      metadata: { attemptId, jobCount: jobs.length, stage: 'receipt_registration' },
    }).catch(() => {});
    return { status: 'error:receipt-tracking-unavailable' };
  }

  try {
    const delivery = await sendRenderedEmailResult(verifiedAuthEmail, rendered, {
      idempotencyKey: `sona-picks-${claim.providerIdempotencyKey.replace(/^sona-picks-/, '')}`,
      additionalTags: getResendDeliveryTags(attemptId, 'job_alert'),
    });
    if (delivery.error) throw new Error(delivery.error);
    if (!delivery.ok) throw new Error('Provider rejected the Career Picks email');

    const acceptedAt = new Date().toISOString();
    let acceptedStatus = 'accepted';
    try {
      const accepted = await acceptJobEmailDeliveryAttempt(db, {
        attemptId,
        providerMessageId: delivery.id || null,
        acceptedAt,
      });
      acceptedStatus = accepted.status;
    } catch (error) {
      console.error('[cron/weekly-suggestions] Provider accepted delivery but receipt state could not be persisted:', error);
    }
    await db.runTransaction(async transaction => {
      const [latestPreferences, latestClaim] = await Promise.all([
        transaction.get(prefsRef),
        transaction.get(claimRef),
      ]);
      if (latestPreferences.data()?.jobAlertsDeliveryAttemptId === attemptId) {
        transaction.set(prefsRef, {
          jobAlertsDeliveryStatus: acceptedStatus,
          jobAlertsDeliveryUpdatedAt: acceptedAt,
          jobAlertsDeliveryError: null,
          jobAlertsProviderMessageId: delivery.id || null,
          jobAlertsReceiptTracking: delivery.id ? 'pending' : 'unavailable',
          lastNotificationSentAt: acceptedAt,
          jobAlertsLastSentAt: acceptedAt,
          jobAlertsLastAcceptedAt: acceptedAt,
          jobAlertsLastJobCount: jobs.length,
          jobAlertsDeliveryLockUntil: null,
        }, { merge: true });
      }
      if (latestClaim.data()?.attemptId === attemptId) {
        transaction.set(claimRef, {
          status: acceptedStatus,
          providerMessageId: delivery.id || null,
          acceptedAt,
          lockUntil: null,
          updatedAt: acceptedAt,
        }, { merge: true });
      }
    }).catch(error => {
      console.error('[cron/weekly-suggestions] Provider accepted delivery but cadence state could not be persisted:', error);
    });
    await recordDeliveryEvent(db, uid, {
      status: acceptedStatus,
      attemptId,
      jobCount: jobs.length,
      topScore,
    });
    await logUserCommunication({
      uid,
      email: verifiedAuthEmail,
      subject: rendered.subject,
      bodyPreview: `Career Picks by Taco provider outcome: ${acceptedStatus} for ${jobs.length} review-only recommendations. No application was submitted.`,
      template: 'sona_picks_weekly_digest',
      sentBy: 'cron/weekly-suggestions',
      status: acceptedStatus,
      metadata: { attemptId, jobCount: jobs.length, topScore },
    }).catch(() => {});
    return { status: acceptedStatus, jobCount: jobs.length };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const safeError = sanitizeJobDeliveryError(error);
    const failure = await failJobEmailDeliveryAttempt(db, {
      attemptId,
      failedAt,
      error: safeError,
    }).catch(() => ({ updated: false, status: null }));
    const finalStatus = !failure.updated && failure.status && failure.status !== 'failed'
      ? failure.status
      : 'failed';
    await db.runTransaction(async transaction => {
      const [latestPreferences, latestClaim] = await Promise.all([
        transaction.get(prefsRef),
        transaction.get(claimRef),
      ]);
      if (latestPreferences.data()?.jobAlertsDeliveryAttemptId === attemptId && finalStatus === 'failed') {
        transaction.set(prefsRef, {
          jobAlertsDeliveryStatus: 'failed',
          jobAlertsDeliveryUpdatedAt: failedAt,
          jobAlertsDeliveryError: safeError,
          jobAlertsDeliveryLockUntil: null,
          jobAlertsLastAttemptAt: null,
        }, { merge: true });
      }
      if (latestClaim.data()?.attemptId === attemptId) {
        transaction.set(claimRef, {
          status: finalStatus,
          error: finalStatus === 'failed' ? safeError : null,
          lockUntil: null,
          updatedAt: failedAt,
        }, { merge: true });
      }
    }).catch(() => {});
    await recordDeliveryEvent(db, uid, {
      status: finalStatus,
      attemptId,
      jobCount: jobs.length,
      topScore,
      error: finalStatus === 'failed' ? safeError : null,
    });
    await logUserCommunication({
      uid,
      email: verifiedAuthEmail,
      subject: rendered.subject,
      bodyPreview: `Career Picks by Taco provider outcome: ${finalStatus} for ${jobs.length} review-only recommendations.`,
      template: 'sona_picks_weekly_digest',
      sentBy: 'cron/weekly-suggestions',
      status: finalStatus,
      metadata: { attemptId, jobCount: jobs.length, topScore },
    }).catch(() => {});
    return {
      status: finalStatus === 'failed' ? 'error:delivery-failed' : finalStatus,
      jobCount: jobs.length,
    };
  }
}

export async function POST(request: NextRequest) {
  // Authentication is intentionally the first operation. No database,
  // provider, queue, or user enumeration work occurs before this check.
  if (!authorizedCronRequest(request)) {
    return cronJson({ error: 'Unauthorized' }, 401);
  }

  const db = getAdminDb();
  const deliveryReadiness = await getJobNotificationDeliveryReadinessForStore(db);
  if (!deliveryReadiness.canSendTrackedEmail) {
    return cronJson({
      success: false,
      code: 'EMAIL_DELIVERY_NOT_READY',
      error: 'Confirmed email delivery is not ready. No accounts were scanned and no messages were sent.',
    }, 503);
  }

  const now = new Date();
  try {
    // listDocuments reads identifiers only; data/provider work remains bounded
    // to the rotating batch selected below.
    const userDocuments = await db.collection('users').listDocuments();
    const users = selectDailyCronBatch(userDocuments, boundedUserLimit(request), now);
    const results: CronResult[] = [];
    for (const userRef of users) {
      try {
        results.push(await processUser(db, userRef, now));
      } catch (error) {
        console.error('[cron/weekly-suggestions] Account processing failed:', error);
        results.push({ status: 'error:account-processing' });
      }
    }

    const accepted = results.filter(result => ['accepted', 'delivered', 'delayed'].includes(result.status)).length;
    const duplicate = results.filter(result => result.status === 'duplicate').length;
    const failed = results.filter(({ status }) => status.startsWith('error')).length;
    const skipped = results.length - accepted - duplicate - failed;
    monitor.info('Career Picks Cron', `Processed ${results.length} bounded accounts`, [
      { name: 'Accepted', value: String(accepted) },
      { name: 'Duplicate', value: String(duplicate) },
      { name: 'Skipped', value: String(skipped) },
      { name: 'Failed', value: String(failed) },
    ]);
    return cronJson({
      success: failed === 0,
      results,
      summary: {
        processed: results.length,
        accepted,
        duplicate,
        skipped,
        failed,
      },
    });
  } catch (error) {
    console.error('[cron/weekly-suggestions] Fatal error:', error);
    monitor.critical('Tool: cron/weekly-suggestions', String(error));
    return cronJson({
      success: false,
      code: 'WEEKLY_SUGGESTIONS_FAILED',
      error: 'The bounded Career Picks run could not be completed.',
    }, 500);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
