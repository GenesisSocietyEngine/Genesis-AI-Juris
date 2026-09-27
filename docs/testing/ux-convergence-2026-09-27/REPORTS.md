# Report verification — 2026-09-27

Scope: an independent review of the existing Stage 6 dialog changes, focused regression tests, and actual Canopy Base, Medium, Full ON and Full OFF PDFs from the integrated local renderer. Source baseline `bf5799383a52b6617cd9d4a0acf47af780086218` plus the uncommitted UX convergence worktree. No publication or external pilot is authorized by this review.

## Acceptance recorded before verification

- Preserve the three depths and Base/Medium tree synchronization; Full initializes ON and remains Full when switched OFF.
- Distinguish draft, save, reviewer declaration, recorded approval and download-started status; clear the declaration on version/authority change.
- Keep preview and receipt input binding, authorization fences, private-storage policy and collapsed technical receipt details.
- Produce real files using the existing renderer, inspect all pages and compare text, graph presence, metadata, version and fixture values. Renderer evidence is separate from browser download delivery.
- Preserve the existing Full graph/text-appendix coupling, visibly explained by the UI. A separate appendix switch was not supported before this change (N/A); no silent renderer-contract change.

## Results

The real Full OFF PDF exposed a dialog wording defect: its help promised that full records remain included with either tree setting, although switching OFF also removes the complete node/connection appendix. Canopy's D08 actor detail is absent from Full OFF. Before correcting the wording, the acceptance criterion is: explicitly describe both graph and detailed text removal, preserve selected case sections/calculations and all existing format behavior. The renderer remains unchanged. No file/browser PASS is inferred from a successful component test.

Follow-up scope authorized by the coordinating agent: correct the Full PDF decision brief's inaccurate promise that the appendices always contain every record, and its unconditional instruction to check branch conditions in an appendix. Acceptance: Full OFF names the omitted text appendix and directs readers to the case; Full ON describes the included complete graph appendix. Neither composition nor fixture changes. Revise only Full's presentation binding so old immutable receipts cannot pass as the revised wording. Preserve the initial four files and regenerate the two Full outputs in a separate directory; inspect their changed page 2 and compare unchanged page text.

## Verified local results

| Check | Status | Evidence and scope |
| --- | --- | --- |
| Existing dialog changes, independent source review | PASS | Format/tree synchronization, exact-version declaration reset, immediate stale preview removal, immutable earlier receipts, account/eligibility fencing, private-storage exclusions and truthful download-started wording reviewed. No authorization or storage policy changed. |
| Focused dialog/model/renderer regressions before follow-up wording | PASS | 32/32 on host Node 24.21.0. `node --import tsx --test tests/report-receipt-dialog.test.ts tests/report-first-use.test.ts tests/report-model.test.ts tests/report-decision.test.ts tests/report-download-recovery.test.ts`. The first sandbox attempt failed at `uv_os_get_passwd ENOMEM` before application tests ran; that bootstrap failure is not reported as a product failure or PASS. |
| Dialog wording retest | PASS | 7/7 on pinned Node 22.23.2: `tests/report-receipt-dialog.test.ts tests/report-first-use.test.ts`. Actual parent callbacks/model/download helper executed; React scheduling/DOM and renderer are modeled by the existing harness. Full OFF still selects Full and explicitly explains omission of both graph and text. |
| Renderer correction regression | PASS | 37/37 on pinned Node 22.23.2: `tests/report-decision.test.ts tests/case-report.test.ts tests/case-report-economics-selection.test.ts`; [complete log](evidence/report-matrix/renderer-retest.log). EN/RU wording, original format behavior, economics selection, real pagination, privacy, redactions and receipt freshness passed. The new prior-hash assertions preserve Base/Medium receipt identities and supersede both earlier Full identities. |
| Changed-file lint and whitespace | PASS | ESLint exited 0 for `CaseReportDialog.tsx`, `case-report.ts`, `case-report-brief.ts`, `report-receipt-dialog.test.ts`, `report-decision.test.ts`. Scoped `git diff --check` exited 0. Root owns final integrated typecheck/build. |
| Real Canopy files and all-page visual review | PASS | All initial 33 pages inspected individually from Poppler PNGs at 110 dpi. No clipping, overlap, blank pages, missing glyphs or broken tables found. Page numbers, table continuation headers, source text and graph page connectors were readable. Latest Full page 2 in each file re-inspected after correction; all other 21 Full page PNG SHA-256 hashes exactly match the already inspected originals. |
| Final complete repository PDF verification | PASS | A new full `reports:verify` invocation generated and checked 47 PDFs, 758 pages and 758 PNGs, then passed all 55 golden selections; exit 0. Pinned Node 22.23.2 / Poppler 25.07.0; [final command log](evidence/report-matrix/golden-final-command.log), artifacts `.artifacts/ux-report-golden-final`. This is automated harness evidence; visual review scope remains as recorded above and in the reconciliation note. |
| Fixture/version/content binding | PASS | Canopy `project_canopy_managed_site_expansion` v2.0.0, 14 nodes/13 links. Input unchanged by generation. All reports share the same case/model content fingerprint and carry distinct presentation fingerprints. Full visibly names v2.0.0; Base/Medium carry exact version in their receipt rather than visible PDF text. |
| Browser file delivery / saved-by-user | NOT_RUN in this pass | Files here are written through the real local `createCaseReportPreview` renderer. They prove PDF bytes/rendering, not browser download delivery or that a user saved a file. Earlier browser observations remain separately scoped in `INDEPENDENT_BROWSER_REVIEW.md`. |
| Authenticated server export history / approval | NOT_RUN in this pass | The dialog's device receipt is not server export history. No actual workspace save, governed approval, authorized account/role transition or pilot action performed. |
| Case without graph records | Local guard and explanation PASS; empty PDF unsupported/N/A | A synthetic titled draft with 0 nodes/0 links was passed to the real production renderer in Full/tree ON and Base/tree OFF. Both stop before PDF creation with `ReportGraphLayoutError` / `INPUT_INVALID`: `presentation.sourceNodeCount must be between 1 and 200`. No PDF bytes were produced. [Exact attempt receipt](evidence/report-matrix/no-graph/renderer-attempts.json). The follow-up below adds an explanation and direct editor steps beside the actual disabled report controls. Actual JSX renders/callbacks passed for 10 EN/RU prerequisite states; final browser verification belongs to the coordinator. No empty-file or browser PASS is inferred. |

