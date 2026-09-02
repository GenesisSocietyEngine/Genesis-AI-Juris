# Codex implementation instructions — v64 Confidential Client Document Boundary

## Role and mission

Act as Senior Solution Architect, Security Engineer, Product Owner, and release
owner for GENESIS: JURIS.

Implement the next product milestone as **v64 — Confidential Client Document
Boundary**. The outcome is a production-capable, organisation-isolated dossier
and document plane that may process privileged or client-identifying documents
only after every security, privacy, operational, mobile, and contractual gate in
this instruction is green.

Do not turn GENESIS: JURIS into a generic legal DMS or practice-management
suite. Extend the existing decision-centric dossier architecture so governed
documents, evidence, Decision maps, tasks, reports, and audit remain parts of
one versioned professional matter.

## Authoritative baseline

- Preserve the verified Site 69 / v62 production baseline at web commit
  `6019e47346a2bf719a09dc1d874a2fc807f99598`.
- Build from the v63 information-architecture source commit
  `2881e81f08b3459805a293450edd4840f06d6c97`.
- Preserve all v63 navigation and Guided Studio behavior.
- Preserve the existing dossier v1 import/export, revision-CAS, audit-chain,
  immutable document-version, evidence, snapshot, report, and 18-route runtime
  contracts unless an explicit additive v2 contract is introduced.
- Preserve exact legacy fingerprints. Never silently reinterpret, reassign, or
  migrate an existing user, case, document, source anchor, report, or receipt.
- Keep Rust authoritative for canonical case validation and runtime semantics.
  Server authorization remains authoritative for organisations and documents;
  do not create a second authorization engine in Rust, Flutter, or the browser.
- AI remains proposal-only. Documents and extracted text are untrusted data,
  never executable instructions.

## Non-negotiable release policy

Until the complete Definition of Done is met, keep the existing warning on web
and mobile:

> Confidential document mode is not active. Do not upload privileged,
> client-identifying, or live production documents. Use only synthetic or
> properly de-identified material.

The upload acknowledgement and server-side `synthetic_or_deidentified` policy
must remain enforced. Do not merely hide the warning in the UI.

Introduce a server-owned, tenant-scoped capability
`confidential_document_mode = disabled | validation | approved`. Only
`approved` may accept live confidential material, and only for the exact
organisation whose compliance and infrastructure receipts are current.

No intermediate public release may enable confidential uploads. Do not push,
open or merge a PR, create a Site checkpoint, deploy, or distribute a mobile
build without explicit authorization. Do not create an app-store release.

## Architecture decision

### Separate control plane and confidential data plane

Use a siloed model for the first confidential paid pilots:

1. A minimal control plane stores organisation identity, membership, tenant
   routing, entitlement, SSO connection metadata, and infrastructure receipts.
   It stores no document bytes, extracted text, dossier content, prompts, or
   report bodies.
2. Each confidential organisation receives a dedicated EU-scoped data-plane
   deployment with its own D1 database and private R2 buckets.
3. Every tenant-owned row still carries `organization_id`; every relationship
   uses composite tenant-bound keys even inside a silo.
4. Quarantine, clean-document, extracted-text, export, and backup objects use
   separate private storage namespaces or buckets. None is public.
5. An exact tenant resource manifest binds organisation ID, environment,
   hostname, D1 database ID, R2 bucket IDs, jurisdiction, encryption-key alias,
   schema version, deployment SHA, and activation state. It contains no secret.

Do not use a shared confidential D1/R2 data plane for v64. A later pooled model
requires a new threat model, formal isolation proof, and explicit product
decision. Microsoft’s multitenant guidance treats isolation level as a primary
architecture decision and recognises separate application/database resources as
a valid model: <https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models>.

### EU residency boundary

For every confidential tenant, require and verify:

- D1 jurisdiction `eu`;
- R2 jurisdiction `eu`, accessed only through the EU jurisdiction endpoint;
- EU Regional Services on the confidential custom hostname;
- EU Customer Metadata Boundary for logs and analytics;
- EU execution for malware scanning, extraction, OCR, queues, scheduled jobs,
  KMS/HSM operations, backups, restore environments, and support exports;
- no non-EU subrequest, telemetry sink, crash reporter, AI provider, or support
  tool receives document content or identifying dossier data;
- out-of-region log access disabled unless separately justified, contracted,
  audited, and approved.

