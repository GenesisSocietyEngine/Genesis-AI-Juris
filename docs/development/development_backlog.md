# CaseVant development backlog

**18 November 2026 · Public v228 · CV-041 production-verified.** #324 and #325 merged in order after all 18 checks passed on each. Exact-main `795ddf3` passed 2,110 tests (zero failures, three inherited skips), both audits and PDF gates. Both origins serve the matching runtime and all 221 verified assets. Signed-in EN/RU checks passed for zero, one and three assertions/citations, language switching and reload. Two explicitly authorized synthetic anchors and assertions remain pending review as QA history; original accepted evidence is preserved. Local tests also cover zero/one/multiple pending proposals. CV-010/028/029 remain pending an active client. [Release evidence](../testing/cv041-evidence-counts.md#public-v228--release-and-signed-in-acceptance).

**18 November 2026 · Public v227 · CV-035 / CV-040 production-verified.** #322 and #323 merged after all 18 checks passed. Exact-main `4c626ed7` passed 2,108 tests (zero failures, three inherited skips), both dependency audits and PDF checks. Sites published `def9484f` with environment revision 42. Both origins verified the runtime and all 222 assets (166 current, 56 retained). Signed-in EN/RU Evidence/audit, original-content preservation, exact citation focus, reload and 390 px layouts passed without production mutations. Progress, backlog and priorities now reflect the release. CV-041 tracks minor English singular-count wording; CV-032 remains a CI reliability follow-up. CV-010/028/029 remain pending an active client. [Release evidence](../testing/cv035-russian-review-layout.md#public-v227--production-acceptance).

- **CV-041 · P3 · English Evidence singular counts — resolved on v228.** Original finding: Existing English summaries can show “1 records” and “1 exact citations”. Add singular/plural formatting with 0/1/multiple-count coverage; preserve computed values, exact citations and Russian plural forms.

**Earlier implementation checkpoint · superseded by v227 acceptance above.** Reran the signed-in v226 Evidence/audit review. Russian forms, source/review controls, notices and known audit labels now have localized presentation. Proposal statements lead the card, original JSON stays inspectable, notes use full width and review panels stack to available workspace width. Local EN/RU draft/notice switching and desktop/phone layout checks passed without writes. Production acceptance awaits green integration and release. CV-010/028/029 remain pending an active client. [Evidence](../testing/cv035-russian-review-layout.md).

CI review: the first full web run found a legacy source-shape assertion for the citation accessible name. The assertion now follows the localized call, and rendered EN/RU accessible names are explicitly checked. The focused 39-test suite passes. Production acceptance remains pending.


**18 November 2026 · Public v226 · CV-012 scoped acceptance complete.** The authorized source→AI proposal→human review→professional assertion journey passed on the existing synthetic version-2 fixture. The original proposal, exact citation, QA note and stored reviewer/timestamp survive EN/RU switching and reload in both locales. CV-034/036/038/039 are resolved and production-verified. CV-037 is released: local pending/rejected/missing/retired-source tests pass; accepted-source enablement is verified live. #321 merged after all 18 checks passed, including the Android retry after Maven 429s. Exact-main passed 2,104 tests and both clean audits; both origins verify 221 assets. [Evidence](../testing/cv039-generated-proposal-review.md#public-v226--live-acceptance).

- **CV-040 · P2 · Evidence review readability — resolved on v227.** Original finding: With the case picker expanded, side-by-side assertion/proposal cards become narrow; the review note uses only one metadata column and wraps heavily. The ordinary proposal card also leads with raw JSON. Give reviewed text and notes usable width, retain exact JSON/provenance in inspectable details, and verify expanded/collapsed case picker plus narrow EN/RU layouts without changing records or source links.
- **CV-035 resolved on v227.** Original finding: Evidence controls, notices and audit event labels still use English in RU. Language-state persistence passed; full Russian localization did not.

