/**
 * TF-IDF Proof Engine
 * Deterministic scoring that mathematically proves the LLM's resume morph
 * improved ATS compatibility.
 *
 * Algorithm: TF-IDF vectorization + cosine similarity
 * — same class of algorithm real ATS systems use.
 *
 * Zero external dependencies.
 */

// ── Stop Words ──
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','was','are','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can',
  'this','that','these','those','it','its','i','me','my','we','our','you',
  'your','he','she','they','them','their','who','which','what','where','when',
  'how','not','no','nor','if','then','than','so','as','up','out','about',
  'into','over','after','just','also','very','much','more','most','such',
  'each','other','some','all','any','both','few','many','own','same',
]);

// ── Tokenization ──

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#+.\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function extractNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function getTerms(text: string): string[] {
  const tokens = tokenize(text);
  return [...tokens, ...extractNgrams(tokens, 2)];
}

// ── TF-IDF ──

interface TFIDFVectors {
  vocabulary: string[];
  vectors: number[][];   // one vector per document
  idf: number[];
}

function computeTFIDF(documents: string[]): TFIDFVectors {
  const docTerms = documents.map(getTerms);
  const N = documents.length;

  // Build vocabulary from all documents
  const vocabSet = new Set<string>();
  for (const terms of docTerms) {
    for (const t of terms) vocabSet.add(t);
  }
  const vocabulary = [...vocabSet];
  const vocabIndex = new Map(vocabulary.map((v, i) => [v, i]));

  // Compute IDF: log(N / df) where df = number of docs containing term
  const df = new Array(vocabulary.length).fill(0);
  for (const terms of docTerms) {
    const seen = new Set(terms);
    for (const t of seen) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) df[idx]++;
    }
  }
  const idf = df.map(d => Math.log((N + 1) / (d + 1)) + 1); // smoothed IDF

  // Compute TF-IDF vectors
  const vectors: number[][] = [];
  for (const terms of docTerms) {
    const tf = new Array(vocabulary.length).fill(0);
    for (const t of terms) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) tf[idx]++;
    }
    // Normalize TF by document length
    const maxTF = Math.max(...tf, 1);
    const tfidf = tf.map((f, i) => (f / maxTF) * idf[i]);
    vectors.push(tfidf);
  }

  return { vocabulary, vectors, idf };
}

// ── Cosine Similarity ──

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Gap Analysis ──

export interface GapClosed {
  term: string;
  jdWeight: number;        // TF-IDF weight in JD (importance)
  inOriginal: boolean;
  inMorphed: boolean;
}

export interface WeightedTerm {
  term: string;
  weight: number;
  matchedIn: 'both' | 'morphed_only' | 'original_only' | 'neither';
}

export interface ProofChartBar {
  label: string;
  baseline: number;
  optimized: number;
}

export interface ProofResult {
  baselineScore: number;      // 0-100
  optimizedScore: number;     // 0-100
  delta: number;              // optimizedScore - baselineScore
  improvement: string;        // e.g. "1.8x improvement"
  rawSimilarity: {
    baseline: number;         // raw cosine sim
    optimized: number;
  };
  gapsClosed: GapClosed[];
  topJDTerms: WeightedTerm[];
  chartData: ProofChartBar[];
}

/**
 * Main proof function.
 * Compares original and morphed resume against a job description
 * using TF-IDF cosine similarity.
 */
