# GENESIS: JURIS Web

Professional web platform for building, reviewing and playing versioned legal simulations. The product combines a searchable case library, a visual Case Studio, practitioner feedback, targeted updates and a compliance-first international tax authoring model.

The hosted professional beta is available at <https://genesis-juris-web.maxim-hayan.chatgpt.site>.

## Product scope

- Trusted ChatGPT identity plus an optional local email/password credential, 15-minute email reset, offline recovery and professional profiles with opt-in communications controls.
- Paginated metadata library with server-side search/classification and lazy loading of immutable versioned manifests.
- Five mobile-parity library cases with their complete canonical stages/actions, deterministic events, clocks, deadlines, visible evidence/inbox state, resumable authoritative sessions, live spend/workload ledgers and verdict economics.
- Case Studio workspace with a default low-noise User view, an opt-in Developer view, reviewed AI prompt-to-scheme planning, deterministic graph materialisation, visual authoring, graph validation, draft submission and case/node feedback.
- Central publication and addressed release updates with immutable version lineage and read receipts.
- Moderated practitioner feedback tied to an exact case version and fingerprint.
- Tax / offshore tax-engineering template restricted to lawful planning, with implementation economics, source provenance and a named, structured publication attestation.

Bundled cases are labelled as professional beta material unless an independent verified practitioner review is attached to the exact submitted fingerprint. The product is an educational simulation platform, not legal or tax advice.

## Architecture

```mermaid
flowchart TD
    UI["Next.js / React UI"] --> META["Paginated catalogue metadata"]
    UI --> MANIFEST["Lazy immutable manifest"]
    UI --> API["Authenticated API routes"]
    API --> AUTH["ChatGPT identity / hashed local session"]
    API --> D1["Cloudflare D1"]
    UI --> PREVIEW["Deterministic browser preview"]
    UI --> AIPLAN["Reviewed AI authoring proposal"]
    AIPLAN --> API
    API --> SESSION["Authoritative canonical reducer"]
    SESSION --> D1
    API --> GATES["Integrity and publication gates"]
    GATES --> D1
```

The Cloudflare Worker adds CSP, HSTS and browser hardening headers while preserving public immutable caching and private/no-store APIs. Write routes enforce same-origin JSON mutations, bounded streaming bodies, server-side authorization and canonical SHA-256 fingerprints. See [the v16 architecture and trust boundaries](docs/ARCHITECTURE.md) and the [full v16 product, security and scalability audit](docs/AUDIT-V16.md).

### Core data model

- `users`: profile, locale, practice areas and explicit communication preferences.
- `local_accounts`, `auth_sessions`, `account_recovery_codes`, `password_reset_tokens`: email-bound password credentials, hashed opaque sessions, one-time offline recovery and hash-only email-reset proofs. Passwords and bearer secrets are never stored in plaintext.
- `auth_rate_limit_events`, `auth_audit_events`: credential-abuse throttling and a security-event trail; `studio_ai_leases` holds at most eight short-lived pseudonymous provider-capacity leases; `platform_secrets` holds server-only cryptographic material.
- `cases`: current catalogue metadata and current immutable content identity.
- `case_versions`: payload history, parent identity, studio fingerprint and publication record.
- `custom_cases`, `custom_case_grants`: owner envelope, privacy state and explicit restricted-case grants, listed through a bounded cursor rather than an unbounded workspace payload.
- `case_drafts`: per-user Studio workspace and independent review evidence.
- `play_sessions`, `play_events`: revisioned authoritative runtime state and idempotent decision history.
- `case_feedback`: exact-version feedback, context, severity, citations and moderation state.
- `case_subscriptions`, `updates`, `update_reads`: addressed release communication.
- `audit_events`: privileged publication and moderation trail.

Migrations live in `drizzle/`. A fresh database must apply them in numeric order.

## Integrity and governance

