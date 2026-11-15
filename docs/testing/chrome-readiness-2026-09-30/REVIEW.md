# Chrome readiness and owned-process cleanup

This bounded harness correction starts from PR #72 source `6c86bfb5b2e41331860974342b863536c3a67916` in an isolated checkout. It does not change the active iOS candidate, tax execution, browser flags, dependency pins, or the packaging/Worker acceptance requirements.

## Outcome and acceptance

The packaging verifier must either open the actual owned browser's debugging connection within its existing 20-second readiness budget, or fail with retained startup and process evidence. Both successful verification and failure must await bounded, scoped cleanup. Missing readiness, a failed cleanup, or a failed financial assertion must never become a successful run.

## Observed failures

The push web job for `6c86bfb` (run `36785086781`, job `110124461862`) repeated the earlier `040c580` failure: `DevToolsActivePort` was absent when the old 200 × 100 ms polling loop ended. The retained stderr contains D-Bus diagnostics, but does not establish why Chrome failed to publish its endpoint. The old launcher did not retain spawn/exit state and only requested termination without awaiting it. The runner subsequently reported orphan Chrome PID `7013` during cleanup. An exact cause such as early exit, stalled initialization, delayed publication or an environmental resource issue is **not established**.

For that failed run, 1,140 web tests passed, three were skipped, and the two D1 migration controls plus 49 complete RSC and SSR responses passed. Browser parity/negative controls did not execute; the later Worker and audit steps were skipped. Diagnostic artifact `11130031665` is 221,492 bytes, SHA-256 `dd0d18ef8fa67b0ba42b23de6a1af6fb806f32f561efb81013d01212a4f20310`. The companion PR web run and both PDF jobs passed independently. None of those successes substitutes for the failed push browser gate.

## Correction

- `owned-chrome.mjs` starts a new owned process, immediately records spawn/error/exit/close events and retains separate immutable start/terminal records per launch. Raw stdout/stderr are retained up to 4 MiB each, with explicit total/retained byte counts and truncation status. The existing `chrome.log` artifact remains available.
- Port-file creation can precede completion of its contents. The verifier waits for the complete supported grammar, validates its port and browser path against the actual loopback HTTP endpoint, then opens the advertised initial page WebSocket. File discovery, HTTP and WebSocket connection share the same monotonic 20-second deadline. An absent initial page can be retried; contradictory or ambiguous endpoint identity fails closed.
- Cleanup requests graceful browser shutdown where possible. On POSIX it owns a newly created process group and waits for child close and group absence, escalating only that group from TERM to KILL within explicit 2-second/3-second cleanup bounds. Failure is retained and remains a failed verification; inherited pipes are released after unsuccessful cleanup so they cannot hang the verifier indefinitely.
- Windows cleanup is limited to the created PID tree via scoped `taskkill`, plus observed direct-child close. The receipt explicitly does **not** claim independent descendant-absence verification on Windows. POSIX group-absence controls must execute on the hosted platform.
- A timed-out CDP request's late response no longer dereferences a missing pending handler. All existing 49-response comparisons, source/canonical checks, missing/corrupt/CSP negative controls and later real Worker checks remain unchanged.

## Verification and limits

The final Windows control run passed **nine tests**, with **two explicit POSIX-only skips**. The controls exercise real owned child processes and a tiny HTTP/WebSocket transport: partial file/page readiness, missing executable, early nonzero exit, port/HTTP/WebSocket deadlines, invalid remote endpoint, preservation of the primary error, and exclusion of an unrelated process. A real child's close-event delivery is deliberately delayed to verify the distinction between process exit and later stdio closure. The POSIX controls additionally cover a proven-ready TERM-ignoring descendant and retained cleanup failure. They are lifecycle fixtures, not financial runtime substitutes.

An actual installed Chrome 138 Windows run opened its real debugging endpoint, returned `Browser.getVersion`, and retained child exit/stdio close in an isolated profile. The first full local packaging attempt then exposed a Windows cleanup race: the process had exited with code zero before `taskkill` reported "not found", while inherited stdio had not yet closed. That attempt remains retained as a failure. The correction checks process exit separately and still awaits bounded pipe closure; it does not treat a failed termination request as successful process-absence evidence.

The corrected full local packaging run exited **zero**: all **49 complete responses in each of browser, RSC and SSR**, canonical/source checks, missing/corrupt/CSP controls, and awaited Windows cleanup passed. It used the retained generated build from `8bfa5e75007216b7dcf5b5a5e8f48c657192e387`: all 438 copied build files were checked bytewise against their origin, and the existing production verifier required the complete application-input SHA-256 `328943c120582421858bfcfeed6acf03170744d94ed6a789a21a2dfbae886aef`, matching source `6c86bfb`. Its receipt explicitly records the uncommitted correction based on `6c86bfb`, rather than claiming a clean new-head build. The ignored local verification manifest is SHA-256 `26521f92d454a36d70bf63976b3c3fdb9ebeff27a77d6b3a2ca848381e95804d`.

Whole-project TypeScript checking, final focused test/helper type checking, focused ESLint and diff checks passed. Exact locked installation retained both package files and installed 527 packages. Independent root review accepted the complete implementation, tests and the observed Windows cleanup correction.

This remains Windows Chrome 138 evidence, not the hosted Chrome 154 environment or proof that the original unexplained startup condition has disappeared. The two POSIX controls and new exact-source CI remain required. The later production Worker route proof was not rerun for this launcher-only change and remains a separate CI gate. No workflow rerun, timeout increase or acceptance bypass was used for the correction.
