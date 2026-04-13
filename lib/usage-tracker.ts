/**
 * Lifetime Usage Tracker
 * Server-side enforcement of free tier caps via Firestore.
 * Path: users/{uid}/usage/lifetime
 * Voice: users/{uid}/usage/voice_monthly
 */

import { getFirestore, doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { PlanTier } from './pricing-tiers';

// ── Feature Keys ──
export type UsageFeature = 'morphs' | 'gauntlets' | 'flashcards' | 'jdGenerations' | 'coverLetters' | 'resumeChecks' | 'linkedinProfiles';

// ── Free Tier Lifetime Caps ──
/** 3 forever — no resets, no exceptions for free tier */
export const FREE_CAPS: Record<UsageFeature, number> = {
  morphs: 3,
  gauntlets: 3,
  flashcards: 3,
  jdGenerations: 3,
  coverLetters: 3,
  resumeChecks: 3,
  linkedinProfiles: 3,
};

// ── Anonymous (No Account) Caps ──
/** 1 taste test per tool — then force signup. In-memory per IP. */
export const ANON_CAPS: Record<UsageFeature, number> = {
  morphs: 1,
  gauntlets: 1,
  flashcards: 1,
  jdGenerations: 1,
  coverLetters: 1,
  resumeChecks: 1,
  linkedinProfiles: 1,
};

// ── Voice Minute Caps (per month) ──
export const VOICE_MINUTE_CAPS: Record<Exclude<PlanTier, 'god'>, number> = {
  free: 0,    // Free users get no voice
  pro: 15,    // 15 minutes/month for Pro
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

export interface VoiceUsageData {
  usedSeconds: number;
  month: string; // "2026-03" format for monthly reset
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

function voiceDocRef(uid: string) {
  return doc(getDb(), 'users', uid, 'usage', 'voice_monthly');
}

/** Current month key for reset detection */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
  // Pro & GOD users: unlimited
  if (tier === 'pro' || tier === 'god') {
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

// ═══════════════════════════════════════════════
// VOICE MINUTE TRACKING (Monthly Reset)
// ═══════════════════════════════════════════════

/** Get current month's voice usage in seconds */
export async function getVoiceUsage(uid: string): Promise<VoiceUsageData> {
  try {
    const snap = await getDoc(voiceDocRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const storedMonth = data.month || '';
      const thisMonth = currentMonthKey();

      // Auto-reset if new month
      if (storedMonth !== thisMonth) {
        return { usedSeconds: 0, month: thisMonth };
      }
      return { usedSeconds: data.usedSeconds ?? 0, month: thisMonth };
    }
    return { usedSeconds: 0, month: currentMonthKey() };
  } catch {
    return { usedSeconds: 0, month: currentMonthKey() };
  }
}

/**
 * Check if user has voice minutes remaining.
 * Free users: 0 minutes (voice is Pro-only).
 * Pro users: 15 minutes/month.
 */
export async function checkVoiceAllowed(
  uid: string,
  tier: PlanTier
): Promise<{ allowed: boolean; usedSeconds: number; capSeconds: number; remainingSeconds: number }> {
  const capMinutes = tier === 'god' ? Infinity : (VOICE_MINUTE_CAPS[tier as Exclude<PlanTier, 'god'>] || 0);
  const capSeconds = capMinutes * 60;

  if (capSeconds === 0) {
    return { allowed: false, usedSeconds: 0, capSeconds: 0, remainingSeconds: 0 };
  }

  const voice = await getVoiceUsage(uid);
  const remainingSeconds = Math.max(0, capSeconds - voice.usedSeconds);

  return {
    allowed: voice.usedSeconds < capSeconds,
    usedSeconds: voice.usedSeconds,
    capSeconds,
    remainingSeconds,
  };
}

/**
 * Record voice usage in seconds. Call AFTER a successful TTS/STT operation.
 * Automatically resets if a new month has started.
 */
export async function recordVoiceUsage(uid: string, seconds: number): Promise<void> {
  try {
    const thisMonth = currentMonthKey();
    const current = await getVoiceUsage(uid);

    if (current.month !== thisMonth) {
      // New month — reset counter
      await setDoc(voiceDocRef(uid), {
        usedSeconds: seconds,
        month: thisMonth,
        lastUsed: new Date().toISOString(),
      });
    } else {
      // Same month — increment
      await setDoc(
        voiceDocRef(uid),
        {
          usedSeconds: increment(seconds),
          month: thisMonth,
          lastUsed: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error(`Failed to record voice usage for ${uid}`, err);
  }
}

/**
 * Estimate TTS duration from text.
 * Average speaking rate: ~150 words/min, ~5 chars/word → ~750 chars/min → ~12.5 chars/sec
 */
export function estimateTTSSeconds(text: string): number {
  const chars = text.trim().length;
  return Math.max(1, Math.ceil(chars / 12.5));
}

/**
 * Estimate STT duration from audio file size.
 * WebM/Opus at ~32kbps → ~4KB/sec. Conservative estimate.
 */
export function estimateSTTSeconds(fileSizeBytes: number): number {
  return Math.max(1, Math.ceil(fileSizeBytes / 4000));
}
