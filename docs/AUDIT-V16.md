# GENESIS: JURIS v16 full product and architecture audit

Audit date: 23 August 2026. Scope: the web product, Case Studio, AI-assisted prompt-to-scheme flow, authentication and recovery, administrator boundary, custom-case access control, case integrity, tax/offshore authoring, persistence, scaling, accessibility, localisation and release controls.

## Executive conclusion

v16 is suitable for a controlled professional beta with several hundred catalogue/workspace cases and approximately 100 registered users. It is not represented as an unlimited multi-tenant SaaS, a real-time collaborative editor, an encrypted legal-document vault or a substitute for practitioner review.

The release audit found no unresolved Critical security or integrity defect. High-severity findings identified during review were corrected before release: mobile graph-coordinate drift, ambiguous AI change review, and excessive synchronous work in the large-graph Studio path. The remaining findings are operational or scale-hardening work and are recorded below rather than hidden behind a generic “production ready” label.

No browser/device visual session was performed as part of this code audit. Responsive behaviour, focus restoration and accessible names are covered by source and regression tests, but the published build still needs an operator acceptance pass on representative desktop and mobile browsers.

## Product and UX maturity

### User view

Studio opens in **User view** by default. The main path is intentionally short: describe the case, review the proposed scheme, edit the graph, save or submit. Technical IDs, fingerprints, seals, the exact-command DSL and detailed revision diagnostics are hidden. Optional metadata, access, versioning and tax assumptions are grouped in a collapsed **Case settings** section; validation blockers link back to the relevant setting.

Secondary commands are grouped under **More actions**. **New draft** creates an actually empty local draft and clears prompt, history, selection, AI proposal and workspace status. Loading the worked example or tax template is explicit and asks before replacing existing work.

### Developer view

Developer view exposes the same draft and rules with technical identity, protection state, operation history, deterministic prompt commands and detailed diagnostics. Changing view never changes case content, access, fingerprints, compiler results or publication rules.

### Graph editing

- Links can be selected on the graph or in the relation list and removed with Delete/Backspace or the visible delete button.
- Keyboard focus returns to the relation status after deletion.
- Graph movement translates pointer coordinates through the active zoom; User view no longer applies an automatic illegible mobile zoom.
- Fit, 100% and Center are explicit controls.
- Relation rows are paginated and a row can focus its object on the graph.
- Inspection-only protected cases remove editing controls from pointer and keyboard interaction.
- Node budget and duration are editable and compile into the playable runtime; an explicit relation cost/duration overrides the node default for that transition.
- After-hours select options use dark readable text on a white native-option background.

The interface is bilingual, but legal/tax authored content is not machine-translated. Final terminology still requires a native-language editorial pass.

## AI prompt-to-scheme trust boundary

AI is an optional authoring assistant, not the player runtime, publication authority or legal verifier.

1. A registered author explicitly sends a de-identified prompt plus the current bounded graph to a same-origin server route.
2. The provider key stays server-side. Responses use strict structured output, response storage is disabled, and the request has independent input/output and time ceilings.
3. Trusted code validates the semantic proposal, assigns deterministic IDs and positions, converts it to the typed Studio operation DSL and applies it to a temporary copy.
4. The same final validation boundary used by Apply creates a read-only candidate scheme.
5. User view shows the old object, proposed value and relation endpoints without exposing technical IDs. Every authored field is displayed in full, including assumptions and warnings.
6. Apply is one atomic, undoable revision and is refused when the live base fingerprint has changed.

Model output cannot execute code, delete existing objects, bypass lineage or silently publish a case. Raw accepted source text is retained only in bounded private authoring history; the publishable case premise is separate. Publication strips AI request/model identifiers and private history. Authors must still verify law, evidence, dates, sources, tax analysis and economics.

Production AI remains feature-gated until `OPENAI_API_KEY` is configured in the hosted secret store. A deterministic local planner remains available and is labelled as such.

## Authentication, administration and password recovery

- Initial local-password enrollment requires a trusted ChatGPT identity and uses that verified email; an arbitrary visitor cannot claim another user's address.
- Passwords must contain 10–128 characters, an uppercase letter, a digit and a special character. The database stores only PBKDF2-HMAC-SHA256 output using 600,000 iterations and a per-account random salt.
- Local sessions, recovery codes and email reset proofs are high-entropy opaque values stored only as SHA-256 hashes.
- Public reset responses are generic. Email links are single-use and expire after 15 minutes; successful completion revokes old sessions and reset tokens and rotates the offline recovery code.
- An administrator can request delivery only to the address already stored for the account. The administrator cannot choose another recipient, view the token, set the new password or impersonate the user.
- Platform-administrator status requires both a trusted ChatGPT identity source and membership in the server-side `GENESIS_ADMIN_EMAILS` allowlist. A matching local-password email is not sufficient.

Transactional reset delivery remains feature-gated until `RESEND_API_KEY`, `GENESIS_RESET_FROM_EMAIL` and the exact HTTPS public origin are configured as hosted secrets.

## Case library, custom cases and protected rules

The library stores paginated metadata separately from immutable full manifests. A published identity is the exact `(caseId, version, fingerprint)` tuple; central publication recompiles the normalized graph and Rules DSL on the server. Client previews never become authoritative content.

Custom workspace cases have three product-level access states:

| State | Visible to |
| --- | --- |
| General Library | Public readers of the immutable published version |
| Restricted custom | Owner, platform administrator and explicitly granted registered users |
| Private custom | Owner only through product APIs |

Private/restricted is application authorization, not database encryption, zero knowledge or DRM. An authorised browser receives the payload, and users are warned not to enter privileged or client-identifiable material.

