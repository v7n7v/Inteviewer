/**
 * Client-Side AI Detection Engine
 * Heuristic scoring based on perplexity, burstiness, AI-tell vocabulary, and structural signals.
 * Derived from slopbuster (100+ patterns) and humanizer-x (30 severity-ranked patterns).
 * Runs entirely in the browser — zero API cost.
 */

// ── Severity-Ranked AI-Tell Vocabulary ──

export const CRITICAL_WORDS = [
  'delve', 'tapestry', 'testament', 'intricacies', 'multifaceted',
  'ever-evolving', 'ever-changing', 'game-changer', 'paradigm',
  'synergy', 'holistic', 'nuanced', 'embark',
];

export const HIGH_WORDS = [
  'leverage', 'utilize', 'pivotal', 'crucial', 'landscape',
  'navigate', 'foster', 'spearheaded', 'comprehensive', 'groundbreaking',
  'innovative', 'transformative', 'unprecedented', 'underscored',
  'underscore', 'vital', 'robust', 'seamless', 'streamline',
  'cutting-edge', 'nestle', 'nestled', 'realm', 'beacon',
  'cornerstone', 'endeavor', 'envisage',
];

const MEDIUM_WORDS = [
  'facilitate', 'optimize', 'enhance', 'bolster', 'augment',
  'amplify', 'catalyze', 'cultivate', 'empower', 'harness',
  'propel', 'elevate', 'accelerate', 'underscore', 'exemplify',
  'garner', 'commence', 'paramount', 'indispensable', 'meticulous',
  'adept', 'proficient', 'astute', 'discerning', 'burgeoning',
  'myriad', 'plethora', 'aligns', 'landscape',
  'breathtaking', 'resonate', 'illuminate', 'elucidate', 'substantiate',
];

const LOW_WORDS = [
  'additionally', 'furthermore', 'moreover', 'consequently',
  'subsequently', 'nevertheless', 'notwithstanding', 'henceforth',
  'aforementioned', 'whereby', 'therein', 'insofar',
];

// ── AI-Tell Phrases ──

export const AI_PHRASES = [
  'it is worth noting',
  'it\'s important to note',
  'in today\'s rapidly',
  'in today\'s fast-paced',
  'in the realm of',
  'plays a crucial role',
  'serves as a testament',
  'at the intersection of',
  'a pivotal moment',
  'on the other hand',
  'in conclusion',
  'to sum up',
  'this comprehensive guide',
  'stands as a beacon',
  'the landscape of',
  'in order to',
  'due to the fact that',
  'it goes without saying',
  'needless to say',
  'not just x, it\'s y',
  'from x to y',
  'I hope this helps',
  'as an AI',
  'I\'d be happy to',
  'great question',
  'absolutely',
  'certainly',
  'indeed',
];

// ── Types ──

export interface DetectionResult {
  humanScore: number; // 0-100 (higher = more human)
  verdict: 'likely_ai' | 'mixed' | 'likely_human';
  breakdown: {
    perplexity: number;
    burstiness: number;
    vocabulary: number;
    structure: number;
  };
  flags: DetectionFlag[];
  paragraphScores: ParagraphScore[];
}

export interface DetectionFlag {
  type: 'critical' | 'high' | 'medium' | 'low';
  category: 'vocabulary' | 'burstiness' | 'structure' | 'phrase';
  message: string;
  position?: number; // paragraph index
}

export interface ParagraphScore {
  index: number;
  text: string;
  score: number;
  flags: string[];
}

// ── Helper Functions ──

export function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function standardDeviation(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function typeTokenRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

// ── Scoring Functions ──

/** Perplexity approximation: vocabulary diversity + rare word presence */
function scorePerplexity(text: string): { score: number; flags: DetectionFlag[] } {
  const flags: DetectionFlag[] = [];
  const ttr = typeTokenRatio(text);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  if (totalWords < 10) return { score: 70, flags };

  // Type-token ratio scoring
  // Human text: TTR ~0.5-0.7, AI text: TTR ~0.3-0.5
  let ttrScore: number;
  if (ttr > 0.65) ttrScore = 90;
  else if (ttr > 0.55) ttrScore = 75;
  else if (ttr > 0.45) ttrScore = 55;
  else if (ttr > 0.35) ttrScore = 35;
  else ttrScore = 20;

  // Common word ratio — AI overuses common words
  const veryCommon = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'it', 'its',
    'of', 'in', 'to', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'that', 'this', 'which', 'who', 'and', 'or', 'but', 'not',
  ]);
  const commonCount = words.filter(w => veryCommon.has(w)).length;
  const commonRatio = commonCount / totalWords;

  // High common ratio = low perplexity = more AI-like
  let commonScore: number;
  if (commonRatio < 0.30) commonScore = 85;
  else if (commonRatio < 0.38) commonScore = 65;
  else if (commonRatio < 0.45) commonScore = 45;
  else commonScore = 25;

  const score = Math.round(ttrScore * 0.6 + commonScore * 0.4);

  if (score < 40) {
    flags.push({
      type: 'high',
      category: 'vocabulary',
      message: 'Low vocabulary diversity — predictable word choices typical of AI',
    });
  }

  return { score, flags };
}

