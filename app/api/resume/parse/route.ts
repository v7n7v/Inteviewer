import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion } from '@/lib/ai/groq-client';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing resume text' }, { status: 400 });
    }

    const systemPrompt = `You are a resume parser. Extract structured data from resume text.
Return JSON matching this exact structure:
{
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
Extract as much detail as possible. For achievements, focus on quantifiable results.`;

    const parsed = await groqJSONCompletion(systemPrompt, `Parse this resume:\n\n${text}`, {
      temperature: 0.3,
      maxTokens: 4096,
    });

    return NextResponse.json({ resume: parsed });
  } catch (error: any) {
    console.error('Resume parse error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse resume' },
      { status: 500 }
    );
  }
}