Cloudflare documents EU jurisdictions for D1 and R2, but Regional Services does
not automatically regionalise outgoing subrequests, Queues, or Cron triggers.
Verify every component independently rather than inferring end-to-end residency:

- D1 jurisdiction: <https://developers.cloudflare.com/changelog/product/d1/>
- R2 data location: <https://developers.cloudflare.com/r2/reference/data-location/>
- Workers regionalisation and limitations:
  <https://developers.cloudflare.com/data-localization/how-to/workers/>
- Customer Metadata Boundary:
  <https://developers.cloudflare.com/data-localization/metadata-boundary/>

If the current hosting plan cannot provide auditable EU regionalisation for all
content-processing paths, keep v64 confidential mode disabled and move the
confidential data plane to infrastructure that can. Do not weaken the residency
requirement to preserve the current hosting topology.

## 1. Organisation and tenant domain model

Create an additive, versioned organisation contract and migrations.

### Control-plane records

Implement at least:

- `organizations`
  - opaque ID, display name, slug, lifecycle status;
  - contractual controller/processor mode;
  - data region, confidential-mode state, policy versions;
  - created/updated provenance and suspension reason.
- `organization_identity_connections`
  - organisation ID, provider type, verified Entra tenant ID;
  - client ID, issuer policy, admin-consent state;
  - enabled/disabled times and configuration version;
  - no client secret or signing key in D1.
- `organization_memberships`
  - organisation ID, user ID, stable actor ID;
  - organisation role: `org_owner | org_admin | member | auditor`;
  - active/suspended/removed state and authorization version;
  - immutable join provenance and attributable changes.
- `organization_invitations`
  - opaque invitation ID, organisation ID, intended email digest;
  - encrypted delivery address where necessary;
  - requested organisation role, invited-by actor, expiry;
  - single-use token digest, accepted/revoked state, audit receipt;
  - delete encrypted delivery data after acceptance or bounded expiry.
- `tenant_resource_manifests`
  - exact resource bindings, EU jurisdiction evidence, schema/build versions;
  - activation and last-verification receipts.
- `organization_policy_versions`
  - retention, deletion, export, legal hold, offline/mobile, AI disclosure,
    session, and data-classification policies.

### Data-plane records

- Add non-null `organization_id` to every dossier, participant, document,
  document version, upload intent, extraction/OCR job, source anchor, assertion,
  request, Decision package, snapshot, report, audit, and receipt.
- Use composite unique keys and foreign keys containing `organization_id`.
- A child row must not reference a parent from another organisation even when
  opaque IDs collide or are substituted.
- Dossier `owner` remains the case-level role. Organisation ownership does not
  grant ambient access to every dossier.
- Platform administrators receive no routine content access. Emergency access
  must be a separate, time-bound, reasoned, approved, and fully audited
  break-glass flow. Do not add break-glass content access unless the product
  owner separately authorizes it.

### Migration rules

- Do not infer organisations from email domains.
- Do not rewrite existing personal/pilot matters into a new tenant.
- Existing matters remain in explicit `legacy_personal_pilot` scope and retain
  the current synthetic/de-identified restriction.
- Moving a matter to an organisation is an explicit export/import or governed
  transfer with owner approval, new IDs, exact fingerprints, and a transfer
  receipt. It is never an in-place silent update.
- Backfill migrations must be deterministic, resumable, and rollback-safe.

## 2. Invitations, roles, and authorization

Keep the case roles `owner | contributor | reviewer | viewer` and their current
least-privilege matrix. Add organisation roles separately.

Required behavior:

- Only `org_owner` or an explicitly permitted `org_admin` may invite or suspend
  organisation members.
- Only a dossier owner may enrol members into that dossier, transfer dossier
  ownership, or remove dossier access.
- An invitation never grants access before acceptance by the exact authenticated
  identity.
- Invitation tokens are random, high entropy, single use, hashed at rest,
  short-lived, origin-bound, and invalid after revocation or membership change.
- Email-domain matching, Entra `tid`, group names, UI claims, and invitation
  text never grant dossier access by themselves.
- Every request resolves one trusted identity and one exact action. Identity
  callbacks and invitation acceptance use their dedicated pre-membership rules;
  organisation-scoped actions require an active organisation membership; and
  dossier-scoped actions additionally require an active dossier participant.
- Unknown and unauthorized organisation/dossier IDs return indistinguishable
  private responses.
