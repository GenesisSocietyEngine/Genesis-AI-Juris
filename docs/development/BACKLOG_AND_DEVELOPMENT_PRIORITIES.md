# CaseVant backlog and development priorities · 23 November 2026

**23 November 2026 latest checkpoint:** PR #353 merged as `099144c2` after all 18 checks passed and released as **v231**. All 224 current/retained assets verify. **CV-045/CV-047 production acceptance passes** for signed-in EN/RU navigation, exact Evidence landing, reload and 390px layouts. **[CV-046 / PR #354](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/354) is implemented and locally verified**: count-aware work summaries and localized route/view browser titles, with filters and authored names preserved. 35 focused tests, typecheck and production build pass; CV-046 CI/integration/release remain pending. CV-032 and existing provider/client gates stay open. [Evidence](../testing/cv046-localization-and-v231-acceptance.md).

**23 November 2026 delivery checkpoint:** PR #352 merged as `dcc98b2b` after all 18 checks passed and was released as **v230**. All 256 current/retained assets verify. Real EN/RU sign-in preserves the exact Evidence fragment; Home counts, contextual actions and 390px readability pass. Deeper inspection found **CV-047**: asynchronous Evidence loading leaves the restored source below the viewport. [PR #353](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/353) fixes this through authorized exact-record resolution and implements **CV-045** compact case headers, selected-tab visibility and a collapsible Home section menu. 71 focused tests, typecheck and production build pass; candidate CI, release and live acceptance remain pending. CV-046 follows; CV-032 and existing provider/client gates remain open.

## Current implementation

Public version **v231** is sourced from canonical `099144c24853eedecc19e7e4396febbd50fb8bd1` and Sites mirror `af1d5e89f90cbd614b1923e9b63cbeefb92b0d75`. CV-045/CV-047 requested live acceptance passes. CV-046 remains a local candidate. [Audit and acceptance](../testing/cv046-localization-and-v231-acceptance.md).

## Next unblocked work

| Order | Item | Deliverable and acceptance |
| --- | --- | --- |
| 1 | CV-046 · P3 · Tested candidate | Integrate after green CI, then release and verify localized counts/browser titles in EN/RU. Preserve task filters across reload, language and view changes. |
| Completed | CV-045 · P2; CV-047 · P2 · Production verified | v231 navigation, exact Evidence landing, EN/RU reload and mobile acceptance pass. |
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
