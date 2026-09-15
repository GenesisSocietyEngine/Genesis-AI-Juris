# Five Flats PDF crash — review and release scope

## Baseline and acceptance

- Production Site: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`, published v88.
- Source baseline: `931b9aa8ec5f568a34aabaa498d3cdd5cca65ed5`.
- Existing production URL: https://studio.falcon-merlin.com.
- Scope: existing local PDF preview/download, case-data ownership, failure containment and accurate handoff copy. No new Action Center or notebook interfaces.
- Acceptance: the supplied canonical case renders a PDF without changing any authoring state; its editing-history comparison and a second report remain usable. Recoverable report failures stay local. A browser download must not deliberately navigate the editor away.

## Stage 1 — reproduce and review

Input: `five_flats_three_borders-v1.0.0-final_20260915_105830.md`, 23 nodes and 36 links. Source SHA-256: `63baf3052e3f077884a26e31f51e4768634042f11d52a639146f30bf6b56baee`.

The original renderer returned a valid 22-page PDF but mutated all eight financial assumption strings into pdfmake layout objects. The canonical fingerprint changed from `sha256-eb850192063bf00ba50dbc7a7f957eae450c1f5f73ad8c635c54ab75d7c72c33` to `sha256-935e66b8f50152ce02cfeda6b9a211994333e23df2833ff5cf7d78424a61d1dd`.

Cause: `buildEconomics` lent `draft.dealEconomics.assumptions` directly to pdfmake's mutable `ul` definition. Layout inserts internal objects and functions. An independent reproduction with this exact case confirmed `snapshotStudioDraft` then throws `DataCloneError`. With an editing revision selected, Studio eagerly calls this through `diffDraftToRevision` during its next render, outside the report error boundary. Import alone clears the editing timeline; a later edit makes the outer crash path reachable. Repeated report generation is also unsafe against the corrupted data.

This is a source-level reproduction using the actual PDF library, not an observed stack trace from the user's browser. The active browser controller timed out while refreshing tabs after 20 seconds. Available production worker logs returned no events; they do not prove a browser exception was absent.

## Stage 2 — repair and self-review

- Copy the financial-assumption list, and build PDF definitions from an independent clone of the serializable case. Keep the canonical report models and fingerprint calculations based on the original case. Do not clone finished definitions containing footer/layout functions.
- Preserve on-demand, parallel loading of the PDF library/fonts. Each optional import retains local error ownership until it settles; a late font failure cannot trigger a global Studio refresh after a sibling import fails.
- Convert asynchronous chunk/Blob errors and premature stream closure into a rejected report promise. Ignore subsequent events once settled.
- Keep download handoff separate from the editor URL; retain object URLs for 60 seconds and clean up after failed clicks.
- Say “PDF download started”, since the application cannot attest that the browser saved a file. Loading errors give a retry path and advise saving/exporting before a manual refresh.

Review found and corrected an early-release race in a guard around `Promise.all`; guards now wrap each import. React review preserved existing lazy boundaries, authorization checks and listener cleanup. The source-data clone is deliberately before pdfmake layout so renderer mutations cannot reach case state or immutable case history.

## Stage 3 — verification

| Check | Evidence | Result |
| --- | --- | --- |
| Actual PDF renderer | `tests/case-report.test.ts`; deeply frozen case with nonempty financial assumptions, two generations, fingerprints, receipt binding and `diffDraftToRevision` unchanged | Verified in Node |
| Focused regressions | `case-report`, `report-download-recovery`, `report-generation-error`, `pdf-blob`, `v61-release-gates`: 34 passed | Verified in Node |
| Exact supplied case | `scripts/verify-canonical-case-pdf.ts`; PDF signature, MIME, full draft JSON, fingerprint and authoring snapshot unchanged | Verified in Node |
| PDF visual output | Poppler rendering of all 22 pages; contact-sheet inspection, detailed economics and terminal graph pages | Portrait A4, no visible clipping in inspected output |
| Error/download control | Concurrent/rejected imports, stream failures, mocked DOM handoff and delayed cleanup | Verified by simulations; not browser acceptance |
| Static checks | Typecheck, lint and diff whitespace checks | Passed before build |
| Active desktop/browser/mobile download | Browser controller unavailable | Functional verification pending |

The generated PDF is an internal preliminary draft, with no approval created and no production case mutation. The supplied case/PDF is not included in public site assets or repository fixtures. The graph appendix retains the existing detailed technical caption and dense connector presentation; this hotfix does not redesign report layouts.

## Deployment and recovery

This branch starts at the exact published v88 source. No server route, authorization, database schema, SQL migration, or sealed-report storage changes are included. The migration package must remain identical to v88; the unresolved earlier v87/0022 boundary is not retried or altered. Packaging/deployment uses the supported Sites workflow and the existing audience/domain.

Recovery artifact: previously published v88, saved version `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_8feb9672f2348191b7a46147d971dae4`. It remains schema-compatible with this no-migration patch, although it retains the PDF bug. A deployment does not rewrite existing sealed PDF bytes. Record the final published version, full source SHA, artifact hash, migration outcome and terminal platform status in the delivery record after publication.

Release assessment: ready for the narrow PDF hotfix after successful build/package. Functional authenticated browser verification remains pending; this work does not establish self-service-trial readiness.
