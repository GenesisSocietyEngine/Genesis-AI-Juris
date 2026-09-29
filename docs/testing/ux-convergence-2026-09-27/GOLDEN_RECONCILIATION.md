# PDF golden reconciliation — 27 September 2026

## Scope and result

**PASS for the final complete PDF verification command after the narrow reconciliation.** A new `reports:verify` invocation generated and checked 47 PDFs / 758 pages / 758 PNGs and passed all 55 golden selections, exit 0. The complete command receipt is below.

Before that new invocation, the production comparator accepted the same validated PNG page locator under a different artifact output directory, while retaining exact hashes, page suffixes, selection and all other metadata. It compared all 55 selected entries successfully. All 47 retained PDF hashes and all 758 retained PNG hashes were independently recomputed against the existing manifest. No PDF was regenerated for that earlier comparison-only step.

The original full verification command failed; its [complete log](evidence/report-matrix/golden-verification.log), [diagnostic differences](evidence/report-matrix/golden-comparison.json) and [HEAD renderer isolation](evidence/report-matrix/golden-impact-isolation.json) remain untouched. The later successful results resolve that comparison failure without relabeling the historical command or establishing hosted/browser/human acceptance.

## Exact cause and source provenance

The tracked baseline was last intentionally reviewed in commit `605dc0f4a4cd9d8a3c28f888c23bd36ca536ee81` on 11 September. Source baseline for this continuation is `bf5799383a52b6617cd9d4a0acf47af780086218`.

1. Three selected PNGs differ only because the Verification/sign-off checklist changed from “Economics and probability weights are independently recalculated.” to “Economics and scenario assumptions are independently checked.”, with its corresponding Russian translation. That source change is already present in commit `c90f943ebd51353cd37bb776a77729187e03573c` on 25 September. It predates this continuation's Full OFF wording correction.
2. Fan-out's case fingerprint and its three selected PNG hashes are unchanged. Its report model includes readiness warnings. The evidence warning changed from `Facts or evidence: add 2 more` to `Facts or evidence: 0 of 2 required records present. This checks structure; evidence sufficiency needs review.` in `2a6e4ae16a5547b415951dcb5f6dfd2a672f4d92` on 24 September, subsequently composed in `6dd1d7bd05a588e2969eae9fc6bbc0f745fb5165`. That changes the report content fingerprint and therefore the layout fingerprint, without altering these selected images.
3. `verify-report-pdfs.ts` accepts an isolated output directory, but previously deep-compared the full repository-relative PNG path. The baseline points to `.artifacts/v62-report-qa`; this corpus is under `.artifacts/ux-report-golden-review`. The locator prefix was being treated as visual identity.

## Visual review and exact isolation receipts

The baseline-discovery agent used the PDF skill and inspected all three affected current pages at their actual 794 × 1123 resolution: `stress-deep` page 10, `stress-disconnected` page 8 and `stress-long-detail-ru` page 21. Checklist text is readable; headings remain with their blocks; the audit/sign-off tables, fingerprints, headers and page numbers are intact. No clipping, overlap or missing glyphs was observed on these pages. This is agent visual inspection, not independent human approval or a claim to re-inspect every corpus page.

Two bounded diagnostics used pinned Node 22.23.2 and Poppler 25.07.0. The first sandbox attempt failed during tsx's Windows user lookup (`uv_os_get_passwd ENOMEM`) before application code ran; the approved host invocation succeeded. All counterfactual PDFs/PNGs stayed in memory and passed through stdin/stdout; no product, golden or diagnostic PDF file was changed by these experiments.

- For each of the three affected fixtures, build the current real application definition with the existing release-fixture options. Replace exactly one checklist sentence in that definition with its historical EN/RU sentence. Render the selected page at 96 dpi. Each resulting PNG hash exactly equals its prior golden hash; this proves the whole PNG difference is explained by that sentence.
- For fan-out, replace only the evidence warning in a cloned canonical report model, recalculate its canonical content fingerprint, then derive/build its layout. The report fingerprint returns to `sha256-f0aff5270192b9fd0445911ef5a5df03ce9396e725c7eda04f6f4790efdada85` and the layout fingerprint returns to `sha256-7766bc9ee3f4977befa9e1e58fa22a20b15182163c552b34b6e362cc3becaf15`, exactly the historical values. The current values are `sha256-be41a560096535832df5c586e9b008ec03f2a9c8b3b85a12e0478886932c8e2b` and `sha256-7261a09c61fa9ac9f10c367962d04b6d088c052701b916600c8b790ed1ddb52f`.

