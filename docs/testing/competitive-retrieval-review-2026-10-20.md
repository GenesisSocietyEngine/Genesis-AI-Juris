# Competitive review and authorized retrieval audit — 20 October 2026

## Baseline and intended result

Review plan: [competitive stage](../development/CASEVANT_COMPETITIVE_PRODUCT_STAGE_2026-10-20.md). Canonical/opened source `b7060ced80ed1d4bb6634b08555b45679c570efe`, clean isolated checkout before branch `codex/competitive-retrieval-20261020`. Root workspace has another writer's Cargo.toml/CURRENT_PROGRESS and untracked TAX_ECONOMICS_V2 plan; untouched. Native Sites inspection confirms public v150, runtime d4547efd3fcc1f36207f121ffe43348fc8530f6f, saved version appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_c820306242908191adfc736920de31da. Source opening agrees with canonical; application inputs unchanged since v150. Existing DB/DOSSIER_DOCUMENTS bindings retained.

Outcome: retrieve an authorized older saved Studio case before pagination. Acceptance: literal metadata search across all authorized rows, EN/RU, unchanged privacy/IDs/source/recovery, query-bound cursor, cancellation/stale-account fences, labelled explicit submit/reset, honest loaded-result sort, no case writes. Exact single-case open branch remains unchanged. No case/source schema or historical factory changed.

## Review findings and corrections during implementation

- Existing loaded-only search could report no match while an older saved row existed. Move matching to the authenticated server before keyset pagination; do not enumerate all client pages or read draft payloads for search.
- SQLite lower() is ASCII-only. The initial GLOB candidate failed the real RU handler check because D1 limits patterns to50bytes. Replaced it with parameterized literal instr and fixed Russian-alphabet folding. The corrected real D1 handler test passes EN/RU/punctuation and pagination. No fuzzy/transliteration promise. Added exact `#saved ID` lookup to avoid ambiguity with numeric substrings in titles/source IDs.
- Changing a query must cancel active reads, clear its cursor and fence late results; existing authority checks remain required. Query-specific cursors must not be reused for another query. Legacy no-query cursor stays compatible.
- Keep sort labelled loaded-only, preserve exact Studio links and distinguish no matching authorized results from no saved cases. No approval/completion claim is added.

## Verification and delivery

The corrected catalogue + real authenticated D1 persistence cohort passed26/26, with strict TypeScript and changed-code lint passing. The cohort includes save/reopen/scenario/stale-write preservation in addition to the new metadata search. Further boundary assertions are added for maximum-length Russian cursor encoding and malformed UTF-16; final totals below supersede this checkpoint. Initial private-grant fixture was rejected by the existing database trigger and corrected without changing that protection.

Pre-release Chrome observed45 authorized saved rows (25 initially loaded,20 on the next page), with exact title/ID/link/time retained in local comparison evidence. Older synthetic20/18/19/17/16 are absent from the first25. The local full application preview responds200 and preserves its signed-out access gate; it cannot stand in for authenticated production browser acceptance. Production acceptance and native receipt are pending. All real and synthetic production cases are retained; no save/delete/reshare is performed for retrieval QA. Competitor documentation is research evidence, not independent performance/security validation.
