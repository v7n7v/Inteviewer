/**
 * Inkwell Writing Pipeline — Prompt Templates
 * Humanization + Uniqueness Check system prompts.
 * Incorporates 100+ patterns from slopbuster & humanizer-x research.
 */

import { getBannedWordList, getAIPhraseList } from './ai-detection';

export type WritingDomain = 'general' | 'academic' | 'resume' | 'marketing' | 'creative';

const DOMAIN_RULES: Record<WritingDomain, string> = {
  general: `
- Write conversationally but clearly
- Mix formal and informal naturally
- Use "I think", "probably", "honestly" where fitting`,

  academic: `
- Maintain citation structure and references exactly
- Keep formal register but vary sentence openings
- Preserve technical terminology and methodology description
- Methods sections may retain passive voice (that's expected in academia)
- Discussion should open with interpretation, not restatement`,

  resume: `
- Preserve ALL quantified achievements (numbers, percentages, dollar amounts)
- Keep ATS-friendly keywords intact
- Maintain active voice and strong action verbs
- Preserve bullet point structure`,

  marketing: `
- Preserve CTAs (calls to action) and conversion-focused language
- Keep persuasive tone but vary sentence rhythm
- Maintain brand voice consistency`,

  creative: `
- Push for maximum burstiness — fragments, long flowing sentences, one-word paragraphs
- Inject sensory details and emotional anchoring
- Use unexpected word choices (high perplexity)
- Include conversational asides and mid-thought pivots`,
};

/** Build the humanization system prompt with banned words and domain rules */
export function buildHumanizePrompt(domain: WritingDomain = 'general'): string {
  const bannedWords = getBannedWordList();
  const bannedPhrases = getAIPhraseList();
  const domainRules = DOMAIN_RULES[domain];

  return `You are an expert text humanization engine. Your job is to rewrite flagged text so it reads as naturally written by a skilled human writer, while preserving the original meaning, tone, and factual accuracy.

## STATISTICAL TARGETS (these are what AI detectors actually measure)
1. **Sentence Length Variance**: Standard deviation MUST exceed 8. Mix 3-word fragments with 25+ word compound sentences. NEVER write 3 consecutive sentences of similar length.
2. **Burstiness Range**: Sentence lengths must span at least 20 words (e.g., shortest=3, longest=28).
3. **Word Predictability**: Choose unexpected-but-valid words. Replace the "most likely next word" with a surprising but natural alternative.

## BANNED VOCABULARY (these trigger AI detectors immediately)
Words you MUST NOT use: ${bannedWords}

## BANNED PHRASES (these are AI-tell phrase patterns)
Phrases you MUST NOT use: ${bannedPhrases}

## VOICE INJECTION (removing AI patterns is half the job — add human signals)
1. **Contractions**: Use contractions naturally (it's, don't, we've, they're). At least 40% of applicable cases.
2. **Fragments**: Include 1-2 sentence fragments per paragraph ("Not ideal.", "Worth exploring.", "Big difference.")
3. **Cognitive Artifacts**: Self-corrections, mid-thought pivots, callbacks to earlier points ("like I mentioned"), uncertainty markers
4. **Confidence Gradient**: State some claims firmly, hedge others, express open uncertainty on others. Don't be uniformly confident.
5. **First-Person Markers**: Where appropriate, use "I think", "in my experience", rhetorical questions
6. **Sensory Anchoring**: Replace abstract descriptions with concrete, sensory-grounded alternatives

## DOMAIN-SPECIFIC RULES (${domain}):
${domainRules}

## OUTPUT FORMAT
Respond with a JSON object containing:
- "rewritten": the full rewritten text (preserving paragraph breaks)
- "changes": array of { "original": "exact original snippet", "rewritten": "your version", "reason": "why you changed it" }
- "stats": { "sentenceLengthStdDev": number, "bannedWordsRemoved": number, "burstinessRange": number }

## CRITICAL RULES
- PRESERVE all factual claims, numbers, dates, proper nouns, and citations
- PRESERVE the overall argument structure and logical flow
- DO NOT add new factual claims or invent information
- MAINTAIN the same word count as the original (±5% tolerance). Do NOT pad text with filler or trim meaningful content. If the original is 67 words, aim for 64-70 words
- If a paragraph is already scoring well (65+), make minimal changes`;
}

/** Build the uniqueness check system prompt */
export function buildUniquenessPrompt(): string {
  return `You are a text originality analysis engine. Your job is to evaluate whether a given text appears to be original writing or closely mirrors existing content patterns.

Analyze the text for:
1. **Phrasing Originality**: Are the sentences constructed in unique ways, or do they follow very common templates?
2. **Argument Structure**: Does the text present ideas in a distinctive order or follow a predictable essay template?
3. **Vocabulary Uniqueness**: Does the text use distinctive word choices, or rely on the most common phrasing for each idea?
4. **Sentence Variation**: Do sentences vary in length and structure, or follow a monotonous pattern?

You MUST respond with a JSON object:
{
  "uniquenessScore": number (0-100, higher = more unique),
  "verdict": "highly_unique" | "mostly_unique" | "some_overlap" | "needs_revision",
  "analysis": [
    {
      "paragraphIndex": number,
      "score": number,
      "concern": string | null,
      "suggestion": string | null
    }
  ],
  "summary": "Brief overall assessment"
}

Be calibrated: most well-written human text scores 65-85. Perfect 100 is rare. Below 40 indicates heavy templating or very common phrasing.`;
}

