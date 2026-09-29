# Studio receipts and governed Matter output history

2026-09-27. Read-only contract review after the Stage 1–3 follow-up slice. No application files, schemas, data, permissions, endpoints or output bytes were changed, and no authenticated request was made for this review.

## Finding

**An authorized Matter output register already exists. It is not a persistence endpoint for the Studio analytical PDF receipt.** A Studio link to that register, with accurate explanation, would provide a useful route to the existing governed workflow. It would not save the Studio PDF/receipt there or fulfill that persistence requirement by itself.

The supplied runbook explicitly asks to save the receipt in existing export history for authorized users. For the current Studio Base/Medium/Full export, that remains an **implementation gap**, not only a browser check that has not run. The current UI's device-only limitation is honest, but a limitation notice does not implement the requested persistence. The coordinator should carry this subrequirement explicitly as incomplete or record a deliberate scope decision; it should not be silently marked PASS or N/A merely because the current Studio API lacks it.

## Existing contracts

| Surface | Existing behavior and source |
| --- | --- |
| Studio analytical PDF | `app/case-report.ts:637` renders the actual Studio draft/options, starts a browser download and creates a `ReportReceiptV2`. It does not submit that receipt or PDF to a server. Preview deliberately creates no download receipt. |
| Studio receipt binding | `app/report-model.ts:175` onward binds case ID/version, profile, renderer, content/report/layout/presentation fingerprints, generation time, audience and draft/final declaration. This receipt has no Matter ID, sealed Matter snapshot ID/digest, persisted object reference or hash of the actual PDF bytes. Its identity is not a governed output identity. |
| Studio persistence | `app/report-model.ts:262` onward uses one localStorage key per eligible account/device scope, case and profile. `setItem` replaces that key; it is not an append-only list. Private/protected cases are excluded by `mayPersistGeneratedReportReceipt` in `app/case-report.ts:592`. Optional storage failure does not invalidate the generated PDF. Authentication alone does not turn this into a server write. |
| Studio receipt UI | `app/CaseReportDialog.tsx:286` offers the completed download receipt and a receipt-JSON download. The disclosure says to retain it with the PDF and explicitly says it is not server export history. The latest-device-receipt disclosure at line 322 says it is neither complete history nor confirmation that the user saved a file. |
| Matter output history | `dossier_governed_outputs` (`db/schema.ts:1321`) stores output ID, Matter ID, sealed snapshot ID/digest, format, private content reference, actual content SHA-256, filename, generator versions, creating actor and creation time. Snapshot associations and bytes are created by the governed server renderer. |
| Freshness and approval | `dossier_output_state_events` and `dossier_output_approvals` are separate retained records. State events carry current/stale, reason, time and actor; approvals bind an exact output and reviewer. Source/revision changes mark prior outputs stale instead of rewriting their bytes. The active reviewer and current sealed snapshot are checked before approval (`app/dossier-governed-output-server.ts:1562`). A Studio checkbox/declaration is not this approval. |
| Audit | `dossier_audit_events` contains attributed `output_generated`, `output_marked_stale` and `output_approved` events. Generation and approval persist associated audit events. This is server generation/review history, not proof that a user saved a downloaded file. |

## Endpoint and UI map

