# CV-032 · iOS Simulator launch reliability

The audit baseline was main `2e7accb4` and the CV-010 prototype was checked at `7841dfa5`. See the [priorities and three CI failure records](../development/BACKLOG_AND_DEVELOPMENT_PRIORITIES.md).

The candidate gives only `xcrun simctl launch` a 120-second command timeout, matching the existing install command allowance. It issues one launch. A timeout retains up to 1 MiB from each partial output stream, then propagates the exception. Even a PID-looking line in partial stdout does not authorize attachment. The existing phase deadline, bundle and executable identity checks, VM PID validation and runtime receipts still apply.

Local recheck on 17 November:

- Nine phase lifecycle tests passed. The new timeout case checks both partial streams, failure propagation and absence of a launch receipt or Flutter drive.
- All ten focused portal departure, scanner transport, Billing and Reports regressions passed.
- The two disposable D1/R2 route scenarios passed for portal upload/revocation and authorized case identity. These do not exercise an active production client.
- Both exact-head CV-010 prototype tests passed.
- Local tests use mocked native commands. Actual Simulator launch and restart acceptance runs on the macOS CI worker. One passing hosted run cannot establish that intermittent failures have been eliminated.