| Page | Historical PNG SHA-256, exactly reproduced by the one-sentence reversal | Current reviewed PNG SHA-256 |
| --- | --- | --- |
| Deep 10 | `5b91c20c3aa772ee994be95bcb0295c8f8447fd89de32e1f1807fd1ff7f1bcf1` | `0536cb2823ac3991b42ae479ec0cee050ecb9829047b467675d66ed51f53ad76` |
| Disconnected 8 | `1bea4899da651dc39f1881c1e870a0484cbc70bbd1619ab1db5f0534db83632e` | `0e5ce8440f6a3b8966af19e4bb1a2749d153650b33ab7037bb6c933a464dee15` |
| Long-detail RU 21 | `dd944ec6218e7e56adb5f2dafcc89fe57bc08943a35e2096abfc6dfe44d36a51` | `5fef494757edcc47b8b7882713f6cb127bf638ea59004fda707d9ef446f7407a` |

## Bounded implementation and validation

After reviewing the concrete evidence, the coordinating agent authorized exactly six scalar golden edits: the three PNG hashes above and the fan-out layout fingerprint on its first/middle/last entries. An automated comparison with `HEAD` verifies that every other baseline value is unchanged. The update environment flag was never used; there was no bulk golden rewrite or app source change.

`scripts/tests/report-pdf-visual-baseline.ts` exports the comparator used by the production verification script. Both paths must be portable relative paths below `.artifacts`, without traversal. The current root must match the caller's declared output directory; the baseline entries must share their recorded root. The suffix must identify the exact fixture and report page. Only the validated root is removed for comparison. Exact PNG suffixes, hashes, layout fingerprints, dimensions, page roles, selection keys and root metadata remain governed. Existing explicit baseline-update behavior still retains the recorded artifact location.

| Check | Result | Evidence |
| --- | --- | --- |
| Comparator behavior and negative regressions | PASS, 3/3 | [Test log](evidence/report-matrix/golden-comparator-tests.log): root-only relocation, no input mutation, traversal/undeclared root/wrong fixture/wrong page rejection, changed hash/layout/dimension/suffix/selection/runtime rejection and duplicate rejection |
| Existing corpus and exact six-value golden scope | PASS | [Comparison log](evidence/report-matrix/golden-reconciliation-compare.log): exported production comparator, 55 entries; all 47 PDF and 758 PNG bytes rehashed against their manifest; six baseline fields only |
| Scoped ESLint | PASS, exit 0 | [Log](evidence/report-matrix/golden-reconciliation-lint.log); helper, production verifier and new test |
| New complete PDF verification command | PASS, exit 0 | [Final command log](evidence/report-matrix/golden-final-command.log): fresh 47-PDF/758-page/758-PNG corpus and all 55 baseline selections |

## Final complete command receipt

On 27 September 2026, `npm run reports:verify -- .artifacts/ux-report-golden-final` ran the logged script `node --import tsx scripts/verify-report-pdfs.ts .artifacts/ux-report-golden-final`. The coordinator confirmed session `61250` completed with exit code **0**, using pinned Node 22.23.2 and Poppler 25.07.0. The fresh manifest confirms 47 fixtures, 758 report pages and 758 rendered PNGs, with all-page rendering at 96 dpi.

The final production comparator reports **PASS** for `parity/report-pdf-visual-baseline.v1.json`: **55 PNGs**, fingerprint **`bac3a7bdebd662edd043a297e39c1c4000716327ac110b0db7453b1d8a3323c8`**. Artifacts are in `.artifacts/ux-report-golden-final`; the [complete output](evidence/report-matrix/golden-final-command.log) retains every per-fixture result and the final summary.

No repository PDF verification gate remains pending. This new automated full-harness PASS does not claim that all 758 fresh images received visual inspection; the exact visual review remains the Canopy review in [REPORTS.md](REPORTS.md) and the three affected pages documented above. Historical failures and authenticated/browser/human-review limitations remain unchanged.

Final integrated typecheck/build, source review and the overall release decision remain the coordinator's responsibility. This reconciliation grants no publication authority and makes no new authenticated or pilot claim.
