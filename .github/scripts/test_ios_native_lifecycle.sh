#!/usr/bin/env bash
set -euo pipefail
printf 'Orchestration shell: Bash %s\n' "$BASH_VERSION"
repository="$(cd "$(dirname "$0")/../.." && pwd)"
script="$repository/.github/scripts/run_ios_native_lifecycle.sh"
sandbox="$(mktemp -d "${TMPDIR:-/tmp}/juris-ios-orchestration.XXXXXX")"
cleanup() {
  status="$?"
  if [[ "$status" -ne 0 && -f "$sandbox/output.log" ]]; then cat "$sandbox/output.log" >&2; fi
  rm -rf "$sandbox"
  exit "$status"
}
trap cleanup EXIT
export RUNNER_TEMP="$sandbox"
mkdir "$sandbox/bin"
export REAL_TEE="$(command -v tee)"
# Git Bash has sha256sum instead of macOS shasum; use real hashing in local tests.
if ! command -v shasum >/dev/null 2>&1; then
  command -v sha256sum >/dev/null
  cat > "$sandbox/bin/shasum" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == -a && "$2" == 256 ]] || exit 2
shift 2
exec sha256sum "$@"
MOCK
  chmod +x "$sandbox/bin/shasum"
fi
export PATH="$sandbox/bin:$PATH"
export MOCK_ROOT="$sandbox"
device="11111111-1111-1111-1111-111111111111"

cat > "$sandbox/bin/xcodebuild" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
mode="$1"; shift
derived=""; plan=""; result=""; destination=""; selector=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -derivedDataPath) derived="$2"; shift 2 ;;
    -xctestrun) plan="$2"; shift 2 ;;
    -resultBundlePath) result="$2"; shift 2 ;;
    -destination) destination="$2"; shift 2 ;;
    -only-testing:*) selector="${1#-only-testing:}"; shift ;;
    *) shift ;;
  esac
done
printf '%s|%s|%s|%s|%s\n' "$mode" "$plan" "$destination" "$selector" "$result" >> "$MOCK_ROOT/calls.log"
[[ "$selector" == "RunnerTests/RunnerTests/testNativeLogisticsLifecycle" ]] || exit 2
[[ "$destination" == "platform=iOS Simulator,id=11111111-1111-1111-1111-111111111111" ]] || exit 2
mkdir -p "$result"
if [[ "$mode" == build-for-testing ]]; then
  if [[ "${MOCK_MODE:-}" == build-failure ]]; then echo "Synthetic compiler failure"; exit 65; fi
  mkdir -p "$derived/Build/Products/Debug-iphonesimulator/Runner.app/PlugIns/RunnerTests.xctest"
  [[ "${MOCK_MODE:-}" != missing-plan ]] || exit 0
  printf 'synthetic xctestrun\n' > "$derived/Build/Products/Runner.xctestrun"
  if [[ "${MOCK_MODE:-}" == ambiguous-plan ]]; then cp "$derived/Build/Products/Runner.xctestrun" "$derived/Build/Products/Other.xctestrun"; fi
  exit 0
fi
[[ "$mode" == test-without-building && -f "$plan" ]] || exit 2
attempts="$(grep -c '^test-without-building|' "$MOCK_ROOT/calls.log")"
case "${MOCK_MODE:-pass}" in
  assertion) echo "Test case 'RunnerTests.testNativeLogisticsLifecycle()' failed"; exit 65 ;;
  empty) echo "** TEST SUCCEEDED **"; exit 0 ;;
  zero-bootstrap) echo "Early unexpected exit, operation never finished bootstrapping"; exit 0 ;;
  mutated-bootstrap) printf "changed\n" >> "$plan"; echo "Early unexpected exit, operation never finished bootstrapping"; exit 65 ;;
  bootstrap)
    if [[ "$attempts" == 1 ]]; then echo "Early unexpected exit, operation never finished bootstrapping"; exit 65; fi ;;
  bootstrap-twice) echo "Early unexpected exit, operation never finished bootstrapping"; exit 65 ;;
  mixed)
    echo "Test case 'RunnerTests.testNativeLogisticsLifecycle()' failed"
    echo "Early unexpected exit, operation never finished bootstrapping"; exit 65 ;;
esac
echo "Test case 'RunnerTests.testNativeLogisticsLifecycle()' passed on 'Synthetic Runner' (0.001 seconds)"
MOCK
cat > "$sandbox/bin/xcrun" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_ROOT/simulator.log"
MOCK
cat > "$sandbox/bin/tee" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${MOCK_CAPTURE_FAILURE:-}" == lifecycle && "$*" == *lifecycle-attempt-* ]]; then
  "$REAL_TEE" "$@"
  exit 74
fi
if [[ "${MOCK_CAPTURE_FAILURE:-}" == stamp-* && "$*" == *phases.log ]]; then
  content="$(cat)"
  event="${MOCK_CAPTURE_FAILURE#stamp-}"
  printf '%s\n' "$content" | "$REAL_TEE" "$@"
  [[ "$content" != *"event=$event "* ]] || exit 74
  exit 0
