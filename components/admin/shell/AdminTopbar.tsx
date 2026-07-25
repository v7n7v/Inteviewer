'use client';

import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { ADMIN_ROLE_LABELS } from '@/lib/admin-permissions';
import { AdminSearch } from './AdminSearch';
import { AdminSavedViewMenu } from './AdminSavedViewMenu';
import { useAdminSession } from './AdminSessionProvider';

export function AdminTopbar() {
  const { theme, toggleTheme } = useTheme();
  const { session, status } = useAdminSession();
  const profileName = session?.displayName || session?.email.split('@')[0] || 'Admin';
  const profileInitial = profileName.slice(0, 1).toUpperCase();

  return (
    <header className="admin-topbar">
      <div className="admin-product-title">
        <span className="admin-product-name">Talent Admin</span>
        <span
          className={`admin-connection ${status === 'ready' ? 'is-ready' : status === 'denied' ? 'is-denied' : 'is-loading'}`}
          aria-label="Admin authentication state"
        >
          <span className="admin-connection-dot" aria-hidden="true" />
          {status === 'ready' ? 'Admin session verified' : status === 'denied' ? 'Access unverified' : 'Verifying session'}
        </span>
      </div>

      <AdminSearch />

      <div className="admin-topbar-actions">
        <AdminSavedViewMenu />
        <button
          type="button"
          onClick={toggleTheme}
          className="admin-theme-toggle"
          aria-label={theme === 'dark' ? 'Switch Admin to light mode' : 'Switch Admin to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          <span className="admin-theme-toggle-track" aria-hidden="true">
            <span className="admin-theme-toggle-thumb" />
          </span>
        </button>

        <details className="admin-menu admin-profile">
          <summary className="admin-profile-trigger" aria-label={`Admin profile for ${profileName}`}>
            <span className="admin-profile-avatar" aria-hidden="true">{profileInitial}</span>
            <span className="admin-profile-copy">
              <strong>{profileName}</strong>
              <small>{session ? ADMIN_ROLE_LABELS[session.role] : 'Admin workspace'}</small>
            </span>
            <span className="material-symbols-rounded" aria-hidden="true">expand_more</span>
          </summary>
          <div className="admin-menu-popover admin-profile-popover">
            {session ? (
              <>
                <p className="admin-profile-popover-name">{session.displayName || profileName}</p>
                <p className="admin-profile-popover-email">{session.email}</p>
                <span className="admin-profile-role">{ADMIN_ROLE_LABELS[session.role]}</span>
              </>
            ) : (
              <p className="admin-profile-popover-email">Admin session is not available.</p>
            )}
            <div className="admin-menu-divider" />
            <Link href="/suite/settings" className="admin-profile-link">
              <span className="material-symbols-rounded" aria-hidden="true">manage_accounts</span>
              Account settings
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
