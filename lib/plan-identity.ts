export type PlanIdentityTier = 'free' | 'pro' | 'studio' | 'god' | 'max' | string | null | undefined;
export type CanonicalPlanTier = 'free' | 'pro' | 'studio';

export interface PlanFeature {
  icon: string;
  label: string;
  description: string;
}

export interface PlanIdentity {
  id: CanonicalPlanTier;
  label: 'FREE' | 'PRO' | 'MAX';
  displayName: string;
  shortName: string;
  eyebrow: string;
  description: string;
  activeDescription: string;
  icon: string;
  accent: string;
  accentAlt: string;
  accentSoft: string;
  accentText: string;
  accentTextDark: string;
  border: string;
  surface: string;
  buttonText: string;
  features: PlanFeature[];
  primaryAction: string;
  secondaryAction: string;
  upgradeHref: string;
  shimmer: boolean;
}

const FREE_ACCENT = 'oklch(0.64 0.025 255)';
const FREE_ALT = 'oklch(0.8 0.018 250)';
const PRO_ACCENT = 'oklch(0.66 0.15 165)';
const PRO_ALT = 'oklch(0.72 0.12 205)';
const MAX_ACCENT = 'oklch(0.77 0.13 78)';
const MAX_ALT = 'oklch(0.7 0.11 58)';

export function normalizePlanTier(tier: PlanIdentityTier): CanonicalPlanTier {
  if (tier === 'studio' || tier === 'god' || tier === 'max') return 'studio';
  if (tier === 'pro') return 'pro';
  return 'free';
}

export const PLAN_IDENTITIES: Record<CanonicalPlanTier, PlanIdentity> = {
  free: {
    id: 'free',
    label: 'FREE',
    displayName: 'Free Workspace',
    shortName: 'Free',
    eyebrow: 'Started workspace',
    description: 'Build with free career checks. Save more workflows with Pro.',
    activeDescription: 'Your free workspace is ready for checks, drafts, and exploration.',
    icon: 'local_activity',
    accent: FREE_ACCENT,
    accentAlt: FREE_ALT,
    accentSoft: `color-mix(in srgb, ${FREE_ACCENT} 12%, var(--bg-elevated))`,
    accentText: 'oklch(0.42 0.035 255)',
    accentTextDark: 'oklch(0.82 0.025 255)',
    border: `color-mix(in srgb, ${FREE_ACCENT} 25%, var(--border-subtle))`,
    surface: `linear-gradient(145deg, color-mix(in srgb, ${FREE_ACCENT} 9%, var(--card-bg)), color-mix(in srgb, ${FREE_ALT} 4%, var(--card-bg)))`,
    buttonText: 'oklch(0.17 0.015 255)',
    features: [
      { icon: 'fact_check', label: 'Free career checks', description: 'Try ATS, writing trust, and readiness checks.' },
      { icon: 'edit_note', label: 'Starter writing tools', description: 'Polish small drafts and recruiter replies.' },
      { icon: 'history', label: 'Account-ready path', description: 'Upgrade when you want saved history and larger caps.' },
    ],
    primaryAction: 'View Pro / Max',
    secondaryAction: 'Compare plans',
    upgradeHref: '/suite/upgrade',
    shimmer: false,
  },
  pro: {
    id: 'pro',
    label: 'PRO',
    displayName: 'Talent Pro',
    shortName: 'Pro',
    eyebrow: 'Core career tools',
    description: 'Core career tools with higher limits, faster AI, and a cleaner workflow.',
    activeDescription: 'Core career tools unlocked for active resumes, applications, and prep.',
    icon: 'workspace_premium',
    accent: PRO_ACCENT,
    accentAlt: PRO_ALT,
    accentSoft: `color-mix(in srgb, ${PRO_ACCENT} 14%, var(--bg-elevated))`,
    accentText: 'oklch(0.42 0.14 165)',
    accentTextDark: 'oklch(0.82 0.13 165)',
    border: `color-mix(in srgb, ${PRO_ACCENT} 28%, var(--border-subtle))`,
    surface: `linear-gradient(145deg, color-mix(in srgb, ${PRO_ACCENT} 10%, var(--card-bg)), color-mix(in srgb, ${PRO_ALT} 5%, var(--card-bg)))`,
    buttonText: 'oklch(0.14 0.03 170)',
    features: [
      { icon: 'auto_awesome', label: 'Resume morphing', description: 'Higher limits for job-specific tailoring.' },
      { icon: 'mic', label: 'Interview practice', description: 'More sessions with AI feedback and prep.' },
      { icon: 'route', label: 'Priority workflows', description: 'Skill Bridge, Oracle, writing, and exports.' },
    ],
    primaryAction: 'Start Pro',
    secondaryAction: 'Explore Max',
    upgradeHref: '/suite/upgrade?plan=pro',
    shimmer: true,
  },
  studio: {
    id: 'studio',
    label: 'MAX',
    displayName: 'Talent Max',
    shortName: 'Max',
    eyebrow: 'Career command center',
    description: 'Sona, higher writing limits, proactive insights, and full workflow continuity.',
    activeDescription: 'Your career command center is active with Sona and higher-limit workflows.',
    icon: 'diamond',
    accent: MAX_ACCENT,
    accentAlt: MAX_ALT,
    accentSoft: `color-mix(in srgb, ${MAX_ACCENT} 15%, var(--bg-elevated))`,
    accentText: 'oklch(0.45 0.12 65)',
    accentTextDark: 'oklch(0.86 0.12 78)',
    border: `color-mix(in srgb, ${MAX_ACCENT} 34%, var(--border-subtle))`,
    surface: `linear-gradient(145deg, color-mix(in srgb, ${MAX_ACCENT} 12%, var(--card-bg)), color-mix(in srgb, ${MAX_ALT} 6%, var(--card-bg)))`,
    buttonText: 'oklch(0.17 0.03 75)',
    features: [
      { icon: 'smart_toy', label: 'Sona career agent', description: 'Context-aware help between applications.' },
      { icon: 'ink_pen', label: 'Higher writing limits', description: 'More room for humanizer and trust checks.' },
      { icon: 'radar', label: 'Proactive momentum', description: 'Insights, follow-ups, and saved context.' },
    ],
    primaryAction: 'Unlock Max',
    secondaryAction: 'Manage billing',
    upgradeHref: '/suite/upgrade?plan=studio',
    shimmer: true,
  },
};

export function getPlanIdentity(tier: PlanIdentityTier): PlanIdentity {
  return PLAN_IDENTITIES[normalizePlanTier(tier)];
}

export function planAccentForTheme(plan: PlanIdentity, theme: 'light' | 'dark') {
  return theme === 'light' ? plan.accentText : plan.accentTextDark;
}
