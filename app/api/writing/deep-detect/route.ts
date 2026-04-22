/**
 * Deep AI Detection API Route
 * Uses LLM-assisted predictability analysis for ambiguous cases.
 * Triggered when heuristic returns 'mixed' or user requests "Deep Scan".
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { deepDetect } from '@/lib/ai-detection-server';
import { normalizeText, sanitizeForAI } from '@/lib/sanitize';
import { incrementUsage } from '@/lib/usage-tracker';
import { validateBody } from '@/lib/validate';
import { z } from 'zod';

const DeepDetectSchema = z.object({
  text: z.string().trim().min(50, 'Text must be at least 50 characters').max(50_000),
});

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, {
      rateLimit: 10,
      rateLimitWindow: 60_000,
      allowAnonymous: false,
      feature: 'writingTools',
    });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, DeepDetectSchema);
    if (!validated.success) return validated.error;

    const normalized = normalizeText(sanitizeForAI(validated.data.text));
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
