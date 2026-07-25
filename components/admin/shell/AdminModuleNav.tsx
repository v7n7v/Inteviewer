'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAdminVisualReview } from '@/components/admin/visual-review/AdminVisualReviewContext';
import { ADMIN_NAVIGATION, adminNavigationAllowed, adminRouteIsActive } from './admin-navigation';
import { useAdminSession } from './AdminSessionProvider';

function visualReviewModule(href: string) {
  if (href === '/suite/admin') return 'overview';
  if (href === '/suite/admin/observability') return 'observability';
  return null;
}

export function AdminModuleNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visualReview = useAdminVisualReview();
  const { session, status } = useAdminSession();
  const activePreviewModule = searchParams.get('module') || 'overview';
  const navigation = ADMIN_NAVIGATION.filter(
    item => session
      ? adminNavigationAllowed(item, session.permissions, session.role, session.features)
      : false,
  );

  return (
    <nav className="admin-module-nav" aria-label="Admin modules">
      <div className="admin-module-nav-scroll">
        {status === 'loading' ? (
          <div className="admin-module-nav-loading" aria-label="Loading authorized Admin modules">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="admin-nav-skeleton" />
            ))}
          </div>
        ) : navigation.map(item => {
          const previewModule = visualReviewModule(item.href);
          const active = visualReview
            ? previewModule !== null && activePreviewModule === previewModule
            : adminRouteIsActive(pathname, item);
          const href = visualReview && previewModule
            ? `/suite/admin-preview?module=${encodeURIComponent(previewModule)}`
            : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`admin-module-link${active ? ' is-active' : ''}`}
              title={item.description}
            >
              <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
