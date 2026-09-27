# Independent review: standalone Android native smoke

27 September 2026, approximately 21:11 UTC. **PASS for the observed standalone Android emulator integration-test invocation, 12 tests; no P0/P1 product or result-reporting defect found within this scope.** The aggregate release command remains a separate running operation. This review did not execute tests, build/install an APK, operate the emulator, change source/configuration, clean artifacts or modify tracked documents.

## Reviewed evidence and source identity

The executed receipt is `../amendment-android-native/native-smoke-result.json`: start **21:05:24.1411907 UTC**, completion **21:07:14.1994385 UTC**, exit **0**, target `emulator-5580` / `UXGatePixel`, exact mobile commit `5200b30cc50c77393c6f48b52ce91c0f30e70c64`.

The invocation is the established release script's native smoke selection:

```text
flutter test --no-pub integration_test/native_android_persistence_smoke_test.dart -d emulator-5580
```

The corrected local launcher uses the already installed Dart executable and Flutter tool snapshot to execute those arguments. It records Flutter 3.44.8, Dart 3.12.2 and the cached stable Rust 1.97.1 Android toolchain. Version strings in the JSON are declared by the launcher; they are not independently produced by that receipt. The retry's generated Flutter defines corroborate Flutter/Dart versions. This review did not run version commands.

Read `native-smoke-retry.stdout.log`, its empty stderr counterpart, `native-smoke-first-wrapper-failure.json`, the original `native-smoke.log`, `native-smoke-artifact-receipt.json`, `gradle-effective-resource-limits.json`, launch/readiness records, the ignored `run-android-smoke.ps1` and `launch-android.ps1`, both versions of `bin/flutter-gate`, `resource-cap-provenance.json`, the release environment/wrapper, and the unchanged tracked release script.

The current mobile checkout independently reports HEAD `5200b30…` and empty Git status; `git diff --name-only HEAD` is also empty. The smoke test's current Git object hash equals `HEAD:path`, `e2690f9daf0afd66a658eb5deecfb2c9c68dfe8f`. Inspected source paths have normal tracked flags. This corroborates the launcher's initial exact-HEAD/clean gate and its recorded final HEAD/empty status. The standalone launcher records final cleanliness but does not turn a dirty final status into a nonzero test exit; interpretation of this run therefore uses both actual fields. The aggregate's stricter final checkout guard must still complete separately.

## What actually passed

The retry stdout shows Gradle `assembleDebug` targeting `android-x64`, a built `app-debug.apk`, installation on the chosen emulator, all 12 named tests, and terminal **`01:09 +12: All tests passed!`**. It contains no product failure terminal lines. The receipt records exit 0, not merely a matched success string. All five byte lengths and SHA-256 values in the standalone artifact receipt match the files independently read during this review:

| Artifact | SHA-256 |
|---|---|
| native-smoke-result.json | `d1412848bb1c46bfccd4249b832b44a791fe4650dd8c26888b4cd8c26924893b` |
| native-smoke-retry.stdout.log | `db63934df1672ba7c22cb42d1d1869c21a23ca0fe7669f16128b5cade22107f3` |
| native-smoke-retry.stderr.log | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty) |
| native-smoke-first-wrapper-failure.json | `92d3605ee5c885136781312bfe0ef4caf3d5bf972d6125a69df86dd3710ab777` |
| gradle-effective-resource-limits.json | `937a58ae7bb0649b672ad8367158884d362066b3ca8c9f15a79ed3e74781ecd0` |

The tests cover debug pressure/lifecycle fixtures, production GreenFire pressure and historical compatibility, GoldenShell deadline replay, Logistics terminal outcome, corrupted saves, Failed ERP, Training Debrief and Desert Water visibility/appeal/closure. The source uses `IntegrationTestWidgetsFlutterBinding` and real `NativeScenarioBridgeClient`; on Android that dynamically opens `libjuris_mobile_ffi.so`, verifies ABI version 1 and calls the native execute/free exports. Recording and historical-counterexample wrappers still delegate execution to that bridge; they are explicit test instrumentation, not fake native responses.

Several tests exercise `ApplicationSupportGameSaveStore` against the platform support directory. **Not all 12 are physical file-persistence tests:** production GreenFire pressure and historical-resave cases deliberately use `_MemoryGameSaveStore`; another native snapshot case serializes/restores a native session directly. Those tests still exercise real FFI/runtime behavior. “12 native integration tests passed” is supported; “12 physical-device disk persistence/cold-reboot tests passed” is not.

## First attempt and wrapper correction

The original attempt has no terminal assertion result in `native-smoke.log`. The separate failure receipt records a PowerShell `NativeCommandError` caused by ordinary Cargo progress on stderr under `ErrorActionPreference=Stop`, and explicitly marks test completion unconfirmed. The raw original log does not itself retain the complete exception stack or establish a failed product assertion. Preserve this as **HARNESS_ERROR / no completed test result**, not an initial product-test failure or a silent pass.

