import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { guardApiRoute } from '@/lib/api-auth';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 7, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const { jobDescription, resumeText, interviewStyle, questionCount, interviewType, drillCategory, mode, drillRole } = await req.json();

        // ===== FLASHCARD MODE =====
        if (mode === 'flashcards') {
            const flashcardPrompt = `Generate exactly ${questionCount || 10} study flashcards for interview preparation.

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription.substring(0, 3000)}` : ''}
${resumeText ? `\nCANDIDATE'S RESUME:\n${resumeText.substring(0, 2000)}` : ''}

Generate flashcards that help the candidate prepare for this specific role. Each card should:
- Cover a key concept, framework, or skill mentioned in the JD
- Have a clear, concise question on the front
- Have a detailed but focused answer on the back (2-3 sentences max)
- Include the category (technical, behavioral, domain, company-specific)

Focus on:
- Technical concepts they'll be tested on
- Behavioral scenarios they should prepare stories for
- Industry/domain knowledge gaps
- Company-specific knowledge they should research`;

            const flashcardSystem = `Return a JSON object with a "flashcards" array. Each flashcard has:
- "question": Front of card (the question/prompt)
- "answer": Back of card (the ideal answer, 2-3 sentences)
- "category": One of "technical", "behavioral", "domain", "company"
- "difficulty": "basic", "intermediate", "advanced"

Return: { "flashcards": [...] }`;

            const response = await groq.chat.completions.create({
                model: 'openai/gpt-oss-120b',
                messages: [
                    { role: 'system', content: flashcardSystem },
                    { role: 'user', content: flashcardPrompt },
                ],
                temperature: 0.6,
                max_tokens: 4000,
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No response from Groq');
            return NextResponse.json(JSON.parse(content));
        }

        // ===== INTERVIEW QUESTION MODE =====
        let prompt = '';

        if (interviewType === 'mock-interview') {
            if (!jobDescription) {
                return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
            }
            prompt = `You are simulating a ${interviewStyle === 'tough' ? 'senior director' : 'friendly hiring manager'} conducting a real interview.

Generate exactly ${questionCount} interview questions for this role.

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

${resumeText ? `CANDIDATE'S RESUME:\n${resumeText.substring(0, 2000)}\n\nGenerate questions that PROBE the gaps between the resume and JD. Attack their weak spots while exploring their strengths.` : 'Generate questions that test the key requirements in this JD.'}

REQUIREMENTS:
- Mix question types: at least 2 behavioral, 1-2 technical, and 1 situational
- Behavioral questions must require STAR format answers
- Technical questions should be contextual (not trivia)
- Each question must have a "context" explaining WHY you're asking it
- Make questions ${interviewStyle === 'tough' ? 'challenging and probing' : 'fair but thorough'}
- Questions should feel realistic, not academic`;
        } else {
            prompt = `Generate exactly ${questionCount} ${drillCategory} interview questions for rapid practice.

${drillRole ? `TARGET ROLE: ${drillRole}\nTailor ALL questions specifically for a ${drillRole} position.` : ''}

${resumeText ? `CANDIDATE'S RESUME:\n${resumeText.substring(0, 2000)}\n\nUse their background to personalize questions — reference their experience level, skills, and potential gaps.` : ''}

Focus: ${drillCategory === 'behavioral' ? 'STAR-format behavioral questions about leadership, conflict, failure, and achievement' :
                drillCategory === 'technical' ? 'Practical technical questions about architecture, debugging, trade-offs, and system thinking' :
                drillCategory === 'system-design' ? 'System design questions about scaling, reliability, and architectural decisions' :
                'Leadership and management scenario questions about team dynamics, strategy, and decision-making'}

${drillRole ? `Every question must be relevant to a ${drillRole} role specifically — not generic.` : ''}
Make the questions progressively harder. Each must include context explaining what competency it tests.`;
        }

        const systemPrompt = `Generate interview questions as a JSON object with a "questions" key containing an array.

Each question must have:
- "text": The full question text (be specific, not generic)
- "type": One of "behavioral", "technical", "system-design", "situational", "leadership"
- "context": Why this question matters (1 sentence)
- "difficulty": "standard", "advanced", or "killer"

Return: { "questions": [...] }`;

        const response = await groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from Groq');
        }

        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);

    } catch (error: any) {
        console.error('Question generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate questions' },
            { status: 500 }
        );
    }
}
