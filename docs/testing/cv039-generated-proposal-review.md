# CV-039 — generated assertion acceptance

## Public v225, 18 November 2026

#320 merged at 13:08:13 UTC after all 18 checks passed. Exact-main `8c7d5649ee74e41c9810ed36cbd62f5e51bc5173` web/PDF run 44310653796 passed on attempt 2: 2,102 tests, zero failures, three inherited skips, two HTML checks and zero vulnerabilities in both audits. Attempt 1 failed because Chrome did not create `DevToolsActivePort` during packaged-browser startup; the unchanged check passed on retry.

Sites v225 published at 13:28:38 UTC from source `1f828ee9ec2a89e3c318ab1e301091ca67ef1b56`, retaining environment revision 42 and public access. Both origins returned the exact runtime. Each initially had one different asset 404 immediately after deployment; full rechecks passed 221/221 on both. [Receipt](receipts/cv012-v225.json).

A fresh signed-in RU tab loaded the existing pending proposal and accepted version-2 source. The authorized bilingual QA note was re-entered in that new tab. Ordinary acceptance now passed the CV-038 payload guard but failed with `Accepted assertion proposals require exactly one statement field.` No proposal decision or assertion was created. CV-012 acceptance is still pending.

## Root cause and repair

Generation writes `{schema_version:1, statement}`; the acceptance route allowed only a legacy string or `{statement}`. The shared assertion-value parser now accepts exactly the generated v1 envelope as well as legacy values. Unsupported versions, extra fields, missing/non-string/empty/NUL/overlong statements still fail. Existing length, trim, authority, source and transaction guards remain unchanged. No migration or rewrite of the historical proposal is needed.

The D1/R2 generation integration test now feeds actual stored fact/date values into the same parser used by the acceptance route. This closes the fixture gap that allowed generation and review tests to pass separately. Additional parser tests cover legacy compatibility and malformed envelopes; route wiring and review guard tests remain active. All 21 focused tests pass; type checking is recorded after completion.

Next: green CI, merge/release, accept the same already source-reviewed synthetic proposal, verify note and attribution through EN/RU switching and reload, and record the resulting assertion separately. Do not regenerate or edit away the envelope to bypass the bug. CV-035 localization, narrow layout acceptance and CV-010/028/029 active-client checks remain open.