export function proveResumeDelta(
  originalResume: string,
  morphedResume: string,
  jobDescription: string,
): ProofResult {
  // Vectorize all three documents together (shared vocabulary)
  const { vocabulary, vectors, idf } = computeTFIDF([
    jobDescription,     // doc 0
    originalResume,     // doc 1
    morphedResume,      // doc 2
  ]);

  const jdVec = vectors[0];
  const origVec = vectors[1];
  const morphVec = vectors[2];

  // Core similarity scores
  const rawBaseline = cosineSimilarity(origVec, jdVec);
  const rawOptimized = cosineSimilarity(morphVec, jdVec);

  // Scale to 0-100 (cosine similarity for text is typically 0.05-0.6)
  const scale = (sim: number) => Math.min(98, Math.max(5, Math.round(sim * 140 + 10)));
  const baselineScore = scale(rawBaseline);
  const optimizedScore = scale(rawOptimized);
  const delta = optimizedScore - baselineScore;

  const ratio = rawBaseline > 0 ? rawOptimized / rawBaseline : 1;
  const improvement = ratio >= 1.05
    ? `${ratio.toFixed(1)}x improvement`
    : delta > 0
    ? `+${delta} points`
    : 'No significant change';

  // Top JD terms by TF-IDF weight
  const jdTermWeights = vocabulary.map((term, i) => ({
    term,
    weight: jdVec[i],
    origPresent: origVec[i] > 0,
    morphPresent: morphVec[i] > 0,
  }))
    .filter(t => t.weight > 0.01)
    .sort((a, b) => b.weight - a.weight);

  const topJDTerms: WeightedTerm[] = jdTermWeights.slice(0, 20).map(t => ({
    term: t.term,
    weight: Math.round(t.weight * 100) / 100,
    matchedIn: t.origPresent && t.morphPresent ? 'both'
      : t.morphPresent ? 'morphed_only'
      : t.origPresent ? 'original_only'
      : 'neither',
  }));

  // Gaps closed: terms in JD that weren't in original but ARE in morphed
  const gapsClosed: GapClosed[] = jdTermWeights
    .filter(t => !t.origPresent && t.morphPresent)
    .slice(0, 15)
    .map(t => ({
      term: t.term,
      jdWeight: Math.round(t.weight * 100) / 100,
      inOriginal: false,
      inMorphed: true,
    }));

  // Chart data for Recharts
  const categories = [
    { label: 'Overall Match', baseline: baselineScore, optimized: optimizedScore },
    {
      label: 'Keyword Coverage',
      baseline: Math.round((jdTermWeights.filter(t => t.origPresent).length / Math.max(jdTermWeights.length, 1)) * 100),
      optimized: Math.round((jdTermWeights.filter(t => t.morphPresent).length / Math.max(jdTermWeights.length, 1)) * 100),
    },
    {
      label: 'Skills Gap Closed',
      baseline: 0,
      optimized: Math.min(100, Math.round((gapsClosed.length / Math.max(jdTermWeights.filter(t => !t.origPresent).length, 1)) * 100)),
    },
  ];

  return {
    baselineScore,
    optimizedScore,
    delta,
    improvement,
    rawSimilarity: { baseline: rawBaseline, optimized: rawOptimized },
    gapsClosed,
    topJDTerms,
    chartData: categories,
  };
}

/**
 * Flatten a resume object to plain text for TF-IDF analysis.
 */
export function flattenResume(resume: any): string {
  const parts: string[] = [];

  if (resume.summary) parts.push(resume.summary);
  if (resume.title) parts.push(resume.title);
  if (resume.name) parts.push(resume.name);

  // Experience
  const experience = resume.experience || [];
  for (const exp of experience) {
    if (exp.title) parts.push(exp.title);
    if (exp.company) parts.push(exp.company);
    if (exp.description) parts.push(exp.description);
    if (exp.role) parts.push(exp.role);
    const bullets = exp.bullets || exp.items || [];
    for (const b of bullets) {
      if (typeof b === 'string') parts.push(b);
    }
  }

  // Skills
  const skills = resume.skills || [];
  if (Array.isArray(skills)) {
    for (const s of skills) {
      if (typeof s === 'string') parts.push(s);
      else if (s?.name) parts.push(s.name);
    }
  }

  // Education
  const education = resume.education || [];
  for (const edu of education) {
    if (edu.degree) parts.push(edu.degree);
    if (edu.school) parts.push(edu.school);
    if (edu.title) parts.push(edu.title);
    const items = edu.items || [];
    for (const item of items) {
      if (typeof item === 'string') parts.push(item);
    }
  }

  // Projects
  const projects = resume.projects || [];
  for (const proj of projects) {
    if (proj.title) parts.push(proj.title);
    if (proj.description) parts.push(proj.description);
    const items = proj.items || proj.bullets || [];
    for (const item of items) {
      if (typeof item === 'string') parts.push(item);
    }
  }

  // Certifications
  const certs = resume.certifications || [];
  for (const c of certs) {
    if (typeof c === 'string') parts.push(c);
    else if (c?.name) parts.push(c.name);
  }

  return parts.join('\n');
}
