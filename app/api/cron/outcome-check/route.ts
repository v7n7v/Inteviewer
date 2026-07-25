/**
 * Outcome Check Cron — /api/cron/outcome-check
 * 
 * Triggered by Cloud Scheduler every Wednesday at 10am.
 * Finds users with "applied" applications 10+ days old without outcomes,
 * sends a short outcome check-in email.
 * 
 * Setup:
 *   1. Set CRON_SECRET env var
 *   2. Cloud Scheduler:
 *      URL:  https://talentconsulting.io/api/cron/outcome-check
 *      Method: POST
 *      Headers: Authorization: Bearer <CRON_SECRET>
 *      Schedule: 0 10 * * 3 (every Wednesday at 10am)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';
import { enqueueEmail } from '@/lib/email/outbox';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const results: { uid: string; status: string; appCount?: number; error?: string }[] = [];
  const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

  try {
    const usersSnap = await db.collection('users').listDocuments();

    for (const userDocRef of usersSnap.slice(0, 100)) {
      const uid = userDocRef.id;

      try {
        // Load the profile only for personalization. The authenticated account
        // email is resolved from Firebase Auth when the outbox dispatches.
        const profileSnap = await db.collection('users').doc(uid).collection('profile').doc('main').get();

        // Find applied apps 10+ days old without outcomes
        const appsSnap = await db.collection('users').doc(uid).collection('applications').get();
        const pendingApps = appsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((app: any) => {
            if (app.outcome_response) return false;
            if (app.status !== 'applied') return false;
            const appliedAt = app.applied_at || app.created_at;
            return new Date(appliedAt).getTime() < tenDaysAgo;
          })
          .map((app: any) => ({
            company: app.company_name,
            jobTitle: app.job_title || 'Position',
            daysAgo: Math.floor((Date.now() - new Date(app.applied_at || app.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            appId: app.id,
          }))
          .slice(0, 5);

        if (pendingApps.length === 0) {
          results.push({ uid, status: 'skip:no-pending' });
          continue;
        }

        // Queue a preference-aware email. The applicationUpdates preference is
        // rechecked immediately before delivery by the outbox dispatcher.
        const name = profileSnap.data()?.fullName?.split(' ')[0] || 'there';
        const weekBucket = new Date().toISOString().slice(0, 10);
        const queued = await enqueueEmail({
          event: 'product.application_update',
          recipient: { kind: 'user', uid },
          dedupeKey: `outcome-check:${weekBucket}:${pendingApps.map(app => app.appId).join(',')}`,
          payload: {
            recipientName: name,
            summary: `${pendingApps.length} application${pendingApps.length === 1 ? '' : 's'} ha${pendingApps.length === 1 ? 's' : 've'} been awaiting an outcome for at least 10 days. Update the status so your pipeline stays accurate.`,
            items: pendingApps.map(app => `${app.jobTitle} at ${app.company || 'Unknown company'} — applied ${app.daysAgo} days ago`),
            actionUrl: 'https://talentconsulting.io/suite/applications',
          },
          metadata: { pendingApplicationCount: pendingApps.length },
        });

        results.push({ uid, status: queued.created ? 'queued' : 'duplicate', appCount: pendingApps.length });
      } catch (err: any) {
        results.push({ uid, status: 'error', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'queued').length;
    monitor.info('Outcome Check Cron', `Queued ${sent} check-in emails`, [
      { name: 'Total Users', value: String(results.length) },
      { name: 'Queued', value: String(sent) },
    ]);

    return NextResponse.json({ success: true, results, summary: { total: results.length, sent } });
  } catch (err: any) {
    console.error('[cron/outcome-check] Fatal error:', err);
    monitor.critical('Tool: cron/outcome-check', String(err));
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
