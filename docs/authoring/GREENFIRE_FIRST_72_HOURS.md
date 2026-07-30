# GreenFire — The First 72 Hours

Status: playable `ScenarioDefinition v1` vertical slice.

## Decision

GreenFire demonstrates that the shared scenario pipeline supports an
industrial crisis without a second engine or a case-specific Dart repository.
Rust owns conditions, effects, time, deadlines, async work, Inbox state, and
outcomes. Flutter submits stable commands through the shared native bridge.

The slice ends at the 72-hour partner handoff with one of two outcomes:

- `protected_crisis_position`;
- `compromised_crisis_position`.

## Content inventory

- 4 stages;
- 13 stable actions;
- 3 deadlines;
- 1 asynchronous expert task;
- 7 Inbox items;
- 10 events;
- 2 deterministic outcomes;
- 8 actors, 5 facts, and 7 evidence items.

The scenario declares `clock.mode: foreground`. While the app is active,
Flutter sends explicit deterministic minute commands to Rust. Pause and speed
change only whether and how often those commands are sent. No simulated time
catches up while the app is backgrounded.

## Runtime semantics exercised

`preliminary_fire_assessment.usable_until_event` is
`handoff_window_opened`. Unreviewed work deterministically fires
`expert_assessment_expired`; reviewed work remains part of the protected path.
Action costs and foreground time share one Rust boundary processor.

At the same simulated minute, Rust processes `at_time` events, async
completions, and deadline misses in that order, using scenario-definition order
inside each category.

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
advance_time 360
review_preliminary_fire_assessment
establish_response_protocol
advance_time 360 × 9
complete_protected_handoff
```

Expected result: `protected_crisis_position` at 4440 minutes.

Compromised:

```text
accept_emergency_mandate
advance_time 360
release_unreviewed_documents
advance_time 360 × 11
complete_compromised_handoff
```

Expected result: `compromised_crisis_position` at 4590 minutes, with applicable
deadlines missed and unreviewed expert work expired.

The executable mixed traces live under `content/traces`. They are
authoring/replay inputs, not a save format.

## Scope boundary

This slice does not add dossier, persistence, scoring, capabilities, new C ABI
symbols, or a case-specific UI/runtime. All names, organizations, authorities,
documents, places, and events are fictional.
