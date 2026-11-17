# Case portal and Reports navigation audit · 17 November 2026

## Signed-in production walkthrough

In the synthetic case on v219, Messages showed an existing post confirmation and a disabled empty reply button. Opening Client uploads showed the correct empty list, but the message confirmation stayed above it. Shared items showed its own heading and the same unrelated confirmation. Returning to Messages restored the thread. This walkthrough used the existing receipt and made no production submission.

Following the workspace Reports link from the same case opened the signed-in report catalog. Its route carried the organization and language. The originating case, portal section and recipient were absent, and the page offered no return-to-case control. Billing's link from the same starting point included the case and return path. CV-031 tracks this separate navigation issue.

## Candidate and isolated acceptance

| Finding | Change and evidence |
| --- | --- |
| CV-028 · Portal feedback | Message, upload and sharing confirmations appear in their originating view. The isolated component posted one synthetic message. Its notice translated in place, then disappeared when navigating to uploads or shared items. Invitation confirmations remain at portal level. |
| CV-029 · Rejected upload | A definitive size, format or scanner rejection clears the selection and consent. For a synthetic scanner rejection the upload button became disabled and Russian guidance requested a replacement. A simulated service interruption offered retry. Its successful receipt translated into English and stayed within Client uploads. |
| CV-030 · Document retrieval | Accessible download names identify the file. Shared document names include the version. The browser exposed the Russian name for version 2 and the original upload filename. Russian upload size uses КБ. Existing download targets are preserved. |

The candidate browser used the real component with simulated responses. Production acceptance of CV-028–030 remains pending. CV-009 still requires EU infrastructure evidence and CV-008 still requires external calendar acceptance.

## CV-031 · Reports return to the originating case

Reports now carries the exact originating team case URL when opened from a case. The catalog and individual report screens show a return link after the existing case identity endpoint confirms access in the selected organization. The link uses the current interface language and preserves the section, recipient or document target, and anchor. Direct firm-level entry and personal drafts have no team case return.

In the isolated browser, the catalog and Case list report both linked to the original portal section and conversation. Switching to Russian translated the link and preserved the target. A simulated 403 hid the link while the catalog stayed available. Navigation tests cover direct entry, personal drafts, missing authorization, and case or organization mismatch. Signed-in verification on a published build is pending.

## Public v220 · 17 November 2026

Sites published [#309](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/309) and [#310](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/310) from main commit `f66a9c023fb66c54e06ff8a32cf3638a3fad6e4d`. The [exact-main web build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44088610374) passed. The release used its verified artifact with migration 0038 and retained v219 client assets. Sites reported successful publication with environment revision 42. Both the custom and platform origins served all 253 expected browser assets (165 current, 88 retained).

| Item | Signed-in production result |
| --- | --- |
| CV-028 | Released. A new client or staff message confirmation was not generated on an active test thread. Bilingual confirmation and panel scoping remain verified in the isolated acceptance above. |
| CV-029 | Released. No active synthetic client was available to select a file, submit consent, exercise rejection or retry an interrupted receipt. Those flows passed in the isolated fixture only. |
| CV-030 | Verified in the populated staff portal. The English and Russian accessible download names identified the original synthetic filename and the shared document title with version 2. Sizes rendered as 1 KB and 1 КБ respectively. |
| CV-031 | Verified in both languages. From the synthetic case conversation, the owner opened workspace Reports and the Case list report, then clicked the report's return link. The case, organization, portal section and recipient matched the origin and message history opened in the current language. Direct signed-in firm Reports showed zero case-return links in both languages. |

The two synthetic cases visible to the owner contained three invited and two revoked grants. The owner confirmed no other active test client. Existing staff-visible records supplied the download-label check. No invitations, permissions, messages or files were created or changed during these production checks. The next client check requires an active signed-in synthetic recipient.
