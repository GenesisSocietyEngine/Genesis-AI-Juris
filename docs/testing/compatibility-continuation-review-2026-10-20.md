# Compatibility and production acceptance — 20 October 2026

## Outcome and acceptance defined for this slice

Close the production narrow-list visual gap; observe ordinary authenticated unsupported-file recovery without altering saved work; implement reproducible execution of original historical **data modules** against historical/current carriers. Do not turn that evidence into historical-browser, all-package saved-case or migration acceptance. Preserve every production case and the existing export/authority gates.

## Verified source and Sites receipt

Before editing: clean isolated checkout and freshly fetched canonical main `e490a34b21ab2a1e32b6209e320d73f981fd2798`. The difference from deployed runtime `d4547efd3fcc1f36207f121ffe43348fc8530f6f` is five Markdown files only. Native Sites still reports public **v150**, saved ID `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_c820306242908191adfc736920de31da`, deployment `appgdep_6ad68a5c097481919cce18ae1400be04`. Supported source opening returned this exact canonical HEAD. This slice changes verification tooling/tests/documentation, not application inputs; no new runtime publication is warranted.

Other writer's root paths are unchanged: `Cargo.toml`, `docs/development/CURRENT_PROGRESS.md`, untracked `docs/development/TAX_ECONOMICS_V2_INTEGRATION_PLAN.md`. All work is in the isolated checkout.

## Production browser evidence

Authorized Chrome Maxim Hayan session. Fresh browser capture now works. Because the profile's site zoom scales requested sizes, first requested390 measured585 CSS pixels. Requested260 then measured **390 CSS pixels**, client width **367**, document scroll width **367**, in both English and Russian. Search/sort/actions stack and wrap; no horizontal document overflow. Saved actual production screenshots under `.artifacts/continuation-20261020/production-list-{en,ru}-390.png`; filtered full-page captures show the complete saved row and Russian Edit action. Full-page capture composites the sticky header at the current scroll position; do not mistake that capture artifact for observed product overlap. The ordinary viewport screenshots show the live toolbar/global styles.

Observed EN/RU search and title sorting; the Russian named Edit action opened saved synthetic45, with unchanged title and Saved to workspace status. Keyboard `press` attempts timed out despite working clicks/DOM; do not claim new production keyboard acceptance. Existing component keyboard evidence remains separate. No row was saved, deleted or reshared.

### Unsupported local file: corrected acceptance

The normal Import case/prompt button produced a real file chooser. Selected the retained labelled synthetic `.artifacts/audit-20261019/synthetic-future-field.json`. Recovery showed the Russian unsupported-field explanation, no raw content/editor, and a return action. Return restored synthetic45's saved editor. The file remains **4,528 bytes**, SHA256 `c8f05fd41dabbd99255016c5f1f776c1b46ae26c523f1410c784c665df66993a`.

**Audit correction:** the older instruction required an original-file download here, but `importDraft` deliberately sets `canExport:false` for unverified imported content. Possessing an imported envelope must not establish its copy/export authority. Production correctly withheld the download and explained the verification requirement. Do not weaken that gate to satisfy the outdated acceptance sentence. Split unverified local-file recovery from owner-verified saved-document recovery. The latter's actual production original download/hash is still unobserved; owner/foreign/stale behavior is covered separately by real local-handler tests.

After return, actually exported saved synthetic45 through its authorized normal export action. The browser download event timed out, but the resulting file was independently found on disk; export was not repeated. New file `example_work_2876d4c8148c469ea4294ee86081d214-v2.0.0.juris-case (1).json`, **23,615 bytes**, SHA256 `be899caa3cfe4dece77169c634630fc408602a5e25b58121376bca5786ddb6bf`. Compared the **entire envelope** with the retained pre-check export: exact equality except `/exportedAt`, `/core/provenance/updatedAt`, `/draft/updatedAt`, each asserted equal to its own export timestamp before exclusion. This proves retained content/source/category/nodes/links/history/protection in the checked case; it is not raw-byte equality or an exhaustive database audit. No new identity was created.

## Implemented historical execution harness

`scripts/lib/pinned-studio-reader.ts` bundles original modules from full immutable Git commits. All relative imports resolve from the same commit; missing historical modules fail rather than falling back to the current working tree. Non-Node external runtime packages are refused until a separate pinned environment is supplied. Each result records 15 source-file hashes, module-set hash, executable bundle hash, Node/esbuild versions and dependency-lock hash. No browser, credentials, production database or network transport is used by the matrix.

