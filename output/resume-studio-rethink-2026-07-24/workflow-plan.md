# Resume Studio ground-up workflow plan

Date: 2026-07-24  
Status: concept plan only; no build

## Product thesis

Resume Studio should feel like a calm editing room, not a control center filled with dashboards.

The user should always understand:

1. What am I doing now?
2. What is Taco changing?
3. Which facts are protected?
4. What do I need to decide?
5. When is this resume ready?

The core interaction model is **one mission, one canvas, progressive depth**.

## The new information architecture

### Resume Home

A compact library outside the active workflow:

- Master resume
- Recent tailored versions
- Start from file
- Start from master
- Create from scratch

Selecting a source opens the Studio. The long intake explainer, workflow infographic, format statistics, and connected-next cards disappear.

### Resume Studio

A persistent three-region workbench:

- **Slim left rail:** Source → Target → Shape → Review → Design → Ship
- **Main work area:** the single decision required at the current stage
- **Live document area:** resume preview or before/after evidence, collapsible when the task needs more room

A compact top line contains:

- resume/version name;
- autosave state;
- Truth Lock state and protected-fact count;
- undo/version history;
- exit to Resume Home.

A sticky bottom action bar contains:

- Back;
- one primary next action;
- optional secondary action such as Save draft.

## End-to-end stages

### 0. Choose source

Goal: begin in one action.

Default:

- “Use master resume” is primary when a master exists.
- “Upload another resume” and “Build from scratch” are secondary.
- Recent versions appear as a compact switcher, not a grid of large cards.

Success state:

- the document opens immediately;
- parsing happens in context;
- no separate marketing-style intake page.

### 1. Confirm source

Goal: establish the factual contract before AI edits.

The user sees:

- parsed name, contact, roles, employers, dates, education, and certifications;
- obvious extraction warnings;
- protected-fact count;
- a short statement: “Taco can rewrite language, but cannot invent employers, dates, degrees, credentials, or metrics.”

Interactions:

- edit a field inline;
- lock or unlock a user-authored fact;
- resolve extraction uncertainty;
- confirm the source.

Hard blocker:

- unresolved missing employer/date/education identity that would make later output unsafe.

### 2. Target role

Goal: tell the system what success looks like.

Primary input:

- paste job description, paste a job URL, or select a tracked application.

Automatic extraction:

- role title;
- company;
- seniority;
- must-have capabilities;
- recurring language;
- likely ATS terms.

The user confirms a concise target brief rather than reading four metadata cards.

Optional advanced details:

- hiring manager or team context;
- priority themes;
- role-specific exclusions.

### 3. Shape

Goal: decide how far the resume should move.

Morph Strength becomes a predictive control with four intentional modes:

- **Preserve:** keywords and ordering only;
- **Balance:** rewrite phrasing and reorder proof;
- **Elevate:** stronger narrative and structure using existing evidence;
- **Reframe:** substantial rewrite and section reorganization, with Truth Lock still enforced.

For each level, the interface previews:

- estimated number of rewritten bullets;
- sections likely to move;
- protected facts unaffected;
- page-length impact;
- sample before/after sentence.

The control is continuous if desired, but named anchor points make the result understandable. Target length is a consequence preview, not a disconnected button group.

Primary action:

- “Create tailored draft.”

### 4. Review

Goal: approve a trustworthy set of changes.

This replaces the current Resume Intelligence card stack.

The main area is a ranked change ledger:

- **Protected:** verified facts that did not change;
- **Strengthened:** evidence already present but phrased more clearly;
- **Reordered:** existing proof moved for relevance;
- **Removed:** lower-value content proposed for deletion;
- **Needs you:** suggestions that require user confirmation or a missing metric.

Each change includes:

- original text;
- proposed text;
- reason tied to the role;
- source evidence;
- confidence/provenance label;
- Accept, Edit, or Revert.

The live preview highlights the currently selected change. Accepting a change updates the document immediately.

Compact diagnostics at the top:

- Fit;
- ATS readability;
- Proof;
- Clarity.

Clicking a diagnostic opens a detail drawer. Scores never become four large standalone cards.

Review completion:

- all high-risk items resolved;
- no unsupported claim;
- optional lower-priority items can be deferred.

### 5. Design

Goal: choose a visual identity with confidence.

Start with six signature systems that are genuinely different:

1. **Essential** — ultra-clean, ATS-first single column.
2. **Executive** — refined serif/sans editorial hierarchy.
3. **Technical** — structured engineering layout with project and skills emphasis.
4. **Editorial** — elegant white-space-led storytelling.
5. **Bold** — brutally vibrant, high-energy composition for creative and startup candidates.
6. **Compact** — dense but controlled one-page system.