- Switching organisations invalidates cached dossier/document state and binds a
  new server session context. Never retain content from the prior tenant.
- Permission and membership changes increment an authorization version and
  invalidate active sessions/download grants immediately.

Create exhaustive positive and negative tests for every organisation role ×
case role × action combination.

## 3. Microsoft Entra ID / OIDC SSO

Implement Microsoft Entra as an additional organisation-configured identity
source. Preserve current ChatGPT/local access for legacy pilot users, but an
approved confidential tenant may enforce Entra-only access.

Use Authorization Code Flow with PKCE through the system browser. Require:

- `state`, `nonce`, PKCE verifier/challenge, exact redirect URI;
- discovery metadata and JWKS over HTTPS;
- signature, issuer, audience/client ID, tenant ID, nonce, `exp`, and `nbf`
  validation;
- exact mapping from verified Entra `tid` to one enabled
  `organization_identity_connection`;
- stable subject mapping from `iss + tid + oid/sub`, not email alone;
- admin-consent receipt and tenant activation approval;
- bounded clock skew, key rotation, replay protection, and session rotation;
- no ID/access/refresh token in URLs, localStorage, logs, analytics, or audit
  detail;
- short server session with HttpOnly, Secure, SameSite cookies;
- tenant-configurable session duration and immediate revocation.

Microsoft documents multitenant Entra setup, multiple issuer handling, consent,
and service-principal creation here:
<https://learn.microsoft.com/en-us/entra/identity-platform/howto-convert-app-to-be-multi-tenant>.
Token validation must use the verified discovery document, issuer, and signing
keys: <https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens>.

Do not request Microsoft Graph permissions in v64 unless a mandatory feature
requires them and the exact least-privilege permission receives separate review.
SCIM provisioning and Entra-group role mapping are out of scope for initial v64.

## 4. Confidential upload and malware-scanning pipeline

Replace direct availability after upload with an explicit state machine:

`intent → uploading → quarantined → scanning → clean | infected | rejected → extracting → ready | extraction_failed`

Rules:

1. The server creates an organisation/dossier/version-bound upload intent with
   a bounded size, allowed media type, expiry, expected revision, and random
   object locator.
2. New bytes go only to the tenant’s EU quarantine bucket. They are not
   downloadable, extractable, previewable, searchable, or available to AI.
3. Validate declared extension, media type, magic bytes, file structure, size,
   page/entry count, decompression ratio, recursion depth, and embedded files.
4. Reject encrypted/password-protected content unless a separately designed
   controlled decryption flow is approved. Never collect passwords in logs.
5. Run malware scanning in an isolated EU worker/container with no outbound
   internet, read-only definitions, bounded CPU/RAM/time, and a pinned scanner
   and signature-set version.
6. Record an immutable scan receipt containing tenant/document-version IDs,
   byte length, SHA-256, scanner version, signature-set version, result code,
   and timestamps—but no filename, document text, or malware payload.
7. Only a clean result may copy the exact verified bytes to the tenant’s clean
   immutable bucket and commit the current-version pointer.
8. Infected/rejected files remain unavailable and are purged from quarantine
   under a short documented policy unless legal/security investigation requires
   an approved hold.
9. Lost responses and retries must be idempotent. A scan result for one digest
   cannot be replayed for another object, tenant, or version.
10. Scanner outage fails closed; it never marks a document clean.

Follow OWASP’s upload controls and malware-testing guidance, including isolated
storage, strict allowlists, independent content validation, anti-malware scans,
and EICAR testing:

- <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>
- <https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/10-Business_Logic_Testing/09-Test_Upload_of_Malicious_Files>

Do not submit confidential files or hashes to a public scanning service.

## 5. PDF/DOCX extraction and controlled OCR

### Native extraction

Run extraction only after a clean scan in an isolated EU processing service.

- Pin the parser/runtime/container digest and record it in each extraction
  receipt.
- Disable network access, macros, scripts, external relationships, embedded
  executables, remote fonts, and active content.
- Enforce CPU, RAM, wall-time, output-size, page-count, XML-node, ZIP-entry, and
  decompression-ratio limits.
- PDF extraction preserves page numbers, text blocks, reading order, and where
  available bounded coordinates.
- DOCX extraction parses WordprocessingML after ZIP safety checks and preserves
  document order, heading path, table cell, paragraph ordinal, list position,
  footnote/endnote relationship, and stable paragraph digest.
