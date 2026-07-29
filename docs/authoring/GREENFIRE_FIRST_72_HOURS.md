# GreenFire — The First 72 Hours

Status: implemented as a playable `ScenarioDefinition v1` vertical slice.

## Decision

GreenFire proves that the existing scenario pipeline can support a crisis
matter materially different from debt recovery without adding a second engine
or case-specific Dart repository.

The slice uses only existing schema concepts: stages, actions, conditions,
effects, deadlines, asynchronous tasks, Inbox items, events, outcomes, flags,
facts, evidence, and deterministic action time costs. Flutter remains
non-authoritative and sends stable action IDs through the shared native bridge.

The slice ends at the partner handoff after 72 simulated hours. Its terminal
outcomes are:

- `protected_crisis_position`;
- `compromised_crisis_position`.

## Content inventory

- 4 stages;
- 14 stable actions;
- 3 deadlines;
- 1 asynchronous expert task;
- 7 Inbox items;
- 10 events;
- 2 deterministic outcomes;
- 8 actors, 5 facts, and 7 evidence items.

The temporary `coordinate_operational_period` action advances the foreground
clock in six-hour blocks. A later formal clock-control feature may replace the
interaction without changing the stable legal action IDs.

## Runtime semantics exercised

GreenFire exercises the complete condition/effect/event subset already defined
by schema v1, including deadline lifecycle, asynchronous completion and expiry,
Inbox creation/resolution, fact status changes, and evidence availability.

`preliminary_fire_assessment.usable_until_event` is the
`handoff_window_opened` event. Unreviewed work deterministically fires
`expert_assessment_expired`; reviewed work remains part of the protected path.

## Reference paths

Protected:

```text
accept_emergency_mandate
issue_legal_hold
run_conflict_assessment
appoint_separate_director_counsel
notify_insurers
retain_independent_fire_expert
open_controlled_regulator_channel
submit_initial_regulatory_response
coordinate_operational_period
review_preliminary_fire_assessment
establish_response_protocol
coordinate_operational_period × 9
complete_protected_handoff
```

Expected clock: 4440 minutes.

Compromised:

```text
accept_emergency_mandate
coordinate_operational_period
release_unreviewed_documents
coordinate_operational_period × 11
complete_compromised_handoff
```

Expected clock: 4590 minutes. This route records the three missed deadlines
where applicable and expires unreviewed expert work.

## Scope boundary

This slice does not add dossier, persistence, scoring, capabilities, new FFI
calls, or a case-specific UI/runtime. All names, organizations, authorities,
documents, places, and events are fictional.
