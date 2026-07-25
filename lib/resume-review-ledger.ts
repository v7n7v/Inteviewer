export interface ResumeReviewResume {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  summary: string;
  experience: { company: string; role: string; duration: string; achievements: string[] }[];
  education: { degree: string; institution: string; year: string; details?: string }[];
  skills: { category: string; items: string[] }[];
  certifications?: string[];
}

export type ResumeReviewDecision = 'accepted' | 'reverted';
export type ResumeReviewView = 'focused' | 'comparison';
export type ResumeReviewDocumentTab = 'source' | 'tailored';

export interface ResumeReviewState {
  version: 1;
  decisions: Record<string, ResumeReviewDecision>;
  selectedId: string | null;
  view: ResumeReviewView;
  documentTab: ResumeReviewDocumentTab;
}

export interface ResumeReviewChange {
  id: string;
  kind: 'reordered' | 'needs-review';
  section: 'identity' | 'summary' | 'experience' | 'education' | 'skills' | 'certifications';
  path: string;
  title: string;
  description: string;
  sourceText: string[];
  candidateText: string[];
  affectedLines: number;
}

export interface ResumeReviewLedger {
  available: boolean;
  changes: ResumeReviewChange[];
}

export const DEFAULT_RESUME_REVIEW_STATE: ResumeReviewState = {
  version: 1,
  decisions: {},
  selectedId: null,
  view: 'comparison',
  documentTab: 'tailored',
};

export function getResumeReviewDecisionScope(change: ResumeReviewChange): string {
  const recordMatch = change.path.match(/^(experience|education|skills)\.([a-z0-9]+)(?:\.|$)/);
  if (recordMatch && recordMatch[2] !== 'order') return `${recordMatch[1]}.${recordMatch[2]}`;
  return change.path;
}

export function updateResumeReviewDecision(
  changes: ResumeReviewChange[],
  current: Record<string, ResumeReviewDecision>,
  changeId: string,
  requestedDecision: ResumeReviewDecision,
): Record<string, ResumeReviewDecision> {
  const selected = changes.find(change => change.id === changeId);
  if (!selected) return { ...current };
  const scope = getResumeReviewDecisionScope(selected);
  const scopedChanges = changes.filter(change => getResumeReviewDecisionScope(change) === scope);
  if (requestedDecision === 'reverted') {
    const next = { ...current };
    scopedChanges.forEach(change => { next[change.id] = 'reverted'; });
    return next;
  }
  return { ...current, [selected.id]: 'accepted' };
}

