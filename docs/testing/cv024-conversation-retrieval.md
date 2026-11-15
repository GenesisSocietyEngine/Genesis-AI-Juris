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

The populated route regression passed with two cases, multiple invitations and a contributor assigned to only one case. Filtering to the other case returned an empty list. Downgrading that contributor to auditor after listing blocked the list and the direct thread request. The synthetic browser preview showed two English rows, one Russian row after applying the case filter and switching language, and the localized empty state for a third case. The filtered link contained the expected case, invitation and locale. Production verification follows a separate CV-024 release.
