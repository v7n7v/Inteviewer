/**
 * Career Twin — Persistent Digital Twin
 * 
 * Persists the computed CareerProfile to Firestore for fast reads.
 * Supports invalidation triggers from any tool that changes source data.
 * Provides a structured, export-ready career profile.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import { computeCareerProfile, type CareerProfile } from '@/lib/career-graph';

// ── Types ──

export interface CareerTwin extends CareerProfile {
  version: number;
  stale: boolean;

  // Structured background (enriched from resume data)
  background: {
    currentTitle: string;
    targetRoles: string[];
    industries: string[];
    education: string[];
  };

  // Behavioral answer bank metadata
  behavioralBank: {
    totalStories: number;
    coveredCategories: string[];
    uncoveredCategories: string[];
    coverageScore: number;      // 0-100
  };

  // Profile completeness
  completeness: {
    score: number;              // 0-100
    missing: string[];          // Fields that need filling
  };

  exportable: boolean;
}

const TWIN_DOC_PATH = 'career_twin';
const TWIN_VERSION = 1;

// Standard behavioral question categories
const BEHAVIORAL_CATEGORIES = [
  'leadership', 'teamwork', 'conflict resolution', 'failure',
  'initiative', 'communication', 'problem solving', 'time management',
  'adaptability', 'creativity', 'work ethic', 'customer focus',
];

// ── Core API ──

/** Get the persisted twin (fast path — single Firestore read) */
export async function getTwin(uid: string): Promise<CareerTwin | null> {
  const db = getAdminDb();
  const doc = await db.collection('users').doc(uid)
    .collection('profile').doc(TWIN_DOC_PATH).get();

  if (!doc.exists) return null;

  const data = doc.data() as CareerTwin;

  // Check if stale (marked by invalidation)
  if (data.stale) return null;

  return data;
}

/** Compute fresh profile and persist as twin */
export async function computeAndPersistTwin(uid: string): Promise<CareerTwin> {
  const db = getAdminDb();
  const profile = await computeCareerProfile(uid);

  // Enrich with background data from resume
  const background = await extractBackground(uid, db);

  // Compute behavioral bank coverage
  const behavioralBank = computeBehavioralCoverage(profile);

  // Compute completeness
  const completeness = computeCompleteness(profile, background, behavioralBank);

  const twin: CareerTwin = {
    ...profile,
    version: TWIN_VERSION,
    stale: false,
    background,
    behavioralBank,
    completeness,
    exportable: completeness.score >= 60,
  };

  // Persist to Firestore
  await db.collection('users').doc(uid)
    .collection('profile').doc(TWIN_DOC_PATH)
    .set(twin, { merge: false });

  return twin;
}

/** Mark twin as stale (called when source data changes) */
export async function invalidateTwin(uid: string): Promise<void> {
  const db = getAdminDb();
  try {
    await db.collection('users').doc(uid)
      .collection('profile').doc(TWIN_DOC_PATH)
      .update({ stale: true });
  } catch {
    // Doc might not exist yet, that's fine
  }
}

/** Get twin with auto-refresh: tries cache first, recomputes if stale */
export async function getOrComputeTwin(uid: string): Promise<CareerTwin> {
  const existing = await getTwin(uid);
  if (existing) return existing;
  return computeAndPersistTwin(uid);
}

/** Export twin as a clean JSON object (for external tools) */
export function exportTwinJSON(twin: CareerTwin): object {
  return {
    profile: {
      healthScore: twin.healthScore,
      daysActive: twin.daysActive,
      estimatedWeeksToOffer: twin.estimatedWeeksToOffer,
    },
    background: twin.background,
    skills: twin.skills,
    pipeline: {
      totalApplications: twin.pipeline.totalApps,
      velocity: twin.pipeline.velocity,
      responseRate: twin.pipeline.responseRate,
      ghostRate: twin.pipeline.ghostRate,
      topCompanies: twin.pipeline.topCompanies,
    },
    interviews: {
      totalDebriefs: twin.interviews.totalDebriefs,
      passRate: twin.interviews.passRate,
      avgConfidence: twin.interviews.avgConfidence,
      trend: twin.interviews.confidenceTrend,
      weakAreas: twin.interviews.weakCategories.map(c => c.category),
      strongAreas: twin.interviews.strongCategories.map(c => c.category),
    },
    behavioralCoverage: twin.behavioralBank,
    morale: {
      current: twin.morale.current,
      trend: twin.morale.trend,
      burnoutRisk: twin.morale.burnoutRisk,
    },
    meta: {
      computedAt: twin.computedAt,
      version: twin.version,
      completeness: twin.completeness.score,
    },
  };
}

