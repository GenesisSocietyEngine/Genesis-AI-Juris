$ErrorActionPreference='Stop'
$workspace=(Resolve-Path -LiteralPath 'C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27').Path
$taskRoot=Join-Path $workspace '.artifacts/amendment-android-native'
$avdRoot=Join-Path $taskRoot 'avd'
$avdPath=Join-Path $avdRoot 'UXGatePixel.avd'
if(Test-Path -LiteralPath $avdPath){throw 'Disposable AVD path already exists; do not overwrite it.'}
$sdk='C:/Users/User/AppData/Local/Android/Sdk'
$sourceAvd='C:/Users/User/.android/avd/Pixel.avd'
$emulator=Join-Path $sdk 'emulator/emulator.exe'
$adb=Join-Path $sdk 'platform-tools/adb.exe'
if(@(Get-NetTCPConnection -LocalPort 5580,5581 -ErrorAction SilentlyContinue).Count -gt 0){throw 'Dedicated emulator ports are already in use.'}
New-Item -ItemType Directory -Path $avdPath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $taskRoot 'emulator-home') -Force | Out-Null
$sourceBefore=@(Get-ChildItem -LiteralPath $sourceAvd -Recurse -File | ForEach-Object {[ordered]@{relative=$_.FullName.Substring($sourceAvd.Length);length=$_.Length;lastWriteUtc=$_.LastWriteTimeUtc.ToString('o')}})
$config=[IO.File]::ReadAllText((Join-Path $sourceAvd 'config.ini'))
$config=$config.Replace('AvdId=Pixel','AvdId=UXGatePixel').Replace('avd.ini.displayname=Pixel','avd.ini.displayname=Synthetic UX gate disposable Pixel').Replace('fastboot.forceColdBoot=no','fastboot.forceColdBoot=yes').Replace('fastboot.forceFastBoot=yes','fastboot.forceFastBoot=no').Replace('hw.sdCard=yes','hw.sdCard=no').Replace('disk.dataPartition.size=10G','disk.dataPartition.size=4G')
[IO.File]::WriteAllText((Join-Path $avdPath 'config.ini'),$config,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $avdRoot 'UXGatePixel.ini'),"avd.ini.encoding=UTF-8`npath=$avdPath`ntarget=android-37.0`n",[Text.UTF8Encoding]::new($false))
$arguments=@('-avd','UXGatePixel','-port','5580','-read-only','-no-snapshot-load','-no-snapshot-save','-no-window','-no-audio','-gpu','swiftshader','-memory','2048','-cores','2')
$acceptance=[ordered]@{preparedAt=[DateTime]::UtcNow.ToString('o');mobileCommit='5200b30cc50c77393c6f48b52ce91c0f30e70c64';purpose='Exact locked Android FFI persistence smoke on synthetic disposable emulator';criteria=@('Fresh isolated workspace data; no user AVD images or accounts copied','Existing AVD data/snapshot metadata and source config unchanged','Dedicated serial emulator-5580 ready with sys.boot_completed=1 within120seconds','Run unmodified native_android_persistence_smoke_test.dart on exact locked checkout','Record actual exit/failures; do not weaken test or install/updateSDK','Stop only agent-launched emulator; final tracked checkout guard passes');originalProfileConfigSha256=(Get-FileHash -LiteralPath (Join-Path $sourceAvd 'config.ini') -Algorithm SHA256).Hash.ToLowerInvariant();sourceAvdFileMetadata=$sourceBefore;args=$arguments;readOnly=$true;noSnapshotLoad=$true;noSnapshotSave=$true;freshWorkspaceAvd=$avdPath}
[IO.File]::WriteAllText((Join-Path $taskRoot 'acceptance-before-launch.json'),($acceptance|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
$env:ANDROID_SDK_ROOT=$sdk
$env:ANDROID_HOME=$sdk
$env:ANDROID_USER_HOME='C:/Users/User/.android'
$env:ANDROID_EMULATOR_HOME=Join-Path $taskRoot 'emulator-home'
$env:ANDROID_AVD_HOME=$avdRoot
$launch=Start-Process -FilePath $emulator -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'emulator.stdout.log') -RedirectStandardError (Join-Path $taskRoot 'emulator.stderr.log') -PassThru
$receipt=[ordered]@{launchedAt=[DateTime]::UtcNow.ToString('o');pid=$launch.Id;serial='emulator-5580';avd='UXGatePixel';taskRoot=$taskRoot;args=$arguments;bootTimeoutSeconds=120}
[IO.File]::WriteAllText((Join-Path $taskRoot 'launch.json'),($receipt|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$receipt|ConvertTo-Json -Compress
