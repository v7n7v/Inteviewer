import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { resolveAuthActionOrigin } from '@/lib/auth-action-links';

export type AccountLifecycleAction = 'deactivate' | 'delete';

interface AccountActionDocument {
  requestId: string;
  uid: string;
  action: AccountLifecycleAction;
  reason: string | null;
  status: 'pending' | 'confirmed' | 'delivery_failed';
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  deliveryErrorAt: string | null;
}

const COLLECTION = 'account_action_requests';
const TOKEN_TTL_MS = 30 * 60 * 1000;

export async function createAccountActionRequest(input: {
  uid: string;
  action: AccountLifecycleAction;
  reason?: string | null;
}): Promise<{ requestId: string; token: string; actionUrl: string; expiresAt: string }> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.uid)) throw new Error('Invalid account identifier');
  const requestId = randomBytes(24).toString('base64url');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const document: AccountActionDocument = {
    requestId,
    uid: input.uid,
    action: input.action,
    reason: sanitizeReason(input.reason),
    status: 'pending',
    createdAt,
    expiresAt,
    confirmedAt: null,
    deliveryErrorAt: null,
  };
  await getAdminDb().collection(COLLECTION).doc(requestId).create(document);
  const unsigned = `v1.${requestId}`;
  const token = `${unsigned}.${sign(unsigned)}`;
  const actionUrl = new URL('/account/action', resolveAuthActionOrigin());
  actionUrl.searchParams.set('token', token);
  return { requestId, token, actionUrl: actionUrl.toString(), expiresAt };
}

export async function inspectAccountActionToken(token: string): Promise<{
  valid: boolean;
  reason: 'invalid' | 'expired' | 'used' | null;
  action: AccountLifecycleAction | null;
  expiresAt: string | null;
}> {
  const requestId = verifyAndExtractRequestId(token);
  if (!requestId) return { valid: false, reason: 'invalid', action: null, expiresAt: null };
  const snapshot = await getAdminDb().collection(COLLECTION).doc(requestId).get();
  const data = snapshot.data() as AccountActionDocument | undefined;
  if (!data || data.requestId !== requestId || (data.action !== 'deactivate' && data.action !== 'delete')) {
    return { valid: false, reason: 'invalid', action: null, expiresAt: null };
  }
  if (data.status !== 'pending') return { valid: false, reason: 'used', action: data.action, expiresAt: data.expiresAt };
  if (new Date(data.expiresAt).getTime() <= Date.now()) return { valid: false, reason: 'expired', action: data.action, expiresAt: data.expiresAt };
  return { valid: true, reason: null, action: data.action, expiresAt: data.expiresAt };
}

export async function consumeAccountActionToken(token: string): Promise<{
  requestId: string;
  uid: string;
  action: AccountLifecycleAction;
  reason: string | null;
}> {
  const requestId = verifyAndExtractRequestId(token);
  if (!requestId) throw new Error('INVALID_ACCOUNT_ACTION');
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(requestId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as AccountActionDocument | undefined;
    if (!data || data.status !== 'pending') throw new Error('USED_ACCOUNT_ACTION');
    if (new Date(data.expiresAt).getTime() <= Date.now()) throw new Error('EXPIRED_ACCOUNT_ACTION');
    const confirmedAt = new Date().toISOString();
    transaction.update(ref, { status: 'confirmed', confirmedAt });
    return { requestId, uid: data.uid, action: data.action, reason: data.reason };
  });
}

export async function markAccountActionDeliveryFailed(requestId: string): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(requestId).set({
    status: 'delivery_failed',
    deliveryErrorAt: new Date().toISOString(),
  }, { merge: true });
}

function verifyAndExtractRequestId(token: string): string | null {
  if (!token || token.length > 500) return null;
  const [version, requestId, suppliedSignature, extra] = token.split('.');
  if (version !== 'v1' || !requestId || !suppliedSignature || extra || !/^[A-Za-z0-9_-]{20,80}$/.test(requestId)) return null;
  const unsigned = `${version}.${requestId}`;
  let expectedSignature: string;
  try {
    expectedSignature = sign(unsigned);
  } catch {
    return null;
  }
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return requestId;
}

function sign(value: string): string {
  const secret = process.env.ACCOUNT_ACTION_SECRET?.trim();
  if (!secret || secret.length < 32 || /replace|placeholder|example/i.test(secret)) {
    throw new Error('ACCOUNT_ACTION_SECRET must be a non-placeholder secret of at least 32 characters');
  }
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function sanitizeReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim().replace(/[\r\n\t]+/g, ' ').slice(0, 120);
  return reason || null;
}
