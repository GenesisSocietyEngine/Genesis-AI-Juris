# GENESIS: JURIS v14 architecture

This document records the v14 runtime and trust boundaries. It is intentionally implementation-oriented; product positioning remains in the root README.

## Catalogue and immutable content

`GET /api/catalog` returns paginated metadata only. Search and classification filters run in D1, and a cursor continues a stable case-ID traversal. The browser should request only the visible metadata page and must not preload every case payload.

The full playable manifest is loaded lazily from `GET /api/catalog/:caseId?version=x.y.z` when a user opens a case. Seed rows that carry the compact canonical-bundle pointer are resolved and fingerprint-verified on the server; the browser does not import that bundle into its initial application chunk. A published version is addressed by `(caseId, version, fingerprint)`, carries an ETag derived from its fingerprint and is immutable. The `cases.current_version` row is only the mutable pointer to the latest immutable `case_versions` record. Version-pinned responses can therefore use long-lived immutable caching; the current-version response is revalidated more frequently. A dynamically imported bundled copy remains only as an offline/5xx compatibility fallback; a `4xx` response is authoritative so removed, denied or integrity-failed content cannot be reopened locally.

## Execution modes and mobile parity

The deterministic browser engine remains useful for immediate Studio previews and retained non-canonical manifests. It is not an authoritative examination or audit record. Signed-in persisted play stays server-authoritative. If that session API is unavailable, a canonical library case can still run through a dynamically loaded copy of the same typed reducer and source-fingerprint-pinned mobile bundle; the interface marks this as a local, non-audit run rather than approximating the mobile rules.

Signed-in persisted play uses `play_sessions` and append-only `play_events`. For the five bundled cases, a typed server reducer executes the canonical mobile bundle directly: all 22 currently authored effect forms, compound conditions, deterministic decisions, async tasks, inbox/evidence visibility, deadline activation/misses, foreground time and global action repeatability share one runtime state. Only its presentation projection leaves the API; internal flags and decision rolls remain server-side. Every decision or explicit time advance uses an expected revision and an idempotent event ID. A stale revision returns `409` instead of silently overwriting another tab.

The TypeScript reducer is regression-pinned to eleven mobile reference paths (nine lifecycle traces plus both Logistics outcomes), including exact terminal stages, elapsed minutes and resource projections. Moving this authority into the Rust engine compiled to WASM remains a hardening option once the deployment toolchain can build and verify that artifact; v14 does not claim a Rust/WASM binary.

Real-time multi-author collaboration is intentionally out of scope. If introduced later, one coordination object per actively edited case can be added without moving ordinary catalogue or single-author traffic away from D1.

## Rules DSL v1

Rules are declarative JSON normalized by the same trusted validation path used for publication. No authored expression is passed to `eval` or executed as JavaScript.

- Node runtime fields control stage day/time, pressure, terminal outcome and deadline fallback.
- Link rules control action text, cost, duration, metric effects and repeatability.
- Guards compare `position`, `evidence`, `trust` or `exposure` using `gte`, `lte` or `eq` against a bounded numeric threshold.
- Limited actions require an explicit maximum-use count.
- The Studio compiler resolves the graph and DSL into `playable-scenario-v1`; the playable validator then checks references, timing, reachability and terminal paths.

Central publication always recompiles the normalized Studio draft on the server. A client-compiled preview is only an optional stale-preview check and is never persisted as authoritative content. The stored publication evidence binds the Studio fingerprint and server-generated playable fingerprint.

## Optimistic concurrency

Studio saves use content fingerprints as compare-and-swap tokens:

- `expectedFingerprint` identifies the exact draft being replaced.
- `baseFingerprint` identifies the current custom-case envelope from which a child version was created.
- stale or missing tokens fail closed with `409` and `code: "stale_draft"` plus the current server identity.
- envelope, draft and audit writes are committed as one D1 batch; accepted and published versions remain immutable.

Clients must preserve the last server-returned fingerprints and stop autosaving after a stale response until the user reloads or explicitly resolves the conflict.

## JSON lineage and copy policy

Workspace saves replace client-supplied lineage codes with server-generated `case-protection-v1` metadata:

- `parentCode` identifies the exact protected parent, or is `null` for a root;
- `currentCode` is SHA-256 over the canonical case/version, Studio fingerprint, full parent case/version/fingerprint/code identity and copy policy;
- `seal` is HMAC-SHA256 over that canonical binding and current code, using a 256-bit server-only key from `platform_secrets`;
- `copyPolicy` is either `fork_allowed` or `lineage_locked` and agrees with `copyProtected`.

