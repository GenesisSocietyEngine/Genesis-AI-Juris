# CaseVant backlog and development priorities · 23 November 2026

**23 November 2026 delivery checkpoint:** PR #352 merged as `dcc98b2b` after all 18 checks passed and was released as **v230**. All 256 current/retained assets verify. Real EN/RU sign-in preserves the exact Evidence fragment; Home counts, contextual actions and 390px readability pass. Deeper inspection found **CV-047**: asynchronous Evidence loading leaves the restored source below the viewport. [PR #353](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/353) fixes this through authorized exact-record resolution and implements **CV-045** compact case headers, selected-tab visibility and a collapsible Home section menu. 71 focused tests, typecheck and production build pass; candidate CI, release and live acceptance remain pending. CV-046 follows; CV-032 and existing provider/client gates remain open.

## Current implementation

Public version **v230** is sourced from canonical `dcc98b2bc4c34823d3dcc8047ffcbe181cfdd154` and Sites mirror `7707b2550031958b4fcf262af55df205004c0123`. CV-042 URL retention and CV-043/044 Home acceptance pass. CV-047 tracks the separate late-rendered source visibility gap. [Audit and acceptance](../testing/cv045-navigation-and-v230-acceptance.md).

## Next unblocked work

| Order | Item | Deliverable and acceptance |
| --- | --- | --- |
| 1 | CV-045 · P2; CV-047 · P2 · Candidate | Integrate after green CI and release. Verify compact case identity, selected section visibility, every Home destination, exact-source focus after asynchronous sign-in return/reload, and EN/RU narrow/desktop layouts. Denied or missing sources must not select another record. |
| 2 | CV-046 · P3 · Remaining count/title localization | Correct task result counts (observed `1 matching items`) and localized browser titles. Verify zero/one/few/many and language switching; preserve user-authored names. |
| Separate CI track | CV-032 · P2 · iOS startup investigation | Keep independent #351 diagnostics separate. Passing retries do not establish or close the Runner/System App root cause. |

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
