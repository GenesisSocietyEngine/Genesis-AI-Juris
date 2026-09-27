# Local viewer access suspension and recovery

**PASS — ordinary API check, 27 September 2026, 20:32:42.626–20:32:45.197 UTC.** Exact unchanged application commit `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`, built input digest `25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec`, local built worker on `http://localhost:5281` with isolated `.artifacts/ux-reconciliation-auth/state`. This is API authorization evidence, not a browser role, second-tab concealment or hosted-candidate pass.

The acceptance criteria were set before execution: read the exact viewer membership and existing source; suspend only that synthetic organization membership, preserve its role; deny existing direct dossier, document/version metadata and exact file requests in the same viewer session; restore access in `finally`; reject the stale selection after restoration; refresh the actor's selection and verify exact original source access and unchanged dossier data. No application source, credential, invitation, provider identity or direct database mutation was involved.

## Ordinary operation and observed responses

Owner and viewer signed in separately through `/api/auth/login` using existing isolated synthetic password accounts. Credentials were loaded internally from the ignored fixture file; cookies stayed in script memory and were never included in evidence. No existing browser session was reused or changed.

The owner read current membership through `/api/organizations`. Target actor `actor_be30f5cfe01560dd0ad87fa0986d2246` was an **active organization member, revision 1**, in `org_15eba3abeeb241c6899481f557186dd4`. Its separate dossier participant was **active viewer**. The viewer's own ordinary organization response supplied its actor-bound selection; it could read fixture C at revision **21**, document/version metadata and the exact v1 file before the change.

The supported reversible action is `POST /api/organizations`, with `action:"member"`, the exact organization and target actor, the original organization role `member`, `status:"suspended"` and the target's current `expectedRevision`. The same-origin credential mutation headers and owner session were used. The response was HTTP 200 with `ok:true`; owner readback confirmed **suspended/member/revision 2**. `removed` was never sent: removed membership has no ordinary restoration path. Suspension affects this actor's access throughout the synthetic organization; it does not change the dossier's viewer role.

| Read using the existing viewer session and old selection | While suspended | After restoration, before refreshing selection |
|---|---|---|
| Exact dossier `/api/dossiers/{dossierId}` | 404 `organization_unavailable` | 409 `organization_context_changed` |
| `/documents` including version metadata | 404 `organization_unavailable` | 409 `organization_context_changed` |
| Exact `/documents/{documentId}/versions/{versionId}/download` | 404 `organization_unavailable` | 409 `organization_context_changed` |

Each rejected JSON response was checked to contain only `error` and `code`, with no fixture content fields. The suspension responses contained no synthetic source text. All response status, size, content type and cache-control observations are in the receipt. No successful old-selection request or private file bytes were returned during the denial checks.

The `finally` block reread the owner-visible target membership, then used its fresh revision 2 to restore `active` with the unchanged original role. Readback confirmed **active/member/revision 3** at **20:32:44.629 UTC**, on the first restoration attempt. Other actors' organization role/status/revision records were identical throughout. After the explicit stale-selection checks, viewer GET `/api/organizations` using the raw organization ID returned a new actor-bound selection at membership revision 3. The refreshed viewer could again read the dossier as **viewer**, documents and exact v1 bytes.

## Preservation and cleanup

- Dossier `dossier_4c45577c6bc54528b9330d018a893312` stayed at revision **21**. All returned dossier fields apart from the dynamically evaluated readiness object were compared canonically and matched. Assertions and participant registers also had separately matching hashes. No assertion/review/dependent-output change is inferred from this access operation.
- Document/version metadata matched exactly. Source `document_version_74cafe3815474c808a7adfea87340a1d` remained **422 bytes**, SHA-256 `f2d072fa17fd69a13399e0f4a3019a0eca55cfdbad53783cf48f862334f5a84e` before and after. The file was downloaded into memory for hashing, not uploaded or altered.
- The two sessions created by the script were independently logged out through the ordinary logout API, each returning `authenticated:false`. The prior browser owner session was untouched.
- The organization membership revision deliberately advanced from 1 to 3, with durable ordinary security events. This is restoration of the original role/status, not rollback of audit history or resurrection of the stale selection.

## Evidence and limits

[Timestamped sanitized receipt](evidence/amendment-viewer-suspension-2026-09-27T203242626Z.json) contains five passed acceptance checks and every request outcome; SHA-256 `068ac9210e427ac2b2940810642edc6f489f0119d4b2b51ba6420d9fc186367d`.

The ignored one-shot script is `.artifacts/ux-reconciliation-auth/verify-viewer-suspension.mjs`, with a [byte-exact archived copy](evidence/amendment-verify-viewer-suspension.mjs), SHA-256 `cd276f57a9174dfd5857d962a8af1b9a8f75b9777ac865712c4b0ab6e784edc2`. It passed pinned Node 22.23.2 syntax validation and executed once with exit 0. It has bounded fresh-CAS restoration in `finally`, aborts on unexpected role/status, and saves no passwords, cookie values, bearer tokens, invitations or raw login response bodies. The archive is provenance, not a standalone runnable test without the ignored synthetic fixture material.

This closes the local **server-side reversible organization-access suspension/recovery** slice. It does not establish browser viewer login, live second-tab revocation concealment, role switching after logout, source-version upload/reassessment, governed-output invalidation or hosted acceptance. The separate owner-browser wrong-organization concealment observation is in [AMENDMENT_BROWSER_CAPABILITIES.md](AMENDMENT_BROWSER_CAPABILITIES.md). The completed [independent critical review](AMENDMENT_ACCESS_REVIEW.md) found no reproduced P0/P1 within this scope and records the untested paths separately.
