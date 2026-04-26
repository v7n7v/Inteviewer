/**
 * Gemini Live API — Ephemeral Token Minting
 * 
 * Creates a short-lived token for client-to-server WebSocket connections.
 * The browser connects directly to Gemini's WebSocket — no server proxy needed.
 * Token expires in 30 minutes, can only start 1 session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import { guardApiRoute } from '@/lib/api-auth';

// Gemini Live voice options mapped to interview personas
const PERSONA_VOICE_MAP: Record<string, string> = {
  'FAANG Tech Lead': 'Charon',  // precise, analytical
  'Friendly HR':     'Kore',    // warm, supportive
  'Startup CTO':     'Fenrir',  // intense, deep
  'VP of Engineering':'Puck',   // neutral, professional
  'Consulting Partner':'Aoede', // friendly, natural
  'STAR Specialist':  'Kore',   // warm, supportive
  'default':          'Kore',
};

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';

export async function POST(req: NextRequest) {
  // Auth gate — requires account, counts toward gauntlet usage
  const guard = await guardApiRoute(req, {
    feature: 'gauntlets',
    allowAnonymous: false,
  });
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const persona = body.persona || 'default';
    const jobDescription = body.jobDescription || '';
    const interviewStyle = body.interviewStyle || 'behavioral';
    const voiceName = PERSONA_VOICE_MAP[persona] || PERSONA_VOICE_MAP['default'];

    // Build the interview system instruction
    const systemInstruction = buildInterviewPrompt(persona, jobDescription, interviewStyle);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // v1alpha is REQUIRED for Live API and ephemeral tokens
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
          },
        },
      },
    });

    return NextResponse.json({
      token: token.name,
      voiceName,
      expiresAt: expireTime,
      model: LIVE_MODEL,
    });
  } catch (error: any) {
    console.error('[api/voice/live-token] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create live session token' },
      { status: 500 }
    );
  }
}

function buildInterviewPrompt(
  persona: string,
  jobDescription: string,
  interviewStyle: string
): string {
  const personaTraits: Record<string, string> = {
    'FAANG Tech Lead': 'You are a precise, analytical FAANG-style interviewer. Ask surgical, probing system design and behavioral questions. Be direct.',
    'Friendly HR': 'You are a warm, encouraging HR interviewer who helps candidates shine. Give positive reinforcement while probing deeper.',
    'Startup CTO': 'You are a fast-paced startup CTO. Ship-it mentality. Ask scrappy, practical questions about building and scaling.',
    'VP of Engineering': 'You are a strategic VP of Engineering. Focus on leadership, big-picture thinking, and organizational impact.',
    'Consulting Partner': 'You are a structured consulting partner. Use MECE frameworks. Ask case-style and structured behavioral questions.',
    'STAR Specialist': 'You are a behavioral interview specialist. Deep-dive into STAR responses. Probe for specifics in every answer.',
  };

  const traits = personaTraits[persona] || personaTraits['Friendly HR'];

  return `You are an AI mock interviewer conducting a ${interviewStyle} interview.

${traits}

CRITICAL RULES:
1. Ask ONE question at a time. Wait for the candidate's response before asking the next question.
2. Listen carefully to answers and ask relevant follow-up questions.
3. After each answer, provide brief, constructive feedback (1-2 sentences max) before moving to the next question.
4. Use the STAR method (Situation, Task, Action, Result) to evaluate behavioral answers.
5. Keep your responses concise and conversational — you're speaking out loud, not writing an essay.
6. Start by introducing yourself briefly and asking the first question.
7. After 5-7 questions, wrap up the interview with a brief summary of strengths and areas to improve.

${jobDescription ? `TARGET ROLE CONTEXT:\n${jobDescription.substring(0, 2000)}` : ''}

Begin the interview now. Introduce yourself in one sentence and ask the first question.`;
}
