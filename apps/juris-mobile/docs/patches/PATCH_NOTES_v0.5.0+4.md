# GENESIS: AI Juris v0.5.0+4 — Time progression fix

## Fixed

- `Rest until next workday` now advances relative to the current day.
- Repeated rest commands progress `Day 1 -> Day 2 -> Day 3 -> Day 4`.
- Time resets to `08:00` after each rest.
- Acute fatigue still resets and cumulative strain still recovers gradually.
- Added a regression test covering three consecutive rest commands.

## Root cause

The demo repository assigned `dayLabel: 'Day 2'` on every rest command. The
v0.5.0+3 interaction patch preserved that older hard-coded implementation, so
the simulation could never advance beyond Day 2.

## Architectural note

This parser is intentionally limited to the v0.5.x Flutter demo repository.
The Rust-backed version should expose a structured simulation clock (`day` and
`minute_of_day`) and derive labels only in presentation DTOs.
