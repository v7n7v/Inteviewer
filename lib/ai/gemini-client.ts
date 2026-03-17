/**
 * Gemini 3.0 Flash Client
 * Second AI engine for validation, scoring, and fast analysis
 * Used as "The Editor" in the dual-AI check-and-balance system
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = 'gemini-3-flash-preview';

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (genAIInstance) return genAIInstance;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
}

/**
 * Basic Gemini text completion
 */
export async function geminiCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens ?? 2048,
    },
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

/**
 * Gemini JSON completion — returns parsed JSON
 */
export async function geminiJSONCompletion<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 2048,
      responseMimeType: 'application/json',
    },
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error('Empty response from Gemini');

  try {
    return JSON.parse(text);
  } catch {
    // Try extracting JSON from markdown blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]);
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('Could not parse JSON from Gemini response');
  }
}

/**
 * Gemini validation — takes content and returns structured feedback
 * Used as the "Editor" step in dual-AI pipeline
 */
export async function geminiValidate(
  content: string,
  validationPrompt: string,
  criteria: string[]
): Promise<{
  score: number;
  issues: string[];
  suggestions: string[];
  verdict: 'excellent' | 'good' | 'needs_work' | 'poor';
}> {
  const systemPrompt = `You are a critical AI editor and quality assurance specialist.
Your job is to evaluate content against specific criteria and provide actionable feedback.
Always be honest — if something is weak, say so. If it's strong, confirm it.

You MUST respond with a JSON object containing:
- "score": number 0-100
- "issues": string[] (specific problems found)
- "suggestions": string[] (concrete improvements)
- "verdict": "excellent" | "good" | "needs_work" | "poor"`;

  const userPrompt = `Evaluate the following content:

---
${content}
---

Validation focus: ${validationPrompt}

Score against these criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Respond with your evaluation as a JSON object.`;

  return geminiJSONCompletion(systemPrompt, userPrompt, { temperature: 0.2 });
}

export const GEMINI_MODEL = MODEL;
