# CaseVant development backlog

**Bilingual quality audit:** [Baseline, candidate measurements and release gates](../testing/bilingual-release-2026-11-10.md).

**Reports shipped in v210.** All 18 non-accounting reports ran in both languages. Saved configuration reload, scoped CSV downloads, ledger totals, signed-out access and the mobile catalog passed. CV-014 remains open for Russian stage labels. The isolated database suite covered a second staff role. A second production identity is still needed for an independent live check of saved-report isolation. [Acceptance notes](../testing/practice-reports.md).

**Last reviewed on 10 November 2026. Public version v210.** CV-001 through CV-006, CV-011 and CV-013 retain their scoped production verification. [Current delivery](../../current_progress.md).

## Confirmed findings

All six original v203 findings have been verified on the published site. The open findings below came from the subsequent audit.

| ID / priority | Status | Area | What the user experiences | Acceptance for closure |
| --- | --- | --- | --- | --- |
| CV-018 · P2 | Open | Case → Billing navigation | Following Billing from an open case lands on “Choose a case”, without a return-to-case link. Calendar preserves that context. | Preselect the authorized originating case and offer a return to the exact case section. Direct firm-level Billing visits should still open the case picker. Verify EN/RU, case switching and denied access. |
| CV-016 · P1 native acceptance | Verified on corrected commit | Mobile tax editor / keyboard dismissal | The closing import dialog now retains its last valid keyboard position. | A focused regression failed before the change and passed afterward; both [push](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42832404408) and [PR](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42832418574) passed the complete restart workflow with assertions intact. |
| CV-017 · P2 | Open | Russian case workspace | The document inventory still renders English labels such as “Securely download current version” and the case checks include “Reviewer approval”. | Localize document version, review and download controls and case-check labels. Keep original filenames, authored text and exact record quotations intact. |
| CV-014 · P2 | Open | Reports / localization | The signed-in v210 Russian forecast displays the system stage as `consultation`. | Match directory labels in rows, grouping, filtering and CSV; preserve user-entered names and descriptions. |
| CV-015 · P3 | Open | Navigation / accessibility | In Russian, the logo link announces “CaseVant — Home”. | Verify a localized accessible name in English and Russian across workspace pages. |

## Verified

