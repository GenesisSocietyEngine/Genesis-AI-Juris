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
Explicit premise review does not change that semantic fingerprint. Reopen and
export custom case 1 to identify the difference before any immutable publication.
The database tool returned a truncated draft payload; the specific differing
fields and cause are not yet known. Do not infer them from the matching title or
the matching initial payload text.

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
closed`. This is the current interaction blocker, not evidence that owner access
or the Site itself is broken. No credentials, cookies, identity headers or bypass
tokens were used to substitute an authenticated session.

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

Validation completed on the changed source:

- 12/12 targeted tests: 8 existing Canopy fixture tests and 4 new publication checks.
- TypeScript, the 18-route canonical parity lock, lint and the complete web build passed.
- Four scenario drafts were also checked against the ordinary publication compiler:
  each is rejected until its context is explicitly reviewed; after that review,
  its prepared playable fingerprint matches the publication compiler.
- No new hosted CI, full native/PDF corpus or authenticated UI PASS is claimed.

No push, merge or deployment of this correction was performed.

## Resume the real workflow

1. Restore the browser connection and inspect its current account state. The
   owner sign-in was already verified; do not request another login unless the
   restored browser actually requires one.
2. Reopen the retained Canopy dossier in its existing organization. Preserve its
   sources, proposals, questions and two participant records.
3. Reopen custom case 1 using Community's custom-case inventory / Open source,
   export the full saved JSON and compare it to `drafts/base.studio-draft.json`.
   Resolve the confirmed fingerprint mismatch through the ordinary owner editor
   before publishing version 2.0.0. Review the publishable context explicitly and
   save the existing source with its normal concurrency binding. A fresh raw
   import loses that binding and the server intentionally rejects an overwrite
   until the current source is reopened. Do not remove that protection, overwrite
   published versions, seed the live catalogue directly or mark review/approval
   through database writes. Use Promote to library only after exact comparison.
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

If the Cloud Browser remains unavailable, the next useful external input is the
ordinary JSON export of saved custom case 1. It permits a precise local diff;
it does not by itself prove publication, a recorded run, PDF/JSON generation or
independent reviewer approval. Never request passwords, cookies or session tokens.
