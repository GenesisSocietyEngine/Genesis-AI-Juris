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
- Actual Android replay at source `829ccc5b8e39812a83bffdc3cf8d0dd9a8b60140` observed the numeric keyboard, exact invalid text `250000.001` saved as a draft, and readable import labels at font scale 1.5. It also exercised supported backup recovery and future workspace version 99 remaining read-only with original bytes preserved. The machine-checked receipt is retained at the repository root under `.artifacts/pr68-ios-2026-09-30/android-editor-ux/journey/journey-result.json`; [the application review](REVIEW.md) records its source and artifact details. Raw legacy JSON and FX text remained exact, but the replay exposed the converted-draft aliasing described below.

## Converted legacy draft preservation correction

The source `829ccc5` Android journey found that the editor reused the retained `legacy.status.draft.request` object as its active request. Editing override provenance changed that retained converted draft while leaving its original `input_hash` unchanged. Raw `legacy.original_json`, `legacy.original_sha256`, and `legacy.status.draft.fx_json` were preserved, so their equality alone did not establish preservation of the full import record.

The converted import path now deep-copies the request before assigning it to the active editor. The retained converted draft and its hash remain an import snapshot while provenance, rate, and monetary edits are saved independently.

The new regression failed against the original source at the saved legacy override reason, proving it detects the aliasing (`.artifacts/tax-legacy-alias-before.log`). After the correction, **16/16 focused Flutter tests passed** across import, confirmation, and authoring coverage (`.artifacts/tax-legacy-alias-tests.log`). The new test edits provenance, both rates, and an amount through production widgets; saves to the real filesystem; checks the entire retained legacy object; and verifies edited outbound calculation inputs before saving again. Native response hashes are opaque fixtures in this ownership regression, not an alternate hash implementation or native calculation claim. Focused Dart analysis passed (`.artifacts/tax-legacy-alias-analysis.log`). The successor binary still needs actual Android replay and refreshed exact-source CI.

Root and an independent reviewer found no material issue. The fixture was then aligned with native `original_sha256` and nested `draft.fx_json` fields, and the final targeted regression passed (`.artifacts/tax-legacy-alias-final-targeted.log`). Formatting and diff checks passed.

## Remaining acceptance

The corrected successor must repeat legacy import, edit, save, and cold reopen while verifying the entire converted legacy record and its input hash remain unchanged. Spoken TalkBack output, complete touch-gesture traversal, physical devices, and iOS keyboard/accessibility behavior remain open. The source `829ccc5` Android observations above do not establish this successor's behavior.
