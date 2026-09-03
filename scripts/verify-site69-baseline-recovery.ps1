[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$BundlePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Expected = [ordered]@{
  Base = 'c088200138332cd212b87e266746ea85b53a2f77'
  BaseRoot = '4f42c11b422be41704f8b72e417e83feed1674f3'
  Site = '6019e47346a2bf719a09dc1d874a2fc807f99598'
  SiteRoot = '86111ee6244d2f78d9c552b56cfb3e3e583268f6'
  SiteTree = 'e415361e9a39fc823d625f80c883398b18914e6e'
  Provenance = '48227d0af54d7f5c117f3d29311f399602fe1933'
  BundleSha256 = 'fddb2f07cf2c8220169d758f7490e57695623bf1ca1d16574b2abefa509a657e'
  BundleBytes = 51822446
  SiteHistoryCount = 72
  SitePathCount = 373
  SitePathManifestSha256 = 'b1f800a750639000ddbfab44efe430742f97134343f862f58d747df1384e358c'
}

$FrozenBlobs = [ordered]@{
  'drizzle/0011_operational_events.sql' = '0b556f390a83eec0dccd6dc76d12340a3083620b79e34ea1fa0cd4e83711e6c7'
  'drizzle/0012_sleepy_magma_core.sql' = 'f7287a42b2afb176de4f892fe476d6242dffb62e6d336484fbae55c077a0fe8c'
  'drizzle/0013_sleepy_magma_guards_a.sql' = '18332d50e4b12c729187280a3dc397c35ef95e3daacc7a33419bfe327338022e'
  'drizzle/0014_sleepy_magma_guards_b.sql' = '0eb85af54bea36fc6bd57319e4d0ae9761154fb497ab741dcb5830086da0c37b'
  'drizzle/0015_sleepy_magma_guards_c.sql' = '82f696cc99ed5fd5b921d064cf7a4fc14b3ce77f06375c1c8b8aa631417429e5'
  'drizzle/0016_polite_sentinels.sql' = '50a12891dbc6376d0dadf0b8008ad39815f7c5255204f745c3a2687f1e549c83'
  'drizzle/0017_perfect_marvex.sql' = '0c98f442f7652b859d90b0ad7e070a762b18686357e013e807933d08ab2f4036'
  'drizzle/0018_low_calypso.sql' = '5e4c6cfed12d3e4e59be200829473630d665e71ad2289fb8a46f572a30653f84'
  'drizzle/meta/0011_snapshot.json' = '1b8c402a12eaf85bec3ed91b2c0e6f67606c630fcb5400c04e6aad64b25bc096'
  'drizzle/meta/0012_snapshot.json' = '2b3b06d685ac2b685a5fcc778a89c0ac1b9fc7d6c08a49bd3fc955e1ac850077'
  'drizzle/meta/0013_snapshot.json' = '1386270c72349407c35eb2f215ad0c05b47a1bf2b949ef4d2de4c1d9243a46ca'
  'drizzle/meta/0014_snapshot.json' = '7d5eb459839a9cf29fa141bdc4b99b56f250a6c97d8178c05ca27d42a7cee8b4'
  'drizzle/meta/0015_snapshot.json' = '00b16cd0c60210e458e4781e56446e3b4a2fa81c624cd1087ba91dc6683f0ab5'
  'drizzle/meta/0016_snapshot.json' = 'eab3ea213949697fff163ebcbb5816ecffe92365b3ff43b483a85ff33c1f74de'
  'drizzle/meta/0017_snapshot.json' = 'e7c49630218c2803f166c85decebb2d2e2a27693f88d2d66341ae7b9046d2dd9'
  'drizzle/meta/0018_snapshot.json' = '2bc294e56636a5fff773c85aaa8c192870d8661f5dd032b14b68a34ea44aeafa'
  'drizzle/meta/_journal.json' = '02bb7a530efdc3f3da03979d52d5afaa9628fcf22454eb9d6aefbe65515bc680'
}

$ExpectedJournalTags = [ordered]@{
  11 = '0011_operational_events'
  12 = '0012_sleepy_magma_core'
  13 = '0013_sleepy_magma_guards_a'
  14 = '0014_sleepy_magma_guards_b'
  15 = '0015_sleepy_magma_guards_c'
  16 = '0016_polite_sentinels'
  17 = '0017_perfect_marvex'
  18 = '0018_low_calypso'
}

function Assert-Equal {
  param(
    [AllowNull()][object]$Actual,
    [AllowNull()][object]$ExpectedValue,
    [Parameter(Mandatory = $true)][string]$Label
  )

  if ([string]$Actual -cne [string]$ExpectedValue) {
    throw "$Label mismatch. Expected '$ExpectedValue'; got '$Actual'."
  }
}

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [int[]]$AllowedExitCodes = @(0)
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = @(& git @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($AllowedExitCodes -notcontains $exitCode) {
    throw "git $($Arguments -join ' ') failed with exit code $exitCode.`n$($output -join "`n")"
  }
  return $output
}

function Invoke-GitSingleLine {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $lines = @(Invoke-Git -Arguments $Arguments)
  if ($lines.Count -ne 1) {
    throw "git $($Arguments -join ' ') returned $($lines.Count) lines; expected exactly one."
  }
  return [string]$lines[0]
}

function Get-GitBlobBytes {
  param(
    [Parameter(Mandatory = $true)][string]$Ref,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = 'git'
  $startInfo.Arguments = "cat-file blob $Ref`:$Path"
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  $memory = New-Object System.IO.MemoryStream
  try {
    [void]$process.Start()
    $process.StandardOutput.BaseStream.CopyTo($memory)
    $errorText = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      throw "Unable to read Git blob $Ref`:$Path. $errorText"
    }
    return $memory.ToArray()
  }
  finally {
    $memory.Dispose()
    $process.Dispose()
  }
}

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)

  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
  }
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$resolvedBundle = (Resolve-Path -LiteralPath $BundlePath).Path
$originalLocation = Get-Location

