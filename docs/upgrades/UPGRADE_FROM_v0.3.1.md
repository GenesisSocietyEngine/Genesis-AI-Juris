# Upgrade from v0.3.1 to v0.4.0

## 1. Preserve the validated v0.3.1 history

From the existing repository:

```powershell
git status
git log --oneline -3
git tag --list
```

The working tree should be clean and the published `v0.3.1` tag should remain unchanged.

## 2. Replace project files

Extract the v0.4.0 archive into:

```text
C:\PROJECTS\Genesis-AI-Juris
```

Allow files to be replaced. Do not delete the hidden `.git` directory.

Open:

```text
genesis-ai-juris.code-workspace
```

## 3. Run the complete release gate

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Do not tag the release until every command succeeds.

## 4. Inspect changes

```powershell
git status
git diff --stat
git diff --check
```

The `.gitattributes` file fixes text files to LF, avoiding Windows/Linux formatting drift in GitHub Actions.

## 5. Commit and push

```powershell
git add .
git commit -m "Build active legal workday v0.4.0"
git push origin main
```

Open GitHub Actions and confirm that the `quality` workflow is green.

## 6. Tag the validated release

Update or confirm the workspace version is `0.4.0`, then:

```powershell
git tag -a v0.4.0 -m "GENESIS: AI Juris v0.4.0"
git push origin v0.4.0
```

Published tags should not be moved after release.

## 7. Run the new vertical slice

```powershell
cargo run -p juris-cli -- start-day --mode assisted --seed 20260724
```

Recommended validation scenarios:

1. Meet all deadlines and use delegation.
2. Deliberately miss the partner brief.
3. Settle before litigation.
4. Litigate with expert evidence.
5. Litigate without expert evidence.
6. Conceal the adverse mailbox and inspect the final judgment factors.
