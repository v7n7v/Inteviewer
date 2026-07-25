import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { enqueueEmail } from '@/lib/email/outbox';
import { consumeAccountActionToken, inspectAccountActionToken } from '@/lib/account-action-tokens';
import { COMMUNICATION_PREFERENCES_DOCUMENT, COMMUNICATION_PREFERENCES_VERSION } from '@/lib/communication-preferences';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const inspection = await inspectAccountActionToken(token);
  return NextResponse.json(inspection, {
    status: inspection.valid ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  let consumed: Awaited<ReturnType<typeof consumeAccountActionToken>>;
  try {
    consumed = await consumeAccountActionToken(token);
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith('EXPIRED_') ? 'expired' : 'invalid_or_used';
    return NextResponse.json({ error: 'This confirmation link is invalid, expired, or already used.', reason }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();
  const settings = db.collection('users').doc(consumed.uid).collection('settings');
  await db.runTransaction(async transaction => {
    const preferenceRef = settings.doc(COMMUNICATION_PREFERENCES_DOCUMENT);
    const preferenceSnapshot = await transaction.get(preferenceRef);
    const revision = typeof preferenceSnapshot.data()?.revision === 'number' ? preferenceSnapshot.data()!.revision + 1 : 1;
    transaction.set(settings.doc('accountLifecycle'), {
      status: consumed.action === 'delete' ? 'deletion_confirmed' : 'deactivated',
      requestId: consumed.requestId,
      reason: consumed.reason,
      updatedAt: now,
    }, { merge: true });
    transaction.set(preferenceRef, {
      version: COMMUNICATION_PREFERENCES_VERSION,
      revision,
      studyReminders: false,
      applicationUpdates: false,
      interviewReminders: false,
      offerUpdates: false,
      weeklyRecap: false,
      marketing: false,
      optionalEmailPaused: true,
      optionalEmailPausedAt: now,
      optionalEmailPausedReason: consumed.action === 'delete' ? 'Account deletion confirmed' : 'Account deactivated',
      updatedAt: now,
    }, { merge: true });
    transaction.set(settings.doc('jobPreferences'), {
      emailNotifications: false,
      agentDigestEmailEnabled: false,
      emailDeliveryPausedAt: now,
      emailDeliveryPausedReason: consumed.action === 'delete' ? 'Account deletion confirmed' : 'Account deactivated',
      updatedAt: now,
    }, { merge: true });
  });

  const emailJobs: Array<Promise<unknown>> = [
    enqueueEmail({
      event: 'internal.support_request_received',
      recipient: { kind: 'operations' },
      dedupeKey: `account-action-confirmed:${consumed.requestId}`,
      payload: {
        referenceId: consumed.requestId,
        summary: consumed.action === 'delete'
          ? 'A customer confirmed a permanent account deletion request. Complete the approved retention and deletion workflow before sending the deletion-complete notice.'
          : 'A customer confirmed account deactivation. Optional email has been paused and the lifecycle record was updated.',
        severity: consumed.action === 'delete' ? 'critical' : 'warning',
        occurredAt: now,
        details: [
          { label: 'User ID', value: consumed.uid },
          { label: 'Action', value: consumed.action },
          ...(consumed.reason ? [{ label: 'Reason', value: consumed.reason }] : []),
        ],
      },
      metadata: { accountAction: consumed.action },
    }),
  ];
  if (consumed.action === 'deactivate') {
    emailJobs.push(enqueueEmail({
      event: 'account.deactivated',
      recipient: { kind: 'user', uid: consumed.uid },
      dedupeKey: `account-deactivated:${consumed.requestId}`,
      payload: { occurredAt: now, accountUrl: 'https://talentconsulting.io/suite/settings' },
      metadata: { accountAction: 'deactivate' },
    }));
  }
  await Promise.all(emailJobs).catch(error => console.error('[account:lifecycle-confirm] Follow-up email enqueue failed:', error));

  return NextResponse.json({ confirmed: true, action: consumed.action }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