- Never invent page numbers for DOCX. A page is not stable without an exact
  renderer contract; cite DOCX by heading/paragraph/table coordinates.
- Store full extracted text as an encrypted tenant object, not as ordinary D1
  columns or telemetry. D1 stores only bounded metadata, digests, status, and
  locators.
- A failed or partial extraction is visibly labelled and cannot be represented
  as fully searchable or evidence-ready.

### OCR as a separate pipeline

OCR must not be an implicit fallback inside extraction.

- A user with write permission explicitly requests OCR, or an approved tenant
  policy queues it after `no_text_detected`.
- Render only a clean document into bounded per-page images in an isolated EU
  environment.
- Pin renderer, OCR engine, model/language-pack, and configuration versions.
- Support English and Russian in the first release; other language packs remain
  unsupported until tested.
- Persist per-page and per-block confidence and the exact source-image digest.
- Mark OCR text `machine_extracted_unreviewed` until a professional reviews it.
- Low-confidence blocks cannot satisfy evidence-readiness automatically.
- OCR bytes and text never go to an external AI provider unless the exact tenant
  has a contracted, region-approved AI disclosure policy and the user explicitly
  invokes an approved feature.

## 6. Page/paragraph-level citation anchors

Extend, do not replace, existing exact source anchors.

Each anchor must bind:

- organisation, dossier, logical document, and immutable document version;
- document byte SHA-256 and extracted-text object SHA-256;
- extraction or OCR receipt/version;
- PDF page number plus block/line/character range and optional bounded box; or
- DOCX heading path plus paragraph/table/list/footnote ordinal;
- bounded excerpt digest and optional review-safe excerpt;
- creator, creation time, review state, reviewer, and review time;
- source method `native_text | ocr | manual` and OCR confidence where relevant.

Anchor validation must reproduce the quoted range from the exact extracted text
and fail on cross-tenant, cross-document, stale extraction, out-of-range,
normalization, or digest substitution.

Uploading a new document version never mutates or silently migrates old anchors.
Old anchors remain attributable to their exact version and become visibly stale
for current-output readiness until reviewed/replaced.

PDF and exported reports must retain human-readable citations and the underlying
anchor receipt without exposing internal object keys, raw prompts, secrets, or
internal-only audit detail.

## 7. Retention, deletion, export, and legal hold

Implement versioned tenant policies and explicit jobs.

### Retention

- Policies define active-case, closed-case, superseded-version, quarantine,
  extraction, export-package, audit, and backup retention separately.
- No indefinite default. The organisation must approve a versioned policy before
  confidential activation.
- A scheduled evaluator produces a dry-run list before destructive action.
- Policy changes are prospective and audited; shortening a period requires an
  explicit impact preview and approval.

### Deletion

Use states `requested → approved → grace_period → purging → purged | blocked`.

- Verify tenant, authority, object graph, current revision, legal holds, and
  retention basis before purge.
- Delete dependent search/extraction/OCR/export objects and cryptographic keys,
  then metadata according to a deterministic order.
- Preserve only the minimum tombstone/audit receipt required to prove deletion,
  with no document content or identifying filename.
- Report backup expiry honestly. Do not claim immediate erasure from immutable
  backups when the documented backup retention has not expired.

### Legal hold

- Legal hold is an explicit case/document scope with reason, authority,
  jurisdiction, start, optional review date, creator, approver, and release
  receipt.
- An active hold blocks retention and deletion for its exact object graph while
  leaving unrelated tenants and cases unaffected.
- Create/release operations require owner plus reviewer/organisation-admin
  separation of duties; nobody may self-approve a hold release.
- Hold status is visible in Overview, Documents, Audit, exports, and mobile.

### Export

- Dossier owners may request a dossier export within policy. A tenant-wide
  export requires a separately assigned compliance-export authority plus owner
  approval for every included dossier; `org_admin` alone never grants ambient
  dossier access or export authority.
- Build exports asynchronously in the tenant’s EU environment.
- Include canonical JSON/Markdown, immutable document versions, extracted text,
  anchors, decisions, tasks, reports, audit receipts, policy versions, and a
  signed manifest of hashes.
- Encrypt the package with a one-time key delivered out of band; use a short
  download expiry and single-purpose authorization.
