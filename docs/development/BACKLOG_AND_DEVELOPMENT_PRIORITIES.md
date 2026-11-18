# CaseVant backlog and development priorities · 18 November 2026

Public baseline: v225. The delivery ledger is [development_backlog.md](development_backlog.md). This file sets the order for the next implementation and acceptance work.

**Latest order:** release CV-039 generated-value acceptance, finish the existing synthetic proposal review and EN/RU reload checks, then address CV-035 localization. CV-037/038 are public in v225. Do not regenerate or edit away the schema envelope to bypass the defect. [Evidence](../testing/cv039-generated-proposal-review.md).

**Current order:** ship CV-036's tested, documented model-alias handling; retry the authorized CV-012 version-2 job; address CV-035's Evidence review localization. CV-034 is production-verified at the authentication boundary, but live proposal/review acceptance remains blocked by CV-036. CV-010/028/029 still need an active client. [Release and follow-up](../testing/cv034-ai-auth-identifier.md#public-v223-and-cv-036-follow-up).

## What the check audit found

- **Release engineering:** Three recent PRs hit the same 30-second timeout in the iOS editor-restart test while launching the Simulator app. The runner used its general-purpose query timeout for launch. A timeout also discarded partial launch output. Full reruns subsequently passed. A separate artifact-service timeout on #311 occurred after testing and has a different cause. [#308 launch](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44049624670/job/133924125630) · [#310 launch](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44060271349/job/133960037397) · [#311 launch](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44097489219/job/134088370457)
- **Product baseline:** Sites reported v220. CV-030 download labels and CV-031 Reports return already have signed-in EN/RU evidence. The current audit reran local regressions and checked the release record. [Production walkthrough](../testing/portal-ux-audit-2026-11-17.md#public-v220--17-november-2026)
- **Next product feature:** The two CV-010 workflow tests passed again against the exact #312 source. Its role picker, client clock and in-memory receipts are prototype fixtures. [Prototype and review instructions](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/312)

## Implementation order

| Order | Item and state | Next deliverable | Acceptance |
| --- | --- | --- | --- |
| 1 | CV-032 · P2 · iOS CI reliability · merged in #313 | Monitor subsequent simulator launches. The bounded wait and retained timeout diagnostics are on main. | A timed-out launch fails before Flutter drive, with no accepted PID. The real macOS restart workflow completes on the candidate. Track recurrence across subsequent PRs. |
| 2 | CV-010 · Client intake and signatures · server receipts released in v221 | Exercise receipt submission, exact-version retries and reload in both languages with an active synthetic client. Provider signing follows separately. [Receipt evidence](../testing/cv010-server-intake-receipts.md) | Authorized retry yields one receipt; a changed version, revoked grant or second recipient cannot complete the request. Review EN/RU staff and client journeys with synthetic records. |
| 3 | CV-012 · Case-scoped AI review and reporting · reporting verified on v222 | Next unblocked work: verify the signed-in source-to-proposal, attributed human-review and apply journey. Report populations and missing-versus-zero handling are now production-verified. | An unauthorized or stale source cannot be applied; report fixtures distinguish missing data from a measured zero. |

CV-033 is resolved by maintained forks with passing audits and exact-head CI; replace them after a reviewed upstream fix becomes available. #315 then #316 merged green and shipped in v222. CV-010 live acceptance still awaits an active test client. The next unblocked CV-012 work is the signed-in AI review journey; the reporting slice passed EN/RU live counts, filters and four downloaded CSV checks. [Evidence](../testing/cv012-report-completeness.md#public-v222--18-november-2026).

## Work that can resume when its dependency is available

| Priority | Item | Dependency and next check |
| --- | --- | --- |
| P1 before broader upload use | CV-009 · EU upload rollout | A provisioned EU scanner, runtime/storage placement evidence, and an EU restore environment. Verify clean, blocked and unavailable paths and hold-aware recovery before enabling identifiable files. |
| P2 | CV-029 · Client upload recovery | An existing active synthetic client. Verify definitive rejection clears selection and consent, and an interrupted receipt retains same-action retry in EN/RU. |
| P3 | CV-028 · Portal notices | Use the same active client to verify that a translated confirmation stays within its originating panel. |
| P2 | CV-008 · Calendar providers | Controlled Outlook and Google accounts plus a designated test mailbox. Check import, time zone, update, retirement and actual reminder delivery. |
| Follow-up | CV-011 · Billing acceptance | A second authorized test staff identity. Verify production role boundaries for the already-shipped EUR register. |

CV-028 and CV-029 remain pending. The November 17 release walkthrough found three invited grants and two revoked grants across the two synthetic cases.

## 18 November 2026 - CV-033 security repair

Local maintenance patches for both Picomatch major lines reject ambiguous
single-branch repeated extglobs using the existing literal fallback. Five focused
security/compatibility tests pass. Pinned npm resolves the isolated lock with zero
audit vulnerabilities. Exact-head full CI remains pending. Merge #315 before
#316; CV-012 release and EN/RU report/CSV live acceptance remain pending.
CV-010 live receipt checks remain pending an active test client.
Evidence: docs/testing/cv033-picomatch-security.md.

## 18 November 2026 - release acceptance

CV-033 is resolved. CV-012 reporting is verified on public v222; broader AI journey acceptance remains open. CV-010, CV-028 and CV-029 remain pending an active test client. No new client grants were created. Two synthetic prospects were explicitly authorized and created for the missing/zero/positive estimate checks.
# 18 November 2026 — priority update after signed-in AI audit

1. **CV-034 (P1):** ship the tested authentication-pseudonym repair, then retry the authorized synthetic CV-012 source job and verify exact-source human review.
2. **CV-035 (P2):** localize the Evidence review controls, disclosures and live notices; preserve selections, drafts and attribution across EN/RU switching.
3. **CV-012:** complete remaining source-to-review/apply acceptance; reporting remains verified on v222.

CV-032 simulator timeout recurred on #317; monitor the failed-job rerun. CV-010, CV-028 and CV-029 remain blocked on an active client. [Current audit](../testing/cv034-ai-auth-identifier.md).

