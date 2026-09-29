# Tax calculation amendment — 29 September 2026

## Scope and provenance

This is a development library checkpoint, not a released application feature.
The isolated branch starts at the specified mobile release `268401ab7dbc12cdc80c20a281268189aad01e60`.
Only the tax crate was restored from `3db5edcb9308d4c20fb600fead61013a85eb0576`; its obsolete branch history, progress-file changes and missing application paths were not merged.
The workspace adds one member and the lockfile adds only that package's entry; existing dependency versions are preserved.
The original checkout and its pre-existing Cargo.toml formatting change are untouched (SHA256 `9C621537D520779FD29D49717015E394DF1A2CCCEA7DD9A52CAFFB611E434CED`).

## Intended outcome and acceptance

Every declared tax/benefit/cost input has consistent, explainable calculation behavior.
Valid representable calculations do not panic or wrap; unsupported numeric precision and invalid timing produce typed errors across Rust and the existing C JSON boundary.
One-off benefits enter lifecycle and NPV once; recurring benefits honor inclusive start/end months; terminal cost is discounted at the horizon.
The ROI denominator matches canonical web economics: implementation plus horizon maintenance plus terminal cost.

## Implemented contract

- Monetary input/output units remain integer cents. Model JSON is unchanged.
- Derived base is recomputed from included components. Missing data remains distinct from zero.
- Tax rates use the effective base; amounts use entered tax costs. Negative tax effect is carried in full.
- Existing signed benefit-item realization/probability semantics remain. Realization/probability must be within the declared 0–10000 basis-point range.
- Horizon is any positive u32; annual discount retains the full u16 domain. No web-only 240-month cap is imposed.
- Included benefit start is month 1 or later. End is inclusive and cannot precede start. Start after the horizon is valid but contributes nothing to lifecycle/NPV. One-offs occur only at start.
- Annual summary fields and the standalone recognized-benefit helper remain nominal run rates; they are not forecasts of realized dated horizon benefit.
- Payback remains a simple nominal operating-run-rate estimate; it is not a dated cash-flow break-even promise. Negative implementation cost or nonpositive operating benefit yields no estimate. An unrepresentable positive estimate produces an arithmetic error.
- Signed costs retain their existing domain. ROI is unavailable for nonpositive total lifecycle cost, with `non_positive_lifecycle_cost`; an i32 ratio overflow yields `out_of_range`. Other cash metrics remain available when only the ratio is out of range.
- Tax-base category totals, derivation, benefit sums, annualization, lifecycle and conversions use checked wide arithmetic. Required i64 result amounts that cannot be represented return `arithmetic_overflow`.

## Rounding and NPV precision

Item recognition truncates toward zero once after the combined realization/probability product.
Accrual is held in twelfths of a cent until final lifecycle division; there is no monthly cent loss.
Lifecycle and NPV final amounts truncate toward zero. This deliberately replaces the old NPV rounding-to-nearest policy.
Zero-discount NPV is exactly the integer lifecycle amount.
A sorted monthly event sweep combines overlapping recurring flows, tax, maintenance, one-offs and terminal costs exactly in i128 before discounting. Results and errors are independent of benefit-item order.
Implementation at time zero remains an exact integer outside the floating-point discounted sum; final sign-aware truncation is applied after combining it.
Discount factors use stable logarithms/geometric sums, with compensated accumulation; calculation work scales with cash-flow boundaries rather than horizon months.
The sum of absolute discounted interval contributions must remain below 2^44 cents. This conservative precision budget reserves more than eight guard bits beyond cents. Exceeding it returns `numeric_precision` rather than a falsely precise amount. Exact grouping can reduce large offsetting inputs below the budget; time-zero amounts and zero-discount calculations do not need this floating-point budget.
Web parity applies to shared v1-compatible scenarios after converting currency units to cents. Floating web values and integer Rust fields are not required to have byte-identical representations; fixtures assert less than one cent and one basis point for the applicable fields. Web has no v2 benefit-date equivalent.

## API and persistence compatibility

Numeric Rust helpers now return Result, including tax-base derivation, effective base, recognized benefits and v1 migration. All existing in-crate callers are updated.
C symbol names/signatures and allocated-string ownership remain unchanged. Numeric failures use `{error, detail: {code, ...}}`; existing malformed-JSON/null-pointer errors retain their original `{error}` envelope.
Successful results add an optional ROI-unavailability reason. The new required baseline/optimized tax-cost fields introduced by the predecessor are retained.
Old result JSON missing required tax-cost fields is explicitly rejected; no default zero is invented. Consumers must restore the input model and recompute results. This checkpoint adds no persisted-data integration and no mandatory new model version.

## Recursive review

Initial implementation passed 39 package tests and Clippy, then independent adversarial review reproduced two NPV precision defects: loss of 43 cents on a large implementation-only case, and order-dependent cancellation of huge opposing one-offs.
Both were corrected by the exact event sweep, exact time-zero handling and explicit precision error. Regression tests cover the original failures and order permutations.
Independent compiled-library checks confirmed exact large immediate cost, exact 12-month terminal examples, all helper error envelopes, and 1000 monthly-expanded cash-flow oracle cases with zero observed cent difference. This is independent agent review, not Claude review.
The independent diagnostic remains under `.artifacts/tax-independent-review`; public evidence contains synthetic values only.

## Validation and remaining boundaries

Validation receipts are recorded alongside this review. Package fmt, locked tests and Clippy are required on the final candidate. Rust 1.78 offline locked package check passed; the declared MSRV is unchanged.
No full workspace test suite, browser journey, hosted tax CI, Flutter/Dart bindings, Android/iOS linkage, saved-data format, navigation, PDF output or deployment was performed for this amendment.
The library still builds as rlib and is not a mobile FFI dependency. Existing C-callable functions do not establish native application integration.
No release, Site version, real email, pilot or mobile distribution follows from this checkpoint. Reconcile through a reviewed branch/PR before any future integration work.

Canonical web fixture was executed through Node/tsx on source blob `1c26baab49eb9c2160b8587748ceca4566ae4e9b` (identical to `b355caf:app/tax-economics.ts`). EUR100000 baseline, EUR70000 optimized, EUR50000 implementation, EUR5000 annual maintenance, EUR10000 terminal, 120 months and 8% discount produce EUR190000 horizon net, ROI 172.72727272727272%, payback 24 months and NPV EUR119185.54509718428. The Rust regression converts each input to cents and checks the documented rounding tolerance; it does not treat currency units as cents.
