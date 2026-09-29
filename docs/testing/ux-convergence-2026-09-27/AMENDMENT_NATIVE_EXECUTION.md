# Android native continuation — standalone result

Prepared for publication after the aggregate's final clean-checkout guard. **The full release aggregate is still RUNNING and has a separate result.** This note records the completed standalone invocation; it neither substitutes for the aggregate native step nor grants release or pilot acceptance.

The earlier ready-device absence was resolved locally. A fresh, task-owned `UXGatePixel` AVD was created under `.artifacts/amendment-android-native/avd` using the installed API 37 x86_64 image and a hardware configuration derived from the existing Pixel profile. User disk/account/snapshot images were not copied. The launch used `-read-only -no-snapshot-load -no-snapshot-save -no-window -no-audio -gpu swiftshader -memory 2048 -cores 2`, dedicated port 5580, and a hidden process. The emulator increased the requested 2048 MB RAM to **4096 MB effective RAM**; this was not a verified 2 GiB cap. Guest property `ro.boot.qemu.avd_name=UXGatePixel`, `sys.boot_completed=1`, and the owned process command lines established readiness and identity.

The cold boot took **173,459 ms**, exceeding the planned 120-second window. The final bounded poll was delayed across context compaction; the timing criterion remains **EXCEEDED**, not PASS. Launcher PID 4116 and headless QEMU child 25048 were recorded. At 20:40:06 UTC, the original Pixel configuration hash and all 18,661 original file path/size/mtime entries were unchanged. This establishes configuration/metadata preservation at that checkpoint, not a hash of every disk image or final cleanup.

## Executed result and limits

The exact locked mobile checkout `5200b30cc50c77393c6f48b52ce91c0f30e70c64` ran:

```text
flutter test --no-pub integration_test/native_android_persistence_smoke_test.dart -d emulator-5580
```

**PASS: 12 native integration tests, exit 0**, from 21:05:24.1411907 to21:07:14.1994385 UTC. Gradle assembled the debug x86_64 APK in 24.9 seconds; installation completed, followed by the terminal `01:09 +12: All tests passed!`. The final mobile HEAD remained exact and Git status was empty. The installed SDK/tool invocation was Flutter 3.44.8, Dart 3.12.2 and cached stable Rust 1.97.1 with Android targets. `--no-pub` used existing dependencies; it is not a fresh dependency-resolution result.

The unchanged tests exercise actual Android FFI plus production/debug scenarios, save/restore, corrupted input, historical compatibility, deadlines, lifecycle, debrief and UI restoration. Several tests use in-memory save stores while still calling the real native bridge. The supported result is **12 native integration tests**, not 12 physical-device disk-persistence or cold-reboot checks. This is local x86_64 emulator/debug-build evidence; no hardware, ARM, signed production APK, new iOS/hosted execution or human-usability claim is made.

The first attempt remains **HARNESS_ERROR / no completed assertion receipt**. Ordinary Cargo compilation progress on stderr triggered a terminating Windows PowerShell `NativeCommandError` under `ErrorActionPreference=Stop`. The original log and separate failure receipt are retained. After confirming the prior build had finished and no active owned Flutter/Gradle client remained, the ignored launcher was corrected to `Start-Process -WindowStyle Hidden -Wait -PassThru` with separate raw stdout/stderr and the actual child exit code. Test arguments, source and assertions stayed unchanged. The successful retry is separate evidence. The first launcher was edited in place; no separately archived original-script hash is claimed.

Before launching, free physical RAM was 6,498.5 MiB. The tracked Gradle defaults allowed 8G heap plus 4G metaspace; this invocation used only a process-environment override:

```text
GRADLE_OPTS=-Dorg.gradle.jvmargs="-Xmx3G -XX:MaxMetaspaceSize=1G -XX:ReservedCodeCacheSize=256m -XX:+HeapDumpOnOutOfMemoryError" -Dorg.gradle.workers.max=2
```

The actual daemon command line confirmed the 3G/1G/256m limits, and the client carried workers.max=2. These are Gradle settings, not a cap on every descendant or a peak-memory measurement. No tracked Gradle configuration or test source changed. The aggregate's ignored Flutter wrapper separately records the same resource limits and will run its own unchanged command.

Independent read-only review corroborated the logs, all five receipt hashes and current clean mobile source. It later observed a 95,302,358-byte debug APK with SHA256 `6c78aa3f8f00bbe32d0f9f6ec465a41ed5d63eba80caf29e4ee23fecfd12d762` and its packaged x86_64 bridge. That filesystem observation occurred after the test run; no installed-device APK byte digest or reproducible source-to-binary attestation was captured.

## Evidence publication mapping

Original ignored artifacts remain unchanged. Planned destination names under `docs/testing/ux-convergence-2026-09-27/evidence/`:

| Original under `.artifacts/` | Planned evidence name |
| --- | --- |
| `amendment-android-native/native-smoke-result.json` | `amendment-native-result.json` |
| `amendment-android-native/native-smoke-retry.stdout.log` | `amendment-native-stdout.log` |
| `amendment-android-native/native-smoke-retry.stderr.log` | `amendment-native-stderr.log` |
| `amendment-android-native/native-smoke.log` | `amendment-native-first-wrapper.log` |
| `amendment-android-native/native-smoke-first-wrapper-failure.json` | `amendment-native-first-wrapper-failure.json` |
| `amendment-android-native/native-smoke-artifact-receipt.json` | `amendment-native-artifact-receipt.json` |
| `amendment-android-native/gradle-effective-resource-limits.json` | `amendment-native-gradle-limits.json` |
| `amendment-android-native/{launch,ready-for-aggregate}.json` | `amendment-native-{launch,ready}.json` |
| `amendment-android-native/emulator.stdout.log` | `amendment-native-emulator.log` |
| `ux-reconciliation-auth/amendment-native-critical-review.md` | independent native review, final destination assigned by coordinator |

The readiness receipt's earlier standalone NOT_RUN is a dated 20:40 checkpoint and is superseded only for this later standalone invocation. Preserve it rather than rewriting history.

## Safe cleanup — pending coordinator instruction

**Do not execute while the aggregate needs the emulator.** Cleanup has not happened at this note's checkpoint.

1. Obtain the coordinator's completion signal, then confirm there is no active aggregate Flutter/native test. Load the launch receipt. Read only the dedicated serial's AVD property and the recorded launcher/QEMU process identity. Require the expected AVD `UXGatePixel`, port 5580, QEMU parent 4116, exact SDK executable paths and process creation times consistent with the recorded 20:35:08 UTC launch. A reused PID, different command line/device, or ambiguous ownership stops cleanup.
2. Request graceful shutdown only for the verified serial with `adb -s emulator-5580 emu kill`, using the same task Android environment. The earlier console AVD-name query returned empty despite exit 0, so success must be verified by process/device disappearance, not that exit code alone. Poll responsively for a bounded interval.
3. If still present, revalidate ownership immediately, then stop only the verified task QEMU PID 25048 and its launcher PID 4116 as needed using native PowerShell `Stop-Process -Id`. Do not kill all emulators, Java/Gradle services, unrelated Dart processes or the shared ADB server. If recorded IDs are gone, do not act on replacements.
4. Record exact cleanup timestamps and remaining device inventory; compare the original Pixel config SHA and normalized path/size/mtime list with `acceptance-before-launch.json`; read back the locked mobile HEAD/status. Preserve task logs/AVD artifacts. No recursive deletion or user-profile cleanup is required.

The aggregate outcome, final immutability guards and actual cleanup receipt must be added from their later real results. They are not predicted here.
