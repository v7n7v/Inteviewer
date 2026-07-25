import type { CanonicalResume } from '@/lib/resume-normalizer';

export interface EditorialImpact {
  metric: string;
  text: string;
  experienceIndex: number;
  achievementIndex: number;
}

const QUANTIFIED_IMPACT_PATTERN =
  /(?:[$£€]\s?\d[\d,.]*(?:\s?(?:k|m|b|thousand|million|billion))?|\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?(?:x|k|m|b|thousand|million|billion)\b)/i;

export function normalizeEditorialImpactText(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}%$£€]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEditorialImpacts(resume: CanonicalResume, limit = 4): EditorialImpact[] {
  if (limit <= 0) return [];

  const impacts: EditorialImpact[] = [];
  const seen = new Set<string>();

  resume.experience.forEach((experience, experienceIndex) => {
    experience.achievements.forEach((rawAchievement, achievementIndex) => {
      const text = rawAchievement.trim();
      const match = text.match(QUANTIFIED_IMPACT_PATTERN);
      const fingerprint = normalizeEditorialImpactText(text);

      if (!text || !match || !fingerprint || seen.has(fingerprint) || impacts.length >= limit) return;

      seen.add(fingerprint);
      impacts.push({
        metric: match[0].replace(/\s+/g, ''),
        text,
        experienceIndex,
        achievementIndex,
      });
    });
  });

  return impacts;
}

export function isEditorialImpactAchievement(text: string, impacts: EditorialImpact[]) {
  const fingerprint = normalizeEditorialImpactText(text);
  return Boolean(fingerprint) && impacts.some(impact => normalizeEditorialImpactText(impact.text) === fingerprint);
}
