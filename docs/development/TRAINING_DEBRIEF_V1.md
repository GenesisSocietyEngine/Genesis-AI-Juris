# Training Debrief v1 - architecture decision checkpoint

## Status

Training Debrief v1 is paused before production implementation. The evidence
audit found that the current authoritative `ScenarioSession` cannot project
the required per-action completion minute without either replaying the full
command log during every snapshot or retaining one additional piece of
replay-derived runtime metadata.

The checkpoint instructions explicitly require an architecture stop in this
case. This document records the evidence and the smallest compatible follow-up
for owner review. It does not authorize or claim a Rust, bridge, FFI, Flutter,
scenario, persistence, bundle, APK, native, tag, release, push, or PR change.

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
| Per-action completion minute | **Not retained** |

The legacy `juris_domain::MatterState::action_history` is not a source for the
five declarative production scenarios. It belongs to the older hard-coded
runtime and does not participate in `ScenarioSession`, its bridge, or its save
replay.

## Exact missing information

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
require an O(n) replay of the accepted command log. That is expressly excluded
by the checkpoint and would make repeated snapshots unnecessarily expensive.

## Recommended compatibility-preserving follow-up

Subject to explicit owner approval, add one non-serialized, replay-derived
vector to `ScenarioSession`:

```rust
dispatch_completion_minutes: Vec<u64>
```

Normative rules:

- `command_log` remains the sole authority for action ID and execution order;
- append exactly one resulting `state.clock_minutes` after each successful
  `dispatch_unlogged()` clock boundary;
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

## Proposed additive projection after approval

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

## Decision required

Production implementation may resume only after the owner explicitly approves
the non-serialized replay-derived completion vector, or explicitly revises the
requirement for authoritative per-action completion minutes.

If approved, the next implementation must first add invariant and lifecycle
tests for the vector, then add the optional Rust projection, bridge/FFI byte
tests, Flutter nested-only mapping and UI, full host/native gates, and the
cumulative local handoff. No publication is implied.
