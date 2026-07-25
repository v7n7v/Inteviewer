import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { observabilitySurfaceAvailable } from '@/lib/observability/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'admin.access');
  if (guard.error) return guard.error;
  const permissions = observabilitySurfaceAvailable()
    ? guard.actor.permissions
    : guard.actor.permissions.filter(permission => permission !== 'diagnostics.metadata.read');

  return NextResponse.json(
    {
      admin: {
        uid: guard.actor.uid,
        email: guard.actor.email,
        displayName: guard.actor.displayName,
        role: guard.actor.role,
        permissions,
        mfaSatisfied: guard.actor.mfaSatisfied,
        mfaEnforced: process.env.ADMIN_MFA_ENFORCED === 'true',
        mutationReady: process.env.ADMIN_MUTATIONS_V2_ENABLED === 'true'
          && process.env.ADMIN_MFA_ENFORCED === 'true'
          && process.env.ADMIN_RECOVERY_OWNERS_VERIFIED === 'true'
          && guard.actor.mfaSatisfied,
        features: {
          observability: observabilitySurfaceAvailable(),
        },
      },
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Vary: 'Authorization',
      },
    },
  );
}
