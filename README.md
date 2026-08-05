# GENESIS: JURIS

A deterministic, AI-native legal-career simulation with an authoritative Rust
engine and a smartphone-first Flutter interface.

The local production catalogue contains five declarative, Rust-backed cases.
The combined Desert Water branch has passed its local gates and remains
unpublished at the required local-review stop. Its validated Android API 37
build is open for owner playtesting.

## Current production catalogue

| Sort | Scenario | Public case | Canonical fingerprint |
| ---: | --- | --- | --- |
| 10 | `be_commercial_failed_erp_001` | Failed ERP Implementation | `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8` |
| 20 | `be_commercial_logistics_001` | Unpaid Logistics Invoices | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` |
| 30 | `greenfire_first_72_hours` | The First 72 Hours | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` |
| 40 | `goldenshell_recall_at_dawn` | Contaminated Egg Supply Chain | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` |
| 50 | `desert_water_groundwater_claim` | Desert Water | `636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af` |

The Rust engine models:

- active messages and professional deadlines;
- time, overtime, fatigue, and cumulative strain;
- delegation, evidence, budgets, settlement, and litigation;
- AI work product constrained to authorized facts;
- explainable deterministic judgments.

The Flutter shell presents:

- Inbox with unread, action-required, resolved, and archived states;
- matter strength, evidence, budget, workload, ethics, and client trust;
- deadlines and professional capacity;
- AI work product and authority boundaries;
- adaptive Material 3 navigation;
- action review with visible time, cost, and known risk.

## Repository layout

```text
crates/
  juris-core        deterministic time, RNG, and scheduler
  juris-domain      legal state, actions, events, and outcomes
  juris-content     typed JSON scenario loading
  juris-ai          read-only AI actor boundary
  juris-engine      authoritative state transitions
  juris-mobile-bridge transport-neutral mobile JSON command protocol
  juris-mobile-ffi  Android/iOS C ABI for the mobile bridge
  juris-cli         terminal presentation

apps/
  juris-mobile      Flutter mobile shell and APK scripts
```

## Authority rule

Only `juris-engine` may mutate authoritative `MatterState`.

All production cases use the generic engine-side scenario session and the
transport-neutral JSON command protocol:

```text
Flutter action ID
      ↓
Rust command API
      ↓
juris-engine
      ↓
immutable mobile snapshot
```

The Android/iOS C ABI transport and snapshot mapper connect canonical scenarios
to Flutter. Each scenario JSON is bundled, validated by Rust at session
creation, and executed without case-specific transition code in Flutter.
`DemoGameRepository` remains only as historical Failed ERP characterization
infrastructure and is not reachable from the production runtime factory.

## Run the Rust game

```powershell
cargo run -p juris-cli -- start-day --mode assisted --seed 20260724
```

## Prepare the Flutter mobile shell on Windows

Install Flutter and Android tooling, then run:

```powershell
powershell -ExecutionPolicy Bypass -File apps/juris-mobile/tool/bootstrap_flutter_windows.ps1
```

The script generates Android platform scaffolding using the developer's installed Flutter version, then runs analysis and widget tests.

## Run on Android

```powershell
powershell -ExecutionPolicy Bypass -File apps/juris-mobile/tool/run_android_windows.ps1
```

## Build the first debug APK

```powershell
powershell -ExecutionPolicy Bypass -File apps/juris-mobile/tool/build_debug_apk_windows.ps1
```

Expected output:

```text
dist/genesis-ai-juris-v0.5.0-debug.apk
```

## Quality gates

Rust:

```powershell
cargo fmt --all
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Flutter:

```powershell
cd apps/juris-mobile
flutter pub get
flutter analyze
flutter test
```

GitHub Actions runs Rust, Flutter, and native iOS quality gates.

## Documentation

- [`VISION.md`](VISION.md) — product vision and long-term principles.
- [`development-journal.md`](development-journal.md) — engineering decisions and milestone history.
- [`ROADMAP.md`](ROADMAP.md) — release sequence.
- [Mobile UI specification](docs/design/MOBILE_UI_SPEC.md) — screen model and v0.5.1 bridge contract.
- [`RELEASE_NOTES_v0.5.0.md`](docs/releases/RELEASE_NOTES_v0.5.0.md) — mobile-shell scope.
- [`UPGRADE_FROM_v0.4.2.md`](UPGRADE_FROM_v0.4.2.md) — installation and upgrade steps.

## Status

This remains an alpha simulation, not legal advice. All five production cases
execute through the authoritative Rust runtime and the version-1 native bridge.
The local Desert Water integration is not a published release.
