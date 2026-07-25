'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useAdminSession } from './AdminSessionProvider';
import {
  useAdminUiPreferences,
  type AdminSavedView,
} from './AdminUiPreferences';

const VIEW_LABELS: Record<AdminSavedView, string> = {
  command: 'Command view',
  operations: 'Operations view',
  finance: 'Finance view',
  support: 'Support view',
};

const VIEW_ROUTES: Record<AdminSavedView, string> = {
  command: '/suite/admin',
  operations: '/suite/admin/operations',
  finance: '/suite/admin/finance',
  support: '/suite/admin/support',
};

export function AdminSavedViewMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const { session } = useAdminSession();
  const { savedView, density, setDensity, setSavedView } = useAdminUiPreferences();

  const availableViews = useMemo(() => {
    const views: AdminSavedView[] = ['command'];
    if (session?.permissions.includes('operations.read')) views.push('operations');
    if (session?.permissions.includes('billing.read')) views.push('finance');
    if (session?.permissions.includes('support.read')) views.push('support');
    return views;
  }, [session]);

  useEffect(() => {
    if (!availableViews.includes(savedView)) setSavedView('command');
  }, [availableViews, savedView, setSavedView]);

  const selectedLabel = savedView === 'command' && session?.role === 'owner'
    ? 'Owner view'
    : VIEW_LABELS[savedView];

  function selectView(view: AdminSavedView) {
    setSavedView(view);
    detailsRef.current?.removeAttribute('open');
    router.push(VIEW_ROUTES[view]);
  }

  function closeMenu() {
    detailsRef.current?.removeAttribute('open');
    detailsRef.current?.querySelector<HTMLElement>('summary')?.focus();
  }

  function moveRadio(
    event: KeyboardEvent<HTMLDivElement>,
    selector: string,
    direction: -1 | 1,
    select: (radio: HTMLButtonElement) => void,
  ) {
    event.preventDefault();
    const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(selector)];
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    const next = radios[(Math.max(current, 0) + direction + radios.length) % radios.length];
    next?.focus();
    if (next) select(next);
  }

  return (
    <details ref={detailsRef} className="admin-menu admin-saved-view">
      <summary className="admin-menu-trigger" aria-label={`Saved view: ${selectedLabel}`}>
        <span className="admin-menu-eyebrow">Saved view</span>
        <span className="admin-menu-value">{selectedLabel}</span>
        <span className="material-symbols-rounded" aria-hidden="true">expand_more</span>
      </summary>
      <div className="admin-menu-popover admin-saved-view-popover">
        <p className="admin-menu-section-label">View preset</p>
        <div
          role="radiogroup"
          aria-label="Admin view preset"
          className="admin-menu-options"
          onKeyDown={event => {
            const select = (radio: HTMLButtonElement) => {
              const view = radio.dataset.adminView as AdminSavedView | undefined;
              if (view) selectView(view);
            };
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') moveRadio(event, '[role="radio"]', -1, select);
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') moveRadio(event, '[role="radio"]', 1, select);
            if (event.key === 'Escape') closeMenu();
          }}
        >
          {availableViews.map(view => (
            <button
              key={view}
              data-admin-view={view}
              type="button"
              role="radio"
              aria-checked={savedView === view}
              tabIndex={savedView === view ? 0 : -1}
              onClick={() => selectView(view)}
              className="admin-menu-option"
            >
              <span>{view === 'command' && session?.role === 'owner' ? 'Owner view' : VIEW_LABELS[view]}</span>
              {savedView === view ? <span className="material-symbols-rounded" aria-hidden="true">check</span> : null}
            </button>
          ))}
        </div>
        <div className="admin-menu-divider" />
        <p className="admin-menu-section-label">Information density</p>
        <div
          className="admin-density-toggle"
          role="radiogroup"
          aria-label="Admin information density"
          onKeyDown={event => {
            const select = (radio: HTMLButtonElement) => {
              const option = radio.dataset.adminDensity as 'comfortable' | 'compact' | undefined;
              if (option) setDensity(option);
            };
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') moveRadio(event, '[role="radio"]', -1, select);
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') moveRadio(event, '[role="radio"]', 1, select);
            if (event.key === 'Escape') closeMenu();
          }}
        >
          {(['comfortable', 'compact'] as const).map(option => (
            <button
              key={option}
              data-admin-density={option}
              type="button"
              role="radio"
              aria-checked={density === option}
              tabIndex={density === option ? 0 : -1}
              onClick={() => setDensity(option)}
              className="admin-density-option"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
