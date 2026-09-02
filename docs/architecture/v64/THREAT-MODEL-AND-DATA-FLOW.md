# V64 threat model, privacy map, and data flow

Status: **Phase A baseline — security/privacy approval not yet granted**

## Assets and classification

| Asset | Classification | Permitted location |
|---|---|---|
| Identity, membership, routing, entitlement | restricted metadata | minimal control plane |
| Dossier metadata and decisions | confidential client data | tenant EU D1 only |
| Quarantine and clean bytes | confidential client data | separate tenant EU R2 namespaces |
| Extracted/OCR text and page images | confidential client data | encrypted tenant EU objects |
| Tokens, key material, export keys | secret | approved EU secret/KMS boundary; never D1/logs |
| Receipts and audit chain | restricted metadata | tenant EU D1; no names, bodies, prompts, or keys |
| Mobile previews/cache | prohibited by default | none; policy-gated encrypted offline storage only |

## Trust boundaries and flow

```text
[system browser / Flutter / web]
        | OIDC PKCE or server session; exact organisation context
        v
[minimal control plane] -- signed tenant route --> [dedicated EU data plane]
        | metadata only                              | tenant-bound D1
        |                                            v
        | upload intent                     [EU quarantine R2]
        |                                            |
        |                               digest-bound scan request
        |                                            v
        |                                  [network-denied scanner]
        |                                            |
        |                                      clean receipt only
        |                                            v
        |                                     [EU clean R2]
        |                                            |
        |                                            v
        |                         [network-denied extraction / explicit OCR]
        |                                            |
        v                                            v
[privacy-safe audit]                    [encrypted extracted-text R2]
                                                     |
                                                     v
                                  [anchors / decisions / governed reports]
```

Every arrow is authenticated, tenant-bound, purpose-limited, expiry-bounded,
and audited without content. There is no public-object path and no document
content path back into the control plane.

## Attacker model and abuse cases

We assume malicious outsiders, compromised members, curious organisation
administrators, malicious dossier documents, stolen/replayed invitations or
OIDC responses, compromised mobile devices, supply-chain compromise, confused
background workers, and operator error. Platform operators have no routine
content authority.

| Abuse case | Required fail-closed control |
|---|---|
| Substitute tenant/dossier/document/object IDs | composite tenant keys, exact session context, indistinguishable denial |
| Admin exports cases they do not own | separate compliance-export grant plus every dossier owner's approval |
| Accept invite before identity proof or replay it | origin-bound hashed single-use token, exact identity, expiry and revocation |
| Upload polyglot, archive bomb, malware, or encrypted file | magic/structure/limit checks and isolated pinned scanner; no clean fallback |
| Replay a clean receipt for different bytes | bind tenant, object, version, length and SHA-256; idempotent transition |
| Prompt injection in extracted text | mark untrusted, quote as evidence, AI proposal-only, Rust validation authoritative |
| Cross-tenant job/cache/download leakage | tenant-bound queues and keys, short grants, purge cache on context/version change |
| Exfiltrate through logs/crash/analytics | field allowlists; prohibit content, filename, identity, token, prompt, object key |
| Bypass legal hold through scheduled purge | one authoritative object-graph hold check on every deletion path |
| Infer residency from storage location | component-specific current receipts; disable capability when any receipt expires |

## Privacy data map and minimisation

The control plane contains organisation identity, membership, routing,
entitlement, SSO configuration metadata, and receipt references only. The tenant
plane contains all dossier content. Delivery addresses are encrypted only while
needed and removed after acceptance or bounded expiry. Full extracted text,
filenames, prompts, and client identity never enter telemetry or ordinary audit
detail. Exports omit internal scanner payloads, secrets, prompts, and unrelated
dossiers. Minimal deletion tombstones contain opaque IDs, hashes, policy basis,
times, and actor IDs only.

## Open gates (blocking activation)

1. Named product, security, privacy/legal, and operations approvals.
2. DPA, TOMs, DPIA decision, ROPA, retention/legal-basis schedule, subprocessor
   register, SCC/TIA where needed, breach/DSAR/support procedures.
3. Exact EU infrastructure, KMS, processing, logging, support and backup
   receipts plus provider contracts and credentials.
4. External penetration test and remediation evidence.
5. Restore exercise, mobile/native parity, accessibility, security, pipeline,
   dependency, and exact-SHA release receipts.

Until all gates are current, confidential mode remains `disabled` or
`validation`, and uploads remain restricted to synthetic or properly
de-identified material.