The corrected launcher uses `Start-Process -Wait -PassThru`, separate raw stdout/stderr files and the child's `ExitCode`. It runs the same selected test and device with the same Gradle limits. It does not filter stderr text, suppress test failures, skip assertions or convert a failed test to success. Its current script SHA-256 is `baf6231a42c7186dfd87fef8eb2c6cab5285abc7bbb54e26081d99db98dc54b2`. The later successful run is new evidence; it does not rewrite the first attempt.

## Process resource wrapper

The ignored aggregate Flutter launcher changed only to export these process environment limits before invoking the existing Flutter snapshot with unchanged `"$@"` arguments: Gradle heap 3G, metaspace 1G, code cache 256m, maximum two workers. Current/before launcher hashes independently match the provenance receipt:

- Before: `abd9efee056d08e99dbbf27396300ea6493cdc5c0995b9f746c736943469c60d`.
- After: `102aefbee8d9d4c0056f112af6faa11a4a6468a5076090cb47ac088ad2a6f57a`.
- Recorded change: **21:03:42.6405043 UTC**, before the aggregate's first Flutter use according to the coordinator; this review has not independently reconstructed the entire still-running aggregate process timeline.

The 21:02:43 process observation records both actual Gradle client arguments and a daemon with the requested heap/metaspace/code-cache settings. Retry stdout also prints the Gradle wrapper with those arguments. This supports effective Gradle resource configuration, not a measurement of peak memory or a universal cap on every descendant process. The tracked gate and test assertions remain unchanged. The existing Gradle log includes Flutter's `-PskipDependencyChecks=true`; it was not introduced by this resource wrapper, and does not turn the `--no-pub` standalone run into fresh dependency resolution.

## Actual APK observation and its limits

At **21:10:12.6098513 UTC**, read-only filesystem/ZIP inspection found:

| Observed artifact | Size / identity |
|---|---|
| `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk` | 95,302,358 bytes; last write 21:05:50.6712400 UTC, during the successful invocation; SHA-256 `6c78aa3f8f00bbe32d0f9f6ec465a41ed5d63eba80caf29e4ee23fecfd12d762` |
| APK entry `lib/x86_64/libjuris_mobile_ffi.so` | 5,580,416 bytes; SHA-256 `9623c7280a6ad48c856fe8f9315e10667b45ccd355ca65aee730ba4fb09e2dd6` |
| Current smoke-test source bytes | SHA-256 `d0f4c038dbe835d269bbd18244044f87a9c3dd78f2b083cc1d4c180e9e0527e7` |

Source inspection shows Gradle's `preBuild` depends on the Rust target build tasks, declares the tracked Cargo/lock/crate/build-script inputs, selects x86_64 for this target and packages the resulting JNI library. The real native transport plus successful tests support actual Android FFI execution from the build/install path. The inspected APK is a **debug integration artifact**, not a signed production release.

The APK hash was first observed after the successful run. The original run receipt does not seal the installed APK hash, and this reviewer did not read the installed package back from Android. The packaging library differs from the larger pre-packaging debug library; this review does not claim binary identity between them or a reproducible source-to-binary cryptographic attestation. Retain the source/build/log evidence and the later filesystem observation with their distinct timestamps rather than inventing a device-byte proof.

## Emulator and remaining scope

The launch script creates a dedicated workspace AVD configuration and uses fresh workspace data; it reads the existing profile config but does not copy its user disk/snapshot images. Launch flags include read-only, no snapshot load/save, no window/audio and serial port 5580. Readiness evidence confirms the expected AVD through the shell property and boot completion, with original profile config hash and 18,661 file metadata entries unchanged at that readback. This is metadata/config preservation evidence, not hashes of every existing user disk byte.

Two limits are correctly retained and must not become passes:

1. The planned 120-second boot window was **EXCEEDED**; the emulator log reports 173,459 ms. The earlier `READY_FOR_AGGREGATE` receipt's standalone-smoke NOT_RUN belongs to its 20:40 checkpoint and is superseded only for the later exact smoke invocation.
2. Although `-memory 2048` was requested, emulator stdout says **“Increasing RAM size to 4096MB.”** Do not claim a verified 2GB emulator cap. This is separate from the observed Gradle JVM limits.

The agent-launched emulator remains intentionally retained for the aggregate, with root assigned cleanup afterward. This review did not stop it and cannot yet claim final cleanup, final aggregate mobile immutability or the aggregate release result.

This closes only the standalone local x86_64 Android emulator smoke scope. It is not physical hardware coverage, ARM execution, production-release APK validation, human usability, new iOS execution, hosted workflow rerun or current-candidate hosted acceptance. Existing exact-SHA hosted iOS evidence has its own lock/provenance. No broader release or pilot decision is changed by this result.
