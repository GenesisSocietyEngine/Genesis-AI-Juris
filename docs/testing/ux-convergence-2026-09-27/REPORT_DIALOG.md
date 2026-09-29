# Stage 6 — report dialog

Baseline: production v102 source `bf5799383a52b6617cd9d4a0acf47af780086218`; scope UX10–UX12, UX16 / A12–A14. Criteria recorded before implementation on 2026-09-27. This step changes the dialog, not the renderer, canonical report content or governance workflow.

## Intended result and acceptance

1. Show report status independently of depth, audience and confidentiality. A downloadable draft and completed format checks do not imply independent approval. A workspace save is described as a save, not review. Existing reviewer declaration must not carry over to materially changed case/publication fingerprints.
2. Keep Base/Medium/Full, synchronized tree control, profile, inclusion/redaction options, preview and download. Following the runbook, choosing Full initializes tree ON; the user can switch it OFF while remaining in Full. Preserve v102's existing detailed-text coupling and explain it in the UI. A separate appendix switch is N/A because it was not previously supported; no new renderer contract is introduced.
3. Show a compact current receipt with freshness and generation time, a reachable JSON download, and collapsed complete technical fields. A changed form must keep the immutable old receipt labelled as earlier output. Starting a download is not confirmation that a user saved the file.
4. Retain the existing latest-device-receipt policy. It is one receipt per permitted account/case/profile, not a durable server history. Private/protected receipts remain excluded. Preview creates no receipt. Old account/case/authority receipts and late callbacks must not cross contexts.
5. Expose concrete output blockers and actionable next steps; draft warnings remain visible by disclosure without blocking an otherwise permitted draft. Keep dialog focus, Escape, busy and authority behavior.
6. Review changed UI at narrow/zoomed widths through the root agent's browser session. Until performed, rendered geometry and real downloaded files remain NOT RUN; local component/model checks are not browser acceptance.

## Verification plan

Use existing report-dialog execution tests (actual callbacks/model/download helper with modeled React/renderer), report model/first-use tests, and targeted type/lint checks. Add assertions for the changed receipt disclosure, honest status and exact-version reviewer declaration. No new migration, dependency, storage format or hosted operation.

## Status

Implementation complete for the bounded dialog scope; no commit or publication by this agent. Historical report and session acceptance remains scoped to its recorded source. This document does not grant publication or pilot GO.

- Report status is separate from depth/audience/classification. Removed the implication that saving means review. Final-mode wording describes checks and a declaration, not a newly recorded approval.
- The existing reviewer checkbox is now bound to exact content/publication fingerprints and account scope/authority epoch. Changing and saving the case clears it; returning to the earlier draft does not revive it.
- Current receipt shows generation/download-started status, time, exact freshness and JSON action. Technical fields and storage explanation are collapsed. Receipt bytes, renderer and model are unchanged.
- The previous-device receipt is a collapsed record with an explicit limited-storage explanation. A synchronous context fence hides it before delayed replacement reads across account/profile/eligibility changes.
- Preview/options binding, preflight/post-render server authority checks, revoked/late callback guards and private receipt storage exclusions remain intact.

## Local verification result

Pinned Node `v22.23.2`; commands executed from this checkout:

```text
node --import tsx --test tests/report-receipt-dialog.test.ts tests/report-first-use.test.ts tests/report-model.test.ts tests/report-decision.test.ts tests/report-download-recovery.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js app/CaseReportDialog.tsx tests/report-first-use.test.ts tests/report-receipt-dialog.test.ts
git diff --check -- app/CaseReportDialog.tsx tests/report-first-use.test.ts tests/report-receipt-dialog.test.ts
```

Final focused suite: **32/32 PASS**, exit 0, in [targeted-final.log](report-dialog-validation/targeted-final.log). Actual dialog callbacks and report/download helpers are executed; React scheduling, DOM and PDF byte rendering are modeled where the existing harness requires it. Assertions cover the new disclosure, honest status, material-version declaration reset, stale receipt retention and device-receipt account/eligibility race. These are not browser/file acceptance.

Final typecheck, including the added cache regression, exited 0 with [empty diagnostic log](report-dialog-validation/typecheck.log); changed-file lint exited 0 with [empty log](report-dialog-validation/lint-final.log); scoped diff whitespace check passed. Root's final integration checks apply to any later shared-tree changes.

Preserved nonpassing preparation evidence: the [sandbox bootstrap attempt](report-dialog-validation/targeted-sandbox.log) failed before tests at `uv_os_get_passwd ENOMEM`; the [first host attempt](report-dialog-validation/targeted-initial-host.log) passed 28 tests but could not bundle the first-use test's new CSS module without its explicit test loader. The test-only loader was corrected and the final suite passed. No product test was weakened.

Independent read-only source review by the semantics agent: **PASS** for authority/receipt fences, version declaration reset, storage policy and wording. No renderer/model change.

## Browser and remaining scope

The root agent owns integration/browser acceptance. The semantics agent separately reports a local Chrome 390×844 dialog measurement (dialog width 359.2, client/scroll width 342/342) with no horizontal overflow and visible draft/version wording. This is a reported local geometry observation, not a hosted run or file-delivery proof; root should reference its browser evidence when recorded. Actual Base/Medium/Full ON/Full OFF files, all-page visual checks, zoom and complete keyboard journey remain pending for the integrated candidate.

Full-default follow-up criteria (recorded before the correction): selecting Full from Base or Medium initializes tree ON; switching tree OFF preserves Full and its full-record/calculation options. Base↔Medium coupling remains unchanged. The existing renderer couples Full's tree with detailed text, and the UI states this actual composition; a separate appendix switch is **N/A** because none was previously supported. Root coordinated the explicit entry-default change, and the browser owner confirmed no active preview/download before the source edit.

Implemented the entry default in `chooseFormat` only; `chooseTree`, renderer, receipt model and composition logic remain unchanged. The actual-parent regression now asserts Base→Full ON, Full OFF retaining Full, and Medium→Full ON. The affected test file passed **4/4**, exit 0, after this final correction: [full-default.log](report-dialog-validation/full-default.log). Changed-file lint and diff whitespace checks passed: [lint log](report-dialog-validation/full-default-lint.log). The earlier 32-test suite and typecheck above precede this one-line default correction; no broad suite was needlessly repeated. Fresh rendered Full-from-Base acceptance is part of root's integrated browser check, not inferred from the earlier Medium→Full observation.

Independent read-only review of this final delta by the semantics agent: **PASS**; confirmed format/tree synchronization, retained exact receipt matching and preview invalidation, with no renderer or authority change. No browser execution was performed for that review.
