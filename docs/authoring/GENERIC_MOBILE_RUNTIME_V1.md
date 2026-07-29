# Generic Mobile Runtime v1

## Authority boundary

Canonical `ScenarioDefinition` content is executed only inside
`juris-engine::ScenarioSession`. Flutter receives immutable snapshots and
submits stable action IDs; it does not interpret conditions or apply effects.

```text
Flutter GameRuntimeRepository
  -> Dart FFI / C ABI transport
  -> juris-mobile-bridge JSON protocol
  -> ScenarioSessionRegistry
  -> juris-engine ScenarioSession
  -> immutable MobileScenarioSnapshot
```

## Engine session

`ScenarioSession` validates content before creating mutable state. It supports
all schema v1 condition and effect variants, action repeatability, deterministic
time, automatic events, deadline and asynchronous-task completion, terminal
outcomes, and one-fire event identity.

`ScenarioSessionRegistry` assigns opaque process-local session IDs. Case IDs
are not session IDs because several saves or concurrent playthroughs may use
the same scenario.

## Mobile protocol

`juris-mobile-bridge` accepts four transport-neutral JSON commands:

- `create_session`;
- `snapshot`;
- `dispatch`;
- `dispose_session`.

Responses contain either an immutable snapshot or a stable error code. The
crate forbids unsafe code. The separate `juris-mobile-ffi` crate contains the
small audited unsafe boundary required to exchange owned UTF-8 C strings.

## Flutter boundary

Flutter screens now depend on `GameRuntimeRepository`. The current
`DemoGameRepository` implements that interface for Failed ERP without making
the UI depend on demo-specific mutation.

`NativeScenarioBridgeClient` loads `libjuris_mobile_ffi.so` on Android and
resolves the statically linked symbols from the Runner process on iOS.
`RustScenarioRepository` owns one native session, and
`ScenarioSnapshotMapper` maps its immutable snapshot into the existing
`GameSnapshot`. Logistics is registered through `rust_scenario_v1`.

## Native packaging

Android Gradle selects the Rust target matching Flutter's target platform,
builds the `cdylib`, and packages it under the matching `jniLibs` ABI. The iOS
Runner build phase compiles the Rust `staticlib` for the active device or
simulator architecture and links the three versioned C ABI symbols.

The generic mapper deliberately derives only presentation metrics from the
authoritative facts, evidence, stage, clock, inbox, deadlines, actions, and
outcome. It never interprets conditions or applies effects.
