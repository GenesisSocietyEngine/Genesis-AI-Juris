# Matter response authorization regression: scoped handoff

The coordinator reported an initial content-screen rejection of the broader proposed reproduction and narrowed the task to a strictly in-process synthetic unit test before any server, credentials, real accounts/database, browser, upload or network action occurred. That restriction was followed; no alternate real-service reproduction was attempted. This agent did not receive an automatic-review rejection for the narrowed test. Its first normal tsx invocation hit the known sandbox `uv_os_get_passwd ENOMEM` bootstrap error, preserved separately, and the authorized host retry ran the same accepted bounded test. The result does not establish ordinary-session validation.

The maintained test is now `tests/dossier-read-access.test.ts`, copied after the coordinator released the tracked-source freeze and the independently reviewed source patch was applied. The ignored draft remains `matter-read-race.unit.test.ts`. It is strictly typed and uses the existing normal `node --import tsx --test` runner. The test executes the complete actual detail GET module and actual `resolveDossierServerContext`, `resolveOrganization`, `requireDossierAccess` and authorization policy code via in-process TypeScript transpilation. It does not mock an authorization decision. Explicit doubles supply synthetic identity, an in-memory Drizzle-shaped record transport and unrelated readiness aggregation. Actual Drizzle predicate bind parameters select the fixture principal/organization/Matter rows. This is scheduling/response-boundary evidence, not SQL-engine, real-login, session-token, HTTP or browser integration coverage.

The one-shot barrier pauses a source-anchor read only after initial production authority resolution and the joined Matter access read. It times out after two seconds if that boundary is not reached. Post-read counts permit new authority checks. Denials must omit the entire captured Matter/permissions payload and both private synthetic markers. Global fetch is forbidden during this isolated test and restored afterward.

| Case | Frozen source `6ab091d` | Ignored proposal overlay |
| --- | --- | --- |
| Authorized baseline | PASS: 200 and fixture data | PASS |
| Membership suspended during private read | FAIL: 200 instead of 404, private markers and old write permission | PASS: 404, private payload absent |
| Fresh read after that suspension | PASS: 404 | PASS |
| Authority unchanged across the same barrier | PASS: 200 | PASS |
| Synthetic identity disappears during read | FAIL: 200 instead of 401 | PASS: 401, private payload absent |
| Synthetic identity changes to another principal | FAIL: 200 instead of 401 | PASS: 401, private payload absent |
| Same participant changes contributor to viewer | FAIL: 200 instead of 409 with old permissions | PASS: 409, private payload absent |
| Fresh viewer read | PASS: viewer permissions, write=false | PASS |
| Collection unchanged during owner-name read | PASS: summary and no internal participant ID | PASS |
| Collection participant removed during owner-name read | FAIL: 200 instead of 409 | PASS: 409 |
| Collection role changed during owner-name read | FAIL: 200 instead of 409 | PASS: 409 |
| Pagination lookahead participant removed | FAIL: old 200/cursor | PASS: 409 |
| Empty collection loses synthetic identity | FAIL: 200 instead of 401 | PASS: 401 |
| Unchanged notes operation recovery | PASS: original 201, note/body/key and private no-store header | PASS |
| Notes recovery membership suspended during read | FAIL: 201 with private prior receipt instead of 404 | PASS: 404, private payload absent |

Frozen source: **6 PASS / 9 FAIL, exit 1**. Proposed source overlay: **15 PASS / 0 FAIL, exit 0**. The latter is explicitly `PROPOSAL_OVERLAY` from `.artifacts/ux-reconciliation-auth/matter-read-fence/after`; no tracked app source was changed, and it is not a current-candidate/deployed PASS. Each selected source file's actual path/hash is in the mode-specific receipt. The original three-case `.mjs` red script, TAP, receipt and execution record remain byte-exact under `matter-read-race-baseline/` (script SHA256 `ca9c1a5cd82fbe783afd37a5d8b0a5e88b6d737bc36ccfa9378d4d39d24249d4`). The archived red route SHA256 is `4a8ed84bf8abe347ebe44c6d661d35715109c725ea9642df94596ebab2162ea4`.

The collection transport double verifies that the final grant query binds the original organization, actor, user, active status and selected Matter IDs, returns the actual current internal participant ID/role, and uses a limit of 51. Its two-row/page-limit-one fixture includes the pagination lookahead. It does not mock the final comparison or claim a real database load/performance test. The notes case executes the actual operation-key GET branch; preserving 201 verifies that successful recovery semantics survive the final response fence.

Relevant artifacts: `matter-read-race.{frozen,proposal}.tap.log`, corresponding `.receipt.json`, `matter-read-race.types.log`, and `matter-read-race.typed.execution.json`. Independent reviewer checked the original reproduction's fixture fidelity; later expanded/overlay checks retain their own receipts. These 15 cases cover eight detail, five collection and two notes-operation scenarios. Other JSON endpoints require their own source review and proportionate coverage; no full 13-route integration matrix is claimed.

## Actual-source follow-up after freeze release

The final maintained version adds two reviewer-requested checks: membership may be active again after suspension/resumption, but its newer revision cannot revive an in-flight captured context (404); a fresh request can establish that new authority (200). It also creates its ignored output directory for fresh checkouts and restores the original fetch function in a finally block. This version has **17 cases: ten detail, five collection and two notes-operation cases**.

At **21:40:11.884 UTC**, the final maintained test ran against **actual applied source**, without the proposal-overlay environment, and passed **17/17, exit 0**. `matter-read-race.actual.execution.json` binds the command, test SHA256 `33ad605555018437b8fcb76025c5614947c7bb7539a367bba96992a59c4031f4`, actual-source receipt and TAP SHA. `matter-read-race.current.receipt.json` lists the selected source hashes. Full TypeScript/lint/route-contract validation and the new complete release aggregate belong to the coordinator's later receipts; this targeted pass does not predeclare them.

The original three-case red artifacts remain under `matter-read-race-baseline/`. The exact 15-case pre-application script/red/overlay artifacts remain under `matter-read-race-15case-preapply/`; subsequent labels/output filenames and test additions do not overwrite those historical bytes. The flat proposal TAP now records the final 17-case proposal pass. Distinguish that from both the 15-case archive and the actual-source run.

The first actual-source lint check then identified only the new test loader's local name `module` under Next's `no-assign-module-variable` rule. The prior passing source/TAP/execution/current-source receipt were copied byte-exact to `matter-read-race-prelint/`; the historical source is stored as `.source.txt`. The maintained binding and its references were renamed to `compiledModule`, with no application-source or test-behavior change. At **21:44:17.201 UTC**, the maintained test again passed **17/17, exit 0**. Its final SHA256 is `066b96e4cd96786c1cc97a7666453bd9f74a5f6a7817cecf7fa50f3309946c8a`; the current `matter-read-race.actual.execution.json` records this rerun. The implementation agent owns the subsequent full typecheck/lint retry.
