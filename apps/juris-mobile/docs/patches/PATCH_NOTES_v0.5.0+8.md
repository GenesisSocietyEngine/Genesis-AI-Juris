# GENESIS: AI Juris v0.5.0+8

## Clock, Inbox, and post-judgment lifecycle patch

This combined patch addresses three playtest issues discovered after the hearing-rescheduling workflow was introduced.

### 1. Clock advance is available throughout hearing preparation

- `Advance clock to enterprise court hearing` is exposed as soon as a hearing is scheduled or rescheduled.
- The command can jump from an earlier workday directly to the scheduled attendance window.
- The player is warned that unfinished optional preparation will be skipped.
- A registry notification is created when the hearing window opens.

### 2. Meaningful extension-period work

Three one-shot actions are available during the additional preparation period:

- `Prepare hearing strategy memorandum`
- `Prepare client key witness`
- `Reconcile damages schedule`

Each consumes time and budget, changes relevant case metrics, creates an informational Inbox record, and cannot be repeated.

### 3. Inbox read-state lifecycle

- Added an explicit `read` Inbox state.
- Opening an informational `UNREAD` message changes it to `read` immediately.
- Read messages display no status pill.
- `ACTION REQUIRED` messages are not cleared merely by opening them; they remain unresolved until their mapped gameplay action is completed.
- Hearing scheduling and rescheduling notices are informational and now arrive as `UNREAD`, not `ACTION REQUIRED`.

### 4. Judgment follow-up

- Judgment now moves the matter to `Post-judgment` instead of resolving it immediately.
- The judgment message exposes `Inform client and explain judgment`.
- Completing that action resolves the judgment event, improves client trust, and creates a client-briefing record.

### 5. Deterministic optional cassation branch

- After the client briefing, the seeded demo may generate a counterparty cassation challenge.
- Seed `20260724` selects this branch, making it directly testable.
- The challenge creates an `ACTION REQUIRED` message and the action `Prepare response to cassation challenge`.
- Filing the response resolves the event and advances to a deterministic cassation outcome on the next workday.

The cassation workflow is a simplified game mechanic and is not presented as jurisdiction-specific legal advice.

## Regression coverage

Added tests for:

- immediate clock advance after a granted rescheduling request;
- one-shot hearing-preparation actions;
- informational messages losing the `UNREAD` badge when opened;
- judgment client-briefing action and required-status resolution;
- deterministic counterparty cassation event;
- cassation response and final outcome.

## Files changed

- `lib/app/home_shell.dart`
- `lib/data/demo_game_repository.dart`
- `lib/models/game_snapshot.dart`
- `lib/screens/calendar_screen.dart`
- `lib/screens/inbox_screen.dart`
- `lib/widgets/status_badge.dart`
- `test/widget_test.dart`
