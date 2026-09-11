# Canopy acceptance checkpoint — 11 September 2026

## Verified target

- Site: GENESIS: JURIS — Canopy V3 Acceptance.
- Project: `appgprj_6a9dcacf5efc819196d6188105cd2cf6`.
- URL: https://genesis-juris-canopy-v3-acceptance.maxim-hayan.chatgpt.site
- Saved version: **1**, source `6a6d6f874c9453d27ae737fc4316092856291e9e`.
- Deployment `appgdep_6aa2693401288191acd9c5ead150e414`: **succeeded**.
- Access is custom, with the owner and two external viewers. No access changes were made.
- The latest cloud-task result reporting 563 tests is a later candidate; its results
  must not be attributed to this older deployed source. This checkpoint and patch
  use the exact deployed source, freshly cloned from the Site repository.

## Actual acceptance state

Read-only database inspection found one organization-bound dossier with two
different active participants: one owner and one reviewer. Those dossier roles
already exist; creating replacement accounts or re-enrolling them is unnecessary.
The owner subsequently completed ordinary sign-in in the Cloud Browser. The
FalconMerlin organization and retained dossier opened as Maxim Hayan; ERP Value
was already the distinct assigned reviewer. This confirms the owner session,
not a functioning reviewer session or an independent output approval.

The retained dossier is `dossier_cc81378c29a04177943c9f72258c14f7`, organization
`org_99c4bd59c64a4258ae0b0045323bba2a`. Base already exists as restricted custom
case **1**, version **2.0.0**, with Studio fingerprint
`sha256-89d4e525b11f8587e834a03dd7811b24ece640f5457d1d775a296cd7f3e2a8df`.
It is still a custom draft, not a published catalogue version. Its title and
version match Base, but **its Studio fingerprint differs from the prepared
Base**. The exact fixture and unchanged handoff draft both compute to
`sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702`.
Explicit premise review does not change that semantic fingerprint. The owner
supplied the complete sealed export `project_canopy_managed_site_expansion-v2.0.0.juris-case.json`
(SHA-256 `8070480490b3a57210dca8c1d38e99235a05ec6518168a214f046089433a04c3`).
Its only content differences from the prepared Base are all fourteen node x/y
positions. Applying `layoutStudioNodes(base.nodes, base.links, "vertical")`
reproduces every exported node and the exact stored `89d4…` fingerprint.
Studio's opening effect silently performed that edit without a history entry.
The supplied export remains untouched. Restore the positions through the owner
editor before immutable publication; do not change the fingerprint algorithm or
the pinned Canopy scenario fingerprints.

The catalogue contains five bundled cases and fifteen historical case versions.
There is no `project_canopy_managed_site_expansion` or independent Canopy package.
The governed-output table has no rows, so no PDF/JSON or independent output
approval can yet be claimed for this Site.

The Worker log records POST `/api/play-sessions` returning 404 at
2026-09-10T14:28:23.801Z, followed by GET of the attempted run returning 404.
Source inspection and the absent catalogue package explain the start rejection:
the exact published scenario is unavailable. This is not evidence of a missing
HTTP route; that handler exists and is included in the build.

The earlier `invalid_state` sign-in failure was resolved by the user's ordinary
sign-in handoff. A later file-chooser attempt lost the browser connection.
Subsequent basic connection probes and a runtime reset failed with `Transport
closed`. The browser connection subsequently recovered. Community now opens the
saved Base and Account confirms a trusted ChatGPT identity for the owner. No
credentials, cookies, identity headers or bypass tokens were used to substitute
an authenticated session.

The remaining publication configuration blocker is concrete: Sites environment
revision **0** contains no entries, including no `GENESIS_ADMIN_EMAILS`. The
owner's Community view consequently exposes the ordinary custom-case workspace,
not AdminDesk. `isPlatformAdmin` requires both a trusted ChatGPT identity and
membership in that configured allowlist. Site ownership and dossier ownership do
not supply this separate permission. No role or environment was changed.

Read-only reconciliation after this failure confirmed three still-open requests:
signed demand, commissioning/clearance, and leadership/team availability. It also
confirmed that the misleading original proposal title "Demand and capacity are
identical" does not describe the accepted assertion: the saved accepted text is
"Signed demand is 300 packs/week; maximum evidenced capacity is 480 packs/week."
Do not accept the original misleading proposal again or overwrite this correction.

All three requests concern the status of existing evidence. Their responses must
retain the Base limits: 300 signed packs against a 450 minimum; pending
commissioning; unresolved leadership/team commitments. A received source is not
production-release clearance. The retained Base recommendation is a conditional
90-day transition pilot, with production prohibited until conditions are met.

## Bounded local correction

Branch: `codex/canopy-publication-preflight-2026-09-11`.

