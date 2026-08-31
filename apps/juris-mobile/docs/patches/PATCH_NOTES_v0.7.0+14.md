# Mobile v0.7.0+14 — Guided Studio parity

## Product outcome

- Adds the same six workflow stage IDs used by web Guided Studio: Describe,
  Review AI draft, Facts, Case map, Test, and Finish. When a connected AI plan
  is unavailable, mobile presents an explicit safe starter proposal rather
  than implying that a local template was produced by AI.
- Adds three low-entry starts: guided example, own case, and canonical JSON
  import.
- Keeps the authored artifact as `ScenarioDefinition` v1. Flutter does not
  introduce a second case schema.
- Requires authoritative Rust schema validation and an executable Rust route
  test before Finish and export are unlocked.
- Persists only the canonical scenario and the six-stage UI progress envelope.
- Supports English and Russian Studio guidance and adaptive phone/tablet
  layout using the existing Juris design system.

## Release gates

- `cargo fmt --all -- --check`
- `cargo check --workspace`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `flutter analyze`
- `flutter test`
- Android arm64 debug APK with packaged `libjuris_mobile_ffi.so`
- iOS Simulator build, exact FFI export audit, and native lifecycle test
- canonical mobile bundle fingerprint and the existing 18-route parity gate

Mobile parity is mandatory. Web v54 must not publish unless every applicable
web, Rust, Flutter, Android, iOS, and 18-route gate is green for the exact
release commits.
