# Decision-map entry remediation — 6 November 2026

## Outcome and acceptance

The reported screen asks ordinary users to invent package identifiers, hashes and receipt IDs, and incorrectly suggests that an evidence snapshot creates a decision map. Replace that starting point with actual user tasks: open AI Case Studio, choose a published map by title/version, or save evidence for a report. Keep technical linking collapsed, server verification unchanged, exact identities intact, and existing case/draft data untouched.

## Reference and scope

Live MyCase case Info → Edit Case inspected in an isolated browser tab on 6 November. The modal presents named business fields, optional custom fields behind a disclosure, and explicit Cancel / Save & close. Cancelled without editing or saving. Applied this progressive-disclosure principle to CaseVant's reported decision screen. This bounded urgent correction precedes the separately requested Home/tasks/calendar/Library restructuring; it does not claim those changes are complete.

## Implementation

- Ordinary linking uses the existing public published-map catalogue, with search, pagination, explicit selection and version confirmation. It does not list or publish private Studio drafts.
- The selected exact identity tuple is submitted to the existing authorized, revision-checked endpoint. No approval is inferred; server graph, lineage, proposal and scenario checks remain unchanged.
- Technical fields stay available under Advanced for existing publication/receipt references; no invented values or relaxed validation.
- Evidence snapshots are described as fixed report inputs, not decision-map creation. Existing report and Studio features remain available.
- Actions appear before the compact linked-map register. Report preparation is a separate adjacent task, stacking below 900 px.
- Existing user tabs and draft fields were not touched. No production writes performed.

## Evidence

29 focused checks pass: rendered workflow/role controls, existing case workspace, decision-package endpoint and graph integration. TypeScript passes. Touched TSX lint passes before the final layout-only reorder; repeat on final candidate. In the isolated synthetic browser, choosing a map by title and pressing Link submitted the exact ID/version/fingerprint with an empty optional receipt list. Before selection, Link is disabled. Advanced is initially collapsed. Actual themed desktop layout inspected. The preview routes and catalogue are synthetic; this is not a production save or provider test.

Initial preview fixture failed on Next routing/process resolution; corrected fixture adapters, not application code. Initial regression copy assertion was restored without weakening the test. These failures are not production defects.

## Remaining release gate

Final candidate/exact-main CI, normal merge, exact-source deployment and fresh live read-only review remain pending. Narrow browser layout and search failure/pagination interaction are not yet observed. Do not claim deployment or broader module completion from this checkpoint.

## Published v187

PR237 merged normally as `77d8b04e2d41b0f944a06259de2af634a7137ebc`. Both candidate runs (42175941274, 42176028822) and exact-main run 42177235002 pass the complete web/PDF gate: 1,964 tests, 1,961 passes, three inherited skips and zero failures, plus two HTML checks, 47-PDF baseline/bilingual/tax checks. Final touched TSX lint and strict types pass. All 626 runtime inputs and hosting digest match the adopted exact-main CI archive. No local rebuild substituted for CI output.

Sites v187 succeeded at 2026-11-06T07:10:55.328001+00:00. Both origins identify the merged runtime and verify 196/196 assets each (143 current, 53 retained from v186's current manifest only). Environment revision 42 and all 13 returned representations are unchanged; public audience and DB/DOSSIER_DOCUMENTS bindings preserved.

Fresh signed-in production tab confirms the action-first layout, published-map list, ERP search result, named version confirmation and Link enabled only after selection. Selection was cleared without linking. Advanced is collapsed; snapshots remain a separate action. The existing synthetic case remains revision 2 with no new package or snapshot. Original user tabs and entered values were not reloaded or touched. Live screenshot: local `.artifacts/decision-v187-live.png` (not committed).

Synthetic 390px inspection measured innerWidth 390, document width 375 and actions width 327.2; no horizontal overflow. Advanced opens/closes with Enter. The IAB narrow image was scaled down unexpectedly; rely on measured geometry/keyboard evidence rather than treating it as a faithful narrow screenshot. A first production Playwright Search click showed no activation; direct AX activation produced loading then the correct filtered result. Preserve this input-method observation; no application cause established. Search pagination/failure UI is implemented but not browser-exercised in this release.

Automatic approval review rejected the first packaging input because its opening record referenced the previous commit. Refreshed the source opening at the merged commit and renewed the expired credential, then packaged successfully. No bypass and no stale-source deployment occurred.

Native scope remains separate from this web release: merged-source Rust, Android and Flutter pass. iOS Tax Application run42177235098 attempt1 timed out at tax-prepare (exit124), followed by temporary-directory cleanup errors; this is not reported as a passing native acceptance. iOS Native FFI remained running at the checkpoint. Preserve original failure logs and any retry separately.

The broader module rework remains explicitly outstanding in [the live reference amendment](../development/MYCASE_MODULE_AMENDMENT_20261106.md); this release fixes the reported decision-map entry screen only. Do not redeploy merely for this documentation closure.
