# Exact corrected-candidate aggregate

**PASS, exit0**, on clean commit `a1fae95bc2624e28e6232b8867ad2a94c8d9f0ab`. The unchanged `scripts/verify-release.sh` started at2026-09-27T23:55:25Z; terminal completion was observed at2026-09-28T00:57:19.740Z. The receipt separately records the raw log's last-write timestamp. Neither is presented as an invented exact process-exit timestamp.

All10 web,9 mobile and3 native stages completed. The initial and final source guards bind the run to the same tracked bytes. Locked mobile commit remains `5200b30cc50c77393c6f48b52ce91c0f30e70c64`.

| Verification | Observed result |
| --- | --- |
| Strict TypeScript and full lint | PASS; three retained lint warnings, no errors |
| Initial and final verified build | PASS; all five bundle stages |
| Web tests | 932 total; 929 PASS, 0 FAIL, 0 cancelled, 3 explicit historical migration skips |
| Separate dossier scenarios | 5 PASS, 0 FAIL |
| Automated PDF matrix | 47 PDF files, 758 pages, 758 rendered PNGs, 55 golden PNGs |
| Production dependency audit | PASS; zero vulnerabilities, public npm registry fixed by the recorded execution environment |
| Mobile route/layout/format/analysis gates | PASS under the exact locked checkout |
| Flutter tests | 275 PASS |
| Rust workspace | 359 PASS, 0 FAIL, 0 ignored across 73 reported result groups |
| Android FFI persistence integration | 12 PASS on isolated local emulator-5580 |
| Stored hosted workflow evidence lock | 4 exact-SHA entries validated; not new hosted/iOS execution |
| Final source guards | Web and mobile PASS |

The three retained lint warnings are the historical viewer-suspension evidence script's unused readiness binding, the persistence test's unused migration binding and Vite's unused files binding. The three opt-in migration rehearsals remain skipped; their names are retained in the receipt. No assertion was weakened, no skip was added and no PDF baseline was changed to obtain this result.

The final built application input digest is `5597958a0a870757e75cfbdfba930007d475f782035db4ee8503a97aa1723afc`, 385 inputs, with hosting-config SHA256 `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. This equals the earlier corrected application e6 digest; a1 adds only the reviewed PDF test synchronization correction and its evidence. The output/source check ran at2026-09-28T00:57:41.164Z. A subsequent documentation-only commit must not be described as the exact commit that ran this aggregate.

Historical attempts remain distinct: [pre-correction6ab PASS](AMENDMENT_AGGREGATE_BASELINE.md); [corrected e6 FAIL and red/green synchronization repair](SLICE_PDF_TEST_SYNCHRONIZATION.md). The e6 failure is not removed or relabeled by this passing rerun. Its downstream stages were unrun, now executed here. [The private-read correction](SLICE_PRIVATE_READ_AUTHORITY.md) and [ordinary local token-store smoke](AMENDMENT_LOCAL_READ_SMOKE.md) have their own scopes.

This closes the complete technical-script prerequisite on a1. It does not close the remaining integrated source-change/review/updated-report, role/recovery UI, hosted-candidate, actual zoom/screen-reader or human acceptance. PDF totals describe automated checks, not visual inspection of every page. Native results describe a local debug emulator; the stored hosted lock is not a new iOS build or physical-device check. Engineering and production remain BLOCKED; external pilot remains NO-GO.

Evidence: [complete raw log](evidence/amendment-final/aggregate/aggregate.log), [parsed observation receipt](evidence/amendment-final/aggregate/receipt.json), [final source/build binding](evidence/amendment-final/aggregate/source.json) and [byte-preserving archive map](evidence/amendment-final-aggregate-copy-receipt.json). The reviewed parser derives observed PDF counts and leaves absent-stage results null; its two archived-log dry parses are parser checks, not new historical gate executions.

After the gate, [task-owned emulator cleanup](AMENDMENT_NATIVE_CLEANUP_CORRECTION.md) was confirmed by a separate read-only check. Both failed immediate cleanup receipts remain archived; they are unrelated to the successful application gate.
