const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.join(process.cwd(), 'lib', 'resume-review-ledger.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', 'require', transpiled)(moduleShim, moduleShim.exports, require);

const {
  applyResumeReviewDecisions,
  deriveResumeReviewLedger,
  sanitizeResumeReviewState,
  updateResumeReviewDecision,
} = moduleShim.exports;

function resume(overrides = {}) {
  return {
    name: 'Maya Chen',
    title: 'Product Manager',
    email: 'maya@example.com',
    phone: '555-0100',
    location: 'New York, NY',
    summary: 'Product manager focused on measurable outcomes.',
    experience: [{
      company: 'Northstar',
      role: 'Product Manager',
      duration: '2022 – Present',
      achievements: ['Raised activation by 18%.', 'Led roadmap planning.', 'Led roadmap planning.'],
    }],
    education: [{ degree: 'BS', institution: 'State University', year: '2020' }],
    skills: [{ category: 'Product', items: ['Discovery', 'Roadmaps'] }],
    certifications: ['CSPO'],
    ...overrides,
  };
}

test('missing source is explicitly unavailable', () => {
  assert.deepEqual(deriveResumeReviewLedger(null, resume()), { available: false, changes: [] });
});

test('identical and empty resumes produce no changes', () => {
  const sourceResume = resume({ experience: [], education: [], skills: [], certifications: [] });
  assert.deepEqual(deriveResumeReviewLedger(sourceResume, structuredClone(sourceResume)), {
    available: true,
    changes: [],
  });
});

test('duplicate bullets keep occurrence identity and a pure reorder is safe', () => {
  const sourceResume = resume();
  const candidate = resume({
    experience: [{
      ...sourceResume.experience[0],
      achievements: ['Led roadmap planning.', 'Raised activation by 18%.', 'Led roadmap planning.'],
    }],
  });
  const ledger = deriveResumeReviewLedger(sourceResume, candidate);
  assert.equal(ledger.changes.length, 1);
  assert.equal(ledger.changes[0].kind, 'reordered');
  assert.match(ledger.changes[0].id, /^experience-[a-z0-9-]+-reordered-/);
});

test('reordered roles remain a source-backed experience reorder', () => {
  const first = resume().experience[0];
  const second = {
    company: 'Orbit',
    role: 'Associate Product Manager',
    duration: '2020 – 2022',
    achievements: ['Interviewed 40 customers.'],
  };
  const sourceResume = resume({ experience: [first, second] });
  const candidate = resume({ experience: [second, first] });
  const change = deriveResumeReviewLedger(sourceResume, candidate).changes[0];
  assert.equal(change.section, 'experience');
  assert.equal(change.kind, 'reordered');
});

test('case and punctuation changes are never approved as a reorder', () => {
  const sourceResume = resume();
  const candidate = resume({ summary: 'product manager focused on measurable outcomes' });
  const change = deriveResumeReviewLedger(sourceResume, candidate).changes.find(item => item.section === 'summary');
  assert.equal(change.kind, 'needs-review');
});

test('swapping identity fields is path-bound and never classified as a reorder', () => {
  const sourceResume = resume();
  const candidate = resume({ name: sourceResume.title, title: sourceResume.name });
  const changes = deriveResumeReviewLedger(sourceResume, candidate).changes;
  assert.deepEqual(changes.map(change => change.path).sort(), ['identity.name', 'identity.title']);
  assert.ok(changes.every(change => change.kind === 'needs-review'));
});

test('moving an exact bullet across employers is unsupported for both records', () => {
  const first = resume().experience[0];
  const second = {
    company: 'Orbit',
    role: 'Associate Product Manager',
    duration: '2020 – 2022',
    achievements: ['Interviewed 40 customers.'],
  };
  const moved = first.achievements[0];
  const sourceResume = resume({ experience: [first, second] });
  const candidate = resume({
    experience: [
      { ...first, achievements: first.achievements.slice(1) },
      { ...second, achievements: [...second.achievements, moved] },
    ],
  });
  const changes = deriveResumeReviewLedger(sourceResume, candidate).changes.filter(change => change.section === 'experience');
  assert.equal(changes.length, 2);
  assert.ok(changes.every(change => change.kind === 'needs-review'));
  assert.notEqual(changes[0].path, changes[1].path);
});

