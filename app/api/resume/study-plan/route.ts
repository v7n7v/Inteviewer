import { NextRequest, NextResponse } from 'next/server';
import { geminiJSONCompletion } from '@/lib/ai/gemini-client';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { validateBody } from '@/lib/validate';
import { StudyPlanSchema } from '@/lib/schemas';

interface StudyDay {
  day: number;
  focus: string;
  tasks: string[];
  resources: { title: string; url: string; type: 'video' | 'article' | 'practice' | 'project' | 'course' | 'reading' }[];
  timeEstimate: string;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5 });
    if (guard.error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validated = await validateBody(req, StudyPlanSchema);
    if (!validated.success) return validated.error;
    const { skills, userContext, totalDays } = validated.data;

    const skillList = skills.slice(0, 8).join(', ');
    const days = Math.min(Math.max(totalDays || 4, 2), 7);

    // Fetch Study Vault Insights
    let vaultContext = '';
    if (guard.user?.uid) {
      try {
        const snapshot = await getAdminDb()
          .collection('study_vault')
          .where('userId', '==', guard.user.uid)
          .orderBy('createdAt', 'desc')
          .limit(3)
          .get();
        if (!snapshot.empty) {
          vaultContext = snapshot.docs.map(doc => doc.data().summary).join('\n\n');
        }
      } catch (e) {
        console.error('Failed to fetch vault context for skill bridge:', e);
      }
    }

    const systemPrompt = `You are a career skills coach. Generate a SHORT, focused ${days}-day study plan.

CRITICAL: Generate EXACTLY ${days} days. Not more, not less.

This platform supports ALL careers (Healthcare, Finance, Sales, Engineering, Creative Arts, Trades, etc.).
Adapt your tone and resources to the user's specific field.

RULES:
1. EXACTLY ${days} days, each 1.5-2.5 hours max
2. Day 1: Core fundamentals
3. Middle days: Applied practice + scenarios
4. Final day: Interview prep — practice explaining the skill
5. Keep tasks CONCISE — max 3 bullet points per day, each under 15 words
6. Use FREE resources: YouTube, official docs, Coursera audit, Google NotebookLM
7. ALWAYS include a Google NotebookLM resource on the final day for creating study notes
8. Each resource needs a real, plausible URL
9. Be SPECIFIC — no vague "learn about X"

Return JSON:
{
  "schedule": [
    {
      "day": 1,
      "focus": "Short focus title (max 8 words)",
      "tasks": ["Concise task 1", "Concise task 2"],
      "resources": [
        { "title": "Resource Name", "url": "https://...", "type": "video" }
      ],
      "timeEstimate": "2h"
    }
  ],
  "summary": "One sentence: what you'll achieve in ${days} days",
  "interviewTips": ["Tip 1", "Tip 2"]
}`;

    const userPrompt = `Generate a ${days}-day crash course for: ${skillList}

${userContext ? `User context: ${userContext}` : 'Professional getting interview-ready.'}

${vaultContext ? `STUDY VAULT WEAKNESSES (target these):\n${vaultContext}\n` : ''}

Keep it short, practical, interview-focused. Include a NotebookLM link on the final day.`;

    const result = await geminiJSONCompletion<{
      schedule: StudyDay[];
      summary: string;
      interviewTips: string[];
    }>(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 2000 });

    // Safety: ensure schedule length matches requested days
    if (result.schedule && result.schedule.length > days) {
      result.schedule = result.schedule.slice(0, days);
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[api/resume/study-plan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate study plan' },
      { status: 500 }
    );
  }
}