The server resolves the exact persisted parent and verifies its seal before accepting a child. `lineage_locked` is inherited and cannot be downgraded by editing JSON. Import verifies a sealed artifact against its exact persisted version and access grant; a non-owner recipient of a locked case receives inspection-only Studio access, with save/export/duplicate actions disabled. Central publication recompiles the draft but carries the verified lineage binding into both stored artifacts.

This protects integrity and enforces product-level copying policy; it is not confidentiality encryption or DRM. Anyone authorised to render a case can still photograph, transcribe or independently recreate what they see.

## Access-control and confidentiality boundary

| Case mode | Application access |
| --- | --- |
| General Library | Public published manifest |
| Restricted custom | Owner, platform administrator and explicitly granted users |
| Private custom | Owner only through the product API; grants are revoked and administration receives not-found |

`Private` is an application-level authorization policy, not encryption, DRM or zero-knowledge storage. Draft JSON is stored in D1, an authorized browser receives the full payload, and infrastructure/database operators may be able to access stored data and backups. Users must not place privileged, client-identifiable or otherwise unsuitable secrets in a case. A future high-confidentiality tier would require separate tenant keys, encrypted payload design and an explicit key-recovery policy.

Browser-only Studio persistence is a separate, fail-closed boundary. The application first resolves a signed-in identity, derives a one-way account scope and reads only a versioned envelope for that scope; anonymous sessions are never persisted. Only local, duplicable, unprotected and non-Private drafts may be written. Opening a workspace/protected/Private artifact, signing out or deleting the profile removes the scoped browser draft. Origin-wide keys from earlier releases are deleted without being read, preventing one account on a shared browser from inheriting another account's Studio draft.

## Account credentials and recovery

Trusted ChatGPT identity remains the enrollment authority. A user can add a local password only while the trusted identity header is active; the registration email is taken from that header, not an editable form. This prevents an arbitrary signup from claiming an email that already owns cases or grants. Local sessions can then use the same normalized-email business ACL, while platform administration remains ChatGPT-source-only.

Passwords are validated at 10–128 Unicode characters with the requested uppercase/digit/special-character policy, derived with PBKDF2-HMAC-SHA256 at 600,000 iterations and a fresh random salt, and stored only as algorithm/salt/iteration/hash fields. Opaque session and recovery values are stored only as SHA-256 hashes. Credential routes require exact same-origin browser requests, bounded JSON and dual email/network rate limits; responses are private/no-store.

No transactional email binding is present in this deployment. The safe forgot-password paths are therefore a display-once, high-entropy offline recovery code or re-verification through the trusted ChatGPT identity. Recovery rotates the offline code and revokes previous local sessions. A hashed, expiring, single-use reset-token table is reserved for a future mail provider, but the application does not pretend that email delivery exists.

## Capacity envelope

For hundreds of cases and roughly 100 users, ordinary work stays below a single-region relational workload rather than becoming a compute-cluster problem:

- catalogue queries return indexed, paginated metadata and never hydrate all manifests;
- opening a case fetches one immutable version, cacheable by fingerprint/ETag;
- an authoritative decision loads one exact manifest and one compact session state, evaluates a bounded DSL and commits an idempotent event plus a compare-and-swap revision;
- custom-case lists apply ACL predicates in SQL and calculate protection metadata without per-row API queries;
- static assets and immutable public case versions are cacheable, while identity/workspace/session responses remain private and uncached.

If measured load later outgrows this envelope, the next steps are read-cache warming for popular manifests, archival/partitioning of old play events, D1 query/latency alerts, and one coordination object per actively co-edited case. None is required merely to support the stated hundred-user pilot.

## Tax and offshore publication gate

Tax/offshore classification is fail-closed to lawful/compliance use, a legal-as-of date and HTTPS source provenance. Publication additionally requires `tax-publication-attestation-v1` containing:

- the named attributed reviewer and review timestamp;
- the exact legal-as-of date and normalized source count;
- a substantive publication-facing note;
- explicit confirmations for lawful purpose, compliance-only scope, legal currency, source authority, anti-abuse rules, reporting obligations and non-facilitation of evasion;
- the exact Studio and playable fingerprints.

The attestation is normalized and stored with both the immutable case-version payload and the privileged audit event. A Boolean or an attestation for another artifact cannot pass the gate. Elevated review labels separately require an accepted, timestamped moderation record for the exact Studio fingerprint; an expert label requires an independent verified practitioner.

## HTTP boundary

The Worker preserves route cache semantics and adds CSP, HSTS on HTTPS, MIME sniffing protection, referrer policy, opener isolation, framing denial and a restrictive permissions policy. CSP permits the inline React hydration and inline graph-node positioning used by the current Vinext application, but blocks third-party scripts, plugins, frames, cross-origin connections and `eval`.
