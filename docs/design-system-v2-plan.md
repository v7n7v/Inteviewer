# Design System v2 — "Evidence You Can See"

**Status:** direction approved 25 July 2026. Not started. Metrics and the accent decision re-measured 25 July 2026 — see §1 and §3.1; **the accent choice is reopened and Phase 1 must not implement one until it is confirmed.**
**Prerequisite:** the repository must be recovered and committed first (`GIT-RECOVERY-RUNBOOK.md`). This plan touches nearly every file and is unreviewable against an uncommitted tree.
**Supersedes on conflict:** `DESIGN.md`, `UI_DESIGN_GUIDE.md`.

---

## 1. Why v2 exists

The problem was never a missing philosophy. It was that the existing one is **unenforceable and self-contradictory**, so drift was the predictable outcome.

Measured drift, `app/` + `components/` (411 files), re-measured by `node scripts/design-audit.js` on 25 July 2026:

| Metric | Value | Earlier hand count |
| --- | --- | --- |
| Distinct hardcoded hex | **465** (1,553 occurrences) | 508 |
| Prohibited class occurrences | **1,290** | 1,231 |
| Distinct radius values vs one documented standard | **32** | ~70 |
| Buttons: inline vs `btn-*` | **301 vs 22** | 344 vs 22 |
| Cards: inline vs shared | **1,212 vs 68** | 488 vs 68 |
| Suite routes outside `SuiteToolShell` | **22 of 43** | 18 of 43 |
| Token definition files | **6** | 6 |
| Tokens referenced but never defined | **23** | 28 |
| Competing brand mark systems | 4 *(not tool-measured)* | 4 |

**`scripts/design-audit.js` is the authority for these numbers, not this table.** The first column is a snapshot; re-run the tool rather than trusting it.

The hand counts in the second column are what the rest of this document was originally written against, and two of the differences change scope materially: **inline cards are 1,212, not 488** — Phase 3 is roughly 2.5× the size it was planned at — and the prohibited-class count rose because the audit was extended to catch CSS-level occurrences that a `.tsx`-only scan missed.

The existing documents contradict each other on cyan/emerald, gradients, card background, and sidebar width — and the shared card class is called `.glass-card` while both documents ban glass. An engineer reading all of it and choosing reasonably still drifts.

**Conclusion: enforcement is the deliverable. The philosophy only tells you what to enforce.**

---

## 2. The philosophy

> **Evidence you can see.**

The product's promise is that nothing is invented, everything is inspectable, and nothing leaves without approval. The design system encodes that promise directly: **color carries epistemic status, not decoration.**

This is already latent in `docs/taco-brand-system.md`'s trust contract and in `design-qa.md`'s rule that *"unknown evidence remains unknown rather than becoming a measured zero."* v2 makes it the organising principle.

### The four evidence states

| State | Meaning | Treatment |
| --- | --- | --- |
| **Verified** | from the user's resume or a trusted source | full ink, solid left rule |
| **Inferred** | model reasoning, not fact | secondary ink, dotted left rule |
| **Draft** | generated, awaiting review | accent-tinted surface, provisional marker |
| **Missing** | no evidence exists | dashed outline, muted ink — **never a zero** |

**Encode state primarily through weight, rule style and ink — not hue.** This keeps the color budget small, survives 320px, and satisfies WCAG's never-color-alone rule by construction. Hue is reserved for one accent plus the four fixed status colors.

### Register

Near-monochrome canvas. One accent. Generous negative space. Tabular numerals. No gradients, no glass, no shadows as decoration. Calm, because the user is job-hunting and stressed — the interface should lower the temperature, not perform at them.

The "Silicon Valley clean" quality is the *output* of that restraint, not a style borrowed from elsewhere.

---

## 3. Decisions taken

### 3.1 Accent — new hue family

The old `--accent` (`#a8c7fa` dark / `#1a73e8` light) reads as generic Google, and a stray emerald ships in the sidebar with no token behind it. Both retire.

> ⚠️ **This section was re-measured on 25 July 2026 and its original recommendation did not survive.** Two claims below were wrong: that one step per mode is sufficient, and that Cyan gives the greatest separation from the status hues. The decision is **reopened** — see the bottom of this section. Nothing has been implemented against it yet.

