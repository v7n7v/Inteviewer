/**
 * Contact Form API — Routes feedback via Resend
 * POST /api/contact
 * Accepts: { name, email, category, message }
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { monitor } from '@/lib/monitor';

const CONTACT_EMAIL = 'alula.gebre@gmail.com';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

/** Escape HTML entities to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Simple in-memory rate limit: max 3 submissions per IP per hour
const rateMap = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    const timestamps = rateMap.get(ip)?.filter(t => now - t < windowMs) || [];
    if (timestamps.length >= 3) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }
    timestamps.push(now);
    rateMap.set(ip, timestamps);

    const body = await req.json();
    const { name, email, category, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
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

    // Sanitize all user input for HTML injection
    const safeName = escapeHtml(name.slice(0, 200));
    const safeEmail = escapeHtml(email.slice(0, 320));
    const safeMessage = escapeHtml(message);

    await getResend().emails.send({
      from: 'TalentConsulting <hello@talentconsulting.io>',
      to: [CONTACT_EMAIL],
      replyTo: email.slice(0, 320),
      subject: `[TalentConsulting] ${categoryLabel} from ${safeName}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 18px;">New ${categoryLabel}</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">From:</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                <td style="padding: 8px 0; font-size: 14px;"><a href="mailto:${safeEmail}" style="color: #059669;">${safeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Category:</td>
                <td style="padding: 8px 0; font-size: 14px;">${categoryLabel}</td>
              </tr>
            </table>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <div style="font-size: 14px; line-height: 1.6; color: #1f2937; white-space: pre-wrap;">${safeMessage}</div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="font-size: 11px; color: #9ca3af; margin: 0;">Sent from TalentConsulting.io contact form</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'Feedback sent. We\'ll get back to you soon.' });
  } catch (error) {
    console.error('[api/contact] Error:', error);
    monitor.critical('Tool: contact', String(error));
    return NextResponse.json({ error: 'Failed to send feedback.' }, { status: 500 });
  }
}
