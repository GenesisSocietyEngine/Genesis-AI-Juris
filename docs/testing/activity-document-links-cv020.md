# CV-020 · Exact documents from Recent activities

## Candidate · 11 November 2026

The v211 activity feed encoded the raw document ID as `target`. The case workspace expects `document-<id>` for both selection and DOM focus. Its inventory fallback made the first file appear selected while target lookup failed; the previous observation of the correct file was therefore incidental, not proof of exact resolution.

Home and history now generate the expected target for document creation and version-upload events. The case inventory leaves the inspector unselected if an explicit requested document is absent. A deliberate inventory choice remains possible, and ordinary searching/filtering retains its existing first-match behavior. The unavailable-target notice follows the interface language. No stored documents, versions, permissions or download endpoints change.

Validation: two rendered EN/RU link regressions cover both Home and history, case/organization/language and distinct same-title document IDs. The document workspace regression covers a non-first target, a missing target, explicit selection after failure, filtering and immutable source data. Twenty-one existing workspace-render checks and the SQLite activity authorization/filter/pagination regression passed. Targeted ESLint passed. The React review found no new fetches, effects or state synchronization; selection remains derived and existing native controls retain their semantics.

## Production acceptance · v212 · 11 November 2026

PR #289 merged after 18/18 checks passed. Its first exact-main build was stopped by a newly reported RSC dependency advisory; CV-021 supplied the compatible security patch before publication. The released source is `c2213aab4531b5a9f2dec1d02c46d7598cca8a03`, from successful main run 42943780736. Both origins verified 274 current/retained assets. [Receipt](receipts/document-links-v212.json).

Signed-in English and Russian Home → Documents → synthetic document and full history → document journeys passed. Creation and version-upload entries all encode the exact document target with case, organization and language retained. The visible inspector and focused element belong to that document, and the unavailable notice is absent. Reload retains the target and focus. Version history expands to show current version 2 and immutable version 1; activity links open the document's current inspector, not a historical-version-only view.

Deliberately missing targets display the localized EN/RU unavailable notice with zero selected rows or visible document cards. A correct document URL under a different organization is denied without rendering document cards; restoring the correct organization reopens the exact file. This uses one owner identity across two organizations, not a second restricted identity.

Before publication, an isolated browser fixture with two documents proved the activity link selects and focuses the non-first file in both languages, retains it after reload, and leaves the inspector empty for a missing target. Production verification used the existing synthetic case and made no document writes. Broader untranslated document controls remain CV-017. CV-020 is closed.
