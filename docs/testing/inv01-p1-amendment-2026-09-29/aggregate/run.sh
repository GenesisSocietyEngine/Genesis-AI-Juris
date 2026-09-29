#!/usr/bin/env bash
set -euo pipefail
cd /c/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29
source .artifacts/p1-release-gate/env.sh
export GENESIS_RELEASE_WEB_HEAD=a9d8c767b67d1485b2f9e6bf0e07dcd324b18f38
export ANDROID_USER_HOME='C:/PROJECTS/Genesis-AI-Juris/.worktrees/p1-amendment-2026-09-29/.artifacts/p1-native-home'
export ANDROID_ADB_SERVER_PORT=5039
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5039
date -u +%Y-%m-%dT%H:%M:%SZ > .artifacts/p1-release-gate/started.txt
node --import tsx scripts/verify-web-checkout.ts --repo "$PWD" --expected-head "$GENESIS_RELEASE_WEB_HEAD" > .artifacts/p1-release-gate/source-before.json
set +e
timeout --signal=TERM --kill-after=30s 7200 bash scripts/verify-release.sh > .artifacts/p1-release-gate/aggregate.log 2>&1
gate_status=$?
set -e
printf '%s\n' "$gate_status" > .artifacts/p1-release-gate/exit-code.txt
date -u +%Y-%m-%dT%H:%M:%SZ > .artifacts/p1-release-gate/finished.txt
node --import tsx scripts/verify-web-checkout.ts --repo "$PWD" --expected-head "$GENESIS_RELEASE_WEB_HEAD" > .artifacts/p1-release-gate/source-after.json
printf 'Release command finished with exit %s\n' "$gate_status"
exit "$gate_status"
