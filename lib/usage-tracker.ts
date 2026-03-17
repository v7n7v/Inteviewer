/**
 * Lifetime Usage Tracker
 * Server-side enforcement of free tier caps via Firestore.
 * Path: users/{uid}/usage/lifetime
 */

import { getFirestore, doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { PlanTier } from './pricing-tiers';

// ── Feature Keys ──
export type UsageFeature = 'morphs' | 'gauntlets' | 'flashcards' | 'jdGenerations' | 'coverLetters' | 'resumeChecks' | 'linkedinProfiles';

// ── Free Tier Lifetime Caps ──
export const FREE_CAPS: Record<UsageFeature, number> = {
  morphs: 3,
  gauntlets: 3,
  flashcards: 2,
  jdGenerations: 3,
  coverLetters: 2,
  resumeChecks: 3,
  linkedinProfiles: 2,
};

// ── Usage Data Shape ──
export interface UsageData {
  morphs: number;
  gauntlets: number;
  flashcards: number;
  jdGenerations: number;
  coverLetters: number;
  resumeChecks: number;
  linkedinProfiles: number;
}

const DEFAULT_USAGE: UsageData = {
  morphs: 0,
  gauntlets: 0,
  flashcards: 0,
  jdGenerations: 0,
  coverLetters: 0,
  resumeChecks: 0,
  linkedinProfiles: 0,
};

// ── Firebase Client (server-side) ──
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

function getDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function usageDocRef(uid: string) {
  return doc(getDb(), 'users', uid, 'usage', 'lifetime');
}

/** Get current usage counts */
export async function getUsage(uid: string): Promise<UsageData> {
  try {
    const snap = await getDoc(usageDocRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        morphs: data.morphs ?? 0,
        gauntlets: data.gauntlets ?? 0,
        flashcards: data.flashcards ?? 0,
        jdGenerations: data.jdGenerations ?? 0,
        coverLetters: data.coverLetters ?? 0,
        resumeChecks: data.resumeChecks ?? 0,
        linkedinProfiles: data.linkedinProfiles ?? 0,
      };
    }
    return { ...DEFAULT_USAGE };
  } catch {
    return { ...DEFAULT_USAGE };
  }
}

/** Increment usage for a feature. Call AFTER a successful action. */
export async function incrementUsage(uid: string, feature: UsageFeature): Promise<void> {
  try {
    await setDoc(
      usageDocRef(uid),
      { [feature]: increment(1) },
      { merge: true }
    );
  } catch (err) {
    console.error(`Failed to increment usage for ${uid}:${feature}`, err);
  }
}

/**
 * Check if user is allowed to perform an action.
 * Pro users always pass. Free users are checked against lifetime caps.
 * Returns { allowed, remaining, cap } or throws a descriptive error.
 */
export async function checkUsageAllowed(
  uid: string,
  feature: UsageFeature,
  tier: PlanTier
): Promise<{ allowed: boolean; used: number; cap: number; remaining: number }> {
  // Pro users: unlimited
  if (tier === 'pro') {
    return { allowed: true, used: 0, cap: Infinity, remaining: Infinity };
  }

  const usage = await getUsage(uid);
  const used = usage[feature];
  const cap = FREE_CAPS[feature];
  const remaining = Math.max(0, cap - used);

  return {
    allowed: used < cap,
    used,
    cap,
    remaining,
  };
}
