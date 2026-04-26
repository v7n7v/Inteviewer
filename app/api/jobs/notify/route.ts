/**
 * Job Suggestions Email Notification
 * POST /api/jobs/notify — sends weekly picks digest via Resend
 * Called after suggestions are generated if user has emailNotifications enabled
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { monitor } from '@/lib/monitor';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

interface JobForEmail {
  title: string;
  company: string;
  location: string;
  acceptanceChance: number;
  acceptanceReason: string;
  url: string;
  salary?: { min: number | null; max: number | null };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '';
}

export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 3, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  try {
    const { jobs } = await req.json() as { jobs: JobForEmail[] };

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ success: false, error: 'No jobs to send' }, { status: 400 });
    }

    // Get user email
    const email = guard.user.email;
    if (!email) {
      return NextResponse.json({ success: false, error: 'No email on account' }, { status: 400 });
    }

    // Check if notifications are enabled
    const db = getAdminDb();
    const prefsSnap = await db.collection('users').doc(guard.user.uid).collection('settings').doc('jobPreferences').get();
    if (prefsSnap.exists && prefsSnap.data()?.emailNotifications === false) {
      return NextResponse.json({ success: false, error: 'Email notifications disabled' }, { status: 400 });
    }

    // Build email HTML
    const jobRows = jobs.slice(0, 10).map((job, i) => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 16px 12px; vertical-align: top;">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="min-width: 44px; height: 44px; border-radius: 10px; background: ${getScoreColor(job.acceptanceChance)}15; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 16px; font-weight: 800; color: ${getScoreColor(job.acceptanceChance)};">${job.acceptanceChance}%</span>
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #111827;">${job.title}</h3>
              <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">${job.company} • ${job.location}</p>
              ${job.salary && (job.salary.min || job.salary.max) ? `<p style="margin: 0 0 4px; font-size: 12px; color: #10b981; font-weight: 500;">${formatSalary(job.salary.min, job.salary.max)}</p>` : ''}
              <p style="margin: 0; font-size: 12px; color: #9ca3af; font-style: italic;">${job.acceptanceReason}</p>
            </div>
            <a href="${job.url}" target="_blank" style="display: inline-block; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; color: white; background: linear-gradient(135deg, #06b6d4, #10b981); text-decoration: none; white-space: nowrap;">Apply →</a>
          </div>
        </td>
      </tr>
    `).join('');

    const topScore = Math.max(...jobs.map(j => j.acceptanceChance));

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 28px 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0 0 4px; font-size: 20px; font-weight: 700;">Your Weekly Job Picks</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 13px;">${jobs.length} opportunities matched to your profile</p>
        </div>

        <!-- Summary Bar -->
        <div style="background: #f8fafc; padding: 14px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
          <span style="font-size: 12px; color: #64748b;">Best match: <strong style="color: ${getScoreColor(topScore)};">${topScore}% acceptance chance</strong></span>
        </div>

        <!-- Jobs Table -->
        <table style="width: 100%; border-collapse: collapse;">
          ${jobRows}
        </table>

        <!-- CTA -->
        <div style="padding: 24px; text-align: center; background: #f8fafc;">
          <a href="https://talentconsulting.io/suite/job-search" style="display: inline-block; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; color: white; background: linear-gradient(135deg, #06b6d4, #10b981); text-decoration: none;">View All Suggestions →</a>
          <p style="margin: 12px 0 0; font-size: 11px; color: #9ca3af;">
            Want to update your preferences? <a href="https://talentconsulting.io/suite/job-search" style="color: #06b6d4;">Manage preferences</a> |
            <a href="https://talentconsulting.io/settings" style="color: #9ca3af;">Unsubscribe</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; text-align: center; border-top: 1px solid #f3f4f6;">
          <p style="margin: 0; font-size: 11px; color: #d1d5db;">Talent Studio by TalentConsulting.io</p>
        </div>
      </div>
    `;

    await getResend().emails.send({
      from: 'Talent Studio <hello@talentconsulting.io>',
      to: [email],
      subject: `${jobs.length} new job matches — up to ${topScore}% acceptance chance`,
      html,
    });

    // Record notification sent
    await db.collection('users').doc(guard.user.uid).collection('settings').doc('jobPreferences').update({
      lastNotificationSentAt: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true, sent: true, to: email, jobCount: jobs.length });
  } catch (error) {
    console.error('[jobs/notify] Error:', error);
    monitor.critical('Tool: jobs/notify', String(error));
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
