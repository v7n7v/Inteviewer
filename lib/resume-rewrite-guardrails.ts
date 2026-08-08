/**
 * Rewrite admissibility filter and diff annotator.
 *
 * This is the load-bearing truth primitive for the conversational Studio, and it exists
 * because three independent skeptics each defeated the idea that a token-bounded rewrite
 * can be stamped `verified`. A model can launder a claim ("managed" -> "spearheaded"),
 * steal a number from one job into another job's line, or drop a negation - and no token
 * filter catches semantic fabrication. So this module does NOT verify. It cannot return
 * `verified`: its provenance union has no such value.
 *
 * What it does, per the judge's ruling:
 *   (a) ADMISSIBILITY - reject any proposed rewrite that introduces a number not present
 *       on the SPECIFIC source line it rewrites (per-line binding kills cross-line theft),
 *       or an entity absent from the source RESUME (never the job description - a JD
 *       mentioning Kubernetes is not evidence the candidate used it), or is empty, or
 *       claims to rewrite a line that is not a real source unit.
 *   (b) ANNOTATION - flag introduced claim-verbs and numeric moves so the reviewing human's
 *       eye lands on the exact delta. A model rewording "managed" to "spearheaded" is
 *       admissible but annotated, because the human - not the code - must judge it.
 *
 * Everything admissible is at most `draft`: human-confirm-gated, exported as `edited`,
 * never `verified`. The only `verified` transforms live elsewhere (exact-multiset reorder,
 * pure deletion in resume-morph-guardrails.ts).
 */

import { serializeResumeToText, type CanonicalResume } from '@/lib/resume-normalizer';
import {
  numericClaimsMultiset,
  normalizeEvidenceUnit,
} from '@/lib/resume-morph-guardrails';

/**
 * Lowercase technology/skill terms that must be treated as ENTITIES even though they are
 * not capitalised. Without this backstop a model could inject "terraform" or "kubernetes"
 * from a job description in lowercase and slip past the proper-noun heuristic. The list is
 * a backstop, not a whitelist: membership makes a token an entity to be checked against
 * the source, it never authorizes anything.
 */
const SKILL_LEXICON = new Set([
  'kubernetes', 'terraform', 'docker', 'ansible', 'jenkins', 'kafka', 'spark', 'hadoop',
  'salesforce', 'gainsight', 'tableau', 'snowflake', 'databricks', 'airflow', 'postgres',
  'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'kotlin', 'rust', 'golang', 'scala',
  'pytorch', 'tensorflow', 'numpy', 'pandas', 'sklearn', 'kubeflow', 'grafana', 'prometheus',
  'figma', 'sketch', 'webpack', 'vite', 'nextjs', 'nodejs', 'django', 'flask', 'rails',
  'stripe', 'twilio', 'segment', 'amplitude', 'mixpanel', 'hubspot', 'marketo', 'zendesk',
]);

/**
 * Verbs that assert scope or seniority. Introducing one that is not in the source line is
 * not blocked (rewrites are draft and human-gated regardless), but it IS annotated so the
 * reviewer sees "you did not say you led this - do you want to?" rather than a silent
 * upgrade. Warn, do not block, is the ruled default; an owner may harden it later.
 */
const CLAIM_VERB_LEXICON = new Set([
  'led', 'owned', 'managed', 'spearheaded', 'architected', 'drove', 'directed', 'oversaw',
  'headed', 'founded', 'launched', 'built', 'scaled', 'grew', 'promoted', 'pioneered',
  'established', 'orchestrated', 'championed', 'delivered', 'transformed', 'overhauled',
]);

export type RewriteProvenance = 'unchanged' | 'reordered' | 'draft';

export type RewriteRejection =
  | 'empty'
  | 'scope-missing'
  | 'numeric-not-in-source-LINE'
  | 'entity-not-in-source';

export interface RewriteAnnotations {
  /** claim-verbs in the proposal that are absent from its own source line */
  introducedClaimVerbs: string[];
  /** numeric claims that differ between source and proposal - a dropped or altered number */
  numericMoves: string[];
  /** entity tokens in the proposal absent from the source resume (present only on reject) */
  addedEntities: string[];
}

