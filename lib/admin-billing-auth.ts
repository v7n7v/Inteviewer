import { NextRequest } from 'next/server';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';

export async function requireBillingAdmin(req: NextRequest) {
  const guard = req.method === 'GET' || req.method === 'HEAD'
    ? await requireAdmin(req, 'billing.read')
    : await requireAdminMutation(req, 'billing.manage');
  if (guard.error) return { error: guard.error };
  return { user: guard.actor };
}
