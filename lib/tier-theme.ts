/**
 * Tier Theme Engine — Mode-Neutral Color System
 *
 * Provides curated accent palettes for Free / Pro / Studio tiers.
 * Uses dual accent text colors (light-safe & dark-safe) to guarantee
 * readability in both modes without any forceDark hacks.
 */

export interface TierTheme {
  /** Primary accent — avatar gradient start, badge bg, progress bar */
  accent: string;
  /** Secondary accent — avatar gradient end, orb color */
  accentAlt: string;
  /** Light-mode safe accent for text (darker shade, reads on white) */
  accentText: string;
  /** Dark-mode accent for text (brighter shade, reads on dark) */
  accentTextDark: string;
  /** Display label */
  label: 'FREE' | 'PRO' | 'MAX';
  /** Visual intensity multiplier — controls orb opacity, border glow, shadow spread */
  intensity: number;
  /** Whether to show shimmer animation on badge */
  shimmer: boolean;
}

export function getTierTheme(tier: string): TierTheme {
  switch (tier) {
    case 'studio':
    case 'god':
    case 'max':
      return {
        accent: '#f59e0b',
        accentAlt: '#fbbf24',
        accentText: '#92400e',
        accentTextDark: '#fcd34d',
        label: 'MAX',
        intensity: 2,
        shimmer: true,
      };
    case 'pro':
      return {
        accent: '#8b5cf6',
        accentAlt: '#a78bfa',
        accentText: '#6d28d9',
        accentTextDark: '#c4b5fd',
        label: 'PRO',
        intensity: 1.5,
        shimmer: true,
      };
    default:
      return {
        accent: '#0ea5e9',
        accentAlt: '#38bdf8',
        accentText: '#0369a1',
        accentTextDark: '#7dd3fc',
        label: 'FREE',
        intensity: 1,
        shimmer: false,
      };
  }
}
