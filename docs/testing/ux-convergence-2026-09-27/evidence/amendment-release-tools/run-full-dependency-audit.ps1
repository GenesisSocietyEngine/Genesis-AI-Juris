$ErrorActionPreference='Stop'
$web='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27'
$mobile='C:/PROJECTS/Genesis-AI-Juris/.worktrees/pr45-mobile-5200'
$out=Join-Path $web '.artifacts/amendment-release-gate'
$tool='C:/PROJECTS/Genesis-AI-Juris/.worktrees/demo-readiness-canopy-2026-09-06/.artifacts/toolchains/node-v22.23.2-win-x64'
$node=Join-Path $tool 'node.exe'
$npm=Join-Path $tool 'node_modules/npm/bin/npm-cli.js'
$env:GIT_CONFIG_COUNT='2'
$env:GIT_CONFIG_KEY_0='safe.directory';$env:GIT_CONFIG_VALUE_0=$web
$env:GIT_CONFIG_KEY_1='safe.directory';$env:GIT_CONFIG_VALUE_1=$mobile
$env:npm_config_cache=Join-Path $out 'npm-audit-cache'
$env:Path=$tool+';'+$env:Path
function CheckoutState([string]$path) {
  $head=(& git -C $path rev-parse HEAD) -join ''
  if($LASTEXITCODE -ne 0){throw 'Checkout HEAD read failed'}
  $status=(& git -C $path status --porcelain) -join "`n"
  if($LASTEXITCODE -ne 0){throw 'Checkout status read failed'}
  return [ordered]@{head=$head.Trim();status=$status}
}
function FileRecord([string]$path) {
  $file=Get-Item -LiteralPath $path
  return [ordered]@{file=$file.Name;bytes=$file.Length;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$beforeWeb=CheckoutState $web
$beforeMobile=CheckoutState $mobile
if($beforeWeb.head -ne '6ab091d830ccfd9d6b76c0adc177341bca96e081' -or $beforeWeb.status -or $beforeMobile.head -ne '5200b30cc50c77393c6f48b52ce91c0f30e70c64' -or $beforeMobile.status){throw 'Expected exact clean checkouts before audit'}
$packageBefore=FileRecord (Join-Path $web 'package.json')
$lockBefore=FileRecord (Join-Path $web 'package-lock.json')
$started=[DateTime]::UtcNow.ToString('o')
$stdout=Join-Path $out 'full-dependency-audit-20260927.json'
$stderr=Join-Path $out 'full-dependency-audit-20260927.stderr.log'
$proc=Start-Process -FilePath $node -ArgumentList @($npm,'audit','--json','--registry=https://registry.npmjs.org','--include=dev','--include=optional','--include=peer','--ignore-scripts') -WorkingDirectory $web -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -Wait
$auditExit=$proc.ExitCode
$completed=[DateTime]::UtcNow.ToString('o')
$payload=Get-Content -LiteralPath $stdout -Raw -Encoding UTF8 | ConvertFrom-Json
$afterWeb=CheckoutState $web
$afterMobile=CheckoutState $mobile
$packageAfter=FileRecord (Join-Path $web 'package.json')
$lockAfter=FileRecord (Join-Path $web 'package-lock.json')
$receipt=[ordered]@{
  startedAt=$started;completedAt=$completed;command='npm audit --json --registry=https://registry.npmjs.org --include=dev --include=optional --include=peer --ignore-scripts'
  registry='https://registry.npmjs.org';scope='Full production, development, optional and peer dependency audit; no audit fix or install'
  nodeVersion=((& $node --version) -join '').Trim();npmVersion=((& $node $npm --version) -join '').Trim()
  nodeExecutable=FileRecord $node;npmCli=FileRecord $npm;exitCode=$auditExit;auditReportVersion=$payload.auditReportVersion
  vulnerabilities=$payload.metadata.vulnerabilities;dependencies=$payload.metadata.dependencies
  output=FileRecord $stdout;stderr=FileRecord $stderr
  packageJsonUnchanged=($packageBefore.sha256 -eq $packageAfter.sha256);packageLockUnchanged=($lockBefore.sha256 -eq $lockAfter.sha256)
  packageJson=$packageAfter;packageLock=$lockAfter;beforeWeb=$beforeWeb;afterWeb=$afterWeb;beforeMobile=$beforeMobile;afterMobile=$afterMobile
  notes='The JSON file is exact npm stdout. It contains package/advisory data only; no credentials/cookies/authorization headers were printed or recorded. npm cache is isolated under ignored artifacts. Aggregate production-only audit remains a separate step.'
}
[IO.File]::WriteAllText((Join-Path $out 'full-dependency-audit-20260927.receipt.json'),($receipt|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
[ordered]@{exitCode=$auditExit;node=$receipt.nodeVersion;npm=$receipt.npmVersion;vulnerabilities=$receipt.vulnerabilities;packageJsonUnchanged=$receipt.packageJsonUnchanged;packageLockUnchanged=$receipt.packageLockUnchanged;afterWeb=$afterWeb;afterMobile=$afterMobile;outputSha256=$receipt.output.sha256;stderrBytes=$receipt.stderr.bytes}|ConvertTo-Json -Depth 5
exit $auditExit
