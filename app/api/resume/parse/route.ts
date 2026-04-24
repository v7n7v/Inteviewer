import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { ResumeParseSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000, allowAnonymous: true });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, ResumeParseSchema);
    if (!validated.success) return validated.error;
    const { text } = validated.data;

    const safeText = sanitizeForAI(text, 100_000);

    const systemPrompt = `You are a strict resume parser and validator. First, verify if the provided text structurally resembles a resume or CV.
A resume typically contains contact info, work experience, education, and skills. 
If the document is a syllabus, recipe, random article, or clearly NOT a resume, you MUST set "isResume": false and leave the rest empty.

Return JSON matching this exact structure:
{
  "isResume": true,  // Set to false if the text is clearly not a resume
  "name": "Full Name",
  "title": "Job Title",
  "email": "email@example.com",
  "phone": "phone number",
  "location": "City, State",
  "summary": "Professional summary paragraph",
  "experience": [{"company": "Company", "role": "Role", "duration": "Date Range", "achievements": ["Achievement 1", "Achievement 2"]}],
  "education": [{"degree": "Degree", "institution": "School", "year": "Year"}],
  "skills": [{"category": "Category Name", "items": ["Skill1", "Skill2"]}],
  "certifications": ["Certification 1"]
}
If isResume is true, extract as much detail as possible. For achievements, focus on quantifiable results.`;

    const parsed = await groqJSONCompletion(systemPrompt, `Parse and validate this document:\n\n${safeText}`, {
      temperature: 0.1,
      maxTokens: 4096,
    });

    if (parsed.isResume === false) {
      return NextResponse.json({ error: 'INVALID_DOCUMENT', message: "This document doesn't look like a resume. Please upload a valid resume." }, { status: 400 });
    }

    return NextResponse.json({ resume: parsed });
  } catch (error: unknown) {
    console.error('[api/resume/parse] Error:', error);
    monitor.critical('Tool: resume/parse', String(error));
    return NextResponse.json(
      { error: 'Failed to parse resume' },
      { status: 500 }
    );
  }
}
