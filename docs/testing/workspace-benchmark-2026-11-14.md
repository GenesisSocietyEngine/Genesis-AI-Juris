# MyCase benchmark and CaseVant workspace audit · 14 November 2026

## Signed-in walkthrough

| Workflow | MyCase observation | CaseVant observation and disposition |
| --- | --- | --- |
| Daily work | Home combines creation shortcuts, a weekly timesheet, financial overview and activity. Calendar shows a dated grid. Tasks offers case status, assignee, completion and case/lead filters. | Opened Home, Calendar and Tasks. The previous v213 phone checks found six Home activity filters and nine history filters with 44 px targets. Compare task filtering across case and lead work in CV-023. |
| Cases and people | People offers groups and practice area filters. Lead pipeline exposes stage columns and practice area, office and assignee filters. Lead dashboard links intake, events and communications. Lead tasks show owner and due date. | Opened My cases, Contacts, Workflows and the AI Studio landing screen. The directory and forecast should use the same lead-stage vocabulary. CV-014 addresses that inconsistency. |
| Documents and intake | The menu separates case files, firm files, templates, signature requests, intake and trash. Firm files showed an empty collection. Signature, intake and trash pages explained the next action. | v213 activity links opened the exact case document, including version activity. The Russian document inspector still exposed English actions. Retain CV-017 for that complete journey. |
| Billing and payments | Viewed account activity by deposit account, weekly timesheet by user and financial insights by practice area and billing type. Statements and reconciliation are navigation destinations. | Opened Billing. Previous v213 bilingual checks covered the balance cards. CV-018 remains the priority for entry from an authorized case and return to that case. Payment execution and accounting reports are outside the chosen product scope. |
| Reports | Dashboard groups accounting, financial, case/contact, productivity, leads and saved reports. Leads Insights distinguishes referral source, conversion and forecast. | Opened the English catalog and switched to Russian. Ran Реестр дел, observed two results, four localized column headings and export/print controls, then returned to the catalog. Russian home link still announced Home. CV-014 and CV-015 are implemented in this candidate. |
| Communications | Email offers account connection, messages filter by case/type, call log and SMS explain setup, and comments show an empty selection. | CaseVant already has case-scoped portal communications. CV-024 tracks discovery across cases without mixing client audiences. |
| Evidence limits | Menu inventory and read-only destination visits establish navigation and visible controls. Financial/provider setup, accounting internals, permissions administration, signature completion and delivery were not exercised. Some destinations returned no inspectable headings on first navigation. | Today's desktop pass covered all nine primary workspace destinations. The mobile and document-link observations below are from the earlier signed-in v213 checks. No client data was used in a write or copied into this audit. |

## Earlier v213 checks completed before the pause

English and Russian Home filters selected the intended category, including empty Events and Deleted. History retained Documents on entry. Task history expanded from 30 to 35 and removed the pagination control. Both the creation and version links selected and focused the exact synthetic document, including after reload. At 390 CSS px the activity and history fit in both languages. The Russian Reports catalog also fit. The document inspector language issue remains open independently. The November 14 report run supplements those results.

## Implementation and acceptance

CV-014 renders recognized lead-stage keys with the directory's bilingual labels before report filtering, grouping, sorting and CSV export. Existing saved queries using the raw stage key still match. Authored strings and unknown stages survive. CV-015 localizes the shared brand link. Verify the two candidates after integration using a signed-in Russian forecast, CSV and the accessible name on Reports and Studio.

All 20 focused navigation and Reports checks passed, including bilingual rendering on both Reports and Studio.

14 November 2026 · CV-014/CV-015 release gate. Intel simulator attempts timed out during preparation, driver attachment and editor interaction. The restart workflow now runs on an Apple Silicon macOS 15 host. The independent native smoke workflow continues on Intel. All six restart phases and their deadlines remain in force. CI acceptance pending.
