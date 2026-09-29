$ErrorActionPreference = 'Stop'
$p1NativeRoot = 'C:/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29/.artifacts/p1-android-native'
$p1GateRoot = 'C:/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29/.artifacts/p1-release-gate-retest'
foreach ($p1Required in @('exit-code.txt','finished.txt','source-after.json')) {
  if (-not (Test-Path -LiteralPath (Join-Path $p1GateRoot $p1Required))) { throw 'Aggregate has not terminated with its outer source receipt.' }
}
$p1Saved = Get-Content -Raw -LiteralPath (Join-Path $p1NativeRoot 'restart.json') | ConvertFrom-Json
$p1Handles = @{}
$p1Outcomes = @()
# Verify every surviving identity before stopping any process; pin OS handles.
foreach ($p1Expected in $p1Saved.processes) {
  $p1Observed = Get-CimInstance Win32_Process -Filter "ProcessId = $($p1Expected.ProcessId)"
  if ($null -eq $p1Observed) { $p1Outcomes += @{pid=$p1Expected.ProcessId;result='already absent'}; continue }
  if ($p1Observed.CreationDate.ToUniversalTime().ToString('o') -ne $p1Expected.CreationTimeUtc -or $p1Observed.ExecutablePath -ne $p1Expected.ExecutablePath -or $p1Observed.CommandLine -ne $p1Expected.CommandLine -or $p1Observed.ParentProcessId -ne $p1Expected.ParentProcessId) { throw "Process identity changed: $($p1Expected.ProcessId)" }
  $p1Process = Get-Process -Id $p1Expected.ProcessId
  $null = $p1Process.Handle
  $p1ExpectedUtc = [DateTimeOffset]::Parse($p1Expected.CreationTimeUtc).UtcDateTime
  if ([Math]::Abs(($p1Process.StartTime.ToUniversalTime()-$p1ExpectedUtc).TotalMilliseconds) -gt 1) { throw 'Pinned process start time mismatch.' }
  $p1Handles[[int]$p1Expected.ProcessId] = $p1Process
}
$p1Order = @($p1Saved.processes | Sort-Object @{Expression={switch ($_.Name) {'qemu-system-x86_64-headless.exe' {0} 'emulator.exe' {1} 'conhost.exe' {2} 'crashpad_handler.exe' {3} 'adb.exe' {4} default {throw 'Unrecognized process in owned receipt.'}}}})
foreach ($p1Expected in $p1Order) {
  $p1Process = $p1Handles[[int]$p1Expected.ProcessId]
  if ($null -eq $p1Process) { continue }
  if ($p1Process.HasExited) { $p1Outcomes += @{pid=$p1Expected.ProcessId;result='exited during owned cleanup'}; continue }
  $p1Process.Kill()
  $p1Exited = $p1Process.WaitForExit(5000)
  if (-not $p1Exited) { throw 'Owned process did not exit within five seconds.' }
  $p1Outcomes += @{pid=$p1Expected.ProcessId;name=$p1Expected.Name;result='stopped via revalidated pinned handle'}
}
$p1RemainingPorts = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in 5039,5580,5581} | Select-Object LocalAddress,LocalPort,OwningProcess)
$p1Receipt = @{observedAt=[DateTime]::UtcNow.ToString('o');method='Exact saved CIM identities, UTC start-time checks, pinned Process handles; only owned private emulator and ADB server';outcomes=$p1Outcomes;remainingPrivatePorts=$p1RemainingPorts;otherProcessesTargeted=$false;avdDataDeleted=$false;status= $(if($p1RemainingPorts.Count -eq 0){'PASS'}else{'FAIL'})}
[IO.File]::WriteAllText((Join-Path $p1NativeRoot 'cleanup.json'),($p1Receipt|ConvertTo-Json -Depth 6)+"`n",(New-Object System.Text.UTF8Encoding($false)))
$p1Receipt|ConvertTo-Json -Depth 6
if ($p1RemainingPorts.Count -ne 0) { throw 'Private ports still listening; inspect without broad cleanup.' }
