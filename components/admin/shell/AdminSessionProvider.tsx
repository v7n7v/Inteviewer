'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authFetch } from '@/lib/auth-fetch';
import {
  ADMIN_PERMISSIONS,
  isAdminRole,
  type AdminPermission,
  type AdminRole,
} from '@/lib/admin-permissions';
import { useAdminVisualReview } from '@/components/admin/visual-review/AdminVisualReviewContext';

export interface AdminSession {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: readonly AdminPermission[];
  mfaSatisfied: boolean;
  mfaEnforced: boolean;
  mutationReady: boolean;
  features: {
    observability: boolean;
  };
}

type AdminSessionStatus = 'loading' | 'ready' | 'denied' | 'error';

interface AdminSessionContextValue {
  session: AdminSession | null;
  status: AdminSessionStatus;
  error: string;
  refresh: () => Promise<void>;
  hasPermission: (permission: AdminPermission) => boolean;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AdminSession>;
  return typeof session.uid === 'string'
    && typeof session.email === 'string'
    && typeof session.displayName === 'string'
    && isAdminRole(session.role)
    && Array.isArray(session.permissions)
    && session.permissions.every(
      permission => typeof permission === 'string'
        && (ADMIN_PERMISSIONS as readonly string[]).includes(permission),
    )
    && typeof session.mfaSatisfied === 'boolean'
    && typeof session.mfaEnforced === 'boolean'
    && typeof session.mutationReady === 'boolean'
    && typeof session.features?.observability === 'boolean';
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const visualReview = useAdminVisualReview();
  const [session, setSession] = useState<AdminSession | null>(visualReview?.session || null);
  const [status, setStatus] = useState<AdminSessionStatus>(visualReview ? 'ready' : 'loading');
  const [error, setError] = useState('');

  const loadSession = useCallback(async (signal?: AbortSignal) => {
    if (visualReview) {
      setSession(visualReview.session);
      setStatus('ready');
      setError('');
      return;
    }
    setError('');

    try {
      const response = await authFetch('/api/admin/session', {
        cache: 'no-store',
        signal,
      });
      const payload = await response.json().catch(() => ({})) as {
        admin?: unknown;
        error?: string;
      };

      if (!response.ok || !isAdminSession(payload.admin)) {
        setSession(null);
        setStatus(response.status === 401 || response.status === 403 ? 'denied' : 'error');
        setError(payload.error || 'This account does not have active admin access.');
        return;
      }

      setSession(payload.admin);
      setStatus('ready');
    } catch (sessionError) {
      if (signal?.aborted) return;
      setSession(null);
      setStatus('error');
      setError(sessionError instanceof Error ? sessionError.message : 'Admin access could not be verified.');
    }
  }, [visualReview]);

  useEffect(() => {
    const controller = new AbortController();
    if (visualReview) return () => controller.abort();
    void loadSession(controller.signal);
    return () => controller.abort();
  }, [loadSession, visualReview]);

  useEffect(() => {
    const invalidate = (event: Event) => {
      if (visualReview) return;
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setSession(null);
      setStatus('denied');
      setError(detail?.message || 'This Admin session is no longer authorized.');
    };
    window.addEventListener('admin-session-invalid', invalidate);
    return () => window.removeEventListener('admin-session-invalid', invalidate);
  }, [visualReview]);

  const refresh = useCallback(async () => {
    setStatus('loading');
    await loadSession();
  }, [loadSession]);

  const value = useMemo<AdminSessionContextValue>(() => ({
    session,
    status,
    error,
    refresh,
    hasPermission: permission => {
      const mutationPermission = permission === 'admin.accounts.manage'
        || permission === 'users.manage'
        || permission === 'billing.manage'
        || permission === 'support.manage'
        || permission === 'operations.manage'
        || permission === 'settings.manage'
        || permission === 'email.send';
      return session?.permissions.includes(permission) === true
        && (!mutationPermission || session.mutationReady);
    },
  }), [error, refresh, session, status]);

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error('useAdminSession must be used within AdminSessionProvider.');
  return value;
}
