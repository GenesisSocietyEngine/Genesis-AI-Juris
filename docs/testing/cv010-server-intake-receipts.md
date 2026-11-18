# CV-010 · Server-authorized intake receipts

## Staff and client workflow

1. Complete a case intake in Library. In the case portal, choose an active synthetic recipient and open **Shared items → Intake review**. Expand the named version and review the questions and answers before sharing it.
2. In the invited client's portal, open the same version, review or correct the answers, then select **Confirm and submit answers**. The Russian controls are **Общие материалы → Проверка анкет → Подтвердить и отправить ответы**.
3. Both parties can reopen the submission to see the recorded answers, receipt number, version and time. Reopening the source intake in Library supersedes that version. A new completed revision needs a new staff request. Staff retain prior receipts after revision or revocation.

## Evidence and boundaries

Migration 0039 ties each request to the recipient grant and an immutable intake revision. The server generates a unique receipt number distinct from the staff request ID. The receipt records the authenticated recipient, submitted answers and database time under that request. Staff and client writes check the case, active grant and current revision in the write statement. Unique keys serialize competing submissions. An exact retry recovers the original evidence. A different answer on an already receipted request returns a conflict.

The local D1 portal scenario covers unauthorized and missing requests, two active recipients, a second case, required answers, concurrent matching submissions, matching and conflicting retries, version replacement, revoked access and retained staff evidence. Schema generation reports no drift and the migration breakpoint checks pass. The English and Russian component checks exercised corrected answers, switching languages with an unsent edit, localized receipts and stable receipt time.

Chrome also exercised the complete Portal component against the real staff and client API handlers backed by local D1. Each language had its own issued version. The client corrected an answer, switched languages in both directions, submitted once, switched the receipt language, and reloaded. The same receipt number and corrected answer remained visible. The server observed exactly two requests and two submissions across both journeys. This walkthrough found that issuing a request collapsed its expanded intake. Using a stable revision key keeps that review open.

The [hosted Linux web and PDF workflow](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44119529524) passed for implementation commit `a86547f`. It reported 2,092 passing tests, zero failures and three skips. The local production build, type check, two migration checks and 32 selected workflow and route tests passed.

The separate full Windows run initially reported seven failing checks. Three Git-history and schema checks passed on rerun with the checkout explicitly trusted by Git. The other four concerned build provenance, vendored dependency identity and the Open Graph font transforms in a checkout with linked dependencies. The hosted workflow exercised these checks on a clean installation.

The production baseline is v220. Applying migration 0039 and publishing the application are production release steps. A signed-in production walkthrough needs an active test client. Provider-backed signatures remain a separate CV-010 deliverable.

## Public v221 · 17 November 2026

PR #314 merged as `02550a471fe23348c9bb46d6c95164e2a5c82137` after 18 successful checks. The initial Chrome packaging startup failure passed on rerun. The [exact-main web and PDF run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44131516717) supplied the release artifact. The official Sites workflow synchronized the same application inputs, packaged migration 0039 and published v221 successfully at environment revision 42. Both origins reported the exact source and verified 229/229 assets, including 63 retained v220 assets.

The published staff portal loaded its intake query successfully after migration in EN/RU. The two synthetic cases still have three invited and two revoked grants. The independent client signed in as maxim.hayan@erpvalue.eu sees no shared cases in either language. Active-client submission, exact-version retry and reload remain pending. CV-028 and CV-029 remain pending too.

The actual portal component with local D1 and synthetic identities again passed the EN/RU submission and reload walkthrough. The route scenario again passed concurrent matching retries, conflicting-answer rejection, stale-version rejection, second-recipient denial and revocation checks. Production grant states and private case content were only read during this release verification.

[Release receipt](receipts/cv010-v221.json).
