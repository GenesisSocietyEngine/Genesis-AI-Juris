# Temporal and Outcome Diagnostics v1

Commit 11C adds authoring diagnostics that complement the existing scenario
validator.

## Diagnostic layers

### AUT500 — Temporal coherence

The tool verifies typed scenario time rather than formatted UI strings:

- `minute_of_day` must be between 0 and 1439;
- a deadline cannot activate after it is due;
- a fixed completion event cannot occur after the deadline;
- a deadline's missed event must use `deadline_missed` for that deadline;
- asynchronous tasks require positive durations;
- expiry cannot precede a declared usable-until boundary;
- fixed-time appeal and cassation events cannot precede their judgments.

### AUT600 — Outcome completeness

The tool verifies:

- every terminal/resolved stage has an outcome;
- outcomes target terminal stages;
- every outcome has at least one producer;
- one transition resolves only one outcome;
- unconditional outcomes for one terminal stage are not ambiguous;
- simple contradictory conditions are rejected.

### AUT700 — Remedy integrity

A `post_judgment` stage cannot itself be terminal. First-instance loss must
remain open for client instructions, appeal advice, settlement assessment, or
acceptance and closure.

## Usage

```powershell
cargo run -p juris-scenario-diagnostics -- validate `
  content/fixtures/authoring/temporal_outcome_valid.json
```

Machine-readable output:

```powershell
cargo run -p juris-scenario-diagnostics -- validate `
  content/fixtures/authoring/temporal_outcome_valid.json `
  --json
```

The core structural/reference/lifecycle/reachability/terminal validator remains
an earlier required gate. This crate adds authoring semantics without relying on
display text.
