# Execute the selected Dart driver without a second Flutter CLI lifecycle

The host already builds the application with Flutter, installs it, launches the selected isolated Simulator application, verifies its complete bundle and resolves its authenticated VM URI from source-bound system events. The runtime now invokes the same Dart driver executable that Flutter delegates to. It still requires a real zero process exit, every selected-test assertion and receipt, application termination and absence, and every per-architecture export audit. All six phases remain mandatory.

The once-only Flutter/Rust preparation remains bounded at 900 seconds, each runtime at 300 seconds, the exercise at 30 minutes and the job at 45 minutes. Current same-bundle installation before each phase is unchanged. No timeout, authentication, selected-test or financial assertion is removed.

## Observed failure on `6c86bfb`

Both jobs at source `6c86bfb5b2e41331860974342b863536c3a67916` completed their initial build and selected `write` test but failed to complete the surrounding host phase. Neither reached `read`, recorded host `driver_exit=0`, or proved the application's termination/absence. The two native XCTest jobs passed separately; they do not replace these failed application gates.

| Evidence | PR | Push |
| --- | --- | --- |
| Run / job | 36785092463 / 110124479510 | 36785086674 / 110124460827 |
| Terminal failure UTC | 22:49:40 | 22:51:59 |
| Preparation elapsed | 570.815s, exit 0 | 811.563s, exit 0 |
| Runner PID | 37108 | 46751 |
| Raw application test pass UTC | 22:46:09.982488 | 22:47:46.952441 |
| Receipt and screenshot ZIP modification time UTC | 22:46:10 | 22:47:46 |
| Artifact ID / bytes | 11130023363 / 545868 | 11130263248 / 523231 |
| Artifact ZIP SHA-256 | `7643f5aabe4f8b9dbddcb6450bc4a6fda13a629a48729c27b2c2500ce4d0737c` | `1bc5d1f22406bdc4a5068a2237753c6be29e33e1ea1c4480b5ad2328bdc48643` |
| Full job-log SHA-256 | `787372bbc58f1247170d883343c98065a744c8561bda9f5bcc61e58601c36003` | `6d0b64f6628445fab9ea0fa6abc033b8a8fcc421cffb93e7563b947166115f1c` |

The immutable captures are under `.artifacts/pr68-ios-2026-09-30/ios-application-v2-budget6c86-pr-36785092463-attempt-1/` and `ios-application-v2-budget6c86-push-36785086674-attempt-1/`. Their original ZIPs, complete logs, raw system events, source identity, full write receipts and screenshots are retained. ZIP timestamps corroborate retained output timing; they are not used as a substitute for the raw application events or terminal process proof.

The PR's `write.log` lines 8793–8799 and push's lines 7070–7076 contain the validated driver completion markers, Flutter's application-left-running message, command durations of 229590ms and 223989ms, and completed shutdown hooks. Both then hit the outer 300-second timeout. PR retained `cleanup_incomplete` with unknown process-group state. Push's eventual Flutter exit-code-zero trace appears after its timeout and cannot convert that timeout into success. Hosted output is buffered; its arrival timestamps do not establish the exact time the driver executed or exited.

This localizes failure to host completion after the selected test. It does not establish an analytics/network cause or identify a specific lingering handle. Pinned Flutter's post-hook path awaits analytics closure and schedules its final exit, but the pinned analytics implementation normally has a short bound or is a no-op on CI. Simulator APNs warnings are retained diagnostics, not a demonstrated cause.

## Supported invocation and retained identity

The inspected SDK is Flutter 3.44.8, revision `058e0af2c2b57e369d905a03ac9748b0ebf543c6`, with Dart 3.12.2. Its [FlutterDriverService.startTest](https://github.com/flutter/flutter/blob/058e0af2c2b57e369d905a03ac9748b0ebf543c6/packages/flutter_tools/lib/src/drive/drive_service.dart#L243) delegates to the cached Dart executable and the driver file with `VM_SERVICE_URL`. The [driver connection implementation](https://github.com/flutter/flutter/blob/058e0af2c2b57e369d905a03ac9748b0ebf543c6/packages/flutter_driver/lib/src/driver/vmservice_driver.dart#L78) accepts that direct VM URL, preserves its authentication token when opening the WebSocket, and resumes a `PauseStart` isolate. It does not require DDS. The existing host already verifies this exact VM's PID and executable; no port or authentication value is inferred.

Preparation now retains the SDK identity and cached Dart binary hash. Every runtime requires that identity to match before installation or launch. The invocation is exactly the cached Dart executable followed by `test_driver/tax_application_driver.dart`, using the authenticated URI and explicit phase/source/nonce/output environment fields. There is no secondary `flutter drive` process, DDS startup or unfiltered device-log reader. The existing source-bound log reader remains enabled.

Separate start and terminal driver records retain the command, SDK identity, Runner PID, preparation digest, selected environment fields and actual exit status. A marker without zero exit is rejected. Missing, changed or failed driver evidence also fails the offline verifier. A timeout remains a failure even if a late process subsequently exits zero.

## Review and remaining evidence

All 53 local phase controls pass. New coverage checks pinned SDK discovery, changed SDK refusal before installation, exact direct command and authenticated environment, actual nonzero child exit despite success text, timeout/missing/wrong-PID cases, and offline identity/environment/exit tampering. All existing six-phase financial and persistence assertions remain in the source. Root independently reviewed all four changed paths and the pinned SDK implementation, reran all 53 controls successfully, and found no material issue. Fresh macOS execution remains pending. No current full-six-phase success, physical-device, spoken-accessibility, iOS future-format or interrupted-write acceptance is claimed.
