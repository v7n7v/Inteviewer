import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export type EmailChangePurpose = 'change' | 'recovery';

interface EmailChangeDocument {
  requestId: string;
  uid: string;
  purpose: EmailChangePurpose;
  currentEmail: string | null;
  targetEmail: string | null;
  currentEmailHash: string;
  targetEmailHash: string;
  status: 'pending' | 'confirmed' | 'delivery_failed';
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
}

const COLLECTION = 'email_change_requests';
const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function createEmailChangeState(input: {
  uid: string;
  purpose: EmailChangePurpose;
  currentEmail: string;
  targetEmail: string;
}): Promise<{ requestId: string; state: string }> {
  const requestId = randomBytes(24).toString('base64url');
  const createdAt = new Date().toISOString();
  const document: EmailChangeDocument = {
    requestId,
    uid: input.uid,
    purpose: input.purpose,
    currentEmail: input.currentEmail,
    targetEmail: input.targetEmail,
    currentEmailHash: hashEmail(input.currentEmail),
    targetEmailHash: hashEmail(input.targetEmail),
    status: 'pending',
    createdAt,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    confirmedAt: null,
  };
  await getAdminDb().collection(COLLECTION).doc(requestId).create(document);
  const unsigned = `v1.${requestId}`;
  return { requestId, state: `${unsigned}.${sign(unsigned)}` };
}

export async function consumeEmailChangeState(state: string): Promise<{
  requestId: string;
  uid: string;
  purpose: EmailChangePurpose;
  previousEmail: string;
  currentEmail: string;
}> {
  const requestId = verifyState(state);
  if (!requestId) throw new Error('INVALID_EMAIL_CHANGE_STATE');
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(requestId);
  const initial = await ref.get();
  const initialData = initial.data() as EmailChangeDocument | undefined;
  if (!initialData?.targetEmail) throw new Error('INVALID_EMAIL_CHANGE_STATE');
  const user = await getAdminAuth().getUser(initialData.uid);
  if (!user.email || hashEmail(user.email) !== initialData.targetEmailHash) throw new Error('EMAIL_CHANGE_NOT_APPLIED');

  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as EmailChangeDocument | undefined;
    if (!data?.currentEmail || !data.targetEmail || data.status !== 'pending') throw new Error('USED_EMAIL_CHANGE_STATE');
    if (new Date(data.expiresAt).getTime() <= Date.now()) throw new Error('EXPIRED_EMAIL_CHANGE_STATE');
    if (hashEmail(user.email!) !== data.targetEmailHash) throw new Error('EMAIL_CHANGE_NOT_APPLIED');
    const confirmedAt = new Date().toISOString();
    transaction.update(ref, {
      status: 'confirmed',
      confirmedAt,
      currentEmail: null,
      targetEmail: null,
    });
    return {
      requestId,
      uid: data.uid,
      purpose: data.purpose,
      previousEmail: data.currentEmail,
      currentEmail: data.targetEmail,
    };
  });
}

export async function markEmailChangeDeliveryFailed(requestId: string): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(requestId).set({ status: 'delivery_failed' }, { merge: true });
}

function verifyState(state: string): string | null {
  if (!state || state.length > 500) return null;
  const [version, requestId, suppliedSignature, extra] = state.split('.');
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

function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