/** Burstiness: sentence length variance */
function scoreBurstiness(text: string): { score: number; flags: DetectionFlag[] } {
  const flags: DetectionFlag[] = [];
  const sentences = splitSentences(text);
  if (sentences.length < 3) return { score: 60, flags };

  const lengths = sentences.map(s => wordCount(s));
  const stdDev = standardDeviation(lengths);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const cv = mean > 0 ? stdDev / mean : 0; // Coefficient of variation

  // Humans: σ > 8, CV > 0.5. AI: σ < 5, CV < 0.3
  let score: number;
  if (stdDev > 10 && cv > 0.5) score = 95;
  else if (stdDev > 8 && cv > 0.4) score = 80;
  else if (stdDev > 6 && cv > 0.3) score = 60;
  else if (stdDev > 4) score = 40;
  else score = 15;

  // Check for consecutive same-length pattern
  let consecutiveSimilar = 0;
  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= 3) {
      consecutiveSimilar++;
    }
  }
  const similarRatio = consecutiveSimilar / (lengths.length - 1);
  if (similarRatio > 0.6) {
    score = Math.max(10, score - 20);
    flags.push({
      type: 'high',
      category: 'burstiness',
      message: `Uniform sentence lengths (σ=${stdDev.toFixed(1)}) — AI typically writes same-length sentences`,
    });
  }

  if (stdDev < 5) {
    flags.push({
      type: 'critical',
      category: 'burstiness',
      message: `Very low burstiness (σ=${stdDev.toFixed(1)}). Human writing usually has σ > 8.`,
    });
  }

  return { score, flags };
}

/** AI-Tell vocabulary scan with severity weighting */
function scoreVocabulary(text: string): { score: number; flags: DetectionFlag[] } {
  const flags: DetectionFlag[] = [];
  const lower = text.toLowerCase();
  const totalWords = wordCount(text);
  if (totalWords < 10) return { score: 80, flags };

  let penaltyPoints = 0;

  // Critical words: -8 points each
  for (const word of CRITICAL_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      penaltyPoints += matches.length * 8;
      flags.push({
        type: 'critical',
        category: 'vocabulary',
        message: `AI-tell word: "${word}" (${matches.length}x)`,
      });
    }
  }

  // High words: -5 points each
  for (const word of HIGH_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      penaltyPoints += matches.length * 5;
      flags.push({
        type: 'high',
        category: 'vocabulary',
        message: `AI-typical word: "${word}" (${matches.length}x)`,
      });
    }
  }

  // Medium words: -3 points each
  for (const word of MEDIUM_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      penaltyPoints += matches.length * 3;
    }
  }

  // Phrase scanning
  for (const phrase of AI_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      penaltyPoints += 6;
      flags.push({
        type: 'high',
        category: 'phrase',
        message: `AI phrase pattern: "${phrase}"`,
      });
    }
  }

  // Normalize penalty relative to text length
  const density = (penaltyPoints / totalWords) * 100;
  let score: number;
  if (density === 0) score = 100;
  else if (density < 1) score = 85;
  else if (density < 3) score = 65;
  else if (density < 6) score = 40;
  else if (density < 10) score = 20;
  else score = 5;

  return { score, flags };
}

