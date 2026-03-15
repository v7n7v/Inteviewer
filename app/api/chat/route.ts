import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { guardApiRoute } from '@/lib/api-auth';

const MODEL = 'openai/gpt-oss-120b';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const { messages, userContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const systemPrompt = `You are Sona, the AI career companion for TalentConsulting.io. You are CONTEXT-AWARE — you have access to the user's personal career data shown below.

# YOUR PERSONALITY
- Warm, encouraging, and actionable
- You speak like a trusted career coach, not a chatbot
- Be concise (under 150 words) unless the user asks for detail
- Use emojis sparingly but naturally
- Proactively reference the user's actual data when relevant

# USER'S CAREER DATA
${userContext || '(No data available yet — user may be new)'}

# WHAT YOU CAN HELP WITH
1. **Application Status** — Summarize their pipeline, suggest next actions, identify stale applications
2. **Interview Prep** — Based on their actual applied companies/roles, give targeted prep advice
3. **Resume Review** — Reference their resume versions and suggest improvements for specific roles
4. **Career Strategy** — Analyze patterns in their applications (what types of roles, success rate)
5. **Follow-up Reminders** — Identify applications that need follow-up based on dates and status
6. **General Career Advice** — Salary negotiation, networking, skills development

# RULES
- Always reference THEIR specific data when answering questions about their job search
- If they ask "how's my job search?", give a real summary from their data, not generic advice
- If they ask about a specific company, check if they have an application for it
- Be honest — if their pipeline is thin, say so constructively
- Never fabricate data about their applications or resumes`;

    const groq = new Groq({ apiKey });

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Create streaming response
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    // SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
