# P1 organizations and ERP implementation

Status: implementation candidate, not released. Date: 2026-09-05.

## Provenance and scope

Base: `5a5ce9b1afc3130c6c1dc55ccdc967902033f929`, tree
`146ee127e5740b2766f57ffb21ef81621e0f1d25`. This retains the P0 recovery and
the subsequent PR #48 web/mobile readability changes.

Selectively ported from PR #43 head
`2f6e545b70a39c3fda4aa3b71ca380799e7c52a8`: `tenant-foundation.ts`,
`tenant-authorization.ts`, `entra-oidc.ts`, the Phase B policy manifest, the
foundation tests, and Flutter organization-context model/tests. Only the
foundation test's contract path was adapted to the recovered root layout.
PR #43 remains a historical reference; its migrations, old lock and app layout
are not merged. The new production integration is in `organization-store.ts`
and the existing dossier route composition.

## Implemented behavior

- Stable persisted actor IDs identify organization memberships. Profile company
  text and email domains never confer organization rights.
- Organization roles and dossier roles are separate. An owner/admin cannot
  read another member's case without an explicit active dossier participant.
- Personal organizations preserve the existing explicit sharing graph. New
  organizations contain only their creating owner until a bound invite is accepted.
- Invitations are bound to one existing actor ID, expire after 24 hours, store
  only a token digest and can be accepted once. Their original owner and
  organization revisions must still match at commit time. No invitation is emailed.
- Owner membership changes use compare-and-swap revisions. Suspension blocks
  dossier access; restoration increments the revision, invalidating old selectors.
  Removed memberships are terminal; owner transfer/recovery is not implemented.
- Suspension, resumption and closure require an owner request and a different
  current administrator's approval. The public enum remains
  `provisioning / active / suspended / closed`; no `closing` state is added.
- Organization mutations produce append-only chained SHA-256 receipts. These
  receipts are local integrity records, not KMS-signed compliance attestations.
- Every dossier route resolves current organization membership and immutable
  dossier scope before object access. Lists and cursors are scoped to actor,
  organization and revisions. Unknown/foreign object requests receive private 404s.
- Existing composite dossier foreign keys bind documents, immutable versions,
  assertions, source anchors, jobs, packages, snapshots, outputs and audit to the
  immutable organization root. Storage locators are obtained only after this check.
- Every authoritative dossier D1 batch rechecks current organization and membership
  revisions inside the transaction, including batches after slow R2/AI work.
  A revoked upload cannot commit document metadata, a new dossier revision or a
  success receipt. Existing cleanup handles orphan/provisional reservations.
- Downloads recheck authorization after object reads before returning bytes.
  Responses remain `private, no-store`; raw R2 locators are not exposed.
- `/organizations` provides creation, selection, invitations, members, access
  suspension/restoration and independent lifecycle approval with EN/RU copy.
  `/matters` mounts private UI only after server-resolved organization selection.
  Switching performs full navigation, clearing closures and pending prompt state;
  per-tab headers prevent another tab's cookie selection changing a live request.
- Flutter has an allowlisted Organizations entry that opens the existing secure
  web workspace. It passes no tokens, dossier identifiers or private data to native
  storage. This is a browser handoff, not native dossier synchronization.

## Migration 0019

Apply the existing journal in order, then `0019_p1_organization_scope.sql`.
Never reuse PR #43's colliding 0016 or alter the frozen 0012–0018 history.

The reserved `dossiers.organisation_id` column remains NULL under its frozen
contract. A normalized `dossier_organization_bindings` table supplies the total,
immutable tenant mapping. Deferred foreign keys plus commitments permit only
atomic binding/root creation; a new unbound dossier cannot commit. Existing
owners and explicit participants are backfilled without changing any dossier,
participant, audit event or revision receipt. The migration uses the existing
Sites-safe trigger statement format.

Upgrade evidence checks byte-equivalent row values, foreign-key integrity,
absence of domain-derived grants, denied rebinding/deletion and denied unbound
creation. Fresh D1 evidence runs all 20 migrations against the real route harness.
No production migration has been applied. Before rollout, inspect the real
database's user/participant consistency and take the platform-supported backup;
an inconsistent upgrade must stop rather than guess ownership. Because this is
additive guarded metadata, repair forward; do not drop audit/binding tables to
roll back a populated release.

