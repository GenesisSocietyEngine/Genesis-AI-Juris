# CV-024 · Finding client conversations across cases

On 15 November 2026, an operator compared the signed-in MyCase Messages screen with two synthetic production cases in CaseVant. The measurement counts navigation and selection actions. Neither live workspace contained a populated message thread in the cases inspected, so these observations establish the navigation cost and empty states only.

| Starting point | Action | Result |
| --- | --- | --- |
| MyCase Tasks, sidebar collapsed | Open sidebar, expand Communications, open Messages | One inbox with a case filter. My Inbox, Sent, Draft, Archived and Firm Inbox are available. |
| MyCase Messages | Open the case picker and select the sample matter | Two selections narrowed the existing inbox. The selected case remained visible with an empty-folder result. |
| CaseVant Tasks | Open Cases, then Client portal on the selected synthetic audit case | The case had no invited clients. |
| That case's portal | Select the other synthetic case, open Client portal, select Messages | Three actions reached the other recipient's history. Changing case returned staff to Overview. The conversation showed its recipient boundary and an empty state. |

The existing populated portal regression passed on the candidate source. A client message and team reply appeared under the first invitation. A second client's conversation stayed empty, and an attempt to post against the first client's invitation returned 404. The suite also covers foreign-organization access, revocation, historical staff access and pagination. The production walkthrough sent no messages or invitations.

A staff conversation list would remove the need to inspect cases individually. Scope the first delivery to a read-only list of conversations with messages, ordered by last activity, filterable by case, and labeled with both case and recipient. Opening a row should restore that exact case, invitation and Messages tab. Resolve the organization, active staff membership and owner/contributor case grant before returning any labels or counts. Keep the existing portal as the reply destination. Archived or revoked recipient access and staff access to history follow the existing portal rules.

Release acceptance requires two populated cases, two recipients on one case, and a staff member who lacks access to one case. Confirm EN/RU navigation, an empty filtered case, revocation between list and open, and absence of inaccessible labels and counts. Per-user folders, read receipts and forwarded email were visible in MyCase but were outside the observed CaseVant retrieval gap.

## Implemented candidate

Staff can open Messages from the workspace views, filter all accessible threads by case, and follow a row into the existing portal. Each row contains the case, recipient and last message time. Only the portal returns message bodies. A read-only endpoint pages 50 conversations at a time and checks case and organization access before returning results.

The populated route regression passed with two cases, multiple invitations and a contributor assigned to only one case. Filtering to the other case returned an empty list. Downgrading that contributor to auditor after listing blocked the list and the direct thread request. The synthetic browser preview showed two English rows, one Russian row after applying the case filter and switching language, and the localized empty state for a third case. The filtered link contained the expected case, invitation and locale. Following the second recipient’s link in a synthetic portal with two invitations selected that exact thread and its message in Russian, and switching back to English kept the same message. Production verification follows a separate CV-024 release.

## Public v217

[PR #300](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/300) merged after 18 successful checks. The [merged-main build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/43704545931) passed for `e9ea0a1f7a66c97f76a48fda9a9d2d08fd77b02d`. Sites published the same source tree at `d5a4ea9025e59e59fa3c9146ca0707aeddc38a71` in deployment `appgdep_6af98d1b9b008191b4914e96cd7acffb`. Both casevant.pro and the native Sites origin matched all 164 current and 57 retained assets.

| Signed-in check | Observed result |
| --- | --- |
| All accessible cases | Three new synthetic threads appeared in descending last-message order. The release-audit case had recipients A and A2. The C1 smoke case had recipient B. Each had a distinct QA message. |
| Filter each case in English and switch to Russian | The audit case showed only A and A2. The C1 case showed only B. Both filters retained the selected case and matching recipients after switching language. Timestamps changed to the Russian format. |
| Open A, A2 and B from the list | Each row opened its case, selected its own recipient and displayed its matching message under Messages. A opened correctly even though A2 was the newer recipient on that case. Switching Russian to English on A and B and English to Russian on A2 retained the corresponding thread. |
| Open A’s client invitation under a different signed-in account | Acceptance was denied in Russian and again in English. The portal exposed no test message or recipient address. Switching to English left the existing Russian denial in place until retry. CV-026 tracks that text. |
| Staff access | The production identity owned both cases. CI verified an unassigned organization member saw no rows, a contributor saw only their assigned case, and a subsequent auditor downgrade blocked both list and thread access. |

The three invitations use reserved synthetic addresses. The QA messages were posted inside their respective case portals. The prior revoked C1 invitation was left untouched. The empty-case result was exercised in the bilingual candidate preview.

## CV-026 candidate

The portal previously stored the denial as an already translated string. It now stores both translations and renders the active one on each locale change. The workspace switch displays the destination code and includes that destination in its accessible name. The client portal already displays the destination language in full. A rendered-navigation regression passed for both languages. Release acceptance will switch the same denied invitation twice and inspect the alert and thread visibility after each click.
