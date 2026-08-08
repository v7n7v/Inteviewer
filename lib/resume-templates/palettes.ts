import type { ResumeTemplateMetadata, TemplateColors } from './catalog';
import { getRegisteredTemplate } from './catalog';
import { getContrastSafeTemplateColors } from './persistence';

/**
 * One selectable colourway in the Studio's palette picker.
 *
 * Deliberately NOT the catalog's TemplatePalette, which is a different shape under the
 * same name: that one is { id, name, colors } and requires a background, this one is
 * { id, label, colors, isDefault? } and carries only ink. Reusing the name would have
 * compiled against the wrong contract.
 */
export interface StudioPaletteOption {
  id: string;
  label: string;
  colors: Pick<TemplateColors, 'primary' | 'accent' | 'text'>;
  isDefault?: boolean;
}

/**
 * Colourways offered for each resume template.
 *
 * These are DOCUMENT colours - ink on a page an employer will read - not product UI.
 * They lived inline in app/suite/resume/page.tsx, where they were 85 of that file's
 * ~129 remaining hex literals and the single largest reason it topped the design
 * audit's worst-file list. They belong here, beside the catalog that already exports
 * TemplatePalette and already owns every other per-template colour decision.
 *
 * scripts/design-audit.js excludes lib/resume-templates by path, and the reason it
 * gives applies exactly: "documents rendered for employers, not product UI - they
 * intentionally use their own fonts and palettes." Moving them here is not how the
 * hex count goes down; it is where a reader would look for them.
 *
 * Every colourway is passed through getContrastSafeTemplateColors before render, which
 * enforces 4.5:1 against the document background.
 */
export const TEMPLATE_PALETTE_GROUPS: Record<string, StudioPaletteOption[]> = {
  executive: [
    { id: 'oxford-blue', label: 'Oxford Blue', colors: { primary: '#1e3a5f', accent: '#2b6cb0', text: '#111827' } },
    { id: 'boardroom-teal', label: 'Boardroom Teal', colors: { primary: '#102a43', accent: '#0f766e', text: '#1f2937' } },
    { id: 'charcoal-slate', label: 'Charcoal Slate', colors: { primary: '#1f2937', accent: '#64748b', text: '#111827' } },
    { id: 'evergreen', label: 'Evergreen', colors: { primary: '#064e3b', accent: '#0f766e', text: '#111827' } },
    { id: 'capital-navy', label: 'Capital Navy', colors: { primary: '#172554', accent: '#2563eb', text: '#111827' } },
    { id: 'bronze-ledger', label: 'Bronze Ledger', colors: { primary: '#78350f', accent: '#b45309', text: '#1c1917' } },
    { id: 'executive-ink', label: 'Executive Ink', colors: { primary: '#111827', accent: '#475569', text: '#111827' } },
  ],
  modern: [
    { id: 'teal-signal', label: 'Teal Signal', colors: { primary: '#0f766e', accent: '#14b8a6', text: '#1e293b' } },
    { id: 'cobalt-cyan', label: 'Cobalt Cyan', colors: { primary: '#1d4ed8', accent: '#0891b2', text: '#111827' } },
    { id: 'copper-ink', label: 'Copper Ink', colors: { primary: '#7c2d12', accent: '#ea580c', text: '#1c1917' } },
    { id: 'sage-modern', label: 'Sage Modern', colors: { primary: '#36594f', accent: '#5f7f72', text: '#1f2937' } },
    { id: 'plum-pulse', label: 'Plum Pulse', colors: { primary: '#581c87', accent: '#be185d', text: '#1f2937' } },
    { id: 'graphite-blue', label: 'Graphite Blue', colors: { primary: '#334155', accent: '#2563eb', text: '#111827' } },
    { id: 'emerald-line', label: 'Emerald Line', colors: { primary: '#064e3b', accent: '#10b981', text: '#111827' } },
  ],
  minimal: [
    { id: 'clean-ink', label: 'Clean Ink', colors: { primary: '#111827', accent: '#6b7280', text: '#111827' } },
    { id: 'soft-slate', label: 'Soft Slate', colors: { primary: '#475569', accent: '#94a3b8', text: '#334155' } },
    { id: 'warm-stone', label: 'Warm Stone', colors: { primary: '#44403c', accent: '#78716c', text: '#292524' } },
    { id: 'quiet-teal', label: 'Quiet Teal', colors: { primary: '#134e4a', accent: '#0f766e', text: '#111827' } },
    { id: 'editorial-navy', label: 'Editorial Navy', colors: { primary: '#1e3a5f', accent: '#64748b', text: '#111827' } },
    { id: 'paper-olive', label: 'Paper Olive', colors: { primary: '#3f4f3f', accent: '#6b7f5f', text: '#1f2937' } },
    { id: 'silver-rule', label: 'Silver Rule', colors: { primary: '#374151', accent: '#9ca3af', text: '#111827' } },
  ],
  technical: [
    { id: 'signal-blue', label: 'Signal Blue', colors: { primary: '#0f172a', accent: '#2563eb', text: '#111827' } },
    { id: 'terminal-green', label: 'Terminal Green', colors: { primary: '#1f2937', accent: '#059669', text: '#111827' } },
    { id: 'systems-teal', label: 'Systems Teal', colors: { primary: '#134e4a', accent: '#0f766e', text: '#111827' } },
    { id: 'data-indigo', label: 'Data Indigo', colors: { primary: '#312e81', accent: '#4f46e5', text: '#111827' } },
    { id: 'cloud-cyan', label: 'Cloud Cyan', colors: { primary: '#164e63', accent: '#0891b2', text: '#111827' } },
    { id: 'security-navy', label: 'Security Navy', colors: { primary: '#172554', accent: '#1d4ed8', text: '#0f172a' } },
    { id: 'operator-slate', label: 'Operator Slate', colors: { primary: '#334155', accent: '#0ea5e9', text: '#111827' } },
  ],
  creative: [
    { id: 'plum-editorial', label: 'Plum Editorial', colors: { primary: '#581c87', accent: '#be185d', text: '#1f2937' } },
    { id: 'violet-studio', label: 'Violet Studio', colors: { primary: '#6d28d9', accent: '#8b5cf6', text: '#1f2937' } },
    { id: 'ocean-studio', label: 'Ocean Studio', colors: { primary: '#0f766e', accent: '#0891b2', text: '#111827' } },
    { id: 'ember-creative', label: 'Ember Creative', colors: { primary: '#7c2d12', accent: '#ea580c', text: '#1c1917' } },
    { id: 'rose-ink', label: 'Rose Ink', colors: { primary: '#831843', accent: '#be185d', text: '#1f2937' } },
    { id: 'blueprint', label: 'Blueprint', colors: { primary: '#1e40af', accent: '#3b82f6', text: '#1e293b' } },
    { id: 'forest-story', label: 'Forest Story', colors: { primary: '#14532d', accent: '#16a34a', text: '#1f2937' } },
  ],
  traditional: [
    { id: 'burgundy-review', label: 'Burgundy Review', colors: { primary: '#7f1d1d', accent: '#b91c1c', text: '#1c1917' } },
    { id: 'cambridge-blue', label: 'Cambridge Blue', colors: { primary: '#1e3a5f', accent: '#475569', text: '#111827' } },
    { id: 'library-ink', label: 'Library Ink', colors: { primary: '#111827', accent: '#6b7280', text: '#111827' } },
    { id: 'federal-navy', label: 'Federal Navy', colors: { primary: '#1e3a5f', accent: '#1d4ed8', text: '#111827' } },
    { id: 'academic-copper', label: 'Academic Copper', colors: { primary: '#7c2d12', accent: '#c2410c', text: '#1c1917' } },
    { id: 'honors-green', label: 'Honors Green', colors: { primary: '#14532d', accent: '#15803d', text: '#111827' } },
    { id: 'archive-slate', label: 'Archive Slate', colors: { primary: '#334155', accent: '#64748b', text: '#111827' } },
  ],
};