test('moving skills across categories cannot be accepted as a reorder', () => {
  const sourceResume = resume({
    skills: [
      { category: 'Product', items: ['Discovery', 'Roadmaps'] },
      { category: 'Analytics', items: ['SQL'] },
    ],
  });
  const candidate = resume({
    skills: [
      { category: 'Product', items: ['Roadmaps'] },
      { category: 'Analytics', items: ['SQL', 'Discovery'] },
    ],
  });
  const changes = deriveResumeReviewLedger(sourceResume, candidate).changes.filter(change => change.section === 'skills');
  assert.equal(changes.length, 2);
  assert.ok(changes.every(change => change.kind === 'needs-review'));
});

test('duplicate role records use occurrence-bound stable paths', () => {
  const entry = resume().experience[0];
  const duplicate = { ...entry, achievements: ['Second occurrence bullet.'] };
  const sourceResume = resume({ experience: [entry, duplicate] });
  const candidate = resume({
    experience: [
      { ...entry, achievements: [...entry.achievements].reverse() },
      duplicate,
    ],
  });
  const first = deriveResumeReviewLedger(sourceResume, candidate);
  const second = deriveResumeReviewLedger(sourceResume, candidate);
  assert.deepEqual(first, second);
  assert.equal(first.changes.length, 1);
  assert.equal(first.changes[0].kind, 'reordered');
  assert.match(first.changes[0].path, /^experience\.[a-z0-9]+\.achievements$/);
});

test('case-only bound record field changes require review and revert exact source values', () => {
  const base = resume();
  const sourceResume = resume({
    experience: [{ ...base.experience[0], company: 'Acme' }],
    education: [{ degree: 'BS', institution: 'State', year: '2020' }],
    skills: [{ category: 'Product', items: ['Discovery', 'Roadmaps'] }],
  });
  const candidate = resume({
    experience: [{ ...sourceResume.experience[0], company: 'ACME' }],
    education: [{ ...sourceResume.education[0], institution: 'STATE' }],
    skills: [{ ...sourceResume.skills[0], category: 'PRODUCT' }],
  });
  const ledger = deriveResumeReviewLedger(sourceResume, candidate);
  assert.equal(ledger.changes.length, 3);
  assert.ok(ledger.changes.every(change => change.kind === 'needs-review'));
  assert.ok(ledger.changes.some(change => change.path.endsWith('.company')));
  assert.ok(ledger.changes.some(change => change.path.endsWith('.institution')));
  assert.ok(ledger.changes.some(change => change.path.endsWith('.category')));
  const decisions = Object.fromEntries(ledger.changes.map(change => [change.id, 'reverted']));
  const reviewed = applyResumeReviewDecisions(sourceResume, candidate, ledger.changes, decisions);
  assert.equal(reviewed.experience[0].company, 'Acme');
  assert.equal(reviewed.education[0].institution, 'State');
  assert.equal(reviewed.skills[0].category, 'Product');
});

test('new and missing content is needs-review and reverting restores the whole section', () => {
  const sourceResume = resume();
  const candidate = resume({
    experience: [{
      ...sourceResume.experience[0],
      achievements: ['Invented a new unsupported claim.'],
    }],
  });
  const ledger = deriveResumeReviewLedger(sourceResume, candidate);
  assert.equal(ledger.changes[0].kind, 'needs-review');
  const reviewed = applyResumeReviewDecisions(
    sourceResume,
    candidate,
    ledger.changes,
    { [ledger.changes[0].id]: 'reverted' },
  );
  assert.deepEqual(reviewed.experience, sourceResume.experience);
  assert.deepEqual(sourceResume.experience[0].achievements, [
    'Raised activation by 18%.',
    'Led roadmap planning.',
    'Led roadmap planning.',
  ]);
});

