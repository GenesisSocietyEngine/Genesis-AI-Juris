# CaseVant development backlog

**Last reviewed: 9 November 2026 · live version: v203.** This is the working queue for the web product. [Current delivery](../../current_progress.md) records what shipped; this file records what should change or still needs proof. Start with **CV-001**. [Iteration audit and reproduction steps](../testing/ui-ux-functionality-2026-11-09.md) · [Product roadmap](MYCASE_COMPETITIVE_CYCLES.md)

## Confirmed findings

The six items below were reproduced against public v203 or its isolated 390 px fixture. The **area** identifies the team or part of the product that should take the item. All six are **Open**; no runtime fix is claimed in this documentation iteration.

| ID / priority | Status | Area | What the user experiences | Acceptance for closure |
| --- | --- | --- | --- | --- |
| CV-001 · P1 | Open | AI Studio / case navigation | A named team case opens a workbench headed “Describe your case” with “Case not saved yet.” Its name disappears. The adjacent “Case overview” opens a blank analysis, although the original case is still reachable. | From a named team case, show which case is active, distinguish its optional Studio draft and where a save goes, and provide an unambiguous return to that case’s overview. Verify in English and Russian with no linked draft, an existing saved draft, and a case switch. Preserve unadded input; never turn a team case ID into a Studio draft ID or copy case material implicitly. |
| CV-002 · P2 | Open | Saving / keyboard navigation | An unsent portal invitation is protected, but the warning calls it generic workspace changes. “Review unsaved work” returns focus to Calendar instead of the edited field. | Name the unsent invitation, reply or selected upload as applicable. Review reveals and focuses the relevant field; Stay retains the original value and recipient. Clean navigation raises no warning. Reviewing or leaving must never create an invitation, send a reply or upload a file. |
| CV-003 · P2 | Open | Mobile case workspace | On a direct case-to-portal link at 390 × 844, the open case register precedes the selected case. In the fixture the portal begins at 1,421 px and its first command at 1,682 px. | A direct link to a selected case puts the case identity and current section within the first screen, with its first action reachable within one viewport of scrolling. Keep the picker keyboard-accessible, respect an explicit open/close choice, and keep it available on an unselected visit. Retest short and long names. |
| CV-004 · P2 | Open | Portal / responsive controls | At 390 px the English portal view buttons measure 61/61/40 px high; Russian measures 82/61/61 px and splits words mid-word. Common actions are 40 px. | Use equal-height buttons within this group, readable whole-word labels and a 44 px minimum touch target on narrow screens. Keep normal desktop controls compact, selected and focus states distinct, and no horizontal page scrolling. Verify both languages. |
| CV-005 · P2 | Open | Localization / case sections | Russian portal content sits inside an English case picker, technical disclosure and section selector. Ten of eleven section options are still English. | Translate the surrounding case navigation, section names, accessible names and disclosure labels. Test a full round trip through the case, calendar and portal in both locales; leave user-entered titles unchanged. |
| CV-006 · P2 | Open | Case overview / plain language | With Technical details closed, Overview still shows “current dossier snapshot,” “attributable reviewer approval” and “org owner.” The case picker also exposes two controls for the same creation form. | Give the next action in ordinary language, e.g. “Generate the report” or “Ask a reviewer to approve it.” Put record-level explanations in details, keep the permissions and approval warnings visible, and give case creation one clearly named entry per layout. Check visible text and accessible names. |

## Verification gates

These are **not confirmed defects**. “Waiting for verification” means there is a specific check or dependency, not that deployed behavior failed.

| ID / priority | State · area | Evidence still needed |
| --- | --- | --- |
| CV-007 · P1 | Waiting for verification · client portal | Rehearse first-time hosted sign-in using an approved independent test recipient and synthetic material. Confirm the invitation resumes to the intended case; the client reads its exact share, uploads, exchanges one reply, and loses access after revocation. Record both sides without publishing private links or identity details. Isolated cross-client and live staff checks already passed. |
| CV-008 · P2 | Waiting for verification · calendar | Use controlled Outlook and Google accounts to subscribe to a read-only CaseVant feed; record initial import, time zone, update, retirement and observed refresh delay. Verify a recipient-specific reminder in a designated test mailbox, separately from provider acceptance. The existing scheduler check was no-send. CaseVant remains the source; inbound edits are out of scope. |
| CV-009 · P1 before broader use | Decision needed · document storage | The portal is a synthetic/de-identified pilot. Before admitting identifiable client files, define and verify scanning/quarantine, retention and recovery for failed or interrupted uploads. Confirm rejected bytes cannot be served; distinguish format/checksum validation from malware scanning. Keep the pilot restriction visible until that decision is accepted. |

## Planned product work

These carry forward the [competitive roadmap](MYCASE_COMPETITIVE_CYCLES.md#feature-coverage-and-implementation-requirements). They are **Planned**, not features of v203. Sequence them after the relevant prerequisites and verified user journeys above.

| ID | Area | First reviewable outcome |
| --- | --- | --- |
| CV-010 | Document workflows | Prototype client-completed intake and a separately authorized signature step. Specify recipients, document versions and completion evidence before selecting a signing provider. |
| CV-011 | Practice finance | Define roles, currency/rounding, corrections and audit history for time and expense capture before invoice or payment writes. Case estimates are not financial records. |
| CV-012 | AI and reporting | Review a case-scoped proposal against cited sources; require explicit human application. Define what an operational report counts and how incomplete data is shown. |

## Update this file every iteration

1. At the start of each CaseVant iteration, record or select the stable ID, intended user outcome, priority and acceptance check. Add a new ID only for a distinct issue; never recycle an old one.
2. Before handoff, update the affected rows and add a dated history entry **even if no status changed**. Use Open, In progress, Waiting for verification, Decision needed, Planned or Verified. P0 blocks release; P1 is next or blocks the named rollout; P2 is a scheduled usability or workflow improvement.
3. Link the dated review and the implementation PR or check when available. Distinguish observation on production, isolated verification, source inspection and checks not run. A merge alone does not close a runtime issue. Move verified items to a closed section with evidence; preserve their IDs and history.
4. Update [current_progress.md](../../current_progress.md) in the same iteration and link back here. Keep account names, private file URLs, share tokens and client content out of both documents.

## Iteration history

| Date / baseline | Change | Evidence / next step |
| --- | --- | --- |
| 2026-11-09 · public v203 | Opened CV-001–006, recorded three verification/rollout gates and carried forward three roadmap items. No production change in this audit. | [Audit](../testing/ui-ux-functionality-2026-11-09.md) · [v203 release record](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/269). Next: CV-001, then the portal departure review and mobile case handoff. |
