/**
 * Apply Pipeline — One-Click Apply with Sona
 * Orchestrates: Resume Morph → Cover Letter → Application Tracker
 * All in a single server-side pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { checkUsageAllowed, incrementUsage } from '@/lib/usage-tracker';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { sanitizeForAI } from '@/lib/sanitize';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    if (guard.user.tier === 'free') {
      return NextResponse.json(
        { error: 'Apply Pipeline is a Pro feature. Upgrade to unlock one-click applications.', upgrade: true },
        { status: 403 }
      );
    }

    const usageCheck = await checkUsageAllowed(guard.user.uid, 'morphs', guard.user.tier);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: `Morph limit reached (${usageCheck.cap}). Upgrade for more.`, upgrade: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { jobTitle, company, jobDescription, jobUrl } = body;

    if (!jobTitle || !company) {
      return NextResponse.json({ error: 'jobTitle and company are required' }, { status: 400 });
    }

    const safeJD = sanitizeForAI(jobDescription || `${jobTitle} at ${company}`);
    const userId = guard.user.uid;
    const db = getAdminDb();

    // Step 1: Fetch user's latest resume from Vault
    const resumeSnap = await db
      .collection('users').doc(userId)
      .collection('resume_versions')
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    let baseResume: any = null;
    let resumeVersionId: string | null = null;

    if (!resumeSnap.empty) {
      const resumeDoc = resumeSnap.docs[0];
      baseResume = resumeDoc.data().content;
      resumeVersionId = resumeDoc.id;
    }

    // Step 2: Morph resume (if base exists)
    let morphedResume = baseResume;
    let matchScore = 0;

    if (baseResume) {
      try {
        const morphResult = await groqJSONCompletion<{ morphedResume: any; matchScore: number }>(
          `You are a veteran resume strategist. Morph this resume for the target job.
          
RULES:
1. Rewrite summary to align with the JD (50% JD keywords / 50% original voice)
2. Reorder and enhance experience bullets for relevance
3. Add missing JD-required skills
4. Never invent fake experience
5. Use natural verbs: "built", "led", "shipped", "grew", "cut"
6. BANNED: "leveraged", "spearheaded", "synergized", "facilitated"
7. Quantify with specific numbers

Return JSON: { "morphedResume": { ...full resume object... }, "matchScore": 75 }`,
          `ORIGINAL RESUME:\n${JSON.stringify(baseResume, null, 2)}\n\nTARGET JOB:\n${jobTitle} at ${company}\n\nJOB DESCRIPTION:\n${safeJD}`,
          { temperature: 0.4, maxTokens: 5000 }
        );

        if (morphResult.morphedResume?.name || morphResult.morphedResume?.summary) {
          morphedResume = morphResult.morphedResume;
          matchScore = morphResult.matchScore || 75;
        }
      } catch (e) {
        console.warn('[ApplyPipeline] Resume morph failed, using original:', e);
        matchScore = 60;
      }
    }

    // Step 3: Generate cover letter
    let coverLetter = '';
    try {
      const resumeContext = morphedResume
        ? `${morphedResume.name || ''}\n${morphedResume.title || ''}\n${morphedResume.summary || ''}\nExperience: ${(morphedResume.experience || []).map((e: any) => `${e.role} at ${e.company}`).join(', ')}`
        : 'No resume available';

      const clResult = await groqJSONCompletion<{ coverLetter: string }>(
        `You write cover letters that sound like a real human. Never use "I am writing to express my interest" or "proven track record". 
Keep it to 250-300 words, 3 paragraphs. Use contractions naturally. Reference the company by name.
Start with something unexpected — a relevant achievement or genuine insight about the company.
BANNED: "leveraging", "results-driven", "eager to contribute", "I believe I am a perfect fit"
Return JSON: { "coverLetter": "..." }`,
        `Write a cover letter for:\nCOMPANY: ${company}\nROLE: ${jobTitle}\nJD: ${safeJD}\n\nCANDIDATE:\n${resumeContext}`,
        { temperature: 0.7, maxTokens: 1500 }
      );
      coverLetter = clResult.coverLetter || '';
    } catch (e) {
      console.warn('[ApplyPipeline] Cover letter failed:', e);
    }

    // Step 4: Save to Firestore applications tracker
    const now = new Date().toISOString();
    const applicationData = {
      user_id: userId,
      company_name: company,
      job_title: jobTitle,
      job_description: jobDescription || null,
      resume_version_id: resumeVersionId,
      morphed_resume_name: `${company} — ${jobTitle}`,
      talent_density_score: matchScore,
      cover_letter: coverLetter,
      application_link: jobUrl || null,
      status: 'not_applied' as const,
      morphed_at: now,
      last_updated: now,
      created_at: now,
      source: 'apply_pipeline',
    };

    const appRef = await db
      .collection('users').doc(userId)
      .collection('applications')
      .add(applicationData);

    // Save morphed resume as a new version
    let morphedVersionId: string | null = null;
    if (morphedResume && baseResume) {
      const versionData = {
        user_id: userId,
        version_name: `${company} — ${jobTitle}`,
        content: morphedResume,
        skill_graph: null,
        mode: 'technical',
        is_active: false,
        created_at: now,
        updated_at: now,
      };
      const versionRef = await db
        .collection('users').doc(userId)
        .collection('resume_versions')
        .add(versionData);
      morphedVersionId = versionRef.id;

      // Link the morphed resume to the application
      await appRef.update({ resume_version_id: morphedVersionId });
    }

    await incrementUsage(userId, 'morphs');

    return NextResponse.json({
      success: true,
      applicationId: appRef.id,
      morphedResume,
      matchScore,
      coverLetter,
      morphedVersionId,
      hasResume: !!baseResume,
    });
  } catch (error: any) {
    console.error('[ApplyPipeline] Error:', error);
    monitor.critical('Tool: agent/apply-pipeline', String(error));
    return NextResponse.json(
      { error: 'Apply pipeline failed. Please try again.' },
      { status: 500 }
    );
  }
}
