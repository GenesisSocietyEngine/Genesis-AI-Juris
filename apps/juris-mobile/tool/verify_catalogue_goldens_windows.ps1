param(
    [switch]$Regenerate,
    [string]$FlutterCommand = 'flutter'
)

$catalogueAppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$catalogueTestPath = 'test\cinematic_case_catalog_golden_test.dart'
$catalogueProfileRelative =
    'test\goldens\visual_identity\catalogue\windows_x64_flutter_3_44_8_engine_0cd6107'
$catalogueProfilePath = Join-Path $catalogueAppRoot $catalogueProfileRelative
$catalogueExpectedFiles = @(
    'catalogue_compact_actions_en_412x915_dpr1_ts200_hc0_rm1.png',
    'catalogue_compact_first_en_360x800_dpr1_ts100_hc0_rm0.png',
    'catalogue_compact_greenfire_en_412x915_dpr1_ts100_hc0_rm0.png',
    'catalogue_compact_long_title_ru_360x800_dpr1_ts100_hc0_rm0.png',
    'catalogue_wide_complete_index_en_1024x768_dpr1_ts100_hc0_rm0.png',
    'catalogue_wide_complete_index_ru_800x1280_dpr1_ts100_hc0_rm0.png'
)

function Invoke-CatalogueFlutter {
    param([string[]]$CatalogueArguments)

    & $FlutterCommand @CatalogueArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Flutter failed with exit code ${LASTEXITCODE}: $($CatalogueArguments -join ' ')"
    }
}

function Get-CatalogueFlutterVersion {
    $catalogueVersionText = (& $FlutterCommand --version --machine | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read Flutter version; exit code $LASTEXITCODE."
    }
    return $catalogueVersionText | ConvertFrom-Json
}

function Assert-CatalogueEnvironment {
    if (-not (Get-Command $FlutterCommand -ErrorAction SilentlyContinue)) {
        throw "Flutter command '$FlutterCommand' was not found."
    }
    if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
        throw 'Canonical catalogue goldens may be generated only on Windows.'
    }
    if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() -ne 'X64') {
        throw 'Canonical catalogue goldens require a Windows x64 host.'
    }

    $catalogueVersion = Get-CatalogueFlutterVersion
    $catalogueExpectedVersion = [ordered]@{
        frameworkVersion = '3.44.8'
        frameworkRevision = '058e0af2c2b57e369d905a03ac9748b0ebf543c6'
        engineRevision = '0cd610717bde95fd88343c64f81c11ba4e5c0010'
        dartSdkVersion = '3.12.2'
    }
    foreach ($catalogueField in $catalogueExpectedVersion.Keys) {
        $catalogueActual = [string]$catalogueVersion.$catalogueField
        $catalogueExpected = [string]$catalogueExpectedVersion[$catalogueField]
        if ($catalogueActual -ne $catalogueExpected) {
            throw "Catalogue golden environment mismatch: $catalogueField expected '$catalogueExpected', got '$catalogueActual'."
        }
    }

    Write-Host 'Canonical catalogue golden environment' -ForegroundColor Cyan
    Write-Host "  OS: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription)"
    Write-Host "  Architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
    Write-Host "  Flutter: $($catalogueVersion.frameworkVersion) ($($catalogueVersion.frameworkRevision))"
    Write-Host "  Dart: $($catalogueVersion.dartSdkVersion)"
    Write-Host "  Engine: $($catalogueVersion.engineRevision)"
}

function Assert-CatalogueGoldenSet {
    if (-not (Test-Path -LiteralPath $catalogueProfilePath -PathType Container)) {
        throw "Catalogue golden profile directory is missing: $catalogueProfilePath"
    }
    $catalogueActualFiles = @(
        Get-ChildItem -LiteralPath $catalogueProfilePath -File -Filter '*.png' |
            ForEach-Object { $_.Name } |
            Sort-Object
    )
    $catalogueExpectedSorted = @($catalogueExpectedFiles | Sort-Object)
    $catalogueDifference = @(
        Compare-Object -ReferenceObject $catalogueExpectedSorted -DifferenceObject $catalogueActualFiles
    )
    if ($catalogueDifference.Count -ne 0) {
        $catalogueRenderedDifference = $catalogueDifference | Out-String
        throw "Catalogue golden path set differs from the six-file contract:`n$catalogueRenderedDifference"
    }
}

