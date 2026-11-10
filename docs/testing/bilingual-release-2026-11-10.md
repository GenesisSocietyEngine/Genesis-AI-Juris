# Uploads, Billing, Reports and case Overview — 10 November 2026

## Signed-in baseline (public v208)

The synthetic release case was opened in English and Russian. Under AI Studio → Sources & evidence there was no document-upload control. Overview exposed two ways to open the same case creation form in each language. In Russian the evidence action still used the English phrases “current dossier snapshot” and “attributable reviewer approval.” Billing and Reports were absent from primary navigation.

The Russian directory saved and reopened a synthetic prospect with stage “Консультация”. Its page had one visible main heading, no unnamed buttons or unlabelled visible controls, correct document language and a selected Contacts navigation item. At 390 CSS px it had 390 px scroll width and all 11 visible buttons measured at least 44 px. The accessible name of the home logo was “CaseVant — Home” in Russian.

## Candidate evidence

The full migrated route suite passed 24 scenarios, including actor and organization isolation, assigned-case permissions, idempotency and reconciliation. A EUR 50 invoice with EUR 20 collected yielded EUR 30 outstanding. An independent browser test suppressed the first successful saved-report response: retrying created one configuration. See [Reports](practice-reports.md), [Billing](practice-billing-cv011.md) and [uploads](studio-document-destinations-cv013.md).

In the Russian synthetic report preview, the lead forecast showed an English system stage (`consultation`) under “Этап обращения”. The source directory already calls this stage “Консультация”. The number 1,250 displayed as “1 250”. At 390 px viewport (375 px content width), all six visible actions were 44 px high; content and scroll width matched. These measurements are fixture evidence, not production sign-off.

## Publication and signed-in acceptance

Uploads, Billing and CV-006 each merged with 18 successful checks. Billing merged before Reports. The deployment is split so signed-in acceptance for the three merged features can start while the corrected Reports head runs CI. The focused native regression failed against the old dialog (`expected 250, actual 0`) and passed against the corrected dialog; all 12 focused tests and Flutter analysis passed on the pinned Flutter 3.44.8 SDK.

Release-engineering observation: the iOS workflows launch on both branch pushes and pull requests, each with a separate concurrency group. On Billing’s unchanged commit, [one restart run passed](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42807178176) while [the other](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42807169139/attempts/1) timed out at the legacy reader’s UI-settle checkpoint. Its diagnostic simulator screenshot also timed out. Mobile sources, Rust crates and workflow definitions were unchanged from the passing CV-006 candidate. The failed job was retried without changing the branch or waiving the gate.

**Public v209.** [Merged-source build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42832560974) and [release receipt](receipts/workspace-billing-v209.json). Both production origins served all 244 expected assets. The signed-in synthetic case and a separate personal Studio draft were used.

| Workflow | Observed on production |
| --- | --- |
| Uploads | In both locales, Studio offered draft, originating team case, firm library and reusable templates. A 70-byte TXT was uploaded to each file destination; all three downloads matched the SHA-256 in the receipt. The Studio draft was saved, opened from Personal cases on a fresh tab and still offered its attachment. The team inventory displayed its version, tag and secure download. The Russian firm library reopened version 1. The templates editor imported Cyrillic, Latin text and two merge fields unchanged, then saved version 1. |
| Billing | The English journal recorded 30 minutes at EUR 100/hour, invoice #2 for EUR 50 and synthetic payment #3 for EUR 20. Russian reconciliation #4 linked that receipt to an external statement reference. Reload and case reselection preserved EUR 30 outstanding; the trust balance remained zero. No transfer, customer notification or external payment occurred. |
| Case Overview | EN/RU showed one creation control; keyboard opening focused the title and closing returned focus to New case in the measured English run. At 390 CSS px, scroll width equaled content width in each locale. The independent-review warning remained visible with details closed. Opening details revealed the exact recorded reason; the action opened the report-evidence screen. |
| Residuals | Russian document inventory and case checks still render some English system labels (CV-017); record quotations and user text were excluded from this finding. Accounting reports were not in scope. Independent production role access was not impersonated. |


Billing attempt 2 timed out in a different phase (`incomplete-write`, after tapping the Economics view), waiting for Flutter's global `pumpAndSettle`. The uploads restart job timed out preparing Xcode and the Reports simulator job timed out after 15 minutes preparing its bundle. No check was waived. For follow-up, evaluate explicit readiness conditions for navigation instead of whole-screen idle, measure Xcode preparation separately, and keep all native calculation, persistence and relaunch assertions intact.

A separate [Reports native run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42809257665/attempts/1) reproduced the previously tracked [native import dialog padding assertion](padding-native-cause-boundary-2026-10-21.md). The first synthetic cancel probe in `legacy-write` failed inside `Dialog.build → AnimatedPadding`. The original diagnostic reports `snapshot_error_type: FlutterError`; zero keyboard insets in the *later matcher* do not establish geometry at the original exception. The [independent same-commit run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42809276093) passed. A green rerun is not evidence this native defect was fixed. Preserve phase/view metrics even if reading the live widget tree fails; require original dialog geometry before choosing a product correction. This was a native mobile tax editor run, not the web Reports workflow.
