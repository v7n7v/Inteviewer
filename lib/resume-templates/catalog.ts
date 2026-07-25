export type TemplateId = string;
export type TemplateTier = 'free' | 'pro';
export type AtsClassification = 'ATS-first' | 'ATS-conscious' | 'Human-first';
export type TemplateColumns = 1 | 2;

export interface TemplateColors {
  primary: string;
  accent: string;
  text: string;
  background: string;
}

export interface TemplatePalette {
  id: string;
  name: string;
  colors: TemplateColors;
}

export interface TemplateExportProfile {
  pdf: 'linear' | 'designed';
  docx: 'linear';
  printSafe: boolean;
}

export interface TemplateRendererKeys {
  html: string;
  pdf: string;
  docx: string;
}

export interface TemplateStructure {
  family: string;
  columns: TemplateColumns;
  headerGeometry: string;
  sectionOrder: readonly string[];
  density: 'compact' | 'balanced' | 'spacious';
  ruleSystem: string;
  experienceTreatment: string;
  skillsTreatment: string;
  typography: string;
  decorativeSystem: string;
  contactTreatment: string;
}

export interface ResumeTemplateMetadata {
  id: TemplateId;
  slug: string;
  aliases: readonly string[];
  name: string;
  description: string;
  audience: readonly string[];
  tier: TemplateTier;
  selectable: boolean;
  legacy: boolean;
  release: string;
  category: string;
  filterTags: readonly string[];
  recommendationSignals: readonly string[];
  roleFixture: string;
  paletteGroup: string;
  palette: TemplatePalette;
  thumbnail?: string;
  icon: string;
  colors: TemplateColors;
  accentDecorativeOnly: boolean;
  atsClassification: AtsClassification;
  atsLimitation: string;
  exportProfile: TemplateExportProfile;
  rendererKeys: TemplateRendererKeys;
  linearDocxCompanionKey: string;
  structure: TemplateStructure;
}

const RELEASE = '2026.07';
export const ENABLE_NEW_RESUME_SIGNATURES_BY_DEFAULT = true;

const CURRENT_SIGNATURE_IDS = [
  'editorial-authority',
  'technical-signal',
  'brutalist-voltage',
] as const;

export const NEW_SIGNATURE_TEMPLATE_IDS = [
  'executive-ledger',
  'strategy-brief',
  'product-signal',
  'engineering-core',
  'data-evidence',
  'finance-standard',
  'legal-brief',
  'healthcare-precision',
  'academic-profile',
  'public-service',
  'mission-impact',
  'career-pivot',
  'emerging-professional',
  'sales-momentum',
  'creative-director',
  'architectural-grid',
  'editorial-signature',
] as const;

export const LEGACY_TEMPLATE_IDS = [
  'executive', 'modern', 'minimal', 'compact', 'technical', 'boardroom',
  'product-brief', 'creative', 'harvard', 'cascade', 'elegant', 'nordic',
  'ats-optimized', 'double-column', 'infographic', 'deloitte', 'faang',
  'startup', 'federal', 'academic', 'operator', 'data-signal',
  'finance-ledger', 'storyline', 'venture',
] as const;

const colors = (primary: string, accent: string, text = '#172033'): TemplateColors => ({
  primary, accent, text, background: '#ffffff',
});

