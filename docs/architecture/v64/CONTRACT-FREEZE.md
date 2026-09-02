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
tenant export authority from `org_admin`.

Phase B must not begin until reviewers accept this freeze and the threat model.
No confidential activation is implied by accepting either document.
