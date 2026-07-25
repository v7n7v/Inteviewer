# Editorial Authority Resume Template — Implementation Plan

Version: 1.0  
Date: 2026-07-24  
Source visual: `output/resume-template-concepts-2026-07-24/01-editorial-authority.png`

## Outcome

Add the selected “Editorial Authority” direction as a new, stable resume template that becomes the featured default for new sessions while preserving every existing template ID and saved resume choice.

The implementation establishes the visual foundation for the wider tool overhaul: fewer nested containers, stronger editorial hierarchy, intentional whitespace, restrained color, and a clear primary task surface. This change is intentionally limited to the resume-template experience and its exports.

## Product Decisions

- Stable ID: `editorial-authority`.
- Display name: `Editorial Authority`.
- Availability: featured and free so every user can experience the new direction.
- Positioning: “ATS-conscious editorial,” not “ATS-safe,” until real extraction tests support a stronger claim.
- Saved resumes keep their stored template IDs. Existing `executive` is not replaced or restyled.
- The HTML preview and PDF use the selected two-column editorial composition.
- DOCX uses a deliberate linear companion layout with the same palette and hierarchy to preserve reflow and reading order.
- Contact details remain visible as real text.
- Sidebar content is limited to available Contact, Expertise, Education, and Certifications fields. Missing sections collapse cleanly.
- Impact callouts use a new template-specific helper and appear only for user-authored achievements containing an unambiguous percentage, currency amount, or magnitude. They are de-duplicated, capped, and hidden when evidence is absent; they never fall back to ordinary bullets.
- An achievement used as a top impact callout is not repeated in the visible experience bullets.
- PDF pages are A4. Page one uses the full editorial rail; continuation pages use a compact navy identity band so the long-form experience column can paginate predictably. Section headings and role headers stay with the first following line while long bullet groups may wrap across pages.
- PDF document source order is name/contact/profile → experience → skills/education/certifications, even where CSS/PDF positioning creates the visual rail.

## Acceptance Contract

| ID | Acceptance criterion | Evidence |
|---|---|---|
| AC-01 | `editorial-authority` is a new selectable template, featured first for brand-new sessions, and does not redefine any existing ID. Existing drafts saved with `executive` restore `executive`; drafts saved with the new ID restore the new ID and palette. | Source inspection; targeted test; browser selection/reload check |
| AC-02 | The preview matches the target’s major visual regions: ivory canvas, dark navy left rail, high-contrast editorial name, upper-right profile/impact area, and experience-led main column. It avoids nested cards, pills, gradients, and decorative clutter. | Same-state side-by-side visual QA |
| AC-03 | The template renders only canonical resume content. Rail sections map only to Contact, Expertise, Education, and Certifications and collapse when absent. Impact callouts use only de-duplicated user-authored percentage/currency/magnitude achievements, never fall back to ordinary bullets, and are not repeated in experience. | Pure-helper unit tests; sparse/dense browser fixtures; source inspection |
| AC-04 | Long names, long URLs, five or more roles, dense skills, and sparse resumes produce no horizontal overflow, clipped text, fabricated fields, or stranded section/role headings. A4 PDF page one uses the full rail; continuation pages use a compact identity band and allow long bullet groups to wrap. | Stress fixtures; multi-page browser/PDF checks |
| AC-05 | PDF export explicitly maps `editorial-authority` to an A4 renderer, emits selectable text, sets title/author/language/subject/keywords metadata, and extracts in the order name/contact/profile → experience → skills/education/certifications. | Map inspection; generated PDF; real text extraction |
| AC-06 | DOCX export explicitly handles `editorial-authority` with a readable linear companion, `HeadingLevel` section headings, native DOCX bullet lists, contact information in the body, and no export crash. | Generated DOCX; `document.xml` inspection for heading styles and numbering |
| AC-07 | A single per-template export-profile helper drives selected-template claims. Editorial Authority says “ATS-conscious,” is excluded from the ATS filter, and clearly distinguishes matching PDF from linear DOCX anywhere it is selected. | Browser copy review; source inspection |
| AC-08 | The hard-coded chooser preview is replaced by a bounded responsive scaling wrapper. At desktop and 360/390px widths, both chooser and full-size previews fit without horizontal page clipping; selection remains keyboard/touch operable. | In-app Browser responsive verification |
| AC-09 | The existing selection-to-preview-to-PDF/DOCX journey completes without new console errors. | In-app Browser journey verification |
| AC-10 | Targeted tests, TypeScript checking, and production build pass without modifying or removing unrelated user work. | Fresh command output; scoped diff review |
| AC-11 | Combined reference/implementation design QA has no open P0, P1, or P2 issues and the appended Editorial Authority QA section ends with `final result: passed`. | `design-qa.md`; comparison image |

## Scoped Files

- New: `components/resume-templates/editorial-authority.tsx`
- Modify: `components/resume-templates/index.tsx`
- Modify: `app/suite/resume/page.tsx`
- Modify: `lib/pdf-templates.tsx`
- New: `scripts/editorial-authority-template.test.js`
- Append only: `design-qa.md`
- Evidence: `output/editorial-authority-build/*`

## Guardrails

- Preserve the dirty worktree and all unrelated user changes.
- Make narrow patches; do not replace large existing files wholesale.
- Do not deploy or change Firebase/production configuration.
- Do not create fictional scope, awards, budgets, recognition, or impact metrics.
- Do not claim PDF/UA accessibility or universal ATS compatibility without validation.
- Do not redesign the entire resume workflow in this change.
- Do not count source-string assertions as visual or export proof.

## Verification Order

1. Run pure helper tests for quantified-impact filtering, de-duplication, capping, and sparse input.
2. Run TypeScript checking.
3. Run the production build.
4. Exercise template selection, reload, preview, PDF, and DOCX in the in-app Browser.
5. Verify responsive layout at 390px and desktop.
6. Generate a real dense multi-page PDF and inspect text extraction order and metadata.
7. Generate a real DOCX and inspect `document.xml` for heading styles and native numbering/bullets.
8. Create a same-state A4 reference/implementation comparison, run design QA, fix visible mismatches, and repeat. Preserve the existing `design-qa.md` and append only.
9. Complete independent acceptance audit, adversarial review, and UI verification.