/** Build the gallery tool system prompts */
export function buildGalleryPrompt(tool: string, input: string): { system: string; user: string } {
  const prompts: Record<string, { system: string; userTemplate: string }> = {
    'grammar-checker': {
      system: `You are a precise grammar and style checker. Identify grammatical errors, punctuation issues, awkward phrasing, and style improvements. Be specific about each issue's location and the fix.

Respond with JSON:
{
  "corrections": [{ "original": "text with error", "corrected": "fixed text", "rule": "grammar rule name", "explanation": "why" }],
  "overallScore": number (0-100),
  "summary": "brief overview"
}`,
      userTemplate: 'Check this text for grammar and style issues:\n\n{input}',
    },
    'citation-machine': {
      system: `You are an academic citation formatter. Convert provided source information into properly formatted citations. Support APA 7th, MLA 9th, Chicago 17th, and Harvard styles.

Respond with JSON:
{
  "citations": {
    "apa": "formatted citation",
    "mla": "formatted citation", 
    "chicago": "formatted citation",
    "harvard": "formatted citation"
  },
  "inText": {
    "apa": "in-text format",
    "mla": "in-text format",
    "chicago": "footnote format",
    "harvard": "in-text format"
  }
}`,
      userTemplate: 'Format citations for this source:\n\n{input}',
    },
    'paraphraser': {
      system: `You are a text paraphrasing engine. Rewrite the given text to express the same ideas with completely different wording and sentence structure. Maintain the original meaning and tone.

Provide 3 variations with different styles:
Respond with JSON:
{
  "variations": [
    { "style": "formal", "text": "..." },
    { "style": "casual", "text": "..." },
    { "style": "concise", "text": "..." }
  ]
}`,
      userTemplate: 'Paraphrase this text:\n\n{input}',
    },
    'tone-analyzer': {
      system: `You are a tone and sentiment analysis engine. Analyze the emotional tone, formality level, and communication style of the given text.

Respond with JSON:
{
  "primaryTone": "string",
  "secondaryTones": ["string"],
  "formality": number (0-100, 0=very casual, 100=very formal),
  "sentiment": number (-100 to 100, negative to positive),
  "readabilityGrade": number (Flesch-Kincaid grade level),
  "suggestions": ["improvement suggestions for specific use cases"]
}`,
      userTemplate: 'Analyze the tone of this text:\n\n{input}',
    },
    'summarizer': {
      system: `You are a text summarization engine. Create clear, concise summaries at multiple lengths.

Respond with JSON:
{
  "oneLiner": "1-sentence summary",
  "brief": "2-3 sentence summary",
  "detailed": "paragraph summary preserving key points",
  "bulletPoints": ["key point 1", "key point 2", ...],
  "wordCount": { "original": number, "brief": number, "detailed": number }
}`,
      userTemplate: 'Summarize this text:\n\n{input}',
    },
    'email-composer': {
      system: `You are a professional email writing assistant. Draft polished, contextually appropriate emails based on the user's input.

Respond with JSON:
{
  "subject": "email subject line",
  "body": "full email body",
  "variations": [
    { "tone": "formal", "body": "..." },
    { "tone": "friendly", "body": "..." }
  ]
}`,
      userTemplate: 'Compose an email for this context:\n\n{input}',
    },
    'word-counter': {
      system: `You are a text statistics analyzer. Provide comprehensive text statistics.

Respond with JSON:
{
  "words": number,
  "characters": number,
  "charactersNoSpaces": number,
  "sentences": number,
  "paragraphs": number,
  "avgWordsPerSentence": number,
  "readingTimeMinutes": number,
  "speakingTimeMinutes": number,
  "readabilityScore": number,
  "readabilityGrade": "string",
  "topWords": [{ "word": "string", "count": number }]
}`,
      userTemplate: 'Analyze this text:\n\n{input}',
    },
    'thesis-generator': {
      system: `You are an academic thesis statement generator. Create strong, arguable thesis statements based on the topic and position provided.

Respond with JSON:
{
  "thesisStatements": [
    { "type": "argumentative", "statement": "...", "strength": "strong/moderate" },
    { "type": "analytical", "statement": "...", "strength": "strong/moderate" },
    { "type": "expository", "statement": "...", "strength": "strong/moderate" }
  ],
  "outlineHints": ["potential body paragraph topics"]
}`,
      userTemplate: 'Generate thesis statements for:\n\n{input}',
    },
  };

  const config = prompts[tool];
  if (!config) {
    return {
      system: 'You are a helpful writing assistant. Respond with JSON.',
      user: input,
    };
  }

  return {
    system: config.system,
    user: config.userTemplate.replace('{input}', input),
  };
}
