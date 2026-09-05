$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RepositoryRoot = (Resolve-Path (Join-Path $AppRoot '..\..')).Path
$AndroidDirectory = Join-Path $AppRoot 'android'

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw "Flutter was not found. Install it, restart VS Code, and rerun this script."
}

if (-not (Test-Path $AndroidDirectory)) {
    & (Join-Path $PSScriptRoot 'bootstrap_flutter_windows.ps1')
}

Push-Location $AppRoot
try {
    flutter pub get
    flutter analyze
    flutter test
    flutter build apk --debug

    $BuiltApk = Join-Path $AppRoot 'build\app\outputs\flutter-apk\app-debug.apk'
    if (-not (Test-Path $BuiltApk)) {
        throw "Flutter completed without producing the expected debug APK at $BuiltApk"
    }

    $DistDirectory = Join-Path $RepositoryRoot 'dist'
    New-Item $DistDirectory -ItemType Directory -Force | Out-Null
    $TargetApk = Join-Path $DistDirectory 'genesis-ai-juris-v0.5.0-debug.apk'
    Copy-Item $BuiltApk $TargetApk -Force
    Write-Host "Debug APK created: $TargetApk" -ForegroundColor Green
}
finally {
    Pop-Location
}
