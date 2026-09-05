param(
    [switch]$ForcePlatformRegeneration
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. Install Flutter and restart VS Code."
    }
}
function Invoke-FlutterChecked {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & flutter @Arguments

    if ($LASTEXITCODE -ne 0) {
        $RenderedArguments = $Arguments -join ' '
        throw "flutter $RenderedArguments failed with exit code $LASTEXITCODE"
    }
}

Require-Command 'flutter'

Write-Host "Flutter environment" -ForegroundColor Cyan
flutter --version
flutter doctor

$AndroidDirectory = Join-Path $AppRoot 'android'
if ($ForcePlatformRegeneration -and (Test-Path $AndroidDirectory)) {
    Remove-Item $AndroidDirectory -Recurse -Force
}

if (-not (Test-Path $AndroidDirectory)) {
    $TemporaryProject = Join-Path ([System.IO.Path]::GetTempPath()) "juris-mobile-bootstrap-$PID"
    if (Test-Path $TemporaryProject) {
        Remove-Item $TemporaryProject -Recurse -Force
    }

    Write-Host "Generating current Flutter Android platform scaffolding..." -ForegroundColor Cyan
    Invoke-FlutterChecked create `
        --empty `
        --org com.genesissocietyengine `
        --project-name juris_mobile `
        --platforms android `
        $TemporaryProject

    Copy-Item (Join-Path $TemporaryProject 'android') $AndroidDirectory -Recurse
    Copy-Item (Join-Path $TemporaryProject '.metadata') (Join-Path $AppRoot '.metadata') -Force

    $Manifest = Join-Path $AndroidDirectory 'app\src\main\AndroidManifest.xml'
    if (Test-Path $Manifest) {
        $ManifestContent = Get-Content $Manifest -Raw
        $ManifestContent = $ManifestContent -replace 'android:label="juris_mobile"', 'android:label="GENESIS: AI Juris"'
        Set-Content $Manifest -Value $ManifestContent -Encoding utf8
    }

    Remove-Item $TemporaryProject -Recurse -Force
}

Push-Location $AppRoot
try {
    Write-Host "Resolving Flutter dependencies..." -ForegroundColor Cyan
    Invoke-FlutterChecked pub get

    Write-Host "Running static analysis..." -ForegroundColor Cyan
    Invoke-FlutterChecked analyze

    Write-Host "Running widget tests..." -ForegroundColor Cyan
    Invoke-FlutterChecked test
}
finally {
    Pop-Location
}

Write-Host "Mobile shell is ready. Run tool\run_android_windows.ps1 to launch it." -ForegroundColor Green
