# Generic Mobile Runtime v1

## Authority boundary

Canonical `ScenarioDefinition` content is executed only inside
`juris-engine::ScenarioSession`. Flutter receives immutable snapshots and
submits stable action IDs; it does not interpret conditions or apply effects.

```text
Flutter GameRuntimeRepository
  -> native transport (remaining)
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
crate forbids unsafe code and does not own JNI, Dart FFI, or platform lifecycle
behavior.

## Flutter boundary

Flutter screens now depend on `GameRuntimeRepository`. The current
`DemoGameRepository` implements that interface for Failed ERP without making
the UI depend on demo-specific mutation.

`ScenarioBridgeClient` defines the JSON transport contract and request builders.
No production native client is registered yet, so Logistics remains disabled
in the Case Library even though its authoritative engine readiness is true.

## Remaining native milestone

The next implementation unit is intentionally narrow:

1. compile and package `juris-mobile-bridge` for Android and iOS;
2. expose one synchronous UTF-8 request/response entrypoint;
3. implement the Dart native transport;
4. map `MobileScenarioSnapshot` into the existing `GameSnapshot`;
5. register `rust_scenario_v1` only when the native library is available;
6. activate Logistics and repeat the physical-device checkpoint.