/** Structural signal analysis: paragraph uniformity, contractions, transitions */
function scoreStructure(text: string): { score: number; flags: DetectionFlag[] } {
  const flags: DetectionFlag[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const totalWords = wordCount(text);
  if (totalWords < 20) return { score: 70, flags };

  let structureScore = 70; // Start neutral

  // Contraction check — humans use more contractions
  const contractions = (text.match(/\b\w+'(t|s|re|ve|d|ll|m)\b/gi) || []).length;
  const contractionRate = contractions / totalWords;
  if (contractionRate > 0.03) structureScore += 15;
  else if (contractionRate > 0.01) structureScore += 5;
  else {
    structureScore -= 10;
    flags.push({
      type: 'medium',
      category: 'structure',
      message: 'No contractions — human writing naturally uses contractions',
    });
  }

  // Question mark presence — humans ask questions naturally
  const questions = (text.match(/\?/g) || []).length;
  if (questions > 0) structureScore += 5;

  // Exclamation mark presence
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 0 && exclamations < 5) structureScore += 3;

  // First person pronouns — humans self-reference
  const firstPerson = (text.match(/\b(I|me|my|mine|myself|I'm|I've|I'd|I'll)\b/gi) || []).length;
  if (firstPerson > 0) structureScore += 8;

  // Paragraph length uniformity
  if (paragraphs.length >= 3) {
    const pLengths = paragraphs.map(p => wordCount(p));
    const pStdDev = standardDeviation(pLengths);
    const pMean = pLengths.reduce((a, b) => a + b, 0) / pLengths.length;
    if (pMean > 0 && pStdDev / pMean < 0.2) {
      structureScore -= 10;
      flags.push({
        type: 'medium',
        category: 'structure',
        message: 'Paragraph lengths are suspiciously uniform',
      });
    }
  }

  // Transition word overuse
  const transitions = ['however', 'furthermore', 'moreover', 'additionally', 'consequently', 'therefore'];
  let transitionCount = 0;
  for (const t of transitions) {
    const matches = text.toLowerCase().match(new RegExp(`\\b${t}\\b`, 'g'));
    if (matches) transitionCount += matches.length;
  }
  const transitionDensity = transitionCount / Math.max(1, paragraphs.length);
  if (transitionDensity > 0.8) {
    structureScore -= 12;
    flags.push({
      type: 'high',
      category: 'structure',
      message: 'Excessive transition words — AI over-connects paragraphs',
    });
  }

  // Em dash overuse — AI loves em dashes
  const emDashes = (text.match(/—/g) || []).length;
  const emDashDensity = emDashes / (totalWords / 500);
  if (emDashDensity > 2) {
    structureScore -= 5;
    flags.push({
      type: 'medium',
      category: 'structure',
      message: 'Excessive em dashes — common AI writing pattern',
    });
  }

  return { score: Math.max(0, Math.min(100, structureScore)), flags };
}

// ── Main Detection Function ──

export function detectAI(text: string): DetectionResult {
  if (!text || text.trim().length < 30) {
    return {
      humanScore: 50,
      verdict: 'mixed',
      breakdown: { perplexity: 50, burstiness: 50, vocabulary: 50, structure: 50 },
      flags: [],
      paragraphScores: [],
    };
  }

  const perplexity = scorePerplexity(text);
  const burstiness = scoreBurstiness(text);
  const vocabulary = scoreVocabulary(text);
  const structure = scoreStructure(text);

  // Weighted composite
  const humanScore = Math.round(
    perplexity.score * 0.35 +
    burstiness.score * 0.30 +
    vocabulary.score * 0.20 +
    structure.score * 0.15
  );

  const verdict: DetectionResult['verdict'] =
    humanScore >= 61 ? 'likely_human' :
    humanScore >= 31 ? 'mixed' :
    'likely_ai';

  // Per-paragraph scoring
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
  const paragraphScores: ParagraphScore[] = paragraphs.map((para, i) => {
    const pPerp = scorePerplexity(para);
    const pBurst = scoreBurstiness(para);
    const pVocab = scoreVocabulary(para);
    const pStruct = scoreStructure(para);
    const pScore = Math.round(
      pPerp.score * 0.35 + pBurst.score * 0.30 + pVocab.score * 0.20 + pStruct.score * 0.15
    );
    return {
      index: i,
      text: para,
      score: pScore,
      flags: [
        ...pVocab.flags.map(f => f.message),
        ...pBurst.flags.map(f => f.message),
      ],
    };
  });

  const allFlags = [
    ...vocabulary.flags,
    ...burstiness.flags,
    ...perplexity.flags,
    ...structure.flags,
  ].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.type] - order[b.type];
  });

  return {
    humanScore,
    verdict,
    breakdown: {
      perplexity: perplexity.score,
      burstiness: burstiness.score,
      vocabulary: vocabulary.score,
      structure: structure.score,
    },
    flags: allFlags,
    paragraphScores,
  };
}

/** Get the banned word list for use in humanization prompts */
export function getBannedWordList(): string {
  return [...CRITICAL_WORDS, ...HIGH_WORDS].join(', ');
}

/** Get AI phrase patterns for prompts */
export function getAIPhraseList(): string {
  return AI_PHRASES.slice(0, 20).map(p => `"${p}"`).join(', ');
}
