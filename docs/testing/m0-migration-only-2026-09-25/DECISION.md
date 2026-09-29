# Narrow migration-only production amendment

Intended user outcome: finish the known, additive 0022 schema upgrade without exposing unaccepted C1 interfaces or waiting for an unnecessary historical Support trace. Preserve production business behavior, existing data and application recovery versions.

Acceptance before execution: current schema and actual ledger agree on exactly 0000–0021; reviewed corrected 0022 hash is preserved; every prior SQL and snapshot stays unchanged; journal entries 0–21 remain identical; all application/UI/API/auth/PDF source remains exact v95; only schema/migration/build-verification inputs change. Existing and newly identified recovery risks must be reviewed before the one supported deployment.

## Authoritative present-state evidence

The owner report at 2026-09-25T09:34:31.652Z has revision `m0-readonly-2026-09-25.2`, request `a288563f-a718-476b-8bfe-9a501c2209d5`, report digest `10ecbaf3cf452972d37ffb125dcf507140bd583015cd70645303af6fd7468090`. All 45 native Sites Worker log chunks reconstruct that exact report. Script version: `790d7481-9a16-4c22-8420-c667fbb9fda8`.

All 591 baseline definitions match and all 36 objects introduced by 0022 are absent. The observed `__appgarden_migrations` table has exactly 22 complete, stable entries named 0000–0021; no fields are omitted. Those filenames match the source journal one-to-one. There is no hash column: no ledger hash validation is claimed. Schema and ledger establish the present pre-0022 execution boundary for this production binding; they do not prove historical data state or database restoration.

## Deliberately bounded scope

Keep the entire v95 application and diagnostics. Add the production-specific order amendment of `0022_loving_juggernaut.sql` (SHA-256 `dbc92b2762b5186b8a359869067cc11dd6a990dda2162ecab5f5728eb53f9628`), its unchanged reviewed final-state snapshot, appended journal entry and matching schema declarations. Preserve the accepted mandatory migration-statement check in the build. No C1 UI, request-receipt writer or working-note route is exposed in this release.

The former corrected SQL hash `5a7d2c2ca5b724e5f29bf27660a45191fb68b6d676491a1af7414e55f2f3760a` is retained as the comparison input, not the production execution input. Real legacy handlers fail at its intermediate states after statements 5–14. Move only its existing statement 15 (the parent composite index) to position 1. All 31 trimmed statement bodies and the completed schema definitions are identical, and the final foreign-key check passes. Only execution order and separator-boundary whitespace change. See `ORDER_AMENDMENT.json`.

Review's already-applied 0022 remains untouched. Once this production variant is applied, later C1 promotion MUST retain production's `dbc92b…` migration bytes and its unchanged snapshot/journal history. Copying application changes from review does not authorize replacing production's applied SQL with review's earlier order.

0022 contains 31 top-level CREATE statements: five tables, ten explicit indexes, sixteen triggers. It alters or deletes no existing table/column and performs no top-level data write or R2 operation. All new triggers attach to new tables. One index extends existing `dossier_source_anchors` with a tuple containing its already unique primary-key ID.

## Recovery and acceptance boundaries

The intended recovery is the retained v95 application while retaining the database. Previous exact-v91 handler rehearsal proves full-upgrade compatibility, preservation of 73 old tables/310 synthetic rows/14 R2 objects, old sealed PDF bytes and later working notes. It does not prove hosted snapshot restoration; request-operation rows were empty during that rollback fixture. No DB restore claim is made.

Independent review identified a concrete partial-prefix defect: a child foreign key was declared before its supporting parent index existed. Actual legacy anchor creation and review failed at prefixes 5–14. The order amendment removes that dependency window. A new mandatory build regression reproduces the old failure and passes SQL preparation for all 32 states (baseline plus 31 completed-statement prefixes) after correction. The independent actual-handler prefix run must also pass before publication. Local prefix tests remain distinct from the unknown hosted transaction boundary.

Full C1 visible-release acceptance and external-pilot approval stay open. This intermediate stage does not expose their unaccepted journeys and does not mark the broader M0/backup/restore record complete. Physical D1 provider UUID is not asserted; evidence concerns the actual application DB binding associated with the production Site and its correlated native request.

After a successful native execution, verify 23 ledger entries, exactly one 0022 entry, all old entries unchanged, all 591 baseline definitions unchanged, and 36 added objects (630 total if the three platform objects remain). An actual post-run diagnostic still requires the owner's authorized session. Any failed deployment requires inspection of its current state before another attempt; no blind replay, ledger rewrite, trigger disabling or schema deletion is authorized by this decision.

The diagnostic suite passed 12/12 on this schema-chain amendment. The mandatory migration checks passed 2/2 after the order correction; the new regression was first observed failing on the old order, so it tests the reproduced defect. The completed schema and final foreign-key checks are unchanged. Independent source review confirmed the narrow scope and the order-only correction in principle.

The candidate may be built and saved while the independent real-handler prefix run finishes. Publication remains conditional on its complete result. The final execution decision, native deployment and post-run evidence are separate timestamped records; saving/building this candidate is not the decision to execute it.
