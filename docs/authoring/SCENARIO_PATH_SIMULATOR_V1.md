# Scenario Path Simulator v1

Commit 11D adds a deterministic authoring-time replay harness. It executes an
explicit sequence of stable action IDs against canonical scenario JSON.

## Purpose

The simulator is a pre-mobile content gate. It proves that:

- authored actions are available in the intended stages;
- typed scenario time advances deterministically;
- `after_action`, explicit `trigger_event`, and fixed `at_time` events fire in
  reproducible order;
- each event fires at most once per replay;
- unsupported conditions and effects are never silently ignored;
- terminal stages resolve exactly one explicit outcome;
- the same scenario and action list produce the same replay trace.

It is not yet the final gameplay runtime or save-state engine.

## Run the reference path

```powershell
cargo run -p juris-scenario-simulator -- run `
  content/fixtures/authoring/scenario_path_valid.json `
  --actions file_claim,prepare_hearing,accept_judgment `
  --require-outcome
```

Machine-readable trace:

```powershell
cargo run -p juris-scenario-simulator -- run `
  content/fixtures/authoring/scenario_path_valid.json `
  --actions file_claim,prepare_hearing,accept_judgment `
  --require-outcome `
  --json
```

Inspect a scenario:

```powershell
cargo run -p juris-scenario-simulator -- inspect `
  content/fixtures/authoring/scenario_path_valid.json
```

## Supported v1 semantics

Conditions:

- `always`
- `stage_is`
- `flag_equals`
- `all`
- `any`
- `not`

Effects:

- `set_stage`
- `set_flag`
- `trigger_event`
- `resolve_outcome`

Automatic triggers:

- `after_action`
- `at_time`

Unsupported gameplay semantics fail explicitly. They should be added only with
tests and deterministic ownership rules.