test('multiple reordered sections remain deterministic across accept and revert cycles', () => {
  const sourceResume = resume();
  const candidate = resume({
    experience: [{
      ...sourceResume.experience[0],
      achievements: [...sourceResume.experience[0].achievements].reverse(),
    }],
    skills: [{ category: 'Product', items: ['Roadmaps', 'Discovery'] }],
  });
  const first = deriveResumeReviewLedger(sourceResume, candidate);
  const second = deriveResumeReviewLedger(sourceResume, candidate);
  assert.deepEqual(first, second);
  assert.equal(first.changes.length, 2);
  const decisions = Object.fromEntries(first.changes.map(change => [
    change.id,
    change.section === 'skills' ? 'reverted' : 'accepted',
  ]));
  const reviewedOnce = applyResumeReviewDecisions(sourceResume, candidate, first.changes, decisions);
  const reviewedTwice = applyResumeReviewDecisions(sourceResume, candidate, first.changes, decisions);
  assert.deepEqual(reviewedOnce, reviewedTwice);
  assert.deepEqual(reviewedOnce.skills, sourceResume.skills);
  assert.deepEqual(reviewedOnce.experience, candidate.experience);
});

test('mixed accept and revert decisions stay record-scoped within experience', () => {
  const first = resume().experience[0];
  const second = {
    company: 'Orbit',
    role: 'Associate Product Manager',
    duration: '2020 – 2022',
    achievements: ['Interviewed 40 customers.', 'Shipped onboarding updates.'],
  };
  const sourceResume = resume({ experience: [first, second] });
  const candidate = resume({
    experience: [
      { ...first, achievements: [...first.achievements].reverse() },
      { ...second, achievements: [...second.achievements].reverse() },
    ],
  });
  const changes = deriveResumeReviewLedger(sourceResume, candidate).changes;
  assert.equal(changes.length, 2);
  const reviewed = applyResumeReviewDecisions(sourceResume, candidate, changes, {
    [changes[0].id]: 'accepted',
    [changes[1].id]: 'reverted',
  });
  assert.deepEqual(reviewed.experience[0].achievements, candidate.experience[0].achievements);
  assert.deepEqual(reviewed.experience[1].achievements, sourceResume.experience[1].achievements);
});

test('same-record warning stays explicit, then its revert cascades the record scope', () => {
  const sourceResume = resume({
    experience: [{
      company: 'Acme',
      role: 'Product Manager',
      duration: '2022 – Present',
      achievements: ['Raised activation by 18%.', 'Led roadmap planning.'],
    }],
  });
  const candidate = resume({
    experience: [{
      ...sourceResume.experience[0],
      company: 'ACME',
      achievements: [...sourceResume.experience[0].achievements].reverse(),
    }],
  });
  const changes = deriveResumeReviewLedger(sourceResume, candidate).changes;
  assert.equal(changes.length, 2);
  const reordered = changes.find(change => change.kind === 'reordered');
  const needsReview = changes.find(change => change.kind === 'needs-review');
  const afterAccept = updateResumeReviewDecision(changes, {}, reordered.id, 'accepted');
  assert.equal(afterAccept[reordered.id], 'accepted');
  assert.equal(afterAccept[needsReview.id], undefined);
  assert.equal(
    changes.filter(change => change.kind === 'needs-review' && afterAccept[change.id] !== 'reverted').length,
    1,
  );
  const afterExplicitRevert = updateResumeReviewDecision(
    changes,
    afterAccept,
    needsReview.id,
    'reverted',
  );
  assert.equal(afterExplicitRevert[reordered.id], 'reverted');
  assert.equal(afterExplicitRevert[needsReview.id], 'reverted');
  const reviewed = applyResumeReviewDecisions(sourceResume, candidate, changes, afterExplicitRevert);
  assert.deepEqual(reviewed.experience, sourceResume.experience);
});

test('invalid persisted decisions are safely discarded', () => {
  const state = sanitizeResumeReviewState({
    version: 99,
    decisions: { a: 'accepted', b: 'invented', c: 'reverted' },
    selectedId: 4,
    view: 'other',
    documentTab: 'source',
  });
  assert.deepEqual(state.decisions, { a: 'accepted', c: 'reverted' });
  assert.equal(state.selectedId, null);
  assert.equal(state.view, 'comparison');
  assert.equal(state.documentTab, 'source');
});