fi
exec "$REAL_TEE" "$@"
MOCK
chmod +x "$sandbox/bin/xcodebuild" "$sandbox/bin/xcrun" "$sandbox/bin/tee"
count=0
new_case() {
  count=$((count + 1))
  evidence="$sandbox/ios-native-$count"
  : > "$sandbox/calls.log"
  : > "$sandbox/simulator.log"
  export MOCK_MODE=pass
  export MOCK_CAPTURE_FAILURE=""
}
prepare() { bash "$script" prepare "$device" "$evidence" > "$sandbox/output.log" 2>&1; }
execute() { bash "$script" test "$device" "$evidence" > "$sandbox/output.log" 2>&1; }
fails() { if "$@"; then echo "Expected failure: $*" >&2; exit 1; fi; }
test_calls() { grep -c '^test-without-building|' "$sandbox/calls.log" || true; }
passed() { printf 'PASS %s\n' "$1"; }

new_case
prepare; execute
test "$(test_calls)" -eq 1
grep -Fq "test-without-building|$evidence/DerivedData/Build/Products/Runner.xctestrun|" "$sandbox/calls.log"
test -f "$evidence/lifecycle-attempt-1.log"
test -d "$evidence/lifecycle-attempt-1.xcresult"
test ! -s "$sandbox/simulator.log"
passed "exact prepared plan and unchanged selected test pass without rebuild"

new_case
export MOCK_MODE=build-failure
set +e; prepare; status="$?"; set -e
test "$status" -eq 65
test ! -e "$evidence/prepared.identity"
grep -Fq "Synthetic compiler failure" "$evidence/build-for-testing.log"
passed "compiler failure retains log and real nonzero exit"

for scenario in missing-plan ambiguous-plan; do
  new_case; export MOCK_MODE="$scenario"; fails prepare
  test ! -e "$evidence/prepared.identity"
done
passed "missing and ambiguous plans fail closed"

new_case
prepare; fails prepare
test "$(grep -c '^build-for-testing|' "$sandbox/calls.log")" -eq 1
passed "stale preparation directory is never reused"

new_case
prepare
printf 'tampered\n' >> "$evidence/DerivedData/Build/Products/Runner.xctestrun"
fails execute
test "$(test_calls)" -eq 0
passed "modified prepared plan cannot execute"

new_case
prepare
printf 'wrong-source\n' > "$evidence/prepared.identity"
fails execute
test "$(test_calls)" -eq 0
passed "source/destination identity mismatch cannot execute"

for scenario in assertion empty mixed zero-bootstrap; do
  new_case; prepare; export MOCK_MODE="$scenario"; fails execute
  test "$(test_calls)" -eq 1
  test ! -s "$sandbox/simulator.log"
done
passed "assertion failure, empty selection and mixed failure never retry"

new_case
prepare; export MOCK_MODE=bootstrap; execute
test "$(test_calls)" -eq 2
test "$(wc -l < "$sandbox/simulator.log" | tr -d ' ')" -eq 4
test -f "$evidence/lifecycle-attempt-1.log"
test -f "$evidence/lifecycle-attempt-2.log"
test -d "$evidence/lifecycle-attempt-1.xcresult"
test -d "$evidence/lifecycle-attempt-2.xcresult"
passed "one pre-test bootstrap retry retains separate attempt evidence"

new_case
prepare; export MOCK_MODE=bootstrap-twice; fails execute
test "$(test_calls)" -eq 2
passed "second bootstrap failure has no third attempt"
new_case
prepare; export MOCK_MODE=mutated-bootstrap; fails execute
test "$(test_calls)" -eq 1
passed "changed plan is refused before a second test invocation"
new_case
prepare; export MOCK_CAPTURE_FAILURE=lifecycle; fails execute
test "$(test_calls)" -eq 1
test ! -s "$sandbox/simulator.log"
passed "lost lifecycle log capture cannot report success or retry"
new_case
prepare; export MOCK_CAPTURE_FAILURE=stamp-attempt_start; fails execute
test "$(test_calls)" -eq 0
test ! -s "$sandbox/simulator.log"
passed "failed start timestamp prevents XCTest invocation"
new_case
prepare; export MOCK_MODE=bootstrap; export MOCK_CAPTURE_FAILURE=stamp-attempt_finished; fails execute
test "$(test_calls)" -eq 1
test ! -s "$sandbox/simulator.log"
passed "failed completion timestamp cannot authorize bootstrap retry"
for scenario in phase destination traversal; do
  new_case
  case "$scenario" in
    phase) fails bash "$script" unknown "$device" "$evidence" ;;
    destination) fails bash "$script" prepare invalid "$evidence" ;;
    traversal) fails bash "$script" prepare "$device" "$evidence/../outside" ;;
  esac
  test ! -e "$evidence"
  test ! -s "$sandbox/calls.log"
done
passed "invalid phase, simulator and traversal path stop before preparation"
printf 'PASS 14 orchestration groups (%s isolated cases); no Xcode or simulator was used\n' "$count"
