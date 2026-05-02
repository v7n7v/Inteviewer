/**
 * Interview Telemetry Engine
 * Deterministic NLP analytics on interview transcripts.
 *
 * Runs client-side — zero API calls, instant results.
 * Computes: WPM, filler words, keyword coverage, STAR compliance,
 * response balance.
 */


// ── Filler Word Dictionary ──
const FILLER_WORDS: Record<string, string> = {
  'um': 'um', 'uh': 'uh', 'uhh': 'uh', 'umm': 'um',
  'like': 'like', 'basically': 'basically', 'actually': 'actually',
  'honestly': 'honestly', 'literally': 'literally', 'right': 'right',
  'anyway': 'anyway', 'whatever': 'whatever', 'stuff': 'stuff',
  'things': 'things', 'kind of': 'kind of', 'sort of': 'sort of',
  'i mean': 'I mean', 'you know': 'you know', 'so yeah': 'so yeah',
  'i guess': 'I guess', 'i think': 'I think',
};

// Multi-word fillers to check via regex
const MULTI_FILLERS = [
  { pattern: /\byou know\b/gi, label: 'you know' },
  { pattern: /\bkind of\b/gi, label: 'kind of' },
  { pattern: /\bsort of\b/gi, label: 'sort of' },
  { pattern: /\bi mean\b/gi, label: 'I mean' },
  { pattern: /\bso yeah\b/gi, label: 'so yeah' },
  { pattern: /\bi guess\b/gi, label: 'I guess' },
];

// STAR method indicators
const STAR_SITUATION = /\b(situation|context|background|when i was|at my|during)\b/i;
const STAR_TASK = /\b(task|responsible|needed to|had to|goal|objective|challenge)\b/i;
const STAR_ACTION = /\b(i (did|built|created|led|managed|developed|implemented|designed|wrote|fixed|set up|drove|ran|shipped|launched|improved|reduced|grew|cut))\b/i;
const STAR_RESULT = /\b(result|outcome|impact|increased|decreased|improved|saved|generated|reduced|grew|achieved|delivered|led to|which meant)\b/i;

// ── Types ──

export interface FillerEntry {
  word: string;
  count: number;
}

export interface InterviewTelemetry {
  // Pacing
  wpm: number;
  wpmVerdict: 'too_slow' | 'good' | 'too_fast';
  wpmIdeal: { min: number; max: number };

  // Fillers
  fillerCount: number;
  fillerRatio: number;
  fillerVerdict: 'clean' | 'acceptable' | 'high';
  fillers: FillerEntry[];

  // Keyword coverage (requires JD)
  keywordCoverage: number;
  keywordsHit: string[];
  keywordsMissed: string[];

  // STAR compliance
  starScore: number;
  starVerdict: 'strong' | 'moderate' | 'weak';

  // Response balance
  responseBalance: number;
  responseBalanceVerdict: 'too_short' | 'good' | 'too_long';

  // Volume stats
  totalUserWords: number;
  totalAIWords: number;
  questionCount: number;
  avgResponseLength: number;
  longestResponse: { text: string; wordCount: number };
  shortestResponse: { text: string; wordCount: number };
  totalDurationSeconds: number;
}

/**
 * Analyze a completed interview transcript.
 */
