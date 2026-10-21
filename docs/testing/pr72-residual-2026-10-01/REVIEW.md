# PR #72 residual disposition after #79

## Intended outcome and acceptance

Preserve only the still-useful verification harness changes from PR #72 on the accepted main tree. A passing selected-test marker cannot replace actual successful driver exit, and browser verification cannot pass before bounded owned-process cleanup. All existing financial, persistence, source identity, native export and PDF assertions remain required.

The six code/test paths are copied byte-for-byte from exact PR #72 head `168d5f4517eaa6e2c45c7a4568e882e0345ef797`. This checkpoint does not claim to fix either terminal failure at that head. Fresh successor-head hosted gates are required before integration.

## Source comparison and ownership

- Canonical main observed on 2026-10-01: `1a8b7ee23c61ae3efc78283a0a29538ecae2bd86`, tree `08e985ad544168249683bae745f68ac2247ed952`.
- PR #79 merged that accepted tree; its head `073a6382aa03ca7227e36fc134b82180d5e9d700` passed all 18 checks. Its six-phase application checkpoint, dependencies and confirmed account return are already in main.
- PR #72 remains open/mergeable at `168d5f4517eaa6e2c45c7a4568e882e0345ef797`, tree `ddadd22f309fcd4f8d49dcaf8fef574d0bc4404c`. Main is its ancestor; exactly eight residual paths differ. There is no residual product UI, Rust, Flutter, lockfile or workflow change.
- Work started in a fresh isolated checkout at canonical main, with no dirty paths. Existing other checkouts were not modified. This task owns only the six residual code/test paths and this review.
- PR #80 is excluded from this task.

## Disposition of all eight paths

| Residual path | Decision | Reason |
| --- | --- | --- |
| `.github/scripts/run_ios_tax_phase.py` | Keep | Main launches a second `flutter drive` lifecycle after the host already owns build, installation, launch and authenticated VM discovery. The residual invokes the pinned SDK's cached Dart driver directly, binds SDK/binary identity to preparation, and records actual child exit before termination/absence can pass. |
| `.github/scripts/test_run_ios_tax_phase.py` | Keep with runner | Controls reject changed SDK, foreign URI, missing/wrong-PID receipts, nonzero actual child exit despite success text, and changed offline driver identity/environment. Existing lifecycle and preparation checks are preserved. |
| `.github/scripts/verify_ios_tax_journeys.py` | Keep with runner | Offline acceptance independently requires the new start/terminal driver records, exact authenticated URI/SDK/source/nonce/preparation/PID/command/environment and integer exit zero. Copying only the runner would leave these records unchecked. |
| `docs/testing/chrome-readiness-2026-09-30/REVIEW.md` | Omit; replace here | Historical Windows/older-source evidence is not successor acceptance. Keep current source comparison, rationale and limitations in this one review instead of copying its dated status. Original document remains on #72. |
| `docs/testing/tax-ios-journeys-2026-09-30/DIRECT_DRIVER.md` | Omit; replace here | Historical direct-driver rationale is condensed here; original evidence/source references remain on #72. Its pending-status paragraph must not become a claim about the successor. |
| `scripts/owned-chrome.mjs` | Keep | Main's file polling does not bound HTTP/WebSocket readiness, record child lifecycle, or await owned browser cleanup. The helper handles partial publication, validates loopback endpoint identity, applies one existing 20-second deadline and awaits scoped cleanup, preserving failure evidence. |
| `scripts/verify-tax-runtime-packaging.mjs` | Keep with helper | Connects actual packaged browser parity/negative controls to that lifecycle and ignores late replies whose CDP request already timed out. Financial/canonical/source/CSP/Worker assertions and browser flags are unchanged. |
| `tests/owned-chrome.test.ts` | Keep with helper | Real-child controls cover incomplete readiness, spawn/exit, port/HTTP/WebSocket deadlines, foreign endpoint, primary-error retention, delayed pipe close, unrelated-process exclusion and POSIX descendant/failed cleanup. |

