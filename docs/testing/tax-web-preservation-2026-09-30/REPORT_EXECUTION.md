# Fresh report execution foundation

Outcome: obtain one immutable internal evidence snapshot from current authored
tax inputs and one fresh execution of the shared Rust runtime. Acceptance for
this slice requires stale/incomplete/future refusal, complete source and version
binding, exact integer result formatting and preservation of the caller's draft.
It does not authorize or render a report.

`createTaxReportExecution` freezes the complete draft before its first await,
classifies the exact carrier, derives the accepted web source descriptor and
uses the shared raw-input materializer. It executes the production web repository
once per successful request. Stored result text is retained in the attachment
digest but is never used as a result or fallback. Capability negotiation remains
the repository's responsibility.

The service verifies the request and full source/context against the frozen
input, all transport/input/result/calculation/application-policy versions,
authored request fields, component bindings, required IDs, binding schema and
derived-mode metadata. It validates and binds Rust's hash strings without
reimplementing Rust hashing or attesting an injected runtime. The snapshot
identity includes the complete attachment, source, materialized command,
normalized request, input/binding identities, versions and current typed result.

Exact money values remain signed i64 decimal-cent strings. The formatter uses
integer/string operations throughout for EUR, GBP and USD, EN/RU, negative and
sub-unit values. Nullable base/ROI/payback remain explicitly unavailable, while
zero remains zero. ROI's reason must agree with its availability.

Validation: seven grouped execution tests passed, including all five successful
financial native/WASM corpus variants with complete result equality, concurrent
caller mutation across awaits, same-context changed raw edits, poisoned caches,
request/source/version/binding response mutations, money/ROI/month limits and a
real Rust domain error. The report plus corrected export codec suite passed
17 tests; formatter and materializer have their separately recorded checks.
Focused lint and diff checks passed. Root independently inspected the service,
response verification, failure paths and tests after the derived-metadata fixes.

This is a pure internal foundation: no UI activation, persistence, logging,
renderer, PDF or export grant. Existing access, privacy, professional-review,
redaction and output authority checks must approve any eventual report. P4C
editor adoption must fence asynchronous results. P5 still needs both tax report
profiles and languages, current-source/version-bound receipts, exact extracted
PDF value parity, actual rendering and visual review. Existing legacy PDF greens
cannot close those requirements.
