/**
 * Contact Form API — Routes feedback via Resend
 * POST /api/contact
 * Accepts: { name, email, category, message }
 */
import { NextRequest, NextResponse } from 'next/server';
import { monitor } from '@/lib/monitor';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { enqueueEmail } from '@/lib/email/outbox';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const { allowed, resetIn } = await checkRateLimit(`contact:${ip}`, 3, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      );
    }

    const body = await req.json();
    const { name, email, category, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars).' }, { status: 400 });
    }

    const categoryLabel = ({
      bug: 'Bug Report',
      feature: 'Feature Request',
      general: 'General Feedback',
      other: 'Other',
    } as Record<string, string>)[category] || 'General';

    const safeName = cleanText(String(name), 200);
    const safeEmail = String(email).trim().toLowerCase().slice(0, 320);
    const safeMessage = cleanText(String(message), 5000, true);
    const db = getAdminDb();
    const submissionRef = db.collection('contact_submissions').doc();
    const caseId = `TC-${submissionRef.id.slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    await submissionRef.set({
      type: 'contact',
      caseId,
      name: safeName,
      email: safeEmail,
      category: category || 'general',
      categoryLabel,
      message: safeMessage,
      createdAt,
      source: 'contact_form',
      status: 'new',
    });
    await Promise.all([
      enqueueEmail({
        event: 'support.feedback_received',
        recipient: { kind: 'contact', submissionId: submissionRef.id },
        dedupeKey: `contact:${submissionRef.id}:receipt`,
        payload: {
          recipientName: safeName,
          caseId,
          summary: `We received your ${categoryLabel.toLowerCase()} message and added it to the support queue.`,
          occurredAt: createdAt,
        },
        metadata: { submissionId: submissionRef.id, category: category || 'general' },
      }),
      enqueueEmail({
        event: 'internal.support_request_received',
        recipient: { kind: 'operations' },
        dedupeKey: `contact:${submissionRef.id}:operations`,
        payload: {
          referenceId: caseId,
          summary: `A new ${categoryLabel.toLowerCase()} message was received through the contact form and is ready for triage.`,
          severity: category === 'bug' ? 'warning' : 'info',
          occurredAt: createdAt,
          details: [{ label: 'Category', value: categoryLabel }],
        },
        metadata: { submissionId: submissionRef.id, category: category || 'general' },
      }),
    ]);

    return NextResponse.json({ success: true, caseId, message: 'Feedback sent. We\'ll get back to you soon.' });
  } catch (error) {
    console.error('[api/contact] Error:', error);
    monitor.critical('Tool: contact', String(error));
    return NextResponse.json({ error: 'Failed to send feedback.' }, { status: 500 });
  }
}

function cleanText(value: string, maxLength: number, preserveNewlines = false): string {
  const withoutControls = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return (preserveNewlines ? withoutControls : withoutControls.replace(/[\r\n\t]+/g, ' ')).trim().slice(0, maxLength);
}
