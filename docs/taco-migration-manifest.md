# Sona-to-Taco migration manifest

## Canonical changes

- Customer name: Sona → Taco; formal wordmark: TACO.
- Primary action: Ask Taco.
- Job recommendation program: Career Picks by Taco.
- Voice interview experience: Live Interview with Taco.
- Canonical server modules: `lib/assistant/*`.
- Canonical UI imports: `components/assistant/*`.
- Browser event: `assistant:open`.
- Browser preferences: `taco-personality`, `taco-voice-id`, `taco-audio-replies`.
- Signing secret: `TACO_PREFLIGHT_SECRET`.
- Motion lab: `/suite/gallery/taco`.

## Compatibility contracts that must not be renamed

The following strings identify historical data, billing evidence, provenance, consent, or analytics series. They remain readable and, where necessary, writable until a separately reviewed data migration exists:

- Analytics event names beginning with `sona_`.
- Firestore documents and collections including `sona_daily`, `sona_brief`, and `sona_economics_*`.
- Provenance and source values including `sona_upload`, `sona_picks`, `sona_chat`, and `legacy_sona`.
- Cryptographic salt `sona-preflight-receipt:v1` and historical version/fingerprint strings.
- Existing purchase-contract metadata fields and idempotency keys.
- Existing DOM anchors used by deep links until all shipped clients have aged out.

Every legacy analytics event now carries `assistant_brand=taco` and `assistant_brand_version=taco-1`. This preserves time-series continuity without hiding the rebrand boundary.

## Compatibility adapters

- Old `lib/sona/*`, `lib/sona-tools.ts`, `lib/sona-context.ts`, and `lib/ai/sona-toolkit.ts` paths re-export the canonical assistant implementation.
- Taco preference keys read the legacy key when needed and dual-write during the transition.
- The Taco drawer listens to both `assistant:open` and legacy `sona:open`; new code dispatches only `assistant:open`.
- `TACO_PREFLIGHT_SECRET` takes precedence, with `SONA_PREFLIGHT_SECRET` as a deployment fallback.
- `/suite/gallery/sona` permanently redirects to `/suite/gallery/taco`.
- Historical asset files stay on the CDN, but current UI uses Taco assets.
- Legacy package commands remain aliases for neutral assistant commands.

## Removal criteria

Do not remove an adapter until telemetry shows no meaningful legacy traffic for at least two full release cycles, saved-data export/import has been tested, billing and receipt verification still pass against historical fixtures, and rollback no longer depends on the adapter. Persistent historical values may never need removal.
