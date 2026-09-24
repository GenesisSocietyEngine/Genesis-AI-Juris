# Studio PDF receipt download — 24 September 2026

## Intended outcome and acceptance criteria

The exact `ReportReceiptV2` returned after a PDF download starts must be available to its authorized user in the report dialog and through an explicit JSON download. The dialog must not manufacture a PDF-byte hash, output ID, financial field, approval or new digest. It must retain the last successful receipt when a later PDF generation fails, distinguish changed options/content from the earlier downloaded report, and prevent an old account/case completion from exposing a receipt in another context. Private/sealed receipt-cache restrictions remain in force.

Base source: `773dc47714bda9288dc5e8d2be516790a727ace8`. This change is local only at this review. It is not a native saved version or hosted deployment.

## Change and review

- `app/CaseReportDialog.tsx` retains the actual returned receipt in dialog state instead of closing immediately. The new section displays attribution and all actual receipt fields, and **Download receipt JSON** serializes that same object through the existing `startReportDownload` helper.
- Currentness uses the existing canonical report/layout/presentation binding and `isReportReceiptStale`; changed settings during generation still produce a receipt for the captured download inputs and are labelled as belonging to the earlier PDF. Failed subsequent generation preserves the previous receipt.
- State is scoped to case/account/export authority. A scope or authority change hides the prior receipt immediately; cleanup invalidates pending completion. Explicit receipt download checks the current authority/context again. Preview completion uses the same boundary so an old preview cannot clear a new context's pending state. Closing the dialog remains available; the new receipt button follows the PDF actions in DOM order. Actual focus behavior remains a browser acceptance item.
- One `.case-report-receipt` CSS rule allows long identifiers/JSON to wrap and gives its disclosure a 44px target. Wording says the PDF download was **started**, separately from actual file saving or independent approval.

`case-report.ts`, `report-model.ts`, fingerprint builders, PDF renderer/download helper, device-storage policy, approval gates, working notes/C1 and migration files are unchanged. Existing optional eligible receipt caching is neither expanded nor bypassed. Private/sealed cases use the new in-memory display and explicit owner-requested JSON file download; no receipt content is written to browser storage by the new UI.

## Executed checks

Pinned executable:

`C:/PROJECTS/Genesis-AI-Juris/.worktrees/baseline-recovery-v64/.sites-runtime/tooling/node-v22.23.2-win-x64/node.exe`

| Check | Result | Evidence |
| --- | --- | --- |
| New regression before product change | **Expected FAIL**, exit 1: successful PDF callback called `close()` once, so the receipt could not remain reachable | [pre-fix.log](pre-fix.log) |
| Focused new/existing report checks | **35/35 PASS**, exit 0, no skips | [post-fix.log](post-fix.log) |
| Strict TypeScript | **PASS**, exit 0, no diagnostics | [typecheck.log](typecheck.log), an intentionally empty log |
| Final dialog checks after independent-review refinement | **4/4 PASS**, exit 0, no skips; includes the old-preview/new-context race and revoked export callback. These overlap the previous 35 and are not additive | [final-dialog.log](final-dialog.log) |
| Scoped diff review | **PASS**: no whitespace errors; only dialog/CSS/test/evidence changes | `git diff --check` |

Commands, from the clean-review checkout:

```text
<pinned-node> --import tsx --test tests/report-receipt-dialog.test.ts
<pinned-node> --import tsx --test tests/report-receipt-dialog.test.ts tests/report-first-use.test.ts tests/report-download-recovery.test.ts tests/case-report.test.ts tests/report-model.test.ts
<pinned-node> node_modules/typescript/bin/tsc --noEmit --incremental false
<pinned-node> --import tsx --test tests/report-receipt-dialog.test.ts tests/report-first-use.test.ts
```

The first command produced the recorded pre-fix failure. Test commands ran with the existing installed dependency tree and an approved normal Windows process context because sandbox `tsx` startup has an `os.userInfo` limitation. No dependency installation, network request, C1 rerun or full application suite was performed. The 35-test run verified the initial fix and existing report invariants; final affected dialog checks and TypeScript were repeated after the independent-review refinement.

Committed logs are normalized to UTF-8 without BOM, LF line endings and no trailing blank-line padding; test content and outcomes are unchanged. Original PowerShell captures remain in the ignored local `.artifacts/report-receipt-dialog/raw-logs/` directory. The hashes below identify the normalized Git artifacts.

The new regression bundles the actual `CaseReportDialog` and actual report models, layout, `downloadCaseReport`, `reportReceipt`, private-storage policy and download helper. It models React hook scheduling/DOM and PDF byte rendering, explicitly. It drives the actual PDF/receipt buttons and form callback; parsed receipt-download bytes equal the exact returned receipt. It covers private sealed context, no storage writes, changed options, another PDF failure, changing options while generation is pending, an account boundary before late completion, an old preview completing during a new account's download, and a captured export callback after authority revocation. Existing report tests preserve approval, layout/presentation and privacy contracts. This is component-flow contract evidence, not a browser or actual PDF-layout acceptance claim.

Independent source review found one necessary counterpart: because a changed context resets busy state, pending Preview callbacks needed the same context fence as Download. That fence and a held-preview regression were added. A focus claim was narrowed to DOM order with actual keyboard/focus acceptance left pending. The reviewer inspected the final guards and reported no remaining source must-fix; no broader rerun was requested.

## Artifact identities

| File | SHA-256 |
| --- | --- |
| `app/CaseReportDialog.tsx` | `9a3d10776184e151bd3053d41813817e5afb4433486cc9b5ed7e3637a1cb7bc9` |
| `app/globals.css` | `a0020598498776da780626e9e854930ed653bcdfaccbebae5f9b33701a0686d4` |
| `tests/report-receipt-dialog.test.ts` | `ca0cf4d3bf5e23b073a9bc0898ad3f87321579a24c90713616b05e58bd2db90b` |
| `pre-fix.log` | `af75605acdc6abe2188317667166dff0cfc062a734fb323aebcea3e0590dd7ed` |
| `post-fix.log` | `341eb8341f679c196869b3b2b59fc3e5f30e2b2742c3981cce628213290cd48d` |
| `final-dialog.log` | `a0558029b96e78f9690e8c0e7ad9bfc51932807c3f675db9bac214c38c66f9ab` |
| `typecheck.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

## Remaining acceptance

No hosted acceptance is supplied by this patch. After the existing private review publishes the exact successor, execute only the affected FiveFlats path: saved current case → actual generated PDF download/open → full receipt shown → explicit JSON receipt download/parse → compare the PDF's printed case/report/layout bindings and actual options with that receipt. Hash the actual PDF bytes separately. Verify changed-options attribution, long-field wrapping, keyboard access and explicit close in the real browser. Preserve previous sealed artifacts and distinguish draft output from human approval. Previously accepted C1 paths remain accepted unless a later relevant code change affects them.