try {
  Set-Location -LiteralPath $repositoryRoot

  $gitRoot = Invoke-GitSingleLine -Arguments @('rev-parse', '--show-toplevel')
  Assert-Equal -Actual ([System.IO.Path]::GetFullPath($gitRoot)) -ExpectedValue ([System.IO.Path]::GetFullPath($repositoryRoot)) -Label 'Repository root'

  $originMain = Invoke-GitSingleLine -Arguments @('rev-parse', 'refs/remotes/origin/main^{commit}')
  Assert-Equal -Actual $originMain -ExpectedValue $Expected.Base -Label 'origin/main'

  $siteRef = Invoke-GitSingleLine -Arguments @('rev-parse', 'refs/remotes/site69/main^{commit}')
  Assert-Equal -Actual $siteRef -ExpectedValue $Expected.Site -Label 'Imported Site 69 ref'

  $baseRoots = @(Invoke-Git -Arguments @('rev-list', '--max-parents=0', $Expected.Base))
  Assert-Equal -Actual $baseRoots.Count -ExpectedValue 1 -Label 'GitHub base root count'
  Assert-Equal -Actual $baseRoots[0] -ExpectedValue $Expected.BaseRoot -Label 'GitHub base root'

  $siteRoots = @(Invoke-Git -Arguments @('rev-list', '--max-parents=0', $Expected.Site))
  Assert-Equal -Actual $siteRoots.Count -ExpectedValue 1 -Label 'Site root count'
  Assert-Equal -Actual $siteRoots[0] -ExpectedValue $Expected.SiteRoot -Label 'Site root'

  $siteTree = Invoke-GitSingleLine -Arguments @('rev-parse', "$($Expected.Site)^{tree}")
  Assert-Equal -Actual $siteTree -ExpectedValue $Expected.SiteTree -Label 'Site tree'

  $siteHistoryCount = [int](Invoke-GitSingleLine -Arguments @('rev-list', '--count', $Expected.Site))
  Assert-Equal -Actual $siteHistoryCount -ExpectedValue $Expected.SiteHistoryCount -Label 'Site history count'

  $sitePaths = @(Invoke-Git -Arguments @('ls-tree', '-r', '--name-only', $Expected.Site))
  Assert-Equal -Actual $sitePaths.Count -ExpectedValue $Expected.SitePathCount -Label 'Site tracked-path count'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $pathManifestBytes = $utf8.GetBytes(([string]::Join("`n", $sitePaths) + "`n"))
  $pathManifestSha256 = Get-Sha256Hex -Bytes $pathManifestBytes
  Assert-Equal -Actual $pathManifestSha256 -ExpectedValue $Expected.SitePathManifestSha256 -Label 'Site path-manifest SHA-256'

  $mergeBaseOutput = @(Invoke-Git -Arguments @('merge-base', $Expected.Base, $Expected.Site) -AllowedExitCodes @(1))
  Assert-Equal -Actual ($mergeBaseOutput -join '').Trim() -ExpectedValue '' -Label 'Pre-recovery merge base output'

  $provenanceLine = Invoke-GitSingleLine -Arguments @('rev-list', '--parents', '-n', '1', $Expected.Provenance)
  $provenanceFields = @($provenanceLine -split '\s+')
  Assert-Equal -Actual $provenanceFields.Count -ExpectedValue 3 -Label 'Provenance field count'
  Assert-Equal -Actual $provenanceFields[0] -ExpectedValue $Expected.Provenance -Label 'Provenance commit'
  Assert-Equal -Actual $provenanceFields[1] -ExpectedValue $Expected.Base -Label 'Provenance first parent'
  Assert-Equal -Actual $provenanceFields[2] -ExpectedValue $Expected.Site -Label 'Provenance second parent'

  $provenanceTree = Invoke-GitSingleLine -Arguments @('rev-parse', "$($Expected.Provenance)^{tree}")
  Assert-Equal -Actual $provenanceTree -ExpectedValue $Expected.SiteTree -Label 'Provenance tree'
  [void](Invoke-Git -Arguments @('diff', '--exit-code', '--no-ext-diff', $Expected.Site, $Expected.Provenance, '--'))

  $head = Invoke-GitSingleLine -Arguments @('rev-parse', 'HEAD^{commit}')
  $headLine = Invoke-GitSingleLine -Arguments @('rev-list', '--parents', '-n', '1', $head)
  $headFields = @($headLine -split '\s+')
  Assert-Equal -Actual $headFields.Count -ExpectedValue 2 -Label 'Recovery-head field count'
  Assert-Equal -Actual $headFields[1] -ExpectedValue $Expected.Provenance -Label 'Recovery-head parent'

  $expectedEvidencePaths = @(
    'docs/SITE69-BASELINE-RECOVERY-RECEIPT.md'
    'scripts/verify-site69-baseline-recovery.ps1'
  ) | Sort-Object
  $actualEvidencePaths = @(Invoke-Git -Arguments @('diff', '--name-only', $Expected.Provenance, $head, '--')) | Sort-Object
  $pathDifference = @(Compare-Object -ReferenceObject $expectedEvidencePaths -DifferenceObject $actualEvidencePaths)
  Assert-Equal -Actual $pathDifference.Count -ExpectedValue 0 -Label 'Evidence-only path set'

  foreach ($entry in $FrozenBlobs.GetEnumerator()) {
    $actualHash = Get-Sha256Hex -Bytes (Get-GitBlobBytes -Ref $head -Path $entry.Key)
    Assert-Equal -Actual $actualHash -ExpectedValue $entry.Value -Label "Frozen blob $($entry.Key)"
  }

  $journalBytes = Get-GitBlobBytes -Ref $head -Path 'drizzle/meta/_journal.json'
  $journal = $utf8.GetString($journalBytes) | ConvertFrom-Json
  foreach ($entry in $ExpectedJournalTags.GetEnumerator()) {
    $matches = @($journal.entries | Where-Object { [int]$_.idx -eq [int]$entry.Key })
    Assert-Equal -Actual $matches.Count -ExpectedValue 1 -Label "Journal entry count for index $($entry.Key)"
    Assert-Equal -Actual $matches[0].tag -ExpectedValue $entry.Value -Label "Journal tag for index $($entry.Key)"
  }

  $bundleInfo = Get-Item -LiteralPath $resolvedBundle
  Assert-Equal -Actual $bundleInfo.Length -ExpectedValue $Expected.BundleBytes -Label 'Bundle size'
  $bundleSha256 = (Get-FileHash -LiteralPath $resolvedBundle -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-Equal -Actual $bundleSha256 -ExpectedValue $Expected.BundleSha256 -Label 'Bundle SHA-256'

  [void](Invoke-Git -Arguments @('bundle', 'verify', $resolvedBundle))
  $bundleHeads = @(Invoke-Git -Arguments @('bundle', 'list-heads', $resolvedBundle))
  Assert-Equal -Actual $bundleHeads.Count -ExpectedValue 1 -Label 'Bundle advertised-ref count'
  Assert-Equal -Actual $bundleHeads[0] -ExpectedValue "$($Expected.Site) refs/heads/main" -Label 'Bundle advertised ref'

  [void](Invoke-Git -Arguments @('fsck', '--full', '--strict'))

  $summary = [ordered]@{
    status = 'PASS'
    exactRecoveryHead = $head
    provenanceMerge = $Expected.Provenance
    provenanceParents = @($Expected.Base, $Expected.Site)
    provenanceTree = $provenanceTree
    provenanceDiffAgainstSite69 = 'empty'
    bundleSha256 = $bundleSha256
    bundleBytes = $bundleInfo.Length
    siteHistoryCount = $siteHistoryCount
    siteTrackedPaths = $sitePaths.Count
    sitePathManifestSha256 = $pathManifestSha256
    preRecoveryMergeBase = $null
    frozenMigrationArtifacts = $FrozenBlobs.Count
    evidenceOnlyPaths = $actualEvidencePaths
    suppliedHistoricalSiteArchiveReceipt = [ordered]@{
      independentlyVerified = $false
      sha256 = '3dcfe92950c2e5e0f99d7f638f0f66633397c5c25e62ac9e065cc8e27255d555'
      files = 320
      bytes = 25825280
    }
  }

  Write-Output ($summary | ConvertTo-Json -Depth 5)
}
finally {
  Set-Location -LiteralPath $originalLocation
}
