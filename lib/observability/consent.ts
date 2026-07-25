import 'server-only';
import { z } from 'zod';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { observabilityNoticeVersion } from '@/lib/observability/config';

export const OBSERVABILITY_PRIVACY_CONTROL_DOCUMENT = 'privacyControls';

export interface ObservabilityConsentState {
  version: 1;
  revision: number;
  productAnalytics: boolean;
  noticeVersion: string;
  decisionAt: string | null;
  withdrawnAt: string | null;
}

export const observabilityConsentUpdateSchema = z.object({
  productAnalytics: z.boolean(),
  noticeVersion: z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9._-]+$/i),
  expectedRevision: z.number().int().nonnegative(),
}).strict();

export function defaultObservabilityConsentState(): ObservabilityConsentState {
  return {
    version: 1,
    revision: 0,
    productAnalytics: false,
    noticeVersion: observabilityNoticeVersion(),
    decisionAt: null,
    withdrawnAt: null,
  };
}

export function normalizeObservabilityConsent(value: unknown): ObservabilityConsentState {
  if (!value || typeof value !== 'object') return defaultObservabilityConsentState();
  const data = value as Record<string, unknown>;
  const noticeVersion = typeof data.noticeVersion === 'string'
    ? data.noticeVersion.slice(0, 64)
    : observabilityNoticeVersion();
  return {
    version: 1,
    revision: Number.isInteger(data.revision) && Number(data.revision) >= 0
      ? Number(data.revision)
      : 0,
    productAnalytics: data.productAnalytics === true
      && noticeVersion === observabilityNoticeVersion(),
    noticeVersion,
    decisionAt: typeof data.decisionAt === 'string' ? data.decisionAt : null,
    withdrawnAt: typeof data.withdrawnAt === 'string' ? data.withdrawnAt : null,
  };
}

export function observabilityConsentRef(db: Firestore, uid: string) {
  return db
    .collection('users')
    .doc(uid)
    .collection('settings')
    .doc(OBSERVABILITY_PRIVACY_CONTROL_DOCUMENT);
}

export function observabilityControlRef(db: Firestore, uid: string) {
  return db
    .collection('users')
    .doc(uid)
    .collection('observabilityControl')
    .doc('state');
}

export async function readObservabilityConsent(
  db: Firestore,
  uid: string,
): Promise<ObservabilityConsentState> {
  const snapshot = await observabilityConsentRef(db, uid).get();
  return normalizeObservabilityConsent(snapshot.exists ? snapshot.data() : null);
}

export async function writeObservabilityConsent(
  db: Firestore,
  uid: string,
  input: z.infer<typeof observabilityConsentUpdateSchema>,
  now = new Date(),
): Promise<ObservabilityConsentState> {
  const expectedNotice = observabilityNoticeVersion();
  if (input.noticeVersion !== expectedNotice) {
    throw new Error('OBSERVABILITY_NOTICE_VERSION_CHANGED');
  }
  const ref = observabilityConsentRef(db, uid);
  return db.runTransaction(async transaction => writeConsentInTransaction(
    transaction,
    ref,
    input,
    now,
  ));
}

export async function setObservabilityConsent(
  db: Firestore,
  uid: string,
  input: {
    productAnalytics: boolean;
    noticeVersion: string;
    expectedRevision?: number;
  },
  now = new Date(),
): Promise<ObservabilityConsentState> {
  const expectedNotice = observabilityNoticeVersion();
  if (input.noticeVersion !== expectedNotice) {
    throw new Error('OBSERVABILITY_NOTICE_VERSION_CHANGED');
  }
  const ref = observabilityConsentRef(db, uid);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = normalizeObservabilityConsent(snapshot.exists ? snapshot.data() : null);
    if (
      input.expectedRevision !== undefined
      && current.revision !== input.expectedRevision
    ) {
      throw new Error('OBSERVABILITY_CONSENT_REVISION_CONFLICT');
    }
    const nowIso = now.toISOString();
    const next: ObservabilityConsentState = {
      version: 1,
      revision: current.revision + 1,
      productAnalytics: input.productAnalytics,
      noticeVersion: input.noticeVersion,
      decisionAt: nowIso,
      withdrawnAt: input.productAnalytics ? null : nowIso,
    };
    transaction.set(ref, {
      ...next,
      purpose: 'product_analytics',
      source: 'authenticated_user',
      updatedAt: nowIso,
    });
    return next;
  });
}

async function writeConsentInTransaction(
  transaction: Transaction,
  ref: FirebaseFirestore.DocumentReference,
  input: z.infer<typeof observabilityConsentUpdateSchema>,
  now: Date,
): Promise<ObservabilityConsentState> {
  const snapshot = await transaction.get(ref);
  const current = normalizeObservabilityConsent(snapshot.exists ? snapshot.data() : null);
  if (current.revision !== input.expectedRevision) {
    throw new Error('OBSERVABILITY_CONSENT_REVISION_CONFLICT');
  }
  if (current.productAnalytics === input.productAnalytics) {
    return current;
  }
  const nowIso = now.toISOString();
  const next: ObservabilityConsentState = {
    version: 1,
    revision: current.revision + 1,
    productAnalytics: input.productAnalytics,
    noticeVersion: input.noticeVersion,
    decisionAt: nowIso,
    withdrawnAt: input.productAnalytics ? null : nowIso,
  };
  transaction.set(ref, {
    ...next,
    purpose: 'product_analytics',
    source: 'authenticated_user',
    updatedAt: nowIso,
  });
  return next;
}
