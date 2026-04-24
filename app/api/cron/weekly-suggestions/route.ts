/**
 * Weekly Job Suggestions Cron — /api/cron/weekly-suggestions
 * 
 * Triggered by Google Cloud Scheduler (or external cron) every Monday at 9am.
 * Self-contained: fetches jobs, scores with AI, sends digest emails.
 * 
 * Setup: 
 *   1. Set CRON_SECRET env var in Firebase/Cloud Run
 *   2. Create Cloud Scheduler job:
 *      URL:  https://talentconsulting.io/api/cron/weekly-suggestions
 *      Method: POST
 *      Headers: Authorization: Bearer <CRON_SECRET>
 *      Schedule: 0 9 * * 1 (every Monday at 9am)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { searchJobsAdzuna, calculateFitScore, type RealJob } from '@/lib/job-search-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { monitor } from '@/lib/monitor';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const results: { uid: string; email?: string; status: string; jobCount?: number; error?: string }[] = [];

  try {
    const usersSnap = await db.collection('users').listDocuments();

    for (const userDocRef of usersSnap) {
      const uid = userDocRef.id;

      try {
        // 1. Load preferences
        const prefsSnap = await db.collection('users').doc(uid).collection('settings').doc('jobPreferences').get();
        if (!prefsSnap.exists) { results.push({ uid, status: 'skip:no-prefs' }); continue; }

        const prefs = prefsSnap.data()!;
        if (!prefs.emailNotifications) { results.push({ uid, status: 'skip:notif-off' }); continue; }

        const targetRoles: string[] = prefs.targetRoles || [];
        const preferredCities: string[] = prefs.preferredCities || [];
        const remotePref: string = prefs.remotePref || 'any';
        const salaryMin: number = prefs.salaryMin || 0;

        if (targetRoles.length === 0) { results.push({ uid, status: 'skip:no-roles' }); continue; }

        // 2. Get user email
        const profileSnap = await db.collection('users').doc(uid).collection('profile').doc('main').get();
        const email = profileSnap.data()?.email;
        const fullName = profileSnap.data()?.full_name || 'there';
        if (!email) { results.push({ uid, status: 'skip:no-email' }); continue; }

        // 3. Fetch jobs from Adzuna
        const allJobs: RealJob[] = [];
        const seenIds = new Set<string>();
        const cities = preferredCities.length > 0 ? preferredCities.slice(0, 3) : [''];
        const roles = targetRoles.slice(0, 3);
        const combos = roles.flatMap(role => cities.map(city => ({ role, city }))).slice(0, 6);

        for (const { role, city } of combos) {
          try {
            const result = await searchJobsAdzuna({ query: role, location: city, country: 'us', page: 1, resultsPerPage: 10, sortBy: 'relevance', salaryMin: salaryMin || undefined });
            for (const job of result.jobs) {
              const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
              if (seenIds.has(key)) continue;
              seenIds.add(key);
              const loc = job.location.toLowerCase();
              if (remotePref === 'remote' && !loc.includes('remote')) continue;
              if (remotePref === 'onsite' && loc.includes('remote')) continue;
              allJobs.push(job);
            }
          } catch { /* skip failed combo */ }
        }

        if (allJobs.length === 0) { results.push({ uid, email, status: 'skip:no-jobs' }); continue; }

        // 4. Score with Gemini
        let userSkills: string[] = [];
        try {
          const vaultSnap = await db.collection('users').doc(uid).collection('vault').limit(1).get();
          if (!vaultSnap.empty) {
            const data = vaultSnap.docs[0].data();
            userSkills = data.skills || data.parsed?.skills || [];
          }
        } catch { /* no skills */ }
        if (userSkills.length === 0 && prefs.manualSkills) userSkills = prefs.manualSkills;

        interface ScoredJob extends RealJob { acceptanceChance: number; acceptanceReason: string; }
        let scoredJobs: ScoredJob[] = [];

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        if (apiKey && userSkills.length > 0) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const candidates = allJobs.slice(0, 20);
            const summaries = candidates.map((j, i) => `[${i}] ${j.title} at ${j.company} | ${j.location} | Skills: ${j.skills.join(', ')}`).join('\n');

            const result = await model.generateContent(
              `Rate each job for a candidate with skills [${userSkills.join(', ')}] looking for ${targetRoles.join(', ')} roles.
Score "Chance of Acceptance" 0-100. Respond ONLY with JSON array:
[{"index":0,"score":85,"reason":"Strong match"}]

Jobs:\n${summaries}`
            );
            const text = result.response.text().replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const scores: { index: number; score: number; reason: string }[] = JSON.parse(text);

            scoredJobs = scores
              .filter(s => s.index >= 0 && s.index < candidates.length)
              .map(s => ({ ...candidates[s.index], acceptanceChance: Math.min(98, Math.max(15, s.score)), acceptanceReason: s.reason }))
              .sort((a, b) => b.acceptanceChance - a.acceptanceChance)
              .slice(0, 10);
          } catch { /* fallback below */ }
        }

        if (scoredJobs.length === 0) {
          scoredJobs = allJobs
            .map(j => ({
              ...j,
              acceptanceChance: userSkills.length > 0 ? calculateFitScore(userSkills, j.skills, j.title) : 60,
              acceptanceReason: 'Keyword match score',
            }))
            .sort((a, b) => b.acceptanceChance - a.acceptanceChance)
            .slice(0, 10);
        }

        // 5. Send email
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) { results.push({ uid, email, status: 'skip:no-resend-key' }); continue; }

        const resend = new Resend(resendKey);
        const jobRows = scoredJobs.map(j =>
          `<tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0">
              <a href="${j.url}" style="color:#0ea5e9;font-weight:600;text-decoration:none">${j.title}</a>
              <br><span style="color:#666;font-size:13px">${j.company} · ${j.location}</span>
            </td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;text-align:center">
              <span style="display:inline-block;padding:4px 10px;border-radius:8px;font-weight:700;font-size:13px;background:${j.acceptanceChance >= 80 ? '#dcfce7;color:#16a34a' : j.acceptanceChance >= 60 ? '#dbeafe;color:#2563eb' : '#fef3c7;color:#d97706'}">
                ${j.acceptanceChance}%
              </span>
            </td>
          </tr>`
        ).join('');

        await resend.emails.send({
          from: 'Talent Studio <hello@talentconsulting.io>',
          to: email,
          subject: `Your Weekly Job Picks — ${scoredJobs.length} matches found`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px">
              <h1 style="font-size:24px;color:#111;margin-bottom:4px">Your Weekly Picks</h1>
              <p style="color:#666;font-size:14px;margin-bottom:24px">
                Hi ${fullName}, here are your top ${scoredJobs.length} AI-curated matches based on your skills and preferences.
              </p>
              <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
                <thead>
                  <tr style="background:#f8fafc">
                    <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">ROLE</th>
                    <th style="padding:10px 16px;text-align:center;font-size:12px;color:#666;font-weight:600">FIT</th>
                  </tr>
                </thead>
                <tbody>${jobRows}</tbody>
              </table>
              <div style="margin-top:24px;text-align:center">
                <a href="https://talentconsulting.io/suite/job-search" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#06b6d4,#10b981);color:#fff;font-weight:600;border-radius:10px;text-decoration:none">
                  View All in Talent Studio →
                </a>
              </div>
              <p style="color:#999;font-size:11px;margin-top:32px;text-align:center">
                Talent Studio by TalentConsulting.io · You're receiving this because you enabled weekly job notifications.
              </p>
            </div>
          `,
        });

        // Update timestamp
        await db.collection('users').doc(uid).collection('settings').doc('jobPreferences').update({
          lastCronAt: new Date().toISOString(),
          lastCronJobCount: scoredJobs.length,
        }).catch(() => {});

        results.push({ uid, email, status: 'sent', jobCount: scoredJobs.length });

      } catch (userErr: any) {
        results.push({ uid, status: 'error', error: userErr.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const skipped = results.filter(r => r.status.startsWith('skip')).length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({ success: true, summary: { total: results.length, sent, skipped, errors }, results });
  } catch (err: any) {
    console.error('[cron] Fatal error:', err);
    monitor.critical('Tool: cron/weekly-suggestions', String(err));
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
