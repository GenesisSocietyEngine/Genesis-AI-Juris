# My cases list and editing usability

## Scope and source verification

User requested a more usable list and editing entry, with amended UI style. Before editing: clean isolated checkout and freshly fetched canonical main `e2b5283549c3447bf590b809788551b06147ea53`; native Sites v149 points to `bcd50f3342413fb5ac8cd55811a519d3c9b5239b`. The difference is seven Markdown files only. Existing Site remains public. Supported Sites opening returned the exact canonical checkout/HEAD. Root checkout belongs to another writer and is untouched.

## Acceptance before implementation

- Replace narrow four-column draft cards with readable full-width rows; retain complete long titles and distinguish duplicate titles by saved ID.
- Search loaded authorized records by title, author or ID; deterministic in-memory sorting by update/title without mutating records or implying global search.
- Readable bilingual UTC dates with exact original timestamp retained; accessible, clearly named Studio links preserve custom-case ID, organization and language.
- Owned and other authorized drafts remain distinct. Owner action says Edit; shared/admin action says Open. Studio remains responsible for effective authorization.
- Narrow EN/RU layouts have no content overflow, reachable actions and visible keyboard focus. Loading, failure, empty/search-empty and pagination remain explicit.
- No storage, schema, persistence, migration, source factory, report renderer or permission changes. Retain every existing/synthetic production case. No inline rename/delete or background writes.

## Evidence

Candidate checks: 11/11 My cases tests pass, including existing authority expiry/stale-response/pagination fences, plus immutable loaded-set search/sort, duplicate IDs, EN/RU UTC formatting, invalid dates and exact continuation links. TypeScript passes. Diff reviewed: presentation and memory-only selection helpers only; catalogue transport and server contracts unchanged.

Rendered actual row component with clearly labelled synthetic fixtures: desktop long titles and aligned actions visually reviewed; narrow Russian at actual 390 CSS pixels, document scroll width 375, no horizontal content overflow. This fixture is layout evidence, not authenticated application acceptance. Full-application preview and production acceptance remain separate. Review caught and removed a misleading no-results instruction to load more when the final page has no cursor.

Production receipt pending. Do not interpret this implementation note as a published release.
