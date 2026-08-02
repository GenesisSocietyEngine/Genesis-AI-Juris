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
outcomes, Matter Lifecycle state, the Rust-owned judicial decision instance,
and one-fire event identity. A complete outcome must resolve through a
transition into a terminal stage, and every terminal stage must use the
`resolved` stage kind.

`ScenarioSessionRegistry` assigns opaque process-local session IDs. Case IDs
are not session IDs because several saves or concurrent playthroughs may use
the same scenario.

## Mobile protocol

`juris-mobile-bridge` accepts seven transport-neutral JSON commands:

- `create_session`;
- `snapshot`;
- `dispatch`;
- `advance_time`;
- `save_session`;
- `load_session`;
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
`GameSnapshot`. The mapper consumes the authoritative
`judicial_decision_instance` value (`first_instance`, `appeal`, or
`cassation`) and never infers it from stage IDs, outcome IDs, or localized
text. Logistics is registered through `rust_scenario_v1`.

## Persistence compatibility boundary

The command-log envelope keeps schema ID
`genesis.ai-juris.command-log`, envelope schema version 1, and its existing
eight fields. Schema version identifies the wire shape; the separate runtime
marker selects replay and final-digest semantics.

New sessions save as `scenario-runtime-v2`. The loader recognizes historical
`scenario-runtime-v1` through a generic, side-effect-free migration preflight:

- compatible pre-PR #10 canonical saves replay with their exact v1 digest and
  are next written as v2;
- the old valid-v1 early-outcome/nonterminal case is rejected as
  `RuntimeCompatibility` before replay;
- a valid-v1 ordered-effects case that enters a terminal stage, resolves an
  outcome, and then leaves it is also rejected before replay;
- event-owned outcome resolution, and outcome actions whose event queue may
  change stage, are conservatively rejected unless equivalence can be proven;
- compatible v1-labelled PR #10 lifecycle saves verify the v1 digest, derive
  their Rust-owned judicial decision instance, and are next written as v2;
- unknown markers are rejected without falling back to current semantics.

The marker is selected before command payload decoding, and the v1 proof uses
the final ordered `set_stage`, not merely the presence of a terminal stage in
an effect list. This boundary is generic and independent of case IDs.

The v1 digest excludes `judicial_decision_instance` and conditionally includes
`judicial_result` only when present. The v2 digest always includes both keys,
including explicit nulls. Load commits a new registry session only after
preflight, replay, and the marker-selected integrity check all succeed; Flutter
retains its existing session if any step fails.

## Native packaging

Android Gradle selects the Rust target matching Flutter's target platform,
builds the `cdylib`, and packages it under the matching `jniLibs` ABI. The iOS
Runner build phase compiles the Rust `staticlib` for the active device or
simulator architecture and links the three versioned C ABI symbols.

The generic mapper deliberately derives only presentation metrics from the
authoritative facts, evidence, stage, clock, inbox, deadlines, actions, and
outcome. It never interprets conditions or applies effects.
