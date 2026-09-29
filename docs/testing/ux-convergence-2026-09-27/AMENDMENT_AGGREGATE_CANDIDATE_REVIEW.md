# Independent review of the completed corrected-candidate aggregate

28 September 2026 UTC. **PASS for the exact completed technical command on `a1fae95bc2624e28e6232b8867ad2a94c8d9f0ab`; no substantive discrepancy found between raw log, observation receipt, source binding or final guards.** This closes the revised-source full-script prerequisite. It does not establish complete runbook acceptance, a hosted candidate, human validation or release readiness.

Reviewed the [complete raw log](evidence/amendment-final/aggregate/aggregate.log), [observation receipt](evidence/amendment-final/aggregate/receipt.json), [final source/build readback](evidence/amendment-final/aggregate/source.json), exact Git objects and the unchanged release script. The raw file was read and hashed in full, then independently indexed by stage and parsed without invoking the coordinator's receipt parser. Stage boundaries, summaries, warnings, pivotal test results and final guards were inspected directly. This is programmatic whole-file verification with targeted manual inspection, not a claim that every log line was visually examined. No build, test, gate, HTTP request or emulator cleanup was executed by this review.

## Exact identity and completion

- Raw log: **347,190 bytes**, SHA-256 `610b1889977dced153f096f2cadbeb16295ea441806ab230f3afe6a2cb8c73b6`. The complete file contains 7,363 split lines and matches the sealed receipt's exact size/hash.
- Web preflight: exact `a1fae95bc2624e28e6232b8867ad2a94c8d9f0ab`, tree `81712d34d535d5c658dd2fae9b4cdae19cb1e56e`, 1,641 tracked files, tracked-byte digest `c820cb5e12286156228725097b5ede23f7ccf34c284584cdc9bebac01c48b09b`. The Git tree independently matches the named commit.
- Full command began at **2026-09-27T23:55:25Z**. Coordinator tool `9a59bd`, session `41217`, reported **exit 0**, observed at **2026-09-28T00:57:19.740Z**. The log's last-write time is `00:57:19.690Z`; neither timestamp is promoted into an independently measured process-exit time.
- The log contains all **10 web, 9 mobile and 3 native stages in the expected order**, the exact mobile final guard, and the final release-script PASS marker. The script is unchanged between baseline `6ab091d` and this candidate. Its final web guard recomputes the full checkout receipt and compares it with preflight, failing with exit 68 on mismatch before printing terminal PASS. Only the initial JSON receipt is printed; a second printed digest is not invented.
- Source readback at **00:57:41.164Z** names exact a1, Node `v22.23.2`, **385 application inputs**, application digest `5597958a0a870757e75cfbdfba930007d475f782035db4ee8503a97aa1723afc`, hosting-config digest `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`, and the same built input digest with `buildMatchesCurrentSource: true`. This review checks that binding and Git continuity; it does not claim a second build or an independent recomputation of all 385 input hashes.
- `app/` is unchanged from corrected application checkpoint `e6c6adc`. The a1 successor includes the reviewed PDF test synchronization correction and evidence. A later documentation commit must retain a1 as the exact gate-tested commit.

## Observed gate results

| Scope | Independent raw-log result |
| --- | --- |
| Strict TypeScript / full lint | Completed; lint has **0 errors and 3 retained warnings** (`readiness`, `allMigrations`, `_files`), not zero warnings |
| Full web invocation | **932 total: 929 PASS, 0 FAIL, 0 cancelled, 3 SKIP** |
| Dedicated dossier selection | **5/5 PASS**, no skips |
| PDF verification | **47 fixture PASS lines**, including both long-content fixtures; **758 pages and 758 rendered PNGs**, **55 golden PNGs**; recorded baseline fingerprint `bac3a7bdebd662edd043a297e39c1c4000716327ac110b0db7453b1d8a3323c8` |
| Production dependency audit | **Zero vulnerabilities** in this command; not a new full dev-dependency audit |
| Build and patch checks | Initial/final verified builds and patch-hygiene stages completed; existing tool/chunk warnings are retained |
| Mobile runtime/layout/format | **18 routes and every checkpoint**, **7 layout fixtures**, **117 Dart files / 0 format changes** |
| Flutter analysis/tests | No analysis issues; **275 tests PASS** |
| Rust workspace | **359 passed, 0 failed/ignored**, 73 reported result groups; format and Clippy stages completed |
| Android native integration | **12 PASS**, local debug x86_64 emulator with FFI; not 12 physical-disk or cold-reboot tests |
| Stored hosted workflow lock | Four exact-`5200b30cc50c77393c6f48b52ce91c0f30e70c64` Android/Flutter/iOS/Rust entries validated; no new hosted/iOS execution |
| Final guards | Exact locked mobile guard and exact-source web guard passed before terminal PASS |

