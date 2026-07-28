# Upgrade from v0.4.2 to v0.5.0

1. Preserve the repository `.git` directory.
2. Extract v0.5.0 over the repository root.
3. Run the Rust quality gate.
4. Install Flutter and Android tooling if not already present.
5. Generate Android platform files using the provided bootstrap script.
6. Run Flutter analysis and tests.
7. Build the debug APK.

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

powershell -ExecutionPolicy Bypass -File apps/juris-mobile/tool/bootstrap_flutter_windows.ps1
powershell -ExecutionPolicy Bypass -File apps/juris-mobile/tool/build_debug_apk_windows.ps1
```

Commit the generated `android/` directory after a successful local build. Do not commit `android/local.properties`, `.dart_tool/`, or `build/`.
