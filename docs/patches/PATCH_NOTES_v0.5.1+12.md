# Patch notes — v0.5.1+12

- adds the versioned `juris-mobile-ffi` C ABI over the safe JSON bridge;
- packages a Rust `cdylib` per Android ABI from the Flutter Gradle build;
- adds an iOS Runner build phase for the Rust static library;
- adds the shared Dart FFI transport for Android and iOS;
- embeds authoritative scenario definitions in deterministic mobile bundle v3;
- maps Rust facts, evidence, clock, deadlines, inbox, actions, stages, and
  outcomes into the existing Flutter read model;
- creates, resets, dispatches, and disposes isolated native scenario sessions;
- activates Logistics through the generic `rust_scenario_v1` adapter;
- verifies negotiated and judgment paths in Rust and Flutter;
- verifies native Android session creation, action dispatch, stage/time
  progression, and terminal outcome on the emulator.
