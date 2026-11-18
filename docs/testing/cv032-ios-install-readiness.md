# CV-032 — recurring iOS CI investigation

## Remaining timeout and discovery investigation

Follow-up base: `c412e87357a8db12a0b6a000337cf5d37ff57520`, the merge of #328 after all 18 checks passed. The task-owned checkout was clean at `d922efb` before fetching and branching from canonical main. No application release or production data change is involved.

Reinspection of 44387595209 attempt 1 confirms that launch exceeded 120 seconds and subsequent app-history, container and installed-application RPCs timed out. Other Simulator commands completed. This establishes partial service unresponsiveness, not a specific root cause or evidence that relaunch is safe. Reinspection of 44390945518 attempt 1 confirms three empty exact-PID/path queries despite the later compact VM announcement and owned socket. A sampled image path differs from the installed path, but compact log output lacks the event's process/sender paths; symbolication alone cannot prove a discovery-path mismatch. No speculative path relaxation, reinstall change or deadline increase is justified.

Confirmed diagnostic defect: the broad compact history discards OS metadata needed to distinguish missing persistence from path disagreement. The repair queries only Runner VM announcements in JSON, without filtering on the disputed path, ahead of broad history. Output remains bounded by the existing collector limits (20 seconds per command, 120 seconds total, 4 MiB per capture). These files are diagnostic-only and never consumed by acceptance. The workflow also captures the same baseline on successful runs for comparison; its three-minute diagnostic step and 75-minute job budgets remain unchanged. A failed application step still fails the workflow.

Local acceptance: 15 collector tests and 64 lifecycle tests pass. Coverage includes a synthetic differing-image-path announcement with an unavailable container, query timeout, continued collection within the shared deadline and no process sampling without verified identity. Existing discovery tests continue to reject foreign PID/path, stale records and malformed announcements. Hosted baseline capture and full workflow verification remain pending. The timeout and VM-discovery root causes remain open; this iteration repairs evidence collection, not a demonstrated application defect.

## 18 November 2026 — evidence and bounded repair

The isolated task starts at `4aeeb1a` (#326's v228 documentation candidate). #326 initially had 14 passing checks and four iOS checks running. Its editor-restart run subsequently repeated the 120-second launch timeout; failure artifacts were preserved before requesting the failed-job retry. Integration of #326 remains pending green checks at this checkpoint. Public CaseVant remains v228; this is CI tooling work, not an application release.

### Distinct observed failures

| Evidence | Observation | Conclusion |
| --- | --- | --- |
| [44323608030 attempt 2](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44323608030/attempts/2) | `incomplete-write-launch.stderr.log` says SpringBoard denied the app as Busy: it is installing or uninstalling and cannot launch. No PID was returned. | Confirmed install/launch race: successful `simctl install` does not establish that this launch request will be accepted immediately. Exact captured stderr is retained as a regression fixture. |
| [44323608030 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44323608030/attempts/1), [44387595209 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44387595209/attempts/1) | First launch exceeds 120 seconds; app-container/listapps probes also fail to establish identity. Install returned zero. | CoreSimulator/launch readiness remains uncertain. A timeout does not prove no process started; do not automatically retry it or accept partial PID text. |
| [44334435242 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44334435242/attempts/1) | Boot waits on migration/SystemApp until the ten-minute step limit. No attempt-1 artifact exists. | Separate boot failure. Evidence directory/output ID were established too late for useful retained diagnostics. Underlying boot-stall cause remains unconfirmed. |

### Fix and invariants

`launch_after_install` permits at most three launch attempts, only for the exact observed SpringBoard install-Busy rejection, with empty stdout and a nonzero exit. It checks that the isolated Runner is absent before each retry, pauses two seconds, and shares the original 120-second budget across launches and readiness queries. Each attempt retains bounded stdout/stderr. Unexpected/changed errors, any PID-looking stdout, timeout and a live Runner never authorize retry. Exhaustion still fails through the existing exact-PID guard.

The 300-second phase supervisor, installed-bundle hashes, source/nonce identity, authenticated Flutter log/VM PID checks, single actual drive and verified termination remain unchanged. The fix does not increase deadlines or bypass a required workflow. The smoke boot step now creates its evidence directory, records inventory and simulator identity before boot, and tees boot output into the already-retained artifact. This improves diagnosis; it is not a claimed cure for the separate boot stall.

### Validation checkpoint

Portable tests: 64 lifecycle tests pass, including replay of the captured Busy error through the full phase and a single verified drive; 13 diagnostic tests pass; deadline suite passes nine tests with two Windows-inapplicable skips. Type-specific transient rejection, ambiguous output, timeout, live-process presence, three-attempt exhaustion and shared-budget depletion are covered. Hosted macOS validation remains required; local mocks do not prove a Simulator run.

### Hosted verification follow-up

#326 merged as `51835ec7bc6b0bef0dcceef8e9235e6dee3c15da` after all 18 checks passed, including the editor-restart retry. The CV-032 candidate is [#327](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/327), head `482ad75940b7f095a8a7fdbeac71c078db2f535d`. The native lifecycle shell regressions also passed all 14 groups / 20 isolated cases, including preservation of the separate boot-evidence directory.

[44390945518 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44390945518/attempts/1) completed write, read and incomplete-write, then failed authenticated VM discovery in incomplete-read. Launch returned PID 27168 on its first attempt; no install-Busy retry occurred. The three exact PID/path history queries returned empty arrays, while later diagnostic logs contain a VM announcement and the owned process listener. This is a separate discovery/identity-evidence discrepancy, not evidence that the Busy retry failed. The acceptance guard correctly failed; the job artifact was retained and inspected before retry. The underlying discrepancy remains unconfirmed. On recurrence, preserve structured OS log path/sender metadata for that PID before proposing a repair; do not accept the diagnostic URI as an alternative authorization source or relax identity guards.

Final result: all 18 checks passed on `482ad75`; #327 merged as `587d870b5100e4c0c447985457ffdf1dc0bf55cd`. The push editor retry passed on attempt 2, and both native jobs passed on attempt 1. Public v228 is unchanged; this CI-only change needs no Sites publication. The separate discovery, boot-stall and ambiguous launch-timeout causes remain open monitoring items rather than being marked resolved by a passing retry.

The pull-request [editor run 44391011939](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44391011939) passed on attempt 1. Downloaded receipts bind all six completed phases to `482ad75`, with six distinct launch PIDs each matching the authenticated VM PID. Every launch used attempt 1, so live recovery from Busy is not claimed; captured-error regression tests cover that branch. The push [native run 44390945403](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44390945403) also passed. Its downloaded artifact contains boot inventory, simulator ID and completed boot log in the separate directory alongside the native lifecycle log, prepared identity and xcresult.
