#!/usr/bin/env bash
set -euo pipefail

target="${1:?Rust Android target is required}"
profile="${2:-debug}"
app_root="$(cd "$(dirname "$0")/.." && pwd)"
repository_root="$(cd "$app_root/../.." && pwd)"
android_sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"

if [[ -z "$android_sdk" ]]; then
  echo "ANDROID_SDK_ROOT or ANDROID_HOME must be set" >&2
  exit 1
fi

if [[ -n "${ANDROID_NDK_HOME:-}" ]]; then
  ndk_root="$ANDROID_NDK_HOME"
else
  ndk_root="$(find "$android_sdk/ndk" -mindepth 1 -maxdepth 1 -type d | sort -r | head -n 1)"
fi

host_tag="linux-x86_64"
if [[ "$(uname -s)" == "Darwin" ]]; then
  host_tag="darwin-x86_64"
fi
toolchain="$ndk_root/toolchains/llvm/prebuilt/$host_tag/bin"
api_level=24

case "$target" in
  aarch64-linux-android)
    abi="arm64-v8a"
    linker="$toolchain/aarch64-linux-android${api_level}-clang"
    export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$linker"
    ;;
  armv7-linux-androideabi)
    abi="armeabi-v7a"
    linker="$toolchain/armv7a-linux-androideabi${api_level}-clang"
    export CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER="$linker"
    ;;
  x86_64-linux-android)
    abi="x86_64"
    linker="$toolchain/x86_64-linux-android${api_level}-clang"
    export CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER="$linker"
    ;;
  *)
    echo "Unsupported Rust Android target: $target" >&2
    exit 1
    ;;
esac

cargo_arguments=(build -p juris-mobile-ffi --target "$target")
if [[ "$profile" == "release" ]]; then
  cargo_arguments+=(--release)
fi

(cd "$repository_root" && cargo "${cargo_arguments[@]}")

source_library="$repository_root/target/$target/$profile/libjuris_mobile_ffi.so"
destination_directory="$app_root/android/app/src/main/jniLibs/$abi"
mkdir -p "$destination_directory"
cp "$source_library" "$destination_directory/libjuris_mobile_ffi.so"
