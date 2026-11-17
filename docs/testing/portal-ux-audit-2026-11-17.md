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
