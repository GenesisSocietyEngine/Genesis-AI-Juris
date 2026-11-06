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
