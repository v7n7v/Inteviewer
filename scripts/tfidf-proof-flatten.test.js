const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSync } = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');

/**
 * Executes the real flattenResume against a real normalizeResume output.
 *
 * The bug this guards: flattenResume read exp.bullets / edu.school / s.name, but
 * normalizeResume emits achievements / institution / {category, items}. So every bullet,
 * every skill and every institution was silent-dropped before TF-IDF scoring, and the Fit
 * number was computed over name + title + company + degree - "Fit 11" on a strong resume.
 *
 * The load-bearing choice, per the finding that caused the drift: assert against the
 * normalizer's OWN output, not a hand-written fixture. A fixture can be shaped to whatever
 * the function happens to read; the normalizer is the shape the product actually produces.
 */
function loadModules() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-tfidf-'));
  const build = (rel, name) => {
    const outfile = path.join(directory, name);
    buildSync({
      entryPoints: [path.join(repoRoot, rel)],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
      alias: { '@': repoRoot },
    });
    return require(outfile);
  };
  const proof = build('lib/tfidf-proof.ts', 'proof.cjs');
  const normalizer = build('lib/resume-normalizer.ts', 'normalizer.cjs');
  fs.rmSync(directory, { recursive: true, force: true });
  return { ...proof, ...normalizer };
}

const { flattenResume, proveResumeDelta, normalizeResume } = loadModules();

// A resume in the shape a caller actually holds, before normalization. Deliberately uses
// the loose input names the normalizer accepts.
const RAW = {
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
        'Recovered three at-risk accounts worth $780K by rebuilding executive sponsorship.',
      ],
    },
  ],
  education: [{ degree: 'BA Communications', institution: 'University of Florida', year: '2019' }],
  skills: ['Renewals', 'QBRs', 'Salesforce', 'Gainsight', 'escalation management'],
  certifications: ['Gainsight Administrator'],
};

test('flattenResume includes every bullet, skill and institution from a normalized resume', () => {
  const canonical = normalizeResume(RAW);
  const flat = flattenResume(canonical);

  // Every achievement string must survive.
  for (const exp of canonical.experience) {
    for (const line of exp.achievements) {
      assert.ok(flat.includes(line), `achievement dropped: "${line}"`);
    }
  }
  // Every skill item must survive - these are the JD-matchable terms.
  for (const group of canonical.skills) {
    for (const item of group.items) {
      assert.ok(flat.includes(item), `skill dropped: "${item}"`);
    }
  }
  // Every institution must survive.
  for (const edu of canonical.education) {
    if (edu.institution) {
      assert.ok(flat.includes(edu.institution), `institution dropped: "${edu.institution}"`);
    }
  }
});

test('the flattened text is dominated by resume BODY, not just the header', () => {
  // The regression rendered a flat string that was essentially name+title+company+degree.
  // A real resume body is many times longer than its header line.
  const canonical = normalizeResume(RAW);
  const flat = flattenResume(canonical);
  const header = [canonical.name, canonical.title, canonical.experience[0]?.company, canonical.education[0]?.degree]
    .filter(Boolean)
    .join('\n');
  assert.ok(
    flat.length > header.length * 2,
    `flattened resume (${flat.length} chars) is barely longer than its header (${header.length}) - the body is being dropped`,
  );
});

test('JD terms that live only in the resume body are now recognized as present', () => {
  // Salesforce / Gainsight / renewals / QBRs live only in skills and bullets. The cosine
  // SCORE is not a clean monotonic signal - the scorer L2-normalizes, so adding terms can
  // dilute as easily as help, which is a real limit of TF-IDF. The clean, true property is
  // MATCHING: a JD term present only in the body must count as matched in the resume
  // rather than "neither". Before the flatten fix every one of these was invisible.
  const canonical = normalizeResume(RAW);
  const jd = 'Seeking a Customer Success Manager fluent in Salesforce and Gainsight to own renewals and QBRs.';

  const matchedIn = (resume) => {
    const flat = flattenResume(resume);
    const proof = proveResumeDelta(flat, flat, jd);
    // Same resume twice -> a JD term is 'both' when present, 'neither' when absent.
    return proof.topJDTerms.filter((t) => t.matchedIn !== 'neither').length;
  };

  const headerOnly = {
    name: canonical.name,
    title: canonical.title,
    experience: [{ company: canonical.experience[0].company, role: canonical.experience[0].role }],
    education: [{ degree: canonical.education[0].degree }],
    skills: [],
  };

  assert.ok(
    matchedIn(canonical) > matchedIn(headerOnly),
    `the full resume must match more JD terms (${matchedIn(canonical)}) than its header alone (${matchedIn(headerOnly)})`,
  );
});
