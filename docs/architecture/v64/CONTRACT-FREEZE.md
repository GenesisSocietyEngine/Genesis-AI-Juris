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

An approved tenant resource manifest also binds four purpose-prefixed key
aliases and current EU-jurisdiction evidence for workers, queues, cron, malware
scanning, extraction, OCR, KMS, logging, analytics, backup/restore, support,
and AI.
Missing component evidence or an unknown field invalidates the manifest; it
cannot be inferred from the region of a storage resource.

Phase B must not begin until reviewers accept this freeze and the threat model.
No confidential activation is implied by accepting either document.
