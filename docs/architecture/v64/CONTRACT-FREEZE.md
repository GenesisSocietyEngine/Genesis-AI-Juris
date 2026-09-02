# V64 Phase A contract freeze

The following additive schemas are frozen at version 1:

* `contracts/organization-contract.v1.schema.json`
* `contracts/confidential-document-policy.v1.schema.json`
* `contracts/tenant-resource-manifest.v1.schema.json`

Consumers must reject unknown contract versions, unknown properties, invalid
enums, malformed IDs, non-EU resource declarations, and missing required
fields. Additive behavior requires a new schema version rather than silent
reinterpretation. Schemas contain no secrets or tenant content.

This freeze deliberately distinguishes identity, organisation, and dossier
authorization scopes. Pre-membership identity flows do not invent membership;
dossier-scoped flows always require participation. It also excludes ambient
tenant export authority from `org_admin`. Authorizations carry a concrete
operation and are constrained by the exact organisation and dossier role.
Delegated administrator invitation/suspension authority is explicit and
versioned. A tenant export request requires an independently versioned
compliance-export grant whose dossier-keyed approval map is the exact export
set and binds every dossier to its owner, receipt, and content manifest.

The organisation policy set is closed and complete: retention, deletion,
export, legal hold, offline/mobile, AI disclosure, session, and data
classification versions are all mandatory. Unknown policy names are rejected.

An approved tenant resource manifest also binds four purpose-prefixed key
aliases and current EU-jurisdiction evidence for workers, queues, cron, malware
scanning, extraction, OCR, KMS, logging, analytics, backup/restore, support,
and AI.
Missing component evidence or an unknown field invalidates the manifest; it
cannot be inferred from the region of a storage resource.
Quarantine, clean, extracted-text, export, and backup storage entries also bind
distinct purpose namespaces and purpose-specific access aliases; a shared
unqualified storage binding cannot satisfy the frozen manifest.

An `approved` manifest requires a production-only
`tenant-activation-validator.v1` receipt covering the top-level verification
and every processing-component receipt. The validator must re-read the covered
receipts, verify their hashes, compute `valid_until` as the earliest expiry, and
enforce `evaluated_at <= now < valid_until` on activation and every capability
check. Generic JSON Schema validation alone is insufficient; the custom
`x-require-future-at-validation` assertion is mandatory in the server-owned
activation validator. Expiry immediately disables the capability.

Offline mobile storage is either absent or carries every required device-bound
encryption, secure-storage, backup-exclusion, remote-revocation, and clearing
control. Legal-hold creation/release is split into owner requests and
reviewer/organisation-admin approvals, bound to separate actors and an
immutable separation-of-duties receipt. The server authorization validator must
resolve the immutable `legal-hold-request.v1` record from `request_id`, bind its
stored action and actor to `request_action` and `request_actor_id`, record that
lookup in `request_record_binding_receipt_sha256`, then enforce the required
`x-require-distinct-fields` assertion. It must separately bind
`approval_actor_id` to the authenticated session actor using the recorded
session-binding receipt. Generic JSON Schema validation alone is insufficient;
a missing/mismatched request record, self-approval, or a session/actor mismatch
fails closed before any receipt is accepted.

Phase B must not begin until reviewers accept this freeze and the threat model.
No confidential activation is implied by accepting either document.
