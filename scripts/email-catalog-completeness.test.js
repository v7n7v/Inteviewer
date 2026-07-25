const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-email-catalog-'));

function bundle(entry, name) {
  const outfile = path.join(outdir, `${name}.cjs`);
  buildSync({ entryPoints: [path.join(repoRoot, entry)], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  return require(outfile);
}

const catalogModule = bundle('lib/email/catalog.ts', 'catalog');
const contractsModule = bundle('lib/email/contracts.ts', 'contracts');

test('every reserved event key has an implemented, versioned catalog definition', () => {
  const reserved = [...contractsModule.EMAIL_EVENT_KEYS].sort();
  const implemented = Object.keys(catalogModule.emailCatalog).sort();
  assert.deepEqual(implemented, reserved);
  for (const [event, definition] of Object.entries(catalogModule.emailCatalog)) {
    assert.equal(definition.event, event);
    assert.match(definition.templateVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(['transactional', 'product', 'internal', 'marketing'].includes(definition.stream));
    assert.ok(definition.schema && typeof definition.schema.safeParse === 'function');
    assert.equal(typeof definition.build, 'function');
  }
});

test('marketing is represented in the catalog but remains outside the live transactional stream', () => {
  for (const event of ['marketing.product_announcement', 'marketing.educational_newsletter']) {
    const definition = catalogModule.emailCatalog[event];
    assert.equal(definition.stream, 'marketing');
    assert.equal(definition.preferenceKey, 'marketing');
    assert.equal(definition.sender, 'marketing');
  }
});
