import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { guardApiRoute } from '@/lib/api-auth';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 7, rateLimitWindow: 60_000 });
        if (guard.error) return guard.error;

        const { question, answer, jobDescription, resumeText, questionType } = await req.json();

        if (!question || !answer) {
            return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
        }

        const systemPrompt = `You are a ruthlessly honest interview coach with 20 years of experience preparing candidates for FAANG-level interviews. You grade answers with surgical precision.

Your job is to analyze the candidate's spoken/typed answer to an interview question and return a structured evaluation.

GRADING CRITERIA:
- STAR Method (Situation, Task, Action, Result) — especially for behavioral questions
- Specificity — did they use concrete numbers, metrics, timeframes?
- Relevance — does the answer actually address the question asked?
- Conciseness — was the answer focused or did it ramble?
- Impact — did they explain the business/technical outcome?

SCORING:
- 90-100: Exceptional. Hire signal. Would impress a Director of Engineering.
- 70-89: Good. Solid answer with minor gaps. Competitive candidate.
- 50-69: Mediocre. Generic answer. Would not stand out. Needs coaching.
- 30-49: Weak. Major gaps, rambling, or off-topic. Significant prep needed.
- 0-29: Failed. Did not answer the question or gave a nonsensical response.

You MUST respond with valid JSON matching this exact schema:
{
  "overall_score": <number 0-100>,
  "star_method": {
    "situation": { "present": <boolean>, "feedback": "<string>" },
    "task": { "present": <boolean>, "feedback": "<string>" },
    "action": { "present": <boolean>, "feedback": "<string>" },
    "result": { "present": <boolean>, "feedback": "<string>" }
  },
  "strengths": ["<string>", ...],
  "improvements": ["<string>", ...],
  "filler_analysis": {
    "weak_phrases": ["<string>", ...],
    "feedback": "<string>"
  },
  "follow_up_question": "<string - a tough follow-up an interviewer would ask based on their answer>",
  "coaching_tip": "<string - one actionable piece of advice to improve this specific answer>",
  "rewritten_answer": "<string - a model answer the candidate could study, 3-4 sentences max>"
}`;

        let context = `INTERVIEW QUESTION:\n"${question}"\n\nCANDIDATE'S ANSWER:\n"${answer}"`;

        if (questionType) {
            context += `\n\nQUESTION TYPE: ${questionType}`;
        }

        if (jobDescription) {
            context += `\n\nTARGET JOB DESCRIPTION:\n${jobDescription.substring(0, 2000)}`;
        }

        if (resumeText) {
            context += `\n\nCANDIDATE'S RESUME:\n${resumeText.substring(0, 2000)}`;
        }

        context += `\n\nGrade this answer. Be brutally honest but constructive. If the answer is good, acknowledge it. If it's weak, explain exactly why and how to fix it.`;

        const response = await groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context },
            ],
            temperature: 0.4,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from Groq');
        }

        const grading = JSON.parse(content);
        return NextResponse.json(grading);

    } catch (error: any) {
        console.error('Gauntlet grading error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to grade answer' },
            { status: 500 }
        );
    }
}