Template selection uses:

- large visual thumbnails;
- one-line fit guidance;
- ATS and density indicators;
- live full-document preview.

Palette, type scale, and spacing are secondary controls after a system is chosen. Color swaps do not masquerade as separate templates.

Primary action:

- “Use this design.”

### 6. Ship

Goal: safely complete the job.

Readiness is a compact blocker list:

- unresolved fact warning;
- unsupported claim;
- missing contact/source identity;
- overflow or page-break problem;
- export fidelity issue.

When clear, the screen centers:

- Download PDF;
- Download Word;
- Save version.

After save or download, reveal:

- Attach to application;
- Create cover letter;
- Practice interview;
- Update LinkedIn.

The next-tool handoff carries the exact source resume, target role, approved changes, and selected template.

## Trust system

### Truth Lock

Always visible as a compact status in the top bar.

Protected by default:

- employers;
- titles;
- dates;
- schools;
- degrees;
- certifications;
- locations;
- numeric metrics;
- technologies not found in the source.

Changing a protected fact requires explicit user action. Taco may ask for missing evidence but never fills it in.

### Provenance states

Every sentence or bullet has one of four states:

- Source fact
- AI-rephrased from source
- User-authored
- Needs verification

No color-only encoding; each state has text and icon support.

### Reversibility

- every accepted change can be reverted;
- autosaved named checkpoints;
- before/after comparison at section, change, and full-version levels;
- “Start Over” becomes “Exit draft,” with a clear save/discard decision.

## What leaves the main workflow

- hero/marketing header;
- formats/workflow/output stat boxes;
- duplicate import explanation;
- studio workflow infographic;
- repeated save and recommendation banners;
- four separate score cards;
- multiple “Run Scan” actions;
- repeated recommendation mini-cards;
- connected-next actions before completion;
- twenty-five text-only template rows;
- power-user diagnostics in the primary path;
- full-length resume repeated on the export page.

These features are either removed, reduced to a compact status, or moved into contextual drawers.

## Error, loading, and recovery states

### Parsing

- show skeleton sections inside the future resume canvas;
- identify what was extracted as it arrives;
- make partial success usable;
- offer paste-text fallback inline.

### Generation

- show stage-based progress: analyzing target, mapping evidence, drafting, validating;
- keep the original resume visible;
- allow cancellation;
- preserve the target and morph settings after failure.

### Unsupported or ambiguous claim

- do not silently omit or fabricate;
- move it to “Needs you” with a specific question;
- explain what evidence would resolve it.

### Export

- preflight page breaks, font embedding, hyperlink safety, and selectable text;
- show a precise blocker;
- never consume an export credit when preflight fails.

## Responsive behavior

### Desktop

- no page-level scrolling at 1440 × 900;
- the change queue and document preview scroll independently and intentionally;
- preview stays visible during Shape and Review.

### Tablet

- left step rail becomes a compact top progress control;
- preview toggles between split and focus mode.

### Mobile

- one pane at a time;
- persistent “Work / Preview” toggle;
- sticky bottom primary action;
- drawers become full-screen sheets;
- morph strength uses labeled steps, not a tiny continuous slider.

## Accessibility requirements

- 44 × 44 px minimum touch targets;
- 14–16 px body text with comfortable line height;
- keyboard-complete workflow and visible focus;
- programmatic stage, progress, validation, and autosave announcements;
- slider anchors accessible as radio-like named choices;
- no status communicated by color alone;
- contrast verified in all palettes;
- preview zoom controls and reflow-safe surrounding UI;
- reduced-motion mode for transitions and generation states;
- clear error summary plus error at the relevant field;
- no nested interactive controls.

## Success measures

- first source loaded in one action;
- first tailored preview in under two minutes for a returning user;
- no more than two major surfaces visible alongside navigation;
- zero unsupported generated claims;
- 100% of AI changes have provenance;
- every change can be reverted;
- no page-level vertical scroll at 1440 × 900;
- template choice completed from visual comparison, not text guessing;
- export blockers are resolved before download begins;
- downstream handoff requires no re-upload or re-pasting.

## Recommended implementation sequence after concept selection

1. Build the persistent Studio shell and separate Resume Home.
2. Implement source confirmation and Truth Lock.
3. Replace targeting and morph configuration.
4. Implement the change ledger and live preview.
5. Replace the template menu with six signature systems.
6. Rebuild export readiness and downstream handoff.
7. Complete responsive, keyboard, screen-reader, and export-fidelity verification.

