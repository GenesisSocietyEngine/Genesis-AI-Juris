$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw "Flutter was not found. Install it, restart VS Code, and rerun this script."
}

if (-not (Test-Path (Join-Path $AppRoot 'android'))) {
    & (Join-Path $PSScriptRoot 'bootstrap_flutter_windows.ps1')
}

Push-Location $AppRoot
try {
    flutter devices
    flutter run
}
finally {
    Pop-Location
}
