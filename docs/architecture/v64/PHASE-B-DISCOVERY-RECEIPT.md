# V64 Phase B discovery and recovery receipt

Status: **isolated implementation permitted; merge, release, deployment, and confidential activation blocked**

Recorded at: `2026-09-02T13:58:50Z`

Repository: `GenesisSocietyEngine/Genesis-AI-Juris`

Pull request: `#43`

## Source and recovery identity

- Development base: `c088200138332cd212b87e266746ea85b53a2f77`.
- Instruction-only predecessor: `6feb611b70a79f41bc87e25a6d469490cf8ba71c`.
- Amended instruction head and recovery parent: `fef5a27fd86d4978c522adb0e5f1526d00c9da66`.
- Amended instruction tree: `b4d6bb60abb2b4de2722a923734b2cac3501d3d6`.
- Existing PR branch: `codex/v64-phase-b-tenant-foundation`.
- `origin/main` at recovery: `c088200138332cd212b87e266746ea85b53a2f77`.

The recorded B0 commit `f71848f527fe7bebb3f7339a32673b37b443e13a`
and the later reported commits beginning `7a971f4`, `7384945`, `c34500f`, and
`8fc5797` are not reachable from GitHub, local refs, reflogs, worktrees, or
dangling commit objects. The original diffs are unavailable. This recovery is
therefore an attributable reconstruction from the frozen contracts, the PR
completion receipt, and repository evidence. No exact-SHA match is claimed.

## Frozen inputs read in full

| Frozen input | Git blob |
|---|---|
| `contracts/confidential-document-policy.v1.schema.json` | `db3ba14e2c9d8701de813ff29540372d31d55354` |
| `contracts/organization-contract.v1.schema.json` | `76d6fae8a443348b282f0499e59ce73fc1780d3d` |
| `contracts/tenant-resource-manifest.v1.schema.json` | `dd147cbd3d7ef3279b05cc3f19100c1f148b8858` |
| `docs/architecture/v64/ADR-001-SECURITY-BOUNDARIES.md` | `e23e5608349adfc809ca4af91dc518f1d8fb99f9` |
| `docs/architecture/v64/CONTRACT-FREEZE.md` | `a15858c40f9f6ecfe9eabe833c114235b17ee0fb` |
| `docs/architecture/v64/THREAT-MODEL-AND-DATA-FLOW.md` | `35d5b19a1122b815325c0e1349950889ebdca56d` |

These files remain unchanged. Any contract amendment requires a new ADR,
compatibility analysis, security review, and explicit product-owner approval.

## Contract-to-code discovery matrix

| Phase B concern | Existing compatible touchpoints | Recovery action |
|---|---|---|
| Identity and sessions | `app/chatgpt-auth.ts`, `app/local-auth.ts`, `app/auth-crypto.ts`, `app/auth-http.ts` | Preserve existing identity precedence and add tenant/version binding without treating email or OIDC UI claims as authority. |
| Server authorization | `app/server-authorization.ts`, API route guards | Add one typed deny-by-default tenant policy decision point; platform administration remains separate and has no routine dossier access. |
| Persistence and migration | `db/schema.ts`, `drizzle/0000` through `0010` | Add control-plane storage without assigning or re-keying legacy rows. Test against the actual v61 and v62 candidate chains before accepting a migration number or fingerprint. |
| Revision and audit | `app/studio-revisions.ts`, `audit_events`, `auth_audit_events` | Preserve CAS/lineage. Use a new privacy-safe append-only security envelope; legacy audit tables are not confidential receipt storage. |
| Rust authority | `crates/juris-core`, `crates/juris-mobile-bridge`, `crates/juris-mobile-ffi` | Preserve all canonical case/runtime semantics; Rust does not become a second authorization engine. |
| Flutter persistence | `game_save_store.dart`, `studio_draft_store.dart`, runtime repositories | Add explicit organisation context and clear every tenant-scoped cache on context or authority invalidation. |
| Release gates | `.github/workflows/{ci,mobile-ui,android-native,ios-native}.yml` | Preserve existing gates. Exact-head web/security/parity evidence remains additionally required. |

## Baseline and architecture discrepancies

Development ancestry is authoritative at `c088200...`. Production identity is
not. Repository evidence records Site 63 / marker v61, while the approved-line
claim records Site 69 / v62 at web SHA
`6019e47346a2bf719a09dc1d874a2fc807f99598`. No production identity, rollback
candidate, deployment health, or observability claim is selected silently.
Until an authorized read-only receipt reconciles the live URL, Site version,
marker, deployment, source SHA, and health, this remains
`unverified_external_dependency` and blocks ready-for-merge, merge, release,
deployment, and confidential activation.

The exact PR base contains web migrations only through `0010`. The documented
v61 line already uses `0011_operational_events`, and the v62 candidate freezes
`0012` through `0015`. A recovered Phase B migration named `0011` would collide
with that chain and is rejected. The exact base also lacks the real v62
dossier/document aggregate schema required for B2 tenant binding. Parallel
placeholder aggregates must not be invented. B2 and final acceptance remain
blocked until the authorized baseline is reconciled or explicitly amended.

The Phase B lifecycle text includes an internal `closing` transition while the
frozen public `organization-contract.v1` enum does not. The frozen schema will
not be edited or silently reinterpreted. Any externally visible `closing` state
requires an approved contract-version/ADR decision.

## Safety boundary

No production resource, D1/R2 database, KMS/Entra configuration, secret, Site
version, deployment, app-store distribution, or real client data was read or
mutated for this receipt. All implementation fixtures must remain local,
deterministic, synthetic, and de-identified.

> Confidential document mode is not active. Do not upload privileged,
> client-identifying, or live production documents. Use only synthetic or
> properly de-identified material.
