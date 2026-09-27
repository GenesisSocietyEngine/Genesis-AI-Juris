# Genesis Juris — reconciled candidate and release decisions

27 September 2026. **Tested application commit: `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`.** Canonical web repository: `C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27`, branch `codex/ux-convergence-2026-09-27`. The commit preserves the earlier local work and adds the reconciliation fixes. Unchanged production was never treated as absence of local progress.

## Separate decisions

| Decision | Result | Reason |
|---|---|---|
| Engineering candidate acceptance | **BLOCKED** | Reviewed implementation and scoped local checks pass. Mandatory integrated acceptance remains incomplete; a build pass is not aggregate acceptance. |
| Production release | **BLOCKED — not published** | Current-candidate hosted acceptance and the complete release-gate run are not established. The supplied hosted URL is existing public production, not separate candidate QA. |
| External pilot | **NO-GO** | No separately evidenced GO; zero of five required real new-user sessions recorded. Professional, data, access and operational pilot conditions are not established by synthetic tests. |

No current known P0/P1 implementation defect is silently accepted. Reproduced defects were fixed and targeted checks rerun. These decisions do not revoke existing publication authorization; its required evidence is not yet sufficient to exercise it.

## Reconciliation and completed implementation

The [initial matrix](RECONCILIATION_MATRIX.md) was returned before implementation continued. Its [stage/UX rows](RECONCILIATION_STAGES_UX.md) and [acceptance rows](RECONCILIATION_ACCEPTANCE.md) remain a dated snapshot. The [42-row closure ledger](POST_RECONCILIATION_CLOSURE.md) records current implementation, commit/files, scoped verification, evidence and remaining actions. No whole stage is complete merely because some controls exist.

Preserved: shared navigation, compact shell, outcome-first Overview, direct Canopy entry, truthful source counts, readable map/list/expanded view, Personal/Team discovery, save/auth/dirty-state protection, three PDF formats and tree ON/OFF, and training behavior.

Additional slices:

- Clarified the two existing tax choices without changing IDs/registry semantics; placed routine technical metadata behind collapsed expert details. [Implementation](SLICE_SETTINGS.md), [independent review](SLICE_1_3_INDEPENDENT_REVIEW.md).
- Made the Sources handoff actionable. Exact same-organization originating Matter context is honored; otherwise the user chooses a case. No title matching, inferred association or copied sources. [Review](SLICE_SAVE_SOURCE_REVIEW.md).
- Fixed the actual saved-case race that replaced the requested map with Brief. Fixed error-body parsing so stale saves reach the conflict state while retaining edits. [Saved-route evidence](SAVED_CASE_STEP_REVIEW.md), [independent assessment](SLICE_SAVE_SOURCE_REVIEW.md).
- Added paginated account export receipts for exact saved Studio versions using the existing audit-event store. Current authorization, immutable actor identity, exact saved content, receipt/layout binding and live session/grant conditions are checked. Retries are idempotent. No PDF bytes, fictional delivery confirmation, independent approval or Studio–Matter association are stored. Account deletion removes receipts; current case access is required. [API contract](STUDIO_REPORT_HISTORY_API.md), [independent critical audit](STUDIO_REPORT_HISTORY_INDEPENDENT_REVIEW.md).

The history audit found and fixed two races: an older retry could overwrite a newer download's status, and mid-read grant revocation could appear as empty history. Regression checks cover both. No known substantive finding from the completed scoped source reviews remains open, according to the implementation report. The source-version/dependent-output acceptance journey remains incomplete; untested paths may still contain defects. No defect reached three unsuccessful fixes in the reported iterations.

## Tested source and evidence