## Current PDF samples

Generated with pinned Node 22.23.2, pdfmake through the application renderer and Poppler 25.07.0. Role/options: anonymous synthetic local draft, English, internal audience, draft classification, no reviewer declaration, no workspace-save claim, default inclusion options. Initial generation timestamp `2026-09-27T09:04:28.742Z`. The revised Full run retained that supplied timestamp to permit exact unchanged-page image comparison and completed at `2026-09-27T09:10:07.429Z`.

| Current file | Pages / bytes | Graph / complete graph text | Review |
| --- | --- | --- | --- |
| [Base](evidence/report-matrix/canopy-base.pdf) | 3 / 33,738 | OFF / absent | All pages inspected. Draft and conditional review agenda are explicit; 300 signed commitments against 450 minimum retained. |
| [Medium](evidence/report-matrix/canopy-medium.pdf) | 7 / 98,580 | 4 visual graph pages / absent | All pages inspected. Base narrative preserved; 14 nodes and cross-page connectors readable. |
| [Full ON, corrected](evidence/report-matrix/revised-full/canopy-full-on.pdf) | 15 / 191,953 | 4 visual graph pages / present | Original 15 pages inspected; corrected page 2 re-inspected, 14 other PNG hashes identical. Detailed D08 staffing condition and pinned node/connection text present. |
| [Full OFF, corrected](evidence/report-matrix/revised-full/canopy-full-off.pdf) | 8 / 81,474 | absent / absent | Original 8 pages inspected; corrected page 2 re-inspected, 7 other PNG hashes identical. Profile records, selected registers, review trail/sign-off and numeric scenario detail retained; complete graph appendix explicitly omitted. |

[Original matrix and exact hashes/receipts](evidence/report-matrix/matrix.json); [revised Full matrix and exact hashes/receipts](evidence/report-matrix/revised-full/matrix.json). Original Full PDFs/receipts remain untouched as evidence of the finding; use the revised files above as the current samples. Receipt JSON and extracted text sit beside each PDF. These local samples are not independently approved deliverables.

## Findings, fixes and compatibility

