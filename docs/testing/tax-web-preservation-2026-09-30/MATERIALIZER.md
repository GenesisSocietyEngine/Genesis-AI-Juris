# Shared raw input conversion for editor and reports

Outcome: the future editor and report path submit the same current raw inputs to
Rust. Acceptance requires exact decimal conversion, no blank/invalid fallback to
old request values or cached results, preserved incomplete/inactive drafts,
explicit source/provenance confirmation, and complete real-Rust fixture parity.
This is a pure P4C/P5 prerequisite; no editor or report flow is activated here.

`app/tax-materialize.ts` snapshots the document/source synchronously, validates the
known carrier shape, and compares the complete source descriptor. It returns a
deeply frozen ready request or field-addressed incomplete/stale issues. Revisions
never advance and changed sources never rebind implicitly. Every active raw amount
uses exact signed-i64 cents; raw integer fields use their Rust u16/u32 wire limits.
Canonical decimal syntax matches mobile entry: dot, at most two decimals, no
whitespace/locale guessing. Unlike the mobile field's narrower amount policy,
this converter validates wire representation and leaves financial domain caps to
Rust, whose errors are tested and remain errors. No TypeScript financial formulas
or cached-result fallback are introduced.

Optional blank override/benefit values become explicit null. Excluded unfinished
benefits and nonrequired/unconfirmed/excluded bindings stay in the untouched
authoring document but are omitted from execution. Rates require explicit current
confirmation. Retained required components require confirmation, owner and as-of
provenance; Rust independently checks source anchors, actual dates, bounds and
financial validity. `ready` means convertible authoring input, not a valid result.

Eight new tests passed with actual Node/shared Rust WASM. Amounts, negative tax
effect, dated benefits, derived rates and manual override reproduce their entire
existing native web-corpus responses exactly, including hashes/context. Additional
cases cover the 100x money boundary, i64 endpoints, u16/u32 limits, blanks/invalid
values, stale source and bindings, required confirmation, inactive draft retention,
nullable benefit values and Rust domain rejection without fallback. Initial test
fixture TypeScript inference/assertion errors were corrected without changing
production behavior. Focused ESLint and the subsequent whole-project TypeScript
run passed.

Independent verifier review found no material issue. Eight extra probes passed
for actual Rust rejection of missing manual override provenance/invalid date,
benefit integer maxima and maximum-plus-one, and nested freezing/detachment after
caller mutation. No caller document is rewritten. Actual web editing, saved-data
reload, report identity/output and PDF visual acceptance remain separate.