export function getTemplatePaletteGroup(templateId: string) {
  const category = getRegisteredTemplate(templateId)?.paletteGroup;
  if (category && ['executive', 'strategy', 'finance'].includes(category)) return 'executive';
  if (category && ['product', 'nonprofit', 'sales', 'transition', 'early-career'].includes(category)) return 'modern';
  if (category && ['technical', 'data'].includes(category)) return 'technical';
  if (category && ['legal', 'healthcare', 'academic', 'public-sector'].includes(category)) return 'traditional';
  if (category && ['creative', 'design', 'editorial'].includes(category)) return 'creative';
  if (['editorial-authority', 'executive', 'boardroom', 'deloitte', 'finance-ledger'].includes(templateId)) return 'executive';
  if (['modern', 'product-brief', 'infographic', 'startup', 'venture'].includes(templateId)) return 'modern';
  if (['minimal', 'compact', 'elegant', 'nordic'].includes(templateId)) return 'minimal';
  if (['technical-signal', 'technical', 'operator', 'data-signal', 'faang', 'ats-optimized', 'double-column'].includes(templateId)) return 'technical';
  if (['harvard', 'academic', 'federal'].includes(templateId)) return 'traditional';
  return 'creative';
}

export function getDefaultPaletteId(_templateId: string) {
  return 'classic';
}

export function getTemplatePalettes(template: ResumeTemplateMetadata): StudioPaletteOption[] {
  const group = getTemplatePaletteGroup(template.id);
  return [
    { id: getDefaultPaletteId(template.id), label: 'Classic', colors: template.colors, isDefault: true },
    ...TEMPLATE_PALETTE_GROUPS[group],
  ].slice(0, 8);
}

export function getTemplatePalette(template: ResumeTemplateMetadata, paletteId?: string) {
  const palettes = getTemplatePalettes(template);
  return palettes.find(palette => palette.id === paletteId) || palettes[0];
}

export function getTemplateWithPalette(template: ResumeTemplateMetadata, paletteId?: string) {
  const palette = getTemplatePalette(template, paletteId);
  return {
    ...template,
    colors: getContrastSafeTemplateColors({
      ...template.colors,
      ...palette.colors,
      background: template.colors.background || '#ffffff',
    }, template.colors),
  };
}