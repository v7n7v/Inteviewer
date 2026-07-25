import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminJson, adminReadFailure } from '@/lib/admin/http';
import { boundedInteger } from '@/lib/admin/evidence';
import { TALENT_FIT_SCORE_VERSION } from '@/lib/job-recommendation-platform';
import {
  buildRecommendationCalibrationReport,
  type CalibrationOutcome,
  type RecommendationCalibrationEvidence,
  type RecommendationCalibrationSample,
} from '@/lib/recommendation-calibration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SAMPLE_LIMIT = 2_000;
// adminJson enforces: 'Cache-Control': 'private, no-store, max-age=0'
const VALID_OUTCOMES = new Set<CalibrationOutcome>([
  'callback',
  'interview',
  'offer',
  'rejection',
  'ghosted',
]);

function cohortUserKey(uid: string) {
  return createHash('sha256')
    .update(`recommendation-calibration-user:${uid}`)
    .digest('hex');
}

function calibrationSample(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const pathParts = doc.ref.path.split('/');
  if (
    pathParts.length !== 4
    || pathParts[0] !== 'users'
    || pathParts[2] !== 'recommendation_calibration'
  ) {
    return null;
  }
  const data = doc.data();
  const outcome = typeof data.outcome === 'string' && VALID_OUTCOMES.has(data.outcome as CalibrationOutcome)
    ? data.outcome as CalibrationOutcome
    : null;
  const reportedAt = typeof data.reportedAt === 'string' && Number.isFinite(Date.parse(data.reportedAt))
    ? new Date(data.reportedAt).toISOString()
    : null;
  if (!outcome || !reportedAt) return null;

  return {
    userKey: cohortUserKey(pathParts[1]),
    outcome,
    reportedAt,
    evidence: data.evidence && typeof data.evidence === 'object'
      ? data.evidence as RecommendationCalibrationEvidence
      : null,
  } satisfies RecommendationCalibrationSample;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'analytics.read');
  if (guard.error) return guard.error;
  if (guard.actor.role !== 'owner') {
    return adminReadFailure(
      'admin_owner_required',
      'Owner access is required to review recommendation calibration.',
      403,
    );
  }

  const windowDays = boundedInteger(
    request.nextUrl.searchParams.get('windowDays'),
    180,
    30,
    365,
  );
  const generatedAt = new Date().toISOString();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const snapshot = await getAdminDb()
      .collectionGroup('recommendation_calibration')
      .where('reportedAt', '>=', since)
      .orderBy('reportedAt', 'desc')
      .limit(SAMPLE_LIMIT + 1)
      .get();
    const truncated = snapshot.docs.length > SAMPLE_LIMIT;
    const samples = snapshot.docs
      .slice(0, SAMPLE_LIMIT)
      .map(calibrationSample)
      .filter((sample): sample is RecommendationCalibrationSample => sample !== null);
    const report = buildRecommendationCalibrationReport(samples, {
      currentScoreVersion: TALENT_FIT_SCORE_VERSION,
      sampleLimit: SAMPLE_LIMIT,
      truncated,
    });

    return adminJson({
      generatedAt,
      windowDays,
      trackedRecords: samples.length,
      report,
      reviewSafety: {
        automaticChangesApplied: false,
        scoreWeightChangeAuthorized: false,
        thresholdChangeAuthorized: false,
        humanReviewRequired: true,
      },
      privacy: 'Aggregate response only. No user, company, role, email, or resume data is returned.',
      limitations: [
        'The report uses user-reported response signals and can contain reporting and attribution bias.',
        'Small outcome cells are suppressed by the calibration report privacy threshold.',
        ...(truncated ? ['The bounded sample was truncated; evidence cannot be treated as a complete cohort.'] : []),
      ],
    });
  } catch {
    return adminReadFailure(
      'admin_recommendation_calibration_unavailable',
      'Recommendation calibration evidence is temporarily unavailable.',
    );
  }
}
