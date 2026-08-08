const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { build } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');
const REWRITE = path.join(repoRoot, 'lib', 'resume-rewrite-guardrails.ts');

/**
 * Bundles and RUNS the real rewrite-guardrails module (never a source scan). Accepts an
 * optional list of [find, replace] source mutations applied to the module ONLY, so a
 * protection can be reverted in place and the matching assertion proven to go red.
 */
async function loadRewrite(mutations = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-rewrite-'));
  const outfile = path.join(directory, 'rw.cjs');
  await build({
    entryPoints: [REWRITE],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    alias: { '@': repoRoot },
    plugins: [
      {
        name: 'mutate',
        setup(pluginBuild) {
          pluginBuild.onLoad({ filter: /resume-rewrite-guardrails\.ts$/ }, (args) => {
            let contents = fs.readFileSync(args.path, 'utf8');
            for (const [find, replace] of mutations) {
              if (!contents.includes(find)) throw new Error(`mutation target not found: ${find}`);
              contents = contents.replace(find, replace);
            }
            return { contents, loader: 'ts' };
          });
        },
      },
    ],
  });
  delete require.cache[require.resolve(outfile)];
  const mod = require(outfile);
  fs.rmSync(directory, { recursive: true, force: true });
  return mod;
}

// The source resume. Two jobs so cross-line numeric theft can be tested. Uses loose input
// names the normalizer accepts; buildRewriteContext consumes the canonical output.
const RAW_SOURCE = {
  name: 'Elena Marquez',
  title: 'Customer Success Manager',
  summary: 'Customer success for mid-market SaaS accounts.',
  experience: [
    {
      role: 'Customer Success Manager',
      company: 'Vireo Analytics',
      duration: '2022 to present',
      achievements: [
        'Held gross renewal at 94% through a pricing change that raised list by 12%.',
        'Managed renewals across a book of forty accounts.',
      ],
    },
    {
      role: 'Account Manager',
      company: 'Vireo Analytics',
      duration: '2020 to 2022',
      achievements: ['Recovered three at-risk accounts worth $780K by rebuilding executive sponsorship.'],
    },
  ],
  education: [{ degree: 'BA Communications', institution: 'University of Florida', year: '2019' }],
  skills: ['Renewals', 'QBRs', 'Salesforce', 'Gainsight'],
  certifications: ['Gainsight Administrator'],
};

const JD = 'Seeking a Customer Success Manager with Kubernetes and terraform experience to own renewals.';

async function context() {
  const { buildRewriteContext } = await loadRewrite();
  const { normalizeResume } = require(await bundleNormalizer());
  return { buildRewriteContext, source: normalizeResume(RAW_SOURCE) };
}

let normalizerOut = null;
async function bundleNormalizer() {
  if (normalizerOut) return normalizerOut;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-norm-'));
  const outfile = path.join(directory, 'norm.cjs');
  await build({
    entryPoints: [path.join(repoRoot, 'lib', 'resume-normalizer.ts')],
    outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', alias: { '@': repoRoot },
  });
  normalizerOut = outfile;
  return outfile;
}

test('a number not on the source line is rejected (magnitude invention 94% -> 40%)', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = classifyLineRewrite(
    'Held gross renewal at 94% through a pricing change that raised list by 12%.',
    'Held gross renewal at 40% through a disciplined pricing change.',
    ctx,
  );
  assert.equal(r.reject, 'numeric-not-in-source-LINE');
  assert.notEqual(r.provenance, 'verified'); // structurally impossible, asserted anyway
});

test('a number from ANOTHER job cannot be laundered into this line (per-line binding)', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  // $780K belongs to the Account Manager line; steal it into the CSM line.
  const r = classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Managed renewals across a book of forty accounts worth $780K.',
    ctx,
  );
  assert.equal(r.reject, 'numeric-not-in-source-LINE');
});

test('an entity present only in the JD is rejected, even though the JD has it', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Managed renewals and Kubernetes rollouts across a book of forty accounts.',
    ctx,
  );
  assert.equal(r.reject, 'entity-not-in-source');
  assert.ok(r.annotations.addedEntities.includes('Kubernetes'));
});

