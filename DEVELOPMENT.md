# Local development

## Prerequisites

1. Git
2. VS Code
3. Rust installed through rustup
4. VS Code extension: rust-analyzer

Verify:

```powershell
git --version
rustup --version
rustc --version
cargo --version
code --version
```

## Quality commands

```powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## August 2026 progress snapshot

### Product status

The August 2026 work consolidated the project into a v60/v61 release-candidate posture. The repo no longer treats the build as a loose sequence of disconnected prototypes; it now tracks a coherent product state with explicit release metadata and publication-grade checkpoints.

### What matured in August

- Snapshot visibility, content retention, and pressure/countermove runtime logic were hardened.
- The training debrief and mobile-facing visual identity work were accepted as part of the production baseline.
- GreenFire and other scenario checkpoints were validated sufficiently to become part of the stable product inventory.
- The project now distinguishes between:
  - internal product validation;
  - release-candidate deployment readiness;
  - and signed store binaries, which are still not presented as complete production artifacts.

### Current release posture

The active release coordinate is `v60-v61-rc.1`, with the repository metadata aligned to:

- Rust workspace version `60.0.0`
- Flutter app version `60.0.0+61`

This is the correct point-in-time release-candidate identity for the current August baseline and should be treated as deployment-preparation metadata, not as a finalized downstream release artifact.

## Project rule

Do not let an LLM or UI mutate `CaseState` directly. Convert intent into a `DecisionId`, validate it through `Simulation::available_decisions`, and apply it with `Simulation::apply`.
