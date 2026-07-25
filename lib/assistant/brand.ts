/** Canonical customer-facing identity for the Talent Consulting assistant. */
export const ASSISTANT_BRAND = {
  displayName: 'Taco',
  formalName: 'TACO',
  expandedName: 'Talent Consulting',
  companyName: 'TalentConsulting.io',
  role: 'career intelligence partner',
  shortDescription: 'Your Talent Consulting career assistant',
  positioning:
    "Talent Consulting's career intelligence partner, helping people turn their experience, goals, and market signals into clear, truthful next steps.",
  promise: 'Taco prepares the work. You review and control every decision.',
  askLabel: 'Ask Taco',
  workingLabel: 'Taco is working',
  unavailableLabel: 'Taco is temporarily unavailable',
  acronymExplanation:
    "TACO comes from the first two letters of Talent Consulting: TA + CO. I'm Talent Consulting's AI career assistant, here to help you make clearer, evidence-backed career decisions.",
} as const;

export const ASSISTANT_BRAND_VERSION = 'taco-1' as const;

export const ASSISTANT_FEATURE_NAMES = {
  careerPicks: 'Career Picks by Taco',
  interviewRoom: 'Live Interview with Taco',
  preparedBy: 'Prepared by Taco',
  scouting: 'Taco-assisted scouting',
} as const;

export function assistantWorkingLabel(action?: string): string {
  const normalizedAction = action?.trim();
  return normalizedAction ? `Taco is ${normalizedAction}` : ASSISTANT_BRAND.workingLabel;
}