**Original structural finding:** no single hex clears 4.5:1 on both a near-black and a near-white surface, so the accent is a **hue family with one step per mode**.

That is true but incomplete, and the incompleteness is the problem. Contrast was validated against exactly one surface per mode (`#131314` dark, `#f8f9fa` light). The token system actually defines **seven surfaces per mode**, spanning far more luminance than a single step can cover:

| Surface | Cyan dark `#0891b2` | Surface | Cyan light `#0e7490` |
| --- | --- | --- | --- |
| `--bg-deep` `#0b0b0b` | 5.35 ✅ | `--bg-deep` `#ffffff` | 5.36 ✅ |
| `--bg-surface` `#131314` *(only one validated)* | 5.04 ✅ | `--bg-surface` `#f8f9fa` *(only one validated)* | 5.08 ✅ |
| `--bg-elevated` / `--card-bg` `#1a1a1b` | 4.72 ✅ | `--bg-elevated` `#f1f3f4` | 4.81 ✅ |
| `--bg-input` `#1e1e1f` | 4.52 ✅ | `--card-bg` / `--bg-input` `#ffffff` | 5.36 ✅ |
| `--bg-hover` `#1f1f21` | **4.47 ❌** | `--bg-hover` `#e8eaed` | **4.45 ❌** |
| `--theme-surface-active` `#232325` | **4.26 ❌** | `--theme-surface-active` `#e8eaed` | **4.45 ❌** |

**Cyan fails AA on hover and active surfaces in both themes** — and hover/active is exactly where accent-colored interactive text lives, so the failure is concentrated where the accent is used most.

No candidate passes on all ten surfaces. **The one-step-per-mode model is the actual defect, not the hue.** Whichever family is chosen needs either a step per *surface tier*, or hover/active surfaces constrained so they stop shifting luminance this far.

### Candidates, fully measured

Hue separation is CIELAB LCh angle from the nearest reserved status color (success `#188038` 145°, danger `#d93025` 37°, warning `#e37400` 61°). Chroma is a proxy for visual insistence — lower is calmer, which matters for an anxious user.

| Family | Dark / light step | Min hue sep | Chroma | AA pass (of 10 surfaces) |
| --- | --- | --- | --- | --- |
| **Azure** | `#1e88e5` / `#1565c0` | **122°** | 55 | **8/10** |
| **Sky** | `#0284c7` / `#0369a1` | 118° | 43 | 6/10 (worst 3.83) |
| **Cobalt** | `#5a7fff` / `#315cff` | 100° | **95** | **8/10** |
| **Cyan** | `#0891b2` / `#0e7490` | 87° | **33** | 7/10 |
| **Teal** | `#0d9488` / `#0f766e` | **39°** ❌ | 35 | 7/10 |

The original text rejected Teal for sitting too close to success green — correctly, at 39°. But it then selected **Cyan, the next-closest at 87°**, on the stated grounds of "maximum separation from success/danger/warning." That claim is false: Azure (122°), Sky (118°) and Cobalt (100°) all separate further.

Azure's only recorded demerit was proximity to the retired Google blue. That is a *brand* objection, and it loses to an accessibility failure. It also cuts the other way: blue-family reads as "interactive" by convention, so proximity is a usability asset for a link color.

### The conflation to resolve first

The accent is being asked to do two jobs with opposite optimal answers:

- **Interactive affordance** — links, buttons, focus rings. Wants to be *conventional*.
- **Brand identity** — wants to be *distinctive*.

Fusing them is what produced the argument that cyan "reads as precise and instrument-like" — brand reasoning applied to a link color, which pushed the choice toward the weakest option on separation and a real contrast failure. Carry distinctiveness in the TACO mark, typography and register, where it costs nothing in comprehension.

### Status: reopened — owner decision

**Recommendation: Azure** (`#1e88e5` dark / `#1565c0` light), best or tied-best on both measured criteria, plus per-surface-tier steps to close the hover/active gap.

**Cobalt** remains the pragmatic alternative — equal AA pass rate and it is already `--admin-cobalt` (`#315cff`), making the admin fold-in nearly free — at the cost of chroma 95, by far the most visually insistent option.