1. **Fixed: misleading Full OFF completeness promise.** The dialog said full records remain included with either setting, and page 2 said appendices retain all records while directing the reader there for branch conditions. Actual Full OFF correctly followed the existing renderer contract and omitted the complete graph appendix, including actor detail. The dialog now explicitly describes both omissions. Full's decision brief directs readers to the case and reports whether its complete graph appendix is present. No record, source, graph setting or fixture changed.
2. **Receipt compatibility.** A Full-only `fullBriefRendererVersion: 2` in the existing presentation fingerprint invalidates old Full receipts without changing canonical content or Base/Medium identity. No stored receipt is rewritten. Tests compare against the actual original four matrix fingerprints.
3. **Preserved contract.** Full OFF remains Full. Its selected professional sections stay available, while the complete node/connection appendix remains coupled to the tree as in v102. An independent text-appendix control did not exist; none was added. This limitation is now explicit in UI/PDF copy.
4. **Observed limitation: visible version in shorter reports.** Base/Medium do not print v2.0.0 in the body; their exact version is in the accompanying immutable receipt. This pass preserves that renderer behavior and does not claim visible-PDF version labeling for those depths.
5. **Observed limitation: a zero-node case cannot produce a report.** A bounded local check used a separate synthetic `general_advisory` case with a title and author-reviewed narrative but no nodes/connections. Both Full ON and Base OFF invoke graph-model validation and fail before generating PDF bytes. There is therefore no actual no-graph PDF whose explanation/layout can be inspected in this contract. The input remained unchanged. The script completed normally on pinned Node 22.23.2 while recording those expected renderer failures; its exit 0 is not a PDF-generation PASS. [Command output](evidence/report-matrix/no-graph-command.log), [exact errors and readiness](evidence/report-matrix/no-graph/renderer-attempts.json). No production code was changed to bypass the contract. A12's zero-node PDF itself is unsupported/N/A; the corresponding disabled-output explanation is verified separately below.
6. **Fixed: report prerequisites were hidden behind disabled entry points.** Browser review found that the zero-node guard prevented opening the dialog, so its readiness explanation could not help a user on the Reports tab. The coordinating agent authorized a bounded `JurisApp.tsx` JSX correction. The existing `!canDuplicate || !draft.title.trim() || !draft.nodes.length` eligibility expression and renderer guard remain unchanged. Both the header report action and Reports card now have an adjacent EN/RU explanation, linked with `aria-describedby`. Missing title and missing records are distinguished; the existing `openStudioAction` targets open the title field or case brief. Inspection-only access exposes its own reason and no editing actions. These are working-copy actions and do not create a file, save or approval.

### Report prerequisite follow-up evidence

Acceptance before implementation: an empty case must visibly explain why PDF creation is unavailable and how to reach the existing editor; a missing title must have a specific action; inspection-only access must stay protected; no zero-node PDF should be fabricated.

- **PASS, 10 cases:** extracted the actual prerequisite JSX with the TypeScript AST and rendered it for EN/RU empty, titled-empty, untitled-with-record, eligible and inspection-only states. Invoked its real button closures and checked the exact existing editor targets: step 3 / `studio-title`, step 1 / `studio-case-brief`. Eligible drafts show no blocker; inspection-only states show no editor buttons. [Successful render/callback log](evidence/report-prerequisite-render-success.log). The first stdin probe was rejected by JavaScript before execution because PowerShell replaced Cyrillic text in its regex; the UTF-8 script rerun above passed. That probe failure was not an application failure.
- **PASS, 1/1:** existing `Studio UI exposes intuitive blank reset, selectable relation deletion and dark option contrast` test in `studio-advanced.test.ts`, including the existing report-eligibility and recoverable-opening contracts. [Log](evidence/report-prerequisite-existing-test.log). No test expectations were changed.
- **PASS:** scoped ESLint for `app/JurisApp.tsx`, exit 0 with no diagnostics, and scoped `git diff --check`. [Focused review diff](evidence/report-prerequisite-only.patch) isolates this JSX correction from the earlier parent-component work.
- Final rebuilt browser layout, editor focus and overall build validation remain the coordinator's checks. No renderer change or repeat of the 47-PDF matrix was needed for this JSX-only correction.

The report-verification agent independently reviewed the earlier dialog implementation. The follow-up wording/binding correction above is this agent's implementation and self-review; root's independent final review remains separate. No unverified browser, accessibility, authenticated persistence or release claim is made.

## Repository PDF baseline gate

**Current status: PASS after reconciliation and a new complete verification command.** The final command receipt is below. The earlier failure and its diagnosis are retained here as historical evidence.

