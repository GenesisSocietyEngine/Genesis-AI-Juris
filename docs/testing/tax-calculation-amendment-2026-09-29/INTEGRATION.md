# Integration receipt — 29 September 2026

Initial tax checkpoint: `701395664d9baf9b4a170ef2fe6552456b1e6566`, directly based on mobile release `268401ab7dbc12cdc80c20a281268189aad01e60`.
Reviewed web/CI source merged normally into the tax branch: `bd8b0e07fe4b9c0eded527e1825f0fa3eb66956c` (PR #54). Both histories are preserved; no rebase or force push.

Initial PR #55 validation is retained as evidence, not erased: hosted Rust CI passed, while [web/PDF run 36556324829](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36556324829) failed before tests because the mobile-base PR head lacked `.node-version`; web job `109366234651`. That was a source-completeness limitation, not a tax assertion failure. A fresh hosted run is required on the integrated head.

The normal merge had no conflicts. Relative to the reviewed web/CI source, the result contains the same ten tax checkpoint files (2716 added lines) plus this receipt. Existing web/native source is unchanged from that parent. The Cargo delta remains exactly one workspace member and its ten-line lockfile entry.

Verification on the merged source uses the canonical pinned Rust 1.95.0 toolchain:
- `cargo test -p juris-tax-economics --locked`: PASS, 21 unit + 25 regression tests, zero failures, zero doc-tests.
- `cargo fmt -p juris-tax-economics -- --check`: PASS, exit 0.
- Scoped `git diff --cached --check bd8b0e07fe4b9c0eded527e1825f0fa3eb66956c`: PASS. The whole historical merge includes pre-existing whitespace in reviewed documentation/logs; those unrelated files were preserved.
- lib.rs SHA256 remains `A6F06942ABA1E12E31E963A251EA828FDC4E3029519CB80FE08BCF738E66F929`.
- ffi.rs SHA256 remains `C86C93734F41D21AFA5687023B925CF7E11442061F377C7BCFCAFB761019CEFD`.
- regressions.rs SHA256 remains `50EED87D159A3966EA25F66418BF1AE713A541C9266C9567833EAF88B2C949EA`.

The earlier Clippy, Rust 1.78 package check, independent numeric review and publication scan apply to these unchanged tax source bytes; no claim is made that they replace fresh hosted validation of the combined tree. Raw integration test logs remain local under `.artifacts/tax-calculation`.
PR #55 may be temporarily stacked on PR #54 until the reviewed web/CI change is merged. This does not authorize deployment or establish a mobile tax feature: Flutter/native linkage, application journeys and product acceptance remain outside this calculation checkpoint.
