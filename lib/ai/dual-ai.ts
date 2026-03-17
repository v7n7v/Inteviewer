/**
 * Dual-AI Orchestrator
 * Write → Check → Refine pipeline using GPT-OSS (writer) + Gemini Flash (editor)
 * The "check and balance" system for premium AI output
 */

import { groqCompletion, extractJSON } from './groq-client';
import { geminiCompletion, geminiValidate, geminiJSONCompletion } from './gemini-client';

export interface DualAIResult {
  content: string;
  score: number;
  validationNotes: string[];
  refined: boolean;
  modelAgreement: 'high' | 'medium' | 'low';
}

/**
 * DUAL-AI GENERATE
 * Pipeline: GPT writes → Gemini critiques → GPT refines (if needed)
 */
export async function dualAIGenerate(
  writerSystemPrompt: string,
  userPrompt: string,
  validationFocus: string,
  criteria: string[],
  options: {
    writerTemp?: number;
    refineThreshold?: number; // Score below this triggers refinement (default 75)
    maxTokens?: number;
  } = {}
): Promise<DualAIResult> {
  const threshold = options.refineThreshold ?? 75;

  // Step 1: GPT writes the initial draft
  const draft = await groqCompletion(writerSystemPrompt, userPrompt, {
    temperature: options.writerTemp ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
  });

  // Step 2: Gemini validates and scores
  const validation = await geminiValidate(draft, validationFocus, criteria);

  // Step 3: If score is below threshold, refine with GPT using Gemini's feedback
  if (validation.score < threshold && validation.suggestions.length > 0) {
    const refinePrompt = `Here is a draft that needs improvement:

---
${draft}
---

An AI editor found these issues:
${validation.issues.map(i => `• ${i}`).join('\n')}

And suggests these improvements:
${validation.suggestions.map(s => `• ${s}`).join('\n')}

Please rewrite the content addressing ALL the feedback above. Keep what works, fix what doesn't.`;

    const refined = await groqCompletion(writerSystemPrompt, refinePrompt, {
      temperature: 0.5,
      maxTokens: options.maxTokens ?? 2048,
    });

    // Quick re-score with Gemini
    const reScore = await geminiValidate(refined, validationFocus, criteria);

    return {
      content: refined,
      score: reScore.score,
      validationNotes: [
        `Initial score: ${validation.score}/100 → Refined score: ${reScore.score}/100`,
        ...reScore.suggestions,
      ],
      refined: true,
      modelAgreement: reScore.score >= 80 ? 'high' : reScore.score >= 60 ? 'medium' : 'low',
    };
  }

  return {
    content: draft,
    score: validation.score,
    validationNotes: validation.suggestions,
    refined: false,
    modelAgreement: validation.score >= 80 ? 'high' : validation.score >= 60 ? 'medium' : 'low',
  };
}

/**
 * DUAL-AI SCORE
 * Both models independently score content → averaged result
 */
export async function dualAIScore(
  content: string,
  scoringPrompt: string,
  criteria: string[]
): Promise<{
  averageScore: number;
  gptScore: number;
  geminiScore: number;
  agreement: 'high' | 'medium' | 'low';
  combinedFeedback: string[];
}> {
  // Run both models in parallel for speed
  const [geminiResult, gptResult] = await Promise.all([
    geminiValidate(content, scoringPrompt, criteria),
    groqCompletion(
      `You are an expert content evaluator. Score the content on a scale of 0-100 and provide feedback.
Respond with JSON: {"score": number, "feedback": string[]}`,
      `Score this content:\n\n${content}\n\nCriteria:\n${criteria.join('\n')}\n\nRespond with JSON.`,
      { temperature: 0.2 }
    ).then(text => {
      try {
        return extractJSON(text) as { score: number; feedback: string[] };
      } catch {
        return { score: 70, feedback: ['Could not parse GPT scoring response'] };
      }
    }),
  ]);

  const diff = Math.abs(geminiResult.score - gptResult.score);
  const avg = Math.round((geminiResult.score + gptResult.score) / 2);

  return {
    averageScore: avg,
    gptScore: gptResult.score,
    geminiScore: geminiResult.score,
    agreement: diff <= 10 ? 'high' : diff <= 25 ? 'medium' : 'low',
    combinedFeedback: [...geminiResult.suggestions, ...gptResult.feedback],
  };
}

/**
 * GEMINI-ONLY QUICK CHECK
 * For free-tier tools — fast, cheap, single-model analysis
 */
export async function geminiQuickCheck<T = any>(
  systemPrompt: string,
  content: string
): Promise<T> {
  return geminiJSONCompletion<T>(systemPrompt, content, { temperature: 0.2 });
}