This is a product/brand tradeoff the plan does not settle on measurement alone. **Do not implement an accent until it is confirmed.** Reserved and unchanged either way: success `#188038`, danger `#d93025`, warning `#e37400` (light `#a85200`). Status always ships with an icon and label, never color alone.

### 3.2 Admin — fold in, keep density

Retire the 30 `--admin-*` tokens. Fix the **7 tokens that shadow global names with different values** (`--text-primary`, `--text-secondary`, `--text-tertiary`, `--theme-bg-card`, `--theme-border`, `--theme-shadow`, `--theme-surface-hover`) — this is an active naming collision, not shared tokens.

Preserve admin's higher information density through a **density modifier** (`data-density="compact"`) that adjusts spacing and row height only. Density is a layout concern; it does not justify a separate palette.

### 3.3 Brand — TACO is the assistant, TC is the company

Per `docs/taco-brand-system.md`: the `TC` monogram is the company mark; `TACO` is the assistant identity.

- Retire the `brand-*` family and the entire `components/sona/` mark system (`SonaMark`, `SonaMarkV2`, `SonaMarkV2Defs`, `sona-v2-geometry` — 20+ bespoke gradient hex sharing nothing with any token).
- Fix `components/BrandLogo.tsx`: `TACO_MARK` points at `/taco-icon-512.png`, outside `public/brand/`, ignoring the eight `taco-mark-*.png` sizes that exist.
- Fix `emails/tokens.ts`: `tacoMarkUrl` currently aliases the **TalentConsulting** mark, so Taco branding silently disappears in email.

### 3.4 Resume templates — excluded, deliberately

`components/resume-templates/` and `lib/resume-templates/` stay visually independent. They are documents for employers, not product UI. Separation verified clean: zero `dark:` variants, no app semantic classes, document fonts (Georgia, Cambria, Arial Narrow, Impact) intentionally non-product.

Only cleanup: normalise their 86 distinct hex into the `catalog.ts` palettes rather than scattering them across renderers.

---

## 4. Phases

Each phase ends green on `node scripts/verify.js` (types, build, tests, design drift, CVE) and, if anything renders, `node scripts/ui-verify.js` at 320/390/430/768/1024/1440px in both themes. Both scripts exist as of 25 July 2026; the manual checklist this section originally described is superseded by them.

### Phase 0 — Prerequisite
Repo recovered, committed, pushed. **Do not begin Phase 1 before this.**

*Status, 25 July 2026:* recovered ✅ · committed ✅ · **pushed ❌**.

The repository was repaired **in place** by restoring the missing pack file, not by the fresh clone this document originally assumed — `git diff` works and history is whole at 96 commits. The working tree is committed across 15 commits on `codex/admin-command-grid`. The push is blocked on GitHub credentials, which is an owner action. Phase 0 is not met until it lands.

### Phase 1 — One source of truth
- Collapse 6 token files into one canonical token module. Handle the **7 admin tokens that shadow global names with different values** (§3.2) as part of this — `admin-command-grid.css` holds 60 of the 256 definitions, and collapsing without resolving the collision will silently restyle admin.
- Define or delete the **23** phantom tokens (tool-measured; this document previously said 28). Each is a judgment call — deleting a referenced-but-undefined token changes rendering by falling back to inherited or initial. Produce the list with a proposed disposition and get it approved rather than deciding 23 things inside a whole-repo diff.
- Resolve every `DESIGN.md` / `UI_DESIGN_GUIDE.md` contradiction; both become pointers to this document.
- Introduce the four evidence-state tokens. **The accent family is blocked** pending the reopened decision in §3.1 — and whichever family wins needs a step per surface tier, not one per mode.
- Rename `.glass-card` → `.surface-card`. The current name describes a banned treatment.

*Exit: one token file, zero undefined tokens, both legacy docs superseded, no shadowed token names.*

### Phase 2 — Make violations impossible
This is the phase that determines whether v2 survives contact with a deadline.

- **Tailwind theme override** so raw palette classes (`bg-violet-500`, `text-white`) *do not exist* — a compile error, not a review comment.
- **ESLint rules**: no hex literals in `.tsx`; no prohibited class list.
- **`npm run design:audit:ci`** computing the §1 table and failing on regression. Model it on the existing `seo:audit:ci` / `security:cve:ci` gates.
- Wire into `.github/workflows`.

