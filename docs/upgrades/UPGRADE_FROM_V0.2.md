# Upgrade notes from v0.2

v0.3 is an architectural replacement, not an in-place API-compatible patch.
Keep the v0.2 Git tag, then copy v0.3 into the repository and commit it as a
new milestone.

Recommended Git sequence:

```powershell
git status
git add .
git commit -m "Format v0.2 prototype"
git tag v0.2.0
```

Replace the working tree with v0.3 files, then:

```powershell
cargo fmt --all
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
git add .
git commit -m "Introduce event-driven legal workday architecture"
git tag v0.3.1
git push origin main --tags
```
