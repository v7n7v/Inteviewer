/**
 * Secure AI API Route — Backend-for-Frontend (BFF) pattern
 * All Groq API calls go through this server-side route
 * Protects the API key from client-side exposure
 */

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { guardApiRoute } from '@/lib/api-auth';

const MODEL = 'openai/gpt-oss-120b';

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in server environment variables');
  }
  return new Groq({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardApiRoute(request, { rateLimit: 10, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const body = await request.json();
    const { action, prompt, systemPrompt, options = {} } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const groq = getGroqClient();

    if (action === 'json') {
      const enhancedSystem = `${systemPrompt || 'You are a helpful AI assistant. Always respond with valid JSON.'}\n\nIMPORTANT: You must respond with valid JSON only. Do not include any markdown formatting or explanations.`;

      const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: enhancedSystem },
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json({ error: 'No response from AI' }, { status: 502 });
      }

      try {
        const parsed = JSON.parse(content);
        return NextResponse.json({ result: parsed });
      } catch {
        return NextResponse.json({ error: 'AI response was not valid JSON', raw: content }, { status: 502 });
      }
    }

    if (action === 'stream') {
      const stream = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Default: text completion
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a helpful AI assistant specializing in talent assessment and career development.' },
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      top_p: options.topP ?? 0.95,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 502 });
    }

    return NextResponse.json({ result: content });
  } catch (error: any) {
    console.error('AI API route error:', error);

    if (error.status === 401) {
      return NextResponse.json({ error: 'Invalid Groq API key' }, { status: 401 });
    }
    if (error.status === 403) {
      return NextResponse.json({ error: 'Model access denied. Check Groq console.' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'AI request failed' },
      { status: 500 }
    );
  }
}
