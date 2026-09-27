# Full-suite runtime diagnosis — 2026-09-27

Read-only investigation of root execution session `21204`, observed around 11:23–11:25 Europe/Paris. No application/test code changed, no inspector attached, and no process stopped. No additional P1 test run was started.

## Evidence

- Full runner PID `22080`, created 11:11:29: pinned Node 22.23.2 with `--experimental-sqlite --import tsx --test --test-concurrency=4 tests/*.test.ts`.
- Its sole remaining test child was PID `21060`, created 11:14:01, executing `tests/p1-organization-erp.test.ts`; local Miniflare/workerd child PID `4216` remained attached. Separate build, browser and other agents' test processes were identified and left untouched.
- `evidence/continuation-full-tests.log` was 348,824 bytes and last changed at 11:17:51 after passing test 496, `P1: selection, cursor, CSRF and unavailable compliance features fail closed`.
- That test is not the file's final test. At line 588, the next top-level test is `Canopy V2: independent reviewed copies, causal walkthrough and exact output governance`. It initializes case versions and a synthetic organization, then runs four sequential scenarios with source uploads/reviews, proposals/acceptance, simulations, evidence links, snapshots, governed PDF/JSON output, approval/denial checks and replay. Two further nested walkthrough/runtime tests follow. Its file-level `after` hook disposes Miniflare after these complete.
- `.artifacts/canopy-v2/sources/` files were written at 11:17:56, proving entry into this next test immediately after the last logged test. No scenario result files had yet been written when inspected.
- Two process samples 10 seconds apart showed the runner itself idle while awaiting its child; child PID 21060 gained **1.015625 CPU seconds**, and workerd PID 4216 gained **0.09375 CPU seconds**, **610,261 bytes read** and **952,584 bytes written**. This is active work, not an idle process left after all tests completed.
- Historical context only: `demo-readiness-canopy-2026-09-06/docs/testing/demo-readiness-canopy-v2-2026-09-06/unfiltered-test-receipt.json` records a successful unfiltered test run on the same pinned Node version lasting about **46 minutes** (2026-09-06 17:03:39–17:49:44 UTC, 562/562), with this Canopy V2 parent included. That older PASS does not certify the current candidate.

## Assessment and next observation

At the time inspected, evidence supports **an active long Canopy integration test**, not a demonstrated leaked-process hang. The current complete suite had run about 14 minutes; the Canopy parent about 7 minutes. Let the existing runner continue and avoid a duplicate P1 run. A future lack of CPU/I/O progress, explicit failure, or completion result must be evaluated separately; this observation does not mark the full suite PASS.

The test runner does not expose the exact currently awaited route through these read-only counters. Progress is bounded here by runtime activity and fixture initialization, not inferred completion. Root retains ownership of session 21204 and the final suite result.

## Input continuity check

The later current-source run excludes this still-running P1 file. To check that retaining its result is appropriate, the coordinator inspected both the P1 route bundle dependency closure and the test's direct-import closure: 111 current local source inputs, all last modified before runner launch at `2026-09-27T09:11:29Z`. This includes `case-report.ts` and `case-report-brief.ts`, whose last changes were at approximately 09:08 UTC. Current input hashes/timestamps and the exact method are in [the input receipt](evidence/p1-route-bundle-receipt.json). Subsequent view-only keyboard/report-help corrections do not occur in this closure.

An initial byte comparison against `.artifacts/p1-route-tests/routes.mjs` was not usable: `c1-notes-route.test.ts` writes its different route bundle to the same artifact path, with the later file timestamp 11:35 local. It includes the Notes route absent from the P1 entry list. The differing bundle hashes therefore do not establish a P1 source drift or test failure. The receipt retains this diagnostic and does not misrepresent the later shared-path artifact as a captured P1 module. The input check is based on source history/timestamps and a current dependency closure, not an unavailable pre-run hash manifest.
