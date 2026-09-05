# GENESIS: AI Juris v0.5.0+9.2

## Cassation progression and orphaned expert-action repair

This cumulative mobile patch fixes two lifecycle dead ends discovered during the
post-judgment playtest.

### Cassation decision progression

After `Prepare response to cassation challenge`, the generic rest action is
replaced by an explicit `Await Court of Cassation decision` action. Executing
that command advances the deterministic demo to the cassation outcome and
prevents the player from appearing stuck at `Cassation pending`.

### Expert report cleanup at the hearing

If an expert report becomes available during the clock advance to the hearing,
the player may still review it before attending. If the player attends without
reviewing it, the report's action-required item is resolved and an informational
record explains that the preparation opportunity was missed. It no longer
remains as an impossible response after the hearing.

Reviewing either the normal or at-hearing expert-report message now resolves all
matching report-ready notification variants.

### Regression coverage

- unreviewed expert report no longer remains action-required after attendance;
- cassation response exposes a dedicated decision-wait action;
- the dedicated action advances to a deterministic cassation outcome.