Rules are bounded declarative JSON, never evaluated authored JavaScript. The server normalizes and compiles them, checks references, reachability, timing, deadlines, terminal outcomes, costs, effects, guards and repeatability, then fingerprints the exact normalized result. Relationship IDs are included because they become playable option IDs.

Protected exports carry the parent code, current-version code and an HMAC-SHA256 seal. A locked parent makes every descendant locked, and recipients receive inspection-only access. This makes lineage tamper-evident and enforces product copying policy; it cannot prevent screenshots, transcription or independent recreation. v15 artifacts have an explicit compatibility path, but submitted/accepted v15 review evidence is never silently upgraded and must be re-reviewed against its v16 fingerprint.

## Tax and offshore tax-engineering scope

Tax authoring is fail-closed to lawful planning and compliance. It requires a legal-as-of date, HTTPS authority sources, anti-abuse/reporting confirmations and a named publication attestation bound to both Studio and playable fingerprints. The author can model one-time implementation cost, recurring cost, annual gross benefit, horizon, discount rate and assumptions. Studio derives annual net benefit, ROI, simple payback and discounted NPV.

These are scenario estimates, not promised savings or tax advice. The model does not offer evasion, concealment or source-free conclusions; publication requires human verification of current law, treaty access, substance, beneficial ownership, reporting and anti-abuse rules.

## Capacity assessment

The stated pilot does not require distributed scenario computation. Browsing and immutable manifests are read-mostly; graph editing and immediate preview run in the browser; authoritative play decisions and saves use bounded D1 transactions.

| Workload | Where it runs | Pilot control |
| --- | --- | --- |
| Catalogue browsing | CDN/Worker + indexed D1 metadata | Cursor pages; manifests loaded only when opened |
| Studio editing | Browser | Bounded graph/draft; deferred derived work and limited relation choices for large graphs |
| Draft save/submit | Worker + D1 | Exact fingerprint compare-and-swap; atomic draft/envelope/audit batch |
| Scenario decision | Worker + D1 | One immutable manifest, one compact session, idempotent event and revision CAS |
| AI authoring | Worker + external model | Auth/profile gates, burst/hour/day limits, 128 KB context, 6,000 output tokens and eight concurrent tenant leases |

The safe beta target is hundreds of cases, about 100 registered users, up to roughly 25 simultaneously active editors, ordinary mutation rates below 10/second and no more than eight simultaneous provider calls. Large imported drafts remain storable, but interactive authoring should stay near 100 nodes / 250 relations / 128 KB until field telemetry proves the larger envelope responsive.

## Residual findings and release conditions

### Medium — validate the capacity model under real traffic

No Worker+D1 load run has yet simulated 100 users. Before a broader launch, run a staged test with 500 cases, 100 signed-in users, 25 active editors, eight mocked AI calls and 10,000 play events. Suggested gates: D1 reads p95 below 250 ms, writes p95 below 250 ms, 5xx below 1%, expected CAS conflicts below 2%, and AI capacity 429 below 2% under the documented workload.

### Medium — database query and lifecycle hardening

The custom-case page still derives copy-protection catalogue metadata from the stored JSON for at most 25 rows. Denormalise that flag before catalogues reach thousands of large custom drafts. Moderation queues currently return a bounded recent set; add keyset pagination plus open-status-first views before unresolved submissions can exceed that window. Add scheduled expiry/archival for old play events, auth sessions, reset proofs, rate events and operational audit rows according to the adopted retention policy.

### Medium — AI budget and subgraph ergonomics

The provider ceiling is safe per request and concurrency is bounded, but the client currently sends the current whole graph; the “smaller branch” recovery path needs a real selected-subgraph control. Before cost-sensitive scale, add daily input/output token buckets rather than only request counts and replace append-only rate events with bucketed counters.

### Medium — observability and bundle budget

Add dashboards/alerts for D1 latency, AI latency/tokens/capacity, 409 conflict rate, mail delivery and publication failures. Split the large application surface into additional Studio, Community and Admin chunks and enforce total initial gzip budgets in CI. Current static checks guard the largest raw chunk but do not replace field performance measurements.

### Medium — visual and assistive-technology acceptance

Run the deployed build on current Chrome, Safari and Firefox desktop plus iOS/Android widths, at 200% zoom, keyboard-only and with at least one screen reader. Confirm graph dragging, native select contrast, relation deletion/focus, collapsed settings, AI review and both language modes. This audit does not claim that session has happened.

### Low — legacy and namespace housekeeping

Backfill legacy custom-case timestamps into one canonical UTC format before a large historical import. In a future seal revision, bind the exact workspace envelope ID to remove the theoretical ambiguity between a published and custom artifact that intentionally shares all public identity fields.

### External review

Application controls do not replace independent privacy, data-protection, legal-practice, tax-marketing and records-retention review for each launch jurisdiction.

## Verification evidence

The release gate consists of:

```text
npx tsc --noEmit --incremental false
npm run lint
npm test
npm audit --omit=dev
git diff --check
```

The final pre-deployment gate passed: production build, TypeScript, ESLint, `git diff --check`, 103/103 automated tests and `npm audit --omit=dev` with zero reported vulnerabilities. The suite covers canonical case paths, compiler/runtime parity, auth and recovery, privacy/ACL, optimistic concurrency, case seals and legacy compatibility, publication/review evidence, AI schema/application trust boundaries, tax gates/economics, request budgets, migration indexes, Studio reset/link/zoom/focus behaviour and scalability guards. The deployed source revision is recorded in the checkpoint/deployment history.

## Decision

**Release decision: controlled professional beta — approved with the operational conditions above.** Do not market v16 as high-confidentiality storage, independently validated legal content, unlimited large-graph authoring or proven 100-user concurrency until the corresponding external review, visual acceptance and load evidence exist.
