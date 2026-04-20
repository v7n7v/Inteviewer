/**
 * Free AI Humanizer API — Landing Page Widget
 * Anonymous access with IP-based rate limiting:
 *   - 1 request per 24 hours per IP
 *   - 300-word hard cap
 * Authenticated free users: same 300-word cap, uses existing writingTools quota.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { geminiJSONCompletion } from '@/lib/ai/gemini-client';
import { buildHumanizePrompt } from '@/lib/writing-prompts';
import { detectAI } from '@/lib/ai-detection';
import { authenticateRequest } from '@/lib/api-auth';
import { checkUsageAllowed, incrementUsage, countWords } from '@/lib/usage-tracker';
import { getUserTier } from '@/lib/pricing-tiers';

const FREE_WORD_CAP = 300;
const ANON_DAILY_LIMIT = 1;
const ANON_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Strip AI-telltale punctuation from humanized text */
function cleanAIPunctuation(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\s*—\s*/g, ', ');
  cleaned = cleaned.replace(/\s*--\s*/g, ', ');
  cleaned = cleaned.replace(/(?<!\d)\s*–\s*(?!\d)/g, ', ');

  let semicolonCount = 0;
  cleaned = cleaned.replace(/;\s*/g, () => {
    semicolonCount++;
    if (semicolonCount > 1) return '. ';
    return '; ';
  });

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

  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s+([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);
  return cleaned;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Parse body
    let body: { text?: string; domain?: string; tone?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const text = body.text?.trim() || '';
    const domain = (body.domain || 'general') as 'general' | 'academic' | 'resume' | 'marketing' | 'creative';
    const tone = (body.tone || 'professional') as 'professional' | 'creative' | 'casual' | 'academic' | 'confident';

    if (!text || text.length < 20) {
      return NextResponse.json({ error: 'Text must be at least 20 characters' }, { status: 400 });
    }

    const wordCount = countWords(text);

    // Enforce 300-word cap
    if (wordCount > FREE_WORD_CAP) {
      return NextResponse.json(
        { error: `Free humanizer is limited to ${FREE_WORD_CAP} words. Your text has ${wordCount} words.`, wordCount, cap: FREE_WORD_CAP },
        { status: 400 }
      );
    }

    // Check if user is authenticated
    const authUser = await authenticateRequest(req);

    if (authUser) {
      // Authenticated user: use existing writingTools quota
      const tier = await getUserTier(authUser.uid, authUser.email);
      const usage = await checkUsageAllowed(authUser.uid, 'writingTools', tier);
      if (!usage.allowed) {
        return NextResponse.json(
          {
            error: 'Free usage limit reached. Upgrade to Pro for unlimited access.',
            limitReached: true,
            upgradeUrl: '/suite/upgrade',
          },
          { status: 429 }
        );
      }
    } else {
      // Anonymous user: IP-based daily limit
      const rateLimitKey = `humanize-free:${ip}`;
      const { allowed } = checkRateLimit(rateLimitKey, ANON_DAILY_LIMIT, ANON_WINDOW_MS);
      if (!allowed) {
        return NextResponse.json(
          {
            error: 'Daily free limit reached. Create a free account to unlock 3 more uses.',
            limitReached: true,
            requiresAuth: true,
          },
          { status: 429 }
        );
      }
    }

    // Run AI detection BEFORE humanization (to show before/after)
    const beforeDetection = detectAI(text);

    // Build prompt and humanize
    const systemPrompt = buildHumanizePrompt(domain, tone);
    const userPrompt = `Humanize this entire text with a ${tone} tone:\n\n${text}`;

    const result = await geminiJSONCompletion<{
      rewritten: string;
      changes: Array<{ original: string; rewritten: string; reason: string }>;
      stats: { sentenceLengthStdDev: number; bannedWordsRemoved: number; burstinessRange: number };
    }>(systemPrompt, userPrompt, {
      temperature: tone === 'creative' ? 0.85 : tone === 'casual' ? 0.8 : 0.7,
      maxTokens: Math.min(4096, Math.max(2048, wordCount * 8)),
    });

    const cleanedText = cleanAIPunctuation(result.rewritten || '');

    // Run AI detection AFTER humanization
    const afterDetection = detectAI(cleanedText);

    // Record usage for authenticated users
    if (authUser) {
      await incrementUsage(authUser.uid, 'writingTools');
    }

    return NextResponse.json({
      rewritten: cleanedText,
      changes: result.changes?.slice(0, 5) || [],
      before: {
        humanScore: beforeDetection.humanScore,
        verdict: beforeDetection.verdict,
      },
      after: {
        humanScore: afterDetection.humanScore,
        verdict: afterDetection.verdict,
      },
      wordCount,
      isAuthenticated: !!authUser,
    });
  } catch (error: unknown) {
    console.error('[api/writing/humanize-free] Error:', error);
    return NextResponse.json(
      { error: 'Humanization failed. Please try again.' },
      { status: 500 }
    );
  }
}
