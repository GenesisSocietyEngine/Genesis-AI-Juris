# Case documents and Billing context · 14 November 2026

CV-017 covers the case Documents upload form, metadata filters, file inspector, version history, download and review actions, extraction states and readiness dimensions. The Russian interface retains original filenames, titles, custom types, notes and recorded explanations. Locale switches preserve the selected immutable version and upload draft.

CV-018 carries a team case and its exact section and document target into Billing. The return link appears only after the ledger response matches the selected organization and case. A case change or denied read clears the previous return route. Direct firm entry opens the case picker. No ledger schema or payment behavior changes.

The focused component, navigation, billing and case suites passed 32 checks after the final return guard. The document integration suite also passed 12 checks, including immutable uploads and recovery. The return tests cover English and Russian, direct entry, personal cases, different organizations, unauthorized or switched cases and external return paths. The Russian document regression checks the review action alongside the original filename.

Signed-in release acceptance remains pending for these two changes. Reopen a synthetic document in Russian, inspect versions and download labels, and navigate from that case into Billing and back to the exact file. Repeat in English and check switching away from the originating case.

## Release gate for PR #294

Public Sites v213 remains live. The signed-in English forecast on that version showed one row with the raw stage key. PR #294 passed 17 of 18 checks. The paired iOS restart run passed. The other restart run failed three times on the same head: the incomplete-write Studio menu wait, the write-phase driver deadline, and the preparation deadline during Xcode compilation. The web/PDF rerun passed. The green-only merge condition remains unsatisfied. No new release or production CSV/home-link acceptance is recorded. [Native run and attempts](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/43595684870).

[Follow-up PR #295](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/295) also awaits CI. Its native preparation timed out on attempt one and simulator launch timed out on attempt two.

## Public v214

Both PRs passed 18/18 checks before merging in the requested order. [PR #294](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/294) merged as `11f82670e9e20e3bb12b0630532b353dffcd9e36`. [PR #295](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/295) merged as `23c48362fb5d766edcbe83007ee5a4447aabd416`. The [exact-main build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/43616412473) passed. The restart gate uses an Apple Silicon runner, checks the launched PID and executable immediately before SIGTERM, and proves process absence before relaunch. All 58 harness tests passed locally. VM discovery, launch and Intel build timeouts required CI retries.

The first deployment callback failed. Redeploying the same saved v214 succeeded as `appgdep_6af891ca2f2c819182d2be73592e2312`. The Sites helper produced source commit `7a487576951639324da6f4e991652c9bf7336f83`. Its difference from GitHub main comprises nine historical mobile golden/evidence files omitted from the hosting checkout. The application-input digest matched exact main, and 164 current plus 88 retained assets passed content verification on each production origin.

| Signed-in workflow | English | Russian |
| --- | --- | --- |
| Lead forecast and downloaded CSV | Lead stage / Consultation | Этап обращения / Консультация |
| Brand link and actual home destination | CaseVant — Home → Home | CaseVant — Главная → Главная |
| Document inspector | Upload, accept, reject, secure download, expanded version history and current v2 | Localized upload, accept, reject, secure download, expanded version history and current v2 |
| Billing round trip | Authorized case preselected. Exact URL and pressed document restored. | Authorized case preselected. Exact URL and pressed document restored. |

The CSV files were parsed after download as UTF-8 with BOM. Both contained the single synthetic prospect with the expected localized stage. The round trips preserved organization, language, case, section and document target. Original filenames and the authored English version note remained intact. The Russian selected section button still reads “Documents & evidence” (CV-025). Live checks inspected review controls without committing a review or ledger transaction.

CV-025 candidate · The document/working-notes switch now follows the case locale, including its accessible group name. The case tab and document switch share the same document label. Selection still uses the workspace controller and document identity. Signed-in language-switch acceptance follows publication.

## CV-025 verified on public v215

[PR #296](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/296) and [PR #297](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/297) each passed 18/18 checks before merging in order. The iOS simulator launch timed out on one #297 job and passed on its unchanged retry. All 24 focused tests passed. The [exact-main build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/43634598587) passed for `37d33752738a49f253595e66d8ad8767ade48c8e`. Sites source `366cc970e2d65677f270bfe52e7217e2a3427875` has the same tree. Deployment `appgdep_6af8bebb3fc08191b23fd2c7148f9ac3` succeeded. Each production origin served all 219 expected assets (164 current, 55 retained).

In the signed-in production workspace, a document activity opened “Synthetic release 209 original”, version 2. All 11 case tabs displayed the expected labels in English and Russian. The selected tab and pressed document button both read “Documents & evidence” in English and “Документы и доказательства” in Russian. The second button and group name changed from “Working notes” and “Documents and notes” to “Рабочие заметки” and “Документы и заметки”.

Across English → Russian → English, the selected section, pressed file row and exact version download URL matched throughout. The route, including the case, section and document target, differed only in the language parameter. No case records were edited.