| Operation | Existing route | Conditions / result |
| --- | --- | --- |
| List governed outputs | `GET /api/dossiers/{dossierId}/outputs` | Resolves current session/organization and requires Matter `read` access. Returns public output metadata and guarded download URLs; private object references are removed. |
| Create governed output | `POST /api/dossiers/{dossierId}/outputs` with `action: generate`, exact `snapshotId`, `format`, expected revision | Same-origin mutation and Matter `output` permission. Format is PDF, JSON manifest or Markdown. Requires a sealed snapshot at the exact current revision, verifies its stored manifest, renders server-side and stores verified private bytes. Repeating the same current snapshot/format returns its existing output. |
| Approve exact output | Same POST with `action: approve`, exact `outputId`, expected revision | Matter `approve` permission plus an exact active reviewer participant, current output state and current-revision sealed snapshot. Approval is separately recorded; it is not inherited by another file. |
| Download retained bytes | `GET /api/dossiers/{dossierId}/outputs/{outputId}/download` | Requires `download` access, validates Matter/output/snapshot binding and stored-byte digest/metadata, then rechecks authority before returning bytes. Response includes output hash and snapshot ID/digest headers. Old stored bytes are not silently regenerated. |
| List / create snapshots | `GET` / `POST /api/dossiers/{dossierId}/snapshots` | Read / snapshot permissions; creation freezes the actual Matter at a checked revision. Current pilot requires `internal` audience and `pilot-default` profile. It does not accept an arbitrary Studio report model. |
| Snapshot manifest | `GET /api/dossiers/{dossierId}/snapshots/{snapshotId}/manifest` | Existing authorized exact snapshot manifest download, separate from Studio's receipt JSON. |
| Audit history | `GET /api/dossiers/{dossierId}/activity` | Requires Matter `audit` access; supports bounded cursor pages or one exact event ID. |
| Presentation extract | `GET /api/dossiers/{dossierId}/outputs/{outputId}/presentation` | Derives a clearly non-approved PDF from an exact governed JSON output. It is not a Studio receipt upload or a newly persisted governed output. Response explicitly identifies the source output and no approval. |
| Existing Reports UI | `/matters?collection=team&organization={organizationId}&dossier={dossierId}&section=outputs` | `MattersClient` → `OutputsSection` shows the Output register, saved snapshot, created time, current/stale reason, approval and secure download; permissions gate generation/approval. The internal destination key is `outputs`, although its visible label is Reports. |
| Exact retained output focus | Add `target=output-{outputId}` to the above exact Matter route | Uses the existing target/focus machinery. Only use an actual returned output ID; no case-title matching. |

The output POST allowlist accepts only the action, expected revision, snapshot ID, output ID and format aliases. It rejects unknown/protected fields and ambiguous aliases. There is no supported action to append `ReportReceiptV2`, import arbitrary analytical PDF bytes, attach them to a custom-case ID, or bind them to a dossier inferred from a return URL.

## Honest navigation versus missing integration

A bounded UI handoff can reuse explicit existing Matter return context and open that case's Reports register, with the same organization-switch rules as the Sources handoff. With no such context, link to the Team catalogue and ask the user to choose the intended case, then Reports. A generic catalogue route should not set `section=outputs`: the current catalogue can select its first authorized case, which must not appear associated with the draft.

Suitable copy would distinguish **Studio analytical downloads** from **reports generated from saved Matter evidence** and state that opening the latter does not archive the current PDF. This closes discoverability only. The existing Reports page already provides the reverse handoff to Studio and states that its snapshot reports have a separate approval process.

The existing exact published decision-package link can supply a package graph to a Matter snapshot through its authorized workflow. It requires a published version/fingerprint and related proof; saving a Studio draft is insufficient. Even that supported path produces a new governed report from a Matter snapshot. It does not preserve the prior Studio analytical PDF or its receipt as the same export.

Do not insert the Studio receipt into the governed-output table, call an upload a governed report, fabricate a snapshot, or reuse a human-readable title/custom-case ID as Matter identity. Any implementation of Studio server export-history persistence needs an explicit compatible contract for identity, authority, immutability and actual receipt/byte binding before choosing its storage path. This review does not propose a parallel schema or claim one is necessary; it establishes that the present endpoint cannot be treated as that integration.

## Limits and next verification

- The output server list is bounded to its newest **1,000** records; client normalization retains **500**. This endpoint has no output-history cursor. `loadWorkspaceData` marks the bundle incomplete at 500 outputs, preserving the queue's completeness guard; the register should not be described as unlimited complete export history.
- Existing governed-output integration tests exercise exact snapshot/byte binding, idempotence, staleness, private download and reviewer records. This review inspected their source but did not rerun them or promote prior test evidence to current hosted browser acceptance.
- A useful bounded acceptance slice for the supported workflow is: authorized actor opens one exact synthetic Matter → observes an existing output/snapshot → downloads and hashes retained bytes → makes one permitted known evidence change → reads its stale status → re-downloads the original output and proves identical bytes. Use the existing reviewer role only if approval is part of the selected slice. Do not create permission grants to get a pass.
- Separately, report the Studio receipt-persistence gap in the runbook reconciliation. The former `A13` wording “server export history N/A” describes the old implementation boundary, but does not close the explicit authorized-history request.

No production or candidate deployment claim follows from this source inspection. Hosted QA access is available according to the user; URL, actors/roles and the candidate-update details are being coordinated separately.
