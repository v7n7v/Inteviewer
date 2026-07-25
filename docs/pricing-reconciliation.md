# Pricing Reconciliation

**Date:** 25 July 2026
**Resolution:** the latest documented position wins — **Free $0 / Pro $19 / Max $49**.
**Status:** documented here; **Stripe has not been changed.**

---

## 1. The contradiction

Three documents state three different prices. All three are still in the repository, and nothing marked which was current.

| Source | Date | Pro | Max / Studio | Basis |
| --- | --- | --- | --- | --- |
| `docs/company-parity-goal.md` §213-216 | reviewed **9–10 July 2026** | ~$19/mo, $149/yr | ~$49/mo, $399/yr | competitive parity research |
| `docs/revenue-generation-strategy.md` §51-53 | same train | ~$19/mo, $149/yr | ~$49/mo, $399/yr | outcome-based packaging |
| `docs/launch-readiness-report.md` | 4–5 July 2026 | **$4.99/mo, $49.99/yr** | **$9.99/mo, $89.99/yr** | what was live in Stripe |
| `TalentConsulting_Architecture_Rebuttal.md` | ~March 2026 | $2.99/mo, $24.99/yr | — | "underpricing is our moat" |

The 9–10 July strategy documents are the most recent. **They are the resolution.**

`docs/revenue-generation-strategy.md` §525 already frames the low numbers correctly: *"pricing test at $4.99, $9.99, $19 and sprint-pass pricing."* The $4.99/$9.99 figures were a **test**, not the target. The launch-readiness report recorded them as live state, which is accurate for 5 July but was mistaken for policy.

---

## 2. The superseded argument

`TalentConsulting_Architecture_Rebuttal.md` argued against raising price to $14.99, reasoning that a ~50× provider-cost advantage made aggressive underpricing the durable moat. That argument was **overridden** by the July strategy train and should be read as history.

Why it was overridden, from the later documents:

- Competitors sit at $19.99–$49.95/mo (Teal $29, Huntr $40, Jobscan $49.95, Rezi $29). Pricing at $2.99–$9.99 signals a toy against that set.
- Packaging shifted from selling quota to selling outcomes. Max is "Taco does recurring work," not "more scans." That story does not survive a $9.99 price.
- The target is 8–12% activated→paid conversion at ≥70% gross margin. Margin is not the binding constraint — see §3.

The rebuttal is not wrong about unit economics. It is wrong about what the price *communicates* in this category.

---

## 3. Margin at the target price

From `docs/company-parity-goal.md` §560, the versioned provider-cost basis gives a maximum included Taco workload of:

| Tier | Max provider cost / 31 days | Price | Implied gross margin |
| --- | --- | --- | --- |
| Pro | $1.488 | $19.00 | **~92%** |
| Max | $4.3989 | $49.00 | **~91%** |

These are directional provider costs — not total company cost and not recognised revenue. But they show the target price clears the ≥70% gross-margin goal with very large headroom. At $4.99 Pro the margin is still ~70%, so the test prices were survivable; they simply left most of the value on the table.

---

## 4. Target price list

| Tier | Monthly | Annual | Positioning |
| --- | --- | --- | --- |
| Free | $0 | — | One complete, real result: resume check, limited matching, one visible ranked-picks outcome |
| Pro | $19 | $149 | Active job-seeker toolkit — resume, ATS, applications, writing, interview depth |
| Max | $49 | $399 | Taco does recurring work — scouting, ranked queue, prepared packets, alerts, continuity |
| Sprint pass | $7–12 / 7 days | — | Urgent search without a subscription. **Not built.** |

Annual pricing implies 35% off Pro and 32% off Max.

---

## 5. What has to change

Because `PLAN_PRICE` in `lib/pricing-tiers.ts` is deliberately `null` and `lib/billing-prices.ts` resolves prices from Stripe at runtime, **no code change is needed to reprice.** The work is:

1. **Stripe dashboard** — create new Price objects at $19/$149/$49/$399. Do not edit existing prices; Stripe prices are immutable, and existing subscribers stay on their original price until migrated.
2. **Environment** — point `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_STUDIO_PRICE_ID`, `STRIPE_STUDIO_ANNUAL_PRICE_ID` at the new IDs in `.env.production` and `.env.cloudrun.yaml`.
3. **Existing subscribers** — decide grandfathering. Anyone on $4.99 or $9.99 is paying a quarter of the new price. Grandfathering is the low-risk default; note it explicitly rather than leaving it implicit.
4. **LAUNCH50 promo** — a 50% discount off $19 is $9.50, which is roughly the old Max price. Re-check the promo economics before it is next enabled.
5. **Verify** — `npm run test:release-safety`, then confirm checkout renders the new price. `getStripeRuntimeReadiness()` fails closed to `CHECKOUT_NOT_CONFIGURED` if the IDs are wrong, so a misconfiguration blocks checkout rather than charging the wrong amount.
6. **Update `docs/launch-readiness-report.md`** so the recorded live prices stop reading as policy.

---

## 6. Unresolved: tier naming

Strategy says **Max**. Code says **`studio`** — `PlanTier = 'free' | 'pro' | 'studio' | 'god'`, and the Stripe env vars are `STRIPE_STUDIO_*`. Users see one name, engineers read another.

Renaming touches `lib/pricing-tiers.ts`, every `RATE_LIMITS` entry, the Firestore `subscription/current` documents of existing subscribers, and the env var names. **That is a migration, not a rename** — the Firestore documents are the hard part.

Recommendation: leave `studio` canonical in code, keep **Max** as the customer-facing name, and add a comment in `lib/pricing-tiers.ts` recording the mapping. Do not attempt the rename while four workstreams are waiting to ship.

---

## 7. Note on decision hygiene

This contradiction persisted because three documents each recorded a price without stating whether it was a target, a test, or live state. All three were true of their moment.

Going forward: record prices in exactly one place — **Stripe is the source of truth, and the code already treats it that way.** Documents should reference the tier and the intent, and cite live numbers only with a date and the label *target*, *test* or *live*.
