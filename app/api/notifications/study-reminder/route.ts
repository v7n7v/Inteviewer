/**
 * Study Reminder Email API
 * Sends an encouraging daily progress email for Skill Bridge study plans.
 * Uses Resend for transactional email (free: 100/day).
 * 
 * For MVP: triggered manually from the Skill Bridge page.
 * Production: will be called by a Cloud Function cron (daily at 8AM user timezone).
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { StudyReminderSchema } from '@/lib/schemas';
import { monitor } from '@/lib/monitor';

// Inline email builder — no Resend SDK needed for MVP, use raw fetch
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — email skipped. Set it in .env.local for email notifications.');
    return { success: false, reason: 'no_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TalentConsulting <noreply@talentconsulting.io>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return { success: false, reason: err };
  }

  return { success: true };
}

// Build the HTML email
function buildProgressEmail(data: {
  userName: string;
  skills: { skill: string; completedDays: number; totalDays: number; todayFocus?: string; todayTasks?: string[] }[];
  totalCompleted: number;
  totalDays: number;
  streak: number;
}) {
  const overallPercent = Math.round((data.totalCompleted / data.totalDays) * 100);
  const motivationalMessages = [
    "You're building something no AI can fake -- real knowledge.",
    "Every day you study is a day closer to landing that interview.",
    "Skills aren't built overnight -- but 7 days? That's doable.",
    "The best candidates aren't the ones with the best resumes. They're the ones who can back it up.",
    "You're not just updating your resume -- you're upgrading yourself.",
  ];
  const motivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

  const skillRows = data.skills.map(s => {
    const pct = Math.round((s.completedDays / s.totalDays) * 100);
    const filledBlocks = s.completedDays;
    const emptyBlocks = s.totalDays - s.completedDays;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    const statusEmoji = pct === 100 ? '[DONE]' : pct >= 50 ? '[>>]' : '[..]';

    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
          <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${statusEmoji} ${s.skill}</div>
          <div style="font-family: monospace; font-size: 14px; color: #10b981; letter-spacing: 2px; margin-bottom: 4px;">${progressBar} ${pct}%</div>
          <div style="font-size: 12px; color: #888;">Day ${s.completedDays} of ${s.totalDays}${s.completedDays >= s.totalDays ? ' -- Complete!' : ''}</div>
          ${s.todayFocus ? `<div style="font-size: 12px; color: #3b82f6; margin-top: 6px; font-weight: 500;">Today: ${s.todayFocus}</div>` : ''}
          ${s.todayTasks?.length ? `<ul style="margin: 6px 0 0 16px; padding: 0; font-size: 12px; color: #666;">${s.todayTasks.map(t => `<li style="margin-bottom: 2px;">${t}</li>`).join('')}</ul>` : ''}
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f8fafc;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px 16px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <div style="font-size: 16px; margin-bottom: 8px; font-weight: 800; color: #10b981;">SB</div>
      <h1 style="margin: 0; font-size: 22px; color: #0f172a;">Skill Bridge Daily</h1>
      <p style="margin: 4px 0 0; font-size: 14px; color: #64748b;">Your progress report for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    </div>

    <!-- Overall Progress Card -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 24px; margin-bottom: 16px; color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <div style="font-size: 36px; font-weight: 800;">${overallPercent}%</div>
          <div style="font-size: 13px; opacity: 0.7;">Overall Progress</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 600;">${data.totalCompleted}/${data.totalDays} days</div>
          <div style="font-size: 12px; opacity: 0.6;">${data.streak} day streak</div>
        </div>
      </div>
      <div style="background: rgba(255,255,255,0.15); border-radius: 8px; height: 8px; overflow: hidden;">
        <div style="background: linear-gradient(to right, #10b981, #06b6d4); height: 100%; width: ${overallPercent}%; border-radius: 8px; transition: width 0.3s;"></div>
      </div>
    </div>

    <!-- Motivation -->
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #92400e; font-style: italic;">${motivation}</p>
    </div>

    <!-- Skill Progress Table -->
    <div style="background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <span style="font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Your Study Plans</span>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        ${skillRows}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-top: 24px;">
      <a href="https://talent-consulting-acf16.web.app/suite/skill-bridge" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #f97316); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px;">Continue Studying</a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">TalentConsulting.io — From Resume to Ready</p>
      <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">You're receiving this because you opted in to Skill Bridge reminders.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 2, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, StudyReminderSchema);
    if (!validated.success) return validated.error;
    const { skills, userName, email } = validated.data;

    // Calculate metrics
    const totalCompleted = skills.reduce((sum: number, s: any) => sum + (s.completedDays || 0), 0);
    const totalDays = skills.reduce((sum: number, s: any) => sum + (s.totalDays || 7), 0);

    // Simple streak: count consecutive recent days with activity
    const streak = skills.reduce((max: number, s: any) => Math.max(max, s.completedDays || 0), 0);

    const overallPercent = Math.round((totalCompleted / totalDays) * 100);
    const subject = overallPercent >= 100
      ? `You completed all your study plans!`
      : overallPercent >= 50
        ? `${overallPercent}% done -- you're past the halfway mark!`
        : `Day ${totalCompleted + 1} awaits -- keep the momentum going!`;

    const html = buildProgressEmail({
      userName: userName || 'there',
      skills,
      totalCompleted,
      totalDays,
      streak,
    });

    const result = await sendEmail(email, subject, html);

    return NextResponse.json({
      sent: result.success,
      reason: result.success ? undefined : (result as any).reason,
      subject,
    });
  } catch (error: unknown) {
    console.error('[api/notifications/study-reminder] Error:', error);
    monitor.critical('Tool: notifications/study-reminder', String(error));
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
