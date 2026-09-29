# Report format discovery amendment

Baseline: production v101, source b18b524f8afdd98fb137e29f398634efce282285. Native status confirms its deployment succeeded with environment revision 39. The three formats were implemented in Case Studio's report dialog; My cases / Reports is a different governed snapshot-output workflow. The user's missing-choice report is addressed as a discoverability problem, not an assumed publication or cache failure.

Outcome and acceptance: Base, Medium and Full must be visible together before preview/download. Keep the existing PDF content, receipts, tree toggle, authorization and approval requirements. Explain the different report paths where users encounter them.

Changes:
- Replaced the format dropdown with a native radio group containing three labeled cards, above the preview/download actions. Native keyboard selection, grouped fieldset/legend, visible focus and a narrow-layout single column are retained.
- Full selection now has an explicit Full analysis report heading instead of only a professional-output profile label.
- Added a wayfinding panel to My cases / Reports. Its separate-tab Studio link preserves allowed navigation context and does not copy the selected dossier, generate a report, discard a draft or change approval state.

Review evidence:
- 20 focused report-model, first-use and receipt/controller checks passed. English and Russian first render exposes exactly three format controls before output actions; option transitions still invalidate stale previews/receipts correctly.
- TypeScript and focused lint passed. Diff check passed. PDF generator, calculations, schema, migrations, dependencies and hosting manifest are unchanged.
- Supervised local browser: opened the canonical Canopy walkthrough and its Studio working copy; opened Create analytical report; all three cards visible. Selecting Medium worked; ArrowRight selected Full and ArrowLeft returned to Medium. Selected-format status updated correctly. Captured and inspected report-choices.jpg.
- React review: no new data fetching, no added effect for presentation state, standard radio semantics, existing busy-state fieldset disable, unchanged generation authorization. The reports link opens separately and does not imply the organization dossier has become a Studio draft.
- Authenticated My cases panel and genuine narrow/mobile viewport were not browser-tested this run. Its link/copy and responsive CSS were source-reviewed. No new hosted authentication or pilot readiness claim is made.

Publication: run the supported build/package workflow and publish to the existing production Site, preserving environment revision 39 and current audience. Native version/deployment responses remain the authority for publication outcome.
