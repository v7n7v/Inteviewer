/**
 * Deep AI Detection API Route
 * Uses LLM-assisted predictability analysis for ambiguous cases.
 * Triggered when heuristic returns 'mixed' or user requests "Deep Scan".
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { deepDetect } from '@/lib/ai-detection-server';
import { normalizeText } from '@/lib/sanitize';
import { incrementUsage } from '@/lib/usage-tracker';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, {
      rateLimit: 10,
      rateLimitWindow: 60_000,
      allowAnonymous: false,
      feature: 'writingTools',
    });
    if (guard.error) return guard.error;

    const body = await req.json();
    const text = body?.text;

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Text must be at least 50 characters for deep analysis' },
        { status: 400 }
      );
    }

    const normalized = normalizeText(text);
    const result = await deepDetect(normalized);

    await incrementUsage(guard.user.uid, 'writingTools');

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error: unknown) {
    console.error('[api/writing/deep-detect] Error:', error);
    return NextResponse.json(
      { error: 'Deep detection failed' },
      { status: 500 }
    );
  }
}