export function analyzeInterview(
  transcript: { role: 'user' | 'ai'; text: string }[],
  elapsedSeconds: number,
  jobDescription?: string,
): InterviewTelemetry {
  // Separate user and AI messages
  const userMessages = transcript.filter(t => t.role === 'user' && t.text.trim().length > 0);
  const aiMessages = transcript.filter(t => t.role === 'ai' && t.text.trim().length > 0);

  const userText = userMessages.map(m => m.text).join(' ');
  const userWords = userText.split(/\s+/).filter(Boolean);
  const totalUserWords = userWords.length;

  const aiText = aiMessages.map(m => m.text).join(' ');
  const aiWords = aiText.split(/\s+/).filter(Boolean);
  const totalAIWords = aiWords.length;

  // ── WPM ──
  const minutes = Math.max(elapsedSeconds / 60, 0.5); // min 30s to avoid divide-by-near-zero
  const wpm = Math.round(totalUserWords / minutes);
  const wpmVerdict: InterviewTelemetry['wpmVerdict'] =
    wpm < 110 ? 'too_slow' : wpm > 170 ? 'too_fast' : 'good';

  // ── Filler Words ──
  const fillerMap = new Map<string, number>();

  // Single-word fillers
  for (const word of userWords) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    const filler = FILLER_WORDS[clean];
    if (filler) fillerMap.set(filler, (fillerMap.get(filler) || 0) + 1);
  }

  // Multi-word fillers
  for (const { pattern, label } of MULTI_FILLERS) {
    const matches = userText.match(pattern);
    if (matches) fillerMap.set(label, (fillerMap.get(label) || 0) + matches.length);
  }

  const fillerCount = [...fillerMap.values()].reduce((a, b) => a + b, 0);
  const fillerRatio = totalUserWords > 0 ? Math.round((fillerCount / totalUserWords) * 1000) / 10 : 0;
  const fillers: FillerEntry[] = [...fillerMap.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
  const fillerVerdict: InterviewTelemetry['fillerVerdict'] =
    fillerRatio < 2 ? 'clean' : fillerRatio < 5 ? 'acceptable' : 'high';

  // ── Keyword Coverage ──
  let keywordCoverage = 0;
  let keywordsHit: string[] = [];
  let keywordsMissed: string[] = [];

  if (jobDescription) {
    // Reuse existing JD keyword extractor
    const jdKeywords = extractJDKeywords_internal(jobDescription);
    const userLower = userText.toLowerCase();

    for (const kw of jdKeywords) {
      if (userLower.includes(kw.toLowerCase())) {
        keywordsHit.push(kw);
      } else {
        keywordsMissed.push(kw);
      }
    }
    const total = jdKeywords.length || 1;
    keywordCoverage = Math.round((keywordsHit.length / total) * 100);
  }

  // ── STAR Compliance ──
  let starHits = 0;
  let totalResponses = 0;

  for (const msg of userMessages) {
    if (msg.text.split(/\s+/).length < 15) continue; // skip very short responses
    totalResponses++;
    let components = 0;
    if (STAR_SITUATION.test(msg.text)) components++;
    if (STAR_TASK.test(msg.text)) components++;
    if (STAR_ACTION.test(msg.text)) components++;
    if (STAR_RESULT.test(msg.text)) components++;
    if (components >= 3) starHits++; // 3 of 4 STAR components = structured
  }
  const starScore = totalResponses > 0 ? Math.round((starHits / totalResponses) * 100) : 0;
  const starVerdict: InterviewTelemetry['starVerdict'] =
    starScore >= 60 ? 'strong' : starScore >= 30 ? 'moderate' : 'weak';

  // ── Response Balance ──
  const avgUserLen = userMessages.length > 0
    ? userMessages.reduce((sum, m) => sum + m.text.split(/\s+/).length, 0) / userMessages.length
    : 0;
  const avgAILen = aiMessages.length > 0
    ? aiMessages.reduce((sum, m) => sum + m.text.split(/\s+/).length, 0) / aiMessages.length
    : 1;
  const responseBalance = Math.round((avgUserLen / Math.max(avgAILen, 1)) * 10) / 10;
  const responseBalanceVerdict: InterviewTelemetry['responseBalanceVerdict'] =
    responseBalance < 1.5 ? 'too_short' : responseBalance > 5 ? 'too_long' : 'good';

  // ── Best / Worst Responses ──
  const userWithLen = userMessages.map(m => ({
    text: m.text,
    wordCount: m.text.split(/\s+/).length,
  }));
  userWithLen.sort((a, b) => b.wordCount - a.wordCount);

  const longestResponse = userWithLen[0] || { text: '', wordCount: 0 };
  const shortestResponse = userWithLen[userWithLen.length - 1] || { text: '', wordCount: 0 };

  // Question count = AI messages that contain "?"
  const questionCount = aiMessages.filter(m => m.text.includes('?')).length;

  return {
    wpm,
    wpmVerdict,
    wpmIdeal: { min: 120, max: 160 },
    fillerCount,
    fillerRatio,
    fillerVerdict,
    fillers,
    keywordCoverage,
    keywordsHit,
    keywordsMissed,
    starScore,
    starVerdict,
    responseBalance,
    responseBalanceVerdict,
    totalUserWords,
    totalAIWords,
    questionCount,
    avgResponseLength: Math.round(avgUserLen),
    longestResponse,
    shortestResponse,
    totalDurationSeconds: elapsedSeconds,
  };
}

/**
 * Simple JD keyword extractor — lightweight version that works client-side.
 * Extracts technical terms, tools, and multi-word phrases.
 */
function extractJDKeywords_internal(jd: string): string[] {
  const techKeywords = [
    'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'go', 'rust', 'ruby',
    'swift', 'kotlin', 'scala', 'php', 'r', 'sql', 'nosql', 'html', 'css',
    'react', 'angular', 'vue', 'next.js', 'node.js', 'express', 'django', 'flask',
    'spring', 'fastapi', '.net', 'terraform', 'ansible',
    'docker', 'kubernetes', 'jenkins', 'github', 'gitlab',
    'aws', 'azure', 'gcp', 'firebase', 'vercel',
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'kafka', 'graphql', 'rest', 'grpc', 'webpack', 'vite',
    'tableau', 'power bi', 'snowflake', 'databricks', 'airflow',
    'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy',
    'figma', 'jira', 'confluence', 'git', 'linux', 'bash',
    'machine learning', 'deep learning', 'data science', 'data engineering',
    'devops', 'ci/cd', 'microservices', 'agile', 'scrum',
    'leadership', 'communication', 'problem-solving', 'teamwork',
    'project management', 'system design', 'cloud computing',
  ];

  const found: string[] = [];
  const lower = jd.toLowerCase();

  for (const kw of techKeywords) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) found.push(kw);
  }

  return found;
}
