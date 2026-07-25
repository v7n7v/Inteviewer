# Resume Studio entry-flow audit

## Scope

The initial Resume Studio screen, from choosing how to begin through the first upload action.

## User goal

Start from an existing resume, a saved version, or a blank resume without having to interpret repeated actions and explanations.

## Before

The screen repeated the same decision across:

- starting-point cards;
- a separate “Import a resume” section;
- multiple upload calls to action;
- an intake explainer;
- assurance cards;
- workflow cards; and
- connected-tool cards.

That repetition made the page longer without making the next action clearer. Nested bordered surfaces also gave primary, secondary, and explanatory content nearly equal visual weight.

## After

The entry flow now uses one bounded surface:

1. The file drop zone is the primary action.
2. Saved versions and “build from scratch” are quiet alternatives in one adjacent region.
3. Target, Improve, and Export are shown as a lightweight progression line.
4. File requirements and paste fallback stay with the upload action.

## Accessibility checks

- The paste fallback exposes `aria-expanded` and reveals a labeled text box.
- File upload status remains available through an `aria-live` region.
- The mobile layout has no horizontal document overflow at 390px.
- Keyboard focus styles remain visible.

Screenshot review does not prove full keyboard order, screen-reader announcements, contrast compliance, or upload error recovery. Those require interaction and assistive-technology testing.

