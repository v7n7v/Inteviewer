import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { GauntletGradeSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  return new Groq({ apiKey });
}

export async function POST(req: NextRequest) {
    try {
        const guard = await guardApiRoute(req, { rateLimit: 7, rateLimitWindow: 60_000, allowAnonymous: true, feature: 'gauntlets' });
        if (guard.error) return guard.error;

        const validated = await validateBody(req, GauntletGradeSchema);
        if (!validated.success) return validated.error;
        const { question, answer, jobDescription, resumeText, questionType, persona } = validated.data;

        const groq = getGroqClient();

        // Persona-specific grading voice
        const GRADING_VOICES: Record<string, string> = {
            'faang-lead': 'Grade like a FAANG Staff Engineer who has seen 500+ interviews. Be surgical, direct, and brutally honest. If they gave a generic answer, call it out. If they impressed you, acknowledge it with restrained respect — you don\'t give praise easily.',
            'friendly-hr': 'Grade like a supportive HR manager. Be constructive and encouraging, but still honest. Highlight what they did well before addressing gaps. Frame improvements as opportunities, not failures. End with genuine encouragement.',
            'startup-cto': 'Grade like a pragmatic startup CTO. Focus on whether they can actually EXECUTE, not just talk. Dock points for over-engineering or buzzword-heavy answers. Reward scrappy, practical thinking. Be casual but direct.',
            'vp-engineering': 'Grade like a VP of Engineering evaluating leadership potential. Focus on strategic thinking, cross-functional awareness, and communication clarity. Look for org-level thinking beyond individual contribution.',
            'consulting-partner': 'Grade like a McKinsey partner. Evaluate structure, MECE thinking, and "so what" conclusions. Dock points for rambling or unstructured answers. Reward crisp frameworks and decisive recommendations.',
            'behavioral-specialist': 'Grade with clinical precision on STAR method. Check each component (Situation, Task, Action, Result) individually. Demand specifics: who, what, when, how many. Flag vague language like "we" when "I" is needed.',
        };

        const gradingVoice = persona ? (GRADING_VOICES[persona] || '') : '';

        const systemPrompt = `You are a ruthlessly honest interview coach with 20 years of experience preparing candidates for FAANG-level interviews. You grade answers with surgical precision.

${gradingVoice ? `GRADING PERSONALITY:\n${gradingVoice}\n` : ''}
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

    } catch (error: unknown) {
        console.error('[api/gauntlet/grade] Error:', error);
        return NextResponse.json(
            { error: 'Failed to grade answer' },
            { status: 500 }
        );
    }
}