- Never include platform secrets, storage keys, internal scanner payloads, raw
  AI prompts, or other tenants’ data.

GDPR requires data minimisation, storage limitation, processor controls, and
appropriate technical and organisational security measures. Treat the final
retention schedule and legal bases as a legal/compliance deliverable, not a code
default: <https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng>.

## 8. Backup and restore

Define initial service targets:

- confidential metadata RPO: at most 24 hours;
- confidential metadata RTO: at most 8 hours for a pilot tenant;
- document bytes: no acknowledged clean version may be lost after commit;
- restore proof: quarterly and before first confidential activation.

Required implementation:

- Verify D1 Time Travel is enabled and retains the expected paid-plan window;
  Cloudflare documents minute-level restore within 30 days:
  <https://developers.cloudflare.com/d1/reference/time-travel/>.
- Add encrypted, EU-resident independent exports of control-plane and tenant
  metadata according to policy; D1 Time Travel alone is not the full backup plan.
- Replicate clean immutable document objects and required manifests to an
  approved EU backup boundary with separate credentials and deletion policy.
- Test restore into an isolated, non-public EU environment.
- Verify row counts, referential constraints, audit-chain digests, document
  SHA-256 values, current-version pointers, anchors, legal holds, and reports.
- Record an immutable restore-test receipt with source point, target isolation,
  build/schema versions, RPO/RTO achieved, verification totals, and approver.
- Destroy the restore environment and keys after evidence capture.
- Never test restore directly over production.

## 9. Privacy, DPA, subprocessors, and trust documentation

Before confidential activation, prepare and approve:

- product data-flow and threat-model diagrams;
- records of processing activities and controller/processor role mapping;
- DPIA screening and, where required, completed DPIA;
- Data Processing Agreement under GDPR Article 28;
- Technical and Organisational Measures schedule;
- complete subprocessor register with legal entity, service, purpose, data
  categories, processing/storage locations, and transfer mechanism;
- subprocessor change-notice process and customer objection/escalation path;
- SCCs and transfer-impact assessment for any relevant non-EEA access/transfer;
- privacy notice, retention schedule, data-subject request procedure, breach
  response, deletion/export procedure, and support-access policy;
- security-contact and incident-notification commitments;
- evidence of EU jurisdiction settings and relevant provider contracts.

The EDPB states that subprocessors require written controller authorization and
equivalent contractual protections:
<https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en>.
EDPB Opinion 22/2024 requires controllers to have processor/subprocessor
identity information readily available:
<https://www.edpb.europa.eu/documents/opinion-of-the-board-art-64/opinion-222024-on-certain-obligations-following-from-the_en>.
Use the European Commission’s SCC material where transfers require it:
<https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en>.

Do not claim “GDPR compliant”, legal-privilege protection, EU-only processing,
ISO certification, or production confidentiality from code tests alone. Obtain
named legal/privacy/security approval for the exact deployed architecture and
contracts.

## 10. Web and mobile product behavior

### Global workspace

Preserve v63:

- My cases
- Templates
- Documents
- Tasks & reviews
- Reports

Add an organisation switcher and explicit confidential-mode status without
hiding the selected tenant. Every screen must show which organisation and case
owns the current document.

### Inside a case

Preserve:

- Overview
- Documents
- Evidence
- Decision map
- Tasks
- Reports
- Audit

Documents must show upload/scan/extraction/OCR states, immutable versions,
classification, retention, hold, and source readiness. Evidence must create and
inspect exact page/paragraph anchors. Audit must show security-relevant lifecycle
events without document text or secrets.

### Mobile parity

Mobile parity is mandatory and release-blocking. Flutter must support:

- organisation selection and isolation;
- Entra/OIDC via system browser with safe deep-link return;
- invitation acceptance, memberships, and the same case roles;
- upload to quarantine, scan/extraction status, retry and rejection states;
- secure document download/preview under tenant policy;
- exact page/paragraph citations and review state;
- OCR request/status/review;
- retention, deletion, export, legal-hold visibility and allowed actions;
- audit timeline and confidential-mode warning;
- the same policy/contract versions and server authorization semantics.

Default mobile policy for confidential documents:

- no document bodies in ordinary application cache;
- no offline availability unless explicitly enabled by tenant policy;
- any permitted offline file is application-encrypted, device-bound, protected
  by OS secure storage, excluded from backups where supported, and remotely
  revocable;
