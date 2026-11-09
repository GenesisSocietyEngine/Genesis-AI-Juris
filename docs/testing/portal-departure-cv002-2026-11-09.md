# CV-002 · Review unsent portal work · 9 November 2026

The [v203 audit](ui-ux-functionality-2026-11-09.md) reproduced this on a case’s Client portal: editing the invitation and opening Calendar showed generic workspace copy; Review returned the keyboard to Calendar. The acceptance condition is to identify all unfinished portal items, focus the most recently edited field that still has work, and keep the original case and recipient until the user explicitly leaves.

| Journey | Observed in the isolated browser |
| --- | --- |
| Staff invitation → Calendar | With only the client-facing case name changed and the invitation collapsed, the warning named the invitation. Stay kept the original recipient. Review reopened the form and focused the changed name with its text intact. Editing the email last and attempting a recipient switch returned focus to that email and kept the old recipient. Restoring both inputs allowed Calendar to open without a warning. |
| Staff reply → Calendar | After typing a reply and hiding Messages, the warning identified the unsent reply. Review reopened Messages and focused the textarea with its text intact for the original recipient. |
| Client with a file and a reply → another case | The warning listed both items, most recently edited first. Stay kept the original case. Review focused the reply. After editing the upload acknowledgement and using Sign out, Review focused the actual file input; the selected filename and acknowledgement remained. Explicit Discard and switch opened the chosen second case with an empty reply. |
| Russian client at 390 × 844 | Sign out from a hidden reply opened a Russian dialog fully within the viewport. All three buttons were 44 px high, Stay received initial focus, and Review reopened the message with its text and keyboard focus. The English desktop dialog also had three 44 px actions. |

The independent client and staff sessions used synthetic cases, recipients, messages and a local text file. The fixture counted **zero portal write requests** across departure, Review, Stay and Discard. The warning lists categories only; it never copies addresses, filenames or message text into application navigation. There is no save-and-send action. Previously submitted requests with an unknown result retain their existing receipt/retry flow. Closing or reloading the browser tab still uses the browser’s own warning.

The focused navigation and save regression suite passed all 47 checks. The separate database/storage integration test passed invitation isolation, reply history, version and event sharing, upload access, and revocation during storage. No change to server permissions, storage, invitation delivery or the database schema.

**Release status:** Candidate verified in isolation; the signed-in production reproduction and release checks are recorded separately after publication.
