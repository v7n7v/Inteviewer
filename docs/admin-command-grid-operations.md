# Admin Command Grid operations

## Snapshot lifecycle

The Admin Command Grid reads bounded, materialized evidence from
`admin_aggregate_cache`. Platform statistics and the 7, 30, and 90-day finance
windows are refreshed together. One Firestore lease prevents concurrent source
scans, and every successful batch clears its lease and records completion.

Production is refreshed by `.github/workflows/admin-aggregate-materialization.yml`
every ten minutes. The cache lifetime is fifteen minutes, leaving one missed-run
window before the UI truthfully reports stale evidence. The workflow must have
the repository secret `ADMIN_AGGREGATE_CRON_SECRET`, whose value must exactly
match the production runtime `CRON_SECRET`.

## Deployment

`node deploy-fix.js` runs the existing production preflight and Firebase
deployment, restores the local Firebase configuration, and then executes
`scripts/admin-aggregate-prime.js`. The deployment command fails if the
post-deploy receipt is unauthorized, non-successful, stale, missing a finance
window, or reports provider writes. A successful prime does not make Stripe,
Resend, entitlement, pricing, or user-content changes.

Do not bypass the prime after changing an aggregate schema. The Admin API may be
available while its new snapshot shape is not.

## Monitoring and response

GitHub Actions owns scheduler execution and failure notification. The repository
owner is the first responder for a failed `Admin aggregate materialization`
workflow. A failed scheduled or manual run produces a failed check and an
operator-facing job summary.

1. Re-run the workflow once with `workflow_dispatch`.
2. If it fails again, inspect only the HTTP status and sanitized error text; do
   not print the bearer secret.
3. Verify the Firebase runtime and GitHub secret still match.
4. Verify the newest Admin snapshot is less than fifteen minutes old.
5. If source reads are degraded, keep the last snapshot visible with its stale
   state; never replace unknown evidence with zero.

For a controlled manual recovery:

```bash
npm run admin:aggregates:prime
```

The command uses `.env.local`, validates all three finance windows, and exits
non-zero on an invalid receipt.

## Rollback

The scheduler and API contract are independently reversible:

- Disable the workflow before rolling back to a release without
  `/api/cron/admin-aggregates`.
- Restore the previous Firebase Hosting release and SSR backend revision using
  the release evidence captured by the production deployment process.
- Preserve `admin_aggregate_cache`; older compatible releases can continue to
  read the last known snapshots.
- Re-enable the schedule only after a manual prime against the restored release
  succeeds.

The scheduler is intentionally read-only toward external providers. Rolling it
back never requires reversing a Stripe, Resend, promotion, price, entitlement,
or customer mutation.
