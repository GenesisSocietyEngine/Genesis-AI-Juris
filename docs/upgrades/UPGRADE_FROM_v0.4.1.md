# Upgrade from v0.4.1 to v0.4.2

Extract v0.4.2 over the existing repository without deleting `.git`.

Run the complete local quality gate:

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Commit and push only after all commands pass:

```powershell
git add .
git commit -m "Fix test imports and enforce Rust 1.78 MSRV"
git push origin main
```

After both GitHub Actions jobs are green:

```powershell
git tag -a v0.4.2 -m "GENESIS: AI Juris v0.4.2"
git push origin v0.4.2
```
