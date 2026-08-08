const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');

async function loadImpactHelpers() {
  const source = fs.readFileSync(
    path.join(root, 'components/resume-templates/editorial-authority-impact.ts'),
    'utf8',
  );
  const result = await esbuild.transform(source, {
    format: 'esm',
    loader: 'ts',
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.code).toString('base64')}`);
}

function resumeWithAchievements(achievements) {
  return {
    name: 'Taylor Morgan',
    title: 'Executive',
    email: '',
    phone: '',
    location: '',
    summary: '',
    experience: [{ company: 'Example', role: 'Leader', duration: '2020–Present', achievements }],
    education: [],
    skills: [],
    certifications: [],
  };
}

test('Editorial Authority impact helper keeps only explicit quantified outcomes', async () => {
  const { getEditorialImpacts } = await loadImpactHelpers();
  const impacts = getEditorialImpacts(resumeWithAchievements([
    'Improved activation by 31% across the portfolio.',
    'Led cross-functional planning and roadmap reviews.',
    'Influenced $48M in annual recurring revenue.',
    'Expanded delivery to 2.6x the prior baseline.',
  ]));

  assert.deepEqual(impacts.map(impact => impact.metric), ['31%', '$48M', '2.6x']);
  assert.equal(impacts.some(impact => impact.text.includes('planning')), false);
});

test('Editorial Authority impact helper de-duplicates, caps, and handles sparse input', async () => {
  const { getEditorialImpacts } = await loadImpactHelpers();
  const resume = resumeWithAchievements([
    'Reduced costs by 20%.',
    'Reduced costs by 20%.',
    'Supported 120K customers.',
    'Grew throughput 4x.',
  ]);

  assert.equal(getEditorialImpacts(resume, 2).length, 2);
  assert.deepEqual(getEditorialImpacts(resumeWithAchievements([])), []);
  assert.deepEqual(getEditorialImpacts(resume, 0), []);
});

/**
 * The catalog, executed rather than grepped.
 *
 * Two assertions in the test below used to read `app/suite/resume/page.tsx` for
 * `const ALL_TEMPLATES = [{ id: '...'` and `FEATURED_TEMPLATE_IDS`. The array moved to
 * `lib/resume-templates/catalog.ts` and the featured set was deleted outright, so the
 * first assertion had been failing and the second was guarding a concept that no longer
 * exists. A regex over a page component cannot tell "the ordering contract broke" from
 * "the code moved", which is exactly the failure mode that let this rot.
 */
function loadCatalog() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-template-catalog-'));
  const outfile = path.join(directory, 'catalog.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(root, 'lib/resume-templates/catalog.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    // '@/lib/...' is a tsconfig path, not a node one.
    alias: { '@': root },
  });
  const loaded = require(outfile);
  fs.rmSync(directory, { recursive: true, force: true });
  return loaded;
}

/** The three hand-written signature templates, each with its own bespoke renderer. */
const BESPOKE_SIGNATURE_IDS = ['editorial-authority', 'technical-signal', 'brutalist-voltage'];

test('Editorial Authority leads the selectable catalog and the bespoke three stay registered', () => {
  const { getSelectableTemplates, getRegisteredTemplate } = loadCatalog();
  const selectable = getSelectableTemplates();

  assert.equal(
    selectable[0].id,
    'editorial-authority',
    'Editorial Authority is the default first selection; reordering the catalog changes what every new user sees',
  );

  for (const id of BESPOKE_SIGNATURE_IDS) {
    const template = getRegisteredTemplate(id);
    assert.ok(template, `${id} must stay registered`);
    assert.equal(template.selectable, true, `${id} must stay selectable`);
    assert.ok(
      selectable.some(candidate => candidate.id === id),
      `${id} must appear in getSelectableTemplates()`,
    );
  }
});

test('The three signature templates have stable preview, PDF, and chooser mappings', () => {
  const pageSource = fs.readFileSync(path.join(root, 'app/suite/resume/page.tsx'), 'utf8');
  const previewSource = fs.readFileSync(path.join(root, 'components/resume-templates/index.tsx'), 'utf8');
  const pdfSource = fs.readFileSync(path.join(root, 'lib/pdf-templates.tsx'), 'utf8');

  assert.match(previewSource, /'editorial-authority': EditorialAuthorityTemplate/);
  assert.match(previewSource, /'technical-signal': TechnicalSignalTemplate/);
  assert.match(previewSource, /'brutalist-voltage': BrutalistVoltageTemplate/);
  assert.match(pdfSource, /'editorial-authority': EditorialAuthorityPDF/);
  assert.match(pdfSource, /'technical-signal': TechnicalSignalPDF/);
  assert.match(pdfSource, /'brutalist-voltage': BrutalistVoltagePDF/);
  assert.match(pageSource, /if \(tmpl === 'editorial-authority'\)/);
  assert.match(pageSource, /tmpl === 'technical-signal' \|\| tmpl === 'brutalist-voltage'/);
  assert.match(pageSource, /resolveReplacementTemplate/);
});
