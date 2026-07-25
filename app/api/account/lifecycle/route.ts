import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendEmailEventResult } from '@/lib/email';
import {
  createAccountActionRequest,
  markAccountActionDeliveryFailed,
  type AccountLifecycleAction,
} from '@/lib/account-action-tokens';

const ALLOWED_ACTIONS = new Set<AccountLifecycleAction>(['deactivate', 'delete']);

export async function POST(request: NextRequest) {
  const guard = await guardApiRoute(request, { rateLimit: 3, rateLimitWindow: 60 * 60 * 1000 });
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null) as { action?: unknown; reason?: unknown } | null;
  const action = typeof body?.action === 'string' ? body.action as AccountLifecycleAction : null;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Choose a valid account action.' }, { status: 400 });
  }

  const user = await getAdminAuth().getUser(guard.user.uid);
  if (!user.email) return NextResponse.json({ error: 'Account does not have an email address.' }, { status: 400 });

  const accountAction = await createAccountActionRequest({
    uid: guard.user.uid,
    action,
    reason: body?.reason as string | null | undefined,
  });
  const event = action === 'delete' ? 'account.deletion_requested' : 'account.deactivation_requested';
  const delivery = await sendEmailEventResult(user.email, event, {
    recipientName: user.displayName || undefined,
    actionUrl: accountAction.actionUrl,
    expiresInMinutes: 30,
  }, { idempotencyKey: `account-action-${accountAction.requestId}` });

  if (!delivery.ok) {
    await markAccountActionDeliveryFailed(accountAction.requestId).catch(() => {});
    return NextResponse.json({ error: 'The confirmation email could not be sent. Please try again.' }, { status: 503 });
  }

  return NextResponse.json({ success: true, message: `Verification email sent for ${action}.` }, {
    status: 202,
    headers: { 'Cache-Control': 'no-store' },
  });
}
