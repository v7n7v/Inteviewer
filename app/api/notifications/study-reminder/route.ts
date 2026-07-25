/**
 * Study Reminder Email API
 * Sends daily progress email for Skill Bridge study plans.
 * Queues a typed email for durable, preference-aware delivery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { StudyReminderSchema } from '@/lib/schemas';
import { monitor } from '@/lib/monitor';
import { enqueueEmail } from '@/lib/email/outbox';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 2, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, StudyReminderSchema);
    if (!validated.success) return validated.error;
    const { skills, userName, email } = validated.data;
    const targetEmail = email.trim().toLowerCase();
    if (!guard.user.email || targetEmail !== guard.user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Reminder email must match the signed-in account.' }, { status: 403 });
    }

    const totalCompleted = skills.reduce((sum, s) => sum + (s.completedDays || 0), 0);
    const totalDays = skills.reduce((sum, s) => sum + (s.totalDays || 7), 0);
    const streak = skills.reduce((max, s) => Math.max(max, s.completedDays || 0), 0);

    const queued = await enqueueEmail({
      event: 'product.study_reminder',
      recipient: { kind: 'user', uid: guard.user.uid },
      dedupeKey: [
        new Date().toISOString().slice(0, 10),
        skills.length,
        totalCompleted,
        totalDays,
        streak,
      ].join(':'),
      payload: {
        recipientName: userName || undefined,
        summary: `You completed ${totalCompleted} of ${totalDays} planned study days. Your current streak is ${streak} day${streak === 1 ? '' : 's'}.`,
        items: skills.slice(0, 12).map(skill => `${skill.skill}: ${skill.completedDays || 0} of ${skill.totalDays || 7} days complete`),
        actionUrl: 'https://talentconsulting.io/suite/skill-bridge',
      },
      metadata: { skillCount: skills.length, totalCompleted, totalDays, streak },
    });

    return NextResponse.json({ queued: true, created: queued.created, messageId: queued.messageId });
  } catch (error: unknown) {
    console.error('[api/notifications/study-reminder] Error:', error);
    monitor.critical('Tool: notifications/study-reminder', String(error));
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
