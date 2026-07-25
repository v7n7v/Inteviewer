# Taco rollout and rollback runbook

## Before canary

1. Run `npm run type-check`, `npm run brand:taco:audit`, the assistant harness, focused notification and billing tests, and a production build.
2. Visually inspect the mark at 16, 24, 48, 192, and 512 px on light and dark backgrounds and with reduced motion.
3. Verify chat identity in Professional, Coach, and Direct modes, including “What does your name mean?”, missing-evidence handling, and external-action approval boundaries.
4. Confirm old saved preferences load, `assistant:open` and `sona:open` both open the drawer, old gallery bookmarks redirect, and historical receipts still verify.
5. Set `TACO_PREFLIGHT_SECRET`, retain the legacy secret during the transition, and set `TACO_ROLLOUT_PHASE=canary`.

## Canary

Release to internal accounts first, then a small production cohort. Use this announcement: “Our career assistant is now Taco — a name built from TA + CO in Talent Consulting. Your saved career context, preferences, and review-first controls stay the same.”

Monitor assistant open rate, first useful outcome rate, task completion, user corrections, name-confusion questions, support contacts, notification consent, receipt failures, and billing evidence. Compare against the pre-launch baseline and segment by `assistant_brand_version`.

Stop expansion if trust-boundary failures appear, saved settings fail to load, receipt or billing verification regresses, notification consent changes unexpectedly, or correction/support rates materially exceed the agreed launch threshold.

## General release

Set `TACO_ROLLOUT_PHASE=general`, publish the announcement in the assistant and release notes, update support macros and screenshots, and keep compatibility telemetry active for at least two release cycles.

## Rollback

Do not attempt a partial copy-only rollback. A mixed-name experience is more confusing than a clean prior release.

1. Freeze expansion and capture the failing brand version, route, event, and cohort.
2. Redeploy the last verified release and set `NEXT_PUBLIC_TACO_ROLLOUT_ENABLED=false` if the release reads the flag.
3. Keep all legacy data values, signing salts, metadata, analytics series, and compatibility paths unchanged.
4. Do not delete Taco preference keys or assets; they are harmless and needed for forward recovery.
5. Verify sign-in, saved resume/context loading, chat, notifications, checkout, receipts, and old/new event handling.
6. Correct the issue, repeat the complete pre-canary checklist, and issue a new brand version before resuming.

## Ownership checklist

- Product owns naming, announcement, support copy, and acceptance thresholds.
- Design owns mark usage, contrast, reduced motion, and exported assets.
- Engineering owns prompts, compatibility adapters, deployment flags, tests, and rollback.
- Data owns baseline metrics and brand-version segmentation.
- Support owns name-confusion tagging and escalation of trust or saved-data issues.
