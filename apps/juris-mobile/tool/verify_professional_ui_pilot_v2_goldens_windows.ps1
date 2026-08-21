[CmdletBinding()]
param(
    [switch] $Regenerate,
    [string] $DartExe = 'C:\Users\User\source\flutter\bin\cache\dart-sdk\bin\dart.exe',
    [string] $FlutterSnapshot = 'C:\Users\User\source\flutter\bin\cache\flutter_tools.snapshot',
    [string] $FlutterPackages = 'C:\Users\User\source\flutter\packages\flutter_tools\.dart_tool\package_config.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ExpectedFrameworkVersion = '3.44.8'
$script:ExpectedFrameworkRevision = '058e0af2c2b57e369d905a03ac9748b0ebf543c6'
$script:ExpectedEngineRevision = '0cd610717bde95fd88343c64f81c11ba4e5c0010'
$script:ExpectedDartSdkVersion = '3.12.2'
$script:DartExe = [System.IO.Path]::GetFullPath($DartExe)
$script:FlutterSnapshot = [System.IO.Path]::GetFullPath($FlutterSnapshot)
$script:FlutterPackages = [System.IO.Path]::GetFullPath($FlutterPackages)
$script:FlutterRoot = [System.IO.Path]::GetFullPath(
    (Join-Path (Split-Path -Parent $script:FlutterSnapshot) '..\..'))
$script:AppRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:GoldenTest = 'test\professional_ui_pilot_v2_golden_test.dart'
$script:GoldenGroup = 'professional UI pilot V2 renders'
$script:GoldenProfileRelative = 'test\goldens\visual_identity\professional_ui_pilot_v2\windows_x64_flutter_3_44_8_engine_0cd6107'
$script:GoldenProfile = Join-Path $script:AppRoot $script:GoldenProfileRelative
$script:ExpectedGoldenNames = @(
    'professional_ui_pilot_v2_catalogue_phone_office_en.png'
    'professional_ui_pilot_v2_catalogue_phone_office_ru_ts200.png'
    'professional_ui_pilot_v2_catalogue_tablet_landscape_after_hours_en.png'
    'professional_ui_pilot_v2_operations_phone_office_inactive.png'
    'professional_ui_pilot_v2_operations_phone_after_hours_active_pressure.png'
    'professional_ui_pilot_v2_inbox_phone_office.png'
    'professional_ui_pilot_v2_inbox_phone_after_hours_ru_ts200.png'
    'professional_ui_pilot_v2_dossier_phone_office_en.png'
    'professional_ui_pilot_v2_dossier_tablet_portrait_after_hours_ru.png'
    'professional_ui_pilot_v2_shell_wide_navigation_after_hours_en.png'
    'professional_ui_pilot_v2_operations_phone_after_hours_high_contrast_en.png'
    'professional_ui_pilot_v2_catalogue_phone_office_reduced_motion_en.png'
    'professional_ui_pilot_v2_inbox_message_scenario_response_phone_office_en.png'
    'professional_ui_pilot_v2_available_decisions_sheet_phone_office_en.png'
    'professional_ui_pilot_v2_decision_confirmation_phone_office_en.png'
    'professional_ui_pilot_v2_dossier_selected_evidence_provenance_phone_office_en.png'
)

function Invoke-PilotV2FlutterTools {
    param([Parameter(Mandatory = $true)][string[]] $Arguments)

    $dartPackagesArgument = '--packages=' + $script:FlutterPackages
    Write-Host (('> {0} {1} {2} {3}' -f $script:DartExe, $dartPackagesArgument,
            $script:FlutterSnapshot, ($Arguments -join ' ')))
    & $script:DartExe $dartPackagesArgument $script:FlutterSnapshot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "flutter_tools.snapshot exited with code $LASTEXITCODE."
    }
}

