# Training Debrief v1 - local implementation checkpoint

## Status

Training Debrief v1 is implemented and verified locally. The owner explicitly
approved adding the non-persistent, replay-derived
`dispatch_completion_minutes` runtime metadata and continuing the checkpoint.
That decision resolved the architecture stop without changing the command-log
wire format or moving historical reconstruction into Flutter.

This document records both the evidence that caused the stop and the accepted
implementation. It does not authorize a push, pull request, tag, release,
asset publication, version change, or a later roadmap checkpoint.

The audited base is
`19c1c23f2e95c5fb1a98d485913fac3afdf36b63`; the local review branch is
`feat/training-debrief-v1`.

## Required product contract

A populated debrief is eligible only when Rust owns a non-null
`resolved_outcome`. An adverse judgment, open or recoverable lifecycle,
executable remedy, missed deadline, or Failed ERP remittal/open state is not
eligible.

Once eligible, the nested player projection must answer only these factual
questions:

1. which resolved outcome the run reached;
2. which actions the player actually executed, in execution order;
3. when each executed action completed and which declared time/cost values it
   used;
4. the final scenario minute and authoritative initial/current resources;
5. which neutral stable reflection prompts Flutter may present in EN/RU.

It must not enumerate unexecuted actions or authored inventory, infer legal
correctness, score the player, disclose hidden content, or create a second
state machine.

## Existing authoritative sources

| Debrief datum | Current source |
|---|---|
| Eligibility and outcome ID | `ScenarioRuntimeState::outcome_id`, projected as `MobileScenarioSnapshot::resolved_outcome` by `ScenarioSession::snapshot()` |
| Outcome title/summary | The definition entry selected only by the already-resolved outcome ID |
| Final scenario minute | `ScenarioRuntimeState::clock_minutes` |
| Lifecycle | `MatterLifecycleStatus::from_stage(stage.kind, stage.terminal)` |
| Dossier matter status | Rust `DossierMatterStatus`, derived from closure, judicial result, and currently executable remedies |
| Executed action IDs and order | Accepted `ScenarioCommand::Dispatch { action_id }` entries in `ScenarioSession::command_log` |
| Declared action values | `ActionDefinition::time_cost_minutes`, `cost_eur`, and `billable_minutes` |
| Initial resources | `ScenarioDefinition::initial_resources` plus the existing standard zero initialization for spend and billable minutes |
| Current resources | `ScenarioRuntimeState::resources` |
| Per-action completion minute | Private, non-serialized `ScenarioSession::dispatch_completion_minutes`, paired by index with accepted dispatch commands and rebuilt by normal replay |

The legacy `juris_domain::MatterState::action_history` is not a source for the
five declarative production scenarios. It belongs to the older hard-coded
runtime and does not participate in `ScenarioSession`, its bridge, or its save
replay.

## Historical missing information and owner decision

`ScenarioCommand::Dispatch` stores only `action_id`. Runtime
`action_uses` stores only aggregate counts. Neither retains the authoritative
clock minute after each accepted action completed.

That minute cannot be reconstructed from final time and declared duration:

- explicit foreground `advance_time` commands may occur between actions;
- `action_completion_target()` depends on the then-current runtime clock and
  active deadline state;
- Failed ERP uses deadline-advance actions;
- relative deadline activation can recompute due minutes from an action's
  completion anchor;
- temporal boundaries and queued events are processed while an action advances
  the clock and may close the scenario before its nominal target.

The current `available_actions[].completion_at_minutes` value is prospective.
It exists only for actions available in the current state and is no longer
available after an executed action leaves that state.

Consequently, calculating the full decision trail inside `snapshot()` would
have required an O(n) replay of the accepted command log. That was expressly
excluded by the checkpoint and would have made repeated snapshots
unnecessarily expensive.

The owner approved the smallest compatible remedy: retain only each accepted
dispatch's resulting authoritative clock minute in memory. Action identity and
order remain owned exclusively by the accepted command log.

## Implemented compatibility-preserving decision

`ScenarioSession` now contains one non-serialized, replay-derived vector:

```rust
dispatch_completion_minutes: Vec<u64>
```

Normative rules:

- `command_log` remains the sole authority for action ID and execution order;
- append exactly one resulting `state.clock_minutes` after each successful
  dispatch clock boundary;
- never duplicate action IDs, costs, or sequence in the completion vector;
- maintain
  `dispatch_completion_minutes.len() == count(command_log Dispatch entries)`;
- candidate cloning keeps a rejected dispatch atomic: neither the command log
  nor the completion vector is committed;