export interface RewriteClassification {
  provenance: RewriteProvenance;
  reject?: RewriteRejection;
  annotations: RewriteAnnotations;
}

export interface RewriteContext {
  /** normalized tokens present anywhere in the source resume - the entity allow-set */
  sourceTokens: Set<string>;
  /** normalized tokens present in the JD - reference only, NEVER an entity allow-source */
  jdTokens: Set<string>;
  /** normalized form of every addressable source unit (achievements, summary, skills, ...) */
  sourceLineHashes: Set<string>;
}

const WORD = /[A-Za-z][A-Za-z0-9+#.]*/g;

function tokenize(text: string): string[] {
  return (text.match(WORD) || []);
}

function normalizedTokenSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const token of tokenize(text)) set.add(token.toLowerCase());
  return set;
}

/**
 * Is this word an entity - an acronym, tech token, CamelCase name, or lexicon skill - that
 * a rewrite may only carry if the SOURCE resume already contains it?
 *
 * `atSentenceStart` matters for the plain-capitalised rule only: a bullet almost always
 * opens with a capitalised VERB ("Sustained a 94% rate", "Recovered three accounts"), and
 * treating that as a proper noun would reject every honest reword. So a plain-capitalised
 * word at a sentence start is NOT an entity. Acronyms, CamelCase, alphanumeric tokens and
 * lexicon skills ARE entities at any position, because "Kubernetes" or "SQL" opening a
 * bullet is still a claim about tools. The residual - a bare invented proper noun opening a
 * bullet, e.g. "Google migration..." - is the exact class the judge ruled code cannot
 * fully catch; the human review and the never-`verified` label are the backstop there.
 */
function isEntityToken(word: string, atSentenceStart: boolean): boolean {
  const lower = word.toLowerCase();
  // A claim-verb is a verb, never an entity - "Spearheaded" is not a proper noun.
  if (CLAIM_VERB_LEXICON.has(lower)) return false;
  if (SKILL_LEXICON.has(lower)) return true;                   // lowercase backstop
  if (/^[A-Z]{2,}$/.test(word)) return true;                   // acronym: ATS, SQL, B2B
  if (/[A-Za-z][0-9]|[0-9][A-Za-z]/.test(word)) return true;   // alphanumeric: 5G, C++, S3
  if (/[a-z][A-Z]/.test(word)) return true;                    // CamelCase: PostgreSQL
  if (/^[A-Z][a-z]+$/.test(word) && !atSentenceStart) return true; // mid-sentence proper noun
  return false;
}

/**
 * Extract entity tokens from a line, tracking sentence starts so a capitalised opening verb
 * is not mistaken for a proper noun.
 */
function extractEntities(text: string): string[] {
  const out: string[] = [];
  let atSentenceStart = true;
  for (const raw of text.split(/\s+/)) {
    const token = raw.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9+#.]+$/, '');
    if (token && isEntityToken(token, atSentenceStart)) out.push(token);
    atSentenceStart = /[.!?]$/.test(raw);
  }
  return out;
}

/**
 * Build the context a batch of rewrites is checked against. Uses serializeResumeToText -
 * NOT flattenResume - so the token set is the full resume body, and collects every
 * addressable source unit for the per-line scope check.
 */
export function buildRewriteContext(source: CanonicalResume, jobDescription: string): RewriteContext {
  const sourceTokens = normalizedTokenSet(serializeResumeToText(source));
  const jdTokens = normalizedTokenSet(jobDescription || '');

  const sourceLineHashes = new Set<string>();
  const addUnit = (value: unknown) => {
    if (typeof value !== 'string') return;
    const normalized = normalizeEvidenceUnit(value);
    if (normalized) sourceLineHashes.add(normalized);
  };

  if (source.summary) addUnit(source.summary);
  if (source.title) addUnit(source.title);
  for (const exp of source.experience || []) {
    for (const line of exp.achievements || []) addUnit(line);
  }
  for (const group of source.skills || []) {
    for (const item of group.items || []) addUnit(item);
  }
  for (const edu of source.education || []) {
    addUnit(edu.degree);
    addUnit(edu.institution);
    addUnit((edu as { details?: string }).details);
  }
  for (const cert of source.certifications || []) addUnit(cert);

  return { sourceTokens, jdTokens, sourceLineHashes };
}