function Get-PilotV2FlutterVersion {
    $dartPackagesArgument = '--packages=' + $script:FlutterPackages
    $machineOutput = & $script:DartExe $dartPackagesArgument $script:FlutterSnapshot `
        '--version' '--machine'
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the Flutter toolchain version (exit code $LASTEXITCODE)."
    }

    try {
        return (($machineOutput -join [Environment]::NewLine) | ConvertFrom-Json)
    }
    catch {
        throw "flutter_tools.snapshot --version --machine returned invalid JSON: $($_.Exception.Message)"
    }
}

function Assert-PilotV2RegularFile {
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][string] $Label
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label does not exist as a regular file: $Path"
    }
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Label must not be a symlink or reparse point: $Path"
    }
}

function Assert-PilotV2Environment {
    if (-not [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
            [System.Runtime.InteropServices.OSPlatform]::Windows)) {
        throw 'Pilot V2 goldens are pinned to Windows.'
    }

    $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    if ($architecture -ne 'X64') {
        throw "Pilot V2 goldens are pinned to Windows x64; detected $architecture."
    }

    Assert-PilotV2RegularFile -Path $script:DartExe -Label 'Dart executable'
    Assert-PilotV2RegularFile -Path $script:FlutterSnapshot -Label 'Flutter tool snapshot'
    Assert-PilotV2RegularFile -Path $script:FlutterPackages -Label 'Flutter package configuration'

    $version = Get-PilotV2FlutterVersion
    $expected = [ordered]@{
        frameworkVersion = $script:ExpectedFrameworkVersion
        frameworkRevision = $script:ExpectedFrameworkRevision
        engineRevision = $script:ExpectedEngineRevision
        dartSdkVersion = $script:ExpectedDartSdkVersion
    }

    foreach ($propertyName in $expected.Keys) {
        $property = $version.PSObject.Properties[$propertyName]
        if ($null -eq $property) {
            throw "Flutter version metadata is missing '$propertyName'."
        }
        if ([string] $property.Value -ne [string] $expected[$propertyName]) {
            throw ("Toolchain mismatch for {0}: expected '{1}', found '{2}'." -f `
                    $propertyName, $expected[$propertyName], $property.Value)
        }
    }

    Write-Host '[OK] Windows x64 Flutter/Dart golden toolchain matches the pinned profile.'
}

