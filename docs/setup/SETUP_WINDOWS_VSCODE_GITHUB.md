# Windows, VS Code, and GitHub setup

## 1. Extract the project

Extract the archive to a normal development path, for example:

```text
C:\Projects\genesis-ai-juris
```

Avoid opening the project directly inside the ZIP archive.

## 2. Install prerequisites

Install:

- Git for Windows
- Visual Studio Code
- Rust through `rustup-init.exe`
- Microsoft C++ Build Tools if the Rust installer requests them

Open a new PowerShell terminal and verify:

```powershell
git --version
rustup --version
rustc --version
cargo --version
code --version
```

## 3. Open the generated VS Code workspace

Recommended:

1. Start VS Code.
2. Select **File → Open Workspace from File…**.
3. Select `genesis-ai-juris.code-workspace`.
4. Trust the workspace because it contains code you control.
5. Install the recommended extensions when VS Code offers them.

To generate the workspace manually instead:

1. Select **File → New Window**.
2. Select **File → Add Folder to Workspace…**.
3. Add the extracted `genesis-ai-juris` folder.
4. Select **File → Save Workspace As…**.
5. Save it as `genesis-ai-juris.code-workspace` in the project root.

## 4. Compile and test

In VS Code, open **Terminal → New Terminal** and run:

```powershell
cargo check --workspace
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

You can also use **Terminal → Run Task…** and select one of the included Juris tasks.

## 5. Run the game

```powershell
cargo run -p juris-cli -- start-case --mode assisted --seed 20260724
```

Other modes:

```powershell
cargo run -p juris-cli -- start-case --mode career
cargo run -p juris-cli -- start-case --mode hardcore
cargo run -p juris-cli -- start-case --mode tournament
```

## 6. Create a separate GitHub repository in VS Code

1. Open **Source Control** with `Ctrl+Shift+G`.
2. Select **Initialize Repository**.
3. Stage all files.
4. Enter the commit message `Initial GENESIS: AI Juris v0.2.0 prototype`.
5. Select **Commit**.
6. Select **Publish to GitHub**.
7. Sign in if prompted.
8. Name the repository `genesis-ai-juris`.
9. Prefer **Private** until you decide on licensing and public release.

VS Code creates the GitHub repository, configures `origin`, and pushes the initial commit.

## 7. Equivalent terminal commands

```powershell
cd C:\Projects\genesis-ai-juris
git init
git add .
git commit -m "Initial GENESIS: AI Juris v0.2.0 prototype"
git branch -M main
```

After creating an empty repository named `genesis-ai-juris` on GitHub:

```powershell
git remote add origin https://github.com/YOUR-USER-NAME/genesis-ai-juris.git
git push -u origin main
```

Do not ask GitHub to pre-create a README, `.gitignore`, or license when using this route, because those files already exist locally.
