/**
 * Agent Pipeline Cron — /api/cron/agent-pipeline
 *
 * Triggered daily at 2am UTC by Cloud Scheduler.
 * Per user: scan boards → score with AI → morph resume → generate cover letter → queue for review.
 *
 * Setup:
 *   URL:  https://talentconsulting.io/api/cron/agent-pipeline
 *   Method: POST
 *   Headers: Authorization: Bearer <CRON_SECRET>
 *   Schedule: 0 2 * * * (daily at 2am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { searchJobsAdzuna, type RealJob } from '@/lib/job-search-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { Resend } from 'resend';
import { monitor } from '@/lib/monitor';
import { EMAIL_FROM, buildAgentDigestEmail, type AgentJobForDigest } from '@/lib/email-templates';
import { getOrComputeTwin, invalidateTwin, type CareerTwin } from '@/lib/career-twin';
import {
  applyResumeMorphGuardrails,
  getResumeMorphConsentForUser,
  resolveResumeMorphAccess,
  type ResumeMorphGuardrailReport,
} from '@/lib/resume-morph-guardrails';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow ?test=true for manual testing with auth
  const isTest = req.nextUrl.searchParams.get('test') === 'true';

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const results: { uid: string; status: string; queued?: number; error?: string }[] = [];
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const batchDate = new Date().toISOString().split('T')[0];

  try {
    const usersSnap = await db.collection('users').listDocuments();
    const maxUsers = isTest ? 1 : 50;

    for (const userDocRef of usersSnap.slice(0, maxUsers)) {
      const uid = userDocRef.id;

      try {
        // 1. Load preferences
        const prefsSnap = await db.collection('users').doc(uid).collection('settings').doc('jobPreferences').get();
        if (!prefsSnap.exists) { results.push({ uid, status: 'skip:no-prefs' }); continue; }

        const prefs = prefsSnap.data()!;
        if (!prefs.agentEnabled) { results.push({ uid, status: 'skip:agent-off' }); continue; }

        // Tier enforcement — load subscription
        const [userSnap, subSnap] = await Promise.all([
          userDocRef.get(),
          db.collection('users').doc(uid).collection('subscription').doc('current').get(),
        ]);
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};
        const plan = userData.email?.toLowerCase() === 'alula2006@gmail.com' ? 'god' : (subSnap.exists ? (subSnap.data()?.plan || 'free') : 'free');
        const AGENT_LIMITS: Record<string, number> = { free: 0, pro: 3, studio: 10, god: 50 };
        const tierLimit = AGENT_LIMITS[plan] ?? 0;

        if (tierLimit === 0) { results.push({ uid, status: 'skip:free-tier' }); continue; }

        let twin: CareerTwin | null = null;
        try {
          twin = await getOrComputeTwin(uid);
        } catch {
          twin = null;
        }

        const targetRoles: string[] = (prefs.targetRoles?.length ? prefs.targetRoles : twin?.memory.goals.targetRoles) || [];
        const preferredCities: string[] = (prefs.preferredCities?.length ? prefs.preferredCities : twin?.memory.constraints.preferredCities) || [];
        const remotePref: string = prefs.remotePref || twin?.memory.goals.remotePreference || 'any';
        const salaryMin: number = prefs.salaryMin || twin?.memory.goals.salaryMin || 0;
        const maxPerNight: number = Math.min(tierLimit, Math.max(1, prefs.agentMaxPerNight || 5));
        const minMatchScore: number = prefs.agentMinMatchScore || 70;
        const excludeCompanies: string[] = ((prefs.agentExcludeCompanies?.length ? prefs.agentExcludeCompanies : twin?.memory.constraints.excludedCompanies) || []).map((c: string) => c.toLowerCase());
        const rawAutonomyLevel = prefs.agentAutonomyLevel || twin?.memory.constraints.autonomyLevel;
        const autonomyLevel: 'scout' | 'prepare' | 'review' | 'assist' = typeof rawAutonomyLevel === 'string' && ['scout', 'prepare', 'review', 'assist'].includes(rawAutonomyLevel)
          ? rawAutonomyLevel as 'scout' | 'prepare' | 'review' | 'assist'
          : 'prepare';
        const canPrepareAssets = autonomyLevel !== 'scout';

        if (targetRoles.length === 0) { results.push({ uid, status: 'skip:no-roles' }); continue; }

        // 2. Get user email + profile
        const profileSnap = await db.collection('users').doc(uid).collection('profile').doc('main').get();
        const email = profileSnap.data()?.email || userData.email;
        const userName = profileSnap.data()?.fullName?.split(' ')[0] || 'there';

        // 3. Load existing queue + applications for dedup
        const existingQueueSnap = await db.collection('users').doc(uid).collection('agent_queue').get();
        const existingAppsSnap = await db.collection('users').doc(uid).collection('applications').get();

        const seenJobs = new Set<string>();
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

        existingQueueSnap.docs.forEach(d => {
          const data = d.data();
          if (new Date(data.created_at).getTime() > twoWeeksAgo) {
            seenJobs.add(`${data.job_title?.toLowerCase()?.trim()}|${data.company?.toLowerCase()?.trim()}`);
          }
        });
        existingAppsSnap.docs.forEach(d => {
          const data = d.data();
          seenJobs.add(`${data.job_title?.toLowerCase()?.trim()}|${data.company_name?.toLowerCase()?.trim()}`);
        });

        // 4. Fetch fresh jobs
        const allJobs: RealJob[] = [];
        const cities = preferredCities.length > 0 ? preferredCities.slice(0, 3) : [''];
        const roles = targetRoles.slice(0, 3);
        const combos = roles.flatMap(role => cities.map(city => ({ role, city }))).slice(0, 6);

        for (const { role, city } of combos) {
          try {
            const result = await searchJobsAdzuna({
              query: role, location: city, country: 'us',
              page: 1, resultsPerPage: 10, sortBy: 'date',
              salaryMin: salaryMin || undefined,
            });
            for (const job of result.jobs) {
              const dedupKey = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
              if (seenJobs.has(dedupKey)) continue;
              if (excludeCompanies.some(ex => job.company.toLowerCase().includes(ex))) continue;
              const locLower = job.location.toLowerCase();
              if (remotePref === 'remote' && !locLower.includes('remote')) continue;
              if (remotePref === 'onsite' && locLower.includes('remote')) continue;
              seenJobs.add(dedupKey);
              allJobs.push(job);
            }
          } catch (e) {
            console.warn(`[agent-pipeline] Fetch failed: ${role} in ${city}`, e);
          }
        }

        if (allJobs.length === 0) { results.push({ uid, status: 'skip:no-jobs' }); continue; }

        // 5. Score with Gemini
        let userSkills: string[] = [];
        try {
          const vaultSnap = await db.collection('users').doc(uid).collection('vault').limit(1).get();
          if (!vaultSnap.empty) {
            const rData = vaultSnap.docs[0].data();
            userSkills = rData.skills || rData.parsed?.skills || [];
          }
        } catch { /* fallback to empty */ }

        let scoredJobs: { job: RealJob; score: number; reason: string }[] = [];
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

        if (apiKey && userSkills.length > 0) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const candidates = allJobs.slice(0, 20);
            const summaries = candidates.map((j, i) =>
              `[${i}] ${j.title} at ${j.company} | ${j.location} | Skills: ${j.skills.join(', ') || 'N/A'} | ${j.employmentType}`
            ).join('\n');

            const result = await model.generateContent(`You are a career advisor. Skills: [${userSkills.join(', ')}]
Looking for: ${targetRoles.join(', ')} roles.
Rate each job's acceptance chance (0-100). Be realistic (40-85 range).
Jobs:\n${summaries}
Respond ONLY with JSON array: [{"index":0,"score":85,"reason":"..."}]`);

            const text = result.response.text().trim().replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const scores: { index: number; score: number; reason: string }[] = JSON.parse(text);

            scoredJobs = scores
              .filter(s => s.index >= 0 && s.index < candidates.length && s.score >= minMatchScore)
              .map(s => ({ job: candidates[s.index], score: Math.min(98, s.score), reason: s.reason }))
              .sort((a, b) => b.score - a.score)
              .slice(0, maxPerNight);
          } catch (e) {
            console.warn('[agent-pipeline] Gemini scoring failed:', e);
          }
        }

        if (scoredJobs.length === 0) { results.push({ uid, status: 'skip:no-matches' }); continue; }

        // 6. Load base resume
        let baseResume: any = null;
        try {
          const resumeSnap = await db.collection('users').doc(uid)
            .collection('resume_versions').orderBy('created_at', 'desc').limit(1).get();
          if (!resumeSnap.empty) baseResume = resumeSnap.docs[0].data().content;
        } catch { /* no resume */ }

        const morphConsent = await getResumeMorphConsentForUser(uid);
        const morphAccess = resolveResumeMorphAccess({
          requestedMorphPercentage: 100,
          hasFullConsent: morphConsent.unlocked100,
          mode: 'automated',
        });

        // 7. Morph + Cover Letter + Queue for each job
        const queuedJobs: AgentJobForDigest[] = [];

        for (const { job, score, reason } of scoredJobs) {
          try {
            let morphedResume = baseResume;
            let morphGuardrailReport: ResumeMorphGuardrailReport | null = null;

            // Morph resume
            if (baseResume && canPrepareAssets) {
              try {
                const morphResult = await groqJSONCompletion<{ morphedResume: any }>(
                  `Morph this resume for the target job. Keep it authentic.
MORPHING FORMULA: ${morphAccess.effectiveMorphPercentage}% JD Alignment / ${100 - morphAccess.effectiveMorphPercentage}% Original
STRICT: Never invent certifications, licenses, degrees, schools, employers, job titles, dates, contact details, or experience. Only reframe.
EDUCATION LOCK: Return education exactly as provided. Do not add, remove, rename, reorder, or reword schools, degrees, years, or details.
BANNED: "leveraged", "spearheaded", "synergized", "facilitated"
Return JSON: { "morphedResume": { ...full resume object... } }`,
                  `RESUME:\n${JSON.stringify(baseResume, null, 2)}\n\nTARGET:\n${job.title} at ${job.company}\n\nDESCRIPTION:\n${job.description?.slice(0, 2000) || job.title}`,
                  { temperature: 0.4, maxTokens: 4000 }
                );
                if (morphResult.morphedResume?.name || morphResult.morphedResume?.summary) {
                  const guarded = applyResumeMorphGuardrails(baseResume, morphResult.morphedResume, morphAccess);
                  morphedResume = guarded.resume;
                  morphGuardrailReport = guarded.report;
                }
              } catch { /* use original */ }
            }

            // Generate cover letter
            let coverLetter = '';
            if (canPrepareAssets) try {
              const clResult = await groqJSONCompletion<{ coverLetter: string }>(
                `Write a natural cover letter. 250-300 words, 3 paragraphs. Use contractions.
Start with a relevant achievement. Reference the company by name.
BANNED: "leveraging", "results-driven", "eager to contribute"
Return JSON: { "coverLetter": "..." }`,
                `COMPANY: ${job.company}\nROLE: ${job.title}\nCANDIDATE SUMMARY: ${morphedResume?.summary || baseResume?.summary || 'Experienced professional'}`,
                { temperature: 0.7, maxTokens: 1200 }
              );
              coverLetter = clResult.coverLetter || '';
            } catch { /* empty cover letter is acceptable */ }

            // Save morphed resume version
            let resumeVersionId: string | undefined;
            if (morphedResume && baseResume && canPrepareAssets) {
              try {
                const vRef = await db.collection('users').doc(uid).collection('resume_versions').add({
                  user_id: uid,
                  version_name: `[Agent] ${job.company} — ${job.title}`,
                  content: morphedResume,
                  mode: 'technical',
                  guardrail_report: morphGuardrailReport,
                  morph_effective_percentage: morphAccess.effectiveMorphPercentage,
                  is_active: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                resumeVersionId = vRef.id;
              } catch { /* non-critical */ }
            }

            // Create queue item
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const salaryMeetsTarget = !salaryMin || !job.salary.min || job.salary.min >= salaryMin;
            const freshPosting = !job.postedDate || (Date.now() - new Date(job.postedDate).getTime()) < 14 * 24 * 60 * 60 * 1000;
              const fitSignals = [
                `Matched ${targetRoles.slice(0, 2).join(', ')} target${targetRoles.length > 1 ? 's' : ''}.`,
                score >= 85 ? 'High confidence fit based on your profile.' : 'Meets your minimum score threshold.',
                salaryMeetsTarget ? 'Salary appears aligned with your floor.' : 'Salary data is incomplete or below your target.',
                freshPosting ? 'Posting appears recent.' : 'Posting may be older.',
                ...(twin?.memory.nextBestActions[0] ? [`Career Twin priority: ${twin.memory.nextBestActions[0].label}.`] : []),
              ];
            const riskSignals = [
              ...(!baseResume ? ['No saved resume version was available for tailoring.'] : []),
              ...(!coverLetter && canPrepareAssets ? ['Cover letter draft needs review or regeneration.'] : []),
              ...(!job.url ? ['No direct application URL was available.'] : []),
            ];
            await db.collection('users').doc(uid).collection('agent_queue').add({
              user_id: uid,
              job_title: job.title,
              company: job.company,
              location: job.location,
              job_url: job.url,
              job_description: job.description?.slice(0, 3000) || '',
              salary: { min: job.salary.min, max: job.salary.max },
              employment_type: job.employmentType,
              posted_date: job.postedDate,
              match_score: score,
              match_reason: reason,
              morphed_resume: morphedResume,
              morph_effective_percentage: morphAccess.effectiveMorphPercentage,
              morph_guardrail_report: morphGuardrailReport,
              cover_letter: coverLetter,
              resume_version_id: resumeVersionId || null,
              status: 'pending',
              source: 'nightly_agent',
              packetStatus: canPrepareAssets ? 'prepared' : 'needs_review',
              fitSignals,
              riskSignals,
              nextAction: canPrepareAssets
                ? 'Review the tailored resume and cover letter, then open the application when ready.'
                : 'Ask Sona to prepare a resume and cover letter before applying.',
              feedbackTags: [],
              agentRunId: batchId,
              autonomyLevel,
              created_at: new Date().toISOString(),
              expires_at: expiresAt,
              batch_id: batchId,
              batch_date: batchDate,
            });

            const salaryStr = job.salary.min && job.salary.max
              ? `$${Math.round(job.salary.min / 1000)}k-$${Math.round(job.salary.max / 1000)}k`
              : '';

            queuedJobs.push({
              title: job.title,
              company: job.company,
              location: job.location,
              matchScore: score,
              salary: salaryStr,
              reason,
              nextAction: canPrepareAssets ? 'Review packet' : 'Prepare assets',
              riskCount: riskSignals.length,
            });
          } catch (e) {
            console.warn(`[agent-pipeline] Failed to process ${job.title} at ${job.company}:`, e);
          }
        }

        // 8. Send opt-in digest email to the user only
        const digestEnabled = prefs.emailNotifications !== false && prefs.agentDigestEmailEnabled === true;
        const weeklyRecentlySent = prefs.agentDigestFrequency === 'weekly'
          && prefs.lastAgentDigestAt
          && Date.now() - new Date(prefs.lastAgentDigestAt).getTime() < 6 * 24 * 60 * 60 * 1000;
        if (queuedJobs.length > 0 && email && digestEnabled && !weeklyRecentlySent) {
          try {
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
              const resend = new Resend(resendKey);
              const { subject, html } = buildAgentDigestEmail(userName, queuedJobs);
              await resend.emails.send({ from: EMAIL_FROM, to: email, subject, html });
              await db.collection('users').doc(uid).collection('settings').doc('jobPreferences').set({
                lastAgentDigestAt: new Date().toISOString(),
              }, { merge: true });
            }
          } catch (e) {
            console.warn('[agent-pipeline] Digest email failed:', e);
          }
        }

        if (queuedJobs.length > 0) {
          invalidateTwin(uid).catch(() => {});
        }

        results.push({ uid, status: 'processed', queued: queuedJobs.length });
      } catch (err: any) {
        results.push({ uid, status: 'error', error: err.message });
      }
    }

    const processed = results.filter(r => r.status === 'processed');
    const totalQueued = processed.reduce((sum, r) => sum + (r.queued || 0), 0);

    monitor.info('Agent Pipeline Cron', `Processed ${processed.length} users, queued ${totalQueued} jobs`, [
      { name: 'Users', value: String(results.length) },
      { name: 'Processed', value: String(processed.length) },
      { name: 'Total Queued', value: String(totalQueued) },
      { name: 'Batch', value: batchId },
    ]);

    return NextResponse.json({
      success: true,
      batchId,
      results,
      summary: { total: results.length, processed: processed.length, totalQueued },
    });
  } catch (err: any) {
    console.error('[cron/agent-pipeline] Fatal error:', err);
    monitor.critical('Tool: cron/agent-pipeline', String(err));
    return NextResponse.json({ error: 'Agent pipeline failed' }, { status: 500 });
  }
}