- clear tenant content on sign-out, membership removal, organisation switch,
  policy change, or session revocation;
- redact app-switcher previews and prohibit sensitive values in notifications,
  logs, crash reports, clipboard telemetry, and analytics.

Do not treat a responsive mobile web page as Flutter parity.

## 11. Implementation sequence

Execute in this order. Each phase must have migrations, contract tests,
integration tests, UI states, audit events, and documentation before continuing.

### Phase A — contract and threat-model freeze

1. Write ADRs for tenant siloing, identity, encryption/key management, upload
   quarantine, extraction/OCR, retention/legal hold, residency, and backup.
2. Produce the data-flow diagram, asset inventory, trust boundaries, attacker
   model, abuse cases, and privacy data map.
3. Freeze `organization-contract.v1`, `confidential-document-policy.v1`, and
   tenant resource-manifest schemas.

### Phase B — organisation and isolation foundation

1. Add control-plane organisation, membership, invitation, identity-connection,
   policy, and resource-manifest tables.
2. Add tenant-bound data-plane schema and composite constraints.
3. Build tenant provisioning, suspension, and verification tooling.
4. Add cross-tenant negative-test generators before enabling any new UI.

### Phase C — Entra SSO and governed invitations

1. Implement multitenant OIDC discovery/validation and admin consent.
2. Implement invitation lifecycle and organisation switching.
3. Add session authorization versions and revocation.
4. Preserve the originating Studio tab and pending save through SSO return.

### Phase D — quarantine and malware scanning

1. Introduce quarantine/clean storage separation and upload states.
2. Implement the EU scan worker and immutable receipts.
3. Add EICAR, polyglot, malformed, encrypted, archive/ZIP-bomb, timeout,
   scanner-outage, retry, and cross-tenant substitution fixtures.
4. Do not start extraction until this phase is green.

### Phase E — extraction, OCR, and citations

1. Add sandboxed PDF/DOCX native extraction.
2. Add exact page/paragraph source models and anchor verification.
3. Add the separate OCR queue, confidence and review model.
4. Integrate Evidence, reports, import/export, and stale-output detection.

### Phase F — lifecycle governance and operations

1. Add versioned retention policies, dry run, purge, legal hold, and export.
2. Implement backup, isolated restore, integrity verification, and receipts.
3. Complete Trust Center, DPA/subprocessor/TOM/DPIA artifacts and runbooks.
4. Add privacy-safe security observability and incident procedures.

### Phase G — complete parity and activation

1. Implement the same capabilities in Flutter and shared contracts in Rust where
   canonical validation requires them.
2. Run every mandatory web, Rust, Flutter, Android, iOS, security, privacy,
   restore, residency, and production gate on exact heads.
3. Activate one internal validation tenant first.
4. Activate one explicitly approved confidential pilot tenant only after named
   product, security, privacy/legal, and operations approval.
5. Publish one final v64 release; do not create intermediate public versions
   that imply confidential readiness.

## 12. Mandatory test and release gates

### Tenant isolation

- Every tenant-owned query and mutation requires an exact organisation context.
- Property-based and mutation tests substitute tenant, user, dossier, document,
  version, anchor, invitation, export, report, object key, and receipt IDs.
- Zero cross-tenant reads, writes, timing-disclosing errors, search results,
  downloads, logs, caches, signed URLs, notifications, or background jobs.
- Organisation role never creates ambient dossier authority.
- Suspension/removal/revocation prevents access immediately.

### Identity and invitations

- OIDC signature/issuer/audience/tenant/nonce/time validation is fail-closed.
- Unknown Entra tenant, stale/replayed code, key rotation, mixed issuer, wrong
  redirect, login CSRF, invitation replay, and email-change cases are covered.
- Authentication returns to the originating Studio and successfully completes
  the exact pending save without opening a duplicate working session.

### Documents and extraction

- EICAR and malicious/polyglot/malformed fixtures never reach clean storage.
- Scanner failure, timeout, stale signature set, and mismatched digest fail
  closed.
- PDF/DOCX parser fuzzing and resource-exhaustion fixtures stay within limits.
- OCR is explicit, EU-contained, versioned, confidence-labelled, and reviewed.
- Every citation reproduces its exact range and digest; no stale-version anchor
  is silently treated as current.
- Prompt injection in source text remains quoted untrusted data.

### Governance

