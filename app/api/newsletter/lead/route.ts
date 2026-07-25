import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { LEGACY_ASSISTANT_IDENTIFIERS } from '@/lib/assistant/compatibility';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeJobAlertsFrequency } from '@/lib/job-alerts';
import { monitor } from '@/lib/monitor';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_REQUEST_BYTES = 8_192;
const MAX_EMAIL_LENGTH = 254;
const MAX_ATTRIBUTION_LENGTH = 500;

function boundedString(value: unknown, maxLength = MAX_ATTRIBUTION_LENGTH) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function getClientIp(req: NextRequest) {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function leadId(email: string) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413, headers: { 'Cache-Control': 'private, no-store' } });
    }

    const rateLimitKey = `newsletter-lead:${leadId(getClientIp(req))}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 5, 10 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Cache-Control': 'private, no-store',
          'Retry-After': String(Math.max(1, Math.ceil(rateLimit.resetIn / 1000))),
        },
      });
    }

    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Valid request required' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!rawEmail || rawEmail.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const email = rawEmail;

    const authUser = await authenticateRequest(req).catch(() => null);
    const now = new Date().toISOString();
    const frequency = normalizeJobAlertsFrequency(body.frequency || 'weekly', 'free');
    const attribution = {
      utmSource: boundedString(body.utmSource || body.utm_source, 160),
      utmCampaign: boundedString(body.utmCampaign || body.utm_campaign, 160),
      utmContent: boundedString(body.utmContent || body.utm_content, 160),
      referrer: boundedString(body.referrer),
      sourcePath: boundedString(body.sourcePath, 300),
    };

    const db = getAdminDb();
    const leadRef = db.collection('newsletterLeads').doc(leadId(email));
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(leadRef);
      transaction.set(leadRef, {
        email,
        uid: authUser?.uid || null,
        product: LEGACY_ASSISTANT_IDENTIFIERS.careerPicksSource,
        assistantBrand: 'taco',
        frequency,
        status: 'captured',
        attribution,
        updatedAt: now,
        ...(existing.exists ? {} : { createdAt: now }),
      }, { merge: true });
    });

    if (authUser?.uid) {
      await db.collection('users').doc(authUser.uid).collection('jobAlertEvents').add({
        type: 'newsletter_subscribe',
        source: attribution.sourcePath || 'public_capture',
        frequency,
        createdAt: now,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, captured: true, frequency }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    monitor.critical('Tool: newsletter/lead', String(error));
    return NextResponse.json({ error: 'Failed to capture subscription' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
