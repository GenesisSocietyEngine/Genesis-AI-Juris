# CV-032 — recurring iOS CI investigation

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
