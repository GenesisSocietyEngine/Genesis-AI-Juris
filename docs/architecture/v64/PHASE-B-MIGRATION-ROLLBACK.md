# Phase B migration rollback and evidence preservation

Status: branch-only design receipt; no production migration or release action is authorized.

`apps/juris-web/drizzle/0016_tenant_control_plane.sql` is intentionally an
unregistered Phase B candidate. The repository journal, generated snapshots,
and Drizzle schema still stop at the Phase A baseline. The separately observed
v61/v62 migration shapes are read-only, unverified external dependencies; they
are not a production-deployment receipt and are not imported by this branch.

The candidate must therefore not be applied outside an isolated disposable
database. Registration requires reconciliation of the canonical 0011-0015
history, an exact production deployment receipt, an approved resolution of the
frozen `organization.status`/internal `closing` conflict, and exact-head review.

## Failure before transaction commit

Run the whole migration in one transaction. On any statement failure, roll the
transaction back and verify that:

- every pre-existing table definition and seeded row has the pre-run digest;
- none of the Phase B tables, indexes, or triggers remains;
- `foreign_key_check` is empty and `integrity_check` is `ok`;
- the failed-at statement, candidate SQL digest, base-chain digest, runner
  identity, and timestamp are retained in a synthetic-only failure receipt.

The focused migration test injects a collision late in the file and verifies
that earlier Phase B statements are removed while legacy state is unchanged.
That verifies the local transaction harness only; it is not a D1 runner receipt.

## Failure after a future committed application

Do not issue a destructive down migration and do not drop tenant, grant,
session, manifest, or receipt tables. Roll application code back to the prior
compatible release while leaving the additive, unreferenced tables intact,
disable all Phase B capabilities, and preserve confidential mode as `disabled`.
Use a reviewed forward-fix migration for schema defects. If database restoration
is required, restore into an isolated target, verify the complete evidence
chain and legacy fingerprints, and obtain separate human approval before any
traffic switch.

Never delete or rewrite immutable revisions, approvals, lifecycle transitions,
security receipts, or tenant bindings to make a rollback appear clean. Never
represent a source-candidate migration test as a production backup, restore, or
rollback proof.

The production warning remains mandatory:

> Confidential document mode is not active. Do not upload privileged,
> client-identifying, or live production documents. Use only synthetic or
> properly de-identified material.
