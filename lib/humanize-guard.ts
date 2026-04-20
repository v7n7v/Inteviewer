/**
 * Humanization Guard — lightweight AI cleanup for all platform output.
 * No API calls. Runs locally on text output from morph, cover letter, Sona, etc.
 * Strips AI punctuation artifacts + runs heuristic detection scoring.
 */

import { detectAI, type DetectionResult } from './ai-detection';

/** Strip AI-telltale punctuation from any text output */
export function cleanAIArtifacts(text: string): string {
  let cleaned = text;

  // Replace em-dashes with comma or period
  cleaned = cleaned.replace(/\s*—\s*/g, ', ');
  cleaned = cleaned.replace(/\s*--\s*/g, ', ');

  // Replace en-dashes that aren't in number ranges
  cleaned = cleaned.replace(/(?<!\d)\s*–\s*(?!\d)/g, ', ');

  // Remove excessive semicolons (keep max 1 per 300 words)
  const words = cleaned.split(/\s+/).length;
  const maxSemicolons = Math.max(1, Math.floor(words / 300));
  let semicolonIdx = 0;
  cleaned = cleaned.replace(/;\s*/g, () => {
    semicolonIdx++;
    if (semicolonIdx > maxSemicolons) return '. ';
    return '; ';
  });

  // Remove AI transition starters at the beginning of sentences
  const aiStarters = [
    /(?:^|\.\s+)Moreover,\s*/gm,
    /(?:^|\.\s+)Furthermore,\s*/gm,
    /(?:^|\.\s+)Additionally,\s*/gm,
    /(?:^|\.\s+)In conclusion,\s*/gm,
    /(?:^|\.\s+)It is worth noting that\s*/gm,
    /(?:^|\.\s+)It is important to note that\s*/gm,
    /(?:^|\.\s+)In today's?\s*(?:fast-paced|rapidly evolving|dynamic|competitive)\s*/gm,
    /(?:^|\.\s+)(?:This|It) is (?:crucial|essential|vital|imperative) (?:to|that)\s*/gm,
  ];
  for (const pattern of aiStarters) {
    cleaned = cleaned.replace(pattern, (match) => {
      // Preserve the period+space if it was there
      return match.startsWith('.') ? '. ' : '';
    });
  }

  // Fix double commas
  cleaned = cleaned.replace(/,\s*,/g, ',');

  // Fix sentence starts after period replacements
  cleaned = cleaned.replace(/\.\s+([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);

  // Remove zero-width spaces and other invisible characters
  cleaned = cleaned.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  return cleaned.trim();
}

export interface GuardResult {
  text: string;
  wasModified: boolean;
  aiScore: number | null;      // heuristic human score (0-100, higher = more human)
  detection: DetectionResult | null;
}

/**
 * Guard any AI-generated text output.
 * - Strips AI punctuation artifacts (em-dashes, semicolons, transition words)
 * - Optionally runs heuristic AI detection and returns the score
 * 
 * @param text - The AI-generated text to guard
 * @param options.runDetection - If true, runs heuristic detection (default: true for 50+ words)
 * @returns Cleaned text + detection results
 */
export function guardOutput(
  text: string,
  options?: { runDetection?: boolean }
): GuardResult {
  const cleaned = cleanAIArtifacts(text);
  const wasModified = cleaned !== text;

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const shouldDetect = options?.runDetection ?? (wordCount >= 50);

  let detection: DetectionResult | null = null;
  let aiScore: number | null = null;

  if (shouldDetect && wordCount >= 30) {
    detection = detectAI(cleaned);
    aiScore = detection.humanScore;
  }

  return { text: cleaned, wasModified, aiScore, detection };
}

/**
 * Light guard — just cleanup, no detection. For inline use in APIs.
 */
export function quickClean(text: string): string {
  return cleanAIArtifacts(text);
}
