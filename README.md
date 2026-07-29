# GENESIS: AI Juris v0.5.0

A deterministic, AI-native legal-career simulation with a Rust engine and its first smartphone-first Flutter interface.

v0.5.0 is the **Mobile Shell milestone**. The existing terminal game remains available, while `apps/juris-mobile` introduces the product surface intended for Android and iPhone: active Inbox, matter dashboard, calendar, AI associate, career view, and reviewed player actions.

## Current vertical slice

**Matter:** The Failed ERP Implementation  
**Jurisdiction:** Belgium  
**Practice area:** Commercial disputes

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
  juris-cli         terminal presentation

apps/
  juris-mobile      Flutter mobile shell and APK scripts
```

## Authority rule

Only `juris-engine` may mutate authoritative `MatterState`.

The v0.5.0 Flutter application uses a small deterministic demo repository solely to validate interaction design. It is not a second production simulation. The generic engine-side scenario session and transport-neutral JSON command protocol now implement the narrow v0.5.1 contract:

```text
Flutter action ID
      ↓
Rust command API
      ↓
juris-engine
      ↓
immutable mobile snapshot
```

Android/iOS native transport and snapshot mapping remain before canonical
scenarios can launch from Flutter. Until then the Case Library keeps those
cases visibly non-playable instead of falling back to another case's demo.

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

GitHub Actions runs both Rust and Flutter quality gates.

## Documentation

- [`VISION.md`](VISION.md) — product vision and long-term principles.
- [`development-journal.md`](development-journal.md) — engineering decisions and milestone history.
- [`ROADMAP.md`](ROADMAP.md) — release sequence.
- [Mobile UI specification](docs/design/MOBILE_UI_SPEC.md) — screen model and v0.5.1 bridge contract.
- [`RELEASE_NOTES_v0.5.0.md`](docs/releases/RELEASE_NOTES_v0.5.0.md) — mobile-shell scope.
- [`UPGRADE_FROM_v0.4.2.md`](UPGRADE_FROM_v0.4.2.md) — installation and upgrade steps.

## Status

This remains a vertical prototype, not legal advice. The mobile shell is interactive and testable, but v0.5.0 does not yet call the Rust engine. The first engine-backed APK is the explicit objective of v0.5.1.
