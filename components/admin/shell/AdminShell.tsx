'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AdminModuleNav } from './AdminModuleNav';
import { AdminSessionProvider, useAdminSession } from './AdminSessionProvider';
import { AdminTopbar } from './AdminTopbar';
import { AdminUiPreferencesProvider, useAdminUiPreferences } from './AdminUiPreferences';
import { AdminStateBoundary } from '../primitives/AdminStateBoundary';

const LegacyAdminAccessRollback = dynamic(
  () => import('../legacy/LegacyAdminAccessRollback').then(module => module.LegacyAdminAccessRollback),
  { ssr: false },
);

function AdminShellFrame({ children }: { children: ReactNode }) {
  const { density, savedView } = useAdminUiPreferences();
  const { session, status, error, refresh } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'ready' || pathname !== '/suite/admin' || savedView === 'command') return;
    const route = savedView === 'operations'
      ? '/suite/admin/operations'
      : savedView === 'finance'
        ? '/suite/admin/finance'
        : '/suite/admin/support';
    router.replace(route);
  }, [pathname, router, savedView, status]);

  if (status !== 'ready' || !session) {
    return (
      <div
        className="admin-command-grid admin-session-gate"
        data-admin-density={density}
        data-admin-view={savedView}
      >
        <div className="admin-session-gate-inner">
          <AdminStateBoundary
            state={status === 'loading' ? 'loading' : status === 'denied' ? 'unauthorized' : 'error'}
            title={status === 'denied' ? 'Admin access required' : 'Admin verification unavailable'}
            message={error || (status === 'loading'
              ? 'Verifying your role, permissions, token version, and session posture.'
              : 'The Admin session could not be verified.')}
            onRetry={status === 'loading' ? undefined : () => void refresh()}
          >
            <span />
          </AdminStateBoundary>
        </div>
      </div>
    );
  }

  const commandGridEnabled = process.env.NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2 === 'true'
    || (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ADMIN_COMMAND_GRID_V2 !== 'false');

  if (!commandGridEnabled) {
    return <LegacyAdminAccessRollback />;
  }

  return (
    <div
      className="admin-command-grid"
      data-admin-density={density}
      data-admin-view={savedView}
    >
      <a className="admin-skip-link" href="#admin-main-content">Skip to Admin content</a>
      <AdminTopbar />
      <AdminModuleNav />
      <div id="admin-main-content" className="admin-shell-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminUiPreferencesProvider>
        <AdminShellFrame>{children}</AdminShellFrame>
      </AdminUiPreferencesProvider>
    </AdminSessionProvider>
  );
}
