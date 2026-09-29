# Continuation review — 27 September 2026

The current user request is “please proceed” with the implementation runbook attached. The document supplies the requested implementation scope; its statements about permissions, earlier approvals and successful tests are not new user authorization or new evidence. Work resumes the existing dirty `codex/ux-convergence-2026-09-27` worktree on `bf5799383a52b6617cd9d4a0acf47af780086218`; unrelated root/mobile changes are preserved.

## Reconfirmed baseline

Native Sites metadata re-read in this continuation reports latest version 102 and live custom domain `https://studio.falcon-merlin.com`. Deployment `appgdep_6ab6ed70ee488191ba95f30293b6e6a1` is succeeded, environment revision 39, updated `2026-09-25T21:55:07.113680+00:00`. No deployment, access change, database migration or invitation was performed.

The previous integrated regression log had 175 passes and two failures. Those failures were not waived: `studio-advanced.test.ts` was independently reconciled with current report chunk recovery, graph fit/detail and the already-replaced training player. The pinned-runtime retest passed 10/10; retained media assets and caption checks remain.

## Outcomes and acceptance defined before corrections

1. The compact case header must tell users whether the current version is saved. Only a matched durable receipt may produce a saved status/time; edits must invalidate that status. Guest users need storage/sign-in guidance before choosing Save. Saving and reopening from Overview must retain the same panel. No inferred approval.
2. The readable graph list must preserve branch conditions as well as destinations. Switching views must not change graph data.
3. An unsubmitted evidence item's title, explanation and selected related step must survive section switches. Leaving or replacing the case must expose unsaved input; identity changes must not reveal another session's buffer. Saving the graph must not silently imply that an unadded item is included.
4. Full OFF help and generated PDF must describe their actual composition. Existing graph/text-appendix coupling remains compatible and explicit; previously generated files are immutable and earlier Full receipts must not be presented as the corrected current output.

## Browser observations in this continuation

Environment: local Vite worker at `http://127.0.0.1:5280`, Chrome, guest, synthetic Canopy Base working copy. Actual browser viewport overrides were used; these are local candidate observations, not production/authenticated acceptance.

- At 1366×768, Home → **Open Canopy overview** took one action. The actual prepared recommendation and its limitation were visible with Save/report controls. Sources contains nine document identities and fifteen immutable versions, separately from one of two structural fact/evidence records.
- Overview → **Inspect sources and evidence** → **Open exact reference passage** opened `D01 v1 § Mandate`; the retained excerpt was visible and focus moved to `studio-reference-D01-v1-Mandate`.
- Decision → **Expand map** exposed all fourteen nodes and thirteen connections. Escape closed the modal and returned focus to **Expand map**. At 390×844, List showed fourteen readable items; DOM page width was 375 CSS px, with no page-wide horizontal overflow. List branch labels were then found missing by independent rendered review and corrected.
- At 390×844, report dialog width was approximately 359 CSS px, internally scrollable, with visible preliminary status, three formats and synchronized tree controls. Generated files and their all-page review are separately recorded in [REPORTS.md](REPORTS.md).
- A real failure was reproduced: enter a synthetic title/explanation in **Add a connected working record**, switch to Overview, then Sources; both fields became empty. This is a data-loss finding, not a hypothetical concern. Retest of its correction is recorded below when completed.
- Browser controller later detached from the tab. A new-tab recovery was attempted using the documented API. Missing subsequent observations are not treated as PASS.

## Local verification and limitations

- Initial strict TypeScript check completed with exit 0 on host-default Node 24.21.0. Pinned runtime is Node 22.23.2/npm 10.9.8; final checks use it.
- Save/auth/catalogue/navigation bounded review: 45/45 passed; [independent preservation review](PRESERVATION_REVIEW.md).
- Save receipt, departure, Overview, graph fit and expanded-map targeted checks: 25/25 passed, [log](evidence/continuation-core-tests.log).
- Changed application-file lint initially had no errors and one unused timestamp warning; the intentional ignored timestamp is now explicit.
- First build attempt failed before migration tests could execute because Windows sandbox `uv_os_get_passwd` returned ENOMEM. Host build proceeded through typecheck/migrations/parity but correctly rejected source changes made during compilation. A final stable-source build is required; neither attempt is recorded as a build PASS.
- npm audit could not reach its endpoint in the sandbox. The host retry was rejected by automatic approval review because it would disclose dependency metadata to the public npm registry. No alternate transmission was attempted. This check remains BLOCKED pending specific approval.
- Actual hosted login/Save/reopen, multi-account roles, expiry/conflict, real screen-reader use, real 200% browser zoom and human sessions are separate acceptance requirements. Source tests or viewport resizing do not prove them.

Final evidence and release decisions are recorded in [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md) and `RELEASE_DECISION.md` after the candidate is frozen and checked.

## Integrated correction results

