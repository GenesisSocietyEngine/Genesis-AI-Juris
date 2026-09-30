# Tax editor input and import presentation review

This bounded follow-up addresses observations from the production Android emulator application at source `6f9583947d870e7ecef0e54880d996367c37dbb4`. It does not close physical-device or spoken screen-reader acceptance.

## Intended result

Invalid or incomplete numeric input must remain saveable as an exact draft while Calculate shows actionable field guidance. The import format, including its version, and the Cancel/Import actions must remain readable at enlarged text sizes. Keyboard configuration must assist entry without rewriting numbers or JSON.

## Observed behavior and correction

The emulator displayed `FormatException: Enter an amount with at most two decimal places, using a dot.` for an invalid annual amount. A blank tax rate previously surfaced Dart's integer parsing exception. The editor now identifies the offending field and presents the amount/range or whole-number guidance without the exception class prefix. Existing native validation and error handling remain authoritative after parsing. Invalid text is retained unchanged, calculation is blocked, and saving preserves the draft without a cached result.

Numeric inputs request a signed numeric keyboard, with decimals enabled for money. No input formatter or automatic numeric normalization was added. The JSON import field disables autocorrection and suggestions, following observed Gboard changes to a camel-case property during paced keyboard entry. Exact source text still reaches the selected production import path.

At Android font scale 1.5, the raw selected schema name clipped its version suffix and the long JSON label ellipsized. The dialog now uses localized, shorter format names with the version retained, permits variable-height dropdown items, and separates the short JSON label from its original-text retention helper. Schema wire values are unchanged. The prior controller teardown correction remains intact.

Original emulator receipts are retained separately under `.artifacts/pr68-ios-2026-09-30/android-accessibility-6f958/` and `android-6f958/`; these describe the earlier binary, not this correction.

## Verification

- Focused Flutter suite: **13/13 passed**, covering invalid monetary text, an out-of-range amount, a blank rate, exact draft persistence, corrected outbound requests, numeric keyboard configuration, existing confirmation invalidation, English/Russian import layouts at 360 logical pixels and text scale 1.5, exact JSON/schema transport, and focused Cancel/back/import teardown. Receipt: `.artifacts/tax-editor-ux-tests.log` in the task worktree.
- Focused Dart analysis of the editor and both test files: no issues. Receipt: `.artifacts/tax-editor-ux-analysis.log`.
- The final import-only rerun passed 6/6, including the longest selected legacy rates/FX label within its dropdown bounds in both languages. Receipt: `.artifacts/tax-import-enlarged-tests.log`. Formatting and diff checks passed. Root and an independent read-only reviewer found no material issue; neither review is device accessibility evidence.
- An additional **6/6 passing** dialog rerun verifies the longest selected legacy rates/FX label also fits within the enlarged dropdown in both languages. Receipt: `.artifacts/tax-import-enlarged-tests.log`. Formatting verification and `git diff --check` passed.
- Emulator replay of the corrected binary is pending until the reviewed source commit is available. Widget coverage is not substituted for application evidence.

## Remaining acceptance

An actual Android replay must record its exact source and APK hash, inspect the numeric keyboard, exercise friendly validation with unchanged saved inputs, and inspect the import dialog at enlarged text before restoring font settings and the synthetic case. Spoken TalkBack output, complete touch-gesture traversal, physical devices, and iOS keyboard/accessibility behavior remain open.