- Central publication deterministically compiles the normalized Studio graph on the server; client previews cannot replace the authoritative manifest.
- AI authoring is advisory: an authenticated, burst/hour/day-limited server route asks the OpenAI Responses API for a strict semantic proposal, converts it to the bounded Studio operation DSL with deterministic IDs/coordinates, and revalidates the resulting draft. A read-only candidate graph plus the complete, untruncated content of every authored field is shown before one atomic undoable apply. The raw source prompt stays in publication-stripped authoring history; only the separately reviewed publishable case context enters the case. It never executes model-authored code or silently replaces a graph. A normalized draft is capped at 900 KB inside the consistent 1 MB import/API envelope, while one provider analysis is separately capped at 128 KB and 6,000 output tokens. A tenant-wide eight-call D1 lease gate self-recovers after 60 seconds; audit rows retain only pseudonymous identity, outcome, latency and token counts, never prompt or graph content.
- Rules DSL v1 uses bounded declarative node runtime fields, action effects, guards and repeatability without authored code execution.
- A saved JSON artifact can carry `case-protection-v1`: the server binds its current-version code, parent code, Studio fingerprint and copy policy with HMAC-SHA256. Stable relationship IDs are included because they become playable option IDs. A locked parent makes all descendants locked; recipients receive inspection-only product access. This is tamper-evident lineage and authorization, not encryption or DRM.
- v15 JSON exports remain readable through an explicit legacy-fingerprint path. For a sealed export, the server also compares its new relationship-aware fingerprint with the authoritative stored payload before accepting it; the next save upgrades the artifact to the v16 fingerprint.
- Option IDs are globally unique; stages, clocks, timing and deadline routes are checked for ambiguity or dead ends.
- Current bundled content and retained v13 beta versions have stable fingerprints; pinned v13 sessions continue to resolve against their archived manifests.
- A case version can have only one child for a parent identity and only one root, preventing concurrent publication forks.
- Studio saves use optimistic fingerprint concurrency and fail stale writers with `409` rather than silently overwriting another tab.
- Elevated review labels require timestamped accepted review evidence bound to the exact Studio/playable artifacts and, for custom promotion, the selected workspace source draft.
- An `expert` label additionally requires an independent verified practitioner; the author, publisher and reviewer cannot collapse into the same identity.
- Tax cases are fail-closed to lawful/compliance scope, complete publication metadata and a named structured attestation bound to both fingerprints.
- `Private` custom cases are owner-only at the application API; owner notes use the exact custom-case ID and cannot be rerouted to a content-identical shared case. This is authorization, not encryption or DRM.
- Browser-only Studio persistence is available to signed-in users, identity-scoped and limited to local, unprotected, non-Private drafts. It is cleared on sign-out; anonymous, workspace, protected and Private artifacts are never cached in local storage.

## Local development

Requirements: Node.js `>=22.13.0`, Linux, `flock`, `curl` and GNU `timeout`.

```bash
npm run install:ci
npm run dev
```

The local runtime reads `.openai/hosting.json` for the D1 binding name. Production secrets belong in Sites runtime configuration, never in the repository. Copy `.env.example` only as a variable-name reference. `OPENAI_API_KEY` enables reviewed AI authoring, while `RESEND_API_KEY`, `GENESIS_RESET_FROM_EMAIL` and `GENESIS_PUBLIC_ORIGIN` enable transactional reset email. `GENESIS_OPENAI_MODEL` optionally overrides the default AI model; `GENESIS_AI_DAILY_REQUEST_LIMIT` sets the tenant-wide daily circuit breaker (default 500).

## Verification

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test
npm audit --omit=dev
git diff --check
```

`npm test` performs a production build and replays eleven authoritative mobile reference paths across all five bundled cases, including exact outcomes, clocks, economics, next-workday recovery, global repeatability, legacy session compatibility, tax/graph gates, request limits, D1 migrations and immutable lineage constraints.

## Authentication and authorization

Sites dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt` and `/callback`, including OAuth cookies and trusted identity-header injection. `app/chatgpt-auth.ts` exposes safe helpers for optional sign-in and same-origin return paths.

After a trusted ChatGPT identity confirms the account email once, `/account` can enroll a local password. The password policy is 10–128 characters with at least one uppercase letter, one digit and one special character. The database stores PBKDF2-HMAC-SHA256 output (600,000 iterations) and a per-account random salt, never the password. Local sessions, recovery codes and email-reset tokens are high-entropy opaque values stored only as SHA-256 hashes. When mail is configured, forgot-password and administrator-initiated recovery send the saved address a 15-minute single-use link; the administrator never sees a password or token. Completion revokes earlier sessions and tokens, rotates the offline recovery code and does not automatically sign the browser in. Generic responses prevent account enumeration. Trusted ChatGPT reset and the display-once offline code remain independent fallback paths.

The public catalogue is anonymous-compatible. Profiles, feedback, subscriptions and Studio submissions use server-side identity. Local identity can exercise the same email-based case ACL after enrollment proved by a trusted ChatGPT identity, but never confers platform-administrator status. Administration requires both the trusted ChatGPT identity source and the runtime `GENESIS_ADMIN_EMAILS` allowlist.

See [the local-authentication threat model and lifecycle](docs/AUTHENTICATION.md) for storage, recovery, deletion and operational limits.

## Deployment

This project is deployed through ChatGPT Sites. `.openai/hosting.json` declares the `DB` D1 binding. The release workflow validates and commits source, saves a Sites version, applies migrations and deploys that saved version to production.
