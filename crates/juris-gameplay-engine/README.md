# juris-gameplay-engine

Authoritative deterministic gameplay domain model for GENESIS: AI Juris.

## Responsibility boundary

This crate owns:

- typed simulation time;
- pause and 1×/2×/4× clock rates;
- inactivity escalation;
- mandatory-hearing lifecycle;
- first-instance outcomes;
- appeal authorization and filing windows;
- cassation-ground assessment, authorization, and filing windows;
- terminal closure and case-report generation;
- command idempotency;
- deterministic event replay.

It does **not** own Flutter widgets, localized labels, persistence transport, or
wall-clock sampling. An adapter supplies elapsed real milliseconds and renders
the resulting state/events.

## Important rules encoded by the model

1. A paused clock does not advance, but the state remains readable and non-time
   commands are not globally blocked.
2. UI date strings are never parsed by the domain.
3. Clock accumulation is integer-based and drift-free.
4. Missing a mandatory hearing forces procedural default.
5. A first-instance loss remains open while appeal is available.
6. Appeal and cassation require explicit client authorization.
7. Facts-only disagreement is not a viable cassation ground.
8. Successful cassation remits; it does not directly award a merits victory.
9. A terminal case report is generated exactly once.
10. Duplicate command identifiers cannot reapply effects.

## Adapter flow

```text
platform timer
    -> GameplayCommand::TickRealTime { elapsed_ms }
    -> GameplayEngine::execute(command_id, command)
    -> RecordedEvent[]
    -> GameplayState
    -> Flutter read model
```

The next integration commit should replace duplicated calculations in
`DemoGameRepository` with an adapter over this crate. That integration is
intentionally not part of Commit 10.
