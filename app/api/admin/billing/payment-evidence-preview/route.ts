import { NextRequest } from 'next/server';
import { requireBillingAdmin } from '@/lib/admin-billing-auth';
import { adminReadFailure } from '@/lib/admin/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireBillingAdmin(request);
  if (guard.error) return guard.error;
  return adminReadFailure(
    'legacy_payment_evidence_preview_retired',
    'This legacy identifiable payment preview is retired. Use the bounded reconciliation preview.',
    410,
  );
}
