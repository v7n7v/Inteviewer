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
  'The Coach':       'Kore',    // warm, supportive
  'The Interrogator':'Fenrir',  // intense, deep
  'The Conversationalist': 'Aoede', // friendly, natural
  'The Panel Lead':  'Puck',    // neutral, professional
  'The Technical':   'Charon',  // precise, analytical
  'default':         'Kore',
};

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

    const client = new GoogleGenAI({ apiKey });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: 'gemini-2.0-flash-live-001',
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
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return NextResponse.json({
      token: token.name,
      voiceName,
      expiresAt: expireTime,
      model: 'gemini-2.0-flash-live-001',
    });
  } catch (error) {
    console.error('[api/voice/live-token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create live session token' },
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
    'The Coach': 'You are a warm, encouraging interviewer who helps candidates shine. Give positive reinforcement while probing deeper. Use a supportive tone.',
    'The Interrogator': 'You are a challenging, rapid-fire interviewer. Push candidates to think on their feet. Ask follow-up questions that test depth of knowledge. Be direct and intense but professional.',
    'The Conversationalist': 'You are a friendly, natural interviewer who makes the conversation flow. Build rapport first, then ask substantive questions. Use a casual-professional tone.',
    'The Panel Lead': 'You are a structured, methodical interviewer following a clear format. Ask one question at a time, take brief notes, and move systematically through topics.',
    'The Technical': 'You are a precise, analytical interviewer focused on technical depth. Ask about system design, trade-offs, and implementation details.',
  };

  const traits = personaTraits[persona] || personaTraits['The Coach'];

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
