'use client';

import { useSearchParams } from 'next/navigation';
import { ObservabilityCommandCenter } from '@/components/admin/observability/ObservabilityCommandCenter';
import { AdminOverview } from '@/components/admin/overview/AdminOverview';
import { AdminShell } from '@/components/admin/shell/AdminShell';
import { AdminVisualReviewProvider } from './AdminVisualReviewContext';

function VisualReviewModule() {
  const searchParams = useSearchParams();
  return searchParams.get('module') === 'observability'
    ? <ObservabilityCommandCenter />
    : <AdminOverview />;
}

export function AdminCommandGridVisualReview() {
  return (
    <AdminVisualReviewProvider>
      <AdminShell>
        <VisualReviewModule />
      </AdminShell>
    </AdminVisualReviewProvider>
  );
}
