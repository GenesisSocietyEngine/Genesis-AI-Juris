# Complete baseline release gate — 27 September 2026 UTC

**PASS, exit 0**, for the unchanged `scripts/verify-release.sh` on exact web commit `6ab091d830ccfd9d6b76c0adc177341bca96e081` and locked mobile commit `5200b30cc50c77393c6f48b52ce91c0f30e70c64`. The command began at 20:39:36 UTC; its completed exit and both final immutability guards were observed by 21:37:11 UTC. [Complete raw log](evidence/amendment-aggregate-baseline.log), [structured observation](evidence/amendment-aggregate-baseline-receipt.json), [observation parser](evidence/amendment-seal-aggregate.mjs).

This closes the previously unexecuted aggregate **for that exact baseline**. It does not close the independently discovered [P1 private-read finding](AMENDMENT_SOURCE_LIFECYCLE_REVIEW.md), its subsequent correction, or unexecuted browser/hosted/accessibility/human acceptance. The correction must have separate source and test evidence. The old script's terminal `v62` label is retained verbatim; it is not a deployment version.

| Gate | Actual result |
| --- | --- |
| Web preflight/final immutability | PASS; exact clean HEAD and unchanged tracked-byte receipt throughout |
| Strict TypeScript, lint, patch hygiene | PASS; lint has **3 warnings**, not zero: archived access harness `readiness`, existing test `allMigrations`, Vite `_files` |
| Full web test invocation | **912 PASS, 0 FAIL, 3 SKIP**, 915 tests; separate build migration selection 2 PASS |
| Dedicated dossier scenarios | **5/5 PASS**, no skips |
| PDF verification | **47 files, 758 pages/rendered PNGs, 55 golden PNGs PASS**; automated structural/text/render/baseline checks, not fresh visual inspection of every page |
| Production dependency audit | **PASS, zero vulnerabilities**, public npm registry through the recorded environment |
| Final verified build | PASS, all five build stages; existing large-chunk/tool warnings retained |
| Mobile runtime/layout/format | PASS; 18 routes/every checkpoint, 7 Dart layout fixtures, 117 formatted files with zero changes |
| Mobile dependency resolution | PASS, actual `flutter pub get`; newer incompatible package notices are retained, no upgrade performed |
| Flutter analysis/tests | PASS, no analysis issues; **275 tests** |
| Rust format/Clippy/tests | PASS, locked offline workspace; warnings denied by Clippy; **359 tests, 0 failed/ignored**, 73 result groups |
| Android native smoke | **12 integration tests PASS**, local x86_64 debug emulator, real FFI; not 12 physical-disk/cold-reboot tests |
| Hosted workflow lock | PASS for stored exact-SHA Android/Flutter/iOS/Rust evidence; no new hosted/iOS execution or live CI verification |
| Final mobile immutability | PASS; exact locked source preserved |

The three skipped web cases are the opt-in historical v91/C1 migration rehearsals, named in the receipt. They remain skipped; neither the aggregate exit nor other migration checks convert them into passes. The standalone native pass and this aggregate native pass execute the same selection; do not add them into 24 distinct tests.

## Source, execution environment and preservation

At 21:37:34 UTC, a separate [source/build readback](evidence/amendment-aggregate-baseline-source.json) bound the exact baseline HEAD to application digest `25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec`, 385 inputs, and hosting-config digest `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. Built input digest matched. Application/test code at this checkpoint remained the retained `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6` code; intervening commits recorded evidence. An initial sandbox TSX bootstrap failed before the identity check; a host retry without process-scoped Git trust could report the digest but not HEAD. The successful bound receipt uses the scoped trust setting. No global Git configuration changed.

The unchanged tracked release script ran through ignored local toolchain launchers: Node22.23.2/npm10.9.8, Flutter3.44.8/Dart3.12.2, installed stable Rust1.97.1 with Android targets, and Poppler25.07. The process used public npm and offline Cargo. The earlier independent Rust1.98 checks are separate evidence. The local Flutter launcher received Gradle resource limits before the aggregate's first Flutter use; [provenance](evidence/amendment-resource-cap-provenance.json) preserves before/after hashes and time. It forwards unchanged test arguments and does not waive assertions. Tracked files stayed frozen until the final guard ended.

The task-owned `UXGatePixel` emulator resolved the earlier no-device prerequisite. [Native execution](AMENDMENT_NATIVE_EXECUTION.md) and [independent review](AMENDMENT_NATIVE_REVIEW.md) retain the first harness error, successful standalone run, effective 4096 MiB emulator RAM, 173459 ms boot exceeding the planned 120-second window, and actual Gradle limits. Those reports are dated observations prepared while this aggregate was running; this completed result supersedes their aggregate-pending wording. The emulator remains task-owned for the correction's later checks; final cleanup is not claimed here. The [boot/RAM excerpt](evidence/amendment-emulator-boot-ram-excerpt.log) is explicitly excerpted; its [receipt](evidence/amendment-emulator-boot-ram-excerpt.receipt.json) binds the unchanged original log and selected lines without publishing unnecessary host networking/ADB metadata.

The [copy receipt](evidence/amendment-publication-copy-receipt.json) maps original evidence filenames to repository filenames with exact sizes/hashes. Local evidence archival is not external publication. No hosted deployment, invitation, production data change, source-v2 upload, browser zoom, screen-reader or human session occurred in this aggregate. Engineering and production acceptance remain BLOCKED; external pilot remains NO-GO.
