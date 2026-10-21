# Framework-padding failure investigation — 21 October 2026

## Fresh boundary

Opening clean local/canonical main: `287d086e0f44888770c6fe849351b2f60fcf6529`. Native Sites still reports public v158 at https://casevant.pro, owner access. No user tab, stored case, runtime binding or source packet was changed by this diagnostic slice.

Exact-main runs: Root Web/PDF `39559539160`, Flutter UI `39559539360`, Android `39559539161`, iOS native smoke `39559539178` and Rust `39559539150` pass. Editor restart `39559539193` fails. The earlier two candidate restart passes remain valid dated evidence; they do not establish universal reliability.

The failed editor run completed preparation within its 900-second budget and completed write/read/incomplete-write/incomplete-read. `legacy-write` discovered and connected to the authenticated VM, then failed the existing `tester.takeException()` assertion immediately after the normal Import action (application test line260, helper line546). The exception is Flutter `AnimatedPadding` constructor assertion `padding.isNonNegative` (pinned framework line912). No deadline or VM-discovery failure is inferred. Legacy-read was not executed; no complete six-phase acceptance is claimed.

The retained framework stack currently points to the matcher in `_tap`, not the original widget/rendering call site. The raw log preserves the assertion but not original geometry. The keyboard was involved in this flow, but neither a negative keyboard metric nor a specific root widget is established by that record. Do not clamp application insets or suppress animation/assertions on this evidence alone.

## Bounded diagnostic amendment

The isolated synthetic integration entrypoint now chains a framework failure capture to the original Flutter error handler. It retains up to four original error/stack/library/context records with phase/checkpoint, raw physical view insets/padding/size/DPR, dialog MediaQuery insets when available, and the focused widget's type. It does not read text controllers, clipboard, cookies, credentials or stored case values. Strings are bounded; additional events are counted. Collection/publication errors cannot replace the original failure. The original handler receives every original details object, and teardown restores it.

Evidence is emitted to the native test log and integration response; the host driver retains the framework evidence in its existing failure receipt before VM diagnostics. Existing `takeException()` checks, failed-test refusal, source/nonce/PID/bundle verification and all deadlines remain unchanged. This is observability, not a fix for negative padding and not a production error handler.

## Validation and limits

Pinned Flutter3.44.8 / Dart3.12.2. Four focused diagnostic controls verify the original pending framework exception remains observable, original stack/metrics forwarding, bounded repetition, and forwarding despite failed snapshot/publication. The related diagnostic/import-lifecycle/driver cohort passes all19 tests, including EN/RU enlarged-text/keyboard actions, Cancel/back/import, editor removal and legacy preservation. Static analysis passes after a missing foundation type import was caught and corrected. The first sandboxed Flutter invocation produced no test output and was stopped; the cache-authorized run passed. Formatting applied, but its first sandbox invocation could not update the SDK telemetry session file; authorized formatting verification then passes with zero changed files. These are environment/check failures, not application passes.

Actual new Mac acceptance is pending until the exact candidate runs. A pass with no framework error does not reproduce or resolve the intermittent padding failure. If it recurs, inspect the original rendering stack and contemporaneous geometry before writing a failing application regression and a narrowly scoped correction. Do not extend timeouts or consume framework failures to obtain green CI.

## Pagination and continuation

The user answered **Not sure** whether first-More failures occur with manual clicks or only audit automation. This resolves the question as unknown; it is not evidence of either cause. Existing production/archived/fixture successes stand. Continue trusted received-input → loading → request/response comparisons, preserving default archived bytes, no field-value/credential capture and no speculative product state patch. Keep original49, all earlier cases, the retained stale writer and every remaining role/variant/tax/account/source acceptance row.


## Received-input comparison after this checkpoint

Original unrebuilt v158 runs in the isolated synthetic runner, prepared from candidate `767b9ab`. At measured1520×687 with default computed scroll behavior `auto`, More begins at y3835.75, below the viewport. One normal locator click produces trusted pointerdown/up/click on the correct button/hit target; cursor request13 starts3ms after click1792573340086, returns200/23 and the UI settles25→48. No forced click or altered handler is used. A normal search resets25. Tab from the last row action visibly focuses More; Enter reaches Loading and48 with a1500ms cursor delay. Raw keyboard events are not recorded, so focus, command and visible/request outcomes are distinguished from the trusted pointer trace. A local screenshot shows48; it is not production evidence.

A separate fresh authorized production tab at measured390×480, scrollWidth367, starts25. A Tab command times out after focusing the prior row link; focus does not advance to More. Do not count it as a delivered Tab or product keyboard defect. The now-visible More button receives one normal pointer command and reaches Loading, then49. No production pointer/request instrumentation is present. All49 title/saved-date/destination tuples match the earlier retained catalogue. Narrow inline badges/dates change innerText whitespace; raw innerText is not asserted equal, while non-whitespace characters match. No case write was attempted; complete stored payload bytes were not compared.

