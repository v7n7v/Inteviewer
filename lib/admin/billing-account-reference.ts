import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

function referenceSecret() {
  const secret = process.env.ADMIN_REFERENCE_SECRET
    || process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.FIREBASE_PROJECT_ID;
  if (!secret) throw new Error('Admin reference secret is not configured');
  return secret;
}

export function billingAccountReference(accountId: string) {
  return createHmac('sha256', referenceSecret())
    .update(`billing-account:${accountId}`)
    .digest('hex')
    .slice(0, 24);
}

export function billingAccountReferenceMatches(accountId: string, candidate: string) {
  const expected = Buffer.from(billingAccountReference(accountId));
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
