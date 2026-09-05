# GENESIS: AI Juris v0.5.0-alpha.2

## Scope

Lifecycle and closure stabilization for the Flutter mobile vertical slice.

## Included

- Delegated junior review now has explicit in-progress, ready, reviewed, and
  expired states.
- Junior findings become actionable after the scheduled completion moment.
- Unvalidated junior findings expire when the hearing window opens and become
  an informational missed-opportunity record.
- Resolved matters automatically close obsolete action-required messages,
  pending preparation work, and open calendar items.
- Resolved matters expose a structured `CaseOutcomeSummaryView`.
- Inbox messages are ordered newest-first, with later same-time events above
  earlier insertions.
- Inbox shows a pinned `CASE CLOSED` summary card.
- The case report shows outcome, financial result, performance, successes, and
  missed opportunities.
- Matter screen shows the final outcome and no longer offers a zero-action
  button after closure.

## Architectural invariants captured

- An asynchronous task must have a due moment and a terminal state.
- A preparation task cannot remain active after its usability boundary.
- `Resolved` implies no available actions, no unresolved required messages,
  no active scheduled/open calendar items, and a non-null outcome summary.
- Inbox ordering is based on event time rather than mutation history or status.
