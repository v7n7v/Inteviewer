# Resume Studio combined UX and accessibility audit

Date: 2026-07-24  
Surface: production desktop workflow at `talentconsulting.io/suite/resume`  
Mode: evidence-based workflow audit; no implementation changes

## 1. Audit scope

The audit follows the current journey from Resume Studio entry through role targeting, Resume Intelligence, templates, and export. It evaluates task entry, hierarchy, interaction flow, trust, accessibility risks, and responsive resilience.

Captured states:

1. [Entry and import](./01-start-current.png)
2. [Role target and rewrite strength](./02-role-target-current.png)
3. [Resume Intelligence](./03-resume-intelligence-current-full.png)
4. [Template selection](./04-template-current-full.png)
5. [Creative template preview](./05-template-creative-current.png)
6. [Export station](./06-export-current-full.png)

## 2. User goal and accessibility target

The primary user is a job seeker with a master resume who wants to create a role-specific version quickly, without invented facts, and leave with a polished, ATS-safe document.

The target experience should:

- let a user reach the first tailored preview in under two minutes;
- keep truth protection visible without turning it into another large panel;
- remain usable with keyboard, screen magnification, reduced motion, and non-color status cues;
- keep the main workflow within one desktop viewport, using intentional local scrolling only;
- make every AI-authored change explainable and reversible.

## 3. Strengths

- The product has a strong underlying sequence: source, target, improve, design, ship.
- Truth-oriented language already appears in rewrite strength and export readiness.
- Morph strength gives users meaningful control over how aggressively content changes.
- A live resume preview makes the work concrete.
- Resume Intelligence connects ATS, clarity, proof, and skim quality.
- Template switching preserves optimized content.
- Export readiness and school-name verification are valuable trust signals.
- Downstream connections to applications, cover letters, LinkedIn, and interview preparation create a coherent career workspace.
- Draft persistence and recent versions reduce fear of losing work.

## 4. UX risks

### Structural risks

1. **The first page explains the workflow three times before the user can meaningfully act.** Starting-point cards, the large import workspace, and the four-step workflow strip repeat the same story.
2. **The page hierarchy is card-driven instead of task-driven.** Every concept receives its own bordered box, so primary work, reassurance, metadata, and education all compete at the same visual level.
3. **Resume Intelligence behaves like a dashboard, a review queue, a document preview, and a launchpad simultaneously.** The screen contains four score cards, scan controls, three priority groups, repeated recommendation cards, connected next moves, a full preview, four tools, version compare, saved blueprints, and session summary.
4. **The workflow header consumes space without reducing uncertainty.** A large title banner, five-step control, save banner, and recommendation banner appear above the actual task.
5. **Template choice is quantity-first rather than confidence-first.** Twenty-five text rows ask the user to imagine visual differences while only one full preview is visible.
6. **The template taxonomy mixes audience, visual style, industry, density, and seniority.** “Executive,” “Technical,” “Creative,” “Compact,” “Federal,” and “Startup” are not mutually exclusive decision dimensions.
7. **The export page repeats the full resume without helping the final decision.** The large document dominates the page while the actionable export controls are compressed into a narrow rail.
8. **Secondary destinations appear too early.** Cover letter, LinkedIn, interview, blueprint, and application actions distract before the resume itself is complete.
9. **Progress state is inconsistent.** The workflow calls the third stage “Resume Intelligence,” while earlier copy calls it “Improve” or “Optimize.” The save banner and “recommended next” banner do not reliably explain blockers.
10. **Large fixed regions create desktop inefficiency.** At common laptop heights, Resume Intelligence requires multiple screenfuls; the template and export states also create competing local and page scroll regions.

### Interaction risks

- “Start Over” is visually prominent but potentially destructive; no consequence is explained.
- Recent-version cards contain nested delete actions inside load actions, which can create semantic and keyboard ambiguity.
- “Keep,” “Pass,” and “Ignore” are not self-evident as distinct decisions.
- Disabled “Apply” actions sit next to active decision controls without a clear reason at the point of action.
- A global “Run Scan” and a second “Run Scan” appear in the same screen.
- Template rows describe style but do not provide useful visual thumbnails.
- Morph strength and target length are configured before the user sees a predicted outcome.
- Export readiness is presented as six equal checks even though some are hard blockers and others are informational.

## 5. Accessibility risks

These are likely risks from visual and DOM inspection; they are not a WCAG compliance determination.

- Small uppercase labels and muted helper text appear below comfortable contrast and size thresholds.
- Many controls rely on subtle border, background, or accent-color changes to communicate selection.
- Dense card boundaries increase visual noise for users with attention, cognitive, or low-vision needs.
- Nested button structures in recent versions can produce confusing focus and screen-reader behavior.
- The large horizontal workflow may not reflow cleanly under zoom.
- Multiple scroll regions in templates and previews can trap keyboard or screen-magnifier users.
- Morph-strength states need explicit programmatic value, change announcements, and keyboard controls.
- Statuses such as safe, recommended, ready, pro, selected, and active need text equivalents and consistent semantics.
- Repeated headings and generic button labels such as “Run Scan,” “Template,” and “Save” may be ambiguous outside visual context.
- The very wide export composition visibly clips content at the right edge in the captured desktop state, indicating limited reflow resilience.

## 6. Opportunity areas

- Separate the resume library from the active studio so entry is fast and the workspace stays focused.
- Replace page-level stacking with a stable one-viewport workbench.
- Turn truth protection into a persistent system state, not another informational card.
- Make the core object a reviewable change ledger: source, proposed change, evidence, confidence, and accept/revert.
- Make morph strength predictive: show what changes at each level before generation.
- Curate a small set of genuinely distinct resume systems with visual thumbnails and role-fit guidance.
- Move connected tools to a clear “What next?” moment after the resume is saved or exported.
- Replace repeated banners with one compact workspace status line.
- Use progressive disclosure for power-user diagnostics, version compare, keyword map, and blueprint tools.

## 7. Evidence limits and verification gaps

- No real optimization request was run, so generation latency, failure recovery, and post-generation focus behavior were not verified.
- PDF and Word downloads were not triggered.
- Keyboard-only navigation, screen-reader output, zoom behavior, and reduced-motion behavior require implementation-level testing.
- Mobile behavior was not tested in this pass.
- Template output was visually compared in the product, but exported-file fidelity was not verified.

## 8. Priority recommendations

### P0 — Rebuild the workflow frame

- One persistent studio shell.
- One primary task per stage.
- One primary action in the viewport.
- No page-level vertical scroll at 1440 × 900; use bounded internal preview/review scrolling.

### P0 — Make trust operational

- Truth Lock always on by default.
- Every changed claim has a provenance state.
- Hard facts are locked unless explicitly edited by the user.
- Every AI change is reversible.

### P0 — Replace Resume Intelligence card stacks

- Show a ranked change queue beside the live document.
- Combine ATS, clarity, and proof into a compact diagnostic summary.
- Put details in a drawer, not the main path.

### P1 — Redesign template choice

- Begin with six unmistakably different systems, not twenty-five similar list items.
- Show real thumbnails first; filters and palette controls second.
- Explain the tradeoff: ATS safety, density, personality, and target audience.

### P1 — Redesign export

- Make save/download the focal action.
- Treat readiness as blocker resolution, not a decorative checklist.
- Reveal downstream destinations only after the resume is safely saved.

