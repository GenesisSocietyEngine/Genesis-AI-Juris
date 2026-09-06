# Production verification — unapplied proposals

Production verification is NOT VERIFIED. Lane A remains blocked; isolated local lane B continues. This carries forward the original preflight receipts. No new production queries or mutations were performed for this clarification.

## Deployment identity

The available Sites read-only responses do not expose the current `appgdep_…`. One missing current provider deployment receipt was already requested; do not repeat unsuccessful discovery calls or substitute a historical identifier. Required mapping: deployment status and URL → saved version → exact deployed source SHA → active environment revision → current custom domain.

Saved Build 72 maps to source `e025131d87e35d4364d542acc5c84b6097eb657b`. Its archive receipt is retained in `evidence.json`. Saved status, HTTP 200 and client version markers do not establish active deployment identity. Configured version 69 also does not establish active Build 69.

## Migration 0019 evidence matrix

Expected source: `drizzle/0019_p1_organization_scope.sql`; journal includes 0019. Full expected inventory is nine tables, five explicit unique indexes and nineteen triggers.

| Expected object / guard | Actual production evidence | Unverified |
| --- | --- | --- |
| `dossier_organization_bindings`, `dossier_organization_commitments` | Prior observation: expected columns, both empty | PK/FK definitions, deferred constraints, consistency and complete migration |
| `organization_authority_checks`, `organization_cas_guards` | No schema receipt | Tables and CHECK constraints requiring 1 |
| `organization_invitations`, `organization_lifecycle_requests`, `organization_memberships`, `organization_security_events`, `organizations` | No schema receipt | Definitions, defaults, constraints and foreign keys |
| `dossier_organization_bindings_scope_uidx`, `organization_invitations_digest_uidx`, `organization_memberships_user_uidx`, `organization_memberships_actor_uidx`, `organization_security_events_sequence_uidx` | No index receipt | All five unique definitions |
| `p1_dossier_binding_required`, `p1_dossier_binding_commitment`, `p1_binding_update_guard`, `p1_binding_delete_guard` | No trigger receipt | Active authority, atomic commitment, immutable binding |
| `p1_participant_membership_guard`, `p1_audit_membership_guard` | No trigger receipt | Active membership and current audit authority |
| `p1_membership_identity_guard`, `p1_membership_delete_guard`, `p1_organization_identity_guard`, `p1_organization_delete_guard` | No trigger receipt | Identity/revisions/owner protection, terminal states and retained history |
| `p1_invitation_guard`, `p1_invitation_accept_authority` | No trigger receipt | Immutable single use, expiry and current authority |
| `p1_lifecycle_request_guard`, `p1_lifecycle_approval_guard`, `p1_lifecycle_delete_guard`, `p1_organization_transition_guard` | No trigger receipt | Valid request, independent approval, retained requests, approved transitions |
| `p1_security_event_guard`, `p1_security_event_update_guard`, `p1_security_event_delete_guard` | No trigger receipt | Contiguous digest chain, current authority, append-only receipts |
| Backfill: personal organizations, owners, active explicit participants, bindings and commitments | Two empty tables do not establish behavior | Complete applied journal/checksum, consistency, record preservation |
| Backup and recovery | No accepted receipt | Supported backup/restore access and compatible source |

The bounded provider table list does not establish absence of other expected objects. Leave this production gate unverified until supported schema/journal/backup evidence is available; never replay 0019 to infer its status.

Local evidence is separate: the two added in-memory tests exercise active/removed participant backfill, four-table history preservation, fresh organization objects, authority/CAS guards and atomic orphan-binding rejection. The full isolated ERP harness applies the complete migration journal and tests current routes. Populated document-version/snapshot/output preservation across the upgrade is not established by those two new tests. Execution counts belong in the candidate handoff, not in this production matrix.

## Environment change proposal — not applied

Configured revision 33 contains these values. Active use of that revision remains unverified.

| Variable | Recorded configuration | Proposed value |
| --- | --- | --- |
| `GENESIS_DEPLOYMENT_VERSION` | `69` | Exact version identifier from the selected, verified deployment receipt |
| `GENESIS_WEB_COMMIT` | `6019e47346a2bf719a09dc1d874a2fc807f99598` | Exact source SHA bound to that same deployment |

Do not default to 72 or use an unselected local candidate SHA. Consumer: `currentObservabilityReleaseIdentity` in `app/server-observability.ts`, with telemetry fields `deploymentVersion` and `webCommit`; the explicit deployment label takes precedence over `CF_VERSION_METADATA`.

Required operations: reconcile the deployment mapping; finalize concrete values and expected telemetry; obtain separate approval for the environment update and any provider-required reactivation/deployment; apply only through supported provider operations; retain before/after receipts and verify resulting active mapping and telemetry. Nothing in this proposal authorizes a mutation.

## Forward recovery

Preserve organization bindings, immutable versions, snapshots, private objects and audit/security history. Establish schema, backup and application compatibility, then select verified P1-compatible source and repair forward.

A pre-P1 application is not an accepted recovery target. Migration 0019 rejects dossier creation without authorized organization binding, and old readers lack current organization revocation/suspension checks. Additive tables alone do not establish compatibility. Historical versions 63/70 are not approved rollback targets. No downgrade, table deletion or blind migration replay is proposed; no independently accepted production recovery target is established.
