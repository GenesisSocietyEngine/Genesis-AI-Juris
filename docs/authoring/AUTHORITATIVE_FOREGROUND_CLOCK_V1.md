# Authoritative Foreground Clock v1

Status: accepted and implemented.

## Decision

Scenario time remains exclusively owned by the Rust runtime. A scenario opts
into foreground advancement through data:

```json
{
  "clock": {
    "mode": "foreground"
  }
}
```

Missing `clock` data defaults to `action_driven`. The policy is never inferred
from a scenario ID, action name, deadline, or scheduled event.

Eligible clients send `advance_time` with a positive number of simulated
minutes. One command is limited to 1,440 minutes. Zero, oversized,
action-driven, terminal, unknown-session, and overflow cases return controlled
errors through the existing JSON bridge.

## Deterministic boundaries

Action time costs and foreground commands use one processor. It calculates a
checked target and visits every earlier temporal boundary rather than jumping
to the target. At one minute, consequences are queued in this order:

1. unfired `at_time` events;
2. in-progress async-task completions;
3. open deadline misses.

Repository-definition order breaks ties inside each category. Recursively
triggered events complete before the next boundary. A terminal consequence
stops the clock at its boundary.

## Mobile and native boundary

Flutter pause and speed controls schedule commands; they never mutate time or
send a speed multiplier. Backgrounding cancels future ticks and resuming does
not catch up elapsed wall time. A command error preserves the last snapshot,
pauses ticking, and is shown to the user.

Protocol evolution stays inside the existing UTF-8 JSON execute transport. The
C ABI remains exactly:

- `juris_mobile_bridge_execute`;
- `juris_mobile_bridge_string_free`;
- `juris_mobile_bridge_abi_version`.

## Replay and compatibility

The simulator accepts mixed `dispatch` and `advance_time` command files while
retaining action-only `--actions`. These files are authoring/replay fixtures,
not saves. Removing the former content-level waiting actions is intentionally
pre-persistence and creates no save compatibility claim.

Logistics remains action-driven. GreenFire and GoldenShell are foreground
scenarios. No wall clock, background elapsed time, random drift, new ABI symbol,
or case-specific runtime branch is introduced.
