param(
    [switch]$Regenerate,
    [string]$FlutterCommand = 'flutter'
)

$visualAppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$visualTestPath = 'test\visual_identity_foundation_golden_test.dart'
$visualProfileRelative =
    'test\goldens\visual_identity\foundation\windows_x64_flutter_3_44_8_engine_0cd6107'
$visualProfilePath = Join-Path $visualAppRoot $visualProfileRelative
$visualExpectedFiles = @(
    'accessibility_high_contrast_en_800x600_dpr1_ts100_hc1_rm0_frame110ms.png',
    'accessibility_reduced_motion_en_800x600_dpr1_ts100_hc0_rm1_frame110ms.png',
    'accessibility_standard_en_800x600_dpr1_ts100_hc0_rm0_frame110ms.png',
    'motifs_en_1024x768_dpr1_ts100_hc0_rm0.png',
    'typography_controls_en_800x720_dpr1_ts100_hc0_rm0.png',
    'typography_long_ru_800x720_dpr1_ts100_hc0_rm0.png'
)

function Invoke-VisualFlutter {
    param([string[]]$VisualArguments)

    & $FlutterCommand @VisualArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Flutter failed with exit code ${LASTEXITCODE}: $($VisualArguments -join ' ')"
    }
}

function Get-VisualFlutterVersion {
    $visualVersionText = (& $FlutterCommand --version --machine | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read Flutter version; exit code $LASTEXITCODE."
    }
    return $visualVersionText | ConvertFrom-Json
}

function Assert-VisualEnvironment {
    if (-not (Get-Command $FlutterCommand -ErrorAction SilentlyContinue)) {
        throw "Flutter command '$FlutterCommand' was not found."
    }
    if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
        throw 'Canonical visual goldens may be generated only on Windows.'
    }
    if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() -ne 'X64') {
        throw 'Canonical visual goldens require a Windows x64 host.'
    }

    $visualVersion = Get-VisualFlutterVersion
    $visualExpectedVersion = [ordered]@{
        frameworkVersion = '3.44.8'
        frameworkRevision = '058e0af2c2b57e369d905a03ac9748b0ebf543c6'
        engineRevision = '0cd610717bde95fd88343c64f81c11ba4e5c0010'
        dartSdkVersion = '3.12.2'
    }
    foreach ($visualField in $visualExpectedVersion.Keys) {
        $visualActual = [string]$visualVersion.$visualField
        $visualExpected = [string]$visualExpectedVersion[$visualField]
        if ($visualActual -ne $visualExpected) {
            throw "Visual golden environment mismatch: $visualField expected '$visualExpected', got '$visualActual'."
        }
    }

    Write-Host 'Canonical visual golden environment' -ForegroundColor Cyan
    Write-Host "  OS: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription)"
    Write-Host "  Architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
    Write-Host "  Flutter: $($visualVersion.frameworkVersion) ($($visualVersion.frameworkRevision))"
    Write-Host "  Dart: $($visualVersion.dartSdkVersion)"
    Write-Host "  Engine: $($visualVersion.engineRevision)"
}

function Assert-VisualGoldenSet {
    if (-not (Test-Path -LiteralPath $visualProfilePath -PathType Container)) {
        throw "Golden profile directory is missing: $visualProfilePath"
    }
    $visualActualFiles = @(
        Get-ChildItem -LiteralPath $visualProfilePath -File -Filter '*.png' |
            ForEach-Object { $_.Name } |
            Sort-Object
    )
    $visualExpectedSorted = @($visualExpectedFiles | Sort-Object)
    $visualDifference = @(
        Compare-Object -ReferenceObject $visualExpectedSorted -DifferenceObject $visualActualFiles
    )
    if ($visualDifference.Count -ne 0) {
        $visualRenderedDifference = $visualDifference | Out-String
        throw "Golden path set differs from the six-file contract:`n$visualRenderedDifference"
    }
}

function Get-VisualGoldenSnapshot {
    Assert-VisualGoldenSet
    $visualSnapshot = @{}
    foreach ($visualName in $visualExpectedFiles) {
        $visualPath = Join-Path $visualProfilePath $visualName
        $visualFile = Get-Item -LiteralPath $visualPath
        $visualSnapshot[$visualName] = [PSCustomObject]@{
            Name = $visualName
            Length = [long]$visualFile.Length
            Sha256 = (Get-FileHash -LiteralPath $visualPath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    return $visualSnapshot
}

function Write-VisualGoldenSnapshot {
    param([hashtable]$VisualSnapshot)

    foreach ($visualName in ($VisualSnapshot.Keys | Sort-Object)) {
        $visualIdentity = $VisualSnapshot[$visualName]
        Write-Host "$($visualIdentity.Name)`t$($visualIdentity.Length)`t$($visualIdentity.Sha256)"
    }
}

function Assert-VisualSnapshotsEqual {
    param(
        [hashtable]$First,
        [hashtable]$Second,
        [string]$FirstCopyPath
    )

    foreach ($visualName in $visualExpectedFiles) {
        $visualFirst = $First[$visualName]
        $visualSecond = $Second[$visualName]
        if ($visualFirst.Length -ne $visualSecond.Length -or
            $visualFirst.Sha256 -ne $visualSecond.Sha256) {
            throw "Golden instability for '$visualName'. First-run copies remain at '$FirstCopyPath'."
        }
    }
}

function Remove-VerifiedVisualTemp {
    param([string]$VisualTempPath)

    $visualTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $visualResolvedTemp = [System.IO.Path]::GetFullPath($VisualTempPath)
    if (-not $visualResolvedTemp.StartsWith(
        $visualTempRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Refusing to remove unexpected temporary path '$visualResolvedTemp'."
    }
    Remove-Item -LiteralPath $visualResolvedTemp -Recurse -Force
}

Assert-VisualEnvironment
Push-Location $visualAppRoot
try {
    if (-not $Regenerate) {
        Invoke-VisualFlutter -VisualArguments @('test', $visualTestPath)
        $visualExisting = Get-VisualGoldenSnapshot
        Write-Host 'Accepted visual golden identities' -ForegroundColor Green
        Write-VisualGoldenSnapshot -VisualSnapshot $visualExisting
        return
    }

    Invoke-VisualFlutter -VisualArguments @('test', $visualTestPath, '--update-goldens')
    $visualFirst = Get-VisualGoldenSnapshot

    $visualTempDirectory = Join-Path (
        [System.IO.Path]::GetTempPath()
    ) ("juris-visual-goldens-first-$([System.Guid]::NewGuid().ToString('N'))")
    New-Item -ItemType Directory -Path $visualTempDirectory | Out-Null
    foreach ($visualName in $visualExpectedFiles) {
        Copy-Item -LiteralPath (Join-Path $visualProfilePath $visualName) `
            -Destination (Join-Path $visualTempDirectory $visualName)
    }

    Invoke-VisualFlutter -VisualArguments @('test', $visualTestPath, '--update-goldens')
    $visualSecond = Get-VisualGoldenSnapshot
    Assert-VisualSnapshotsEqual `
        -First $visualFirst `
        -Second $visualSecond `
        -FirstCopyPath $visualTempDirectory

    Write-Host 'Two fresh golden renders are byte-identical.' -ForegroundColor Green
    Write-VisualGoldenSnapshot -VisualSnapshot $visualSecond
    Remove-VerifiedVisualTemp -VisualTempPath $visualTempDirectory
}
finally {
    Pop-Location
}
