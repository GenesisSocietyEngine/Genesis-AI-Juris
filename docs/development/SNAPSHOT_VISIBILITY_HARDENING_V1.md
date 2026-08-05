# Snapshot Visibility Hardening v1

## Purpose

The mobile snapshot is a player-facing projection, not an inspection view of
the complete `ScenarioDefinition` or `ScenarioRuntimeState`. It may contain
only information disclosed at the exact authoritative command/replay
position.

This contract applies before JSON serialization. The native bridge, C ABI and
Flutter code transport and present the Rust projection; they do not decide
visibility.

## Audited boundary

The complete definition is retained by `ScenarioSession`, while Rust tracks
disclosure separately through fact status, available evidence, optional
deadline status and visible Inbox IDs. Reveal effects and event processing
update that authoritative state correctly.

Before this checkpoint, the first faulty boundary was
`ScenarioSession::snapshot()`: it copied every authored fact, evidence item,
deadline and Inbox item into `MobileScenarioSnapshot`. Boolean or nullable
fields told Flutter which rows to hide, but the raw response still exposed
stable IDs, English text, authored due times and future action references.

The nested Dossier projection already enforces the required visibility rules.
The hardening checkpoint brings the legacy top-level arrays under the same
player-projection contract while preserving their existing relative definition
order.

## Visibility contract

At every accepted command, replay position and repeated snapshot call:

- facts with authoritative status `unknown` are omitted entirely;
- evidence absent from the authoritative available-evidence set is omitted
  entirely;
- deadlines with no authoritative status are inactive and omitted entirely;
- an open deadline contains only completion-action IDs that are currently
  available; completed or missed deadlines expose no completion-action IDs;
- Inbox items absent from the authoritative visible-Inbox set are omitted
  entirely;
- actors remain absent because schema v1 has no actor-disclosure state and no
  actor array exists in the player snapshot;
- asynchronous tasks remain absent because schema v1 has task lifecycle state
  but no player-disclosure contract and no task array exists in the snapshot;
- evidence-to-fact relationships in the Dossier contain only visible fact IDs;
- unavailable actions, unresolved outcomes and unfired events are not exposed
  through entity arrays or their nested references;
- emitted array lengths describe only emitted, visible entities;
- no redacted placeholder is emitted for hidden content.

An authoritative reveal is deterministic and idempotent: the intended entity
appears exactly once after its state changes, unrelated hidden entities remain
absent, and generating a snapshot never mutates runtime state. Save/load and
command-log replay must reproduce byte-equivalent player visibility.

## Boundary ownership

```text
complete ScenarioDefinition
        |
authoritative ScenarioRuntimeState
        |
Rust player snapshot projection  <-- only visibility filter
        |
versioned JSON bridge / three-symbol C ABI
        |
Flutter mapping and presentation
```

Flutter must not reconstruct hidden inventory, infer visibility from the
clock, keep a case-specific allowlist or replace a missing hidden entity with a
zero/default placeholder. Stable ordering is inherited from definition order
for already-visible top-level entities; Dossier ordering remains its existing
deterministic ID/due-time ordering.

## Compatibility invariants

This checkpoint does not change:

- Scenario Definition v1 content or reveal markers;
- any production scenario, localization or catalogue record;
- scenario fingerprints, canonical traces, outcomes, final minutes or
  final-state digests;
- the eight-field save envelope, schema ID/version or
  `scenario-runtime-v1`/`scenario-runtime-v2` semantics;
- bridge commands or response field names;
- snapshot, application or bundle versions;
- C ABI version 1 or its three exported symbols;
- authoritative event order, action availability, costs, resources or
  billable time.

Filtering changes only which definition-backed rows and nested action
references are present in a player snapshot. Existing keys and DTO shapes are
retained.

## Verification contract

Regression coverage must prove the complete Rust snapshot, raw bridge response
and Flutter model rather than serializing only `snapshot.dossier`. Synthetic
sentinels must cover hidden and visible actors, facts, evidence, deadlines,
tasks, Inbox content and cross-entity references in both English and Russian.

Tests must also prove:

- exact absence before reveal and exact presence after reveal;
- visible-only counts and no dangling hidden references;
- stable order, no duplicates and immutable repeated snapshots;
- save/reload and command-log replay parity before and after reveal;
- all five production scenarios retain their fingerprints, traces, final
  minutes and digests;
- bundle bytes remain unchanged;
- Android and hosted iOS continue through the same native ABI.

## Explicit limitation

This is a player-snapshot boundary, not an encrypted-content or anti-tamper
system. The deterministic mobile bundle intentionally remains unchanged and
therefore still contains complete scenario definitions and localization data
needed to create a native session. A player inspecting packaged application
assets can discover authored content. Removing definitions from the client
would require a separate content-delivery architecture and is outside this
checkpoint.

The snapshot also retains existing player/diagnostic fields such as seed,
flags, numeric metrics, resources and fired event IDs. They are audited for
direct hidden entity IDs and text, but this checkpoint does not introduce a
new presentation allowlist or split an internal diagnostics protocol. Such a
split would be a separate versioned contract; it must not be smuggled into the
entity-visibility fix.
