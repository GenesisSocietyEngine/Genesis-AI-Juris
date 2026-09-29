# Studio UI/UX reconciliation — 14 September 2026

PR #51 was prepared against an older GitHub branch. Its intent is reconciled against the existing Sites repository, preserving production's later work.

- Production publication at reopening: version 79, source 318e7d8764972a24a5cdb48f9ebdc8dd8572a611.
- Current source checkout: 41ecdb8014356751c3b829df0fbb3d26c1a11e18 (adds the prior verification record).
- Original candidate: GitHub PR #51, 503b2caaaaac9a0a84580fd3ef7556c4731a125c.
- Reconciliation: the commit containing this file. Publication is confirmed separately by the native deployment receipt.

## Reconciled findings

| Finding | Resolution |
| --- | --- |
| Vertical selection still displayed saved landscape coordinates. Production intentionally preserved the signed draft on opening. | Project visible nodes into a vertical layout without changing canonical coordinates, source fingerprints or edit history. Each replaced/restored draft gets a fresh Studio instance. |
| Initial fitting shrank a long vertical graph to 55%, making node text difficult to read. | Fit the width at a readable scale and scroll vertically. Remove the inherited 1,200px minimum canvas width for vertical views. |
| Display projection must retain deliberate editing. | Repositioning applies the displayed delta to canonical coordinates. Keyboard moves remain visible. Explicit Auto-layout is still a recorded edit. New nodes acquire reference coordinates before paint. |
| Loading the layout engine initially exceeded the existing 325KB budget. | Load it once per Studio instance, display a loading state until ready, and offer retry on failure. No completion marker or draft mutation is involved. |
| Examples lacked a separate home. | Add Demo cases with Canopy Base, Upside, Hard stop and Downside, plus all five existing playable cases. Each Canopy choice opens an independent working draft. |
| Production already had a complete Canopy workflow. | Preserve it and link to it from the demo category, keeping organization and language context. Shared workspace navigation groups Canopy under Demo cases. |
| Studio-only routing ignored demo/library/help destinations. | Honor those views and browser history; preserve the contextual Templates, My cases, Account, Workspace and Organizations links. |
| Demo players returned to the wrong area. | Preserve the launching category and label the return accurately. Back and Forward restore the player/category. |
| Completed wizard steps lost their numbers. | Keep 1–6, simplify labels, and link the first quick start to Demo cases. Preserve the current quick-start position and six-step progression. |
| The old patch replaced newer file-import handling. | Retain production's validated JSON, Markdown and text imports and canonical review flow. |
| The old patch overlapped newer case-view improvements. | Preserve current plain-language copy, valid graph targets and keyboard tab handling; add a focusable tab panel. |
| Normal views exposed implementation labels and identifiers. | Remove release/LAB badges and catalogue deployment wording. Collapse player identity/version/fingerprint details; remove foreground-clock and mobile-bundle labels. Keep meaningful validation, save, conflict and access states. |

## Verification

- Complete web suite on the first reconciled build: 601 tests, 599 passed. Failures were a stale navigation/source-label assertion and the initial-client bundle budget.
- Replaced the navigation assertion with rendered navigation checks, including the active Demo cases link for Canopy; updated the obsolete release-label expectation.
- Deferred the layout engine, keeping the original bundle budget unchanged. Both initially failing tests pass on rerun.
- Final targeted suite: 38/38 passed across demo projection, guided wizard, Studio performance, workspace UI and release regressions. Final compiled-asset checks and build are recorded by the publishing run.
- Strict TypeScript, the locked 18-route canonical mobile contract, and lint pass. Dependency declarations, lockfile, server authorization, database schema, fixture data and report renderer are preserved.

## Browser observations in the managed preview

- Demo cases displays four Canopy scenarios and five playable cases, with numbered guidance in English and Russian.
- Both the regular application and standalone Studio expose the demo entry. The first quick start opens it.
- Canopy Base reaches step 4. The first three nodes have y positions 86, 332 and 578: actual top-to-bottom coordinates.
- Explicit Horizontal produces a horizontal row. Returning through Demo cases to Studio restores Vertical.
- A keyboard move changes the selected node's displayed x by 5px; arrow-key case-view navigation selects the next tab.
- Failed ERP Implementation opens from Demo cases. Its return action reaches Demo cases; browser Back and Forward restore the player and demo category.
- Desktop screenshots confirm the vertical map and corrected readable initial scale. Studio links retain the existing professional destinations.

The browser connection timed out during an additional pointer-drag/replacement check. Pointer dragging, exact same-ID file upload, authenticated protected-case reopening, a 390px viewport and 200% text zoom are not claimed as browser-verified. Projection immutability and move offsets are covered by tests. No production account data was changed for QA. Broader administration, enrollment, document upload and report acceptance remain outside this patch's browser verification.
