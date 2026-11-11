# CV-020 · Exact documents from Recent activities

## Candidate · 11 November 2026

The v211 activity feed encoded the raw document ID as `target`. The case workspace expects `document-<id>` for both selection and DOM focus. Its inventory fallback made the first file appear selected while target lookup failed; the previous observation of the correct file was therefore incidental, not proof of exact resolution.

Home and history now generate the expected target for document creation and version-upload events. The case inventory leaves the inspector unselected if an explicit requested document is absent. A deliberate inventory choice remains possible, and ordinary searching/filtering retains its existing first-match behavior. The unavailable-target notice follows the interface language. No stored documents, versions, permissions or download endpoints change.

Validation: two rendered EN/RU link regressions cover both Home and history, case/organization/language and distinct same-title document IDs. The document workspace regression covers a non-first target, a missing target, explicit selection after failure, filtering and immutable source data. Twenty-one existing workspace-render checks and the SQLite activity authorization/filter/pagination regression passed. Targeted ESLint passed. The React review found no new fetches, effects or state synchronization; selection remains derived and existing native controls retain their semantics.

Production verification remains pending release. Check actual activity links in EN/RU, exact selected card and focus, refresh, version-upload history, missing document target and denied organization context. Keep CV-017's broader document localization separate.
