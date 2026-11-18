# CaseVant backlog and development priorities · 18 November 2026

**CV-032 current follow-up:** #328 merged green. Remaining timeout/discovery causes are unconfirmed. Repair the confirmed loss of OS metadata in compact diagnostics, retain structured VM announcements and compare successful hosted baselines before changing launch or identity behavior. Local 15 diagnostic / 64 lifecycle tests pass; hosted validation pending. [Investigation](../testing/cv032-ios-install-readiness.md#remaining-timeout-and-discovery-investigation).

**CV-032 bounded repair merged and hosted-verified:** #326 and #327 merged in order after 18 passing checks each. Both native and editor workflows passed; exact-source editor receipts and retained boot evidence were inspected. Separate boot-stall, launch-timeout and VM-log discovery causes remain open monitoring items. No deadlines or identity checks were weakened. Public remains v228. [Investigation](../testing/cv032-ios-install-readiness.md).

**CV-041 complete on public v228.** #324 and #325 merged green. Signed-in EN/RU counts passed at zero, one and three records/citations, with reload and language switching. The authorized synthetic additions remain pending review; pending-proposal 0/1/multiple coverage is local. [Release evidence](../testing/cv041-evidence-counts.md#public-v228--release-and-signed-in-acceptance).

The delivery ledger is [development_backlog.md](development_backlog.md). This file gives the current order; historical release details remain in that ledger and the linked acceptance records.

## Current delivery

CV-035 Russian Evidence/audit localization and CV-040 review readability are merged through #323 (`4c626ed7`) after all 18 checks passed. #322's v226 verification record merged first. The v227 acceptance remains the localization/layout baseline; current public v228 adds CV-041. Signed-in EN/RU Evidence/audit, original-content preservation, citation focus, reload and narrow-layout checks passed without production mutations. [Implementation and audit](../testing/cv035-russian-review-layout.md).

CV-012's authorized synthetic source-to-proposal, human review and apply journey passed on v226. CV-034/036/038/039 are resolved; CV-037's accepted-source enablement passed live and its negative paths passed local tests. [v226 evidence](../testing/cv039-generated-proposal-review.md#public-v226--live-acceptance). Reports and CSV counts passed on v222; CV-033's maintained dependency patches passed both audits. [Reporting evidence](../testing/cv012-report-completeness.md#public-v222--18-november-2026).

## Next unblocked work

| Order | Item | Deliverable and acceptance |
| --- | --- | --- |
| 1 | CV-032 · P2 · Monitor remaining CI failures | The install-Busy race repair is merged. On recurrence, distinguish boot stalls, ambiguous launch timeouts and VM-log discovery discrepancies; preserve structured OS PID/path/sender evidence before changing guards. A passing retry does not establish the underlying cause. [Latest evidence](../testing/cv032-ios-install-readiness.md#hosted-verification-follow-up). |

## Work awaiting a dependency

| Priority | Item | Dependency and acceptance |
| --- | --- | --- |
| P1 before broader upload use | CV-009 · EU upload rollout | Provisioned EU scanner, runtime/storage/backup residency evidence and restore environment. Verify clean, blocked and unavailable paths plus legal-hold-aware recovery before enabling identifiable files. [Evidence](../testing/cv009-portal-upload-rollout.md). |
| P1 | CV-010 · Server-authorized intake receipts | An active synthetic client. Verify exact-version submission, idempotent retries and reload in EN/RU, including changed-version, revoked and foreign-recipient denial. [Evidence](../testing/cv010-server-intake-receipts.md). |
| P2 | CV-029 · Client upload recovery | An active synthetic client. Verify definitive rejection clears selection and consent; interrupted receipts retain same-action retry in EN/RU. |
| P3 | CV-028 · Portal notices | The same active client. Verify translated confirmation stays within its originating panel. |
| P2 | CV-008 · Calendar providers | Controlled Outlook/Google accounts and designated test mailbox; verify import, time zones, updates, retirement and actual reminder delivery. |
| Follow-up | CV-011 · Billing role acceptance | A second authorized test staff identity; verify role boundaries for the shipped EUR register. |

No active test client is available. CV-010/028/029 stay pending; this iteration creates no invitation or client grant. Local synthetic notice/draft tests are separate from live recipient acceptance.
