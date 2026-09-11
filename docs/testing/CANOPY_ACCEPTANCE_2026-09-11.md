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
This is database evidence, not proof of two functioning browser sessions.

The catalogue contains five bundled cases and fifteen historical case versions.
There is no `project_canopy_managed_site_expansion` or independent Canopy package.
The governed-output table has no rows, so no PDF/JSON or independent output
approval can yet be claimed for this Site.

The Worker log records POST `/api/play-sessions` returning 404 at
2026-09-10T14:28:23.801Z, followed by GET of the attempted run returning 404.
Source inspection and the absent catalogue package explain the start rejection:
the exact published scenario is unavailable. This is not evidence of a missing
HTTP route; that handler exists and is included in the build.

The Cloud Browser reached normal ChatGPT sign-in. After selecting the saved owner
account, ChatGPT returned `Session ended`, `error_code: invalid_state`. A fresh
Site tab still showed its sign-in screen. Authentication remains blocked in this
browser. No credentials, cookies, identity headers or bypass tokens were used to
substitute an authenticated session.

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

1. Complete ordinary owner sign-in in the same Cloud Browser through the supported
   handoff; a login in a different browser does not transfer this session.
2. Reopen the retained Canopy dossier in its existing organization. Preserve its
   sources, proposals, questions and two participant records.
3. Download the exact Base Studio draft. Import it in Decision Studio and review
   its publishable context explicitly. Use the ordinary review/publication path
   under an authorized publisher; do not seed the live catalogue directly.
4. Verify publication of `project_canopy_managed_site_expansion` version `2.0.0`
   with the prepared fingerprint, then return to Canopy and refresh.
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