Previous v226 next steps, now completed on v227: CV-035 localization and CV-040 readability/narrow-layout acceptance. CV-010/028/029 remain pending an active test client. This scoped owner-fixture check does not replace live denied-access or stale-source scenarios; existing automated guards remain active.

**18 November 2026 · Public v225.** CV-037/038 are released through green #320. The ordinary-review payload error is cleared in the fresh signed-in client. Exact-main CI passed on retry; both origins verify all 221 assets. Proposal acceptance now reaches a distinct generated-value mismatch; no assertion or proposal decision has been saved.

- **CV-039 · P1 · Generated assertion envelope rejected by acceptance — implemented, not released.** Accept the exact `{schema_version:1, statement}` shape generated by CaseVant, preserving legacy manual statements and rejecting extra fields, unsupported versions and malformed text. Test actual D1-generated values through the shared acceptance parser. Next: green CI, release, then approve the existing source-reviewed synthetic proposal and verify EN/RU/reload attribution. Do not regenerate or edit away the envelope to bypass this defect.

CV-012 live review remains pending CV-039. CV-035 localization, mobile layout acceptance and CV-010/028/029 active-client checks remain open. [Evidence](../testing/cv039-generated-proposal-review.md).

**18 November 2026 · v224 live.** CV-034 and CV-036 are production-verified: the authorized exact-version job completed on attempt 3 and produced one grounded synthetic proposal. Both origins verify 221 assets; #319 merged with 18 checks passing. The source anchor is accepted, but proposal acceptance remains blocked by CV-038. [Audit](../testing/cv038-proposal-review.md).

- **CV-037 · P2 · Proposal acceptance prerequisites — implemented, not released.** Disable acceptance/edit-and-accept until every cited anchor is loaded, accepted and not retired; explain the prerequisite in EN/RU and retain source links. Integrated pending/rejected/missing/retired/accepted state checks pass. Server guards and rejection policy stay unchanged.
- **CV-038 · P1 · Ordinary proposal review payload — implemented, not released.** Omit the edit field for accept/reject rather than sending null. Preserve explicit edit-and-accept, exact proposal/revision and QA note. Actual parent-callback regressions pass; 36 scoped tests and typecheck pass. Next: green CI, release, successful live QA acceptance/reload in EN/RU.

CV-012 has live generation/source-review evidence but not completed proposal-review acceptance. CV-035 localization and CV-010/028/029 active-client gates remain open.

**18 November 2026 · v223 live.** CV-034 is released and its authentication boundary is production-verified: the same synthetic job reached the provider on attempt 2. #318 merged after 18 passing checks; exact-main web/PDF passed and both origins verified 221 assets. **CV-036 · P1 · Model-alias response guard — implemented, not released:** the next guard rejects the documented `gpt-5.6` → `gpt-5.6-sol` resolution. The narrow fix keeps strict model checks and receipt attribution; 21 focused tests pass. Next: green CI, publication and exact-job retry, then suitable QA review/reload checks. CV-035 remains open and CV-012 is not fully accepted. CV-010/028/029 still need an active client. [Audit](../testing/cv034-ai-auth-identifier.md#public-v223-and-cv-036-follow-up).

**18 November 2026 · Public v222 · CV-033 resolved; CV-012 reporting verified.** PR #315 merged first with 18 passing checks, followed by #316 with 18 passing checks. Exact-main web/PDF CI passed; Sites published source `a724003199daab5795d11ce03f3ab3254a0e9c6c`. Both live origins returned that runtime and verified all 222 assets (166 current, 56 retained). Signed-in EN/RU checks confirmed three matching records, two recorded estimates including zero, one missing estimate and EUR 125; filtered 2/3 and all-missing 1/3 populations behaved correctly. Four downloaded CSVs passed content assertions. CV-010 live receipt checks remain pending an active test client. The broader CV-012 signed-in AI review journey remains open. [Report evidence](../testing/cv012-report-completeness.md#public-v222--18-november-2026).

