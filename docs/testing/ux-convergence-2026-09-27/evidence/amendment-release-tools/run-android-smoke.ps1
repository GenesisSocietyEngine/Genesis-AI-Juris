$ErrorActionPreference='Stop'
$workspace='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27'
$mobile='C:/PROJECTS/Genesis-AI-Juris/.worktrees/pr45-mobile-5200'
$taskRoot=Join-Path $workspace '.artifacts/amendment-android-native'
$sdk='C:/Users/User/AppData/Local/Android/Sdk'
$adb=Join-Path $sdk 'platform-tools/adb.exe'
$env:ANDROID_SDK_ROOT=$sdk
$env:ANDROID_HOME=$sdk
$env:ANDROID_USER_HOME='C:/Users/User/.android'
$env:ANDROID_AVD_HOME=Join-Path $taskRoot 'avd'
$env:ANDROID_EMULATOR_HOME=Join-Path $taskRoot 'emulator-home'
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:FLUTTER_ROOT='C:/Users/User/source/flutter'
$env:RUSTUP_TOOLCHAIN='stable-x86_64-pc-windows-msvc'
$env:CARGO_NET_OFFLINE='true'
$env:GRADLE_OPTS='-Dorg.gradle.jvmargs="-Xmx3G -XX:MaxMetaspaceSize=1G -XX:ReservedCodeCacheSize=256m -XX:+HeapDumpOnOutOfMemoryError" -Dorg.gradle.workers.max=2'
$env:Path='C:/Users/User/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin;'+$env:JAVA_HOME+'/bin;'+$env:Path
Remove-Item Env:CARGO_TARGET_DIR -ErrorAction SilentlyContinue
$env:GIT_CONFIG_COUNT='1';$env:GIT_CONFIG_KEY_0='safe.directory';$env:GIT_CONFIG_VALUE_0=$mobile
$head=(& git -C $mobile rev-parse HEAD) -join ''
$dirty=(& git -C $mobile status --porcelain) -join ''
if($head.Trim() -ne '5200b30cc50c77393c6f48b52ce91c0f30e70c64' -or $dirty){throw 'Locked mobile checkout is not exact and clean'}
$name=(& $adb -s emulator-5580 shell getprop ro.boot.qemu.avd_name) -join ''
if($name.Trim() -ne 'UXGatePixel'){throw 'Dedicated serial is not our disposable AVD'}
$boot=(& $adb -s emulator-5580 shell getprop sys.boot_completed) -join ''
if($boot.Trim() -ne '1'){throw 'Disposable AVD has not completed boot'}
$receipt=[ordered]@{startedAt=[DateTime]::UtcNow.ToString('o');serial='emulator-5580';avd='UXGatePixel';mobileCommit='5200b30cc50c77393c6f48b52ce91c0f30e70c64';command='flutter test --no-pub integration_test/native_android_persistence_smoke_test.dart -d emulator-5580';flutter='3.44.8';dart='3.12.2';rust='1.97.1 stable cached Android targets';gradleOpts=$env:GRADLE_OPTS;status='RUNNING'}
[IO.File]::WriteAllText((Join-Path $taskRoot 'native-smoke-result.json'),($receipt|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
Push-Location (Join-Path $mobile 'apps/juris-mobile')
try {
  $nativeProcess=Start-Process -FilePath 'C:/Users/User/source/flutter/bin/cache/dart-sdk/bin/dart.exe' -ArgumentList @('C:/Users/User/source/flutter/bin/cache/flutter_tools.snapshot','test','--no-pub','integration_test/native_android_persistence_smoke_test.dart','-d','emulator-5580') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'native-smoke-retry.stdout.log') -RedirectStandardError (Join-Path $taskRoot 'native-smoke-retry.stderr.log') -PassThru -Wait
  $result=$nativeProcess.ExitCode
} finally {Pop-Location}
$receipt.status=if($result -eq 0){'PASS'}else{'FAIL'}
$receipt.Add('exitCode',$result);$receipt.Add('completedAt',[DateTime]::UtcNow.ToString('o'))
$receipt.Add('finalMobileHead',((& git -C $mobile rev-parse HEAD) -join '').Trim());$receipt.Add('finalMobileStatus',((& git -C $mobile status --porcelain) -join "`n"))
[IO.File]::WriteAllText((Join-Path $taskRoot 'native-smoke-result.json'),($receipt|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$receipt|ConvertTo-Json -Compress
exit $result
