'use client';

import { useEffect, useState } from 'react';
import {
  type PublicBillingPrices,
  unavailableBillingPrices,
} from '@/lib/billing-price-types';

export function useBillingPrices() {
  const [prices, setPrices] = useState<PublicBillingPrices>(unavailableBillingPrices);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/billing/prices');
        if (!res.ok) throw new Error('Could not load pricing');
        const data = await res.json();
        if (!cancelled) setPrices(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load pricing');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPrices();

    return () => {
      cancelled = true;
    };
  }, []);

  return { prices, loading, error };
}
