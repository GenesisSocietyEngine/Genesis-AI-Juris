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

## Project rule

Do not let an LLM or UI mutate `CaseState` directly. Convert intent into a `DecisionId`, validate it through `Simulation::available_decisions`, and apply it with `Simulation::apply`.
