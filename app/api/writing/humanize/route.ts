/**
 * AI Detector Humanize API
 * Takes flagged text + domain + tone → Returns humanized version via Gemini 3 Flash.
 * Enforces word caps per tier (Pro: 4K/mo, Studio: 50K/mo).
 * Post-processes to strip AI punctuation artifacts (em-dashes, semicolons, etc).
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { HumanizeSchema } from '@/lib/schemas';
import { geminiJSONCompletion } from '@/lib/ai/gemini-client';
import { buildHumanizePrompt } from '@/lib/writing-prompts';
import { countWords, checkWritingWordsAllowed, recordWritingWords, incrementUsage } from '@/lib/usage-tracker';
import { detectAI } from '@/lib/ai-detection';
import { normalizeText, sanitizeForAI } from '@/lib/sanitize';

/** Strip AI-telltale punctuation from humanized text */
function cleanAIPunctuation(text: string): string {
  let cleaned = text;

  // Replace em-dashes with comma or period
  cleaned = cleaned.replace(/\s*—\s*/g, ', ');
  cleaned = cleaned.replace(/\s*--\s*/g, ', ');

  // Replace en-dashes that aren't in number ranges (e.g. "2020–2023")
  cleaned = cleaned.replace(/(?<!\d)\s*–\s*(?!\d)/g, ', ');

  // Remove excessive semicolons (replace with period + capitalize)
  let semicolonCount = 0;
  cleaned = cleaned.replace(/;\s*/g, () => {
    semicolonCount++;
    if (semicolonCount > 1) return '. ';
    return '; ';
  });

  // Remove AI transition starters
  const aiStarters = [
    /^Moreover,\s*/gim,
    /^Furthermore,\s*/gim,
    /^Additionally,\s*/gim,
    /^In conclusion,\s*/gim,
    /^It is worth noting that\s*/gim,
    /^It is important to note that\s*/gim,
  ];
  for (const pattern of aiStarters) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Fix double commas from replacements
  cleaned = cleaned.replace(/,\s*,/g, ',');

  // Fix sentence starts after period replacements
  cleaned = cleaned.replace(/\.\s+([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);

  return cleaned;
}

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
    const { text: rawText, domain, tone, paragraphIndices } = validated.data;

    // Sanitize + normalize input — prompt injection defense + homoglyph stripping
    const text = normalizeText(sanitizeForAI(rawText));

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

    // Build targeted rewrite prompt with tone
    const systemPrompt = buildHumanizePrompt(domain, tone);

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

Rewrite the full text with the flagged paragraphs humanized. Tone: ${tone}.`;
    } else {
      userPrompt = `Humanize this entire text with a ${tone} tone:\n\n${text}`;
    }


    type HumanizeResult = {
      rewritten: string;
      changes: Array<{ original: string; rewritten: string; reason: string }>;
      stats: { sentenceLengthStdDev: number; bannedWordsRemoved: number; burstinessRange: number };
    };

    const maxTokens = Math.min(16384, Math.max(8192, wordCount * 8));
    const temp = tone === 'creative' ? 0.85 : tone === 'casual' ? 0.8 : 0.7;

    // Pass 1: Initial humanization
    let result = await geminiJSONCompletion<HumanizeResult>(systemPrompt, userPrompt, {
      temperature: temp, maxTokens,
    });

    let cleanedText = cleanAIPunctuation(result.rewritten || '');
    let recheckResult = detectAI(cleanedText);
    let retryCount = 0;

    // Iterative refinement: retry low-scoring paragraphs (max 2 retries)
    while (recheckResult.humanScore <= 60 && retryCount < 2) {
      retryCount++;
      const lowParagraphs = recheckResult.paragraphScores
        .filter(p => p.score < 60)
        .slice(0, 5); // limit to 5 worst paragraphs

      if (lowParagraphs.length === 0) break;

      const diagnostics = lowParagraphs.map(p => {
        const issues = p.flags.length > 0 ? p.flags.join('; ') : 'Low overall score';
        return `[Paragraph ${p.index + 1}] Score: ${p.score}/100. Issues: ${issues}\nText: "${p.text.slice(0, 200)}"`;
      }).join('\n\n');

      const retryPrompt = `The previous humanization attempt still scores as AI-generated (score: ${recheckResult.humanScore}/100).

These paragraphs specifically need more work:

${diagnostics}

Rewrite the FULL text again. Focus especially on the flagged paragraphs. Key fixes needed:
- Increase sentence length variance (mix 4-word fragments with 25+ word sentences)
- Remove any remaining AI-tell words
- Add natural contractions and first-person markers
- Vary paragraph lengths more

Tone: ${tone}

Full text to re-humanize:
${cleanedText}`;

      result = await geminiJSONCompletion<HumanizeResult>(systemPrompt, retryPrompt, {
        temperature: Math.min(0.95, temp + 0.1 * retryCount), maxTokens,
      });

      cleanedText = cleanAIPunctuation(result.rewritten || '');
      recheckResult = detectAI(cleanedText);
    }

    // Record usage after successful humanization (only count final output)
    const outputWords = countWords(cleanedText);
    await recordWritingWords(guard.user.uid, outputWords);
    await incrementUsage(guard.user.uid, 'writingTools');

    return NextResponse.json({
      ...result,
      rewritten: cleanedText,
      recheck: {
        humanScore: recheckResult.humanScore,
        verdict: recheckResult.verdict,
        flaggedCount: recheckResult.paragraphScores.filter(p => p.score < 60).length,
      },
      retries: retryCount,
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