function relativeLuminance(hex: string): number {
  const channels = hex.replace('#', '').match(/.{2}/g);
  if (!channels || channels.length !== 3) return 0;
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function getContrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function makeSignature(input: {
  id: string;
  name: string;
  description: string;
  audience: readonly string[];
  category: string;
  tags: readonly string[];
  signals: readonly string[];
  fixture: string;
  icon: string;
  ats: AtsClassification;
  columns: TemplateColumns;
  limitation: string;
  colors: TemplateColors;
  family: string;
  header: string;
  order: readonly string[];
  density: TemplateStructure['density'];
  rules: string;
  experience: string;
  skills: string;
  typography: string;
  decoration: string;
  contact: string;
  tier?: TemplateTier;
  release?: string;
  thumbnail?: string;
}): ResumeTemplateMetadata {
  return {
    id: input.id,
    slug: input.id,
    aliases: [],
    name: input.name,
    description: input.description,
    audience: input.audience,
    tier: input.tier ?? 'pro',
    selectable: true,
    legacy: false,
    release: input.release ?? RELEASE,
    category: input.category,
    filterTags: input.tags,
    recommendationSignals: input.signals,
    roleFixture: input.fixture,
    paletteGroup: input.category,
    palette: { id: `${input.id}-classic`, name: 'Classic', colors: input.colors },
    ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
    icon: input.icon,
    colors: input.colors,
    accentDecorativeOnly: true,
    atsClassification: input.ats,
    atsLimitation: input.limitation,
    exportProfile: {
      pdf: input.columns === 2 ? 'designed' : 'linear',
      docx: 'linear',
      printSafe: true,
    },
    rendererKeys: {
      html: `${input.id}:html`,
      pdf: `${input.id}:pdf`,
      docx: `${input.id}:linear-docx`,
    },
    linearDocxCompanionKey: `${input.id}:linear-docx`,
    structure: {
      family: input.family,
      columns: input.columns,
      headerGeometry: input.header,
      sectionOrder: input.order,
      density: input.density,
      ruleSystem: input.rules,
      experienceTreatment: input.experience,
      skillsTreatment: input.skills,
      typography: input.typography,
      decorativeSystem: input.decoration,
      contactTreatment: input.contact,
    },
  };
}

const conventionalOrder = ['Summary', 'Experience', 'Skills', 'Education'] as const;

const currentSignatures: ResumeTemplateMetadata[] = [
  makeSignature({
    id: 'editorial-authority', name: 'Editorial Authority',
    description: 'Human-first executive editorial with a matching PDF and linear Word companion',
    audience: ['executives', 'communications leaders'], category: 'executive',
    tags: ['leadership', 'editorial'], signals: ['chief', 'executive', 'communications'],
    fixture: 'Chief Communications Officer', icon: 'newspaper', ats: 'Human-first', columns: 2,
    limitation: 'Multi-column editorial composition is best submitted as its linear DOCX companion.',
    colors: colors('#082c4c', '#1646b8', '#10213a'), family: 'editorial-broadsheet',
    header: 'masthead', order: conventionalOrder, density: 'balanced', rules: 'column-rules',
    experience: 'editorial-cases', skills: 'sidebar-index', typography: 'serif-sans',
    decoration: 'folio-lines', contact: 'masthead-strip', tier: 'free',
    release: 'signature-v1', thumbnail: '/resume-templates/editorial-authority-reference.png',
  }),
  makeSignature({
    id: 'technical-signal', name: 'Technical Signal',
    description: 'Elegant evidence-led engineering layout with clean monospaced hierarchy',
    audience: ['engineers', 'data leaders'], category: 'technical',
    tags: ['technical', 'data', 'ats'], signals: ['engineer', 'developer', 'data', 'platform'],
    fixture: 'Staff Platform Engineer', icon: 'data_object', ats: 'ATS-conscious', columns: 1,
    limitation: 'Monospaced accents are decorative; all content remains linear.',
    colors: colors('#111111', '#1647ff', '#111111'), family: 'technical-console',
    header: 'command-line', order: conventionalOrder, density: 'compact', rules: 'syntax-rules',
    experience: 'evidence-log', skills: 'keyword-matrix', typography: 'mono-sans',
    decoration: 'prompt-marks', contact: 'inline-command', tier: 'free',
    release: 'signature-v1', thumbnail: '/resume-templates/technical-signal-reference.png',
  }),
  makeSignature({
    id: 'brutalist-voltage', name: 'Brutalist Voltage',
    description: 'Brutally vibrant creative layout for brand, culture, and growth leaders',
    audience: ['creative leaders', 'growth leaders'], category: 'creative',
    tags: ['creative', 'brand', 'growth'], signals: ['creative', 'brand', 'growth', 'culture'],
    fixture: 'VP Brand and Creative', icon: 'electric_bolt', ats: 'Human-first', columns: 2,
    limitation: 'Expressive blocks require the linear DOCX companion for strict parsers.',
    colors: colors('#123be8', '#ff4a36', '#090909'), family: 'brutalist-poster',
    header: 'oversized-banner', order: conventionalOrder, density: 'spacious', rules: 'heavy-bars',
    experience: 'campaign-blocks', skills: 'signal-chips', typography: 'grotesk-display',
    decoration: 'voltage-blocks', contact: 'edge-labels', tier: 'free',
    release: 'signature-v1', thumbnail: '/resume-templates/brutalist-voltage-reference.png',
  }),
];

const newSignatures: ResumeTemplateMetadata[] = [
  makeSignature({ id: 'executive-ledger', name: 'Executive Ledger', description: 'A disciplined record of enterprise scope and board-level outcomes.', audience: ['C-suite', 'general managers'], category: 'executive', tags: ['leadership', 'ats', 'enterprise'], signals: ['ceo', 'president', 'general manager', 'p&l'], fixture: 'Division President P&L', icon: 'leaderboard', ats: 'ATS-first', columns: 1, limitation: 'Avoid replacing standard headings with board-specific jargon.', colors: colors('#17324d', '#9b7a3d'), family: 'ledger', header: 'left-ledger', order: conventionalOrder, density: 'balanced', rules: 'ledger-lines', experience: 'scope-impact', skills: 'competency-line', typography: 'transitional-sans', decoration: 'hairline-ledger', contact: 'single-line' }),
  makeSignature({ id: 'strategy-brief', name: 'Strategy Brief', description: 'Consulting-style clarity for recommendations, transformations, and impact.', audience: ['consultants', 'strategy leaders'], category: 'strategy', tags: ['consulting', 'strategy', 'ats'], signals: ['strategy', 'consultant', 'transformation', 'market'], fixture: 'Corporate Strategy Director', icon: 'assignment', ats: 'ATS-first', columns: 1, limitation: 'Keep case summaries concise to preserve one-column scanning.', colors: colors('#243b53', '#0e7490'), family: 'brief', header: 'memo-block', order: conventionalOrder, density: 'compact', rules: 'memo-dividers', experience: 'case-briefs', skills: 'capability-list', typography: 'neo-grotesk', decoration: 'brief-markers', contact: 'memo-line' }),
  makeSignature({ id: 'product-signal', name: 'Product Signal', description: 'Outcome-led product narrative centered on discovery, launches, and adoption.', audience: ['product managers', 'program leaders'], category: 'product', tags: ['product', 'growth', 'ats'], signals: ['product manager', 'roadmap', 'launch', 'adoption'], fixture: 'Senior Product Manager Growth', icon: 'view_quilt', ats: 'ATS-first', columns: 1, limitation: 'Use plain-text metrics rather than charts.', colors: colors('#1e3a8a', '#06b6d4'), family: 'product-canvas', header: 'outcome-banner', order: conventionalOrder, density: 'balanced', rules: 'signal-tabs', experience: 'outcome-cards', skills: 'product-stack', typography: 'humanist-sans', decoration: 'signal-dots', contact: 'compact-row' }),
  makeSignature({ id: 'engineering-core', name: 'Engineering Core', description: 'A durable technical record for systems, delivery, and engineering influence.', audience: ['software engineers', 'engineering managers'], category: 'technical', tags: ['engineering', 'technical', 'ats'], signals: ['software engineer', 'engineering manager', 'distributed systems', 'backend'], fixture: 'Principal Backend Engineer', icon: 'memory', ats: 'ATS-first', columns: 1, limitation: 'Reserve code notation for labels, not substantive content.', colors: colors('#111827', '#2563eb'), family: 'engineering-spec', header: 'specification-line', order: conventionalOrder, density: 'compact', rules: 'spec-rules', experience: 'system-impact', skills: 'technology-groups', typography: 'sans-mono', decoration: 'version-marks', contact: 'protocol-row' }),
  makeSignature({ id: 'data-evidence', name: 'Data Evidence', description: 'Analytical proof for data science, analytics, and AI leadership.', audience: ['data scientists', 'analytics leaders'], category: 'data', tags: ['data', 'ai', 'ats'], signals: ['data scientist', 'machine learning', 'analytics', 'artificial intelligence'], fixture: 'Lead Machine Learning Scientist', icon: 'query_stats', ats: 'ATS-first', columns: 1, limitation: 'Describe model results in text; embedded plots are excluded.', colors: colors('#172554', '#7c3aed'), family: 'evidence-paper', header: 'abstract-header', order: conventionalOrder, density: 'balanced', rules: 'evidence-rules', experience: 'hypothesis-results', skills: 'methods-index', typography: 'scientific-sans', decoration: 'evidence-numbers', contact: 'citation-line' }),
  makeSignature({ id: 'finance-standard', name: 'Finance Standard', description: 'Measured presentation of transactions, controls, and financial performance.', audience: ['finance professionals', 'bankers'], category: 'finance', tags: ['finance', 'banking', 'ats'], signals: ['finance', 'investment banking', 'fp&a', 'controller'], fixture: 'Investment Banking Vice President', icon: 'account_balance', ats: 'ATS-first', columns: 1, limitation: 'Tables are represented as linear metric statements.', colors: colors('#064e3b', '#a16207'), family: 'financial-statement', header: 'statement-title', order: conventionalOrder, density: 'compact', rules: 'double-entry-rules', experience: 'transaction-record', skills: 'finance-coverage', typography: 'financial-serif', decoration: 'accounting-lines', contact: 'statement-row' }),
  makeSignature({ id: 'legal-brief', name: 'Legal Brief', description: 'Precise advocacy for matters, counsel, and regulatory expertise.', audience: ['attorneys', 'legal leaders'], category: 'legal', tags: ['legal', 'compliance', 'ats'], signals: ['attorney', 'counsel', 'legal', 'regulatory'], fixture: 'Senior Regulatory Counsel', icon: 'gavel', ats: 'ATS-first', columns: 1, limitation: 'Matter details must avoid confidential client information.', colors: colors('#312e81', '#92400e'), family: 'legal-pleading', header: 'caption-header', order: conventionalOrder, density: 'balanced', rules: 'pleading-rules', experience: 'matter-outcomes', skills: 'practice-areas', typography: 'legal-serif', decoration: 'caption-lines', contact: 'caption-row' }),
  makeSignature({ id: 'healthcare-precision', name: 'Healthcare Precision', description: 'Credential-forward clarity for clinical, operational, and care leadership.', audience: ['clinicians', 'healthcare leaders'], category: 'healthcare', tags: ['healthcare', 'clinical', 'ats'], signals: ['healthcare', 'clinical', 'nurse', 'physician'], fixture: 'Director of Clinical Operations', icon: 'medical_services', ats: 'ATS-first', columns: 1, limitation: 'Use credential abbreviations alongside their full names.', colors: colors('#075985', '#0f766e'), family: 'clinical-chart', header: 'credential-band', order: conventionalOrder, density: 'balanced', rules: 'clinical-rules', experience: 'care-impact', skills: 'credential-list', typography: 'clinical-sans', decoration: 'precision-marks', contact: 'credential-row' }),
  makeSignature({ id: 'academic-profile', name: 'Academic Profile', description: 'Research-centered profile balancing scholarship, teaching, and service.', audience: ['faculty', 'researchers'], category: 'academic', tags: ['academic', 'research'], signals: ['professor', 'researcher', 'publications', 'faculty'], fixture: 'Associate Professor Computational Biology', icon: 'school', ats: 'ATS-conscious', columns: 2, limitation: 'Two-column supporting details may need the linear export for older systems.', colors: colors('#7f1d1d', '#b45309'), family: 'scholarly-journal', header: 'journal-masthead', order: ['Summary', 'Education', 'Experience', 'Skills'], density: 'spacious', rules: 'citation-rules', experience: 'scholarship-streams', skills: 'methods-sidebar', typography: 'scholarly-serif', decoration: 'citation-folios', contact: 'affiliation-block' }),
  makeSignature({ id: 'public-service', name: 'Public Service', description: 'Plain-language federal and civic experience with accountability at the center.', audience: ['government professionals', 'civic leaders'], category: 'public-sector', tags: ['government', 'public-service', 'ats'], signals: ['government', 'federal', 'public policy', 'civil service'], fixture: 'Federal Program Manager', icon: 'account_balance', ats: 'ATS-first', columns: 1, limitation: 'Include required federal detail without relying on custom labels.', colors: colors('#1e3a5f', '#b91c1c'), family: 'civic-record', header: 'agency-line', order: conventionalOrder, density: 'compact', rules: 'civic-rules', experience: 'accountability-record', skills: 'qualification-list', typography: 'civic-sans', decoration: 'service-seal-line', contact: 'federal-detail-row' }),
  makeSignature({ id: 'mission-impact', name: 'Mission Impact', description: 'Evidence-led nonprofit story connecting programs, funding, and communities.', audience: ['nonprofit leaders', 'foundation professionals'], category: 'nonprofit', tags: ['nonprofit', 'mission', 'ats'], signals: ['nonprofit', 'foundation', 'fundraising', 'community'], fixture: 'Nonprofit Executive Director', icon: 'volunteer_activism', ats: 'ATS-first', columns: 1, limitation: 'Impact measures should be written as text rather than infographics.', colors: colors('#365314', '#c2410c'), family: 'impact-report', header: 'mission-statement', order: conventionalOrder, density: 'balanced', rules: 'impact-rules', experience: 'program-impact', skills: 'mission-capabilities', typography: 'warm-sans', decoration: 'impact-marks', contact: 'mission-row' }),
  makeSignature({ id: 'career-pivot', name: 'Career Pivot', description: 'A transferable-skills bridge for candidates moving into a new field.', audience: ['career changers', 'returning professionals'], category: 'transition', tags: ['career-change', 'transferable-skills'], signals: ['career change', 'pivot', 'transition', 'returning'], fixture: 'Operations Leader Pivoting to Product', icon: 'sync_alt', ats: 'ATS-conscious', columns: 2, limitation: 'The skills bridge uses two columns in designed exports.', colors: colors('#4c1d95', '#0e7490'), family: 'bridge', header: 'transition-arc', order: ['Summary', 'Skills', 'Experience', 'Education'], density: 'balanced', rules: 'bridge-rules', experience: 'transferable-evidence', skills: 'bridge-columns', typography: 'approachable-sans', decoration: 'transition-arrows', contact: 'centered-stack' }),
  makeSignature({ id: 'emerging-professional', name: 'Emerging Professional', description: 'Potential-forward structure for internships, projects, and first roles.', audience: ['students', 'early-career candidates'], category: 'early-career', tags: ['entry-level', 'student', 'ats'], signals: ['intern', 'graduate', 'entry level', 'student'], fixture: 'New Graduate Business Analyst', icon: 'rocket_launch', ats: 'ATS-first', columns: 1, limitation: 'Keep projects outcome-oriented and use standard section names.', colors: colors('#1d4ed8', '#059669'), family: 'launchpad', header: 'identity-line', order: conventionalOrder, density: 'balanced', rules: 'launch-rules', experience: 'project-first-evidence', skills: 'foundation-list', typography: 'modern-sans', decoration: 'milestone-dots', contact: 'simple-row' }),
  makeSignature({ id: 'sales-momentum', name: 'Sales Momentum', description: 'Quota, pipeline, and market expansion presented with direct momentum.', audience: ['sales leaders', 'account executives'], category: 'sales', tags: ['sales', 'revenue', 'ats'], signals: ['sales', 'account executive', 'quota', 'revenue'], fixture: 'Enterprise Account Executive', icon: 'trending_up', ats: 'ATS-first', columns: 1, limitation: 'Express performance as text metrics, not charts or gauges.', colors: colors('#7c2d12', '#ea580c'), family: 'revenue-scorecard', header: 'quota-line', order: conventionalOrder, density: 'compact', rules: 'momentum-rules', experience: 'quota-results', skills: 'market-coverage', typography: 'commercial-sans', decoration: 'momentum-ticks', contact: 'territory-row' }),
  makeSignature({ id: 'creative-director', name: 'Creative Director', description: 'Portfolio-minded storytelling for creative vision and team leadership.', audience: ['creative directors', 'design leaders'], category: 'creative', tags: ['creative', 'portfolio', 'leadership'], signals: ['creative director', 'art director', 'design leadership', 'portfolio'], fixture: 'Global Creative Director', icon: 'palette', ats: 'Human-first', columns: 2, limitation: 'The designed PDF prioritizes human review; use linear DOCX for ATS submission.', colors: colors('#18181b', '#e11d48'), family: 'portfolio-spread', header: 'gallery-title', order: conventionalOrder, density: 'spacious', rules: 'gallery-rules', experience: 'project-spreads', skills: 'discipline-sidebar', typography: 'display-editorial', decoration: 'portfolio-frames', contact: 'portfolio-caption' }),
  makeSignature({ id: 'architectural-grid', name: 'Architectural Grid', description: 'Structured project practice for architecture, planning, and built environments.', audience: ['architects', 'urban designers'], category: 'design', tags: ['architecture', 'projects', 'design'], signals: ['architect', 'urban design', 'built environment', 'planning'], fixture: 'Senior Project Architect', icon: 'grid_view', ats: 'ATS-conscious', columns: 2, limitation: 'Project-grid reading order is simplified in the linear export.', colors: colors('#334155', '#b45309'), family: 'architectural-sheet', header: 'title-block', order: conventionalOrder, density: 'balanced', rules: 'drawing-grid', experience: 'project-sheets', skills: 'practice-sidebar', typography: 'architectural-grotesk', decoration: 'registration-marks', contact: 'title-block-details' }),
  makeSignature({ id: 'editorial-signature', name: 'Editorial Signature', description: 'Distinctive long-form voice for writers, editors, and content strategists.', audience: ['editors', 'writers'], category: 'editorial', tags: ['editorial', 'writing', 'portfolio'], signals: ['editor', 'writer', 'content strategy', 'journalism'], fixture: 'Executive Editor Digital Media', icon: 'edit_note', ats: 'Human-first', columns: 2, limitation: 'The publication-style PDF should be paired with linear DOCX for ATS portals.', colors: colors('#3f3f46', '#be123c'), family: 'literary-review', header: 'byline-masthead', order: conventionalOrder, density: 'spacious', rules: 'editorial-rules', experience: 'publication-features', skills: 'beats-sidebar', typography: 'literary-serif', decoration: 'drop-cap-marks', contact: 'byline-row' }),
];

const legacySource: Record<string, { name: string; category: string; colors: TemplateColors; icon: string }> = {
  executive: { name: 'Executive', category: 'executive', colors: colors('#1a365d', '#2b6cb0'), icon: 'bar_chart' },
  modern: { name: 'Modern', category: 'creative', colors: colors('#0d9488', '#14b8a6'), icon: 'auto_awesome' },
  minimal: { name: 'Minimal', category: 'general', colors: colors('#374151', '#6b7280'), icon: 'my_location' },
  compact: { name: 'Compact', category: 'general', colors: colors('#15803d', '#16a34a'), icon: 'content_paste' },
  technical: { name: 'Technical', category: 'technical', colors: colors('#0369a1', '#0284c7'), icon: 'computer' },
  boardroom: { name: 'Boardroom', category: 'executive', colors: colors('#102a43', '#0f766e'), icon: 'corporate_fare' },
  'product-brief': { name: 'Product Brief', category: 'product', colors: colors('#1d4ed8', '#0891b2'), icon: 'view_quilt' },
  creative: { name: 'Creative', category: 'creative', colors: colors('#7c3aed', '#8b5cf6'), icon: 'palette' },
  harvard: { name: 'Harvard', category: 'academic', colors: colors('#991b1b', '#b91c1c'), icon: 'school' },
  cascade: { name: 'Cascade', category: 'creative', colors: colors('#1e3a5f', '#3b82f6'), icon: 'straighten' },
  elegant: { name: 'Elegant', category: 'general', colors: colors('#44403c', '#78716c'), icon: 'edit' },
  nordic: { name: 'Nordic', category: 'general', colors: colors('#475569', '#94a3b8'), icon: 'ac_unit' },
  'ats-optimized': { name: 'ATS Ultra', category: 'technical', colors: colors('#0f766e', '#14b8a6'), icon: 'smart_toy' },
  'double-column': { name: 'Columnist', category: 'technical', colors: colors('#1e40af', '#3b82f6'), icon: 'article' },
  infographic: { name: 'Metro', category: 'creative', colors: colors('#c026d3', '#e879f9'), icon: 'trending_up' },
  deloitte: { name: 'Consultant', category: 'strategy', colors: colors('#86bc25', '#0076a8'), icon: 'domain' },
  faang: { name: 'FAANG', category: 'technical', colors: colors('#4285f4', '#34a853'), icon: 'rocket_launch' },
  startup: { name: 'Startup', category: 'creative', colors: colors('#f97316', '#fb923c'), icon: 'bolt' },
  federal: { name: 'Federal', category: 'public-sector', colors: colors('#1e3a5f', '#1d4ed8'), icon: 'account_balance' },
  academic: { name: 'Academic', category: 'academic', colors: colors('#7c2d12', '#c2410c'), icon: 'school' },
  operator: { name: 'Operator', category: 'technical', colors: colors('#334155', '#059669'), icon: 'precision_manufacturing' },
  'data-signal': { name: 'Data Signal', category: 'technical', colors: colors('#0f172a', '#2563eb'), icon: 'query_stats' },
  'finance-ledger': { name: 'Finance Ledger', category: 'finance', colors: colors('#064e3b', '#0f766e'), icon: 'account_balance_wallet' },
  storyline: { name: 'Storyline', category: 'creative', colors: colors('#581c87', '#be185d'), icon: 'auto_stories' },
  venture: { name: 'Venture', category: 'creative', colors: colors('#7c2d12', '#ea580c'), icon: 'rocket_launch' },
};

const legacyTemplates: ResumeTemplateMetadata[] = LEGACY_TEMPLATE_IDS.map((id) => {
  const source = legacySource[id];
  return {
    id, slug: id, aliases: [], name: source.name,
    description: `Legacy ${source.name} resume template retained for saved-document rendering.`,
    audience: ['existing saved-resume users'], tier: 'pro', selectable: false, legacy: true,
    release: 'legacy', category: source.category, filterTags: ['legacy', source.category],
    recommendationSignals: [], roleFixture: `Saved ${source.name} resume`,
    paletteGroup: source.category,
    palette: { id: `${id}-classic`, name: 'Classic', colors: source.colors },
    icon: source.icon, colors: source.colors, accentDecorativeOnly: true,
    atsClassification: 'ATS-conscious',
    atsLimitation: 'Legacy layout is renderable but no longer offered for new selection.',
    exportProfile: { pdf: 'designed', docx: 'linear', printSafe: true },
    rendererKeys: { html: id, pdf: id, docx: `${id}:linear-docx` },
    linearDocxCompanionKey: `${id}:linear-docx`,
    structure: {
      family: `legacy-${id}`, columns: id === 'double-column' ? 2 : 1,
      headerGeometry: 'legacy-header', sectionOrder: conventionalOrder, density: 'balanced',
      ruleSystem: 'legacy-rules', experienceTreatment: 'legacy-experience',
      skillsTreatment: 'legacy-skills', typography: 'legacy-type',
      decorativeSystem: 'legacy-decoration', contactTreatment: 'legacy-contact',
    },
  };
});

export const TEMPLATE_CATALOG: readonly ResumeTemplateMetadata[] = Object.freeze([
  ...currentSignatures, ...newSignatures, ...legacyTemplates,
]);

export const REGISTERED_TEMPLATE_IDS = Object.freeze(TEMPLATE_CATALOG.map((template) => template.id));
export const SELECTABLE_TEMPLATE_IDS = Object.freeze([
  ...CURRENT_SIGNATURE_IDS, ...NEW_SIGNATURE_TEMPLATE_IDS,
]);

const catalogById = new Map(TEMPLATE_CATALOG.map((template) => [template.id, template]));
const selectableCatalogByAlias = new Map(
  TEMPLATE_CATALOG.flatMap((template) => (
    template.selectable
      ? template.aliases.map((alias) => [alias, template] as const)
      : []
  )),
);
const technicalLegacyIds = new Set([
  'technical', 'ats-optimized', 'faang', 'data-signal', 'operator', 'double-column',
]);
const creativeLegacyIds = new Set([
  'modern', 'creative', 'cascade', 'infographic', 'startup', 'storyline', 'venture',
]);

export function getRegisteredTemplate(id: string): ResumeTemplateMetadata | undefined {
  return catalogById.get(id);
}

export function resolveTemplateForRender(id: string): ResumeTemplateMetadata | undefined {
  return getRegisteredTemplate(id);
}

export function resolveTemplateIdForSelection(id?: string): string {
  const direct = id ? catalogById.get(id) : undefined;
  if (direct?.selectable) return direct.id;
  const alias = id ? selectableCatalogByAlias.get(id) : undefined;
  if (alias) return alias.id;
  if (id && technicalLegacyIds.has(id)) return 'technical-signal';
  if (id && creativeLegacyIds.has(id)) return 'brutalist-voltage';
  return 'editorial-authority';
}

export function resolveSelectableTemplateDeepLinkId(id?: string | null): string | undefined {
  if (!id) return undefined;
  const direct = catalogById.get(id);
  if (direct?.selectable) return direct.id;
  return selectableCatalogByAlias.get(id)?.id;
}

export function resolveInitialResumeTemplateId(
  queryTemplateId?: string | null,
  draftTemplateId?: string,
): string | undefined {
  return resolveSelectableTemplateDeepLinkId(queryTemplateId) ?? draftTemplateId;
}

export function isResumeTemplateSelectionEntitled(
  id: string | undefined,
  hasProAccess: boolean,
): boolean {
  const registered = id ? catalogById.get(id) : undefined;
  if (registered?.tier === 'pro' && !hasProAccess) return false;
  const selected = catalogById.get(resolveTemplateIdForSelection(id));
  return Boolean(selected && (selected.tier !== 'pro' || hasProAccess));
}

export function resolveEntitledTemplateIdForSelection(
  id: string | undefined,
  hasProAccess: boolean,
): string {
  const registered = id ? catalogById.get(id) : undefined;
  if (registered?.tier === 'pro' && !hasProAccess) return CURRENT_SIGNATURE_IDS[0];
  const selectedId = resolveTemplateIdForSelection(id);
  const selected = catalogById.get(selectedId);
  if (selected?.tier === 'pro' && !hasProAccess) return CURRENT_SIGNATURE_IDS[0];
  return selectedId;
}

export function getSelectableTemplates(
  enableNewSignatures = ENABLE_NEW_RESUME_SIGNATURES_BY_DEFAULT,
): readonly ResumeTemplateMetadata[] {
  const allowed = enableNewSignatures
    ? new Set(SELECTABLE_TEMPLATE_IDS)
    : new Set(CURRENT_SIGNATURE_IDS);
  return TEMPLATE_CATALOG.filter((template) => allowed.has(template.id as never));
}

function normalizeSignalText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9&+]+/g, ' ').trim();
}

export function recommendTemplateIds(signalText: string, limit = 3): string[] {
  const normalized = normalizeSignalText(signalText);
  const scored = getSelectableTemplates().map((template, index) => {
    const signalScore = template.recommendationSignals.reduce(
      (total, signal) => total + (normalized.includes(normalizeSignalText(signal)) ? signal.length : 0),
      0,
    );
    const fixtureScore = normalized.includes(normalizeSignalText(template.roleFixture)) ? 1000 : 0;
    const score = fixtureScore + signalScore;
    return { id: template.id, score, index };
  });
  const matches = scored
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((candidate) => candidate.id);
  const fallback = ['editorial-authority', 'technical-signal', 'brutalist-voltage'];
  return [...matches, ...fallback.filter((id) => !matches.includes(id))].slice(0, Math.max(0, limit));
}
