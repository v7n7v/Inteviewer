# Decisions

Append-only. Newest at the top. One entry per decision that would otherwise get re-litigated.

**Why this file exists:** the pricing contradiction ($2.99 vs $4.99/$9.99 vs $19/$49) survived across three documents for months because each recorded a *price* but none recorded *which superseded which, or why*. Every entry here is cheap to write and saves someone re-deriving a conclusion you already reached.

**Write an entry when:** you make a call that a reasonable person could have made differently, you reject an approach for a non-obvious reason, or you discover a constraint that closes off options. Not for routine implementation choices.

**Format:**

```
## YYYY-MM-DD - Short title
**Decision:** what was chosen.
**Constraint:** the fact that forced it. This is the part that ages well.
**Rejected:** what else was considered, and why not.
**Revisit if:** the condition under which this should be reopened. Omit if permanent.
```

---

## 2026-07-25 - Accent decision reopened; Cyan's justification did not survive measurement

**Decision:** The accent choice is **reopened**. Phase 1 must not implement an accent until an owner confirms one. Recommendation is **Azure** (`#1e88e5` dark / `#1565c0` light), with a step per *surface tier* rather than one per mode.

**Constraint:** Two measurements contradict the earlier entry.

*Contrast.* The original validation used one surface per mode (`#131314`, `#f8f9fa`). The token system defines seven per mode. Cyan scores 4.47 on `--bg-hover` and 4.26 on `--theme-surface-active` in dark, and 4.45 on both in light - **failing AA on exactly the surfaces where interactive accent text lives.** No candidate passes all ten surfaces, so *one step per mode is itself the defect*, independent of hue.

*Hue separation.* Measured as CIELAB LCh angle to the nearest reserved status color, Cyan is **87°** - the second-worst of the five, after the Teal that was already rejected at 39° for exactly this reason. Azure is 122°, Sky 118°, Cobalt 100°. The earlier entry's stated ground for Cyan, "maximum separation from success/danger/warning," is false.

**Rejected:** Keeping Cyan and accepting the two failing surfaces. The failures are on hover and active states, which is where a link colour is most used, not an edge case. Also rejected: switching to Azure unilaterally - the original objection to it (proximity to the retired Google blue) is a brand judgement, and brand judgements are the owner's, not measurement's. Recorded here so the tradeoff is visible rather than re-derived.

**Note:** Azure's demerit may be an asset. Blue-family reads as "interactive" by convention, so proximity to a familiar blue helps comprehension. The deeper issue is that one token is being asked to carry both interactive affordance (wants conventional) and brand identity (wants distinctive). Distinctiveness is cheaper to carry in the TACO mark, typography and register.

**Revisit if:** the owner confirms a family, or brand work establishes a company colour that should also serve as the product accent.

## 2026-07-25 - Design drift metrics re-baselined against the audit tool

**Decision:** `scripts/design-audit.js` and `.design-audit-baseline.json` are the authority for drift metrics. The hand counts previously carried in `CLAUDE.md` and `docs/design-system-v2-plan.md` are superseded.

**Constraint:** The tool disagrees with the hand counts on eight of nine metrics, and two differences change scope materially. **Inline cards are 1,212, not 488** - Phase 3 is roughly 2.5× its planned size, and its exit criterion was written against the wrong number. **Undefined tokens are 23, not 28.** Prohibited classes rose (1,290 vs 1,231) because the audit was extended to catch CSS-level occurrences a `.tsx`-only scan missed; hex, radii and buttons all fell.

**Rejected:** Updating the documents to new fixed numbers and leaving it there. That reproduces the original failure - three documents carrying three sets of numbers for the same metrics. The tables now point at the tool and are labelled as snapshots.

## 2026-07-25 - Repository repaired in place; the fresh clone was not needed

**Decision:** The damaged clone was repaired **in place** by restoring the missing pack file. `C:\dev\talent-consulting` was never created. Work is committed across 15 commits on `codex/admin-command-grid`, in the original OneDrive-hosted folder.

**Constraint:** `pack-3b21952154748776d171e0df6104b4c73e7b860c.pack` was found byte-matching the surviving `.idx`, in a sibling folder - not in the recycle bin the runbook directed us to check. Restoring it fixed `git diff` and returned history to a whole 96 commits, which made the migration unnecessary for recovery purposes. Getting 2.5 months of work onto the remote quickly mattered more than relocating the folder.

**Rejected:** Proceeding with the fresh clone anyway. Defensible - it also solves the OneDrive root cause - but it would have delayed committing uncommitted work in order to perform a move that can happen at any time afterwards.

**Correction to the earlier entry below:** its accepted-loss list was wrong. `codex/audit-automation-recovery` and `codex/release-safe-cleanup` were **never lost** - both are on GitHub at the exact commits listed as unrecoverable. `stash@{1}` survived the pack restore and is readable. Only `stash@{0}` is genuinely gone; its tree is among 16 still missing, and it is why `git gc` aborts (`gc.auto` is set to 0 locally as a result).

**Still true:** the repository remains inside OneDrive. The root cause is unaddressed.

## 2026-07-25 - `quantumsec01@gmail.com` named as second admin recovery owner

**Decision:** `quantumsec01@gmail.com` is the second owner. Provisioning steps in `docs/SECOND-RECOVERY-OWNER.md`; the existing owner runs the CLI, not the new account.

