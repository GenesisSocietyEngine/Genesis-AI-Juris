# Studio UI/UX repair candidate — 2026-09-14

This is a source review and proposed repair, not production browser acceptance.

Baseline: GenesisSocietyEngine/Genesis-AI-Juris, branch codex/canopy-report-brief-2026-09-11, commit 495ad9e31e336d08adbf40d264bc4ea4d8fdb2f3.
Production Sites version 79 identifies commit 318e7d8764972a24a5cdb48f9ebdc8dd8572a611. GitHub cannot resolve that commit. The Sites repository is separate.
The task workspace failed to initialize its executor; local builds, real browser checks, and Sites source publication are unavailable in this session.
Preserve newer production work when transferring these changes into its checkout. Do not deploy this older complete tree over production.

## Findings and changes

| Priority | Source finding | Candidate change |
| --- | --- | --- |
| P0 | Default portrait layout records completion before its asynchronous module import finishes. Effect cleanup can cancel the layout while leaving its completion marker set. | Use the small synchronous layout module and mark completion after calculating the matching draft's positions. |
| P0 | Importing or reopening the same case/version/node IDs can reuse the layout marker. | Give each replaced/restored draft a new Studio view instance. |
| P1 | Inspection-only cases skip automatic layout. | Project their displayed node positions without modifying or saving the protected draft. |
| P1 | Studio's Templates link requests view=library, but the Studio-only query parser and render guards ignore that destination. | Honor catalogue/help/demo views on the Studio host. Update view URLs and browser back/forward navigation. |
| P1 | The Canopy fixture has no entry in JurisApp, and demos are not a distinct working category. | Add Demo cases with Canopy Base/Upside/Hard stop/Downside and existing playable examples. Open a fresh independent Canopy draft; retain the existing playable manifest checks. |
| P1 | A played example returns to Studio instead of its originating category. | Remember the launching view and return there. |
| P1 | The quick import accepts only JSON; the normal quick start does not surface canonical Markdown prompts. | Accept saved .json cases and .md prompts; validate prompt size and open the existing review flow. |
| P2 | Case-view tabs remove inactive tabs from tab order without implementing arrow navigation. | Add Left/Right/Home/End navigation and focusable panels. |
| P2 | Normal case views expose release labels, registry IDs, N/L counts and Rust wording. | Hide identifiers/counts behind Developer view; use task language in the user view. |
| P2 | Completed wizard stages replace their numbers; large headings and small controls compete with the task. | Retain stage numbers, simplify labels, compact the Studio heading and increase regular control text. |

## Validation required on the final production candidate

Run the existing typecheck, lint and complete web tests/build, plus the added Canopy layout/copy tests.
Use the existing CI gates without suppressing failures. Source-pattern assertions may need replacement with behavior checks where UI wording changed.

Browser acceptance remains required:
- Fresh visit, restored device draft, workspace reopening, JSON import, Canopy, same-ID reimport, and protected viewing all open with real top-to-bottom positions.
- Explicit horizontal selection works, editable dragging remains usable, and inspection does not alter stored data or permissions.
- Templates, Demo cases, Canopy, playable cases, browser Back/Forward, Help, My cases and reports reach their advertised destinations.
- Both languages, keyboard-only tab navigation, 390px width, 200% text zoom, and menu close/focus behavior.
- Canopy fresh copies retain evidence references and compile; original fixtures and existing user cases are preserved.
- User view hides diagnostic identity details while retaining validation failures, save/conflict state and meaningful access restrictions.

The broader administration, registration, document/evidence routes, report download behavior and full current-production navigation audit are still open. They cannot be accepted from the older accessible source alone.