function normalizeExact(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeIdentity(value: unknown): string {
  return normalizeExact(value).toLocaleLowerCase();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function exactList(values: unknown[] | undefined): string[] {
  return (values || []).map(normalizeExact);
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function occurrenceKeys(values: string[]): string[] {
  const seen = new Map<string, number>();
  return values.map(value => {
    const occurrence = seen.get(value) || 0;
    seen.set(value, occurrence + 1);
    return `${value}\u241e${occurrence}`;
  });
}

function sameOccurrenceMultiset(left: string[], right: string[]): boolean {
  const leftKeys = [...occurrenceKeys(left)].sort();
  const rightKeys = [...occurrenceKeys(right)].sort();
  return sameList(leftKeys, rightKeys);
}

function makeChange(
  section: ResumeReviewChange['section'],
  path: string,
  kind: ResumeReviewChange['kind'],
  title: string,
  sourceText: string[],
  candidateText: string[],
): ResumeReviewChange {
  return {
    id: `${path.replace(/[^a-z0-9]+/gi, '-')}-${kind}-${stableHash(`${path}|${sourceText.join('\u241f')}|${candidateText.join('\u241f')}`)}`,
    kind,
    section,
    path,
    title,
    description: kind === 'reordered'
      ? 'Taco changed only the order of exact source-backed content within this same record.'
      : 'This record contains missing, new, moved, or altered text and must be reverted before continuing.',
    sourceText,
    candidateText,
    affectedLines: Math.max(sourceText.length, candidateText.length),
  };
}

function classifyBoundList(
  section: ResumeReviewChange['section'],
  path: string,
  source: string[],
  candidate: string[],
  reorderedTitle: string,
  needsReviewTitle: string,
): ResumeReviewChange | null {
  if (sameList(source, candidate)) return null;
  if (sameOccurrenceMultiset(source, candidate)) {
    return makeChange(section, path, 'reordered', reorderedTitle, source, candidate);
  }
  return makeChange(section, path, 'needs-review', needsReviewTitle, source, candidate);
}

function keyedOccurrences<T>(items: T[], identity: (item: T) => string): Map<string, T> {
  const counts = new Map<string, number>();
  const result = new Map<string, T>();
  items.forEach(item => {
    const base = identity(item);
    const occurrence = counts.get(base) || 0;
    counts.set(base, occurrence + 1);
    result.set(`${base}\u241e${occurrence}`, item);
  });
  return result;
}

function compareKeyedRecords<T>(input: {
  section: ResumeReviewChange['section'];
  source: T[];
  candidate: T[];
  identity: (item: T) => string;
  label: (item: T) => string;
  recordLines: (item: T) => string[];
  compareRecord: (source: T, candidate: T, path: string) => ResumeReviewChange[];
  orderTitle: string;
  recordTitle: string;
}): ResumeReviewChange[] {
  const sourceMap = keyedOccurrences(input.source, input.identity);
  const candidateMap = keyedOccurrences(input.candidate, input.identity);
  const sourceKeys = [...sourceMap.keys()];
  const candidateKeys = [...candidateMap.keys()];
  const changes: ResumeReviewChange[] = [];

  if (!sameList(sourceKeys, candidateKeys)) {
    if (sameOccurrenceMultiset(sourceKeys, candidateKeys)) {
      changes.push(makeChange(
        input.section,
        `${input.section}.order`,
        'reordered',
        input.orderTitle,
        sourceKeys.map(key => input.label(sourceMap.get(key)!)),
        candidateKeys.map(key => input.label(candidateMap.get(key)!)),
      ));
    }
  }

  const allKeys = new Set([...sourceKeys, ...candidateKeys]);
  allKeys.forEach(key => {
    const sourceRecord = sourceMap.get(key);
    const candidateRecord = candidateMap.get(key);
    const recordPath = `${input.section}.${stableHash(key)}`;
    if (!sourceRecord || !candidateRecord) {
      changes.push(makeChange(
        input.section,
        recordPath,
        'needs-review',
        input.recordTitle,
        sourceRecord ? input.recordLines(sourceRecord) : [],
        candidateRecord ? input.recordLines(candidateRecord) : [],
      ));
      return;
    }
    changes.push(...input.compareRecord(sourceRecord, candidateRecord, recordPath));
  });

  return changes;
}

export function deriveResumeReviewLedger(
  source: ResumeReviewResume | null | undefined,
  candidate: ResumeReviewResume | null | undefined,
): ResumeReviewLedger {
  if (!source || !candidate) return { available: false, changes: [] };
  const changes: ResumeReviewChange[] = [];

  (['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website'] as const).forEach(field => {
    const sourceValue = normalizeExact(source[field]);
    const candidateValue = normalizeExact(candidate[field]);
    if (sourceValue !== candidateValue) {
      changes.push(makeChange(
        'identity',
        `identity.${field}`,
        'needs-review',
        `Review ${field === 'linkedin' ? 'LinkedIn' : field}`,
        [sourceValue],
        [candidateValue],
      ));
    }
  });

  const sourceSummary = normalizeExact(source.summary);
  const candidateSummary = normalizeExact(candidate.summary);
  if (sourceSummary !== candidateSummary) {
    changes.push(makeChange(
      'summary',
      'summary',
      'needs-review',
      'Review professional summary',
      [sourceSummary],
      [candidateSummary],
    ));
  }

  changes.push(...compareKeyedRecords({
    section: 'experience',
    source: source.experience || [],
    candidate: candidate.experience || [],
    identity: entry => [entry.role, entry.company, entry.duration].map(normalizeIdentity).join('\u241f'),
    label: entry => [entry.role, entry.company, entry.duration].map(normalizeExact).filter(Boolean).join(' · '),
    recordLines: entry => [
      normalizeExact(entry.role),
      normalizeExact(entry.company),
      normalizeExact(entry.duration),
      ...exactList(entry.achievements),
    ],
    compareRecord: (sourceEntry, candidateEntry, path) => {
      const recordChanges: ResumeReviewChange[] = [];
      (['role', 'company', 'duration'] as const).forEach(field => {
        const sourceValue = normalizeExact(sourceEntry[field]);
        const candidateValue = normalizeExact(candidateEntry[field]);
        if (sourceValue !== candidateValue) {
          recordChanges.push(makeChange(
            'experience',
            `${path}.${field}`,
            'needs-review',
            `Review experience ${field}`,
            [sourceValue],
            [candidateValue],
          ));
        }
      });
      const change = classifyBoundList(
        'experience',
        `${path}.achievements`,
        exactList(sourceEntry.achievements),
        exactList(candidateEntry.achievements),
        `Prioritize ${normalizeExact(sourceEntry.role) || 'role'} achievements`,
        `Review ${normalizeExact(sourceEntry.role) || 'role'} achievements`,
      );
      if (change) recordChanges.push(change);
      return recordChanges;
    },
    orderTitle: 'Prioritize source-backed roles',
    recordTitle: 'Review experience record',
  }));

  changes.push(...compareKeyedRecords({
    section: 'education',
    source: source.education || [],
    candidate: candidate.education || [],
    identity: entry => [entry.degree, entry.institution, entry.year].map(normalizeIdentity).join('\u241f'),
    label: entry => [entry.degree, entry.institution, entry.year].map(normalizeExact).filter(Boolean).join(' · '),
    recordLines: entry => [
      normalizeExact(entry.degree),
      normalizeExact(entry.institution),
      normalizeExact(entry.year),
      normalizeExact(entry.details),
    ],
    compareRecord: (sourceEntry, candidateEntry, path) => {
      const recordChanges: ResumeReviewChange[] = [];
      (['degree', 'institution', 'year'] as const).forEach(field => {
        const sourceValue = normalizeExact(sourceEntry[field]);
        const candidateValue = normalizeExact(candidateEntry[field]);
        if (sourceValue !== candidateValue) {
          recordChanges.push(makeChange(
            'education',
            `${path}.${field}`,
            'needs-review',
            `Review education ${field}`,
            [sourceValue],
            [candidateValue],
          ));
        }
      });
      const sourceDetails = normalizeExact(sourceEntry.details);
      const candidateDetails = normalizeExact(candidateEntry.details);
      if (sourceDetails !== candidateDetails) {
        recordChanges.push(makeChange(
          'education',
          `${path}.details`,
          'needs-review',
          `Review ${normalizeExact(sourceEntry.degree) || 'education'} details`,
          [sourceDetails],
          [candidateDetails],
        ));
      }
      return recordChanges;
    },
    orderTitle: 'Reorder education records',
    recordTitle: 'Review education record',
  }));

  changes.push(...compareKeyedRecords({
    section: 'skills',
    source: source.skills || [],
    candidate: candidate.skills || [],
    identity: group => normalizeIdentity(group.category),
    label: group => normalizeExact(group.category),
    recordLines: group => [normalizeExact(group.category), ...exactList(group.items)],
    compareRecord: (sourceGroup, candidateGroup, path) => {
      const recordChanges: ResumeReviewChange[] = [];
      const sourceCategory = normalizeExact(sourceGroup.category);
      const candidateCategory = normalizeExact(candidateGroup.category);
      if (sourceCategory !== candidateCategory) {
        recordChanges.push(makeChange(
          'skills',
          `${path}.category`,
          'needs-review',
          'Review skill category',
          [sourceCategory],
          [candidateCategory],
        ));
      }
      const change = classifyBoundList(
        'skills',
        `${path}.items`,
        exactList(sourceGroup.items),
        exactList(candidateGroup.items),
        `Prioritize ${normalizeExact(sourceGroup.category) || 'skill'} skills`,
        `Review ${normalizeExact(sourceGroup.category) || 'skill'} skills`,
      );
      if (change) recordChanges.push(change);
      return recordChanges;
    },
    orderTitle: 'Reorder skill categories',
    recordTitle: 'Review skill category',
  }));

  const certificationChange = classifyBoundList(
    'certifications',
    'certifications',
    exactList(source.certifications),
    exactList(candidate.certifications),
    'Reorder certifications',
    'Review certification content',
  );
  if (certificationChange) changes.push(certificationChange);

  return { available: true, changes };
}

function cloneResume(resume: ResumeReviewResume): ResumeReviewResume {
  return {
    ...resume,
    experience: (resume.experience || []).map(entry => ({ ...entry, achievements: [...(entry.achievements || [])] })),
    education: (resume.education || []).map(entry => ({ ...entry })),
    skills: (resume.skills || []).map(group => ({ ...group, items: [...(group.items || [])] })),
    certifications: resume.certifications ? [...resume.certifications] : undefined,
  };
}

export function applyResumeReviewDecisions(
  source: ResumeReviewResume,
  candidate: ResumeReviewResume,
  changes: ResumeReviewChange[],
  decisions: Record<string, ResumeReviewDecision>,
): ResumeReviewResume {
  const reviewed = cloneResume(candidate);
  const revertedPaths = new Set(
    changes.filter(change => decisions[change.id] === 'reverted').map(change => change.path),
  );

  (['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website'] as const).forEach(field => {
    if (revertedPaths.has(`identity.${field}`)) {
      (reviewed as unknown as Record<string, unknown>)[field] = source[field];
    }
  });
  if (revertedPaths.has('summary')) reviewed.summary = source.summary;

  function restoreRecords<T>(
    section: 'experience' | 'education' | 'skills',
    sourceRecords: T[],
    candidateRecords: T[],
    identity: (record: T) => string,
    clone: (record: T) => T,
  ): T[] {
    const sourceMap = keyedOccurrences(sourceRecords, identity);
    const candidateMap = keyedOccurrences(candidateRecords, identity);
    const sourceKeys = [...sourceMap.keys()];
    const candidateKeys = [...candidateMap.keys()];
    const resultMap = new Map([...candidateMap].map(([key, record]) => [key, clone(record)]));
    let resultKeys = [...candidateKeys];

    new Set([...sourceKeys, ...candidateKeys]).forEach(key => {
      const recordPath = `${section}.${stableHash(key)}`;
      const shouldRestore = [...revertedPaths].some(path => path === recordPath || path.startsWith(`${recordPath}.`));
      if (!shouldRestore) return;
      const sourceRecord = sourceMap.get(key);
      if (sourceRecord) {
        resultMap.set(key, clone(sourceRecord));
        if (!resultKeys.includes(key)) {
          const sourceIndex = sourceKeys.indexOf(key);
          const nextSourceKey = sourceKeys.slice(sourceIndex + 1).find(nextKey => resultKeys.includes(nextKey));
          const insertAt = nextSourceKey ? resultKeys.indexOf(nextSourceKey) : resultKeys.length;
          resultKeys.splice(insertAt, 0, key);
        }
      } else {
        resultMap.delete(key);
        resultKeys = resultKeys.filter(existingKey => existingKey !== key);
      }
    });

    if (revertedPaths.has(`${section}.order`)) {
      const sourceOrder = sourceKeys.filter(key => resultMap.has(key));
      resultKeys = [...sourceOrder, ...resultKeys.filter(key => !sourceOrder.includes(key))];
    }
    return resultKeys.map(key => resultMap.get(key)).filter((record): record is T => Boolean(record));
  }

  reviewed.experience = restoreRecords(
    'experience',
    source.experience || [],
    candidate.experience || [],
    entry => [entry.role, entry.company, entry.duration].map(normalizeIdentity).join('\u241f'),
    entry => ({ ...entry, achievements: [...(entry.achievements || [])] }),
  );
  reviewed.education = restoreRecords(
    'education',
    source.education || [],
    candidate.education || [],
    entry => [entry.degree, entry.institution, entry.year].map(normalizeIdentity).join('\u241f'),
    entry => ({ ...entry }),
  );
  reviewed.skills = restoreRecords(
    'skills',
    source.skills || [],
    candidate.skills || [],
    group => normalizeIdentity(group.category),
    group => ({ ...group, items: [...(group.items || [])] }),
  );
  if (revertedPaths.has('certifications')) {
    reviewed.certifications = source.certifications ? [...source.certifications] : undefined;
  }
  return reviewed;
}

export function sanitizeResumeReviewState(value: unknown): ResumeReviewState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_RESUME_REVIEW_STATE, decisions: {} };
  const draft = value as Partial<ResumeReviewState>;
  const rawDecisions = draft.decisions && typeof draft.decisions === 'object' ? draft.decisions : {};
  const decisions = Object.fromEntries(
    Object.entries(rawDecisions).filter((entry): entry is [string, ResumeReviewDecision] => (
      entry[1] === 'accepted' || entry[1] === 'reverted'
    )),
  );
  return {
    version: 1,
    decisions,
    selectedId: typeof draft.selectedId === 'string' ? draft.selectedId : null,
    view: draft.view === 'focused' ? 'focused' : 'comparison',
    documentTab: draft.documentTab === 'source' ? 'source' : 'tailored',
  };
}