The former PDF authority setup failure now passes in the full invocation. All six nested Canopy scenario/update/runtime checks and their parent also pass. No negative TAP result appears anywhere in the completed log. The three historical v91/C1 migration rehearsals remain explicitly skipped under their original names; they were not silently promoted to PASS. The dedicated dossier run and earlier focused tests overlap broader coverage, so counts must not be added into an invented distinct-test total.

## Historical and evidence-scope boundaries

The [6ab baseline PASS](AMENDMENT_AGGREGATE_BASELINE.md) remains a real success before the later private-read fix. The [e6 aggregate FAIL](SLICE_PDF_TEST_SYNCHRONIZATION.md) remains a real failed command: 928 passing, one failed PDF test-setup assertion and three skipped tests; downstream stages were unrun in that attempt. Its controlled red reproduction and six-test targeted correction support the synchronization diagnosis. This a1 success supersedes the pending rerun prerequisite; it does not erase or relabel either prior result.

The **17 maintained private-read regressions** use actual handlers and authority logic with explicit in-process identity/database doubles. Their identity changes do not prove actual token-store revocation. The separate **nine assertion groups / 39 responses in the ordinary local token-store smoke** use actual synthetic password sessions and sequential reads/logout/old-cookie denial; they do not reproduce an in-flight real-session race. The [local smoke](AMENDMENT_LOCAL_READ_SMOKE.md) and [private-read correction](SLICE_PRIVATE_READ_AUTHORITY.md) remain separate evidence. Neither proves provider logout, hosted role coverage, professional approval or the complete source-v2-to-updated-report journey.

PDF counts are automated structural/text/render/baseline checks, not a fresh human inspection of all 758 pages. Earlier four-format/all-33-page visual review and the separately inspected actual browser Base PDF retain their own source/timing scope. Repeated native invocations do not create additional distinct tests, physical-device coverage, ARM evidence or release-APK attestation.

This full gate does not deploy the private-read fix. The separate static source comparison ties the previously recorded v102 source to the pre-patch files; it is not proof of a live exploit or actual disclosure. Fresh production metadata and any owned-emulator cleanup are the coordinator's separate work and are not asserted here.

Engineering and production acceptance remain **BLOCKED**, and external pilot remains **NO-GO**, because the integrated source-change/reassessment/review/updated-report path, remaining role/recovery browser and hosted-candidate checks, true browser 200%, real screen reader and actual human sessions are still incomplete. A successful technical script removes one prerequisite only. No human success rate, source-v2 upload, hosted mutation or release authorization follows from this review.

## Review method and retained correction

Ignored supporting check: `.artifacts/amendment-release-gate/aggregate-candidate-independent-check.json`, completed at **01:00:08.751Z**, status `PASS_LOG_RECEIPT_SOURCE_AND_GUARDS_AGREE`; checker source is beside it. Its first review-only fixture counter matched `golden-` and `stress-` names and therefore counted 45 instead of 47 by omitting two explicit `long-content-` entries. That narrow reviewer-harness mistake, original source hash and corrected counter are retained in ignored evidence. The completed application gate and its receipt never disagreed. No product/test/golden value was changed for this evidence review.

The review's execution conclusions depend on the coordinator's observed tool exit plus independently checked complete log and source artifacts. They do not independently rerun the command, attest a remote deployed binary, or grant release readiness.
