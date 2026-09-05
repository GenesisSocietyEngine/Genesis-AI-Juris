# GENESIS: AI Juris v0.5.0+7 — Hearing Scheduling and Rescheduling

This patch fixes the hearing-state integrity issue in the Flutter demonstration
repository. A player can no longer attend an unscheduled or not-yet-started
hearing.

## Formal hearing lifecycle

Filing the evidence bundle now creates a mandatory Calendar event:

- `Enterprise court hearing`
- initially scheduled for `Day 5 · 10:00` in the deterministic demo route;
- status `SCHEDULED`;
- a separate registry notice is added to Inbox;
- `Attend enterprise court hearing` is **not** exposed immediately.

On the hearing day at 08:00, the game exposes `Wait until enterprise court
hearing`. That command advances the clock to the scheduled time and only then
unlocks attendance.

Resting past an unattended hearing marks the event `MISSED`, applies procedure
and client-trust penalties, and moves the matter toward judgment on the existing
record.

## Rescheduling request

Opening the hearing from Calendar now exposes `Request rescheduling` while the
simplified request window remains open.

Submitting the request:

- consumes 1h 30m and EUR 600;
- records a pending court request;
- keeps the original hearing date legally active;
- removes the request action while the decision is pending;
- produces a registry acknowledgement in Inbox.

On the next workday, the deterministic demo grants the first timely request:

- the original event becomes `RESCHEDULED`;
- a replacement hearing is created for `Day 9 · 14:00`;
- the replacement receives status `SCHEDULED`;
- the original and replacement events remain visible for audit history.

The model also contains a denied-request state for the later Rust jurisdiction
engine. The demo shell currently grants the first timely request to make the
full interaction directly playtestable.

## Data-model changes

- Added `CalendarItemKind` with `deadline` and `mandatoryEvent`.
- Expanded `DeadlineStatus` with `scheduled`, `rescheduled`, and `cancelled`.
- Added `RescheduleRequestStatus`.
- Extended `DeadlineView` with request lifecycle, decision day, request count,
  and replacement-event provenance.

## Regression coverage

The patch adds tests proving that:

1. evidence filing schedules a formal hearing;
2. attendance is unavailable before the hearing window;
3. Calendar exposes the rescheduling request;
4. the original date remains active while the request is pending;
5. a granted request creates a replacement hearing;
6. the ordinary matter path can wait for, attend, and complete the scheduled
   hearing before judgment.

## Validation commands

```powershell
cd C:\PROJECTS\genesis-ai-juris\apps\juris-mobile

dart format .
flutter analyze
flutter test
```

A full application restart is required because the in-memory
`DemoGameRepository` owns the current deterministic session.