// ── Internal Helpers ──

async function extractBackground(uid: string, db: FirebaseFirestore.Firestore) {
  const background = {
    currentTitle: '',
    targetRoles: [] as string[],
    industries: [] as string[],
    education: [] as string[],
  };

  try {
    // Get latest resume for title/education
    const resumeSnap = await db.collection('users').doc(uid)
      .collection('resume_versions').orderBy('created_at', 'desc').limit(1).get();

    if (!resumeSnap.empty) {
      const resume = resumeSnap.docs[0].data();
      const content = resume.content || {};

      // Current title from most recent experience
      if (content.experience?.length > 0) {
        background.currentTitle = content.experience[0].title || '';
      }

      // Education
      if (content.education?.length > 0) {
        background.education = content.education.map((e: any) =>
          `${e.degree || ''} ${e.field || ''} — ${e.school || ''}`.trim()
        ).filter(Boolean);
      }
    }

    // Get job search preferences for target roles
    const prefsDoc = await db.collection('users').doc(uid)
      .collection('preferences').doc('job_search').get();

    if (prefsDoc.exists) {
      const prefs = prefsDoc.data()!;
      if (prefs.targetRoles) background.targetRoles = prefs.targetRoles;
      if (prefs.industries) background.industries = prefs.industries;
    }
  } catch {
    // Non-critical — return partial background
  }

  return background;
}

function computeBehavioralCoverage(profile: CareerProfile) {
  const coveredTags = new Set(
    profile.stories.tagDistribution.map(t => t.tag.toLowerCase())
  );

  const coveredCategories = BEHAVIORAL_CATEGORIES.filter(c =>
    coveredTags.has(c)
  );
  const uncoveredCategories = BEHAVIORAL_CATEGORIES.filter(c =>
    !coveredTags.has(c)
  );

  const coverageScore = Math.round(
    (coveredCategories.length / BEHAVIORAL_CATEGORIES.length) * 100
  );

  return {
    totalStories: profile.stories.totalStories,
    coveredCategories,
    uncoveredCategories,
    coverageScore,
  };
}

function computeCompleteness(
  profile: CareerProfile,
  background: { currentTitle: string; targetRoles: string[]; education: string[] },
  behavioral: { coverageScore: number; totalStories: number }
) {
  const checks: { label: string; met: boolean }[] = [
    { label: 'Resume uploaded', met: profile.hasResume },
    { label: 'Current job title', met: !!background.currentTitle },
    { label: 'Target roles defined', met: background.targetRoles.length > 0 },
    { label: 'Skills confirmed (5+)', met: profile.skills.confirmed.length >= 5 },
    { label: 'At least 1 application tracked', met: profile.pipeline.totalApps > 0 },
    { label: 'At least 1 interview debrief', met: profile.interviews.totalDebriefs > 0 },
    { label: 'At least 3 STAR stories', met: behavioral.totalStories >= 3 },
    { label: 'Behavioral coverage > 25%', met: behavioral.coverageScore >= 25 },
    { label: 'Morale check recorded', met: profile.morale.history.length > 0 },
    { label: 'Education info present', met: background.education.length > 0 },
  ];

  const score = Math.round((checks.filter(c => c.met).length / checks.length) * 100);
  const missing = checks.filter(c => !c.met).map(c => c.label);

  return { score, missing };
}
