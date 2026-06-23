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
import { calculateATSScore } from '@/lib/ats-score';
import { invalidateTwin } from '@/lib/career-twin';
import {
  applyResumeMorphGuardrails,
  getResumeMorphConsentForUser,
  resolveResumeMorphAccess,
  type ResumeMorphGuardrailReport,
} from '@/lib/resume-morph-guardrails';

function flattenResumeToText(resume: any): string {
  if (!resume) return '';
  const parts: string[] = [];
  if (resume.name) parts.push(resume.name);
  if (resume.title) parts.push(resume.title);
  if (resume.summary) parts.push(resume.summary);
  if (Array.isArray(resume.skills)) {
    parts.push(resume.skills.map((skill: any) => typeof skill === 'string' ? skill : skill?.name || skill?.label || '').filter(Boolean).join(', '));
  }
  if (Array.isArray(resume.experience)) {
    for (const exp of resume.experience) {
      parts.push([exp.role || exp.title, exp.company].filter(Boolean).join(' at '));
      if (exp.description) parts.push(exp.description);
      if (Array.isArray(exp.bullets)) parts.push(...exp.bullets);
      if (Array.isArray(exp.achievements)) parts.push(...exp.achievements);
    }
  }
  if (Array.isArray(resume.education)) {
    parts.push(...resume.education.map((edu: any) => [edu.degree, edu.institution || edu.school].filter(Boolean).join(' ')));
  }
  return parts.filter(Boolean).join('\n');
}

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
    const { jobTitle, company, jobDescription, jobUrl, jobId, sourceMeta, resumeVersionId: requestedResumeVersionId, fitScore, prepareOnly } = body;

    if (!jobTitle || !company) {
      return NextResponse.json({ error: 'jobTitle and company are required' }, { status: 400 });
    }

    const safeJD = sanitizeForAI(jobDescription || `${jobTitle} at ${company}`);
    const userId = guard.user.uid;
    const db = getAdminDb();
    const morphConsent = await getResumeMorphConsentForUser(userId);
    const morphAccess = resolveResumeMorphAccess({
      requestedMorphPercentage: 100,
      hasFullConsent: morphConsent.unlocked100,
      mode: 'automated',
    });

    // Step 1: Fetch user's latest resume from Vault
    let baseResume: any = null;
    let resumeVersionId: string | null = null;

    const resumeQuery = db.collection('users').doc(userId).collection('resume_versions');
    if (requestedResumeVersionId) {
      const resumeDoc = await resumeQuery.doc(requestedResumeVersionId).get();
      if (resumeDoc.exists) {
        baseResume = resumeDoc.data()?.content;
        resumeVersionId = resumeDoc.id;
      }
    } else {
      const resumeSnap = await resumeQuery.orderBy('created_at', 'desc').limit(1).get();
      if (!resumeSnap.empty) {
        const resumeDoc = resumeSnap.docs[0];
        baseResume = resumeDoc.data().content;
        resumeVersionId = resumeDoc.id;
      }
    }

    // Step 2: Morph resume (if base exists)
    let morphedResume = baseResume;
    let matchScore = 0;
    let morphGuardrailReport: ResumeMorphGuardrailReport | null = null;

    if (baseResume) {
      try {
        const morphResult = await groqJSONCompletion<{ morphedResume: any; matchScore: number }>(
          `You are a veteran resume strategist. Morph this resume for the target job.
MORPHING FORMULA: ${morphAccess.effectiveMorphPercentage}% JD Alignment / ${100 - morphAccess.effectiveMorphPercentage}% Original
          
RULES:
1. Rewrite summary to align with the JD using the morphing formula above
2. Reorder and enhance experience bullets for relevance
3. Add missing JD-required skills
4. STRICT GUARDRAIL: NEVER invent certifications, licenses, degrees, schools, employers, job titles, dates, contact details, or experience. Only reframe what exists.
5. EDUCATION LOCK: Return education exactly as provided. Do not add, remove, rename, reorder, or reword schools, degrees, years, or details.
6. Use natural verbs: "built", "led", "shipped", "grew", "cut"
7. BANNED: "leveraged", "spearheaded", "synergized", "facilitated"
8. Quantify with specific numbers

Return JSON: { "morphedResume": { ...full resume object... }, "matchScore": 75 }`,
          `ORIGINAL RESUME:\n${JSON.stringify(baseResume, null, 2)}\n\nTARGET JOB:\n${jobTitle} at ${company}\n\nJOB DESCRIPTION:\n${safeJD}`,
          { temperature: 0.4, maxTokens: 5000 }
        );

        if (morphResult.morphedResume?.name || morphResult.morphedResume?.summary) {
          const guarded = applyResumeMorphGuardrails(baseResume, morphResult.morphedResume, morphAccess);
          morphedResume = guarded.resume;
          morphGuardrailReport = guarded.report;
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
    const resumeText = flattenResumeToText(morphedResume);
    const atsResult = resumeText && safeJD ? calculateATSScore(resumeText, safeJD) : null;
    const keywordGaps = atsResult?.keywords
      ?.filter(keyword => keyword.status === 'missing' || keyword.status === 'partial')
      .map(keyword => keyword.keyword)
      .slice(0, 12) || [];
    const applicationData = {
      user_id: userId,
      job_id: jobId || null,
      company_name: company,
      job_title: jobTitle,
      job_description: jobDescription || null,
      resume_version_id: resumeVersionId,
      morphed_resume_name: `${company} — ${jobTitle}`,
      talent_density_score: fitScore?.overall || matchScore,
      ats_score: atsResult?.overallScore || null,
      keyword_gaps: keywordGaps,
      cover_letter: coverLetter,
      morph_effective_percentage: morphAccess.effectiveMorphPercentage,
      morph_guardrail_report: morphGuardrailReport,
      application_link: jobUrl || null,
      status: 'not_applied' as const,
      packet_status: prepareOnly ? 'ready_for_review' : 'ready_for_review',
      source_meta: sourceMeta || null,
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
        guardrail_report: morphGuardrailReport,
        morph_effective_percentage: morphAccess.effectiveMorphPercentage,
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
    invalidateTwin(userId).catch(() => {});

    return NextResponse.json({
      success: true,
      applicationId: appRef.id,
      packetStatus: 'ready_for_review',
      morphedResume,
      matchScore,
      coverLetter,
      morphedVersionId,
      effectiveMorphPercentage: morphAccess.effectiveMorphPercentage,
      maxAllowedMorphPercentage: morphAccess.maxAllowedMorphPercentage,
      guardrailReport: morphGuardrailReport,
      hasResume: !!baseResume,
      atsResult,
      keywordGaps,
      warnings: [
        ...(!baseResume ? ['No saved resume was found, so Sona could not create a tailored resume version.'] : []),
        ...(keywordGaps.length > 0 ? [`${keywordGaps.length} keyword gaps remain for review.`] : []),
      ],
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