- Retention dry runs and purges affect only the exact tenant/object graph.
- Legal hold blocks every deletion path, including scheduled purge.
- Hold release enforces separation of duties.
- Exports are complete, encrypted, hash-manifested, tenant-pure, expiring, and
  contain no secrets/internal-only data.
- Backup restore meets RPO/RTO and reproduces hashes, constraints, audit chains,
  holds, and current pointers.

### Residency and privacy

- Automated infrastructure checks prove D1/R2 `eu`, EU regional hostname, EU
  metadata boundary, and approved EU processing endpoints.
- Scan, extraction, OCR, queue, cron, backup, KMS, logging, analytics, support,
  and AI paths have documented locations and subprocessors.
- Logs, traces, alerts, crash reports, analytics, and audit contain no document
  body, extracted text, raw prompt, token, secret, filename, client identity, or
  storage object key.
- DPA, TOMs, subprocessor list, residency evidence, retention schedule, DPIA
  decision, and incident/DSAR procedures are approved and version-bound.

### Existing product gates

- All existing web tests, strict TypeScript, lint, verified production build,
  dependency audit, import/export, revision protection, auth-return/save,
  stale-JS-chunk recovery, anonymous PDF, report manifest, PDF visual QA, and
  all 18 cross-runtime routes remain green.
- Rust `fmt`, `clippy -- -D warnings`, and workspace tests pass on the exact
  mobile head.
- Flutter formatting, `analyze`, unit/widget/integration tests pass on that head.
- Android build/persistence/security tests and iOS build/simulator/keychain tests
  pass on that head.
- Web/Flutter organisation, role, document-state, citation, policy, and audit
  manifests have identical canonical semantics and fingerprints.
- 200% zoom, 360×800, 412×915, tablet, keyboard-only, 48 px targets, high
  contrast, reduced motion, EN/RU, and screen-reader checks pass.
- External penetration test is complete; all critical/high findings and every
  tenant-isolation finding are resolved and retested. No risk acceptance may
  waive cross-tenant, authentication, upload, encryption, deletion, hold,
  residency, or secret-exposure defects.
- Production observability after deployment is green with zero unexpected 5xx,
  zero security-pipeline bypass, and exact release/tenant-infrastructure markers.

## 13. Required deliverables

Commit and version-control:

- organisation and confidential-document contracts;
- migrations and deterministic migration tests;
- ADRs and threat/data-flow diagrams;
- web, server, Flutter, and Rust implementation;
- provisioning and tenant-resource verification tools;
- scanner/extractor/OCR container definitions and pinned dependency manifests;
- retention/deletion/export/hold and backup/restore runbooks;
- privacy-safe observability and incident runbook;
- test fixtures and immutable exact-SHA gate receipts;
- public Trust Center source documents, DPA/TOM templates, and subprocessor
  register, with legal approval status clearly marked;
- `V64-CONFIDENTIAL-DOCUMENT-BOUNDARY.md` release record.

Do not commit secrets, tenant data, real client documents, malware samples other
than safe standard test fixtures, provider tokens, export keys, Entra secrets,
or private contractual documents.

## 14. Definition of Done

v64 is shipped only when all statements below are true:

1. An approved organisation can authenticate through its exact Entra tenant,
   invite users, and assign separate organisation and dossier roles.
2. Its metadata, document bytes, processing, keys, logs, backups, and support
   path are demonstrably isolated and EU-scoped.
3. Every upload is quarantined and scanned before availability.
4. PDF/DOCX native extraction and separate controlled OCR produce exact,
   versioned, reviewable page/paragraph citations.
5. Retention, deletion, export, legal hold, and restore are operationally tested
   and auditable.
6. DPA, TOMs, subprocessor, transfer, privacy, and incident documentation is
   approved for the exact architecture.
7. Web and Flutter provide equivalent capability and canonical semantics.
8. All security, product, native, parity, accessibility, PDF, dependency,
   penetration, residency, and production gates are green on exact SHAs.
9. The pilot organisation has explicit named product, security, privacy/legal,
   and operations approval.
10. Only then may that organisation’s capability change from `validation` to
    `approved` and the synthetic/de-identified upload block be replaced by the
    approved confidential-data notice for that tenant.

If any condition is missing, preserve the current production baseline, keep the
confidential upload warning and server restriction, report the exact blocker,
and stop. Never describe partial implementation as confidential-client ready.
