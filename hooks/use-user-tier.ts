'use client';

/**
 * useUserTier — Client-side hook for tier + usage awareness
 * Fetches from /api/usage on mount and exposes tier, usage, and helper methods
 */

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useStore } from '@/lib/store';
import type { UsageData } from '@/lib/usage-tracker';

export type PlanTier = 'free' | 'pro';

interface TierState {
  tier: PlanTier;
  usage: UsageData;
  caps: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  canUse: (feature: keyof UsageData) => boolean;
  remaining: (feature: keyof UsageData) => number;
}

const DEFAULT_USAGE: UsageData = { morphs: 0, gauntlets: 0, flashcards: 0, jdGenerations: 0 };
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
        setTier(data.tier || 'free');
        setUsage(data.usage || DEFAULT_USAGE);
        setCaps(data.caps || null);
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

  const canUse = useCallback(
    (feature: keyof UsageData): boolean => {
      if (tier === 'pro') return true;
      if (!caps) return true;
      return (usage[feature] ?? 0) < (caps[feature] ?? Infinity);
    },
    [tier, usage, caps]
  );

  const remaining = useCallback(
    (feature: keyof UsageData): number => {
      if (tier === 'pro') return Infinity;
      if (!caps) return Infinity;
      return Math.max(0, (caps[feature] ?? 0) - (usage[feature] ?? 0));
    },
    [tier, usage, caps]
  );

  return { tier, usage, caps, loading, error, refetch: fetchUsage, canUse, remaining };
}
