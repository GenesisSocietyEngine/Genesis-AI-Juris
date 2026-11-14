# Case documents and Billing context · 14 November 2026

CV-017 covers the case Documents upload form, metadata filters, file inspector, version history, download and review actions, extraction states and readiness dimensions. The Russian interface retains original filenames, titles, custom types, notes and recorded explanations. Locale switches preserve the selected immutable version and upload draft.

CV-018 carries a team case and its exact section and document target into Billing. The return link appears only after the ledger response matches the selected organization and case. A case change or denied read clears the previous return route. Direct firm entry opens the case picker. No ledger schema or payment behavior changes.

The focused component, navigation, billing and case suites passed 32 checks after the final return guard. The document integration suite also passed 12 checks, including immutable uploads and recovery. The return tests cover English and Russian, direct entry, personal cases, different organizations, unauthorized or switched cases and external return paths. The Russian document regression checks the review action alongside the original filename.

Signed-in release acceptance remains pending for these two changes. Reopen a synthetic document in Russian, inspect versions and download labels, and navigate from that case into Billing and back to the exact file. Repeat in English and check switching away from the originating case.

## Release gate for PR #294

Public Sites v213 remains live. The signed-in English forecast on that version showed one row with the raw stage key. PR #294 passed 17 of 18 checks. The paired iOS restart run passed. The other restart run failed three times on the same head: the incomplete-write Studio menu wait, the write-phase driver deadline, and the preparation deadline during Xcode compilation. The web/PDF rerun passed. The green-only merge condition remains unsatisfied. No new release or production CSV/home-link acceptance is recorded. [Native run and attempts](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/43595684870).

[Follow-up PR #295](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/295) also awaits CI. Its native preparation timed out on attempt one and simulator launch timed out on attempt two.