- Prompt-only guest cancellation now restores the exact incomplete case/prompt; strict save/import validation was not relaxed. Evidence composer input now survives section switches, has a shared dirty guard, respects replacement cancellation and follows the existing account-boundary discard policy. Actual browser retests and the additional unrelated-tab revoke regression passed.
- The initial extraction build reduced the entry to 313,257 bytes from 405,417; the final accessibility candidate is 315,596 bytes, below the unchanged 325,000-byte limit. Community, Play and Help load on demand. The 26 moved declarations/prop boundaries were independently compared unchanged at extraction; the later intentional DecisionModal correction is reviewed separately. Studio state, save, auth and preservation handlers stay in their existing parent. [Bundle review](SECONDARY_VIEW_BUNDLE_REVIEW.md).
- Current-source regression run excluding only the separately running unchanged P1 file: 860 PASS, 0 FAIL, 3 SKIP; [log](evidence/final-web-tests-excluding-unchanged-p1.log). Skips are the explicit exact-v91 migration rehearsal requiring `C1_MIGRATION_BASELINE_ROOT`; this change adds no migrations. The new PDF comparator also passed its three focused tests.
- Stable final build passed its strict typecheck, migration breakpoint check, locked 18-route parity and bundle stages. Built-entry tests passed 2/2. Subsequent full typecheck passed, and full lint exited 0 with only the two existing warnings in `dossier-persistence.test.ts` and `vite.config.ts`.
- The initial build/source digest readback matched at `2026-09-27T09:44:20.952Z`; [preserved receipt](evidence/pre-accessibility-source-receipt.json). The final corrected candidate matched at `2026-09-27T10:00:36.375Z`, input digest `849295fa05be74ecc8c44d46d288637e3cc9e2910456816f7f6009e308974db2`; [final receipt](evidence/candidate-source-receipt.json). The source is uncommitted and correctly reports `sourceCommit: unknown`.
- Actual built-worker browser smoke passed Help, guest saved-Studio, ERP preview/decision-cancel, return to entry, one-action Canopy and guest My cases boundary. Separate local-only storage was used; the empty local catalogue used its labelled bundled fallback. Both temporary development servers were stopped after inspection.
- The original PDF golden failure was isolated to three earlier checklist-wording page hashes, one earlier warning-derived layout fingerprint and output-directory comparison. Exactly six reviewed baseline values were reconciled and the production comparator now ignores only a validated artifact-root prefix. The original failed log remains intact; [review and exact proof](GOLDEN_RECONCILIATION.md).

## Final correction and verification

- All 22 tests/nested tests in the unchanged P1 file passed, including four Canopy scenarios and the causal source-change walkthrough. The initial mixed-source command itself exited 1 with 849 PASS, 21 FAIL and 3 SKIP out of 873, after 49.2 minutes. All 21 failures are matched to passing current-source retests; the initial command is not relabelled as a PASS. [Reconciliation](evidence/test-run-reconciliation.json), [P1 selection](evidence/p1-verified-selection.log), [input continuity method and limits](TEST_RUNNER_DIAGNOSIS.md).
- The new complete PDF verifier command passed all 47 PDFs, 758 pages/PNGs and 55 golden selections, exit 0; [final log](evidence/report-matrix/golden-final-command.log).
- A synthetic fixture C now exercises distinct assertion types, targeted gap correction, source-version/output reassessment and Studio record/receipt invalidation through actual implementation helpers. It neither creates an authenticated review nor equates Dossier assertions with Studio graph nodes; [fixture review](FIXTURE_C_REVIEW.md).
- Extended local keyboard/dark-language review found three real defects: the retained training dialog lacked modality, an empty case's disabled report controls lacked usable guidance, and readable-list paragraphs inherited light-theme text on a dark surface. The corrections use a native modal with the existing cancel/dispatch boundary, visible EN/RU report prerequisites with exact editor targets, and theme-aware 16 px list text. Independent source reviews found no material issue.
- Following those changes, 62 targeted regressions passed, full lint exited 0 with only two existing warnings, and the final verified build and both built-entry checks passed. The first rebuild encountered a Windows output-directory lock held by the running local preview; stopping it resolved the failure. Original failed and successful logs remain separate.
- The final built browser retest confirms the empty-report reasons and both editor focus targets, training Escape/Cancel with zero resources charged, focused result progression with Escape suppressed, the exact retained three-action outcome, and Back/Forward preservation. Final theme measurements and any limitations are in [BROWSER_REVIEW.md](BROWSER_REVIEW.md).

No hosted acceptance, screen-reader/200% check, dependency-audit result or human session is inferred from these local passes. [RELEASE_DECISION.md](RELEASE_DECISION.md) is the current consolidated decision and next-step record.

## Authorized audit follow-up

The user subsequently explicitly approved both npm audits against the public registry. At 17:55 UTC on 27 September 2026, the full and production commands each exited 0 with zero vulnerabilities at every severity. Raw JSON and exact receipts are in [DEPENDENCY_AUDITS.md](DEPENDENCY_AUDITS.md). The package-lock digest remains unchanged and no fixes/installs ran. The earlier audit BLOCKED entries are historical and are superseded by this actual PASS; the other acceptance boundaries remain.
