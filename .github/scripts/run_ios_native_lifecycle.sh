#!/usr/bin/env bash
set -euo pipefail
# Bash 3.2 does not reliably apply errexit to compound conditions; guards exit explicitly.

phase="${1:?prepare or test is required}"
simulator_id="${2:?simulator UUID is required}"
evidence="${3:?job-local evidence directory is required}"
[[ "$phase" == prepare || "$phase" == test ]] || exit 2
[[ "$simulator_id" =~ ^[0-9A-F-]{36}$ ]] || exit 2
[[ -n "${RUNNER_TEMP:-}" && "$RUNNER_TEMP" == /* ]] || exit 2
case "$evidence" in "$RUNNER_TEMP"/ios-native-*) ;; *) echo "Evidence path is not job-local" >&2; exit 2 ;; esac
[[ "$evidence" != */../* && "$evidence" != */./* && ! -L "$evidence" ]] || exit 2
repository="$(cd "$(dirname "$0")/../.." && pwd)" || exit 1
cd "$repository/apps/juris-mobile" || exit 1
source_sha="$(git -C "$repository" rev-parse HEAD)" || exit 1
[[ "$source_sha" =~ ^[a-f0-9]{40}$ ]] || exit 1
derived="$evidence/DerivedData"
selector="RunnerTests/RunnerTests/testNativeLogisticsLifecycle"
[[ "$phase" != prepare || ! -e "$evidence" ]] || { echo "Preparation evidence already exists" >&2; exit 1; }
mkdir -p "$evidence" || exit 1
stamp() {
  local timestamp
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)" || return 1
  printf 'utc=%s phase=%s %s\n' "$timestamp" "$phase" "$*" | tee -a "$evidence/phases.log"
}
plan() {
  shopt -s nullglob
  plans=("$derived"/Build/Products/*.xctestrun)
  [[ "${#plans[@]}" -eq 1 && -f "${plans[0]}" ]] || { echo "Expected exactly one newly prepared xctestrun" >&2; return 1; }
  test_plan="${plans[0]}"
  test -d "$derived/Build/Products/Debug-iphonesimulator/Runner.app/PlugIns/RunnerTests.xctest"
}
stamp "event=start source=$source_sha simulator=$simulator_id" || exit 1

if [[ "$phase" == prepare ]]; then
  # A fresh run/attempt owns this location; never reuse global or stale products.
  [[ ! -e "$derived" && ! -e "$evidence/prepared.identity" ]] || exit 1
  set +e
  xcodebuild build-for-testing \
    -workspace ios/Runner.xcworkspace \
    -scheme Runner \
    -configuration Debug \
    -destination "platform=iOS Simulator,id=$simulator_id" \
    -derivedDataPath "$derived" \
    -resultBundlePath "$evidence/build-for-testing.xcresult" \
    -only-testing:"$selector" \
    CODE_SIGNING_ALLOWED=NO \
    2>&1 | tee "$evidence/build-for-testing.log"
  statuses=("${PIPESTATUS[@]}")
  status="${statuses[0]}"
  capture_status="${statuses[1]}"
  set -e
  stamp "event=build_finished exit=$status capture_exit=$capture_status" || exit 1
  [[ "$status" -eq 0 ]] || exit "$status"
  [[ "$capture_status" -eq 0 ]] || exit "$capture_status"
  plan || exit 1
  shasum -a 256 "$test_plan" > "$evidence/test-plan.sha256" || exit 1
  printf '%s\n%s\n%s\n' "$source_sha" "$simulator_id" "$test_plan" > "$evidence/prepared.identity" || exit 1
  stamp "event=prepared plan=$test_plan" || exit 1
  exit 0
fi

verify_prepared_plan() {
  plan || return 1
  expected_identity="$(printf '%s\n%s\n%s' "$source_sha" "$simulator_id" "$test_plan")"
  [[ "$(cat "$evidence/prepared.identity")" == "$expected_identity" ]] || return 1
  shasum -a 256 -c "$evidence/test-plan.sha256"
}
bootstrap_eligible=false
run_lifecycle() {
  bootstrap_eligible=false
  verify_prepared_plan || return 1
  local attempt="$1"
  local log_path="$evidence/lifecycle-attempt-$attempt.log"
  local result_path="$evidence/lifecycle-attempt-$attempt.xcresult"
  [[ ! -e "$log_path" && ! -e "$result_path" ]] || { echo "Attempt evidence already exists" >&2; return 1; }
  stamp "event=attempt_start attempt=$attempt" || return 1
  set +e
  xcodebuild test-without-building \
    -xctestrun "$test_plan" \
    -destination "platform=iOS Simulator,id=$simulator_id" \
    -only-testing:"$selector" \
    -resultBundlePath "$result_path" \
    CODE_SIGNING_ALLOWED=NO \
    2>&1 | tee "$log_path"
  local statuses=("${PIPESTATUS[@]}")
  local xcode_status="${statuses[0]}"
  local capture_status="${statuses[1]}"
  set -e
  stamp "event=attempt_finished attempt=$attempt exit=$xcode_status capture_exit=$capture_status" || return 1
  [[ "$capture_status" -eq 0 ]] || return "$capture_status"
  if [[ "$xcode_status" -ne 0 ]]; then
    bootstrap_eligible=true
    return "$xcode_status"
  fi
  # Exit zero alone can also mean an empty selection; require this real test.
  if ! grep -Eq "Test case 'RunnerTests\.testNativeLogisticsLifecycle\(\)' passed|Test Case '-\[RunnerTests\.RunnerTests testNativeLogisticsLifecycle\]' passed" "$log_path"; then
    echo "Selected native lifecycle did not record a passed test" >&2
    return 1
  fi
}

if run_lifecycle 1; then
  stamp "event=passed attempt=1" || exit 1
  exit 0
fi
first_log="$evidence/lifecycle-attempt-1.log"
if [[ "$bootstrap_eligible" != true ]] \
  || ! grep -Fq "Early unexpected exit, operation never finished bootstrapping" "$first_log" \
  || grep -Eq "Test [Cc]ase .*testNativeLogisticsLifecycle" "$first_log"; then
  echo "iOS lifecycle failed outside the allowed pre-test simulator-bootstrap retry class" >&2
  exit 1
fi
stamp "event=bootstrap_retry" || exit 1
xcrun simctl shutdown "$simulator_id" || true
xcrun simctl erase "$simulator_id" || exit 1
xcrun simctl boot "$simulator_id" || exit 1
xcrun simctl bootstatus "$simulator_id" -b || exit 1
run_lifecycle 2 || exit 1
stamp "event=passed attempt=2" || exit 1
