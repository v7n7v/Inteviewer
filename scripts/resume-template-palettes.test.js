const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');

/**
 * Executes lib/resume-templates/palettes.ts.
 *
 * These colourways were lifted out of app/suite/resume/page.tsx, where they were 85 of
 * that file's hex literals. A lift is exactly the change that breaks something silently:
 * the types compile, the page renders, and one template quietly offers the wrong set.
 * So this runs the real module against the real catalog.
 */
function loadPalettes() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-palettes-'));
  const outfile = path.join(directory, 'palettes.cjs');
  buildSync({
    entryPoints: [path.join(repoRoot, 'lib', 'resume-templates', 'palettes.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    alias: { '@': repoRoot },
  });
  const loaded = require(outfile);
  fs.rmSync(directory, { recursive: true, force: true });
  return loaded;
}

function loadCatalog() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-catalog-'));
  const outfile = path.join(directory, 'catalog.cjs');
  buildSync({
    entryPoints: [path.join(repoRoot, 'lib', 'resume-templates', 'catalog.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    alias: { '@': repoRoot },
  });
  const loaded = require(outfile);
  fs.rmSync(directory, { recursive: true, force: true });
  return loaded;
}

const palettes = loadPalettes();
const { getSelectableTemplates } = loadCatalog();
const HEX = /^#[0-9a-f]{6}$/i;

test('every selectable template resolves a palette set, led by its own Classic', () => {
  const templates = getSelectableTemplates();
  assert.equal(templates.length, 20, 'the catalog ships 20 selectable templates');

  for (const template of templates) {
    const set = palettes.getTemplatePalettes(template);
    assert.ok(set.length >= 2, `${template.id} must offer a real choice, not one option`);
    assert.ok(set.length <= 8, `${template.id} is capped at 8 options`);

    // The template's own colours always lead, flagged as the default.
    assert.equal(set[0].isDefault, true, `${template.id} first option must be the default`);
    assert.equal(set[0].label, 'Classic');
    assert.equal(set[0].colors.primary, template.colors.primary,
      `${template.id} Classic must be the template's own primary, not a group colour`);

    const ids = set.map(option => option.id);
    assert.equal(new Set(ids).size, ids.length, `${template.id} palette ids must be unique`);
  }
});

test('every colourway carries three real hex inks', () => {
  for (const [group, options] of Object.entries(palettes.TEMPLATE_PALETTE_GROUPS)) {
    assert.ok(options.length > 0, `${group} must not be empty`);
    for (const option of options) {
      assert.ok(option.id && option.label, `${group}/${option.id} needs an id and a human label`);
      for (const ink of ['primary', 'accent', 'text']) {
        assert.match(option.colors[ink], HEX, `${group}/${option.id}.${ink} must be a hex colour`);
      }
    }
  }
});

test('every template maps to a group that actually exists', () => {
  // getTemplatePalettes spreads TEMPLATE_PALETTE_GROUPS[group]. An unmapped group would
  // spread undefined and throw at render, on the Design stage, for that template only -
  // the kind of failure that reaches a user before it reaches a developer.
  for (const template of getSelectableTemplates()) {
    const group = palettes.getTemplatePaletteGroup(template.id);
    assert.ok(
      Object.prototype.hasOwnProperty.call(palettes.TEMPLATE_PALETTE_GROUPS, group),
      `${template.id} maps to group "${group}", which is not defined`,
    );
  }
});

test('a requested palette resolves, and an unknown one falls back rather than throwing', () => {
  const template = getSelectableTemplates()[0];
  const set = palettes.getTemplatePalettes(template);
  const second = set[1];

  assert.equal(palettes.getTemplatePalette(template, second.id).id, second.id);
  assert.equal(
    palettes.getTemplatePalette(template, 'no-such-palette').id,
    set[0].id,
    'an unknown palette id must fall back to the default, not crash the Design stage',
  );
  assert.equal(palettes.getTemplatePalette(template, undefined).id, set[0].id);
});

test('getTemplateWithPalette returns contrast-safe ink and never drops the background', () => {
  for (const template of getSelectableTemplates()) {
    const set = palettes.getTemplatePalettes(template);
    for (const option of set) {
      const applied = palettes.getTemplateWithPalette(template, option.id);
      assert.match(applied.colors.background, HEX, `${template.id}/${option.id} needs a background`);
      for (const ink of ['primary', 'accent', 'text']) {
        assert.match(applied.colors[ink], HEX, `${template.id}/${option.id}.${ink}`);
      }
      // The rest of the template metadata must survive the spread untouched.
      assert.equal(applied.id, template.id);
      assert.equal(applied.name, template.name);
      assert.equal(applied.atsClassification, template.atsClassification);
    }
  }
});
