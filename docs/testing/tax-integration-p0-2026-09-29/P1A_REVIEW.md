# P1a implementation review
Date: 2026-09-29. Base: edfca4bcd8eccbc72c9c90193529e22b006e15b2. Status: reviewed development checkpoint; integration/publishing receipts belong to the coordinating task.

User outcome: preserve exact tax amounts, nullable results and typed errors at a versioned pure boundary while retaining existing standalone FFI consumers. No bridge command, UI, storage, web/PDF or production activation is added.
Owned paths: tax Cargo.toml; src/lib.rs (three module lines only); new src/money.rs and src/transport.rs; tests/regressions.rs (FFI-only gates); new tests/transport_contract.rs and tests/fixtures/transport/eur_dated_input.json; this file and CONTRACT.md.
Accepted calculator functions and src/ffi.rs remain unchanged. Cargo.lock remains unchanged. No other writer's tracked paths were edited.

## Findings resolved
1. Implementer found the duplicate-field test replaced pretty JSON while its fixture was compact. Initial run failed exactly that new test: existing 46 tests and 11/12 new tests passed; exit 101. Fixed the test payload construction; no production code adjustment was needed.
2. Independent reviewer found typed requests could exceed the 256 KiB aggregate policy while satisfying individual field bounds. Added a capped counting JSON writer after field validation. It allocates no second payload and counts escaped/multibyte bytes. Added oversized typed, exact-limit/+1-byte and negative deductible-sign coverage.
3. Independent reviewer re-read the fix and three added tests: approved, no remaining source-review blocker. Review covered units/float loss, core field mapping, negative/category signs, unknown/duplicate fields, schema handling, allocation bounds, FFI compatibility/no-default symmetry and apparent MSRV compatibility.

## Observed local checks
- Rust 1.95.0 package formatting and diff hygiene passed.
- Full default package run: 21 unit + 25 regression + initial 12 boundary tests passed, 0 failed/ignored; 0 doctests. This retains all 46 existing tests.
- Full no-default package run: 19 unit + 22 pure regression + initial 12 boundary tests passed, 0 failed/ignored; 0 doctests. Only 2 FFI unit tests and 3 FFI-only regressions are excluded; the mixed precision regression's pure assertion still executes.
- After the size fix: final transport_contract suite passed 15/15 with defaults and 15/15 without defaults. The unchanged calculator suites were not redundantly rerun after this boundary-only fix.
- Final Clippy passed in both configurations: cargo clippy -p juris-tax-economics --all-targets --locked [--no-default-features] -- -D warnings.
- Final installed MSRV 1.78.0 checks passed in both configurations: cargo +1.78.0 check -p juris-tax-economics --all-targets --locked [--no-default-features].
- Default/no-default full sequence (remote process 17240) ended with actual exit 0. Final changed-boundary/test/Clippy/MSRV sequence (21644) ended with actual exit 0.
- All builds used the isolated CARGO_TARGET_DIR C:/PROJECTS/Genesis-Juris-Tax-P1A-2026-09-29-target. No global environment or toolchain setting changed.

## Remaining scope
Source review and package checks do not prove native feature unification/export isolation, Android/iOS execution, legacy migration, fact bindings, provenance governance, persistence/restart or web/PDF acceptance. Those remain P1b-P6 in the reconciled integration plan.
The 256 KiB cap bounds raw JSON before deserialization; individual fields/collections are checked after bounded deserialization. Public pure DTO construction is not a claim of provenance or caller attestation.
P1a is safe to integrate as an unlinked development checkpoint after ordinary repository review. Keep exact branch/main and hosted CI evidence separate from this local record; no deployment or distribution is claimed.
