# CaseVant backlog and development priorities · 17 November 2026

Public baseline: v220. The delivery ledger is [development_backlog.md](development_backlog.md). This file sets the order for the next implementation and acceptance work.

## What the check audit found

- **Release engineering:** Three recent PRs hit the same 30-second timeout in the iOS editor-restart test while launching the Simulator app. The runner used its general-purpose query timeout for launch. A timeout also discarded partial launch output. Full reruns subsequently passed. A separate artifact-service timeout on #311 occurred after testing and has a different cause. [#308 launch](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44049624670/job/133924125630) · [#310 launch](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44060271349/job/133960037397) · [#311 launch](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44097489219/job/134088370457)
- **Product baseline:** Sites reported v220. CV-030 download labels and CV-031 Reports return already have signed-in EN/RU evidence. The current audit reran local regressions and checked the release record. [Production walkthrough](../testing/portal-ux-audit-2026-11-17.md#public-v220--17-november-2026)
- **Next product feature:** The two CV-010 workflow tests passed again against the exact #312 source. Its role picker, client clock and in-memory receipts are prototype fixtures. [Prototype and review instructions](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/312)

## Implementation order

| Order | Item and state | Next deliverable | Acceptance |
| --- | --- | --- | --- |
| 1 | CV-032 · P2 · iOS CI reliability · hosted restart check passed on candidate | Give the simulator launch its own bounded wait and retain partial stdout/stderr if it times out. | A timed-out launch fails before Flutter drive, with no accepted PID. The real macOS restart workflow completes on the candidate. Track recurrence across subsequent PRs. |
| 2 | CV-010 · Client intake and signatures · server receipts implemented and verified locally | Release the version-bound intake requests and receipts, then exercise both languages with an active synthetic client. Provider signing follows separately. [Receipt evidence](../testing/cv010-server-intake-receipts.md) | Authorized retry yields one receipt; a changed version, revoked grant or second recipient cannot complete the request. Review EN/RU staff and client journeys with synthetic records. |
| 3 | CV-012 · Case-scoped AI review and reporting · planned | Trace a proposal to accessible case sources and require a human decision to apply it. Specify the affected report's population and treatment of missing data. | An unauthorized or stale source cannot be applied; report fixtures distinguish missing data from a measured zero. |

CV-032 comes first because the same failure delayed three merges, including a documentation-only change. CV-010 remains the first product implementation.

## Work that can resume when its dependency is available

| Priority | Item | Dependency and next check |
| --- | --- | --- |
| P1 before broader upload use | CV-009 · EU upload rollout | A provisioned EU scanner, runtime/storage placement evidence, and an EU restore environment. Verify clean, blocked and unavailable paths and hold-aware recovery before enabling identifiable files. |
| P2 | CV-029 · Client upload recovery | An existing active synthetic client. Verify definitive rejection clears selection and consent, and an interrupted receipt retains same-action retry in EN/RU. |
| P3 | CV-028 · Portal notices | Use the same active client to verify that a translated confirmation stays within its originating panel. |
| P2 | CV-008 · Calendar providers | Controlled Outlook and Google accounts plus a designated test mailbox. Check import, time zone, update, retirement and actual reminder delivery. |
| Follow-up | CV-011 · Billing acceptance | A second authorized test staff identity. Verify production role boundaries for the already-shipped EUR register. |

CV-028 and CV-029 remain pending. The November 17 release walkthrough found three invited grants and two revoked grants across the two synthetic cases.
