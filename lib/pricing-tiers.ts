/**
 * Pricing Tier Configuration
 * Free tier: current limits
 * Pro tier ($2.99/mo): 3x free limits
 */

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

export type PlanTier = 'free' | 'pro';

export const PLAN_PRICE = {
  free: 0,
  pro: 2.99, // USD/month
} as const;

/** Rate limits per route per tier (requests per minute) */
export const RATE_LIMITS: Record<string, Record<PlanTier, number>> = {
  '/api/resume/morph':        { free: 1,  pro: 3  },
  '/api/resume/parse':        { free: 5,  pro: 15 },
  '/api/resume/ai':           { free: 5,  pro: 15 },
  '/api/voice/transcribe':    { free: 5,  pro: 15 },
  '/api/voice/speak':         { free: 5,  pro: 15 },
  '/api/gauntlet/grade':      { free: 7,  pro: 21 },
  '/api/gauntlet/generate':   { free: 7,  pro: 21 },
  '/api/gauntlet/parse-resume': { free: 5, pro: 15 },
  '/api/chat':                { free: 10, pro: 30 },
  '/api/ai':                  { free: 10, pro: 30 },
  '/api/jobs/search':         { free: 10, pro: 30 },
  '/api/dashboard/insights':  { free: 5,  pro: 15 },
} as const;

/** Get rate limit for a route based on tier */
export function getRateLimit(route: string, tier: PlanTier = 'free'): number {
  const limits = RATE_LIMITS[route];
  if (!limits) return tier === 'pro' ? 30 : 10; // default fallback
  return limits[tier];
}

// Firebase client for Firestore reads
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

function getDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

/** Check user's subscription tier from Firestore */
export async function getUserTier(uid: string): Promise<PlanTier> {
  try {
    const db = getDb();
    const subDoc = await getDoc(doc(db, 'users', uid, 'subscription', 'current'));
    if (subDoc.exists() && subDoc.data()?.status === 'active' && subDoc.data()?.plan === 'pro') {
      return 'pro';
    }
    return 'free';
  } catch {
    return 'free';
  }
}
