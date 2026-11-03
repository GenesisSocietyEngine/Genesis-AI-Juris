# Compact Studio UX review — 3 November 2026

## Outcome and scope

Make Studio easier to scan without changing a case, its authority or its outputs. Reverified clean canonical main `6430adf709fa04ab2b41fb64f560614096417345` before editing: public v172 runtime `254a3da269f20aecdf3abdd4776ec5df60bdeed6`, application inputs `aad53c15c8cc00fbcf77bb1d0a4183bf5e414ff8a443dfa4a7e69d9efc9a3336`, hosting `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe` and all581 input receipts matched. Supported Sites source opening completed before editing. Task branch: `codex/compact-studio-guidance-20261103`.

This is a source/component UX audit, not a fresh interactive audit. Browser checks remain **blocked at the user's direction**, without retry. No production case, account or unsaved-tab interaction occurs in this slice.

## Findings and amendments

| Finding | Amendment | Acceptance boundary |
| --- | --- | --- |
| First-case coaching repeats Save/Report beside the header, including after a fresh save. | One compact help strip; the header keeps its existing Save/Report handlers and state. Confirmed structured cases have no extra coaching. | EN/RU component checks; no claim of fresh authenticated save acceptance. |
| Coaching presents full explanations and a large heading before the working case. | Short prompt and native closed Help disclosure; only missing-brief/title actions remain direct. Review/Reports retain task-specific actions without repeated coaching; oversize warnings remain visible. | Targeted brief/title callbacks, busy status, size warnings and help content verified in component tests. |
| Exact-passage buttons repeat long instructional captions within padded list cards. | Compact wrapping source-identity buttons, full accessible names and short visible qualifications. Full secondary explanation/hash stays in native details. | Literal text, selected-versus-retained state, mismatch and unavailable-version warnings remain; active hash/context/return guards unchanged. |
| Density can accidentally remove information or reduce targets. | Keep full source text untruncated, readable typography,44px minimum interactive targets, wrapping/visible focus styles. | Source/CSS inspection only; pixel height, overflow, touch, real focus/scroll and short-height EN/RU checks remain blocked. |

## Measured component baseline

Reproduce with pinned Node22 and `--import tsx scripts/measure-studio-compactness.mjs --ref 6430adf709fa04ab2b41fb64f560614096417345 --label before`, then omit `--ref` and use `--label after`. This compares exact Git component source snapshots using controlled React SSR and a native closed-details visibility model. It is **not an old published application artifact**, browser-layout measurement, user retrieval test or commercial proof. [Machine-readable before/after](receipts/compact-studio-component-measurements-2026-11-03.json) records source-component hashes and the unchanged literal-section hash.

| Controlled state | EN visible characters before → after | RU before → after | Native buttons before → after |
| --- | --- | --- | --- |
| Structured unsaved coaching |229 →54|247 →64|1 →0|
| Confirmed structured coaching |63 →0|61 →0|1 →0|
| Empty-case coaching |208 →76|212 →75|1 →1|
| Closed exact-passage reader |172 →90|187 →108|1 →1|
| Open reader including full literal passage |572 →456|585 →489|3 →3|

Source passage SHA-256 remains `946dc16018f0e9c1f1799b873e9259d32c9150864003c00428f63e98abfafbfd`. Horizontal padding is reduced locally rather than shrinking typography or click targets. Source identity, unavailable/mismatch disclosure, Close and the scoped Review return remain direct. Secondary content is accessible through native disclosures, not removed. Focus restoration and asynchronous hash cancellation remain existing guarded behavior covered by component tests, not newly observed browser results.

## Step review and validation

Implementation review: root diff only changes coaching mount conditions/props. Header Save/Report, CAS, save receipts, drafts, export/seal policy, source projections, factories, carriers, history, accepted-evidence state, PDF rendering and archive handling are unchanged. Reader diff changes presentation and accessible captions only; no handler/hook changes. No production case was created, replaced or deleted.

Initial restricted local Node invocation failed before tests with `uv_os_get_passwd ENOMEM`; the authorized unsandboxed focused rerun passes15/15. This environmental launch failure is not a product regression. Strict types pass after correcting a nullable overview-step comparison; changed-file lint has 0 errors and 7 pre-existing root warnings. The broader source/citation/Review-return set passes 50/50. Accessibility review corrected the shortened citation caption to start the accessible name verbatim; EN/RU reader checks pass 8/8. Broader corrected-candidate/exact-main checks are pending at this checkpoint. Production publication is pending; no candidate is described as live.

## Continuation and acceptance limits

1. Finish exact-source web/PDF validation and publish this actual UI slice once through the existing public Site. Compare audience/environment/storage and both origin runtime/assets. Preserve only v172 current-manifest assets for retention, no chain. Record native statuses separately under existing web-only authorization. Docs-only closure must not trigger a duplicate runtime release.
2. Browser acceptance stays blocked without retry until the user lifts that restriction. Then verify compact EN/RU/long-title/short-height surfaces, native details, actual keyboard focus/scroll and the one-action finding → node → passage → Return journey. Verify header Save/Report authority states; preserve every case and unsaved tab. Do not count SSR character reduction as pixel or retrieval-time proof.
3. Resume remaining S03/S05 only through isolated authorized sessions. Keep legitimate unsupported-owner recovery, same-tab identity/source timing, original-artifact/historical pagination,43missing-original disclosures, native/operator/commercial limits and v167 paused caption-boundary observation explicit. No source substitution, governed edit merging, provider processing, disposal, analytics, pricing or outreach. Preserve the254-page ERP Full record and all PDF locks.
4. Next simplification hypotheses need observed task evidence: manual-choice discoverability and measured finding/authorization/evidence-gap/owner/action retrieval.30-second/80% targets remain unvalidated hypotheses pending at least five evaluators. Do not rebuild delivered Sources/Templates/Demo controls or expand runtime scope just to close documentation.
