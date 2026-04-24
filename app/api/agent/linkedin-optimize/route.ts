/**
 * LinkedIn Profile Optimizer
 * Analyzes & rewrites LinkedIn sections to match the user's target roles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    if (guard.user.tier === 'free') {
      return NextResponse.json(
        { error: 'LinkedIn Optimizer is a Pro feature.', upgrade: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { headline, about, targetRole, resumeData } = body;

    const userId = guard.user.uid;
    const db = getAdminDb();

    // Use client-provided resume (morphed) if available, otherwise fetch from Firestore
    let resumeContext = '';
    if (resumeData) {
      resumeContext = JSON.stringify({
        name: resumeData.name,
        title: resumeData.title,
        summary: resumeData.summary,
        skills: Array.isArray(resumeData.skills)
          ? resumeData.skills.flatMap((c: any) => typeof c === 'string' ? [c] : c.items || [])
          : [],
        experience: (resumeData.experience || []).map((e: any) => ({
          role: e.role || e.title, company: e.company, bullets: (e.bullets || e.achievements || []).slice(0, 3),
        })),
      });
    } else {
      const resumeSnap = await db
        .collection('users').doc(userId)
        .collection('resume_versions')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();

      if (!resumeSnap.empty) {
        const resume = resumeSnap.docs[0].data()?.content;
        if (resume) {
          resumeContext = JSON.stringify({
            name: resume.name,
            title: resume.title,
            summary: resume.summary,
            skills: (resume.skills || []).flatMap((c: any) => c.items || []),
            experience: (resume.experience || []).map((e: any) => ({
              role: e.role, company: e.company, bullets: (e.bullets || []).slice(0, 3),
            })),
          });
        }
      }
    }

    // Fetch job preferences for target context
    let targetContext = targetRole || '';
    if (!targetContext) {
      const prefsDoc = await db.collection('users').doc(userId).collection('preferences').doc('job_search').get();
      if (prefsDoc.exists) {
        const prefs = prefsDoc.data();
        targetContext = (prefs?.targetRoles || []).join(', ');
      }
    }

    const result = await groqJSONCompletion<{
      headline: { current: string; optimized: string; score: number; tips: string[] };
      about: { current: string; optimized: string; score: number; tips: string[] };
      overallScore: number;
      keywordsMissing: string[];
      profileStrengths: string[];
      quickWins: string[];
    }>(
      `You are a LinkedIn optimization expert who has helped 5000+ professionals get more recruiter views. You understand the LinkedIn algorithm deeply.

RULES:
1. Headline: max 220 chars, keyword-rich, NOT just "Job Title at Company" — include the VALUE you deliver
2. About: 2600 char max, first-person, start with a hook (not "I am a..."), include a call to action
3. Use recruiter search keywords naturally — don't keyword stuff
4. Score each section 0-100 based on: keyword density, hook strength, specificity, differentiation
5. BANNED: "passionate professional", "results-oriented", "thought leader", "guru", "ninja", "rockstar"
6. Write like a human who is confident, not like a corporate PR statement
7. If no current headline/about is provided, generate fresh ones from the resume
8. Quick wins should be actionable items they can fix in 5 minutes

Return JSON:
{
  "headline": { "current": "...", "optimized": "...", "score": 75, "tips": ["tip1", "tip2"] },
  "about": { "current": "...", "optimized": "...", "score": 65, "tips": ["tip1", "tip2"] },
  "overallScore": 70,
  "keywordsMissing": ["keyword1", "keyword2"],
  "profileStrengths": ["strength1"],
  "quickWins": ["action1", "action2"]
}`,
      `CURRENT LINKEDIN:\nHeadline: ${headline || 'Not provided'}\nAbout: ${about || 'Not provided'}\n\nTARGET ROLE: ${targetContext || 'Not specified'}\n\nRESUME DATA:\n${resumeContext || 'No resume available'}`,
      { temperature: 0.5, maxTokens: 3000 }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[LinkedIn] Error:', error);
    monitor.critical('Tool: agent/linkedin-optimize', String(error));
    return NextResponse.json(
      { error: 'Failed to optimize profile.' },
      { status: 500 }
    );
  }
}
