/**
 * Inkwell Humanize API
 * Takes flagged text + domain → Returns humanized version via Gemini 3 Flash.
 * Enforces word caps per tier (Pro: 4K/mo, Studio: 50K/mo).
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { HumanizeSchema } from '@/lib/schemas';
import { geminiJSONCompletion } from '@/lib/ai/gemini-client';
import { buildHumanizePrompt } from '@/lib/writing-prompts';
import { countWords, checkWritingWordsAllowed, recordWritingWords, incrementUsage } from '@/lib/usage-tracker';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, {
      rateLimit: 5,
      rateLimitWindow: 60_000,
      allowAnonymous: false,
      feature: 'writingTools',
    });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, HumanizeSchema);
    if (!validated.success) return validated.error;
    const { text, domain, paragraphIndices } = validated.data;

    const wordCount = countWords(text);
    if (wordCount < 10) {
      return NextResponse.json(
        { error: 'Text must be at least 10 words' },
        { status: 400 }
      );
    }

    // Enforce word cap (handles free/pro/studio limits naturally)
    const tier = guard.user.tier || 'free';

    const wordCheck = await checkWritingWordsAllowed(guard.user.uid, tier, wordCount);
    if (!wordCheck.allowed) {
      return NextResponse.json(
        {
          error: `Monthly word limit reached (${wordCheck.usedWords}/${wordCheck.capWords} words used)`,
          usedWords: wordCheck.usedWords,
          capWords: wordCheck.capWords,
          remainingWords: wordCheck.remainingWords,
          upgrade: tier === 'pro',
        },
        { status: 429 }
      );
    }

    // Build targeted rewrite prompt
    const systemPrompt = buildHumanizePrompt(domain);

    let userPrompt: string;
    if (paragraphIndices && paragraphIndices.length > 0) {
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const flaggedParagraphs = paragraphIndices
        .filter(i => i < paragraphs.length)
        .map(i => `[Paragraph ${i + 1}]: ${paragraphs[i]}`)
        .join('\n\n');

      userPrompt = `The following text needs humanization. Focus on the flagged paragraphs but maintain coherence with the rest.

FULL TEXT:
${text}

FLAGGED PARAGRAPHS (rewrite these specifically):
${flaggedParagraphs}

Rewrite the full text with the flagged paragraphs humanized.`;
    } else {
      userPrompt = `Humanize this entire text:\n\n${text}`;
    }

    const result = await geminiJSONCompletion<{
      rewritten: string;
      changes: Array<{ original: string; rewritten: string; reason: string }>;
      stats: { sentenceLengthStdDev: number; bannedWordsRemoved: number; burstinessRange: number };
    }>(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: Math.min(16384, Math.max(8192, wordCount * 8)),
    });

    // Record usage after successful humanization
    const outputWords = countWords(result.rewritten || '');
    await recordWritingWords(guard.user.uid, outputWords);
    await incrementUsage(guard.user.uid, 'writingTools');

    return NextResponse.json({
      ...result,
      wordUsage: {
        inputWords: wordCount,
        outputWords,
        remaining: wordCheck.remainingWords - outputWords,
        cap: wordCheck.capWords,
      },
    });

  } catch (error: unknown) {
    console.error('[api/writing/humanize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to humanize text' },
      { status: 500 }
    );
  }
}
