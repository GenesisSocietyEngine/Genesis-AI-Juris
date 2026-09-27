#!/usr/bin/env bash
# Source this only from the explicit aggregate launcher or read-only probe.
set -euo pipefail
gate_root='/c/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27'
gate_node='/c/PROJECTS/Genesis-AI-Juris/.worktrees/demo-readiness-canopy-2026-09-06/.artifacts/toolchains/node-v22.23.2-win-x64'
gate_poppler='/c/PROJECTS/Genesis-AI-Juris/.worktrees/demo-readiness-canopy-2026-09-06/.artifacts/toolchains/poppler/poppler-25.07.0/Library/bin'
gate_rust='/c/Users/User/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin'
export PATH="${gate_root}/.artifacts/amendment-release-gate/bin:${gate_node}:${gate_rust}:${gate_poppler}:/c/Program Files/Git/bin:/c/Program Files/Git/usr/bin:/c/Users/User/AppData/Local/Android/Sdk/platform-tools:/c/Program Files/Android/Android Studio/jbr/bin:${PATH}"

export JURIS_MOBILE_REPO='C:/PROJECTS/Genesis-AI-Juris/.worktrees/pr45-mobile-5200'
export JURIS_FLUTTER_BIN="${gate_root}/.artifacts/amendment-release-gate/bin/flutter-gate"
export JURIS_DART_BIN="${gate_root}/.artifacts/amendment-release-gate/bin/dart-gate"
export JURIS_CARGO_BIN='C:/Users/User/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe'
export CARGO="${JURIS_CARGO_BIN}"
export RUSTC='C:/Users/User/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/rustc.exe'
export RUSTUP_TOOLCHAIN='stable-x86_64-pc-windows-msvc'
export CARGO_NET_OFFLINE=true
# The existing Android build script locates mobile checkout/target; don't redirect it.
unset CARGO_TARGET_DIR

export FLUTTER_ROOT='C:/Users/User/source/flutter'
export FLUTTER_SUPPRESS_ANALYTICS=true
export ANDROID_SDK_ROOT='C:/Users/User/AppData/Local/Android/Sdk'
export ANDROID_HOME="${ANDROID_SDK_ROOT}"
export JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
export ANDROID_AVD_HOME='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27/.artifacts/amendment-android-native/avd'
export ANDROID_EMULATOR_HOME='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27/.artifacts/amendment-android-native/emulator-home'
export ANDROID_USER_HOME='C:/Users/User/.android'
export JURIS_ANDROID_DEVICE_ID='emulator-5580'

export POPPLER_BIN='C:/PROJECTS/Genesis-AI-Juris/.worktrees/demo-readiness-canopy-2026-09-06/.artifacts/toolchains/poppler/poppler-25.07.0/Library/bin'
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=safe.directory
export GIT_CONFIG_VALUE_0='C:/PROJECTS/Genesis-AI-Juris/.worktrees/pr45-mobile-5200'
export GIT_CONFIG_KEY_1=safe.directory
export GIT_CONFIG_VALUE_1='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27'
export WRANGLER_SEND_METRICS=false
export WRANGLER_WRITE_LOGS=false
export NEXT_TELEMETRY_DISABLED=1
export SITES_RUNTIME_ROOT="${gate_root}/.artifacts/amendment-release-gate/sites-runtime"
export WRANGLER_LOG_PATH='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27/.artifacts/amendment-release-gate/wrangler-logs'
export MINIFLARE_REGISTRY_PATH='C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27/.artifacts/amendment-release-gate/miniflare-registry'
export npm_config_registry='https://registry.npmjs.org/'
unset NPM_CONFIG_REGISTRY
export npm_config_update_notifier=false
export npm_config_fund=false
unset REPORT_PDF_UPDATE_VISUAL_BASELINE
# Native executable argument conversion is required for Dart --manifest /c/... inputs.
unset MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL
