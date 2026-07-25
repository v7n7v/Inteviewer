# Resume Studio implementation contract

## Plan identity

- Version: 1.0
- Date: 2026-07-24
- Objective: implement the selected Focused Workbench visual direction in the existing Resume Studio and add an honest, accessible source-versus-tailored review mode.
- User-visible outcome: signed-in users can review the actual source and Taco-tailored resume in a visually premium workbench, understand the workflow stage and truth protections, accept or revert review items, switch between focused and side-by-side views, and continue to the existing design/export flow.
- Risk size: high

## Boundaries

### Authorized scope

- Redesign the Resume Studio review experience.
- Add a six-stage visual progress indicator while preserving the current internal state machine.
- Add a responsive Focused/Side-by-side review switch.
- Add a derived, source-backed change ledger and reversible review decisions for all signed-in tiers.
- Improve the Resume Studio route’s available canvas by collapsing the existing suite sidebar on entry and suppressing the desktop assistant context panel on this route.
- Add focused tests and visual/runtime verification.

### Explicit non-goals

- No production or Firebase deployment.
- No authentication, billing, usage-credit, export, or Firestore migration.
- No change to the backend truth contract.
- No claim that Taco paraphrased content when the backend only reordered source text.
- No replacement of the three signature templates already being developed.
- No overhaul of other suite tools.

### Assumptions

- The selected visual truth is `concept-final-hybrid-1440x1024.png`, derived from displayed Option 1 with the displayed Diff Studio interaction.
- The current reorder-only guardrail is intentional for this implementation.
- Side-by-side comparison is available only when both the immutable imported source and generated tailored resume are present in the current draft/session.
- Existing saved drafts without an original source receive an honest unavailable state rather than a fabricated comparison.
- The existing global sidebar remains available. Resume Studio temporarily requests compact presentation without persisting that preference, and restores the prior in-memory presentation after leaving the route.

### Protected user work

- The repository is heavily dirty. Every pre-existing tracked or untracked change is user-owned.
- Existing truth-guardrail, export, template, Taco-brand, auth, billing, and admin work must remain intact.
- Implementation will use new isolated files and the smallest possible integration edits.

### Consequential actions requiring separate approval

- Production deployment.
- Firebase configuration or data migration.
- Changes to morph safety or export truth policy.
- New external services or dependencies.

## Evidence and decisions

### Baseline findings

- Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind, Framer Motion, Firebase, Material Symbols.
- `app/suite/resume/page.tsx` is a 5,652-line client component with 3,289 user-owned added lines in its current diff.
- Original and morphed resume objects already coexist in the active session.
- Export re-applies deterministic truth guardrails independently of the UI.
- The current page reserves substantial width for the suite sidebar and, on large desktops, an assistant context panel.
- The existing visual step strip maps to five internal steps; the desired visual model has six conceptual stages.

### External research claims and sources

- Linear workflows with three or more stages should use short step labels, separate Back/Next navigation, hidden completion text, and `aria-current` for the current step: [USWDS Step Indicator](https://designsystem.digital.gov/components/step-indicator/), updated 2025-02-14.
- Side-by-side comparison can be beneficial, but each column must remain readable and a stacked alternative should exist at narrow widths: [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), updated 2026-06-12.
- The responsive Original/Tailored switch will follow the APG tabs pattern: [WAI-ARIA APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- Morph strength needs a programmatic label and useful value text: [WAI-ARIA APG Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).
- Status, focus, contrast, target size, and non-color state requirements are governed by WCAG 2.2 guidance for keyboard, focus visible, focus not obscured, contrast, use of color, status messages, and target size.

### Counterevidence and challenged assumptions

- The selected concept’s “Rephrased from source” wording is not compatible with the current reorder-only safety contract. The implementation will use truthful labels such as “Source-backed prioritization,” “Reordered,” and “Needs review.”
- A full historical comparison cannot be promised for reopened versions because the saved version schema does not guarantee an immutable source snapshot.
- Two full documents plus a queue do not fit safely with every global panel open. The Resume Studio route needs an immersive-but-reversible chrome adjustment.

### Architecture and design decisions

1. Add an isolated pure ledger module that compares existing source and tailored resume sections without changing backend generation.
2. Add a dedicated Review Workbench component, a noninteractive six-stage progress component, and a scoped stylesheet.
3. Integrate the workbench as an early Review-stage render behind a local `ENABLE_RESUME_REVIEW_WORKBENCH` switch so the legacy Resume Intelligence JSX remains preserved and becomes the rollback path.
4. Keep the existing internal `upload | jd | enhance | template | preview` state model. Map it to visual stages:
   - upload → Source
   - jd before the existing optimization action completes → Target or Shape based on explicit `morphedResume`/generation state, never placeholder-text truthiness
   - enhance → Review
   - template → Design
   - preview → Ship
5. The source snapshot is immutable. Accept leaves a source-safe tailored section in the working reviewed copy. “Needs review” items cannot be accepted. “Revert section” restores the full source section and discloses the number of affected lines. Continue commits the reviewed copy to the existing `morphedResume` state and advances to Design.
6. Text editing is deferred from this increment because the current safety model has no distinct user-authored override channel. The build must not render a dead Edit control.
7. Runtime review state is backward-compatible and explicit:
   - immutable source = existing `originalResume`;
   - generated candidate = existing `morphedResume`;
   - review decisions = new versioned session-draft field keyed by deterministic ledger IDs;
   - reviewed candidate = derived from the immutable source, generated candidate, and decisions;
   - committed output = reviewed candidate copied to `morphedResume` only on Continue.
8. The ledger compares the complete normalized resume without fuzzy approval:
   - stable section path includes section type plus company/role/category occurrence index;
   - item identity uses normalized exact content plus duplicate occurrence index;
   - identical multisets in different order = Reordered / Source-backed prioritization;
   - exact missing or new content = Needs review;
   - protected restoration is reported from the existing guardrail report;
   - unsupported content can only be reverted in this increment.
9. Full comparison is a review presentation, not a new persisted server model. If the immutable source is unavailable, the UI states that clearly and does not label another version as source.
10. Review is available after morph generation for free and paid users. Pro-only diagnostics remain gated, but no tier skips the Review decision.
11. The progress indicator is an informational ordered list, not navigation. Back and Continue own navigation.
12. Use the existing Material Symbols and TalentConsulting brand assets. The exact visual contract is `output/resume-studio-rethink-2026-07-24/concept-final-hybrid-1440x1024.png`.
13. Adapt the image to the real suite shell:
   - compact top workspace bar;
   - horizontal six-stage progress because the existing suite rail already occupies the left edge;
   - integrated queue plus readable semantic document comparison;
   - no decorative Undo, Version history, Edit, or score controls without real behavior/data.

### Compatibility and migration

- No API or Firestore schema change.
- The session draft gains an optional versioned `resumeReview` field containing decisions, selected ledger ID, and review view. Existing drafts without it default safely.
- Legacy saved drafts continue to load; no Firestore or saved-version migration is required.
- The change ledger is derived at runtime and therefore cannot corrupt existing drafts.

### Security, privacy, accessibility, performance, and failure handling

- No resume data leaves existing product boundaries.
- No new external request or analytics payload is introduced.
- Progress exposes `aria-current`; Focused/Side-by-side uses ordinary `aria-pressed` buttons; narrow Original/Tailored switching uses one APG-style tablist with Arrow, Home, and End behavior.
- Status never relies on color alone.
- At widths below 1180px, full comparison becomes one readable document at a time through Original/Tailored tabs. At 768px and below, the queue and document become sequential panes.
- Sticky regions include scroll padding so focus is not obscured.
- Ledger derivation is memoized across the complete normalized resume and uses exact comparison only.
- Missing source, empty change set, and unsupported/new content receive explicit states.

### Rollback or recovery

- Set `ENABLE_RESUME_REVIEW_WORKBENCH` to `false` to restore the preserved legacy Resume Intelligence UI.
- Remove the two route-scoped workspace-chrome conditions to restore existing global layout.
- New component, stylesheet, ledger, and test files are isolated and can be removed without data migration.

## Ownership

| Role | Acceptance IDs | Read paths | Write paths | Prohibited actions |
|---|---|---|---|---|
| Researcher | all | relevant repo + official sources | none | edits, install, browser, deployment |
| Plan skeptic | all | plan + research + relevant repo | none | edits, deployment |
| Builder | AC-01–AC-12 | relevant Resume Studio, workspace, tokens, tests | `components/resume-studio/ResumeStudioProgress.tsx`, `components/resume-studio/ResumeReviewWorkbench.tsx`, `components/resume-studio/resume-review-workbench.css`, `lib/resume-review-ledger.ts`, `scripts/resume-review-ledger.test.js`, surgical hunks only in `app/suite/resume/page.tsx`, `components/SuiteSidebar.tsx`, and `components/workspace/WorkspaceFrame.tsx` | formatting/wholesale rewrites; auth/billing/API/guardrail/export/deploy changes |
| Auditor | all | final diff, plan, tests, captures | none | edits, approval by assertion |
| Skeptic | all | final diff, runtime, evidence | none | edits |
| Verifier | AC-01–AC-09 | local rendered app | none | edits, deployment |

## Acceptance matrix

| ID | Observable criterion | Planned implementation | Verification method | Required artifact | Status |
|---|---|---|---|---|---|
| AC-01 | Review displays a single bounded Focused Workbench rather than the legacy dashboard/card stack. | new Review component + minimal page integration | local browser at Review state, 1440×1024 | screenshot | Pending |
| AC-02 | Six conceptual stages are visible as a noninteractive ordered status list with short labels, hidden completion text, and exactly one `aria-current="step"` across Source, Target, Shape, Review, Design, and Ship; Back/Continue remain separate. | progress component | DOM snapshots for every mapped stage + keyboard journey | snapshot/log | Pending |
| AC-03 | Truth status, protected count, morph strength, Fit, ATS, Proof, local-save state, and unsupported state are compact and never fabricated. Fit comes from `matchScore`/proof, ATS from an actual scan or “Not scanned,” Proof from `proofData` or “Unavailable,” protected count from actual protected fields or category-only copy, unsupported count from the ledger, and save state only after successful session persistence. | workbench top bar + page persistence state | visual comparison, null/error states, DOM snapshot | comparison image/test | Pending |
| AC-04 | Focused and Side-by-side views switch without data loss; Side-by-side shows the immutable source and working reviewed candidate and never invents a source. View, selection, decisions, refresh, and Design → Back round-trip remain stable through the backward-compatible session draft. | workbench controls + ledger + session field | browser toggle/refresh/back journey and missing-source unit case | screenshot/test | Pending |
| AC-05 | Review items are derived honestly with exact normalized-content-plus-occurrence identities. Reorders are labeled Reordered/Source-backed prioritization; new or missing content is Needs review; `Strengthened`, `Rephrased`, or equivalent wording never renders. Duplicate bullets, reordered roles, punctuation/case changes, empty sections, no-change resumes, and multiple reorders are covered. | ledger module | focused unit tests | test log | Pending |
| AC-06 | Accept, Revert section, Review next, and Continue to Design work. Unsupported items block Accept/Continue until reverted. The immutable source is unchanged. Repeated accept/revert cycles are deterministic. No dead Edit/Undo/Version-history controls render. | workbench state + callbacks | browser journey + unit tests | log/screenshot | Pending |
| AC-07 | The existing backend morph safety, export truth, templates, save/version behavior, and downstream handoffs remain unchanged. | no changes to those modules | existing resume safety suites + scoped diff inspection | test/diff log | Pending |
| AC-08 | At 1440×900 primary review controls remain visible with no page-level horizontal overflow. Comparison uses readable semantic sections rather than scaled A4 pages. At 1180px it switches to one-document tabs; at 768px queue/document become sequential; at 390×844 and 320px/200% zoom no document text or focused control is clipped. | scoped CSS + route chrome | browser measurements and desktop/tablet/mobile/zoom screenshots | captures | Pending |
| AC-09 | Keyboard focus is visible; review-view buttons, queue, actions, and the single narrow Original/Tailored tablist are operable. Arrow/Home/End behavior, focus-not-obscured, named scroll regions, 14px minimum document text, contrast, and icon-plus-text state cues pass. | semantic controls + CSS | keyboard journey + DOM inspection | verification log | Pending |
| AC-10 | Final exact commands pass: `npm run type-check`, `npm run build`, `npm run test:resume-guardrails`, `node --test scripts/resume-review-ledger.test.js`, `npm run test:sidebar-parity`, and scoped `git diff --check`/diff inspection. | tests/build | exact commands against final revision | terminal logs | Pending |
| AC-11 | Free and paid morph completions both enter Review before Design; paid-only diagnostics remain correctly gated. | surgical `handleMorph` branch + workbench props | static branch test/inspection plus signed-in local journey fixture for both tier presentations | log/screenshots | Pending |
| AC-12 | Resume Studio route chrome is temporary and reversible: no sidebar preference is persisted or overwritten, the prior in-memory state restores on exit, and other suite routes retain their sidebar and assistant context panel. | scoped SuiteSidebar/WorkspaceFrame conditions | route transition browser journey + sidebar parity tests | log/screenshots | Pending |

## Exact integration seam

- Add imports and the feature switch near the existing Resume Studio imports/constants.
- Add optional versioned review state next to the existing Enhance-step UI state.
- Restore/persist the optional review state inside the existing `talent-resume-draft` effects without renaming or removing existing fields.
- Make `handleMorph` advance to Review for every tier; keep Pro-only scan/diagnostic controls gated inside the workbench.
- Insert one early `step === 'enhance'` render immediately after the existing derived morph evidence is computed and before the legacy morph-flow return.
- Do not delete, reformat, or relocate the existing legacy Enhance JSX.
- Path-specific pre/post diffs are mandatory for all three touched existing files.
