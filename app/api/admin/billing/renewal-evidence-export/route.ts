import { NextRequest } from 'next/server';
import { requireBillingAdmin } from '@/lib/admin-billing-auth';
import { adminReadFailure } from '@/lib/admin/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guard = await requireBillingAdmin(request);
  if (guard.error) return guard.error;
  return adminReadFailure(
    'legacy_renewal_evidence_export_retired',
    'This legacy full-population export is retired. Use aggregate Finance evidence.',
    410,
  );
}
