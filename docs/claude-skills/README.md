# Project skills

Four skills. Each has one job, and they are meant to compose without argument. This file exists because they overlap at the edges, and an undefined precedence order is the kind of problem you only discover when two skills disagree at 2am.

## What each one is for

| Skill | Governs | Fires when |
| --- | --- | --- |
| `build-loop` | **how you work** — the verify/correct cycle, where autonomy stops | multi-step work, phases, "keep going until done" |
| `talent-studio-design` | **what visual output must be** — tokens, evidence states, prohibited patterns | anything that renders |
| `ui-verify` | **how visual output is checked** — real Chromium, 6 widths, 2 themes | after a UI change, or investigating a layout bug |
| `plan-handoff` | **what gets written down** — decisions, context, keeping docs true | work crossing a session boundary |

## Precedence

When two skills could both apply and their guidance differs, resolve in this order:

**1. `build-loop`'s hard stops win over everything.**

If `build-loop` says stop — an owner-gated prerequisite, an irreversible action, a guardrail test you believe is wrong, three failed attempts at the same gate — you stop. No other skill's completion criteria override that. A design rule that can only be satisfied by weakening a guardrail is a rule to escalate, not to satisfy.

**2. `talent-studio-design` decides what is correct.**

For any question of what the output should *be* — a color, a radius, whether a pattern is allowed, how an evidence state renders — the design skill is authoritative. `DESIGN.md` and `UI_DESIGN_GUIDE.md` are superseded where they conflict with it; they also contradict each other, so never resolve a dispute against them.

**3. `ui-verify` decides whether it actually works.**

The design skill states that a browser run is required. `ui-verify` is *how*. Where the design skill mentions verification in passing and `ui-verify` specifies it, follow `ui-verify` — it is the more specific instruction and it ships the script.

**4. `plan-handoff` applies at boundaries, never mid-task.**

It governs what you record when finishing a phase or handing off. It never justifies stopping work to write documentation.

## The one real overlap

Browser verification appears in all three of `talent-studio-design`, `ui-verify` and `build-loop`. That is deliberate — a rule that only lives in a skill which might not fire is a rule that gets skipped.

The canonical statement lives in **`ui-verify`**. The other two reference it and must not diverge. If you change the verification requirements, change `ui-verify` first, then update the references.

## Cost

Every skill's name and description sits in context on **every turn**, whether it fires or not. Four is a deliberate ceiling, not an accident.

Before adding a fifth, ask whether it would change what the model does in at least one in ten relevant sessions. If not, it is not paying its rent — fold the content into an existing skill's reference file, where it loads only when actually needed.

## Evals

Each skill has `evals/trigger-evals.json` — realistic queries, roughly half of which should *not* trigger it. The near-miss negatives matter more than the positives: they are what stop a skill firing on adjacent work it has nothing useful to say about.

Re-run these after editing a description. A description edit is a behaviour change, not a copy edit.

## Installing

These live in `.claude/skills/` so Claude Code discovers them automatically. They are staged in `docs/claude-skills/` when delivered from a remote session, because remote tools are not permitted to write to `.claude/`.

```bash
cp -r docs/claude-skills/* .claude/skills/
```
