'use client';

/**
 * useUserTier — Client-side hook for tier + usage awareness
 * Fetches from /api/usage on mount and exposes tier, usage, and helper methods.
 * Auto-detects upgrade success from URL params and refetches.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useStore } from '@/lib/store';
import type { UsageData } from '@/lib/usage-tracker';

export type PlanTier = 'free' | 'pro' | 'god';

interface TierState {
  tier: PlanTier;
  isPro: boolean; // true for 'pro' OR 'god'
  usage: UsageData;
  caps: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  canUse: (feature: keyof UsageData) => boolean;
  remaining: (feature: keyof UsageData) => number;
}

const DEFAULT_USAGE: UsageData = { morphs: 0, gauntlets: 0, flashcards: 0, jdGenerations: 0, coverLetters: 0, resumeChecks: 0, linkedinProfiles: 0 };
const DEFAULT_CAPS: Record<string, number> = { morphs: 3, gauntlets: 3, flashcards: 2, jdGenerations: 3 };

export function useUserTier(): TierState {
  const user = useStore((s) => s.user);
  const [tier, setTier] = useState<PlanTier>('free');
  const [usage, setUsage] = useState<UsageData>(DEFAULT_USAGE);
  const [caps, setCaps] = useState<Record<string, number> | null>(DEFAULT_CAPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await authFetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        const serverTier = data.tier || 'free';
        setTier(serverTier);
        setUsage(data.usage || DEFAULT_USAGE);
        setCaps(serverTier === 'free' ? (data.caps || DEFAULT_CAPS) : null);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Auto-detect upgrade success from URL params and refetch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      // Clean the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Wait a moment for webhook to fire, then refetch
      const timer = setTimeout(() => fetchUsage(), 2000);
      return () => clearTimeout(timer);
    }
  }, [fetchUsage]);

  const isPro = useMemo(() => tier === 'pro' || tier === 'god', [tier]);

  const canUse = useCallback(
    (feature: keyof UsageData): boolean => {
      if (isPro) return true;
      if (!caps) return true;
      return (usage[feature] ?? 0) < (caps[feature] ?? Infinity);
    },
    [isPro, usage, caps]
  );

  const remaining = useCallback(
    (feature: keyof UsageData): number => {
      if (isPro) return Infinity;
      if (!caps) return Infinity;
      return Math.max(0, (caps[feature] ?? 0) - (usage[feature] ?? 0));
    },
    [isPro, usage, caps]
  );

  return { tier, isPro, usage, caps, loading, error, refetch: fetchUsage, canUse, remaining };
}