| ID / priority | Status | Outcome and evidence |
| --- | --- | --- |
| CV-013 · P2 | Verified · public v209 | Four explicit destinations in EN/RU, saved Studio draft reopened, case and firm files retained identical originals, UTF-8 bilingual template imported and saved as version 1. [Receipt](../testing/receipts/workspace-billing-v209.json). |
| CV-011 | Verified · public v209 | EUR 50 billed, EUR 20 recorded and reconciled; EUR 30 persisted after reload. Separate-role boundaries verified in isolated tests. [Audit](../testing/bilingual-release-2026-11-10.md). |
| CV-006 · P2 | Verified · public v209 | One creation entry in both languages; keyboard title focus, plain next actions, independent-review warning and record details passed, including at 390 px. |
| CV-005 · P2 | Verified · public v208 | Signed-in desktop and 390 px navigation passed all four bilingual round trips. [Release record](../testing/case-navigation-cv005.md). |
| CV-004 · P2 | Verified · public v207 | All three portal views measured 44 px in both languages on the same signed-in 390 px case. Keyboard activation, focus, compact desktop controls and page width passed. [PR #278](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/278) · [Production measurements](../testing/mobile-portal-controls-cv004.md). |
| CV-003 · P2 | Verified · public v206 | Mobile direct links show their selected case and section before the register. In the same signed-in case at 390 × 844 the portal heading moved from 1,751 to 639 px. Isolated short/235-character titles, keyboard, empty selection, resizing, desktop, and exact document targets passed. [Implementation](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/275) · [Small-phone refinement](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/276) · [Acceptance](../testing/mobile-case-entry-cv003-2026-11-09.md) · [Release receipt](../testing/receipts/mobile-case-entry-v206-2026-11-09.json). |
| CV-002 · P2 | Verified · public v205 | The warning identifies every unsent invitation, reply and selected file. Review reopened and focused the edited invitation name in the same live case; isolated staff and independent client sessions covered email, reply, file, multiple drafts, explicit discard, and a 390 px Russian dialog. Stay kept the case and recipient; no portal writes in the isolated check. [PR #273](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/273) · [Acceptance](../testing/portal-departure-cv002-2026-11-09.md) · [Release receipt](../testing/receipts/portal-departure-v205-2026-11-09.json). |
| CV-001 · P1 | Verified · public v204 | AI Studio shows the selected team case, personal draft and save destination. In production, Draft overview stayed in Studio and Case overview reopened the exact team case. Isolated EN/RU and 390 px checks covered no linked draft, an existing draft, the first save and a switch to another case. [PR #271](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/271) · [Acceptance](../testing/studio-team-case-cv001-2026-11-09.md) · [Release receipt](../testing/receipts/studio-case-context-v204-2026-11-09.json). |

## Verification gates

**Native import dialog:** Two Reports runs reproduced the cancellation assertion in the first and second synthetic probes. The candidate now keeps the dialog stationary while it closes and records platform metrics separately. Verify the exact candidate on iOS; a fixture pass alone does not close the native issue.

These are **not confirmed defects**. “Waiting for verification” means there is a specific check or dependency, not that deployed behavior failed.

| ID / priority | State · area | Evidence still needed |
| --- | --- | --- |
| CV-007 · P1 | Waiting for verification · client portal | Rehearse first-time hosted sign-in using an approved independent test recipient and synthetic material. Confirm the invitation resumes to the intended case; the client reads its exact share, uploads, exchanges one reply, and loses access after revocation. Record both sides without publishing private links or identity details. Isolated cross-client and live staff checks already passed. |
| CV-008 · P2 | Waiting for verification · calendar | Use controlled Outlook and Google accounts to subscribe to a read-only CaseVant feed; record initial import, time zone, update, retirement and observed refresh delay. Verify a recipient-specific reminder in a designated test mailbox, separately from provider acceptance. The existing scheduler check was no-send. CaseVant remains the source; inbound edits are out of scope. |
| CV-009 · P1 before broader use | Decision needed · document storage | The portal is a synthetic/de-identified pilot. Before admitting identifiable client files, define and verify scanning/quarantine, retention and recovery for failed or interrupted uploads. Confirm rejected bytes cannot be served; distinguish format/checksum validation from malware scanning. Keep the pilot restriction visible until that decision is accepted. |

## Planned product work

These carry forward the [competitive roadmap](MYCASE_COMPETITIVE_CYCLES.md#feature-coverage-and-implementation-requirements). They are **Planned** and have not shipped in v206. Sequence them after the relevant prerequisites and verified user journeys above.

| ID | Area | First reviewable outcome |
| --- | --- | --- |
| CV-010 | Document workflows | Prototype client-completed intake and a separately authorized signature step. Specify recipients, document versions and completion evidence before selecting a signing provider. |
| CV-011 | Practice finance · Core verified in v209 | EUR time, expenses, invoice lines, receipts, trust entries, payment plans and reconciliation passed isolated checks. Published migration 0036 and signed-in persistence verified. Independent production staff role not exercised. [Candidate and remaining scope](../testing/practice-billing-cv011.md). |
| CV-012 | AI and reporting | Review a case-scoped proposal against cited sources; require explicit human application. Define what an operational report counts and how incomplete data is shown. |

## Update this file every iteration

1. At the start of each CaseVant iteration, record or select the stable ID, intended user outcome, priority and acceptance check. Add a new ID only for a distinct issue; never recycle an old one.
2. Before handoff, update the affected rows and add a dated history entry **even if no status changed**. Use Open, In progress, Waiting for verification, Decision needed, Planned or Verified. P0 blocks release; P1 is next or blocks the named rollout; P2 is a scheduled usability or workflow improvement.
3. Link the dated review and the implementation PR or check when available. Distinguish observation on production, isolated verification, source inspection and checks not run. A merge alone does not close a runtime issue. Move verified items to a closed section with evidence; preserve their IDs and history.
4. Update [current_progress.md](../../current_progress.md) in the same iteration and link back here. Keep account names, private file URLs, share tokens and client content out of both documents.

## Iteration history

- 10 November 2026 · CV-013 was reproduced in Studio. The candidate connects all three document libraries and adds draft attachments, case tags, version descriptions and template import. Isolated checks passed. Signed-in release acceptance remains pending.

| Date / baseline | Change | Evidence / next step |
| --- | --- | --- |
| 2026-11-10 · public v209 | CV-006, CV-011 and CV-013 moved to Verified for the scoped workflows. Opened CV-014–018 for localization, navigation and native acceptance. | [Signed-in audit](../testing/bilingual-release-2026-11-10.md) · [Release receipt](../testing/receipts/workspace-billing-v209.json). Next: Reports production acceptance. |
| 2026-11-10 · v208 | Verified CV-005 on both layouts and implemented the CV-006 Overview candidate. | [CV-006 checks](../testing/case-overview-cv006.md). Signed-in acceptance follows publication. |
| 2026-11-10 · candidates | Studio document destinations, practice billing and non-accounting reports await integration. | [Documents #280](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/280) · [Billing #281](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/281) · [Reports #282](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/282). |
| 2026-11-09 · CV-005 | All eleven section names, the picker, breadcrumbs and disclosures follow the active locale. Both isolated desktop and mobile round trips retained the case title. | [Candidate acceptance](../testing/case-navigation-cv005.md). Verify after release. |
| 2026-11-09 · public v207 | CV-004 moved to Verified after the signed-in portal passed in both languages. | [Production measurements and exact-main release](../testing/mobile-portal-controls-cv004.md#published-verification). |
| 2026-11-09 · CV-004 | Mobile portal controls moved from Open to Waiting for verification. English and Russian labels fit whole words and the three buttons shared a height at every measured width. | [Isolated Chrome measurements and 27 regression tests](../testing/mobile-portal-controls-cv004.md). Recheck the signed-in case portal on release. |
| 2026-11-09 · public v206 | CV-003 moved from Waiting for verification to Verified after the same signed-in direct case link passed on mobile. | [Exact-main checks](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42632955256) · [Release receipt](../testing/receipts/mobile-case-entry-v206-2026-11-09.json). Next: CV-004 (portal control sizes and wrapping). |
| 2026-11-09 · CV-003 small-phone check | At 320 × 568, a 235-character title remained fully visible and the complete first portal command moved within one screen of scrolling. Exact document targets still receive focus. | [Measured mobile acceptance](../testing/mobile-case-entry-cv003-2026-11-09.md). Status remains Waiting for verification on production. |
| 2026-11-09 · CV-003 candidate | Direct mobile links now start with the selected case and section. Register visits still start with the picker and a deliberate open/close survives section changes. | [Mobile, desktop and keyboard checks](../testing/mobile-case-entry-cv003-2026-11-09.md). Repeat the same signed-in synthetic case on the published release. |
| 2026-11-09 · public v205 | CV-002 moved from Waiting for verification to Verified after a before-and-after check on the same signed-in synthetic case. | [Exact-main checks](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42623001696) · [Release receipt](../testing/receipts/portal-departure-v205-2026-11-09.json). Next: CV-003 (mobile case entry). |
| 2026-11-09 · CV-002 candidate | The warning lists unfinished portal forms and Review focuses the last field that still has changes. Stay preserves the case and recipient; clean forms navigate freely. | [Staff, client and narrow Russian acceptance](../testing/portal-departure-cv002-2026-11-09.md); zero portal writes. Verify the signed-in invitation journey after release. |
| 2026-11-09 · public v204 | CV-001 moved from Waiting for verification to Verified after the live case → Studio → case round trip. | [Exact-main checks](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42614569437) · [Public release receipt](../testing/receipts/studio-case-context-v204-2026-11-09.json). Next: CV-002. |
| 2026-11-09 · CV-001 candidate | Team case, personal draft title and save destination are distinct. Case overview returns to the selected team case; an actual first save and reopen passed. | [Acceptance notes](../testing/studio-team-case-cv001-2026-11-09.md). Isolated English/Russian and 390 px checks passed. Verify the published version before closure; next open defect: CV-002. |
| 2026-11-09 · public v203 | Opened CV-001–006, recorded three verification/rollout gates and carried forward three roadmap items. No production change in this audit. | [Audit](../testing/ui-ux-functionality-2026-11-09.md) · [v203 release record](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/269). Next: CV-001, then the portal departure review and mobile case handoff. |
