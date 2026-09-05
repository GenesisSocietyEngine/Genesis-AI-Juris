param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(
        "aarch64-linux-android",
        "armv7-linux-androideabi",
        "x86_64-linux-android"
    )]
    [string]$Target,

    [ValidateSet("debug", "release")]
    [string]$Profile = "debug"
)

$ErrorActionPreference = "Stop"

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repositoryRoot = (Resolve-Path (Join-Path $appRoot "..\..")).Path
$androidSdk = if ($env:ANDROID_SDK_ROOT) {
    $env:ANDROID_SDK_ROOT
} elseif ($env:ANDROID_HOME) {
    $env:ANDROID_HOME
} else {
    Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$ndkRoot = if ($env:ANDROID_NDK_HOME) {
    $env:ANDROID_NDK_HOME
} else {
    $ndkBase = Join-Path $androidSdk "ndk"
    $latestNdk = Get-ChildItem -LiteralPath $ndkBase -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if (-not $latestNdk) {
        throw "Android NDK was not found under $ndkBase"
    }
    $latestNdk.FullName
}

$toolchain = Join-Path $ndkRoot "toolchains\llvm\prebuilt\windows-x86_64\bin"
$apiLevel = 24
$configuration = switch ($Target) {
    "aarch64-linux-android" {
        @{
            Abi = "arm64-v8a"
            Linker = "aarch64-linux-android$apiLevel-clang.cmd"
            CargoKey = "AARCH64_LINUX_ANDROID"
        }
    }
    "armv7-linux-androideabi" {
        @{
            Abi = "armeabi-v7a"
            Linker = "armv7a-linux-androideabi$apiLevel-clang.cmd"
            CargoKey = "ARMV7_LINUX_ANDROIDEABI"
        }
    }
    "x86_64-linux-android" {
        @{
            Abi = "x86_64"
            Linker = "x86_64-linux-android$apiLevel-clang.cmd"
            CargoKey = "X86_64_LINUX_ANDROID"
        }
    }
}

$linker = Join-Path $toolchain $configuration.Linker
if (-not (Test-Path -LiteralPath $linker)) {
    throw "Android linker was not found: $linker"
}

$linkerVariable = "CARGO_TARGET_$($configuration.CargoKey)_LINKER"
Set-Item -Path "Env:$linkerVariable" -Value $linker

$cargoArguments = @(
    "build",
    "-p",
    "juris-mobile-ffi",
    "--target",
    $Target
)
if ($Profile -eq "release") {
    $cargoArguments += "--release"
}

Push-Location $repositoryRoot
try {
    & cargo @cargoArguments
    if ($LASTEXITCODE -ne 0) {
        throw "cargo build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

$source = Join-Path $repositoryRoot "target\$Target\$Profile\libjuris_mobile_ffi.so"
$destinationDirectory =
    Join-Path $appRoot "android\app\src\main\jniLibs\$($configuration.Abi)"
if (-not (Test-Path -LiteralPath $source)) {
    throw "Rust Android library was not produced: $source"
}

New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
Copy-Item -LiteralPath $source -Destination (
    Join-Path $destinationDirectory "libjuris_mobile_ffi.so"
) -Force