**Constraint:** The system had exactly one owner. Owner creation and recovery are CLI-only from a trusted environment, and the admin runbook's own deployment checklist requires at least two owners before rotating the bootstrap operator - so a single owner was a single point of failure for the entire admin plane. Admin MFA enforcement was also blocked on it, because enforcing MFA with one owner risks locking out the only account able to repair the situation.

**Rejected:** Guessing or inferring the address. Every tracker in this repo says the owner must supply the exact verified email; a mistyped owner address is unrecoverable through the web console, which by design cannot edit owners.

**Revisit if:** a third owner is added, or the account is rotated.

## 2026-07-25 - `core.fileMode=false` set on the repository

**Decision:** Set `core.fileMode false` locally.

**Constraint:** Viewing the repo through a Linux mount reported 1,200 files as modified with zero content changes - pure permission-bit churn between Windows and Linux. It buried the 6 real changes and made `git status` useless for judging state. After the change: 1,206 entries becomes 6.

**Rejected:** Committing the mode changes. They would reappear on the next cross-platform access, and the commit would be 1,200 files of noise obscuring real history.

## 2026-07-25 - Git index operations are not possible from the remote device bridge

**Decision:** All git write operations (`add`, `commit`, `push`) are performed by Claude Code running natively, never from a remote session.

**Constraint:** The mounted filesystem cannot unlink files inside `.git/`. Git creates `index.lock`, completes its work, then fails to remove it - leaving a stale lock that blocks every subsequent index operation. Confirmed by reproduction: clearing the lock allows exactly one operation before the next one strands another.

**Rejected:** Working around it by clearing the lock before each command. It is fragile, and a lock cleared while a real git process is running would corrupt the index.

## 2026-07-25 - Accent becomes a new hue family, one step per mode

> ⚠️ **Superseded** by "Accent decision reopened" at the top of this file. Its contrast validation covered one surface per mode out of seven, and its separation claim is measurably false. Retained for the reasoning, not the conclusion.

**Decision:** Cyan - `#0891b2` dark / `#0e7490` light. Retires both the Google-blue `--accent` and the unbacked emerald shipping in the sidebar.

**Constraint:** No single hex clears 4.5:1 against both a near-black and a near-white surface; a step light enough for dark mode is too light for white. A per-mode pair is the only correct shape, not a workaround.

**Rejected:** Teal - sits too close to success green and would blur the fact/inference distinction the evidence system depends on. Azure - too close to the Google blue being retired. Cobalt remains the pragmatic alternative since admin already uses `#315cff`, which would make the admin fold-in nearly free.

**Revisit if:** brand work establishes a company color that should also serve as the product accent.

## 2026-07-25 - `--text-muted` and light `--warning` corrected for contrast

**Decision:** `--text-muted` becomes `#80868b` dark / `#5f6368` light. Light `--warning` becomes `#a85200`.

**Constraint:** The previous muted values failed WCAG AA on every surface they were used on - worst case 2.37:1 against a 4.5:1 requirement - and `--text-muted` is the ink for the *missing evidence* state, the message users most need to be able to read. Light `--warning` at `#e37400` measured 2.79:1, below even the 3:1 graphic threshold.

**Rejected:** Keeping the values and relying on the mandatory icon+label pairing as mitigation. That works for a status glyph; it does not make body text legible.

## 2026-07-25 - Admin folds into the main design system, keeping density

**Decision:** Retire the 30 `--admin-*` tokens and the 7 that shadow global names with different values. Preserve admin's information density through a `data-density="compact"` modifier affecting spacing and row height only.

**Constraint:** Shadowing global token names is an active collision - the same name resolves differently depending on which stylesheet wins, which is a class of bug that is very hard to see and very easy to reintroduce.

**Rejected:** Leaving admin forked. Defensible on the grounds that it is internal-only, but the shadowed names would still have to be fixed, and at that point the remaining fork buys little.

## 2026-07-25 - Resume templates stay outside the design system

**Decision:** `components/resume-templates/` and `lib/resume-templates/` remain visually independent and are excluded from `design-audit.js`.

**Constraint:** They are documents rendered for employers, not product UI. Their non-product fonts are intentional, and they must not invert with the app theme - verified: zero `dark:` variants across all seven files.

**Rejected:** Unifying them for consistency. Auditing them against product tokens would generate permanent noise, which trains people to ignore the audit - the failure mode that produced the current drift.

## 2026-07-25 - Repository recovered by fresh clone rather than in-place repair

> ⚠️ **Superseded** by "Repository repaired in place" at the top of this file. The fresh clone did not happen, and the accepted-loss list below overstates what was lost. Retained for the diagnosis, not the outcome.

**Decision:** Clone fresh from GitHub to `C:\dev\talent-consulting`, lay the working tree on top, commit in twelve batches.

**Constraint:** `.git/objects/pack/` retained its `.idx` and `.rev` but lost the `.pack` - 272 unreadable objects, breaking `git diff` and truncating history traversal. Commit `6bfd9a6` was intact on the remote, so history was recoverable; the local-only refs were not.

**Rejected:** In-place `git fetch` repair - viable and less disruptive, but leaves the repository inside a OneDrive-synced folder, which is the root cause.

**Accepted loss:** `codex/audit-automation-recovery`, `codex/release-safe-cleanup`, and both stashes. Their trees live in the missing pack; bundle, format-patch and archive were all attempted and all failed.
