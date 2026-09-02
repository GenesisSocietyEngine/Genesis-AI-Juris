# V64 architecture decisions: confidential document boundary

Status: **accepted for contract freeze; activation remains blocked**  
Decision date: 2026-09-01  
Authoritative handoff: `06933136cbb38927ecd5d29681cdbea477fab11c`

This record freezes the eight Phase A decisions. It authorizes design and
implementation work only. It does not establish that infrastructure or
compliance gates are satisfied.

## ADR-001 — tenant siloing

Each confidential organisation has one dedicated EU data plane, D1 database,
and private R2 namespaces for quarantine, clean documents, extracted text,
exports, and backups. The control plane stores routing and entitlement only.
Every data-plane row and relationship remains bound by `organization_id` and
composite keys. Unknown resources produce the same private response as denied
resources. Organisation roles confer no dossier access.

## ADR-002 — identity and authorization

Entra uses Authorization Code with PKCE and server sessions. Verified
`iss + tid + oid/sub` is the identity key; email and UI claims are never
authority. Invitation acceptance and OIDC callbacks have explicit
pre-membership rules. Organisation actions require active membership, while
dossier actions additionally require active participation and the exact case
role. Tenant exports require separate compliance-export authority and approval
from each included dossier owner.

## ADR-003 — encryption and key management

Objects are encrypted with tenant-scoped keys whose aliases, never secrets, are
recorded in manifests. Keys for live data, export packages, backup, and restore
are separated. Rotation is versioned and auditable. Deletion jobs destroy
eligible object keys before minimal tombstones are committed. KMS/HSM location,
contract and restore behavior must be evidenced before activation.

## ADR-004 — upload quarantine

Uploads enter a private EU quarantine namespace and follow the closed state
machine `intent -> uploading -> quarantined -> scanning -> clean|infected|
rejected -> extracting -> ready|extraction_failed`. Only a digest-bound clean
receipt may promote exact bytes. Scanner absence, timeout, stale definitions,
or receipt mismatch fails closed. No quarantine object is readable by users,
search, extraction, preview, or AI.

## ADR-005 — extraction and OCR

Pinned, network-denied EU workers extract only clean PDF/DOCX objects within
resource limits. Extracted bodies are encrypted objects, not ordinary database
columns. OCR is a separate explicit operation with versioned English/Russian
models, source-image digests, confidence, and mandatory review semantics.
Source content is untrusted data and cannot alter instructions or formulas.

## ADR-006 — retention and legal hold

Versioned policies have no indefinite default and destructive evaluation starts
with an approved dry run. Legal holds bind an exact tenant/object graph and
override every purge path. They use a stored immutable request as the
requester/action source of truth; an approver cannot supply or rewrite requester
identity. Creation and release require distinct request and approval actors,
independently bound by immutable receipts.
Deletion receipts disclose backup expiry honestly. Dossier export authority is
case-scoped; a tenant export cannot use organisation administration as ambient
case authority.

## ADR-007 — residency

Confidential processing is EU-only end to end. D1/R2 jurisdiction, regional
hostname, metadata boundary, workers, queues, cron, malware scanning,
extraction, OCR, KMS, logging, backup, restore, support, and AI paths are
verified separately. An EU bucket is not evidence that subrequests or compute
are regional. A missing or expired receipt disables the tenant capability.

## ADR-008 — backup and restore

D1 Time Travel is supplemented by encrypted independent metadata exports and
separately credentialed EU object replication. Restore occurs only into an
isolated non-public EU environment. Quarterly tests verify hashes, references,
audit chains, holds, anchors, reports, RPO and RTO, then destroy the environment
and keys. Production is never a restore target.

## Consequences and invariants

* Rust remains authoritative for canonical case validation; authorization is
  server-owned and is not duplicated in web, Flutter, or Rust.
* AI output remains proposal-only and package/formula allowlists remain
  immutable.
* Web and Flutter consume the same versioned contracts and expose the same
  warning, lifecycle state, audit, and policy semantics.
* `disabled` and `validation` always require synthetic or properly
  de-identified input. Only a current, explicitly approved tenant can become
  `approved`.
* No fallback crosses a tenant, region, scanner, identity, or approval gate.
