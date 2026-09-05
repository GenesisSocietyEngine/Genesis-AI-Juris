# Scenario Path Simulator v1

The authoring-time replay harness executes stable action IDs and, for
foreground scenarios, explicit simulated-minute commands against canonical
scenario JSON.

## Purpose

The simulator proves that actions are available in the intended stages,
temporal consequences fire deterministically, each event fires at most once,
unsupported schema shapes fail explicitly, terminal stages resolve an outcome,
and identical commands produce identical results.

It is an authoring/content gate, not a save-state format.

## Action-only input

```powershell
cargo run -p juris-scenario-simulator -- run `
  content/fixtures/authoring/scenario_path_valid.json `
  --actions file_claim,prepare_hearing,accept_judgment `
  --require-outcome
```

## Mixed action/time input

```powershell
cargo run -p juris-scenario-simulator -- run `
  content/cases/greenfire_first_72_hours.scenario.json `
  --commands-file content/traces/greenfire_protected.commands.json `
  --require-outcome `
  --json
```

A command file is a JSON array:

```json
[
  {"command": "dispatch", "action_id": "accept_emergency_mandate"},
  {"command": "advance_time", "minutes": 360}
]
```

It contains no session IDs. Action-only `--actions` remains supported for
backward compatibility.

## Deterministic clock semantics

Action costs and `advance_time` use the same boundary algorithm. At one minute,
consequences run in scenario-definition order with category priority:

1. `at_time` events;
2. async-task completions;
3. deadline misses.

Recursively triggered events finish before the next boundary. A terminal
consequence stops a larger advance at its exact minute. JSON output includes
the final clock, fired events, deadline states, async-task states, outcome, and
terminal status.

The simulator supports the complete condition, effect, and trigger subset
represented by `ScenarioDefinition v1`; unknown shapes fail instead of being
ignored.