Successor scope: six unchanged residual code/test paths plus this one current review. The older branches' merged history and two redundant historical documents are not carried forward.

## Why these changes remain useful

At predecessor `6c86bfb`, both application jobs passed the selected write test but their surrounding Flutter CLI host lifecycle timed out before host exit and application termination. Direct Dart removes that extra lifecycle without loosening the application proof. Flutter 3.44.8 revision `058e0af2c2b57e369d905a03ac9748b0ebf543c6` delegates to cached Dart and the driver with `VM_SERVICE_URL`: [pinned implementation](https://github.com/flutter/flutter/blob/058e0af2c2b57e369d905a03ac9748b0ebf543c6/packages/flutter_tools/lib/src/drive/drive_service.dart#L243).

Main's successful older-transport runs establish its accepted checkpoint, not immunity to those observed host failures. Conversely, direct Dart does not change the earlier system-log discovery stage.

Earlier Chrome failures left no endpoint readiness and insufficient child lifecycle evidence; the old launcher requested termination without waiting. The residual makes success and failure both await owned cleanup. It preserves the 20-second startup budget rather than increasing it. This improves bounded verification and diagnostics; it does not establish why hosted Chrome sometimes misses readiness.

## Exact-head #72 failures remain failures

The connector confirms terminal PR runs for `168d5f4`: Flutter Mobile UI, Rust CI, Android Native FFI and iOS Native FFI succeeded; the application and root web workflows failed. The PDF job in the failed root workflow passed independently.

- Application [run 36794716581](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36794716581), job `110155414271`: preparation succeeded, and write/read/incomplete-write/incomplete-read each executed the selected test and returned host exit zero. Legacy-write failed at `discover()` with `Fresh system-log VM discovery timed out`, before direct driver invocation. Four passing phases are not six-phase acceptance. No engine, driver or resource cause is inferred.
- Web [run 36794716291](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36794716291), job `110155396558`: 1,165 tests passed, zero failed and three skipped; packaging then failed with `CHROME_READINESS_TIMEOUT` / `Chrome did not become ready within 20000 ms`. Later production Worker/audits did not execute. This is not a passing web gate, and its initiating browser cause is not established.

No unchanged rerun, timeout increase, test bypass or relabeling of predecessor/main evidence is part of this successor.

## Local review and verification

Verified on Linux with Node 24.19.0 / npm 11.9.0; hosted Node 22.23.2 / npm 10.9.8 remains separately required.

- Exact `npm ci` completed without package/lock changes.
- Phase controls: 53/53; diagnostic controls: 13/13; deadline controls: 11/11.
- Chrome controls: 11/11, zero skips, including both POSIX process controls. The focused command used the available tsx 4.22.1 loader before exact installation completed; these fixtures exercise lifecycle, not actual Chrome or financial parity.
- Strict project typecheck, parity lock and migration history passed.
- ESLint completed with zero errors and four existing warnings outside these changes.
- JavaScript syntax and diff whitespace checks passed.
- Complete local web build/tests were started separately; their final result is recorded in the successor PR when terminal. No local Chrome executable or macOS Simulator is available, so actual browser packaging and iOS application acceptance rely on fresh hosted execution.

The diff was reviewed for preservation: unchanged product wording, navigation, UI/accessibility, tax inputs/math, dependency pins and native workflows; all six application phases, native/export/source checks and packaging negative controls remain enabled. Reviewed source contains no credentials or unrelated task artifacts.

## Integration disposition

Do not merge #72 wholesale. It is partially superseded by #79, but its residual is not empty. Retain this minimal successor for normal review and all applicable exact-head checks (including both complete six-phase application events and both independent native XCTests). If any gate fails, leave the successor unaccepted and report the source-bound failure; a predecessor pass cannot waive it.

#72 can be retired as superseded by #79 plus this successor after the remaining work is accepted. This checkpoint is neither a production deployment nor physical-device, VoiceOver, enlarged-text, future-format or interrupted-write acceptance.
