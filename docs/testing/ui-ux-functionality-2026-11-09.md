# CaseVant v203: UI, UX and functionality audit

**9 November 2026.** The selected team case survived the tested navigation. The largest usability problem was **recognizing that same case inside AI Studio**: the workbench looked like a new unnamed case even though the route back was intact. The other reproduced findings concern unsaved-work review, mobile layout, localization and technical wording. All six have owners by area and closure checks in the [development backlog](../development/development_backlog.md).

## Scope and evidence

- **Live:** [CaseVant](https://casevant.pro) v203, [runtime d06d2b6e](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/commit/d06d2b6e4ea8ec6ef263c4777ea13cbd97d29fc6). Used a separate authenticated staff tab and the designated synthetic case. Measured the actual browser at 1280 × 720. Edited only unsent form values, restored their originals, and made no production writes during this audit. The preceding [release audit](client-portal-2026-11-09.md) separately records its synthetic share and revocation.
- **Reference:** inspected the signed-in [MyCase dashboard](https://maxima-consult.mycase.com/dashboard) without changing it. Quick actions, My tasks, Today’s events and Recent activities offered direct destinations. This was a comparison of visible behavior, not a test of MyCase’s backend or a claim about feature parity.
- **Narrow layout and client actions:** used the v203 components and real request handlers with an isolated local database and file bucket. Tested English and Russian in a measured 390 × 844 CSS-pixel frame. The hosted browser continued reporting its desktop size after a viewport override, so **the narrow measurements below are fixture results**, not a claim about a live mobile device. No private tokens, real records or account identifiers are included.
- **Functional regression:** 106 tests passed, zero failed, zero skipped across eight existing suites (command below). The live release also has a separate [exact-source CI result](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42600498511) and [deployment receipt](receipts/client-portal-v203-2026-11-09.json).

## What worked

| Journey | Observed result |
| --- | --- |
| Home → Contacts → Library → selected case | Home presented Today’s work, Upcoming events, Needs attention, quick actions and a case overview. Contacts and Library named the same case and showed Return to case overview. A deliberately unmatched contact search gave a clear empty state. Returning from Library reopened the exact original team case and its Overview. |
| Overview → Tasks → Calendar → Workflows → Documents & evidence → Client portal | The tested sections retained the same case identifier. ArrowRight on Overview selected and focused Tasks; the active section was the only tab stop in that tablist. The portal explicitly displayed Access revoked and Withdrawn; historical uploads/messages were readable to staff, with clear empty states and no composer for the revoked recipient. |
| Case editor | Save & close started disabled. Editing the case name enabled it; Cancel warned before discarding, initially focused Keep editing and preserved the draft. Restoring the original value and canceling closed the editor without a save or a navigation warning. |
| Studio | The workbench contained the Case prompt, KPI controls and Document-flow canvas. Its validated return path still carried the case. The defect below concerns the visible identity and the competing meanings of “Case overview.” No AI provider call was made. |
| Unsaved invitation | Changing only the client-facing label, then selecting Calendar, opened a centered dialog with focus on Stay here. Both Stay and Review retained the field. Restoring the original label allowed a clean departure. The review-focus and wording defect is recorded below. No invitation was created. |
| Two-sided portal, isolated | The synthetic client saw a shared meeting and version 1 of a brief. Its posted reply appeared exactly once on both sides. A synthetic text upload returned Received, appeared for staff, and the staff download matched the original bytes. No external client or mailbox was contacted. |

## Reproduction notes

| ID | How to reproduce | Actual result |
| --- | --- | --- |
| CV-001 | In a team case without a linked Studio draft, select the AI Studio tab next to Case overview. Then select Case overview inside Studio. | The named case is absent from visible text. The page says “Describe your case” and “Case not saved yet”; Case overview opens an empty analysis (“What needs to be decided”). The original case is still reachable through suite navigation. No saved content loss was observed. |
| CV-002 | In Client portal → Invite a client, edit the client-facing case label without submitting. Select Calendar, then Review unsaved work. | The dialog says “Changes in this workspace have not been saved.” The draft remains intact, but after the dialog closes the focused element is the Calendar tab, not the form or its field. This differs from the editor’s working Keep editing recovery. |
| CV-003 | Open a direct case portal link in the narrow synthetic fixture with the default case picker open; measure from the document top. Then close the picker. | In both locales the portal starts at 1,421 px and the first action at 1,682 px. Closing the picker in Russian moves them to 873 px and 1,133 px. The section is reachable, but the register consumes much of the initial visit. |
| CV-004 | At 390 px, view the three portal commands in English and Russian. Inspect label wrapping, touch size and focus. | Buttons measured 61/61/40 px (EN) and 82/61/61 px (RU), in Shared items / Client uploads / Messages order. Several ordinary actions were 40 px. Russian words broke inside a label. The control group did fit without horizontal scrolling (375 px content and scroll width); the focus outline and selected accent were visible. [Synthetic screenshot](ui-ux-v203-2026-11-09/mobile-portal-ru.png). |
| CV-005 | In the Russian fixture, open the case section picker above the translated portal. | “Workspace section,” “Cases / Choose or create a case,” “Technical details,” and ten of the eleven destination labels remained English; only the portal destination was translated. The bilingual switch does not translate user-authored case names, as intended. |
| CV-006 | In live Overview with Technical details closed, read the next-action and readiness text. Inspect the case picker’s new-case controls. | Users still see “current dossier snapshot,” “attributable reviewer approval” and “org owner.” The icon named “Create a matter” and “New case” operate the same form. Keep the need for approval visible while simplifying its wording. |

## Verification boundaries and repeatability

The independent, first-time external portal sign-in and a client-originated production exchange were not rehearsed. Calendar subscriptions were not opened in Outlook or Google and no live reminder was sent. Those checks are tracked in CV-007/008; the existing [calendar delivery evidence](calendar-delivery-2026-11-09.md) distinguishes scheduler verification from provider delivery. Malware scanning is outside current file validation (CV-009). No financial, signature, native mobile, AI-provider quality or general accessibility certification is implied by this audit.

To repeat the functional checks from the repository root with installed dependencies and loopback available:

```sh
node --experimental-sqlite --import tsx --test --test-reporter=spec tests/practice-route.test.ts tests/case-editor.test.ts tests/save-clarity-context.test.ts tests/saved-case-navigation-restore.test.ts tests/studio-departure.test.ts tests/navigation-shell.test.ts tests/operations-navigation.test.ts tests/sidebar-navigation.test.ts
```

The first sandboxed attempt could not connect to the local worker. Rerunning with loopback access passed all 106. These checks cover case/recipient isolation, exact document versions, upload and message retries, calendar authorization, contact and storage operations, save recovery and navigation; they do not substitute for inspection of labels, focus or layout.

Relevant source: [case workspace](../../app/matters/MattersClient.tsx), [suite destinations](../../app/workspace-navigation.ts), [case identity used by Contacts and Library](../../app/WorkspaceCaseContext.tsx), [portal forms](../../app/portal/Portal.tsx), [departure feedback](../../app/departure-presentation.ts) and [portal styles](../../app/portal/portal.module.css). Use the [living backlog](../development/development_backlog.md) for subsequent iterations; keep this dated report as the v203 observation.