- **Build PASS:** pinned Node 22.23.2, strict TypeScript, all migration breakpoints, locked 18-route mobile contract and all five bundle stages. [Build log](evidence/reconciliation-committed-build.log).
- **Exact identity PASS:** committed and built application input digest `25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec`, 385 inputs, verified 18:35:39 UTC. Embedded commit is `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`. [Receipt](evidence/reconciliation-committed-source.json).
- **Changed-flow regressions PASS:** 101/101, zero skipped, on committed source. [Log](evidence/reconciliation-committed-regressions.log). History API separately 11/11 PASS on fully migrated isolated D1 with ordinary password login and real data/authorization operations. [Log](evidence/reconciliation-history-api-tests.log).
- **Entry checks PASS:** 2/2; 316,867 bytes against unchanged 325,000 cap. [Checks](evidence/reconciliation-committed-entry.log), [size receipt](evidence/reconciliation-committed-entry-size.json).
- **Existing broad evidence retained:** 860 PASS/3 explicit opt-in migration SKIP; prior P1 selection 22 PASS retained with all 111 input hashes unchanged. [Current continuity](evidence/reconciliation-p1-input-continuity.json). Earlier mixed-source 21 failures/exit 1 are preserved and matched to later passes; no single wholly green full-suite command is invented. [Reconciliation](evidence/test-run-reconciliation.json).
- **Public npm audits PASS:** authorized full and production audits at 17:55 UTC, both exit 0/zero vulnerabilities; package/lock files unchanged. [Receipts](DEPENDENCY_AUDITS.md).
- **Actual PDF files retained:** Base 3 pages, Medium 7, Full ON 15, Full OFF 8; all 33 Canopy pages visually inspected within the documented scope. Complete automated 47 PDF/758 page/55 golden verification passed. Later history/navigation work does not alter the renderer. [Files/review](REPORTS.md), [golden proof](GOLDEN_RECONCILIATION.md). Separate prior appendix switch and unsupported zero-node PDF are justified N/A, not fabricated file passes.

**Full lint PASS:** exit 0, with the same two existing unused-value warnings in `tests/dossier-persistence.test.ts` and `vite.config.ts`; no new warnings. [Final log](evidence/reconciliation-committed-full-lint.log). The complete `scripts/verify-release.sh` web/mobile/native gate is **NOT_RUN** for this candidate. Locked contract verification is not a claim that Flutter/Rust/Android/iOS release gates were rerun.

## Actual journeys and remaining acceptance

Local tests use an isolated disposable database and synthetic identities. Accounts were provisioned for QA; tested logins, saves, membership/evidence operations and readbacks use ordinary application boundaries. Controlled expiry alone moved exactly one identified local browser session's expiry into the past. It is not elapsed natural expiry.

Actual Save→reload→Personal My cases→reopen→logout passed; guest cancellation and ordinary sign-in continuation passed. A real stopped-server Save retained edits without claiming Saved; restart/retry succeeded. Controlled expiry retained the exact edit; same-account sign-in in another tab and retry succeeded. On the exact committed build, fresh saved-map restoration and the real two-tab conflict retest passed: the stale tab explains the conflict and retains edits. A real Base PDF download recorded an account receipt, which survived full reload and dialog reopen; tree ON correctly marked it stale. At 390×844 the history and expanded receipt JSON had no horizontal overflow. [Browser closure](RECONCILIATION_BROWSER.md) distinguishes these results by build.

The final actual browser [Base PDF](evidence/final-browser-base.pdf) was independently checked: 33,738 bytes, three A4 pages, correct case/version and visible draft/synthetic/missing-evidence limitations. All three rendered pages were visually inspected. SHA-256 `ca025876662db35c0879874daa8ded21839022e15ba1b47e9e3c94676336ae7d` binds these exact bytes; the existing V2 receipt itself has no PDF-byte hash. Browser and persisted server receipts match. [Inspection metadata](evidence/final-browser-base-metadata.json). Local workers were stopped after verification; isolated data and artifacts remain available.

[Governed fixture C/D](LIVE_FIXTURE_CD.md) records actual owner/contributor/reviewer/viewer roles, outside-actor denial, accepted fact versus pending assumption/contradiction, exact anchors, missing-basis request and stale revision 409 without overwriting the winner. Browser review observed typed states and the exact v1 citation. Synthetic review actions verify software behavior, not professional endorsement.