`scripts/verify-studio-release-compatibility.ts` runs **69 fixtures × 3 releases = 207 known-carrier rows**, plus27 future-field/device/envelope probes, **234 rows total**. The69 are the existing68 EN/RU current/historical registry combinations plus a complete synthetic tax carrier. Full draft, custom-envelope raw text, device write/reopen and revision apply are compared, including all source/category/tax/evidence/protection/history/manual-placement content. Generated working IDs and timestamps are deterministic. The converted factory's existing explicit clock argument supplies the fixture timestamp; source factories/frozen content hashes are not edited. Source-factory output hashes are generated fixture provenance, not hashes of original source-document bodies.

| Original release modules | Pinned commit | Known full-carrier rows | Future probes |
| --- | --- | --- | --- |
| v148 | `6e2910758a6f13b4bf1a65167bbc070c4a950792` |69 preserved|4 lossy editable reads and4 device replacements; unsafe|
| v149 | `bcd50f3342413fb5ac8cd55811a519d3c9b5239b` |69 preserved|Unknown fields recover read-only; device replacement blocked with zero writes; unknown envelope999 retained|
| v150 | `d4547efd3fcc1f36207f121ffe43348fc8530f6f` |69 preserved|Same safe results as v149 for these probes|

v148 module-set SHA256 `00d1c0310f39bd2f2c4a29df0cc41fb5570a6c98c63c1e582252e5fb3a1e7969`; executable SHA256 `316b4895bbe35317df008a3c8f4ef5ef64b21800353611490eae0308913450c8`.
v149/v150 both module-set SHA256 `5e706fa9e96b458fcc9a3fde54f0ada49eecbb82d15b315fcaa25a3477ab91a4`; executable SHA256 `0107e02ea02d7fd0f03af437426f6e91635d9bd99b04f675db252ea21cc37789`. No external runtime imports.

`executionPassed:true` means the expected historical hazards were detected and current guards passed; **`allReleasesSafe:false`** prevents presenting this as universal backward compatibility. Eight unsafe observations are historical data-module probes, not new ERP/GreenFire projection gaps. The current v149/v150 safeguards already address them. Never roll back to v148 to test user work.

## Review and validation

New harness tests verify working-tree edits cannot change historical execution, missing historical imports cannot substitute current files, and unpinned runtime packages fail closed. Existing recovery/list/real persistence-handler tests also ran: **35/35 passed**, zero failures/skips. Initial harness review corrected an omitted explicit revision timestamp and a nondeterministic default factory clock before final acceptance. No historical source/fixture hash was rewritten to make checks pass.

TypeScript passed at the initial completed checkpoint; final changed-code lint, deterministic repeat receipts, canonical PR/CI and unchanged application-input proof are recorded in the closure below. Keep broader coverage limits explicit: this does not execute full old UI/Worker binaries, establish all-package authenticated A/B saves, same-tab account switching, owner-only production recovery download, domain approval or moderated usability outcomes.

## Delivery closure

Final local checks:35/35 targeted tests, final TypeScript and changed-code lint pass. Final matrix runs twice with **identical receipt bytes**, SHA256 `12df4573e5345faf1c3f721e018b3e1230f97e818f47bf67cf35fb18e06d715f`. Both converted/category factories use their existing explicit clock parameters; known-source/fixture content is untouched. [Committed compact machine-readable receipt](receipts/release-data-module-matrix-2026-10-20.json) records the234 rows' aggregate identities, exact original module/bundle hashes and eight unsafe historical outcomes. Full reproducible receipt remains `.artifacts/continuation-20261020/release-matrix.json`.

Release-input verification is unchanged: application SHA256 `f1ac3ce1875b3fb27ae64311d8e58cc27867907ee68423cb453880d9fc81ea57`, hosting SHA256 `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. Native public Sites v150 is the production receipt for this verification-only slice, not a newly invented deployment. Source tooling/tests/instructions are versioned independently through ordinary canonical review. Runtime full web/PDF acceptance remains the exact v150 receipt; new source CI must be reported by its actual status rather than inherited from v150.

Continue with [the amended detailed stage](../development/CASEVANT_COMPATIBILITY_STAGE_2026-10-20.md). Production remains v150; do not treat this tooling slice as a new Sites version. Keep production keyboard, owner-verified recovery download and full old application artifacts explicitly open.