*Exit: a PR reintroducing a hardcoded hex fails CI.*

### Phase 3 — Primitives you cannot bypass
- One `Card`, one `Button`, one `Field`, one `Shell`, one `StatTile`, one `EvidenceBadge`.
- Migrate the 344 inline buttons and 488 inline cards.
- Bring the 18 non-adherent suite routes into `SuiteToolShell`.

*Exit: inline card/button patterns near zero; all 43 suite routes on the shell.*

### Phase 4 — Evidence semantics
- Implement the four states as real components.
- Apply to the surfaces where epistemic status actually matters: job cards, resume diff/morph, ATS score, packet review, Taco responses.
- Every AI-generated value carries a state. No unmarked model output.

*Exit: a user can tell fact from inference at a glance on every AI surface.*

### Phase 5 — Fold in the outliers
Ordered by user-visible harm:

1. **PDF/DOCX export** — three font systems; Editorial and Brutalist templates silently render as Helvetica because `@react-pdf/renderer` only registers Inter. This is a real bug, not just inconsistency. 69 duplicated hex to import from `catalog.ts` instead.
2. **Admin** — per §3.2.
3. **Marketing** — `app/for-teams`, `app/blog`, `app/templates` bypass tokens entirely with raw Tailwind literals.
4. **Landing** — `GuidedCareerLanding.module.css` declares 14 local tokens and 136 hex, hybridised with globals.
5. **Brand** — per §3.3.
6. **Email** — internally the cleanest surface already (`emails/tokens.ts`, zero hex in templates); only its 18 token *values* need reconciling. Note `#2E3FFF` matches nothing in globals.

### Phase 6 — Charts
Only 3 files use Recharts; **37 hand-roll inline SVG** with hardcoded hex — that's where most in-TSX color lives.

- One chart primitive layer over Recharts.
- Categorical palette assigned in fixed order, never cycled.
- **No dual-axis charts.** Two measures of different scale → two charts or index to a common base.
- Sequential = one hue light→dark; diverging = two hues with a neutral midpoint.
- Status colors never reused as a series color.
- Validate the palette programmatically for contrast and colorblind separation — do not eyeball it.
- Dark mode is a *selected* set of steps, not an automatic flip.

---

## 5. Register split — product vs marketing

`DESIGN.md` is right that suite tools are product UI and should not carry brand-page spectacle. v2 keeps that split but makes it explicit and bounded:

- **Product** (suite, admin, tools): restrained surfaces, compact density, one accent, evidence states.
- **Marketing** (landing, blog, for-teams, templates): may use larger type, more space, and motion — but **must draw from the same tokens**. Divergence is in scale and rhythm, never in a private palette.

The current failure is not that marketing looks different. It's that marketing invented its own colors.

---

## 6. Definition of done

Baselines below are the tool-measured values recorded in `.design-audit-baseline.json` on 25 July 2026. Re-run `node scripts/design-audit.js` rather than trusting them.

- [ ] One token file; **0** undefined tokens (from 23)
- [ ] No token name shadowed with a different value (from 7)
- [ ] Distinct hardcoded hex in `app/` + `components/` **< 20** (from **465**)
- [ ] Prohibited class occurrences **0** (from **1,290**)
- [ ] Distinct radius values **≤ 6** (from **32**)
- [ ] Inline button patterns **< 20** (from **301**)
- [ ] Inline card patterns **< 30** (from **1,212**)
- [ ] All 43 suite routes on `SuiteToolShell` (from **22** off-shell)
- [ ] `design-audit.js --ci` green and gating CI
- [ ] One brand mark system
- [ ] PDF/DOCX exports match the web preview
- [ ] WCAG 2.2 AA across both themes — **validated per surface tier, not per mode** (see §3.1)
- [ ] Browser run clean at 320/390/430/768/1024/1440px in both themes, via `node scripts/ui-verify.js`
- [ ] Screenshot baselines gating CI — static audit cannot catch the theme-cascade P0 class
- [ ] `node scripts/verify.js` green (types, build, tests, design drift, CVE)