The supplied hosted access was inspected read-only. The Chrome account owns the named group; the Edge account belongs to the owner's shared personal workspace, not that group. Existing invitation-form state was preserved. No hosted invitations, membership, credentials, logout, data writes or publication were changed. These v102 observations do not test the candidate. Additional role-browser logins remain NOT_RUN; API role/isolation evidence remains separate.

Remaining gates:

1. **BLOCKED:** prepared synthetic source-v2 browser upload and the complete source-version/dependent-governed-output journey. The browser security check was unavailable; its permission request did not complete, so access was not granted. No indirect upload workaround was used.
2. **BLOCKED:** current-candidate hosted Save/auth/role/context and review/output acceptance. Sites shows no separate preview; every Sites deployment URL is production. Existing production accounts are not a candidate deployment.
3. **NOT_RUN:** actual 200% browser zoom and real screen reader. Enabled tools establish viewport/DOM/focus, not actual zoom or assistive-technology reading. Recorded 390×844, tablet and keyboard passes are not substitutes.
4. **NOT_RUN:** remaining full governed review/output history path, exhaustive role/cross-tab/context states and complete FiveFlats canonical-file exercise. Retained ERP/deep-link evidence is narrower.
5. **NOT_RUN:** five human sessions, elapsed natural expiry and complete release script. No agent or synthetic fixture counts as human validation.

## Deployment and preservation

Fresh Sites recheck 18:37:23 UTC confirms public `https://studio.falcon-merlin.com`, latest v102, commit `bf5799383a52b6617cd9d4a0acf47af780086218`, succeeded deployment `appgdep_6ab6ed70ee488191ba95f30293b6e6a1`, environment 39, no preview. [Receipt](evidence/reconciliation-final-production.json). Candidate has not been pushed, saved as a Sites version or published. The web worktree has no Git remote; no new source credential was minted.

Unrelated outer root/mobile branch `feat/professional-product-ui-redesign-pilot-v2`, HEAD `6ca50f24ab3a763ac80e5cd221c15db4a7592fd8`, and dirty Cargo/progress/log/artifact work are preserved. An earlier duplicate fixture review and generated TypeScript cache were retained in ignored local artifacts. Credentials and local databases are not committed. Evidence is committed separately from application source. [Earlier decision](PRE_RECONCILIATION_RELEASE_DECISION.md) is preserved as history.

Before later publication, finish applicable gates and bind evidence to exact release source while preserving public audience, DB and document-store bindings. Known rollback target: v102/bf579938/environment 39; candidate introduces no migration. Roll back on lost/incorrect saved content, authorization regression, source/receipt mismatch or broken PDF output. Operational rollback owner and release smoke/monitoring evidence remain to be recorded, not invented. External pilot requires its separate evidenced GO.


# Review amendment and executable continuation — 27 September 2026

This amendment compares the supplied decision with the complete UX implementation runbook dated 27 September. The original implementation account above is retained, with one narrowed finding-closure statement. This review inspected the supplied decision and runbook, not the linked repository evidence, source code, screenshots or PDFs. Numerical passes, hashes and independent-review claims above are reported evidence, not independently reverified results. Relative evidence links require the repository/evidence bundle; they do not resolve from this standalone attachment.

## Updated assessment

Substantial implementation progress is now documented on candidate `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`; the earlier absence of a local status report is superseded. Do not restart stages 0–6 or duplicate implemented features. The report supports a candidate ready for remaining acceptance work, not engineering acceptance, production release or signature-product readiness. Keep engineering BLOCKED, production BLOCKED and external pilot NO-GO.

Do not calculate a completion percentage from test totals. Tests overlap, scopes differ, and critical untested journeys carry more risk than many passing unit checks. Usability quality and first-use comprehension remain unproven until actual user sessions.

