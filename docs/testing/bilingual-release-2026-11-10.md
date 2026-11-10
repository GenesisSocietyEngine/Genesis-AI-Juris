# Uploads, Billing, Reports and case Overview — 10 November 2026

## Signed-in baseline (public v208)

The synthetic release case was opened in English and Russian. Under AI Studio → Sources & evidence there was no document-upload control. Overview exposed two ways to open the same case creation form in each language. In Russian the evidence action still used the English phrases “current dossier snapshot” and “attributable reviewer approval.” Billing and Reports were absent from primary navigation.

The Russian directory saved and reopened a synthetic prospect with stage “Консультация”. Its page had one visible main heading, no unnamed buttons or unlabelled visible controls, correct document language and a selected Contacts navigation item. At 390 CSS px it had 390 px scroll width and all 11 visible buttons measured at least 44 px. The accessible name of the home logo was “CaseVant — Home” in Russian.

## Candidate evidence

The full migrated route suite passed 24 scenarios, including actor and organization isolation, assigned-case permissions, idempotency and reconciliation. A EUR 50 invoice with EUR 20 collected yielded EUR 30 outstanding. An independent browser test suppressed the first successful saved-report response: retrying created one configuration. See [Reports](practice-reports.md), [Billing](practice-billing-cv011.md) and [uploads](studio-document-destinations-cv013.md).

In the Russian synthetic report preview, the lead forecast showed an English system stage (`consultation`) under “Этап обращения”. The source directory already calls this stage “Консультация”. The number 1,250 displayed as “1 250”. At 390 px viewport (375 px content width), all six visible actions were 44 px high; content and scroll width matched. These measurements are fixture evidence, not production sign-off.

## Publication and signed-in acceptance

Release-engineering observation: the iOS workflows launch on both branch pushes and pull requests, each with a separate concurrency group. On Billing’s unchanged commit, [one restart run passed](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42807178176) while [the other](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42807169139/attempts/1) timed out at the legacy reader’s UI-settle checkpoint. Its diagnostic simulator screenshot also timed out. Mobile sources, Rust crates and workflow definitions were unchanged from the passing CV-006 candidate. The failed job was retried without changing the branch or waiving the gate.

Pending the combined production release. Verify original file access and all four destinations, recorded and reconciled EUR balances, scoped Reports data and saved configurations, and the single case creation control with its plain-language next action. Record desktop and narrow layout results in both languages before closing release gates.
