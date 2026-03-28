import { NextRequest, NextResponse } from 'next/server';
import { groqCompletion } from '@/lib/ai/groq-client';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { BlueprintSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 3, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    // Pro-only feature
    if (guard.user.tier === 'free') {
      return NextResponse.json(
        {
          error: 'Day-Zero Blueprint is a Pro feature. Upgrade to generate strategic proposals.',
          upgrade: true,
          preview: true,
        },
        { status: 403 }
      );
    }

    const validated = await validateBody(req, BlueprintSchema);
    if (!validated.success) return validated.error;
    const { resume, jobDescription } = validated.data;

    const candidateName = (resume as any).name || 'The Candidate';
    const candidateTitle = (resume as any).title || 'Professional';

    const systemPrompt = `You are a world-class management consultant who writes strategic 90-day onboarding plans.

You must REVERSE-ENGINEER the target company's biggest problems from the Job Description, then write a compelling "First 90 Days" proposal that positions the candidate as a strategic hire — not just an applicant.

RULES:
1. Write in first person ("I will...") — this is the candidate's voice
2. Be SPECIFIC to the actual JD requirements. Don't be generic.
3. Reference the candidate's REAL experience from their resume when proposing initiatives
4. Include specific, measurable outcomes for each phase
5. Keep it concise — executives skim. Use bullet points.
6. Sound like a confident consultant pitching a board, not a desperate job seeker
7. NEVER use the words: "passionate", "leverage", "synergy", "synergize", "utilize"
8. Use sharp, direct language: "I'll audit...", "I'll ship...", "I'll build...", "I'll cut..."

FORMAT (return as plain text with markdown formatting):

# First 90 Days: [Role Title] at [Company Name]
## Proposed by ${candidateName}

### Phase 1: Discovery & Quick Wins (Days 1-30)
**Objective:** [One-line goal]
- [3-4 specific initiatives with measurable targets]

### Phase 2: Build & Execute (Days 31-60)
**Objective:** [One-line goal]
- [3-4 specific initiatives tied to JD requirements]

### Phase 3: Scale & Measure (Days 61-90)
**Objective:** [One-line goal]
- [3-4 specific initiatives with KPIs]

### Why Me
[2-3 sentences connecting the candidate's SPECIFIC past achievements to the company's needs. Pull from their actual resume — cite real projects, numbers, companies.]`;

    const blueprint = await groqCompletion(
      systemPrompt,
      `CANDIDATE RESUME:\nName: ${candidateName}\nTitle: ${candidateTitle}\nSummary: ${resume.summary || ''}\nExperience: ${JSON.stringify(resume.experience || [])}\nSkills: ${JSON.stringify(resume.skills || [])}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}`,
      { temperature: 0.5, maxTokens: 2000 }
    );

    return NextResponse.json({ blueprint });
  } catch (error: unknown) {
    console.error('[api/resume/blueprint] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate blueprint' },
      { status: 500 }
    );
  }
}