| Runbook scope | Reported progress | Remaining acceptance / evidence |
|---|---|---|
| Stage 0 baseline | Candidate, production and unrelated work distinguished | Open linked 42-row ledger; verify current HEAD, working state and evidence paths |
| Stages 1–2 shell/Overview | Compact shell, navigation, direct demo, tax labels and expert details implemented | Confirm A01 action count, A02 empty/error, desktop first viewport, meaningful outcome and honest confidentiality copy |
| Stage 3 sources | Truthful counts, typed evidence, exact v1 citation, context handoff | Source-v2 upload, inaccessible/deleted source behavior and dependent outputs; exact source in at most two actions |
| Stage 4 decision map | Overview/list/expanded modes retained | Assumption-change impact, source-change impact, data preservation, Fit/readability and keyboard evidence |
| Stage 5 persistence/access | Real local save, reopen, network retry, conflict, controlled expiry and sign-in continuation | Candidate-hosted acceptance, role UI, context switches and cross-account/cross-tab isolation |
| Stage 6 review/reports | Four PDF configurations, actual files, durable receipt, stale layout indication | Full governed review/output lifecycle; case/source change invalidation, permission and version binding |
| Stage 7 integration/accessibility | Scoped regressions, build/lint, narrow-screen checks reported | Actual 200% zoom, real screen reader, applicable release gates and remaining journeys |
| Stage 8 people/release | Honest separated decisions and rollback target | Five real participants, fixes/retests, operational owner and release smoke plan |

## Acceptance reconciliation to perform in the checkout

These are review classifications of the supplied narrative, not replacements for the executor's PASS/FAIL/BLOCKED/NOT_RUN ledger. Open existing evidence before repeating a check.

| ID | Report assessment | Executor action |
|---|---|---|
| A01 demo | Implemented; acceptance detail absent here | Verify Home→Overview action count ≤2 and reference/working-copy distinction |
| A02 empty/error | Not established here | Verify meaningful next action for empty case and real loading failure |
| A03 source | Partial: exact v1 observed | Verify actual fragment/version, ≤2 actions, permission denial and missing source |
| A04 evidence types | Scoped evidence reported | Verify contradiction, assumption and gap actions reach the exact editable object |
| A05 change impact | Incomplete; source-v2 blocked | Complete source and assumption changes through dependent review/output invalidation |
| A06 map | Implemented; full acceptance not established here | Confirm Fit, list/detail, keyboard and model preservation from existing evidence |
| A07 guest/auth | Local passes reported | Verify corresponding hosted candidate continuation/cancellation |
| A08 save/reopen | Local passes reported | Verify hosted candidate persistence and requested context |
| A09 failure/conflict/expiry | Strong scoped local evidence | Verify different-account/logout isolation and applicable hosted behavior |
| A10 roles/context | API evidence; browser gaps | Complete role UI, denied direct requests, context switching and grant revocation |
| A11 review | Incomplete lifecycle | Verify exact-version approval, authorized actor, invalidation and no inherited approval |
| A12 PDF | Strong scoped file evidence | Inspect linked artifacts and renderer continuity; repeat only impacted checks |
| A13 stale output | Layout staleness reported | Complete case/source revision invalidation and historical receipt binding |
| A14 sizes/zoom | Viewports reported, zoom absent | Run actual 200% browser zoom and inspect clipping/reflow/focus |
| A15 accessibility | Keyboard evidence narrower; screen reader absent | Complete supported screen-reader journey, labels, errors and dialog focus |
| A16 compatibility | Preservation reported | Verify training and deep-link evidence; FiveFlats only when available |
| A17 humans | NOT_RUN | Five real new participants, with original task thresholds and intervention logs |

## Execute next in this order

1. **Reconcile without rebuilding completed work.** Read applicable AGENTS.md, the runbook, current closure ledger and evidence. Confirm canonical worktree, current HEAD and dirty state. Preserve unrelated work. Record implementation, verification and deployment separately for every stage, UX01–UX16 and A01–A17. Attach missing evidence or mark the specific gap; do not turn missing evidence into an invented defect.

