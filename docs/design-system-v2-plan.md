# Design System v2 — "Evidence You Can See"

**Status:** direction approved 25 July 2026. Not started.
**Prerequisite:** the repository must be recovered and committed first (`GIT-RECOVERY-RUNBOOK.md`). This plan touches nearly every file and is unreviewable against an uncommitted tree.
**Supersedes on conflict:** `DESIGN.md`, `UI_DESIGN_GUIDE.md`.

---

## 1. Why v2 exists

The problem was never a missing philosophy. It was that the existing one is **unenforceable and self-contradictory**, so drift was the predictable outcome.

Measured drift, `app/` + `components/`, 25 July 2026:

| Metric | Value |
| --- | --- |
| Distinct hardcoded hex | **508** (1,573 occurrences, 90 files) |
| Prohibited class occurrences | **1,231** |
| Distinct radius values vs one documented standard | **~70** (64% non-compliant) |
| Buttons: inline vs `btn-primary` | **344 vs 22** |
| Cards: inline vs `glass-card` | **488 vs 68** |
| Suite routes outside `SuiteToolShell` | **18 of 43** |
| Token definition files | **6** |
| Tokens referenced but never defined | **28** |
| Competing brand mark systems | **4** |

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

**Structural finding:** no single hex clears 4.5:1 on both a near-black and a near-white surface — a step light enough for dark mode is too light for white. So the accent is a **hue family with one step per mode**. This is what the current system already does; keep the shape, change the hue.

Validated candidates (contrast measured against `#131314` dark surface and `#f8f9fa` light surface):

| Family | Dark step | Ratio | Light step | Ratio |
| --- | --- | --- | --- | --- |
| **Cyan** | `#0891b2` | 5.04 | `#0e7490` | 5.08 |
| **Sky** | `#0284c7` | 4.53 | `#0369a1` | 5.63 |
| **Teal** | `#0d9488` | 4.96 | `#0f766e` | 5.19 |
| **Cobalt** | `#5a7fff` | 5.23 | `#315cff` | 4.85 |
| **Azure** | `#1e88e5` | 5.05 | `#1565c0` | 5.45 |

All five clear 4.5:1 in both modes. Selection constraints:

- **Teal is risky** — it sits close to success green (`#188038`) and will blur the accent/success distinction the evidence system depends on.
- **Azure is close to the Google blue being retired** — little differentiation gained.
- **Cobalt** is already the admin console's `--admin-cobalt` (`#315cff`), so choosing it makes the admin fold-in nearly free.
- **Cyan / Sky** are the most distinctive and sit furthest from all four reserved status hues.

**Recommendation: Cyan** (`#0891b2` dark / `#0e7490` light) — maximum separation from success/danger/warning, distinct from the retired Google blue, and it reads as precise and instrument-like, which suits a career console. **Cobalt** is the pragmatic alternative if minimising admin churn matters more than distinctiveness.

Reserved and unchanged: success `#188038`, danger `#d93025`, warning `#e37400`. Status always ships with an icon and label, never color alone.

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

Each phase ends green on `type-check`, `build`, and a browser run at 320/390/430/768/1024/1440px.

### Phase 0 — Prerequisite
Repo recovered, committed, pushed. **Do not begin Phase 1 before this.**

### Phase 1 — One source of truth
- Collapse 6 token files into one canonical token module.
- Define or delete the 28 phantom tokens.
- Resolve every `DESIGN.md` / `UI_DESIGN_GUIDE.md` contradiction; both become pointers to this document.
- Introduce the accent family and the four evidence-state tokens.
- Rename `.glass-card` → `.surface-card`. The current name describes a banned treatment.

*Exit: one token file, zero undefined tokens, both legacy docs superseded.*

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

- [ ] One token file; 0 undefined tokens
- [ ] Distinct hardcoded hex in `app/` + `components/` **< 20** (down from 508)
- [ ] Prohibited class occurrences **0** (down from 1,231)
- [ ] Distinct radius values **≤ 6** (down from ~70)
- [ ] Inline button patterns **< 20** (down from 344)
- [ ] Inline card patterns **< 30** (down from 488)
- [ ] All 43 suite routes on `SuiteToolShell`
- [ ] `design:audit:ci` green and gating CI
- [ ] One brand mark system
- [ ] PDF/DOCX exports match the web preview
- [ ] WCAG 2.2 AA across both themes
- [ ] Browser run clean at 320/390/430/768/1024/1440px
- [ ] `type-check`, `build`, and all test suites green
