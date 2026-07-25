const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'components', 'resume-templates', 'curated', 'index.tsx');
const catalogPath = path.join(root, 'lib', 'resume-templates', 'catalog.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const catalog = fs.readFileSync(catalogPath, 'utf8');

const idsBlock = catalog.match(/export const NEW_SIGNATURE_TEMPLATE_IDS = \[([\s\S]*?)\] as const;/);
assert.ok(idsBlock, 'catalog must expose NEW_SIGNATURE_TEMPLATE_IDS');
const ids = [...idsBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

test('explicit curated HTML registry covers exactly the 17 new signatures', () => {
  assert.equal(ids.length, 17);
  const registryBlock = source.match(
    /export const CURATED_HTML_TEMPLATE_MAP:[\s\S]*?= \{([\s\S]*?)\n\};/,
  );
  assert.ok(registryBlock, 'explicit registry source must be present');
  const registryIds = [...registryBlock[1].matchAll(/^\s*'([^']+)': createRenderer\('([^']+)'\),$/gm)];
  assert.deepEqual(registryIds.map((match) => match[1]), ids);
  assert.deepEqual(registryIds.map((match) => match[2]), ids);
  assert.doesNotMatch(registryBlock[1], /\.\.\.|reduce\(|fromEntries|map\(/);
});

test('renderer has no template fallback and fails closed at its typed registry boundary', () => {
  const rendererStart = source.indexOf('export function CuratedSignatureTemplate(');
  const rendererEnd = source.indexOf('export function CuratedTemplateMiniature', rendererStart);
  const publicRenderer = source.slice(rendererStart, rendererEnd);
  assert.ok(rendererStart >= 0 && rendererEnd > rendererStart);
  assert.match(publicRenderer, /requireResumeTemplateRegistryEntry\([\s\S]*CURATED_HTML_TEMPLATE_MAP,[\s\S]*templateId,[\s\S]*'html'/);
  assert.doesNotMatch(publicRenderer, /\|\||\?\?|fallback|editorial-authority/);
});

test('semantic and empty-section contract is source-enforced', () => {
  for (const semanticTag of ['article', 'header', 'address', 'section', 'h1', 'h2']) {
    assert.match(source, new RegExp(`<${semanticTag}(?:[ >])`), `${semanticTag} must be rendered`);
  }
  for (const label of ['Summary', 'Experience', 'Skills', 'Education', 'Certifications']) {
    assert.match(source, new RegExp(`\\b${label}\\b`));
  }
  assert.match(source, /if \(!summary\) return null/);
  assert.match(source, /if \(!entries\.length\) return null/g);
  assert.match(source, /if \(!groups\.length\) return null/);
  assert.match(source, /if \(!certifications\.length\) return null/);
  assert.match(source, /if \(!sectionContent\) return null/);
});

test('canonical schema is the only resume content source', () => {
  const supported = new Set([
    'name', 'title', 'email', 'phone', 'location', 'linkedin', 'website',
    'summary', 'experience', 'education', 'skills', 'certifications',
    'company', 'role', 'duration', 'achievements',
    'degree', 'institution', 'year', 'details',
    'category', 'items',
  ]);
  const referenced = [...source.matchAll(/\b(?:resume|entry|group)\.([a-zA-Z_]\w*)/g)]
    .map((match) => match[1]);
  const unsupported = [...new Set(referenced)].filter((field) => !supported.has(field));
  assert.deepEqual(unsupported, []);
  assert.doesNotMatch(source, /\b(?:projects|publications|volunteering|awards|photo|avatar)\b/i);
});

test('document typography is fixed, print-safe, and color roles are constrained', () => {
  assert.doesNotMatch(source, /cqw|cqh|cqmin|cqmax|containerType|100vw|100vh/i);
  assert.match(source, /width: 210mm/);
  assert.match(source, /min-height: 297mm/);
  assert.match(source, /background: #fff/);
  assert.match(source, /@page \{ size: A4/);
  assert.match(source, /font-size: 10(?:px|\.5px)/);
  const accentTextUses = [...source.matchAll(/([^{}\n]+)\{[^{}]*color:\s*var\(--curated-accent\)[^{}]*\}/g)];
  assert.deepEqual(accentTextUses.map((match) => match[1].trim()), ['.curated-header-mark']);
  assert.match(accentTextUses[0][0], /font-size:\s*34px/);
  assert.match(source, /background:\s*var\(--curated-accent\)/);
});

test('all signatures expose distinctive miniatures and structural atlas attributes', () => {
  const compositionBlock = source.match(
    /export const CURATED_COMPOSITIONS:[\s\S]*?= \{([\s\S]*?)\n\};/,
  );
  assert.ok(compositionBlock);
  const compositions = [...compositionBlock[1].matchAll(
    /^\s*'([^']+)': \{ composition: '([^']+)'/gm,
  )];
  assert.deepEqual(compositions.map((match) => match[1]), ids);
  assert.equal(new Set(compositions.map((match) => match[2])).size, 17);
  for (const [, , composition] of compositions) {
    assert.match(source, new RegExp(`\\.mini-composition-${composition.replaceAll('_', '-')}`));
  }
  assert.match(source, /export function CuratedTemplateMiniature/);
  const miniatureStart = source.indexOf('export function CuratedTemplateMiniature');
  const miniatureSource = source.slice(miniatureStart);
  assert.match(miniatureSource, /requireResumeTemplateRegistryEntry\([\s\S]*CURATED_COMPOSITIONS,[\s\S]*template\.id/);
  assert.doesNotMatch(miniatureSource, /isCuratedSignatureTemplateId\(template\.id\)\) return null/);
  assert.match(source, /data-template-id=/);
  assert.match(source, /data-family=/);
  assert.match(source, /data-ats=/);
});

test('frozen structural dimensions drive deterministic renderer branches', () => {
  const structuralClassExpressions = [
    'template.id',
    'template.structure.family',
    'composition.composition',
    'template.structure.columns',
    'template.structure.headerGeometry',
    'template.structure.density',
    'template.structure.ruleSystem',
    'template.structure.experienceTreatment',
    'template.structure.skillsTreatment',
    'template.structure.typography',
    'template.structure.decorativeSystem',
    'template.structure.contactTreatment',
  ];
  for (const expression of structuralClassExpressions) {
    assert.match(source, new RegExp(expression.replaceAll('.', '\\.')));
  }
  const compositionFamilies = [...source.matchAll(/composition: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(new Set(compositionFamilies).size >= 8, 'at least eight material compositions are required');
  assert.match(source, /template\.structure\.sectionOrder\.filter/);
  assert.match(source, /columns-\$\{template\.structure\.columns\}/);
});

test('ATS-first templates cannot acquire a visual document column split', () => {
  assert.doesNotMatch(source, /\.columns-1\s+\.curated-content\s*\{[^}]*grid/i);
  assert.doesNotMatch(source, /\.columns-1\s*\{[^}]*columns:/i);
  assert.match(source, /\.columns-2 \.curated-skills-list/);
  assert.match(source, /data-section-order=/);
});
