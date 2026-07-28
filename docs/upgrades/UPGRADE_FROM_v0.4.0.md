# Upgrade from v0.4.0 to v0.4.1

Extract the archive over the existing repository root while preserving the hidden `.git` directory.

```powershell
cd C:\PROJECTS\Genesis-AI-Juris
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Run the integrity replay:

```powershell
cargo run -p juris-cli -- start-day --mode assisted --seed 20260724
```

Commit only after all checks pass:

```powershell
git add .
git commit -m "Harden simulation integrity v0.4.1"
git push origin main
```

After GitHub Actions is green:

```powershell
git tag -a v0.4.1 -m "GENESIS: AI Juris v0.4.1"
git push origin v0.4.1
```