test('a lowercase skill from the JD is caught by the lexicon backstop', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Managed renewals and terraform pipelines across a book of forty accounts.',
    ctx,
  );
  assert.equal(r.reject, 'entity-not-in-source');
  assert.ok(r.annotations.addedEntities.includes('terraform'));
});

test('an empty proposal is rejected', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  assert.equal(classifyLineRewrite('Managed renewals across a book of forty accounts.', '   ', ctx).reject, 'empty');
});

test('a rewrite of a line that is not a real source unit is out of scope', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = classifyLineRewrite('A sentence that appears nowhere in the resume.', 'Anything at all.', ctx);
  assert.equal(r.reject, 'scope-missing');
});

test('an introduced claim-verb is admissible but annotated, never blocked', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Spearheaded renewals across a book of forty accounts.',
    ctx,
  );
  assert.equal(r.reject, undefined, 'a seniority reword is admissible');
  assert.equal(r.provenance, 'draft', 'and it is a draft, never verified');
  assert.deepEqual(r.annotations.introducedClaimVerbs, ['spearheaded']);
});

test('a faithful reword with no new facts is an admissible draft', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = classifyLineRewrite(
    'Held gross renewal at 94% through a pricing change that raised list by 12%.',
    'Sustained a 94% gross renewal rate while raising list pricing 12%.',
    ctx,
  );
  assert.equal(r.reject, undefined);
  assert.equal(r.provenance, 'draft');
});

test('no classification ever returns verified, across every case', async () => {
  const { classifyLineRewrite, buildRewriteContext } = await loadRewrite();
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const cases = [
    ['Managed renewals across a book of forty accounts.', 'Managed renewals across a book of forty accounts.'],
    ['Managed renewals across a book of forty accounts.', 'Spearheaded renewals across a book of forty accounts.'],
    ['Held gross renewal at 94% through a pricing change that raised list by 12%.', 'Held gross renewal at 40%.'],
  ];
  for (const [s, p] of cases) {
    assert.notEqual(classifyLineRewrite(s, p, ctx).provenance, 'verified');
  }
});

// ─────────────────────────── mutation tests: each protection, reverted ───────────────────

test('MUTATION: disabling the per-line numeric check lets cross-line theft through', async () => {
  // Neuter the "a number in the proposal that is not on this source line" reject. The
  // $780K laundered from the Account Manager line into the CSM line must now pass - the
  // test that guards per-line binding is proven load-bearing.
  const mutated = await loadRewrite([[
    'if ((sourceNums.get(claim) ?? 0) < count) {',
    'if (false) {',
  ]]);
  const { buildRewriteContext } = mutated;
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = mutated.classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Managed renewals across a book of forty accounts worth $780K.',
    ctx,
  );
  assert.notEqual(r.reject, 'numeric-not-in-source-LINE', 'mutation must defeat the per-line guard');
});

test('MUTATION: allowing JD tokens as an entity source lets JD injection through', async () => {
  const mutated = await loadRewrite([[
    'if (!ctx.sourceTokens.has(word.toLowerCase())) addedEntities.push(word);',
    'if (!ctx.sourceTokens.has(word.toLowerCase()) && !ctx.jdTokens.has(word.toLowerCase())) addedEntities.push(word);',
  ]]);
  const { buildRewriteContext } = mutated;
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = mutated.classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Managed renewals and Kubernetes rollouts across a book of forty accounts.',
    ctx,
  );
  assert.notEqual(r.reject, 'entity-not-in-source', 'mutation must let a JD entity through');
});

test('MUTATION: emptying the skill lexicon lets a lowercase JD skill through', async () => {
  const mutated = await loadRewrite([[
    "'kubernetes', 'terraform', 'docker'",
    "'__none__', '__none2__', '__none3__'",
  ]]);
  const { buildRewriteContext } = mutated;
  const { source } = await context();
  const ctx = buildRewriteContext(source, JD);
  const r = mutated.classifyLineRewrite(
    'Managed renewals across a book of forty accounts.',
    'Managed renewals and terraform pipelines across a book of forty accounts.',
    ctx,
  );
  assert.notEqual(r.reject, 'entity-not-in-source', 'mutation must let lowercase terraform through');
});
