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

The history audit found and fixed two races: an older retry could overwrite a newer download's status, and mid-read grant revocation could appear as empty history. Regression checks cover both. No substantive source finding remains open; no defect reached three unsuccessful fixes.

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