**Historical FAIL, not a report-correction regression.** One normal pinned `scripts/verify-report-pdfs.ts .artifacts/ux-report-golden-review` run completed all **47 PDF checks and 758 rendered pages**. It then exited 1 at the exact visual-baseline comparison. [Complete gate log](evidence/report-matrix/golden-verification.log). No baseline-update flag was set and no golden lock was edited during that diagnostic run.

The first failure is an artifact-root mismatch: baseline entries hard-code `.artifacts/v62-report-qa/...`, while this deliberately isolated run writes `.artifacts/ux-report-golden-review/...`; the first compared Bhopal image hash is identical. A separate read-only comparison accounting only for that known root difference found unchanged baseline metadata and all 55 selection entries, plus these additional differences:

- PNG hash: `stress-deep` page 10, `stress-disconnected` page 8, `stress-long-detail-ru` page 21.
- Layout fingerprint metadata: all three `stress-fan-out` selected entries; their PNG hashes remain identical.

[Root-normalized comparison](evidence/report-matrix/golden-comparison.json) preserves the exact differences; it is diagnostic evidence and does not convert the failed gate to PASS.

**Bounded cause isolation: PASS.** An isolated esbuild bundle substituted the exact `HEAD` versions of `app/case-report.ts` and `app/case-report-brief.ts` (`bf5799383a52b6617cd9d4a0acf47af780086218`) while keeping the candidate's other dependencies, fixtures, options and pinned tools. It rendered only the three differing pages and derived fan-out metadata. Each pre-correction result exactly matched the current candidate result. Thus all four baseline-difference groups already occur before this report wording/binding correction; their underlying cause is not established here. [Exact before/current/baseline hashes](evidence/report-matrix/golden-impact-isolation.json). The first host attempt hit Git's worktree ownership check; the rerun used a command-local safe-directory setting only, with no global Git change.

At that point the golden gate remained **FAIL** pending separate resolution of path comparison and those existing differences. The 47 per-file passes alone did not establish a release-gate PASS. The report correction itself was verified by the targeted tests, real Canopy files, all-page review and bounded before/after isolation above.

### Subsequent bounded reconciliation

The failure above is retained as historical evidence. [GOLDEN_RECONCILIATION.md](GOLDEN_RECONCILIATION.md) subsequently identifies every difference exactly, records visual review of the three affected pages, and documents the coordinating agent's narrow six-value reconciliation. The production comparator now validates artifact-relative page identity independently of the output directory. Its final comparison passes for the existing 47-PDF/758-PNG corpus and all 55 golden selections, with every retained PDF/PNG hash rechecked. This is a successful comparison of the existing complete corpus, not a new invocation of the full generation harness or hosted acceptance.

### Final complete command receipt

After that bounded comparison, a **new full generation and verification invocation** completed on 27 September 2026: `npm run reports:verify -- .artifacts/ux-report-golden-final`, whose logged script is `node --import tsx scripts/verify-report-pdfs.ts .artifacts/ux-report-golden-final`. The coordinator confirmed session `61250` exited **0**. The pinned runtime was Node 22.23.2; the resulting manifest records Poppler 25.07.0 and all-page PNG rendering at 96 dpi.

- **PASS:** 47 PDFs, 758 report pages and 758 rendered PNGs.
- **PASS:** visual baseline `parity/report-pdf-visual-baseline.v1.json`, all 55 selected PNGs, fingerprint `bac3a7bdebd662edd043a297e39c1c4000716327ac110b0db7453b1d8a3323c8`.
- [Complete final command log](evidence/report-matrix/golden-final-command.log); fresh manifest and candidate are under `.artifacts/ux-report-golden-final`.

The repository PDF verification gate is no longer pending. The earlier failed command remains a failure in the historical record. This final automated PASS does not expand the recorded visual-review scope or claim browser file delivery, authenticated approval, human acceptance, or publication authority.

### Final report-prerequisite browser closure

Root independently reviewed the isolated JSX change and existing guard/focus-action integration. The final built candidate `849295fa05be74ecc8c44d46d288637e3cc9e2910456816f7f6009e308974db2` passed strict build validation and 62 relevant regression tests. Actual browser retesting confirmed both visible empty-report explanations, Add case title focusing `studio-title`, the reason updating after title entry, and Open case brief focusing `studio-case-brief`. [Final browser record](BROWSER_REVIEW.md). This closes the explanation defect; it does not claim generation of an unsupported zero-node PDF or hosted delivery. The renderer was unchanged by this final JSX correction, so the completed 47-PDF matrix remains applicable.
