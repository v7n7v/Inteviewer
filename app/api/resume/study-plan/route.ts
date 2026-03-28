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
    const { skills, userContext } = validated.data;

    const skillList = skills.slice(0, 8).join(', ');

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

    const systemPrompt = `You are an elite career and skills coach for a universal Talent Intelligence platform.
Generate a practical 7-day crash course study plan to get someone interview-ready for the given skills.

CRITICAL DIRECTIVE: This platform supports ALL careers and industries (e.g., Healthcare, Finance, Sales, Human Resources, Engineering, Creative Arts, Trades, IT, etc.).
- Do not assume the user is in Software Engineering unless their skills specify it.
- Adapt your tone, structure, resources, and terminology to the specific field of the user's skills.
- Use broad subsets (like Healthcare Compliance, Project Management, B2B Sales Strategies) instead of just specific individual technical courses.

RULES:
1. Each day should build on the previous day.
2. Day 1-2: Core concepts, frameworks, and theory
3. Day 3-4: Applied practice, scenarios, cases, or hands-on exercises
4. Day 5-6: Real-world applications, advanced concepts, and broader subsets
5. Day 7: Mock interview prep — practice explaining these skills confidently
6. Keep daily time commitment realistic (1.5-3 hours per day)
7. Prefer FREE applicable resources (YouTube, official guidelines, Coursera audit, industry articles)
8. Include concrete, actionable tasks — not vague "learn about X"
9. Resources should be real, well-known platforms with plausible URLs
10. If the user provides "Recent Study Vault Weaknesses", you MUST tightly integrate tutorials resolving those specific weaknesses into Days 1-3.

Return a JSON object:
{
  "schedule": [
    {
      "day": 1,
      "focus": "Broad Subset or Core Concept (e.g., Medical Terminology, B2B Pipeline)",
      "tasks": ["Actionable task 1", "Actionable task 2"],
      "resources": [
        { "title": "Crash Course Video", "url": "https://youtube.com/results?search_query=topic", "type": "video" },
        { "title": "Industry Guide", "url": "https://example.com/guide", "type": "article" }
      ],
      "timeEstimate": "2h"
    }
  ],
  "summary": "Brief 1-sentence summary of what the user will achieve in 7 days",
  "interviewTips": ["Industry-specific interview tip 1", "Tip 2"]
}`;

    const userPrompt = `Generate a 7-day crash course study plan for the following skill(s) or fields: ${skillList}

${userContext ? `User context: ${userContext}` : 'The user is a professional who needs to get interview-ready.'}

${vaultContext ? `RECENT STUDY VAULT WEAKNESSES (Integrate into your curriculum):\n${vaultContext}\n` : ''}

Make the plan highly practical, focused on their specific industry, and interview-oriented.`;

    const result = await geminiJSONCompletion<{
      schedule: StudyDay[];
      summary: string;
      interviewTips: string[];
    }>(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 3000 });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[api/resume/study-plan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate study plan' },
      { status: 500 }
    );
  }
}
