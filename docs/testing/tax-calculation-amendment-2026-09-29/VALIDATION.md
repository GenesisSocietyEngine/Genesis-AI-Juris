# Validation receipt — 29 September 2026

Recorded at 10:28 UTC (12:28 Europe/Paris); isolated mobile-base development candidate.

| Check | Result |
| --- | --- |
| cargo test -p juris-tax-economics --locked | PASS: 21 unit + 25 regression tests; 0 failed; 0 doc tests |
| cargo fmt -p juris-tax-economics -- --check | PASS, exit 0 |
| cargo clippy -p juris-tax-economics --all-targets --locked -- -D warnings | PASS, exit 0 |
| cargo +1.78.0 check -p juris-tax-economics --locked --offline | PASS, exit 0; isolated target directory |
| git diff --check | PASS |
| Independent compiled-library adversarial review | PASS after one corrective cycle; see INDEPENDENT_REVIEW.md |
| Canonical web fixture after explicit major-unit to cent conversion | PASS; source blob and numeric receipt in REVIEW.md |

Source SHA256 at final verification:
- lib.rs: A6F06942ABA1E12E31E963A251EA828FDC4E3029519CB80FE08BCF738E66F929
- ffi.rs: C86C93734F41D21AFA5687023B925CF7E11442061F377C7BCFCAFB761019CEFD
- regressions.rs: 50EED87D159A3966EA25F66418BF1AE713A541C9266C9567833EAF88B2C949EA

Normal checks used rustc 1.97.1; the separate installed 1.78.0 check establishes the unchanged declared MSRV for the package and its dependencies. Package checks compile the dependent core/domain crates; they do not claim a full workspace or native application test.
Raw local command logs remain under .artifacts/tax-calculation. Sanitized independent probes/results are preserved in INDEPENDENT_DIAGNOSTICS.md. No executable, build output, environment file or private case data is included in the commit.