2. **Complete the distinguishing source-to-decision journey first.** Use synthetic fixture C/D through permitted ordinary application paths: open conclusion→exact v1 source→upload v2→observe old citation and dependent conclusion/review/report state→reassess using authorized role→save/reopen→generate a new correctly marked report. Change an assumption separately. Confirm old exports remain historical, new content does not inherit approval, and unsupported recomputation says Requires reassessment. Include inaccessible/revoked source behavior. If the browser permission check remains unavailable, retain that exact BLOCKED status; do not use another tool to bypass it. Continue independent work.

3. **Close local access and review gaps.** Exercise owner/contributor/reviewer/viewer with existing authorized synthetic accounts; verify UI and server denial separately. Cover wrong organization, changed workspace, revoked grant in a second tab, logout then different-account login, stale save and exact-version review. Check both absence of data leakage and retention of edits according to the existing contract. Do not send real invitations or alter hosted memberships for convenience.

4. **Run available release checks and accessibility.** Inspect the current release script and required scope. Run applicable gates; classify unavailable native toolchains individually. Do not silently waive an established gate or imply web/mobile/native completion from the locked mobile contract. Actual 200% browser zoom and a real screen reader remain distinct tasks; DOM and viewport checks cannot substitute. Controlled server-side expiry is valid expiry-path evidence. Elapsed natural expiry is not an additional mandatory gate unless project policy or a concrete timing-related risk requires it. FiveFlats is conditional on available authorized canonical materials; document justified N/A if unavailable instead of inventing data or making it an unconditional blocker.

5. **Establish an isolated candidate deployment through supported project tooling.** First inspect actual Sites capabilities and project instructions; absence of an existing preview does not prove that no isolated candidate environment can be created. Use an authorized supported private/review environment if it preserves authentication behavior and isolates synthetic DB/document bindings from production. Do not relabel the public v102 URL as candidate QA or clone sensitive production data. Verify exact deployed source/environment, then hosted Save/auth/role/context and review/output. If provisioning is genuinely unavailable, document the precise missing prerequisite and continue local checks. Do not publish to production just to satisfy pre-release hosted acceptance.

6. **Run the recursive audit on completed journeys.** Give an independent reviewer the diff, acceptance criteria and evidence, including user-facing screenshots. Reviewer first follows the task, then inspects implementation. Record defects with severity, fix commit and retest. After three failed attempts on the same defect, change the approach. Retain P2 owner/impact; do not reopen proven checks without a changed dependency or required gate. Scope receipts and history work to the runbook; do not add new features to postpone acceptance.

7. **Complete human and operational acceptance.** Five real unfamiliar users: ≥4/5 identify conclusion and source within 90 seconds; ≥4/5 create, save, reopen and export without critical help; 5/5 distinguish draft from approved. Preserve failures and interventions; use new participants when retesting first-use comprehension. Do not substitute agents. Prepare named rollback ownership, exact rollback version/environment, smoke checks and monitoring signals. Keep external pilot NO-GO until its separate conditions are evidenced.

8. **Return decisions bound to release source.** Update the existing ledger and RELEASE_DECISION with exact build/environment, verified evidence, remaining blockers and next owner/action. Existing valid evidence may carry forward only with documented dependency continuity. Engineering GO requires mandatory engineering acceptance; production GO requires applicable release gates, hosted checks and operational readiness; pilot GO additionally requires human/data/access/operational criteria. Proceed with already-authorized publication only when its gates are met, then verify live source and smoke; invoke the approved rollback for critical regressions.

## Execution availability in this reviewing session

The implementation device was checked again during this review and is offline. This scratch workspace contains the reports, not the candidate checkout. Consequently this amendment has not run tests, changed application code, published, or been delivered to the separate Codex session. The next execution prerequisite is access to the existing candidate checkout (reconnected device or supplied repository with its evidence), not renewed permission to continue. Use the ordered instructions above in that existing session once accessible.