Production screenshot capture again times out. Viewport override is reset immediately afterward; the resulting normal viewport is observed662×864, not assumed equal to the earlier window size. No production raster acceptance is claimed. The isolated runner stops gracefully with all581 archive files unchanged, no outbound requests, and equal case snapshots `c9fa570aeac39c591d9de30ba72fdf60e175dda39fc267ea352e253bcd7f318e`. That hash is compared within this run; fixture timestamps differ from earlier runs. The retained rejected stale draft remains marked for handoff. No user draft was reloaded or saved.

The exact candidate's web/PDF jobs pass1775/0/3 inherited skips. Full Flutter CI passes485 widgets with12 skips, two real native tax tests and two separate-process tests. Mac editor and simulator runs are still pending at this checkpoint. Keep candidate source stable; update acceptance evidence after their actual outcome rather than cancelling/restarting them for documentation. The [structured receipt](receipts/framework-padding-investigation-2026-10-21.json) separates these boundaries. Neither pagination's historical miss nor the framework padding root cause is claimed resolved.


## Additional production inspection-only boundary

The normal catalogue exposes existing synthetic29 (v2.5.0, ERP Value owner, Administrator access). A separate authorized Chrome Maxim Hayan tab opens its normal Studio link and observes Inspection-only case, Saved to workspace,94nodes/181connections. Save and report controls are disabled. After Sources finishes loading, the materials library shows40 entries. Read text expands public_facility_permit from us_environmental_desert_water_001/0.1.0 with fictional-register/missing-original/independent-review disclosures. Archive and individual text-download controls are disabled; neither is invoked. All nine Add palette buttons and Auto-layout are disabled in the graph snapshot. No case mutation or Save is attempted. This is production control/reading acceptance, not a server denial trace or export of an exact source fingerprint.

An initial Sources snapshot showed the transition shell; settled content contains the full materials overview, so no missing-library defect is inferred. The graph's accessibility/help wording still mentions Delete/drag/edit in inspection-only mode although mutations are protected. Record a bounded UX wording refinement: describe inspection/navigation in that mode and retain all authority checks. Do not enable exports or test forbidden downloads merely to make labels consistent. No claim of complete role/variant/account acceptance follows from this administrator inspection row.


## Native push checkpoint

Run39573444366 on exact candidate767b9abba908cf3963d8bfa5ed63e13f68dc9555 passes all six phases. Independent UTF-8 verification reproduces its retained receipt (SHA256e6c8e61a5196bc866ed3ae5379ffc00a81d8e90f143f239c5c969b76f27c9218), with PIDs26903,33518,38294,42839,47815,52220 and one within-run full-bundle manifest hash906a1db1bbe1abb9ddf868c46a0c5d1b1346fb32c96ba08d84e2d0292a283b6f. No framework_failure record appears in any phase log. This validates successful restart with the diagnostic enabled, not observed failure capture or a fix for negative padding. Companion PR run39573452283 remains pending at this checkpoint.

The pinned SDK's integration callback returns reportData on failed tests, and Response.fromJson retains that data. The new host path reads framework_failures before refusing a failed test. This is inspected API behavior; actual Mac failure-retention acceptance requires a later genuine failure. The [historical Flutter issue97905](https://github.com/flutter/flutter/issues/97905) concerns a different framework version and widget flow; its similar assertion is not evidence of the same cause and does not justify an SDK upgrade or copied workaround.

For the inspection-only wording backlog, current node labels already say Inspection only. The remaining mismatch is specifically relation accessible labels/selected-relation status and the disabled Add palette's generic drag instructions; avoid reimplementing the existing node-label guard.


## Integration and next execution

Companion PR run39573452283 also passes all six phases on candidate767b9ab. Its retained proof independently re-verifies under UTF-8: PIDs32216,38899,43187,48657,51783,56748; within-run identical full-bundle manifest bdf11ea35ae66f4aab55b94dbe4bce512727433a17e2177a03f8b7805102814b; verification receipt SHA256ca19dcd0bb1559bbe6d0b53e546a37f4c6e4a44947444d67b8706901ffd424dd. It also has no framework error record. Both successful runs validate compatibility of the diagnostic with normal execution, not live capture of the intermittent assertion. Do not compare bundle hashes across separately nonce-stamped runs.

All candidate gates pass. PR172 merges normally at6e5fba02f74e5296e388aed582ae41ef359f88cf, with no waived gate, force/admin override or weakened assertion. New merge-triggered exact-main checks are separate and pending. The documentation-only closure adds final proof/QA receipts without restarting the tested implementation candidate. Application/hosting inputs still equal public v158; no new Sites version is needed or claimed.

Next bounded steps: inspect any genuine framework_failures record from the original error callback, retain exact failing source/phase/stack and geometry, then reproduce that specific boundary in a failing regression before correcting application layout. Do not replace that evidence with speculative inset clamping, an SDK upgrade, animation suppression, test error consumption or deadline extension. Keep pagination's received-input investigation open, with the new local and production pointer passes and the production keyboard/capture limits. After reconciling canonical main, a separate inspection-only wording slice may align relation labels/status and palette help; it must preserve all edit/export/save guards and include EN/RU editable-versus-inspection regressions. Preserve every saved case and the existing rejected stale writer.
