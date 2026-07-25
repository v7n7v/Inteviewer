# Taco migration verification

Verified on July 18, 2026 against brand version `taco-1`.

## Passed

- `npm run type-check`
- `npm run build` with 156 static pages generated
- `npm run test:taco-brand`: 6 of 6 tests
- `npm run brand:taco:audit`
- Taco migration dry run: 0 files and 0 replacements remaining
- No former display-name references in customer-facing TypeScript/TSX
- No former assistant asset references in product source
- No new dispatches of the legacy `sona:open` event
- No product imports from former server module paths
- 31 former server modules retained as compatibility re-exports
- Corruption-marker scan clean

The production browser audit passed on desktop and at a 390px mobile viewport. The Taco motion lab and Ask Taco page used `/taco-icon.png`, referenced no former assistant assets, had no horizontal overflow, and produced no browser console warnings or errors. `/suite/gallery/sona` permanently redirected to `/suite/gallery/taco`.

## Broader harness

The assistant harness passed 304 of 321 tests after all rename-induced source-inspection failures were repaired. The remaining 17 failures are caused by these files already being absent from the working tree, not by the Taco migration:

- `app/api/admin/costs/route.ts`
- `app/api/cron/weekly-suggestions/route.ts`
- `app/api/admin/ops/job-supply/route.ts`
- `app/api/admin/ops/recommendation-calibration/route.ts`
- `app/api/agent/harness/preflight/route.ts`
- `app/suite/admin/page.tsx`

Those unrelated deletions were preserved. They must be restored or their obsolete tests removed in a separately scoped change before the full pre-existing harness can reach 321 of 321.

## Build note

The production build reports the existing Google Sans Flex fallback-generation warning. Compilation, TypeScript, static generation, and route generation complete successfully.