function Get-CatalogueGoldenSnapshot {
    Assert-CatalogueGoldenSet
    $catalogueSnapshot = @{}
    foreach ($catalogueName in $catalogueExpectedFiles) {
        $cataloguePath = Join-Path $catalogueProfilePath $catalogueName
        $catalogueFile = Get-Item -LiteralPath $cataloguePath
        $catalogueSnapshot[$catalogueName] = [PSCustomObject]@{
            Name = $catalogueName
            Length = [long]$catalogueFile.Length
            Sha256 = (Get-FileHash -LiteralPath $cataloguePath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    return $catalogueSnapshot
}

function Write-CatalogueGoldenSnapshot {
    param([hashtable]$CatalogueSnapshot)

    foreach ($catalogueName in ($CatalogueSnapshot.Keys | Sort-Object)) {
        $catalogueIdentity = $CatalogueSnapshot[$catalogueName]
        Write-Host "$($catalogueIdentity.Name)`t$($catalogueIdentity.Length)`t$($catalogueIdentity.Sha256)"
    }
}

function Assert-CatalogueSnapshotsEqual {
    param(
        [hashtable]$First,
        [hashtable]$Second,
        [string]$FirstCopyPath
    )

    foreach ($catalogueName in $catalogueExpectedFiles) {
        $catalogueFirst = $First[$catalogueName]
        $catalogueSecond = $Second[$catalogueName]
        if ($catalogueFirst.Length -ne $catalogueSecond.Length -or
            $catalogueFirst.Sha256 -ne $catalogueSecond.Sha256) {
            throw "Catalogue golden instability for '$catalogueName'. First-run copies remain at '$FirstCopyPath'."
        }
    }
}

function Remove-VerifiedCatalogueTemp {
    param([string]$CatalogueTempPath)

    $catalogueTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $catalogueResolvedTemp = [System.IO.Path]::GetFullPath($CatalogueTempPath)
    if (-not $catalogueResolvedTemp.StartsWith(
        $catalogueTempRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Refusing to remove unexpected temporary path '$catalogueResolvedTemp'."
    }
    Remove-Item -LiteralPath $catalogueResolvedTemp -Recurse -Force
}

Assert-CatalogueEnvironment
Push-Location $catalogueAppRoot
try {
    if (-not $Regenerate) {
        Invoke-CatalogueFlutter -CatalogueArguments @('test', $catalogueTestPath)
        $catalogueExisting = Get-CatalogueGoldenSnapshot
        Write-Host 'Accepted catalogue golden identities' -ForegroundColor Green
        Write-CatalogueGoldenSnapshot -CatalogueSnapshot $catalogueExisting
        return
    }

    Invoke-CatalogueFlutter -CatalogueArguments @('test', $catalogueTestPath, '--update-goldens')
    $catalogueFirst = Get-CatalogueGoldenSnapshot

    $catalogueTempDirectory = Join-Path (
        [System.IO.Path]::GetTempPath()
    ) ("juris-catalogue-goldens-first-$([System.Guid]::NewGuid().ToString('N'))")
    New-Item -ItemType Directory -Path $catalogueTempDirectory | Out-Null
    foreach ($catalogueName in $catalogueExpectedFiles) {
        Copy-Item -LiteralPath (Join-Path $catalogueProfilePath $catalogueName) `
            -Destination (Join-Path $catalogueTempDirectory $catalogueName)
    }

    Invoke-CatalogueFlutter -CatalogueArguments @('test', $catalogueTestPath, '--update-goldens')
    $catalogueSecond = Get-CatalogueGoldenSnapshot
    Assert-CatalogueSnapshotsEqual `
        -First $catalogueFirst `
        -Second $catalogueSecond `
        -FirstCopyPath $catalogueTempDirectory

    Write-Host 'Two fresh catalogue golden renders are byte-identical.' -ForegroundColor Green
    Write-CatalogueGoldenSnapshot -CatalogueSnapshot $catalogueSecond
    Remove-VerifiedCatalogueTemp -CatalogueTempPath $catalogueTempDirectory
}
finally {
    Pop-Location
}
