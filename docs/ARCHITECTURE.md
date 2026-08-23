# GENESIS: JURIS v16 architecture

This document records the v16 runtime and trust boundaries. It is intentionally implementation-oriented; product positioning remains in the root README.

## Catalogue and immutable content

`GET /api/catalog` returns paginated metadata only. Search and classification filters run in D1, and a cursor continues a stable case-ID traversal. The browser should request only the visible metadata page and must not preload every case payload.

The full playable manifest is loaded lazily from `GET /api/catalog/:caseId?version=x.y.z` when a user opens a case. Seed rows that carry the compact canonical-bundle pointer are resolved and fingerprint-verified on the server; the browser does not import that bundle into its initial application chunk. A published version is addressed by `(caseId, version, fingerprint)`, carries an ETag derived from its fingerprint and is immutable. The `cases.current_version` row is only the mutable pointer to the latest immutable `case_versions` record. Version-pinned responses can therefore use long-lived immutable caching; the current-version response is revalidated more frequently. A dynamically imported bundled copy remains only as an offline/5xx compatibility fallback; a `4xx` response is authoritative so removed, denied or integrity-failed content cannot be reopened locally.

## Execution modes and mobile parity

The deterministic browser engine remains useful for immediate Studio previews and retained non-canonical manifests. It is not an authoritative examination or audit record. Signed-in persisted play stays server-authoritative. If that session API is unavailable, a canonical library case can still run through a dynamically loaded copy of the same typed reducer and source-fingerprint-pinned mobile bundle; the interface marks this as a local, non-audit run rather than approximating the mobile rules.

Signed-in persisted play uses `play_sessions` and append-only `play_events`. For the five bundled cases, a typed server reducer executes the canonical mobile bundle directly: all 22 currently authored effect forms, compound conditions, deterministic decisions, async tasks, inbox/evidence visibility, deadline activation/misses, foreground time and global action repeatability share one runtime state. Only its presentation projection leaves the API; internal flags and decision rolls remain server-side. Every decision or explicit time advance uses an expected revision and an idempotent event ID. A stale revision returns `409` instead of silently overwriting another tab.

The TypeScript reducer is regression-pinned to eleven mobile reference paths (nine lifecycle traces plus both Logistics outcomes), including exact terminal stages, elapsed minutes and resource projections. Moving this authority into the Rust engine compiled to WASM remains a hardening option once the deployment toolchain can build and verify that artifact; v16 does not claim a Rust/WASM binary.

Real-time multi-author collaboration is intentionally out of scope. If introduced later, one coordination object per actively edited case can be added without moving ordinary catalogue or single-author traffic away from D1.

## Rules DSL v1

Rules are declarative JSON normalized by the same trusted validation path used for publication. No authored expression is passed to `eval` or executed as JavaScript.

- Node runtime fields control stage day/time, pressure, terminal outcome, deadline fallback, node budget and node duration.
- Link rules control action text, cost, duration, metric effects and repeatability.
- Guards compare `position`, `evidence`, `trust` or `exposure` using `gte`, `lte` or `eq` against a bounded numeric threshold.
- Limited actions require an explicit maximum-use count.
- The Studio compiler resolves the graph and DSL into `playable-scenario-v1`; the playable validator then checks references, timing, reachability and terminal paths.

Central publication always recompiles the normalized Studio draft on the server. A client-compiled preview is only an optional stale-preview check and is never persisted as authoritative content. The stored publication evidence binds the Studio fingerprint and server-generated playable fingerprint. Stable relationship IDs are normative because they compile into playable option IDs; renaming one therefore changes both artifact fingerprints and the case-protection code.

Exports created before v16 used a fingerprint that did not bind relationship IDs. The importer recognizes that legacy value only as a compatibility signal. A sealed legacy export must still resolve to the exact stored artifact, and the server recomputes the v16 fingerprint from its authoritative payload and compares it with the uploaded draft before granting access. This preserves existing exports without allowing an old seal to authorize a renamed playable option; all new saves use the v16 fingerprint.

Ordinary v15 workspace drafts upgrade on their next save. Submitted or accepted v15 review evidence remains intentionally bound to the old fingerprint and is not silently rebound: an operator must re-open and re-review that exact content under its v16 fingerprint before publication.

## AI-assisted prompt-to-scheme boundary

