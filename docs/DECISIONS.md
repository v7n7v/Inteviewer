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

**Decision:** Clone fresh from GitHub to `C:\dev\talent-consulting`, lay the working tree on top, commit in twelve batches.

**Constraint:** `.git/objects/pack/` retained its `.idx` and `.rev` but lost the `.pack` - 272 unreadable objects, breaking `git diff` and truncating history traversal. Commit `6bfd9a6` was intact on the remote, so history was recoverable; the local-only refs were not.

**Rejected:** In-place `git fetch` repair - viable and less disruptive, but leaves the repository inside a OneDrive-synced folder, which is the root cause.

**Accepted loss:** `codex/audit-automation-recovery`, `codex/release-safe-cleanup`, and both stashes. Their trees live in the missing pack; bundle, format-patch and archive were all attempted and all failed.