function Get-PilotV2ValidatedGoldenNames {
    param([switch] $AllowMissingProfile)

    if (-not (Test-Path -LiteralPath $script:GoldenProfile)) {
        if ($AllowMissingProfile) {
            return @()
        }
        throw "Golden profile does not exist: $script:GoldenProfile"
    }
    if (-not (Test-Path -LiteralPath $script:GoldenProfile -PathType Container)) {
        throw "Golden profile is not a directory: $script:GoldenProfile"
    }

    $profileItem = Get-Item -LiteralPath $script:GoldenProfile -Force
    if (($profileItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Golden profile must not be a symlink or reparse point: $script:GoldenProfile"
    }

    $names = @()
    foreach ($entity in @(Get-ChildItem -LiteralPath $script:GoldenProfile -Force)) {
        if (($entity.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Golden profile contains a symlink or reparse point: $($entity.FullName)"
        }
        if ($entity.PSIsContainer) {
            throw "Golden profile contains a nested directory: $($entity.FullName)"
        }
        if ($entity.Extension -cne '.png') {
            throw "Golden profile contains a non-PNG entity: $($entity.FullName)"
        }
        if ($script:ExpectedGoldenNames -cnotcontains $entity.Name) {
            throw "Golden profile contains an unexpected PNG: $($entity.FullName)"
        }
        $names += $entity.Name
    }
    return @($names | Sort-Object)
}

function Assert-PilotV2GoldenSet {
    $actual = @(Get-PilotV2ValidatedGoldenNames)
    $expected = @($script:ExpectedGoldenNames | Sort-Object)
    $difference = @(Compare-Object -ReferenceObject $expected -DifferenceObject $actual)
    if ($difference.Count -ne 0) {
        $details = $difference | ForEach-Object {
            if ($_.SideIndicator -eq '<=') {
                "missing: $($_.InputObject)"
            }
            else {
                "unexpected: $($_.InputObject)"
            }
        }
        throw ("Pilot V2 golden set is not exact:`n  " + ($details -join "`n  "))
    }
}

function Reset-PilotV2ExpectedGoldenOutputs {
    $null = Get-PilotV2ValidatedGoldenNames -AllowMissingProfile
    if (-not (Test-Path -LiteralPath $script:GoldenProfile)) {
        $null = New-Item -ItemType Directory -Path $script:GoldenProfile -Force
    }

    foreach ($name in $script:ExpectedGoldenNames) {
        $path = Join-Path $script:GoldenProfile $name
        if (Test-Path -LiteralPath $path) {
            $item = Get-Item -LiteralPath $path -Force
            if ($item.PSIsContainer -or
                (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
                throw "Refusing to remove a non-regular expected output path: $path"
            }
            Remove-Item -LiteralPath $path -Force
        }
    }
}

function Get-PilotV2GoldenSnapshot {
    Assert-PilotV2GoldenSet
    return @(
        foreach ($name in ($script:ExpectedGoldenNames | Sort-Object)) {
            $path = Join-Path $script:GoldenProfile $name
            $file = Get-Item -LiteralPath $path -Force
            [pscustomobject]@{
                Name = $name
                Length = [long] $file.Length
                Sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
            }
        }
    )
}

function Assert-PilotV2SnapshotsEqual {
    param(
        [Parameter(Mandatory = $true)][object[]] $First,
        [Parameter(Mandatory = $true)][object[]] $Second
    )

    if ($First.Count -ne $Second.Count) {
        throw "Double-render count mismatch: first=$($First.Count), second=$($Second.Count)."
    }

    for ($index = 0; $index -lt $First.Count; $index++) {
        $left = $First[$index]
        $right = $Second[$index]
        if ($left.Name -ne $right.Name -or
            $left.Length -ne $right.Length -or
            $left.Sha256 -ne $right.Sha256) {
            throw (("Double-render mismatch for '{0}': first length/hash {1}/{2}; " +
                    'second length/hash {3}/{4}.') -f $left.Name, $left.Length,
                $left.Sha256, $right.Length, $right.Sha256)
        }
    }
}

function Remove-VerifiedPilotV2TempDirectory {
    param([Parameter(Mandatory = $true)][string] $Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $tempPrefix = $tempRoot.TrimEnd([char[]] @('\', '/')) + `
        [System.IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove a path outside the system temporary directory: $fullPath"
    }
    if ([System.IO.Path]::GetFileName($fullPath) -notlike 'juris-pilot-v2-goldens-*') {
        throw "Refusing to remove an unexpected temporary directory: $fullPath"
    }

    if (Test-Path -LiteralPath $fullPath -PathType Container) {
        Remove-Item -LiteralPath $fullPath -Recurse -Force
    }
}

$previousFlutterRoot = [Environment]::GetEnvironmentVariable('FLUTTER_ROOT', 'Process')
$temporaryFirstRender = $null
$regenerationVerified = $false
$locationPushed = $false

try {
    [Environment]::SetEnvironmentVariable('FLUTTER_ROOT', $script:FlutterRoot, 'Process')
    Assert-PilotV2Environment

    Push-Location $script:AppRoot
    $locationPushed = $true
    if (-not $Regenerate) {
        Invoke-PilotV2FlutterTools -Arguments @(
            'test', '--no-pub', '-r', 'expanded', $script:GoldenTest
        )
        $snapshot = @(Get-PilotV2GoldenSnapshot)
        Write-Host ("[OK] Verified {0} pinned Pilot V2 goldens." -f $snapshot.Count)
        return
    }

    Write-Warning 'DELIBERATE UPDATE: regenerating only the professional UI Pilot V2 render group.'
    Reset-PilotV2ExpectedGoldenOutputs
    Invoke-PilotV2FlutterTools -Arguments @(
        'test', '--no-pub', '-r', 'expanded', $script:GoldenTest,
        '--name', $script:GoldenGroup, '--update-goldens'
    )
    $firstSnapshot = @(Get-PilotV2GoldenSnapshot)

    $temporaryFirstRender = Join-Path ([System.IO.Path]::GetTempPath()) `
        ('juris-pilot-v2-goldens-' + [guid]::NewGuid().ToString('N'))
    $null = New-Item -ItemType Directory -Path $temporaryFirstRender
    foreach ($name in $script:ExpectedGoldenNames) {
        Copy-Item -LiteralPath (Join-Path $script:GoldenProfile $name) `
            -Destination (Join-Path $temporaryFirstRender $name)
    }

    Write-Host '[CHECK] Rendering the exact group in a fresh Flutter process for determinism.'
    Reset-PilotV2ExpectedGoldenOutputs
    Invoke-PilotV2FlutterTools -Arguments @(
        'test', '--no-pub', '-r', 'expanded', $script:GoldenTest,
        '--name', $script:GoldenGroup, '--update-goldens'
    )
    $secondSnapshot = @(Get-PilotV2GoldenSnapshot)
    Assert-PilotV2SnapshotsEqual -First $firstSnapshot -Second $secondSnapshot
    $regenerationVerified = $true
    Write-Host ("[OK] Regenerated and double-render verified {0} Pilot V2 goldens." -f `
            $secondSnapshot.Count)
}
finally {
    if ($locationPushed) {
        Pop-Location
    }
    [Environment]::SetEnvironmentVariable('FLUTTER_ROOT', $previousFlutterRoot, 'Process')
    if ($regenerationVerified -and $null -ne $temporaryFirstRender) {
        Remove-VerifiedPilotV2TempDirectory -Path $temporaryFirstRender
    }
    elseif ($null -ne $temporaryFirstRender) {
        Write-Warning "First-render evidence was retained for diagnosis: $temporaryFirstRender"
    }
}
