# M0 read-only database-state amendment

## Intended outcome

Allow the existing, allowlisted platform administrator to obtain the database schema-object hashes and recognized migration ledger metadata through a normal authenticated request, without waiting for Support. No arbitrary SQL or mutation capability is introduced. Metadata collection is not migration approval or backup/restore evidence.

## Release scope

The application tree is based on live v91 source `3986d9035b522044ad8423b50a5b620cbc13734f`. Apart from this diagnostics helper, endpoint and tests/review note, it matches that source. All 44 packaged migration files (0000–0021 SQL plus metadata), schema, hosting configuration, dependencies, authentication policy, normal UI and PDF implementation are preserved. The corrected0022 SQL exists only in a test fixture; it is not in drizzle or deployment output.

The commit descends from retained C1 source `22e0a240f4ac0a958848119c2b0161a86fc2657d`, preserving Git history. Native C1 version93 and its archive remain saved and unpublished. The functional diff must be assessed against v91, not mistaken for deleting live C1 features.

## Implementation and review

Endpoint: `/api/admin/database-state`, GET with no parameters. Requires the existing trusted platform identity and `isPlatformAdmin` allowlist. Organization ownership and local-password sessions do not confer this permission. Requests without trusted platform identity are denied before the local-auth helper can touch session timestamps. No secret or audience changes are required.

Only fixed SELECT statements run against schema and recognized ledger metadata. Raw definitions are converted to SHA-256. No customer rows, credentials or R2 data are read. Schema is read before and after; changes, failed or bounded-out reads and unrecognized ledger structures produce incomplete results. Absent known ledgers expressly do not imply that migrations are unapplied. The initial512-object cap was found inadequate against the actual591-object v91 schema and corrected to1024 before release.

Logging uses a separate Worker-only diagnostic contract, with numbered chunks, total count and complete report digest. It does not call the anomaly persistence path. Submitted logs are not represented as confirmed platform retention. An administrator can save the complete JSON response; missing chunks or digest mismatch invalidate log-derived evidence.

Read-only independent source review found no auth/privacy/write blocker. Focused tests cover actual baseline, partial and complete0022 schema; unchanged schema/rows; absent/recognized/malformed/truncated ledgers; changing/failing catalogue; actual Miniflare D1 support; chunk reconstruction and sink failure; real route authorization and parameter rejection. Synthetic dispatch identity in tests is not hosted authentication acceptance.

## Publication boundary

There are no new migration inputs relative to successful productionv91. Under the Sites contract, the already recorded0000–0021 chain is expected to be skipped. This does not assert direct ledger inspection. The historical0022 state is left untouched; the endpoint exists to observe it. Application rollback is the retained nativev91; it is not a database rollback.

Native publication and hosted invocation are recorded separately in the Linux execution handoff. Do not claim a diagnostic report was collected until an ordinary authorized request has actually produced it. Do not deployC1, repair a ledger or retry0022 based only on this amendment's publication.

## Later C1 promotion

Because22e0 is an ancestor of this deliberatev91-based amendment, an ordinary merge may not reintroduceC1. After acceptance and safe migration resolution, explicitly restore the acceptedC1 application tree from22e0 (or its accepted successor), intentionally retain or remove diagnostics, review the resulting source/migration diff and build a new exact candidate. Do not force-push or overwrite the retainedv93 evidence.
