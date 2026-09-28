# Production private-read source continuity — static provenance only

Checked 2026-09-27T22:01:28.787Z. **PASS_STATIC_SOURCE_CONTINUITY: 19/19 deployed-source Git blobs match the exact pre-patch SHA-256 values in the applied-patch receipt.** All 19 also match the pre-correction baseline; all 19 corrected local blobs match the recorded after hashes and differ from those deployed-source blobs.

The last recorded production metadata check (2026-09-27T20:55:35.286Z) identifies public v102/environment 39 with source `bf5799383a52b6617cd9d4a0acf47af780086218`. This task did not refresh production metadata. The coordinating agent plans a separate fresh read-only metadata recheck; if its source has changed, reassess this attribution before claiming a current production conclusion.

## Exact evidence

- Production-attributed source: `bf5799383a52b6617cd9d4a0acf47af780086218`.
- Pre-patch baseline: `6ab091d830ccfd9d6b76c0adc177341bca96e081`.
- Corrected local source: `e6c6adc6fe01129b2e3d442072c532e08591fae9`.
- Applied-patch receipt: `.artifacts/ux-reconciliation-auth/matter-read-fence/applied.receipt.json`, SHA-256 `f2a056616b719368e47ed5e8d501dca25814d40bddcb9a17107fcd841c9be822`.
- Reviewed patch SHA-256: `4c044bc5548945a9ee639d750c1452e0a41475cc79f02434afd14ec80191d5bf`.
- Per-file raw Git blob IDs, byte lengths and SHA-256 comparisons: `production-read-fence-source-continuity.json` beside this note.
- Reproducible checker: `check-production-read-fence-source-continuity.mjs` beside this note.

Each file was read as raw bytes using `git cat-file blob <commit>:<path>`; no PowerShell text conversion or worktree line-ending normalization participates in the hash. Canonical HEAD stayed exact and the tracked worktree stayed clean. The aggregate and owned emulator were left untouched.

## Interpretation and limits

The source commit recorded for production contains the **same pre-patch implementation** reviewed for the Matter private-read authority race, including the detail route used by the synthetic paused-read regression. The current correction is **local and not deployed by this task**. A previously green aggregate on the pre-patch baseline does not remove the subsequently identified source-level defect.

This is not a claim that all 19 paths share an identical missing guard: the patch includes JSON/list final-authority fences and strengthens some existing private-byte delivery guards with the shared live-identity boundary. The source inventory and independent patch review describe those distinctions. The equality proof transfers the inspected source provenance; it does not expand the in-process regression to every route or authenticate a live production session.

No production HTTP/authentication, user data, browser action, upload, audit query or exploit reproduction was attempted. No actual disclosure or affected account is asserted. A source commit association is not an independent hash attestation of the deployed binary. The corrected candidate's running aggregate, remaining hosted/browser/UX acceptance and any release action keep their separate status; this static PASS does not close them.
