# Current database-state readback

## Outcome and scope

Provide a repeatable local comparison of a properly obtained administrator diagnostic response against this checkout's exact committed migration chain. This is metadata acceptance, not deployment, backup/restore, live foreign-key integrity, preserved-row evidence or full product acceptance. The historical [M0 comparison script](../m0-platform-ledger-2026-09-25/compare-production-schema.mjs) and its receipts remain unchanged; its historical counts must not be reused for current 0023 acceptance.

## Obtain the existing read-only response

The deployed application already has parameterless GET `/api/admin/database-state` in [the route](../../../app/api/admin/database-state/route.ts). It requires a genuine trusted ChatGPT session in the existing `GENESIS_ADMIN_EMAILS` allowlist. A local password login, organization owner or Site owner is not equivalent. Do not forge headers, broaden authority or route around a client security restriction.

Use ordinary authorized browser navigation and save the complete JSON response privately. Record the exact source/deployment, UTC request window and request ID independently. No customer rows, credentials or raw SQL definitions are included by [the fixed collector](../../../app/database-state-diagnostics.ts). If the original permitted browser path is blocked, keep that fact as BLOCKED rather than claim live schema was inspected. On 29 September the authorized browser navigation was blocked with `net::ERR_BLOCKED_BY_CLIENT`; this tool does not overcome that restriction.

The direct response is usable even if its separate log sink reports failed delivery. If collecting independently retained Worker logs for an already permitted diagnostic request, require matching request ID/digest, all numbered chunks exactly once, consistent total count, reconstructed JSON and full SHA-256 equality. A submitted-log flag alone does not prove retention. This CLI accepts the complete response envelope, not arbitrary chunks; retain the separate reconstruction evidence. Do not collect unrelated user logs.

## Execute only against saved metadata

From a clean checkout at the exact reviewed source, with Node 22.13 or newer:

```sh
node --experimental-sqlite scripts/compare-database-state.mjs   --report /private/path/diagnostic-response.json   --expected-digest FULL_REPORT_SHA256   --not-before 2026-09-29T15:16:07.175Z
```

Replace the UTC lower bound with the actual intended observation window. Supply the full-report digest recorded independently with that request; copying an untrusted file's claimed digest does not authenticate its origin. Capture stdout as the sanitized comparison receipt, retaining the real exit code. Do not put private response files, real account details or storage exports in Git.

The script:

- Checks the fixed response revision, scope, DB binding, complete/stable flags, capture lower bound, both SHA-256 digests, catalogue count/order/unique identities and known-ledger completeness.
- Reads the local journal and each listed SQL file, verifies its bytes against the exact Git HEAD, and executes that chain only in fresh in-memory SQLite. No live database, connection string, network or production query is used.
- Compares each application object by type/name, owning table and definition hash. Missing/changed objects and unexpected extras fail. A different SQLite rendering is retained as a mismatch requiring review, not normalized away.
- Lists the exact known provider tables and their implicit indexes separately. Their definitions, physical resources and operational safety remain unverified; a provider-looking prefix is not a blanket exemption.
- Requires a stable readable `__appgarden_migrations` ledger naming exactly the checked-in migrations, without duplicate/conflicting names, missing application timestamps or non-applied statuses. Provider hash/checksum semantics are not assumed to equal source-file hashes.
- Returns 0 for this bounded match, 1 for a comparison mismatch, and 2 for invalid/incomplete input or execution failure. Neither a schema match nor 0 exit is a release approval.

Source migration hashes and source commit are emitted for reproducibility. The report timestamp, actual request provenance and deployed binary are not independently attested by this offline comparison. No historical catalogue or chunk count is hardcoded.

## Recovery prerequisites still external

Continue the [0023 recovery sequence](../inv01-p1-amendment-2026-09-29/MIGRATION_RECOVERY.md), retaining the actual publication chronology. A post-release match cannot retroactively establish that a pre-release gate passed.

The available Sites database overview is a bounded list, and its row reader only accepts identifiers returned by that overview. Neither exposes arbitrary SQL, physical D1/R2 identity, snapshots or restore. The collector likewise does not execute a live foreign-key check or inspect business rows/documents. Do not use local rehearsal helpers that enumerate whole rows or R2 objects against production.

An authorized hosting operator/provider must supply the actual resource identities, supported snapshot/restore procedure and permissions, and an isolated restore target with independent storage and approved audience. Obtain a controlled restore-rehearsal receipt there, including the relevant schema/ledger, integrity and non-sensitive preservation checks. A fresh snapshot now cannot prove pre-v103 recoverability. No guessed Wrangler credentials, ledger edits, table drops or production restore are authorized by this comparator.

Keep the reviewed forward-fix recovery approach: returning to historical v102 retains the documented private-read issue. Stop on missing/changed application objects or divergent migration history and review an additive repair; do not replay an edited applied migration.

## Synthetic acceptance fixtures

Existing [INV01 local evidence](../inv01-2026-09-28/REVIEW.md), [account review](../account-readability-2026-09-29/REVIEW.md) and [organization review](../org-context-amendment-2026-09-29/BROWSER_AND_DEPARTURE_REVIEW.md) use isolated stores and fictional example.test accounts. They do not provide authorized live mailbox recipients or permission to copy local credentials into production. The [C-valid capacity fixture](../inv01-2026-09-28/fixtures/fixture-c-valid-capacity-and-reconciliation-v1.txt) is fictional and prepared-only; FiveFlats manifest/save/reopen/report evidence does not establish file-chooser import or real simulation. Actual mail acceptance requires a specifically authorized controlled recipient and its independent mailbox proof.

## Verification

Focused comparator tests cover real current migration replay, provider classification, missing/changed/unexpected objects, stale/incomplete/tampered metadata, duplicate or incomplete platform migration-ledger identities, CLI exits, non-echo of invalid private input and refusal of uncommitted migration bytes. Run:

```sh
node --experimental-sqlite --experimental-strip-types --test tests/database-state-comparison.test.ts
```

Verified on 29 September 2026 from base `edfca4bcd8eccbc72c9c90193529e22b006e15b2`, using Node 24.21.0: 9/9 focused tests PASS, zero failures/skips; full nonincremental TypeScript check exit 0; targeted ESLint exit 0. The actual committed chain has 24 migrations and produces 639 application catalogue objects locally; these observed counts are not hardcoded acceptance rules or production results. All eight relative documentation links resolve.

Independent review reproduced an orphan implicit provider-index false match. The corrected classifier requires its exact owning provider table in the observed catalogue; the regression and independent adversarial retest pass. UTC calendar validation and ledger-column projection checks were also tightened. An initial typecheck found two new test callback annotations missing; both were corrected before the successful final run. Independent final source/runbook review found no remaining blocker within this bounded scope.

These tests use synthetic metadata and disposable local SQLite only. No fresh live diagnostic report was obtained, no production schema match is claimed, and no recovery, mail, mobile or human acceptance gate is closed by this development checkpoint.