- normal save loading already replays every accepted command, so it rebuilds
  the vector once as part of authoritative replay;
- never serialize the vector, add it to `ScenarioCommand`, add a ninth save
  field, or include it in either final-state digest profile;
- never replay commands from `snapshot()`.

This is the smallest design that preserves the eight-field
`genesis.ai-juris.command-log` envelope, schema version 1,
`scenario-runtime-v2`, historical save compatibility, fingerprints, final
digests, and C ABI v1 while providing truthful completion minutes.

## Implemented additive projection

The existing snapshot command can carry one optional nested member:

```text
training_debrief?:
  projection_schema_version
  scenario_id
  resolved_outcome_id
  final_scenario_minute
  matter_lifecycle
  matter_status
  executed_actions[]:
    action_id
    sequence
    completion_minute
    time_cost_minutes
    cost_eur
    billable_minutes
  resources[]:
    resource_id
    initial_value
    current_value
  reflection_prompt_ids[]
```

`training_debrief` must be omitted while `outcome_id` is absent. Rust array
order is the accepted dispatch order; Flutter must not sort by localized text
or reconstruct the object from top-level fields. Initial/current resource
values are safer than a universal "consumed" delta because scenario resources
may represent authority, spend, awards, or custom counters and can be assigned
absolutely by effects.

The projection remains derived output. It is not independently saved, hashed,
or accepted as input. The existing JSON execute path is sufficient and no new
bridge command or native symbol is needed.

The neutral stable reflection prompt IDs are emitted in this exact order:

1. `decisive_fact_or_evidence`;
2. `deadline_or_procedural_pressure`;
3. `time_or_budget_tradeoff`;
4. `alternative_replay_strategy`.

## Implemented player presentation

Flutter maps only the nested Rust projection. A missing or null
`training_debrief` produces no debrief model or Matter entry; malformed
required nested data fails with `FormatException`. Unknown future lifecycle,
matter-status, action, resource, and prompt stable IDs remain safe to present.

The EN/RU, scrollable and accessible screen contains Result, Decision trail,
Time/resources, and Reflection sections. Stable action and resource IDs reuse
the existing localization overlays. Opening and closing the screen happens
through the existing clock-suspended navigation boundary and dispatches no
runtime command. Replay uses the existing confirmed reset flow.

## Rejected alternatives

- Omitting completion minutes would not satisfy the approved Training Debrief
  contract.
- Summing declared durations would produce false history for foreground time,
  deadline advances, relative deadlines, and early temporal boundaries.
- Replaying the complete command log on every snapshot violates the explicit
  performance/source-of-truth constraint.
- Enriching persisted commands or the save envelope would create an excluded
  persistence migration for data that normal replay can derive.
- A Flutter ledger or reconstruction would move authority across the Rust
  projection boundary and is prohibited.

## Compatibility and verification

- save identity remains `genesis.ai-juris.command-log`;
- envelope schema version remains 1, runtime compatibility remains
  `scenario-runtime-v2`, and the envelope remains eight fields;
- the completion vector is not serialized and does not participate in either
  digest profile; normal authoritative replay rebuilds it exactly once;
- a rejected dispatch commits neither the command nor its completion minute;
- load remains candidate-session atomic, including malformed and incompatible
  saves;
- the optional projection is omitted until a resolved outcome exists,
  including adverse-but-open, recoverable, and Failed ERP remittal states;
- all five production scenario fingerprints, all 11 canonical paths and final
  digests, and the deterministic mobile bundle remain unchanged;
- C ABI remains version 1 with exactly the existing three symbols.

Local gates passed: Rust 320/320, Flutter 149/149, and Android API 37 native
acceptance 9/9. The locked Rust 1.78 MSRV check, rustfmt, workspace check,
Clippy with warnings denied, bundle check, Dart formatting, Flutter analysis,
Flutter tests, ordinary three-ABI debug APK build, and exact Android export
audit also passed. Hosted iOS was not run locally because this checkpoint was
verified on Windows.

## Local stop boundary

Implementation commits are:

- architecture decision:
  `3c33f92c7cd07f0f2970314535ee368421cb207e`;
- authoritative Rust projection, bridge, and FFI:
  `cdff459f9da8d208bad7f2779ea154563e50e872`;
- Flutter models, mapper, presentation, and tests:
  `1a1e2933f6d236be4c4ff14333931cb65b46c475`;
- Android native navigation harness hardening:
  `5278f1a930ab4eb55174a161766c06ceec720dbe`.

The checkpoint stops at local review. Nothing was pushed; no PR, tag, release,
APK asset, or version change was created; no later roadmap phase was started.
