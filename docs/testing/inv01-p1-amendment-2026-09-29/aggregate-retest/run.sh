#!/usr/bin/env bash
set -euo pipefail
cd /c/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29
source .artifacts/p1-release-gate/env.sh
export GENESIS_RELEASE_WEB_HEAD=efadf24fc186288ce4ee25da5f5a7d9d1eb6baff
export ANDROID_USER_HOME='C:/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29/.artifacts/p1-android-native/android-user'
export ANDROID_ADB_SERVER_PORT=5039
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5039
export SITES_RUNTIME_ROOT="${gate_root}/.artifacts/p1-release-gate-retest/sites-runtime"
export WRANGLER_LOG_PATH='C:/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29/.artifacts/p1-release-gate-retest/wrangler-logs'
export MINIFLARE_REGISTRY_PATH='C:/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29/.artifacts/p1-release-gate-retest/miniflare-registry'
date -u +%Y-%m-%dT%H:%M:%SZ > .artifacts/p1-release-gate-retest/started.txt
node --import tsx scripts/verify-web-checkout.ts --repo "$PWD" --expected-head "$GENESIS_RELEASE_WEB_HEAD" > .artifacts/p1-release-gate-retest/source-before.json
set +e
timeout --signal=TERM --kill-after=30s 7200 bash scripts/verify-release.sh > .artifacts/p1-release-gate-retest/aggregate.log 2>&1
gate_status=$?
set -e
printf '%s\n' "$gate_status" > .artifacts/p1-release-gate-retest/exit-code.txt
date -u +%Y-%m-%dT%H:%M:%SZ > .artifacts/p1-release-gate-retest/finished.txt
node --import tsx scripts/verify-web-checkout.ts --repo "$PWD" --expected-head "$GENESIS_RELEASE_WEB_HEAD" > .artifacts/p1-release-gate-retest/source-after.json
printf 'Release retest finished with exit %s\n' "$gate_status"
exit "$gate_status"