AI assists authoring; it is never the scenario runtime or publication authority. The browser sends an authenticated, same-origin request containing the prompt and current bounded Studio graph supplied by the author, plus its base fingerprint. The interface requires the author to de-identify both inputs; the product does not claim automatic redaction. The route requires a registered professional profile, applies tiered per-user and high shared-network limits, keeps the provider key server-side and calls the OpenAI Responses API with response storage disabled and a strict JSON Schema. A configurable tenant-wide daily circuit breaker defaults to 500 requests. Normalized drafts are capped at 900 KB inside the common 1 MB import/API envelope, but provider context has a separate 128 KB ceiling and a 6,000-output-token ceiling. D1 admits no more than eight concurrent tenant calls through 60-second leases that are deleted on completion and expire after a disconnected request. The audit trail stores only pseudonymous subjects, status, model, context byte count, latency and provider token counts; prompts and graph content are excluded. Central publication omits the duplicate client-compiled preview and recompiles from the draft.

The model returns semantic node/link intents and explicit assumptions, warnings or a clarification request. It cannot author executable code, delete nodes, remove relationships or silently replace the draft. Trusted code then:

1. verifies the response against the strict schema and bounded field limits;
2. assigns deterministic, collision-free IDs and graph coordinates;
3. converts semantic intents to the existing typed Studio operation DSL;
4. applies the operations to a temporary copy and runs the normal draft validator;
5. returns only the sanitized operation plan for human review.

The client derives a read-only candidate through the same final trust boundary used by Apply, shows its complete proposed scheme and every authored field without truncation, and only then enables **Apply reviewed changes**. Immediately before applying, the client recomputes the base fingerprint; a stale proposal is rejected. An accepted proposal becomes one revision in the existing undo/redo timeline. Up to 8,000 characters of the accepted source prompt are retained in bounded, non-public history chunks; the publishable premise is a separate bounded AI proposal that the author can edit in Studio. Raw source history and model/request/base/plan identifiers are deliberately stripped from publication. Provenance metadata is not server-signed; the case seal attests case lineage and content, not the claimed model invocation. The exact-command deterministic planner remains available when AI is unconfigured, unavailable, budget-limited or unsuitable. Model output is therefore a fallible drafting suggestion: legal rules, evidence, authorities, dates, tax conclusions and economic assumptions still require practitioner verification.

Studio opens in **User view**, which retains the complete authoring flow while suppressing internal IDs, fingerprints, protection seals, the exact-command DSL and detailed revision diagnostics. **Developer view** restores the full technical surface. The display mode is presentation-only and never alters the draft, lineage, compiler or publication gates.

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

Studio feedback carries the exact `customCaseId` together with case/version/fingerprint. The server rejects missing or ambiguous workspace identities and recomputes access for that exact envelope. `private_note` is accepted only when the caller owns that exact case and it is currently Private; a content-identical shared case can never receive the note by fingerprint collision.

Browser-only Studio persistence is a separate, fail-closed boundary. The application first resolves a signed-in identity, derives a one-way account scope and reads only a versioned envelope for that scope; anonymous sessions are never persisted. Only local, duplicable, unprotected and non-Private drafts may be written. Opening a workspace/protected/Private artifact, signing out or deleting the profile removes the scoped browser draft. Origin-wide keys from earlier releases are deleted without being read, preventing one account on a shared browser from inheriting another account's Studio draft.

Account deletion removes private account/workspace data and access records. An immutable version already published to the General Library, plus attribution embedded in that public editorial record, is not automatically rewritten; the product discloses that distinction and routes correction or pseudonymisation requests to the operator.

## Account credentials and recovery

Trusted ChatGPT identity remains the enrollment authority. A user can add a local password only while the trusted identity header is active; the registration email is taken from that header, not an editable form. This prevents an arbitrary signup from claiming an email that already owns cases or grants. Local sessions can then use the same normalized-email business ACL, while platform administration remains ChatGPT-source-only.

Passwords are validated at 10–128 Unicode characters with the requested uppercase/digit/special-character policy, derived with PBKDF2-HMAC-SHA256 at 600,000 iterations and a fresh random salt, and stored only as algorithm/salt/iteration/hash fields. Opaque session and recovery values are stored only as SHA-256 hashes. Credential routes require exact same-origin browser requests, bounded JSON and dual email/network rate limits; responses are private/no-store.

