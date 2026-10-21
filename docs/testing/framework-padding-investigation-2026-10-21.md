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
