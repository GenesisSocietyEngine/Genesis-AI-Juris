# GENESIS: AI Juris v0.4.2 — Release Hygiene Patch

v0.4.2 preserves the v0.4.1 simulation rules and fixes two issues discovered by the full local quality gate.

## Corrections

- Added the missing `ActorId` import to the `juris-ai` test module. The production library already compiled; the omission affected `cargo test` and `cargo clippy --all-targets`.
- Replaced `Option::is_none_or` in `juris-engine` with an explicit `match`. `is_none_or` is stable only from Rust 1.82, while the workspace declares Rust 1.78 as its MSRV.
- Added a dedicated GitHub Actions MSRV job that runs `cargo +1.78.0 check --workspace --locked` so the repository toolchain file cannot silently select a newer compiler.
- Updated the workspace and CLI version to v0.4.2.

## Gameplay impact

None. Seeds, available actions, event timing, settlement rules, hearing integrity, AI deliverables, workload, budget authority, and outcomes are unchanged from v0.4.1.

## Release gate

The release is ready only when all of the following pass locally and in GitHub Actions:

```powershell
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The GitHub MSRV job additionally verifies compilation with Rust 1.78.0.