Transactional email is feature-gated behind server-only `RESEND_API_KEY`, `GENESIS_RESET_FROM_EMAIL` and an exact HTTPS `GENESIS_PUBLIC_ORIGIN`. When configured, forgot-password creates a 15-minute single-use opaque token, stores only its SHA-256 hash and sends the raw proof to the account's stored address. Consumption uses a unique per-attempt nonce in the atomic compare-and-swap batch, so concurrent attempts cannot both succeed even when their timestamps are identical. The public response is generic, and successful email reset revokes prior sessions/tokens, rotates the offline code and requires a fresh login. An administrator may trigger delivery but cannot see the token, choose another address, set the password or impersonate the account. The trusted ChatGPT identity and display-once offline code remain independent fallback proofs.

## Capacity envelope

For hundreds of cases and roughly 100 users, ordinary work stays below a single-region relational workload rather than becoming a compute-cluster problem:

- catalogue queries return indexed, paginated metadata and never hydrate all manifests;
- opening a case fetches one immutable version, cacheable by fingerprint/ETag;
- an authoritative decision loads one exact manifest and one compact session state, evaluates a bounded DSL and commits an idempotent event plus a compare-and-swap revision;
- custom-case lists use a 25-row `(updated_at,id)` cursor, page-scoped ACL/grant/profile queries and dedicated owner/visibility ordering indexes; only the requested page evaluates stored protection metadata;
- static assets and immutable public case versions are cacheable, while identity/workspace/session responses remain private and uncached.
- AI is invoked only while a registered practitioner explicitly analyses an authoring prompt, not during catalogue browsing or scenario play. A three-request-per-minute user burst gate precedes the hourly policy. Community, professional and enterprise profiles receive 5, 20 and 60 requests per hour respectively; a 1,000/hour shared-network allowance avoids penalising a normal office NAT, while the configurable tenant-wide daily circuit breaker bounds provider request count independently of user count. The eight-call tenant lease gate bounds simultaneous upstream work, and the 128 KB / 6,000-token request ceilings bound each call. A privacy-preserving HMAC subject is sent as the provider safety identifier; the raw account email is never sent for that purpose, browser cancellation propagates upstream, and token/latency telemetry contains no authored content.

The stated hundred-user pilot is an architecture target, not a completed load-test result. Its controlled operating envelope is approximately 500 cases, 100 registered users, 25 simultaneously active editors, ordinary mutations below 10/second and no more than eight simultaneous AI provider calls. Interactive Studio authoring should remain near 100 nodes / 250 relations / 128 KB until field telemetry validates larger graphs; the 200-node / 500-relation / 900 KB limit is an import and storage safety envelope, not a responsiveness promise.

Before a broader launch, run a Worker+D1 load test and add D1/query latency, conflict, provider-capacity and mail-delivery telemetry. If measured load outgrows the pilot envelope, the next steps are denormalised custom-case list metadata, paginated moderation queues, read-cache warming for popular manifests, archival/partitioning of old play events, bucketed AI rate/token accounting and one coordination object per actively co-edited case. The complete release conditions are tracked in [the v16 audit](AUDIT-V16.md).

## Tax and offshore publication gate

Tax/offshore classification is fail-closed to lawful/compliance use, a legal-as-of date and HTTPS source provenance. Publication additionally requires `tax-publication-attestation-v1` containing:

- the named attributed reviewer and review timestamp;
- the exact legal-as-of date and normalized source count;
- a substantive publication-facing note;
- explicit confirmations for lawful purpose, compliance-only scope, legal currency, source authority, anti-abuse rules, reporting obligations and non-facilitation of evasion;
- the exact Studio and playable fingerprints.

Studio also stores a bounded `tax-economics-v1` estimate: one-time implementation cost, recurring annual cost, annual gross tax benefit, horizon, discount rate, currency and authored assumptions. It deterministically derives annual net benefit, ROI, simple payback and discounted NPV; values are estimates, not promises or tax conclusions. Node budgets and durations remain available for attributing implementation cost and effort to the graph, while relationship-level cost/time can override a transition.

The attestation is normalized and stored with both the immutable case-version payload and the privileged audit event. A Boolean or an attestation for another artifact cannot pass the gate. Elevated review labels separately require an accepted, timestamped moderation record for the exact Studio fingerprint and, for custom-case promotion, the exact source draft ID inside the selected workspace envelope. Reviewer attribution is derived from that record; an expert label requires an independent verified practitioner.

## HTTP boundary

The Worker preserves route cache semantics and adds CSP, HSTS on HTTPS, MIME sniffing protection, referrer policy, opener isolation, framing denial and a restrictive permissions policy. CSP permits the inline React hydration and inline graph-node positioning used by the current Vinext application, but blocks third-party scripts, plugins, frames, cross-origin connections and `eval`.
