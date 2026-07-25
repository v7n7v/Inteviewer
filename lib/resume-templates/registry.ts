export type ResumeTemplateRenderSurface = 'html' | 'pdf' | 'docx';

export function requireResumeTemplateRegistryEntry<T>(
  registry: Readonly<Record<string, T>>,
  templateId: string,
  surface: ResumeTemplateRenderSurface,
): T {
  if (!Object.prototype.hasOwnProperty.call(registry, templateId)) {
    throw new Error(`Unknown ${surface} resume template: ${templateId}`);
  }

  const entry = registry[templateId];
  if (!entry) {
    throw new Error(`Missing ${surface} resume template renderer: ${templateId}`);
  }
  return entry;
}
