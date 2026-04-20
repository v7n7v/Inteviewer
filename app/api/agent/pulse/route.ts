import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 30, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 86400000;
    const twoWeeksAgo = now - 14 * 86400000;

    // Fetch applications
    const appsSnap = await db.collection('users').doc(uid).collection('applications')
      .orderBy('createdAt', 'desc').limit(200).get();

    const apps = appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

    // Pipeline counts
    const totalApps = apps.length;
    const thisWeekApps = apps.filter((a: any) => new Date(a.createdAt).getTime() > oneWeekAgo).length;

    const statusCounts = { responded: 0, interviews: 0, offers: 0, rejected: 0, ghosted: 0 };
    apps.forEach((a: any) => {
      const s = (a.status || '').toLowerCase();
      if (s === 'interview' || s === 'interviewing') statusCounts.interviews++;
      if (s === 'offer' || s === 'accepted') statusCounts.offers++;
      if (s === 'rejected' || s === 'declined') statusCounts.rejected++;
      if (s === 'ghosted' || s === 'no_response') statusCounts.ghosted++;
      if (s !== 'applied' && s !== 'saved' && s !== 'queued') statusCounts.responded++;
    });

    // Velocity
    const oldestApp = apps.length > 0 ? apps[apps.length - 1] : null;
    const weeksActive = oldestApp
      ? Math.max(1, Math.ceil((now - new Date(oldestApp.createdAt).getTime()) / (7 * 86400000)))
      : 1;
    const weeklyRate = totalApps > 0 ? Math.round(totalApps / weeksActive) : 0;

    // Estimated weeks to offer (industry: ~40 apps → 1 offer)
    const estimatedWeeksToOffer = weeklyRate > 0 ? Math.max(1, Math.round(40 / weeklyRate)) : null;

    // Stale apps (applied > 30 days, no response)
    const staleApps = apps
      .filter((a: any) => {
        const s = (a.status || '').toLowerCase();
        const daysAgo = Math.floor((now - new Date(a.createdAt).getTime()) / 86400000);
        return (s === 'applied' || s === 'queued') && daysAgo > 30;
      })
      .slice(0, 5)
      .map((a: any) => ({
        company: a.company || a.companyName || '?',
        role: a.role || a.jobTitle || '?',
        daysAgo: Math.floor((now - new Date(a.createdAt).getTime()) / 86400000),
      }));

    // Follow-ups (applied 10-21 days ago, typical response window)
    const followUps = apps
      .filter((a: any) => {
        const s = (a.status || '').toLowerCase();
        const daysAgo = Math.floor((now - new Date(a.createdAt).getTime()) / 86400000);
        return (s === 'applied' || s === 'queued') && daysAgo >= 10 && daysAgo <= 21;
      })
      .slice(0, 5)
      .map((a: any) => ({
        company: a.company || a.companyName || '?',
        role: a.role || a.jobTitle || '?',
        daysSinceApply: Math.floor((now - new Date(a.createdAt).getTime()) / 86400000),
      }));

    // Upcoming interviews
    const upcomingInterviews = apps
      .filter((a: any) => {
        const s = (a.status || '').toLowerCase();
        return s === 'interview' || s === 'interviewing';
      })
      .slice(0, 3)
      .map((a: any) => ({
        company: a.company || a.companyName || '?',
        role: a.role || a.jobTitle || '?',
        date: a.interviewDate || a.updatedAt || a.createdAt,
      }));

    // Morale history
    const moraleSnap = await db.collection('users').doc(uid).collection('morale')
      .orderBy('week', 'desc').limit(8).get();
    const moraleHistory = moraleSnap.docs
      .map(doc => ({ week: doc.data().week, score: doc.data().score }))
      .reverse();

    // Smart Apply Rate (apps that used full pipeline)
    const morphedCount = apps.filter((a: any) => a.resume_version_id).length;
    const fitAnalyzedCount = apps.filter((a: any) => a.talent_density_score != null && a.talent_density_score > 0).length;
    const smartApplyRate = totalApps > 0 ? Math.round(morphedCount / totalApps * 100) : 0;

    return new Response(JSON.stringify({
      pulse: {
        totalApps,
        thisWeekApps,
        ...statusCounts,
        weeklyRate,
        estimatedWeeksToOffer,
        staleApps,
        upcomingInterviews,
        followUps,
        moraleHistory,
        morphedCount,
        fitAnalyzedCount,
        smartApplyRate,
      },
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const body = await req.json();
    const { morale } = body;

    if (!morale || morale < 1 || morale > 5) {
      return new Response(JSON.stringify({ error: 'Morale must be 1-5' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Week key (ISO week)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    await db.collection('users').doc(uid).collection('morale').doc(weekKey).set({
      week: weekKey,
      score: morale,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return new Response(JSON.stringify({ success: true, week: weekKey }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
