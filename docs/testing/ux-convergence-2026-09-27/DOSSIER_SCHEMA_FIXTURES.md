# Current-schema Dossier integration fixtures

Date: 27 September 2026. This is a test-fixture correction in the uncommitted UX worktree, not a production migration or application change.

## Intended outcome and acceptance criteria

The manual-matter and governed-output integration suites must exercise the current application queries against the complete current database schema. Existing lifecycle, authorization, audit, immutable-snapshot and protected-download expectations must remain intact. All migrations and their guards must be active; fixture setup must satisfy them rather than bypass them.

## Finding and correction

The full regression log `evidence/continuation-full-tests.log` showed Scenario A and seven governed-output failures querying the absent `dossier_source_anchor_retirements` table. Both test databases explicitly stopped at migration 0018 while the application and migration journal already include 0019 through 0022.

Both fixtures now apply all four later migrations in journal order. Their owner and reviewer actors receive explicit active organization memberships, with a case binding created in the same transaction as the case. The owner has the organization-owner role; the reviewer has organization-member status and retains the separate case-reviewer role. No triggers or foreign keys are disabled. The governed-schema readiness check now also queries the retirement and working-note tables.

After schema correction, the exact report-generator assertion exposed an older renderer/build expectation. It now requires renderer `1.3.0` and build `dependable-actions-2026-09-15`, matching the current exported production constants; the visible appendix still must carry that exact build identity.

Only `tests/dossier-e2e.test.ts` and `tests/dossier-governed-output-integration.test.ts` contain code edits for this correction. Lifecycle, approval, snapshot-binding, integrity and download expectations retain their checks. No production behavior, UI wording, navigation, permissions or retained user work changes.

## Evidence

- Combined pinned-Node22 run: 14/15 passed, including all five end-to-end scenarios and all previously missing-table checks. The sole remaining failure was the stale generator assertion described above. Output: `evidence/dossier-current-schema-tests.log`.
- Focused rerun of the affected complete approval/snapshot/output scenario after that assertion correction: 1/1 passed, exit 0 (62.8 seconds), using pinned Node v22.23.2. Output: `evidence/dossier-current-schema-provenance-tests.log`. All 15 scenarios are therefore covered by passing results across these two runs; this is not a claim of a second combined 15-test run.
- Diff review and `git diff --check`: passed after the fixture changes.

This local Miniflare/D1/R2 integration run does not establish hosted deployment or real-account acceptance. No publication or production data mutation was performed.
