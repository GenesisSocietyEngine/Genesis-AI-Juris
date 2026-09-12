# Investor-oriented UI/UX continuation — 12 September 2026

The acceptance priority is a clear first impression and a short route from account creation to useful work: open a prepared case, load a canonical case, or describe a task; then inspect decisions and create a preliminary analytical report. The 120-second goal is an acceptance target, not a measured result. No statements are attributed to the co-investor beyond the priorities supplied by the user.

## Observed findings and repairs

| Finding | Priority | Evidence | Repair and verification |
|---|---|---|---|
| A visible page could remain completely non-interactive in local HTTP preview. | Blocking QA | Clicking Case Studio left the catalogue unchanged; root module scripts were loaded from HTTP while the Worker instructed an HTTPS upgrade. | Vite's compile-time development flag exempts HTTP preview from that upgrade. Production retains it, even for an HTTP request. Reload then Studio navigation succeeded in the browser. Header tests cover both modes. |
| Catalogue entry did not offer a first action within the opening hero. | High | A 1348 × 926 screenshot showed the featured case beginning below the large introductory and promotional sections; the Launch control was further down. | Prepared-case launch and Studio entry now appear in the hero; spacing is reduced and the promotional band follows the case list. Final layout has not yet been visually rechecked. |
| Account access was absent from the catalogue header; its importer restored play sessions, not Studio cases. | High | Browser DOM and source agreed. | Account is available in both layouts. The old importer is explicitly named Restore a play session, visible in Operations and a secondary catalogue section. Studio's unified case/prompt importer remains separate. |
| Guided Studio repeated several large introductory/status sections before the working field. | High | Browser screenshot showed the prompt below the first viewport. | The Wizard uses a compact case/save/readiness header and existing stepper; the duplicate marketing heading and separate status strip are removed. Required warnings, step gates and navigation remain. Final desktop/mobile layout remains unverified. |
| Opening an example stayed on Brief despite promising a decision map. | High | The example loaded successfully but the browser still displayed Step 01. | The action now synchronously writes the map step to the URL before replacing the draft, using the established navigation function. New draft, tax starter and AI review/apply transitions also use that function. |
| Creating a PDF after visual editing failed on an arrow added by Studio itself. | Blocking report | Preview PDF displayed an unsupported U+2192 error after deleting a relation. | A pinned, embedded symbol face renders the exact audit-history arrow. EN/RU regression tests generate real PDFs after delete and undo. Text extraction preserves the arrow and Cyrillic. No source text is rewritten. |
| The embedded PDF preview was incompatible with the page frame policy. | Blocking preview | Source inspection: CaseReportDialog embeds a generated blob PDF; the Worker disallowed all frames. | The policy permits blob frames only. Remote frame sources remain excluded. Browser rendering after this repair remains to be checked. |
| A case-view card could focus a related node instead of its own node; keyboard users could not reach inactive tabs. | High | Focus-target logic and tab handlers inspected during the UI audit. | Every projected item carries an explicit graph target; overlapping node/link identifiers cannot select the wrong object. Arrow keys, Home and End activate and focus case-view tabs. Browser keyboard acceptance remains open. |
| Default case views exposed internal package labels and implied testing before a test run. | Medium | Browser showed V58, training_simulation, raw N/L counts and Rust-tested wording. | Raw package identifiers and counts are developer-only. User copy describes decisions, evidence and timing; it invites testing without claiming it already happened. |

## Browser evidence actually obtained

The supervised local preview rendered the catalogue and Studio. After the development compatibility repair, navigation to Studio succeeded. A prepared Missing Boundary example loaded; its seven-node decision map was inspected. Selecting a relation and pressing Delete removed it and announced that undo was available. Undo restored the relation. The analytical-report dialog opened with Preview and Download before optional settings. PDF generation exposed the arrow defect described above.

This was local preview evidence, not an authenticated production test. The preview catalogue used bundled fixtures, not a verified production D1 catalogue. No user account, identity, reviewer, invitation, production case or approval was created to manufacture evidence.

The Canopy Base JSON and canonical Markdown fixtures were prepared from the existing source model. An upload was attempted through the browser's documented file chooser. The browser service entered recovery and later tab listing/new-tab operations timed out. The upload result could not be observed. It is not counted as a successful import or timing run.

## Acceptance matrix

| Journey | Current evidence | Completion criterion still needed |
|---|---|---|
| New user registers and returns to the intended task | Existing account/continuation tests; source review | Genuine cold user, correct identity, profile completion and return destination observed end to end |
| Prepared example → map → edit | Browser observed; example initial-step defect repaired afterward | Recheck repaired entry and record elapsed time without cuts |
| Studio JSON → map | Parser/access tests; browser attempt interrupted | Successful file selection, exact loaded case, step and preserved protections observed |
| Canonical Markdown → review → apply | Existing integrity/explicit-review tests | Full browser route, no automatic AI submission, exact approved draft observed |
| Plain text → AI proposal → review → apply | Existing authorization, proposal and continuation tests | Real signed-in request and review/application observed with configured production capability |
| Report → readable PDF | Dialog observed; EN/RU real-PDF tests pass after repair | Browser preview and download completion on final source |
| Mobile, dark mode and keyboard-only first use | Existing styles and targeted source fixes | Actual viewport/device checks and keyboard sequence |
| 120-second first useful action | No measured cold-user evidence | At least one uncut, reproducible timed run per start route; report setup/provider latency separately |

## Demo deliverables

The new storyboard and bilingual narration are prepared under `first-use-demo-2026-09-12/`. They cover first use, reviewable AI/canonical input, visual editing and an analytical report, with a shorter cut. They are production material for the recording, not proof that those routes have been recorded. Existing three-minute Help media remains in place until a replacement video is complete and reviewed. No drawn screens, synthetic actor identity, expected result card or unexecuted scenario is presented as a real product recording.

The final 8–10 minute video, short video cut and synchronized captions remain incomplete after browser recovery failed. Real production Canopy publication, owner/reviewer workflow and cold registration are separate acceptance gates.

## Automated verification

The complete suite ran 595 tests: 593 passed and two assertions still expected removed UI wording. Those assertions were updated to require the retained footer product label and specific task guidance with the Continue gate. The affected UI/asset rerun passed 19/19 tests. The unchanged long Canopy scenarios and governance checks passed in the complete run; that long suite was not repeated merely to recheck copy. Production build, TypeScript and lint pass. A further focused run passes 6/6 projection tests, including three new regressions for overlapping IDs, a node card targeting itself and aggregate economics focus.

## Release scope

No schema migration, secret, access role, publication gate or case lineage policy changes. The PDF presentation fingerprint is advanced to bind the new audit font; existing exact-output approvals are not transferable to newly rendered bytes. Unsupported graph glyphs continue to fail visibly rather than disappearing from evidence. This remains a limitation for arbitrary symbols in user-authored graph text.

Automated release results are recorded in `first-use-release-2026-09-12.json`. Passing automation does not close the live acceptance items above.
