'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useAdminVisualReview } from '@/components/admin/visual-review/AdminVisualReviewContext';

interface AdminResourceOptions<T> {
  enabled?: boolean;
  intervalMs?: number | null;
  staleAfterMs?: number;
  initialData?: T | null;
  parse?: (payload: unknown) => T;
}

interface AdminResourceState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  disconnected: boolean;
  error: string;
  lastUpdatedAt: string | null;
  refresh: () => Promise<void>;
}

function defaultParse<T>(payload: unknown) {
  return payload as T;
}

export function useAdminResource<T>(
  endpoint: string,
  options: AdminResourceOptions<T> = {},
): AdminResourceState<T> {
  const visualReview = useAdminVisualReview();
  const {
    enabled = true,
    intervalMs = null,
    staleAfterMs = intervalMs ? intervalMs * 2 : 60_000,
    initialData = null,
    parse = defaultParse<T>,
  } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(enabled && initialData === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [sourceStaleAfterMs, setSourceStaleAfterMs] = useState(staleAfterMs);
  const [clock, setClock] = useState(Date.now());
  const [online, setOnline] = useState(true);
  const requestSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const failureCount = useRef(0);
  const hasData = useRef(initialData !== null);
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const visualFixture = visualReview?.resources[endpoint];

  const load = useCallback(async (background = false) => {
    if (visualFixture !== undefined) {
      const fixture = parseRef.current(visualFixture);
      const fixtureMeta = visualFixture as { meta?: { generatedAt?: unknown; staleAfterMs?: unknown } };
      setData(fixture);
      hasData.current = true;
      setLoading(false);
      setRefreshing(false);
      setError('');
      setLastUpdatedAt(
        typeof fixtureMeta.meta?.generatedAt === 'string'
          ? fixtureMeta.meta.generatedAt
          : new Date().toISOString(),
      );
      const fixtureStaleAfterMs = Number(fixtureMeta.meta?.staleAfterMs);
      if (Number.isFinite(fixtureStaleAfterMs) && fixtureStaleAfterMs > 0) {
        setSourceStaleAfterMs(fixtureStaleAfterMs);
      }
      return;
    }
    const browserOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (!enabled || !browserOnline) {
      if (!browserOnline) {
        setError('Offline — showing the last verified Admin evidence.');
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    if (background || hasData.current) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await authFetch(endpoint, {
        cache: 'no-store',
        signal: nextController.signal,
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        meta?: { generatedAt?: unknown; staleAfterMs?: unknown };
      };
      if (sequence !== requestSequence.current) return;
      if (!response.ok) {
        if (response.status === 401) {
          setData(null);
          hasData.current = false;
          window.dispatchEvent(new CustomEvent('admin-session-invalid', {
            detail: {
              status: response.status,
              message: payload.error || 'This Admin session is no longer authorized.',
            },
          }));
        }
        throw new Error(payload.error || 'Admin evidence could not be loaded.');
      }
      const nextData = parseRef.current(payload);
      setData(nextData);
      hasData.current = true;
      const generatedAt = typeof payload.meta?.generatedAt === 'string'
        && Number.isFinite(new Date(payload.meta.generatedAt).getTime())
        ? payload.meta.generatedAt
        : new Date().toISOString();
      const reportedStaleAfterMs = Number(payload.meta?.staleAfterMs);
      setLastUpdatedAt(generatedAt);
      setSourceStaleAfterMs(
        Number.isFinite(reportedStaleAfterMs) && reportedStaleAfterMs > 0
          ? reportedStaleAfterMs
          : staleAfterMs,
      );
      setClock(Date.now());
      setError('');
      failureCount.current = 0;
    } catch (loadError) {
      if (nextController.signal.aborted || sequence !== requestSequence.current) return;
      failureCount.current += 1;
      setError(loadError instanceof Error ? loadError.message : 'Admin evidence could not be loaded.');
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled, endpoint, staleAfterMs, visualFixture]);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    void load(false);
    return () => controller.current?.abort();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      const backoff = Math.min(8, 2 ** failureCount.current);
      const jitter = 0.9 + Math.random() * 0.2;
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          await load(true);
        }
        schedule();
      }, intervalMs * backoff * jitter);
    };
    const resume = () => {
      const lastUpdateMs = lastUpdatedAt ? new Date(lastUpdatedAt).getTime() : 0;
      const oldEnough = !lastUpdateMs
        || Date.now() - lastUpdateMs >= Math.min(intervalMs, sourceStaleAfterMs) / 2;
      if (document.visibilityState === 'visible' && navigator.onLine && oldEnough) {
        void load(true);
      }
      schedule();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', schedule);
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', schedule);
    };
  }, [enabled, intervalMs, lastUpdatedAt, load, sourceStaleAfterMs]);

  useEffect(() => {
    if (!lastUpdatedAt) return undefined;
    const sourceTime = new Date(lastUpdatedAt).getTime();
    const remaining = Math.max(0, sourceStaleAfterMs - (Date.now() - sourceTime));
    const timer = window.setTimeout(() => setClock(Date.now()), remaining + 25);
    return () => window.clearTimeout(timer);
  }, [lastUpdatedAt, sourceStaleAfterMs]);

  const stale = !lastUpdatedAt
    || clock - new Date(lastUpdatedAt).getTime() > sourceStaleAfterMs
    || !online
    || Boolean(error && data);

  return {
    data,
    loading,
    refreshing,
    stale,
    disconnected: !online,
    error,
    lastUpdatedAt,
    refresh: () => load(true),
  };
}
