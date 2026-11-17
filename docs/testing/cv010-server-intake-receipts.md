# CV-010 · Server-authorized intake receipts

## Staff and client workflow

1. Complete a case intake in Library. In the case portal, choose an active synthetic recipient and open **Shared items → Intake review**. Expand the named version and review the questions and answers before sharing it.
2. In the invited client's portal, open the same version, review or correct the answers, then select **Confirm and submit answers**. The Russian controls are **Общие материалы → Проверка анкет → Подтвердить и отправить ответы**.
3. Both parties can reopen the submission to see the recorded answers, receipt number, version and time. Reopening the source intake in Library supersedes that version. A new completed revision needs a new staff request. Staff retain prior receipts after revision or revocation.

## Evidence and boundaries

Migration 0039 ties each request to the recipient grant and an immutable intake revision. The server generates a unique receipt number distinct from the staff request ID. The receipt records the authenticated recipient, submitted answers and database time under that request. Staff and client writes check the case, active grant and current revision in the write statement. Unique keys serialize competing submissions. An exact retry recovers the original evidence. A different answer on an already receipted request returns a conflict.

The local D1 portal scenario covers unauthorized and missing requests, two active recipients, a second case, required answers, concurrent matching submissions, matching and conflicting retries, version replacement, revoked access and retained staff evidence. Schema generation reports no drift and the migration breakpoint checks pass. The English and Russian component checks exercised corrected answers, switching languages with an unsent edit, localized receipts and stable receipt time.

Chrome also exercised the complete Portal component against the real staff and client API handlers backed by local D1. Each language had its own issued version. The client corrected an answer, switched languages in both directions, submitted once, switched the receipt language, and reloaded. The same receipt number and corrected answer remained visible. The server observed exactly two requests and two submissions across both journeys. This walkthrough found that issuing a request collapsed its expanded intake. Using a stable revision key keeps that review open.

The production baseline is v220. Applying migration 0039 and publishing the application are production release steps. A signed-in production walkthrough needs an active test client. Provider-backed signatures remain a separate CV-010 deliverable.
