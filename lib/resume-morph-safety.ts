export const RESUME_MORPH_DEFAULT_MAX = 80;
export const RESUME_MORPH_FULL_UNLOCK = 100;
export const RESUME_MORPH_CONSENT_VERSION = 'resume-morph-100-v1';

export const RESUME_MORPH_ACKNOWLEDGEMENTS = [
  'I understand that 100% Morph increases rewrite strength, but protected resume facts remain locked.',
  'I understand Talent Studio must not invent degrees, schools, certifications, licenses, employers, job titles, dates, or contact details.',
  'I agree to review every generated resume before using it in an application.',
] as const;

export interface ResumeMorphConsentStatus {
  unlocked100: boolean;
  acceptedAt: string | null;
  consentVersion: string;
  disabledAt?: string | null;
}
