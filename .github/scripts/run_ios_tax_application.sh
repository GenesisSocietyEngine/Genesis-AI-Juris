#!/usr/bin/env bash
# Exercise the production editor across a verified application process restart.
set -euo pipefail
if [[ $# != 2 ]]; then
  echo 'usage: run_ios_tax_application.sh <booted-isolated-simulator> <evidence-directory>' >&2
  exit 2
fi
device="$1"
evidence="$2"
mkdir -p "$evidence"
evidence="$(cd "$evidence" && pwd)"
source_sha="$(git rev-parse HEAD)"
git diff --quiet
git diff --cached --quiet
export JURIS_ACCEPTANCE_SOURCE_SHA="$source_sha"
export JURIS_ACCEPTANCE_RUN_NONCE="${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
export JURIS_TAX_ACCEPTANCE_OUTPUT="$evidence"
printf 'sha=%s\ntree=%s\nsimulator=%s\nnonce=%s\n' \
  "$source_sha" "$(git rev-parse HEAD^{tree})" "$device" \
  "$JURIS_ACCEPTANCE_RUN_NONCE" >"$evidence/source.identity"
xcrun simctl list devices --json >"$evidence/simulators.json"
xcrun simctl list runtimes --json >"$evidence/runtimes.json"
xcodebuild -version >"$evidence/xcode.txt"
flutter --version >"$evidence/flutter.txt"
rustc -vV >"$evidence/rust.txt"
repo_root="$(git rev-parse --show-toplevel)"
host="$(rustc -vV | sed -n 's/^host: //p')"
llvm_nm="$(rustc --print sysroot)/lib/rustlib/$host/bin/llvm-nm"

for phase in write read; do
  export JURIS_TAX_APP_PHASE="$phase"
  printf 'phase=%s event=launch source=%s simulator=%s\n' \
    "$phase" "$source_sha" "$device" | tee -a "$evidence/process.log"
  flutter drive --no-pub --keep-app-running \
    --driver=test_driver/tax_application_driver.dart \
    --target=integration_test/native_tax_application_test.dart \
    --dart-define="JURIS_TAX_APP_PHASE=$phase" \
    --dart-define="JURIS_ACCEPTANCE_SOURCE_SHA=$source_sha" \
    --dart-define="JURIS_ACCEPTANCE_RUN_NONCE=$JURIS_ACCEPTANCE_RUN_NONCE" \
    -d "$device" 2>&1 | tee "$evidence/$phase.log"
  printf 'phase=%s driver_exit=0\n' "$phase" >>"$evidence/process.log"
  grep -Fq "production application tax $phase across process restart" "$evidence/$phase.log"
  grep -Fq "tax_application phase=$phase source=$source_sha" "$evidence/$phase.log"
  test -s "$evidence/$phase.json"
  test -s "$evidence/$phase-editor.png"
  shasum -a 256 ios/Generated/libjuris_mobile_ffi.a \
    build/ios/iphonesimulator/Runner.app/Runner >"$evidence/$phase-binary-sha256.txt"
  bash "$repo_root/.github/scripts/verify_ios_ffi_exports.sh" \
    ios/Generated/libjuris_mobile_ffi.a "$llvm_nm" "$(xcrun --find lipo)" \
    >"$evidence/$phase-exports.log" 2>&1
  app_pid="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$evidence/$phase.json")"
  [[ "$app_pid" =~ ^[1-9][0-9]*$ ]]
  ps -p "$app_pid" -o pid=,comm= >"$evidence/$phase-process.txt"
  grep -Fq 'Runner.app/Runner' "$evidence/$phase-process.txt"
  printf 'phase=%s event=terminate pid=%s\n' "$phase" "$app_pid" \
    | tee -a "$evidence/process.log"
  xcrun simctl terminate "$device" com.genesissocietyengine.jurisMobile \
    >>"$evidence/process.log" 2>&1
  for attempt in {1..20}; do
    if ! kill -0 "$app_pid" 2>/dev/null; then break; fi
    sleep 0.25
  done
  if kill -0 "$app_pid" 2>/dev/null; then
    echo "Application process $app_pid survived termination" >&2
    exit 1
  fi
  printf 'phase=%s event=process_absent pid=%s\n' "$phase" "$app_pid" \
    | tee -a "$evidence/process.log"
done
python3 - "$evidence" "$source_sha" "$JURIS_ACCEPTANCE_RUN_NONCE" <<'PY'
import json, pathlib, sys
root, source, nonce = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
write = json.loads((root / 'write.json').read_text())
read = json.loads((root / 'read.json').read_text())
assert write['source_sha'] == read['source_sha'] == source
assert write['run_nonce'] == read['run_nonce'] == nonce
assert read['previous_pid'] == write['pid'] != read['pid']
assert write['artifact'] == read['artifact']
assert write['scenario'] == read['scenario']
assert write['workspace_progress'] == read['workspace_progress']
for receipt in (write, read):
    calculations = [call for call in receipt['native_calls'] if call['request']['command'] == 'tax_calculate']
    assert len(calculations) == 1
    assert calculations[0]['response']['type'] == 'tax_calculated'
assert [call for call in write['native_calls'] if call['request']['command'] == 'tax_calculate'] == [call for call in read['native_calls'] if call['request']['command'] == 'tax_calculate']
print('tax application two-process acceptance: PASS')
PY
