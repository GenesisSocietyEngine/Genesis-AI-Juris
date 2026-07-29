#!/usr/bin/env bash
set -euo pipefail

sdk_name="${1:?Xcode SDK name is required}"
architectures="${2:?Xcode architectures are required}"
configuration="${3:-Debug}"
output_directory="${4:?Output directory is required}"
app_root="$(cd "$(dirname "$0")/.." && pwd)"
repository_root="$(cd "$app_root/../.." && pwd)"
profile="debug"
cargo_profile=()

if [[ "$configuration" != "Debug" ]]; then
  profile="release"
  cargo_profile=(--release)
fi

targets=()
for architecture in $architectures; do
  if [[ "$sdk_name" == iphoneos* ]]; then
    targets+=(aarch64-apple-ios)
  elif [[ "$architecture" == "arm64" ]]; then
    targets+=(aarch64-apple-ios-sim)
  elif [[ "$architecture" == "x86_64" ]]; then
    targets+=(x86_64-apple-ios)
  else
    echo "Unsupported iOS architecture: $architecture" >&2
    exit 1
  fi
done

libraries=()
for target in "${targets[@]}"; do
  (cd "$repository_root" && cargo build -p juris-mobile-ffi --target "$target" "${cargo_profile[@]}")
  libraries+=("$repository_root/target/$target/$profile/libjuris_mobile_ffi.a")
done

mkdir -p "$output_directory"
output_library="$output_directory/libjuris_mobile_ffi.a"
if [[ "${#libraries[@]}" -eq 1 ]]; then
  cp "${libraries[0]}" "$output_library"
else
  xcrun lipo -create "${libraries[@]}" -output "$output_library"
fi