The working-copy interface now reads the existing catalogue endpoint for the
exact case ID, semantic version and fingerprint. It distinguishes a missing
package from a mismatched one and explains the next publication step. The run
button stays disabled until a matching package is found and rechecks on click.
The existing server authorization, source review, immutable publication and
session checks remain authoritative. This read does not publish anything.

The Studio opening effect now fits only the viewport, cancelling pending frames
on case changes. Explicit auto-layout remains available and records the edit.
The expert node inspector exposes bounded x/y inputs so an owner can restore
exact coordinates through normal editing, undo/history and optimistic save
concurrency. These controls are unavailable for inspection-only access.

Validation completed on the changed source:

- 22/22 targeted tests: Canopy fixture/publication, graph layout and Studio
  performance/source-opening regression checks.
- TypeScript, the 18-route canonical parity lock, lint and the complete web build passed.
- Four scenario drafts were also checked against the ordinary publication compiler:
  each is rejected until its context is explicitly reviewed; after that review,
  its prepared playable fingerprint matches the publication compiler.
- No new hosted CI, full native/PDF corpus or authenticated UI PASS is claimed.

The current source is a correction candidate; its actual publication receipt must
be recorded separately. Supervised preview serves HTML but its primary navigation
does not respond; successful production browsing is not a preview PASS. No new
authenticated browser regression PASS is claimed for the correction yet.

## Resume the real workflow

1. Reuse the recovered browser and verified owner session. Do not request another
   login unless the browser actually requires one.
2. Reopen the retained Canopy dossier in its existing organization. Preserve its
   sources, proposals, questions and two participant records.
3. Reopen custom case 1 using Community / Open in Studio. After the opening-effect
   correction is published, restore node positions to x = 260 × zero-based node
   index and y = 0 using the expert inspector. Verify the prepared Base fingerprint.
   Resolve the confirmed fingerprint mismatch through the ordinary owner editor
   before publishing version 2.0.0. Review the publishable context explicitly and
   save the existing source with its normal concurrency binding. A fresh raw
   import loses that binding and the server intentionally rejects an overwrite
   until the current source is reopened. Do not remove that protection, overwrite
   published versions, seed the live catalogue directly or mark review/approval
   through database writes. The Site owner must authorize the platform-admin
   allowlist configuration before an administrator can use Promote to library.
   Use that action only after exact source comparison and context review.
4. Verify publication of `project_canopy_managed_site_expansion` version `2.0.0`
   with playable fingerprint
   `sha256-4c17139f6cf47399349aeaf27a473bbcb1429e7d6a9cc3eb0766e12ab290b31b`,
   then return to Canopy and refresh.
5. Complete the recorded Base decisions, link the completed run and controlling
   evidence, resolve the existing evidence-status questions and generate PDF/JSON.
6. Have the already assigned reviewer sign in normally as a distinct actor and
   approve the exact generated output. Reopen and verify its snapshot, hash and
   current status. Repeat for Upside (`2.1.0`) and Hard stop (`2.2.0`) in order;
   Downside is an independent package/copy.
7. Update a source through the existing workflow and verify the earlier output
   becomes stale while its original bytes and approval history remain intact.

Before adopting this small UI patch into the later cloud candidate, compare its
current source and reconcile overlapping work. Do not replace that candidate with
this older deployed tree. Release and acceptance statuses remain separate.

## Required UI/UX audit after functional publication

The owner explicitly requested this follow-on on 11 September. A conditional
check is scheduled to start it after actual functional publication, not merely
because the existing acceptance Site is online. Reconcile this thread's progress
before starting another audit; do not run duplicate implementations.

| Area | Acceptance evidence |
| --- | --- |
| Navigation structure | A coherent order for Canopy, matters, Studio, Templates, organizations and account/admin; clear current location and next action |
| Route behavior | Every link and primary button works; direct URLs, reload, back/forward and return after sign-in reach the intended screen |
| Work context | Organization, selected matter, language and safe unsaved-work handling remain correct across transitions |
| Administration | Explain roles, invitations, access revocation, statuses, publication prerequisites and consequences beside the relevant controls |
| Feedback | Useful empty/loading/error/success states; disabled actions explain the required next step; no indefinite loading |
| Accessibility and devices | Keyboard order and focus, readable desktop/phone layouts, 200% text, EN/RU consistency and meaningful labels |
| End-to-end work | Owner preparation through saved PDF/JSON, distinct reviewer action, reopening and stale-output behavior |

Record each defect with route, account role, reproduction, expected/actual result,
severity and evidence. Fix and recheck P0/P1 navigation blockers; report untested
roles/devices honestly. Do not replace an authenticated review with API fixtures
or modify access controls to pass the audit.
