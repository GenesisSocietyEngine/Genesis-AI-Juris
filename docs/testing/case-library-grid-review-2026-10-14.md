# CaseVant filtered library grid review

The intended outcome is two filtered examples side by side on desktop, including a mixed result set such as Canopy and Harbor, with one column on narrow screens. Live version 124, local clean HEAD and canonical main matched `fc6c2e012a00b242e9e51d6fb7203a47ffe2834b` before editing; the supported Sites helper verified the same source.

Root cause: DemoCatalogueCards and CategoryDemoCards each owned a separate two-column grid. Filtering Advisory decision left one card in each independent grid, producing two vertically stacked half-width cards and unused horizontal space.

Correction: CaseExampleLibrary owns one result grid; both card components return their existing articles as fragments. Category CTA positioning uses an article data attribute rather than a removed group wrapper. Canopy's expanded guided walkthrough retains its intentional full-row layout. Empty results and saved-play recovery remain outside the card grid. No data, launch handler, source identity, saved case, schema or recovery contract changes.

Review: existing catalogue/category checks passed ten tests; strict TypeScript passed; scoped React lint passed without errors. A class-sensitive category assertion initially caught an unnecessary class change; the final article class is preserved and all original assertions pass. No tests were weakened. The React review found no new hooks, requests or eager loaders.

Browser preview: Advisory decision yields two results in one grid. At requested 1440-pixel desktop width, Canopy and Harbor have equal 554-pixel widths and the same top coordinate (320.3125); their left coordinates are 272 and 846. At requested 390-pixel narrow width, both share left coordinate 16 and occupy separate rows; document client and scroll width are both 375, with no horizontal overflow. Mixed-family structure, reset/empty results, guided expansion and final production evidence are recorded in the delivery receipt as exercised.

The requested development report is `docs/development/CASEVANT_DEVELOPMENT_BACKLOG_REPORT.md`. It separates delivered library/export/QA work from remaining migrations, prioritizes implementation, names code entry points and defines acceptance, preservation, integration, publication and rollback instructions. The detailed playbook is linked in both directions and its stale completed backlog entries are updated.

Final canonical source, build provenance, Sites version/deployment, changed live layout, current CI and preview teardown belong in the delivery receipt. A preview result or merge alone is not publication evidence.