## Verification and reproduction

The existing pinned CI remains authoritative for release checks.

```sh
npm run install:ci
npm run typecheck
npm run parity:lock
npm run lint
npm test
```

The new `tests/p1-organization-erp.test.ts` bundles the real application routes.
Only Cloudflare bindings and Next request transport are adapted to isolated
Miniflare D1/R2 and synthetic trusted test identities. It does not replace the
authorization engine or simulate successful persistence. All journal migrations
run in order. `tests/dossier-persistence.test.ts` separately verifies populated
upgrade behavior and the established trigger-format guards.

Ten new route journeys include the five ERP journeys, foreign reads/mutations,
mid-download revocation, mid-upload revocation, independently approved lifecycle
changes and stale invitations, scoped cursors, CSRF, and feature-off responses.
The ERP simulation calls the actual play-session start/decision API to completion
before its exact receipt is linked. The resulting report is a 14-page PDF in the
observed fixture run; current source versions and the scenario identity are
verified in the exported snapshot. Random IDs and timestamps intentionally make
artifact hashes vary per run.

Generated evidence is uploaded by the web diagnostics CI step:
`.artifacts/p1-route-tests/erp-decision-report.pdf` and `erp-snapshot.json`.
Do not treat an exported draft snapshot as evidence that the initial readiness
record already contained its subsequent output approval; approval is a later
append-only event, checked separately.

Local validation: production build, strict TypeScript, contract lock, lint,
all ten new API journeys and the populated migration test pass. After the
anonymous sign-in fallback was added, the complete web suite passed 544/544.
Local Node is 24.19.0; hosted CI uses pinned 22.23.2.

The P1 core head `f74ce2f0384e9ae19a9f83a3086cbbe24018e76f` passed all five
candidate workflows: Root Web and PDF, Rust CI, Flutter Mobile UI, Android
Native FFI and iOS Native FFI. The Root workflow reported 543/543 tests before
the follow-up fallback test, 47 PDFs / 702 pages / 702 PNGs, and the unchanged
55-PNG visual baseline. Do not inherit those receipts after another code change;
read the exact-head checks from PR #49 before merge.

## Remaining acceptance and enterprise gates

| Gate | State / next work |
| --- | --- |
| Authenticated desktop journeys | Partial. Anonymous `/organizations` and `/matters` now server-render a safe top-level sign-in action instead of an endless loading state, verified in supervised desktop preview. Authenticated organization and ERP interactions remain pending: the preview's Vite client entry did not hydrate any client route, including the unchanged main Studio, after a clean preview restart. This is recorded as a preview-runtime limitation, not as an organization-only pass or failure. Repeat against an authenticated, hydrating candidate with synthetic accounts. |
| Real phones / Flutter browser handoff | Implementation and allowlist tests added; physical-device session return and export/open checks pending. |
| Professional trials | Not run. Measure completion, assistance, source traceability and report trust separately from automated checks. |
| Dedicated confidential EU plane | Not provisioned; approved dedicated D1/R2 architecture remains a later gate. Shared validation bindings are not equivalent. |
| Entra OIDC/JWKS/session wiring | Reference only, feature off. Existing trusted ChatGPT/local identity is used for validation. |
| KMS/manifests/key rotation | Reference only, feature off. No in-memory adapter is advertised as a production provider. |
| Compliance export | Feature off. Ordinary dossier PDF/JSON rights never create tenant-export authority. |
| Security receipt completeness | Organization mutations are durable; complete deny receipts, privileged delegation and external attestation remain enterprise integration work. |
| Shared templates / Studio drafts | Retain existing public or personal authoring semantics. They are not tenant-private dossier storage; confidential dossier material must not be published as a catalog case. |

Keep the synthetic/de-identified warning, human evidence review, snapshot
provenance and existing PDF baselines. Do not present this candidate as complete
Phase B, confidential readiness, a professional pilot, or a deployed release.