/**
 * Classify a single proposed line rewrite. Never returns `verified`. A `reject` means the
 * proposal is inadmissible and must be discarded before it is ever shown to the user; an
 * admissible proposal is `draft` (or `unchanged`/`reordered` for faithful transforms),
 * carrying annotations that force the reviewer's eye to the exact delta.
 */
export function classifyLineRewrite(
  sourceText: string,
  proposedText: string,
  ctx: RewriteContext,
): RewriteClassification {
  const empty: RewriteAnnotations = { introducedClaimVerbs: [], numericMoves: [], addedEntities: [] };

  const proposed = String(proposedText ?? '').trim();
  if (!proposed) return { provenance: 'draft', reject: 'empty', annotations: empty };

  const sourceNorm = normalizeEvidenceUnit(sourceText);
  // The rewrite must target a real source unit. A proposal whose sourceText is not an
  // addressable line of the resume is out of scope - it cannot be bound to any evidence.
  if (!sourceNorm || !ctx.sourceLineHashes.has(sourceNorm)) {
    return { provenance: 'draft', reject: 'scope-missing', annotations: empty };
  }

  // ── numeric binding: proposed numbers must be a sub-multiset of THIS source line ──
  const sourceNums = numericClaimsMultiset(sourceText);
  const proposedNums = numericClaimsMultiset(proposed);
  const numericMoves: string[] = [];
  for (const [claim, count] of proposedNums) {
    if ((sourceNums.get(claim) ?? 0) < count) {
      // A number in the proposal that is not (or not as often) in its own source line.
      // This is the cross-line-theft and magnitude-invention vector. Reject.
      return {
        provenance: 'draft',
        reject: 'numeric-not-in-source-LINE',
        annotations: { ...empty, numericMoves: [claim] },
      };
    }
  }
  // Numbers present in source but dropped by the proposal are admissible (dropping a
  // number states nothing false) but annotated, because the eye should see the loss.
  for (const [claim, count] of sourceNums) {
    const kept = proposedNums.get(claim) ?? 0;
    for (let i = kept; i < count; i++) numericMoves.push(claim);
  }

  // ── entity anchor: every entity in the proposal must be in the SOURCE resume ──
  const addedEntities: string[] = [];
  for (const word of extractEntities(proposed)) {
    if (!ctx.sourceTokens.has(word.toLowerCase())) addedEntities.push(word);
  }
  if (addedEntities.length > 0) {
    // A proper noun / skill / acronym not in the resume - even if the JD has it. The JD is
    // never an evidence source. Reject.
    return {
      provenance: 'draft',
      reject: 'entity-not-in-source',
      annotations: { ...empty, addedEntities },
    };
  }

  // ── claim-verb annotation (warn, never block) ──
  const sourceLineTokens = normalizedTokenSet(sourceText);
  const introducedClaimVerbs: string[] = [];
  for (const word of tokenize(proposed)) {
    const lower = word.toLowerCase();
    if (CLAIM_VERB_LEXICON.has(lower) && !sourceLineTokens.has(lower)) {
      if (!introducedClaimVerbs.includes(lower)) introducedClaimVerbs.push(lower);
    }
  }

  const annotations: RewriteAnnotations = { introducedClaimVerbs, numericMoves, addedEntities: [] };

  // ── provenance: faithful transforms are recognised; everything else is a draft reword ──
  if (normalizeEvidenceUnit(proposed) === sourceNorm) {
    return { provenance: 'unchanged', annotations };
  }
  // Same word multiset in a different order is a faithful reorder, not a reword.
  const sourceWords = tokenize(sourceText).map((w) => w.toLowerCase()).sort();
  const proposedWords = tokenize(proposed).map((w) => w.toLowerCase()).sort();
  if (
    sourceWords.length === proposedWords.length &&
    sourceWords.every((w, i) => w === proposedWords[i])
  ) {
    return { provenance: 'reordered', annotations };
  }

  return { provenance: 'draft', annotations };
}
