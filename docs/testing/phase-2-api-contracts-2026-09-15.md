# Phase 2 API and integration contracts

Product source: 9236c02a294c4c9a43cd49cb3113fba06a889c6b. All routes use the existing authenticated organization/case boundary and private no-store responses. Client-supplied IDs select records; they never grant access.

## Working notes

Base: `/api/dossiers/:caseId/notes`.

| Method / selection | Result |
|---|---|
| GET, optional `cursor` | At most 50 current note metadata rows; `nextCursor`; no bodies |
| GET `note_id` | Exact current note content, pinned-source page and current revision |
| GET `note_id&revision` | Immutable selected content plus relationships active at that revision; current source/retirement status is separately labelled |
| GET `note_id&history=true`, optional revision `cursor` | At most 50 immutable history metadata rows, newest first; `nextCursor` |
| GET `note_id`, optional `source_cursor` | At most 50 selected revision's relationships; `sourceCount`, `nextSourceCursor` |
| GET `document_id`, optional `version_id` and link `cursor` | Authorized same-case backlinks, exact filtered total `count`, `nextCursor` |
| GET `operation_key` | Original actor-scoped operation and immutable saved note revision; never latest mutable content |
| POST `create / save / link / unlink` | Original note-revision receipt and operation metadata |

All POSTs require `action`, `expectedRevision` (JSON integer) and canonical `idempotencyKey` (8–120 characters, no padding). Create requires expected revision 0 and receives a server note ID; other actions require `noteId` and its current note revision.

```json
{"action":"create","title":"Delivery review","type":"meeting","body":"Working notes for the controlled case.","expectedRevision":0,"idempotencyKey":"unique-operation-key"}
```

For `save`, supply `noteId`, title, type and body. Supported types: `blank`, `meeting`, `analysis`. Title: 1–200 characters; body: up to 100,000 characters, including empty. Body text is preserved; titles are trimmed. Each successful action creates a new immutable note revision.

For `link`, supply `noteId`, `documentId`, `documentVersionId` and optional `sourceAnchorId`. The exact tuple must exist in that case. For `unlink`, supply `noteId` and the exact `sourceLinkId`. Link/unlink preserve note content and source bytes; their own note revision records the relationship event. An active duplicate returns `already_linked`, with the existing relationship ID, without a mutation.

The receipt contains `note` (saved content/revision/actor/time) and `operation` (event ID, original key, action, case/note IDs, resulting revision, optional relationship ID, actor/time and digest). Replay of the same raw payload returns that same saved revision even if the current note has advanced. Different content under the key returns `operation_key_conflict`. A revision conflict returns the current authorized note for explicit comparison. No silent overwrite or automatic merge is performed.

Read/write permissions: existing case readers may read; only active case owners/contributors may write. Replays are still authorized. Both organization/membership and case-participant authority are checked inside the write transaction. A source link cannot cross case scope or confer access.

Notes use an independent revision sequence. They are not included in existing governed snapshots/reports. Future inclusion requires a pinned immutable note revision. The user label is **Working material · shared with this case**.

## Information requests

Existing `/api/dossiers/:caseId/requests` POST accepts `idempotencyKey` for both create and update_status. Legacy requests without it remain supported but are not safe to blindly retry. The canonical digest binds the exact payload including expected revision; retain and replay the same bytes/key.

A successful keyed response includes the request snapshot, resulting case revision, audit event and `operation`. It omits recomputed readiness deliberately. Fetch the case to verify current readiness; a failed refresh must not erase the receipt or claim the write failed.

GET `operation_key` is actor-scoped. GET `request_id` retrieves exactly one same-case request; incompatible pagination is rejected. A missing operation does not prove an in-flight write cannot still commit. Reconcile by replaying only the immutable original submission. A changed draft becomes an explicitly new operation after resolution/current-state review.

## Dispositions and exact assertion loading

- Existing disposition GET adds `actor_id`, allowing a pending proposal to detect account changes before replay.
- GET `kind=deadline|citation&id=:recordId&operation_key=:key` returns only the original operation owned by the current actor for that exact record.
- `savedOutcomeReceipt` optionally binds `operationKey`; the revised disposition form always supplies it.
- GET `/api/dossiers/:caseId/evidence/assertions?assertion_id=:id` returns the exact authorized assertion and sources or 404. Do not select a fallback or rely on a bare fragment when the row is not loaded.
- Exact audit GET remains `/activity?event_id=:eventId` with the existing privacy-preserving boundary.

## Recovery and queue integration still required

`write-recovery.ts` is a tested headless contract, not a claim that all existing forms use it. It separates actor/org/case/record/visit scope, immutable submission, current editable draft, receipt and current comparison. Unknown outcome/expired session blocks a new submission; permission denial clears private retained material. It stores nothing in URLs or browser storage.

`action-collection.ts` is also not yet wired into Action Center. Integrate it as the single source for ordering, reasons, filters and counts. Keep queue state in the case owner rather than a conditionally mounted section. Invoke exact target loading with captured organization/case/visit identity, verify the response record, then focus/scroll. Return paths must retain original action/output identities.

Before accepting that UI, implement and render-review:

1. Parent-owned in-memory draft lifecycle through section transitions.
2. Exact current/proposed conflict comparison and explicit new submission.
3. Supported same-account reauthentication with the actual draft-continuity limits visible.
4. Information-request original-operation receipt and read-only refresh recovery.
5. Canonical queue state, exact unloaded-target retrieval, prerequisite return context.
6. Notebook editor/source picker/backlink/unlink journey.

Use the exact-candidate browser acceptance pack. Do not infer these interactions from the model/API checks.