**17 November 2026 · CV-012 report completeness.** The next unblocked product slice makes the matching population and missing numeric values visible in Reports. Grouped CSV exports include contributing and missing record counts. EN/RU browser and regression checks passed. Existing AI proposal tests confirm explicit attributed review, exact-source binding, stale-source handling and denial. CV-010 live receipt checks remain pending an active test client. PR #315 remains unmerged because both full dependency audits report GHSA-fc5q-39xc-vjpf. CV-033 tracks that merge blocker.

**17 November 2026 · Public v221 · CV-010 receipts.** PR #314 merged after all 18 checks passed, including the successful rerun of a Chrome startup failure. Sites published merged source `02550a471fe23348c9bb46d6c95164e2a5c82137` with migration 0039. Both origins returned the exact runtime and verified all 229 assets. Signed-in staff portal rendering passed in EN/RU. Three invited grants and two revoked grants were found across the two synthetic cases. The signed-in independent client had no available cases. Live receipt submission, exact-version retry and reload remain pending an active test client. The isolated bilingual browser and D1 retry checks passed again.

**17 November 2026 · CV-010 server receipts.** PRs [#312](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/312) and [#313](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/313) each merged after 18 successful checks. Staff can issue an exact case intake revision to one active recipient. The client can correct and submit answers once and recover the same receipt on retry. Local EN/RU and D1 checks passed. Release and signed-in production acceptance remain open. [Verification](../testing/cv010-server-intake-receipts.md).

**17 November 2026 · CV-010 prototype.** [PR #311](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/311) merged after all 18 checks passed. Client intake and a separately authorized, version-specific test signature passed a bilingual browser walkthrough and workflow tests. The reviewable prototype uses synthetic in-memory records. CV-028 and CV-029 await an active test client. [Review and evidence](../testing/cv010-client-intake-prototype.md).

**Public v220 · 17 November 2026.** PRs #309 and #310 are live. CV-030 download labels and CV-031 Reports return passed signed-in EN/RU checks. CV-028 notices and CV-029 upload recovery await an active test client. Both origins verified 253/253 assets. [Release evidence](../testing/portal-ux-audit-2026-11-17.md#public-v220--17-november-2026).

**17 November 2026 · CV-031 implemented.** The Reports catalog and report detail now offer a verified return to the originating team case section and conversation in the current language. The isolated EN/RU browser check passed. Signed-in production acceptance is pending. [Verification](../testing/portal-ux-audit-2026-11-17.md#cv-031--reports-return-to-the-originating-case).

**17 November 2026 · Functional and UX audit.** On v219, the signed-in case portal showed a message receipt under unrelated views, and Reports lost the return path to the case. CV-028–030 implement scoped feedback, upload rejection recovery and named download links with isolated EN/RU verification. CV-031 tracks the Reports return path. PR #308 merged with 18 passing checks. [Audit evidence](../testing/portal-ux-audit-2026-11-17.md).

**17 November 2026 · CV-009 retention and legal holds.** PR #307 merged after 18 green checks. [PR #308](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/308) corrects migration 0038 for the Sites SQL splitter and implements a private scanner connection, hold-aware intake cleanup and verified transfer. Isolated EN/RU upload and D1/R2 checks passed. EU hosting, deployed scanner and backup/restore verification remain open. [Acceptance and deployment details](../testing/cv009-portal-upload-rollout.md#retention-implementation-and-eu-connection--17-november-2026).

**17 November 2026 · CV-009 in progress.** PR #306 merged after all 18 checks passed. The EU rollout candidate adds a private ClamAV integration. Isolated recovery and bilingual Chrome checks passed. Live EU scanner verification, residency evidence and hold-aware expiry remain open. [Retention proposal and verification](../testing/cv009-portal-upload-rollout.md).

**Public v219 · 16 November 2026.** CV-027 passed signed-in production verification. One synthetic message produced a confirmation that switched English → Russian → English. One link copy produced a confirmation that switched Russian → English → Russian. Both checks retained the same case and recipient. [Release evidence](../testing/client-portal-2026-11-09.md#cv-027-on-public-v219).

**15 November · CV-007 verified on public v218.** PR #303 merged after all 18 checks passed. Verified the hosted portal entry and empty-case guidance in EN/RU. Staff shared one synthetic document version and sent the approved independent recipient a private invitation. The independent recipient accepted, downloaded the exact share, uploaded a synthetic text file in Russian and posted a message visible in both languages. The isolated portal exchange and revocation regression passed. Chrome displayed the staff reply in both languages. After revocation, the independent recipient saw denial in Russian and English. The owner retained the conversation. [Evidence](../testing/client-portal-2026-11-09.md#cv-007--hosted-onboarding-rehearsal-15-november-2026).

**Public v218 · 15 November 2026.** CV-026 passed signed-in production acceptance. One denied invitation switched English → Russian → English using only the language button. The thread stayed hidden. The workspace switch displayed its destination in both languages. PRs #301 and #302 each merged after 18 checks passed. [Release evidence](../testing/cv024-conversation-retrieval.md#cv-026-on-public-v218).

**Public v217 · 15 November 2026.** PR #300 merged after all 18 checks passed. On the signed-in site, three synthetic conversations across two cases passed the English and Russian filter, exact-recipient and language-switch checks. The wrong recipient was denied in both languages. CI verified restricted staff access. CV-026 tracks a stale translated denial notice. [Production evidence](../testing/cv024-conversation-retrieval.md#public-v217).

**Public v216 · 15 November 2026.** PR #299 merged after 18/18 checks. The signed-in case and lead task filters passed in English and Russian, including reload, language switching and reset. Each origin verified 221/221 assets. [CV-023 release evidence](../testing/cv023-task-filters.md#public-v216--15-november-2026).

**Public v215 · 14 November 2026.** CV-025 verified. PRs #296 and #297 merged green. All 11 case section labels, both document mode controls and the accessible group name passed signed-in EN/RU checks. Switching EN → RU → EN preserved the selected case section, document and exact version. [Production evidence](../testing/case-documents-billing-context.md#cv-025-verified-on-public-v215).

**Public v214 · 14 November 2026.** CV-014, CV-015, CV-017 and CV-018 passed the signed-in bilingual acceptance below. CV-025 records a remaining section selector label. [Release evidence](../testing/case-documents-billing-context.md#public-v214).

**Earlier 14 November release gate (superseded by v214).** PR #294 remains open at 17/18 after three failures in one native simulator job. Public v213 still displays the raw forecast stage. The new Reports/CSV and home-link production checks await release. CV-017 and CV-018 are implemented in PR #295, with scoped tests passed and production verification pending.

## CV-019 · Recent activities

Published in v211 on 11 November 2026 after PR #286 passed all 18 checks. Both origins verified 250 assets from the exact-main build. Signed-in EN/RU filters, selected-category history, 30-to-33 pagination, mobile layout, invoice case context, organization isolation and signed-out guards passed. [Release receipt](../testing/receipts/recent-activities-v211.json).

Core verified on production; remaining verification stays open for a second production identity, populated Deleted history and large-organization latency. The SQLite suite covers removed work, restricted billing and revoked participants. CV-020 corrected the document-target prefix and false warning in v212, with live EN/RU acceptance. [Acceptance notes](../testing/recent-activities-cv019.md).

**Bilingual quality audit:** [Baseline, candidate measurements and release gates](../testing/bilingual-release-2026-11-10.md).

**Reports shipped in v210.** All 18 non-accounting reports ran in both languages. Saved configuration reload, scoped CSV downloads, ledger totals, signed-out access and the mobile catalog passed. CV-014 remains open for Russian stage labels. The isolated database suite covered a second staff role. A second production identity is still needed for an independent live check of saved-report isolation. [Acceptance notes](../testing/practice-reports.md).

**Last reviewed on 11 November 2026. Public version v212.** CV-020 and CV-021 are verified; CV-001 through CV-006, CV-011 and CV-013 retain their scoped production verification. [Current delivery](../../current_progress.md).

[Current implementation order and dependencies](BACKLOG_AND_DEVELOPMENT_PRIORITIES.md)

## Confirmed findings

All six original v203 findings have been verified on the published site. The open findings below came from the subsequent audit.

| ID / priority | Status | Area | What the user experiences | Acceptance for closure |
| --- | --- | --- | --- | --- |
| CV-033 · P1 | Resolved · merged #315; public v222 | Dependency audit | Maintained Picomatch 2/4 forks bound single-branch repeated extglobs while preserving ordinary build globs. | Five focused tests, clean install and both audits passed; all 18 checks passed before merge. Review upstream replacement when a fixed release is available. [Evidence](../testing/cv033-picomatch-security.md). |
| CV-032 · P2 | Merged · monitor recurrence | iOS CI | Three PRs encountered a 30-second timeout starting the simulator app. | Both macOS restart jobs passed on the merged candidate. Monitor subsequent launches for recurrence. [Audit](../testing/cv032-check-audit.md). |
| CV-028 · P3 | Released v220 · waiting for active test client | Portal feedback | A message confirmation persisted in Client uploads and Shared items on v219. | Verify one EN/RU post and its confirmation only in Messages. |
| CV-029 · P2 | Released v220 · waiting for active test client | Upload recovery | A definitive rejection left the rejected file selected and submission enabled. | Confirm rejected selection and consent clear, while an uncertain result retains the same-action retry. |
| CV-030 · P3 | Verified · public v220 | Download accessibility | Portal download controls shared a generic accessible name and Russian upload sizes used KB. | Verify filenames, shared versions and Russian units in a populated portal. |
| CV-031 · P2 | Verified · public v220 | Reports navigation | Opening workspace Reports from a case drops the originating section and conversation. | Offer a validated return to the exact authorized case context in EN/RU and preserve direct firm-level entry. |
| CV-025 · P3 | Verified · public v215 | Russian case navigation | The selected case-section button reads “Documents & evidence” while the panel heading and controls are Russian. | Localize section selector labels and verify pressed state and target identity across EN/RU switches. |
| CV-023 · P3 | Verified · public v216 | Daily task retrieval | Staff can combine case, lead, assignee, completion and lifecycle. | The [signed-in EN/RU checks](../testing/cv023-task-filters.md#public-v216--15-november-2026) passed for case and lead tasks, reload, both language switches and reset. |
| CV-024 · P3 | Verified · public v217 | Communications | Staff can filter conversations by case and open the exact recipient’s message history. | [Signed-in EN/RU acceptance](../testing/cv024-conversation-retrieval.md#public-v217) covered two populated cases, three recipients, language switching and wrong-recipient denial. CI covered restricted staff and subsequent loss of access. |
| CV-026 · P3 | Verified · public v218 | Client portal localization | An existing denial updates immediately when the interface language changes. | [Signed-in verification](../testing/cv024-conversation-retrieval.md#cv-026-on-public-v218) passed English → Russian → English after one acceptance attempt. The recipient, thread and reply controls stayed hidden. Both workspace switch labels identified the destination language. |
| CV-018 · P2 | Verified on v214 for the scoped bilingual journey | Case → Billing navigation | Following Billing from an open case lands on “Choose a case”, without a return-to-case link. Calendar preserves that context. | Preselect the authorized originating case and offer a return to the exact case section. Direct firm-level Billing visits should still open the case picker. Verify EN/RU, case switching and denied access. |
| CV-016 · P1 native acceptance | Verified on corrected commit | Mobile tax editor / keyboard dismissal | The closing import dialog now retains its last valid keyboard position. | A focused regression failed before the change and passed afterward; both [push](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42832404408) and [PR](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42832418574) passed the complete restart workflow with assertions intact. |
| CV-017 · P2 | Verified on v214 for the scoped bilingual journey | Russian case workspace | The document inventory still renders English labels such as “Securely download current version” and the case checks include “Reviewer approval”. | Localize document version, review and download controls and case-check labels. Keep original filenames, authored text and exact record quotations intact. |
| CV-014 · P2 | Verified on v214 for the scoped bilingual journey | Reports / localization | The signed-in v210 Russian forecast displays the system stage as `consultation`. | Match directory labels in rows, grouping, filtering and CSV; preserve user-entered names and descriptions. |
| CV-015 · P3 | Verified on v214 for the scoped bilingual journey | Navigation / accessibility | In Russian, the logo link announces “CaseVant — Home”. | Verify a localized accessible name in English and Russian across workspace pages. |

## Verified

| ID / priority | Status | Outcome and evidence |
| --- | --- | --- |
| CV-027 · P3 | Verified · public v219 | Signed-in message and clipboard confirmations translated on each language switch. One synthetic message remained in the selected thread. The counted client fixture covered invitation acceptance and posting. [Release evidence](../testing/client-portal-2026-11-09.md#cv-027-on-public-v219). |
| CV-007 · P1 | Verified · public v218 | Independent recipient accepted the invitation, downloaded version 2, uploaded the synthetic fixture and exchanged messages with the case owner. After revocation, the recipient saw denial in EN/RU and the owner retained both messages. [Hosted acceptance](../testing/client-portal-2026-11-09.md#cv-007--hosted-onboarding-rehearsal-15-november-2026). |
| CV-021 · P0 | Verified · public v212 | Matching React 19.2.9 patches passed PR #290's 18 checks and exact-main dependency audits. Published source and all 274 assets verified; signed-in document workflows passed. [Review](../testing/react-security-cv021.md). |
| CV-020 · P2 | Verified · public v212 | EN/RU Home/history links select and focus the exact file without a false notice. Reload, version history, localized missing targets with no fallback, denied organization and authorized return passed. [Receipt](../testing/receipts/document-links-v212.json). |
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
| CV-022 · P2 | Verified in scoped signed-in checks | Bilingual production activity/history/document links and mobile layout passed. Russian case-list run and return verified 14 November. [Walkthrough](../testing/workspace-benchmark-2026-11-14.md). |
| CV-008 · P2 | Waiting for verification · calendar | Use controlled Outlook and Google accounts to subscribe to a read-only CaseVant feed; record initial import, time zone, update, retirement and observed refresh delay. Verify a recipient-specific reminder in a designated test mailbox, separately from provider acceptance. The existing scheduler check was no-send. CaseVant remains the source; inbound edits are out of scope. |
| CV-009 · P1 before broader use | In progress · awaiting EU infrastructure | Primary retention and legal holds passed isolated tests. Connect the real EU scanner, verify runtime, D1, R2, logs and backup placement, exercise restore and verify deployed EN/RU uploads. [Evidence](../testing/cv009-portal-upload-rollout.md#retention-implementation-and-eu-connection--17-november-2026). |

## Planned product work

These carry forward the [competitive roadmap](MYCASE_COMPETITIVE_CYCLES.md#feature-coverage-and-implementation-requirements). They are **Planned** and have not shipped in v206. Sequence them after the relevant prerequisites and verified user journeys above.

| ID | Area | First reviewable outcome |
| --- | --- | --- |
| CV-010 | In progress · document workflows | [Version-bound requests and durable client receipts](../testing/cv010-server-intake-receipts.md) released in v221 with migration 0039. Signed-in staff rendering passed in EN/RU. Verify live receipt submission, exact-version retry and reload when an active client is available. Provider selection and independently verified signing evidence remain open. |
| CV-011 | Practice finance · Core verified in v209 | EUR time, expenses, invoice lines, receipts, trust entries, payment plans and reconciliation passed isolated checks. Published migration 0036 and signed-in persistence verified. Independent production staff role not exercised. [Candidate and remaining scope](../testing/practice-billing-cv011.md). |
| CV-012 | Scoped production verification complete · v226 | [Reports and CSV](../testing/cv012-report-completeness.md#public-v222--18-november-2026) passed on v222. [Authorized synthetic source-to-proposal/review/apply](../testing/cv039-generated-proposal-review.md#public-v226--live-acceptance) passed on v226, including exact version, attribution, EN/RU continuity and reload. Localization/readability remain CV-035/040; active-client and broader live negative scenarios remain separate. |

## Update this file every iteration

1. At the start of each CaseVant iteration, record or select the stable ID, intended user outcome, priority and acceptance check. Add a new ID only for a distinct issue; never recycle an old one.
2. Before handoff, update the affected rows and add a dated history entry **even if no status changed**. Use Open, In progress, Waiting for verification, Decision needed, Planned or Verified. P0 blocks release; P1 is next or blocks the named rollout; P2 is a scheduled usability or workflow improvement.
3. Link the dated review and the implementation PR or check when available. Distinguish observation on production, isolated verification, source inspection and checks not run. A merge alone does not close a runtime issue. Move verified items to a closed section with evidence; preserve their IDs and history.
4. Update [current_progress.md](../../current_progress.md) in the same iteration and link back here. Keep account names, private file URLs, share tokens and client content out of both documents.

## Iteration history

- 17 November 2026 · CV-010 progressed from the merged #312 prototype to durable intake receipts with independent staff and client authorization. Production acceptance awaits release and an active client.

- 17 November 2026 · Rechecked the release and prototype regressions, opened CV-032 and published the updated implementation order. CV-028 and CV-029 await an active client.
- 17 November 2026 · CV-010 prototype passed its local EN/RU walkthrough. CV-028 and CV-029 remain pending. CV-009 awaits EU infrastructure and CV-008 awaits external calendar and mailbox verification.

- 17 November 2026 · Published v220. Signed-in EN/RU verification closed CV-030 and CV-031. CV-028 and CV-029 await an active test client.

- 17 November 2026 · CV-031 implemented and verified in an isolated bilingual Reports session, including denied origin access. Recheck the signed-in return after publication.

- 17 November 2026 · Recorded CV-028–031. Implemented and locally exercised CV-028–030. CV-031 is the next navigation implementation.

- 17 November 2026 · #307 merged. CV-009 primary expiry and overlapping holds passed isolated D1/R2 checks. EU provisioning and restore remain outstanding.

- 17 November 2026 · CV-009 moved to In progress. The owner selected EU-hosted ClamAV. The pilot restriction continues while EU operations and retention enforcement are outstanding.

- 16 November 2026 · CV-027 closed after the v219 bilingual success-notice checks. PR #305 merged with all 18 checks green.

- 15 November 2026 · CV-007 closed on public v218. Bilingual portal entry and synthetic document sharing verified. The independent recipient accepted, downloaded version 2, uploaded a file and posted a message. Chrome showed the owner’s reply in both languages. Revocation removed the client’s case content and preserved the staff history.

- 11 November 2026 · CV-022 published v213 after 18/18 PR checks and successful exact-main build; both origins verified 224 assets. EN/RU local desktop/mobile audit passed; live bilingual Billing and English Reports passed. Browser control became unavailable, so remaining live checks are explicitly Waiting for verification. Progress and receipt updated together; next action is the bounded production check, not another implementation or release.

- 11 November 2026 · CV-022 moved Planned → Candidate following the requested post-release design audit. Restrained accents and visual hierarchy implemented; local EN/RU preview, filtering, keyboard and responsive checks passed. Live application is still v212. Next: green CI, ordinary merge and release acceptance.

- 11 November 2026 · Public v212: CV-020 and CV-021 moved to Verified after both PRs passed 18/18 checks, exact-main build/audits succeeded, 274 assets matched on both origins and signed-in EN/RU document acceptance passed. Missing and denied targets remained guarded. Next: CV-022 UI/UX/design audit and color accents. [Receipt](../testing/receipts/document-links-v212.json).

- 11 November 2026 · CV-020 merged as PR #289 with 18/18 green. Its exact-main tests passed but the dependency audit raised a newly published critical RSC advisory. Opened CV-021, stopped publication and prepared the matching 19.2.9 patches; lockfile audit reports zero vulnerabilities. The user-requested UI/UX audit and color accents remain next after release verification.

- 11 November 2026 · CV-020 candidate corrects a raw-document-ID link where the workspace requires `document-<id>`. Added bilingual Home/history link checks and missing-target selection coverage. Existing workspace and authorization regressions passed. Status: Waiting for verification; production v211 unchanged until release. [Review](../testing/activity-document-links-cv020.md).

- 11 November 2026 · CV-019 published in v211 after PR #286's 18 green checks and exact-main CI. Scoped bilingual production acceptance completed; CV-020 opened for the false document target notice. Second-identity and populated deletion live checks remain pending. [Audit](../testing/recent-activities-cv019.md) · [Receipt](../testing/receipts/recent-activities-v211.json). Next: address CV-020 and retain the existing prioritized rollout gates.

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

14 November 2026 · CV-014/CV-015 implemented. CV-023/CV-024 added for discovery. CV-017/CV-018 remain open. [Audit](../testing/workspace-benchmark-2026-11-14.md).

14 November 2026 · CV-017 and CV-018 implemented in a separate follow-up to PR #294. [Scope and acceptance evidence](../testing/case-documents-billing-context.md).
14 November 2026 · CV-014/CV-015 release gate. Intel simulator attempts timed out during preparation, driver attachment and editor interaction. The restart workflow now runs on an Apple Silicon macOS 15 host. The independent native smoke workflow continues on Intel. All six restart phases and their deadlines remain in force. CI acceptance pending.

## 18 November 2026 - CV-033 security repair

Local maintenance patches for both Picomatch major lines reject ambiguous
single-branch repeated extglobs using the existing literal fallback. Five focused
security/compatibility tests pass. Pinned npm resolves the isolated lock with zero
audit vulnerabilities. Exact-head full CI remains pending. Merge #315 before
#316; CV-012 release and EN/RU report/CSV live acceptance remain pending.
CV-010 live receipt checks remain pending an active test client.
Evidence: docs/testing/cv033-picomatch-security.md.
# 18 November 2026 — CV-034 / CV-035 audit additions

- **CV-034 · P1 · AI generation rejects authentication pseudonyms — implemented, not released.** The live CV-012 synthetic job failed locally with provider_configuration_unavailable. Accept the canonical Base64URL HMAC identifier while preserving attribution and rejecting malformed inputs. Twenty focused tests pass. Next: green CI, merge/release, explicit bounded retry and live EN/RU review checks.
- **CV-035 · P2 · Evidence review localization — open.** Russian navigation and heading surround English generation/disclosure, manual evidence, proposal queue and failure messages. Translate interface copy and live notices while preserving exact source text, selected versions, drafts, review attribution and language-switch state. Verify EN→RU→EN without repeating mutations, plus narrow layout.

CV-012 remains open beyond its production-verified reporting slice. CV-010, CV-028 and CV-029 still await an active test client. #317 is merged; CV-032's 120-second simulator timeout recurred and its rerun was still running when inspected. [Audit, evidence and limitations](../testing/cv034-ai-auth-identifier.md).

