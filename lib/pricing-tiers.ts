/**
 * Pricing Tier Configuration
 * Free tier: limited trial access — account required
 * Pro tier ($4.99/mo): 3x free limits + priority queue
 */

import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

export type PlanTier = 'free' | 'pro' | 'studio' | 'god';

/**
 * GOD account — absolute root access. Can grant/revoke premium, bypass ALL limits.
 */
export const GOD_EMAILS: string[] = [
  'alula2006@gmail.com',
];

/**
 * Master test accounts — always treated as 'pro' tier.
 * Works on both localhost and cloud deployments.
 */
export const MASTER_EMAILS: string[] = [
  'alula2006@gmail.com',
];

/** Check if an email is the GOD (root) account */
export function isGodAccount(email?: string): boolean {
  return !!email && GOD_EMAILS.includes(email.toLowerCase());
}

/** Check if an email is a master (admin) account */
export function isMasterAccount(email?: string): boolean {
  return !!email && (MASTER_EMAILS.includes(email.toLowerCase()) || GOD_EMAILS.includes(email.toLowerCase()));
}

export const PLAN_PRICE = {
  free: 0,
  pro_monthly: 4.99,
  pro_annual: 49.99, // $4.17/mo effective — 17% discount vs monthly
  studio_monthly: 9.99,
  studio_annual: 89.99, // $7.50/mo effective — 25% discount vs monthly
} as const;

/** Rate limits per route per tier (requests per minute). GOD bypasses this entirely. */
export const RATE_LIMITS: Record<string, Record<Exclude<PlanTier, 'god'>, number>> = {
  '/api/resume/morph':          { free: 2,  pro: 10, studio: 10 },
  '/api/resume/parse':          { free: 5,  pro: 20, studio: 20 },
  '/api/resume/ai':             { free: 3,  pro: 15, studio: 15 },
  '/api/voice/transcribe':      { free: 3,  pro: 15, studio: 15 },
  '/api/voice/speak':           { free: 3,  pro: 15, studio: 15 },
  '/api/gauntlet/grade':        { free: 5,  pro: 25, studio: 25 },
  '/api/gauntlet/generate':     { free: 5,  pro: 25, studio: 25 },
  '/api/gauntlet/parse-resume': { free: 3,  pro: 15, studio: 15 },
  '/api/vault/list':            { free: 10, pro: 50, studio: 50 },
  '/api/vault/export-plan':     { free: 2,  pro: 20, studio: 20 },
  '/api/study-progress':        { free: 5,  pro: 25, studio: 25 },
  '/api/chat':                  { free: 5,  pro: 30, studio: 30 },
  '/api/ai':                    { free: 5,  pro: 30, studio: 30 },
  '/api/jobs/search':           { free: 5,  pro: 30, studio: 30 },
  '/api/market-oracle':         { free: 2,  pro: 15, studio: 15 },
  '/api/dashboard/insights':    { free: 3,  pro: 15, studio: 15 },
  '/api/writing/humanize':      { free: 0,  pro: 5,  studio: 15 },
  '/api/writing/uniqueness':    { free: 0,  pro: 5,  studio: 15 },
} as const;

/** Get rate limit for a route based on tier */
export function getRateLimit(route: string, tier: PlanTier = 'free'): number {
  if (tier === 'god') return Infinity;
  const limits = RATE_LIMITS[route];
  if (!limits) return (tier === 'pro' || tier === 'studio') ? 30 : 10;
  return limits[tier as Exclude<PlanTier, 'god'>] || limits['pro'] || 30;
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

/** Check user's subscription tier from Firestore (with master/god override) */
export async function getUserTier(uid: string, email?: string): Promise<PlanTier> {
  // GOD account — instant god tier
  if (email && GOD_EMAILS.includes(email.toLowerCase())) {
    return 'god';
  }
  // Master account override — instant studio (Max)
  if (email && MASTER_EMAILS.includes(email.toLowerCase())) {
    return 'studio';
  }
  try {
    const db = getDb();
    const subDoc = await getDoc(doc(db, 'users', uid, 'subscription', 'current'));
    if (subDoc.exists() && subDoc.data()?.status === 'active') {
      const plan = subDoc.data()?.plan;
      if (plan === 'studio') return 'studio';
      if (plan === 'pro') return 'pro';
    }
    return 'free';
  } catch {
    return 'free';
  }
}

// ═══════════════════════════════════════
// GOD ACCOUNT POWERS
// ═══════════════════════════════════════

/** Grant premium access to any user (GOD only) */
export async function grantPremiumAccess(targetUid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    await setDoc(doc(db, 'users', targetUid, 'subscription', 'current'), {
      plan: 'pro',
      status: 'active',
      grantedBy: 'god_account',
      grantedAt: new Date().toISOString(),
      reason: 'manual_grant',
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Revoke premium access from any user (GOD only) */
export async function revokePremiumAccess(targetUid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    await deleteDoc(doc(db, 'users', targetUid, 'subscription', 'current'));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** List all users with their subscription status (GOD only) */
export async function listAllUsers(): Promise<{ uid: string; email?: string; plan: PlanTier }[]> {
  try {
    const db = getDb();
    const usersSnap = await getDocs(collection(db, 'users'));
    const users: { uid: string; email?: string; plan: PlanTier }[] = [];
    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      let plan: PlanTier = 'free';
      try {
        const subDoc = await getDoc(doc(db, 'users', userDoc.id, 'subscription', 'current'));
        if (subDoc.exists() && subDoc.data()?.status === 'active') plan = 'pro';
      } catch {}
      if (GOD_EMAILS.includes(data.email?.toLowerCase())) plan = 'god';
      users.push({ uid: userDoc.id, email: data.email, plan });
    }
    return users;
  } catch {
    return [];
  }
}
