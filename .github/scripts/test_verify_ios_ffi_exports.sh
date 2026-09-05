#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
verifier="$script_directory/verify_ios_ffi_exports.sh"

if [[ ! -f "$verifier" ]]; then
  echo "verifier does not exist: $verifier" >&2
  exit 1
fi

if [[ "$#" -ne 0 && "$#" -ne 4 ]]; then
  echo \
    "usage: $0 [<llvm-nm-path> <lipo-path> <clang-path> <libtool-path>]" \
    >&2
  exit 2
fi

host_system="$(uname -s)"
if [[ "$host_system" == "Darwin" && "$#" -ne 4 ]]; then
  echo "real macOS universal fixture tools are required on Darwin" >&2
  exit 1
fi
if [[ "$host_system" != "Darwin" && "$#" -ne 0 ]]; then
  echo "real universal fixtures may run only on Darwin" >&2
  exit 1
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/juris-ios-ffi-export-tests.XXXXXX")"
cleanup() {
  if [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf "$temporary_directory"
  fi
}
trap cleanup EXIT

archive="$temporary_directory/libjuris_mobile_ffi.a"
fake_llvm_nm="$temporary_directory/llvm-nm"
fake_lipo="$temporary_directory/lipo"
printf 'deterministic dummy archive\n' >"$archive"

cat >"$fake_lipo" <<'FAKE_LIPO'
#!/usr/bin/env bash
set -euo pipefail

: "${FAKE_LIPO_ARCHS+x}"
: "${FAKE_LIPO_STATUS:?FAKE_LIPO_STATUS is required}"
: "${FAKE_LIPO_DIAGNOSTIC+x}"
: "${FAKE_LIPO_CALL_LOG:?FAKE_LIPO_CALL_LOG is required}"
: "${FAKE_LIPO_ARGV_OK_LOG:?FAKE_LIPO_ARGV_OK_LOG is required}"
: "${FAKE_LIPO_ARCHIVE:?FAKE_LIPO_ARCHIVE is required}"

printf 'called\n' >>"$FAKE_LIPO_CALL_LOG"

if [[ "$#" -ne 2 || "$1" != "-archs" || "$2" != "$FAKE_LIPO_ARCHIVE" ]]; then
  echo "unexpected architecture-inspector arguments" >&2
  exit 64
fi

printf 'valid\n' >>"$FAKE_LIPO_ARGV_OK_LOG"
if [[ -n "$FAKE_LIPO_DIAGNOSTIC" ]]; then
  printf '%s\n' "$FAKE_LIPO_DIAGNOSTIC" >&2
fi
if [[ -n "$FAKE_LIPO_ARCHS" ]]; then
  printf '%s\n' "$FAKE_LIPO_ARCHS"
fi
exit "$FAKE_LIPO_STATUS"
FAKE_LIPO
chmod +x "$fake_lipo"

cat >"$fake_llvm_nm" <<'FAKE_LLVM_NM'
#!/usr/bin/env bash
set -euo pipefail

: "${FAKE_NM_CASE:?FAKE_NM_CASE is required}"
: "${FAKE_NM_CALL_LOG:?FAKE_NM_CALL_LOG is required}"
: "${FAKE_NM_ARGV_OK_LOG:?FAKE_NM_ARGV_OK_LOG is required}"
: "${FAKE_NM_ARCHIVE:?FAKE_NM_ARCHIVE is required}"

printf 'called\n' >>"$FAKE_NM_CALL_LOG"

if [[ "$#" -ne 5 || \
  "$1" != --arch=* || \
  -z "${1#--arch=}" || \
  "$2" != "--defined-only" || \
  "$3" != "--extern-only" || \
  "$4" != "--just-symbol-name" || \
  "$5" != "$FAKE_NM_ARCHIVE" ]]; then
  echo "unexpected llvm-nm arguments" >&2
  exit 64
fi

architecture="${1#--arch=}"
printf '%s\n' "$architecture" >>"$FAKE_NM_ARGV_OK_LOG"

print_exact() {
  cat <<'SYMBOLS'
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
SYMBOLS
}

print_darwin_exact() {
  cat <<'SYMBOLS'
_juris_mobile_bridge_abi_version
_juris_mobile_bridge_execute
_juris_mobile_bridge_string_free
SYMBOLS
}

case "$FAKE_NM_CASE" in
  universal_darwin)
    print_darwin_exact
    ;;
  universal_duplicate_symbols)
    print_exact
    print_exact
    ;;
  universal_missing_arm64)
    if [[ "$architecture" == "arm64" ]]; then
      printf '%s\n' \
        juris_mobile_bridge_abi_version \
        juris_mobile_bridge_execute
    else
      print_exact
    fi
    ;;
  universal_fourth_arm64)
    print_exact
    if [[ "$architecture" == "arm64" ]]; then
      echo 'juris_mobile_bridge_unexpected'
    fi
    ;;
  universal_missing_x86_64)
    if [[ "$architecture" == "x86_64" ]]; then
      printf '%s\n' \
        juris_mobile_bridge_abi_version \
        juris_mobile_bridge_execute
    else
      print_exact
    fi
    ;;
  universal_fourth_x86_64)
    print_exact
    if [[ "$architecture" == "x86_64" ]]; then
      echo 'juris_mobile_bridge_unexpected'
    fi
    ;;
  universal_reader_nonzero_x86_64)
    print_exact
    if [[ "$architecture" == "x86_64" ]]; then
      exit 42
    fi
    ;;
  universal_reader_diagnostic_x86_64)
    print_exact
    if [[ "$architecture" == "x86_64" ]]; then
      echo 'llvm-nm: error: synthetic reader failure' >&2
    fi
    ;;
  universal_reader_no_symbols_notice_arm64)
    print_exact
    if [[ "$architecture" == "arm64" ]]; then
      echo "$FAKE_NM_ARCHIVE:synthetic.arm64.o: no symbols" >&2
    fi
    ;;
  universal_reader_no_symbols_and_error_x86_64)
    print_exact
    if [[ "$architecture" == "x86_64" ]]; then
      echo "$FAKE_NM_ARCHIVE:synthetic.x86_64.o: no symbols" >&2
      echo 'llvm-nm: error: synthetic reader failure after notice' >&2
    fi
    ;;
  universal_no_symbols_x86_64)
    if [[ "$architecture" == "x86_64" ]]; then
      printf '%s\n' _main unrelated_export
    else
      print_exact
    fi
    ;;
  universal_malformed_arm64)
    print_exact
    if [[ "$architecture" == "arm64" ]]; then
      echo 'juris_mobile_bridge_bad-symbol'
    fi
    ;;
  *)
    print_exact
    ;;
esac
FAKE_LLVM_NM
chmod +x "$fake_llvm_nm"

report_case_failure() {
  local case_name="$1"
  local message="$2"
  local stdout_file="$3"
  local stderr_file="$4"

  echo "case $case_name: FAIL: $message" >&2
  echo "--- verifier stdout ---" >&2
  cat "$stdout_file" >&2
  echo "--- verifier stderr ---" >&2
  cat "$stderr_file" >&2
  exit 1
}

assert_private_tmp_clean() {
  local case_name="$1"
  local private_tmp="$2"
  local stdout_file="$3"
  local stderr_file="$4"

  if ! rmdir "$private_tmp"; then
    report_case_failure "$case_name" \
      "verifier temporary files were not cleaned" "$stdout_file" "$stderr_file"
  fi
}

assert_reader_coverage() {
  local case_name="$1"
  local expected_architectures="$2"
  local argv_ok_log="$3"
  local stdout_file="$4"
  local stderr_file="$5"
  local expected_file="$temporary_directory/$case_name.expected-reader-architectures"
  local actual_file="$temporary_directory/$case_name.actual-reader-architectures"

  : >"$expected_file"
  if [[ -n "$expected_architectures" ]]; then
    printf '%s\n' $expected_architectures | LC_ALL=C sort >"$expected_file"
  fi
  LC_ALL=C sort "$argv_ok_log" >"$actual_file"

  if ! diff -u "$expected_file" "$actual_file" >/dev/null; then
    report_case_failure "$case_name" \
      "reader architecture coverage or exact argv differed" \
      "$stdout_file" "$stderr_file"
  fi
}

run_case() {
  local case_name="$1"
  local expected_result="$2"
  local raw_architectures="$3"
  local inspector_status="$4"
  local inspector_diagnostic="$5"
  local expected_reader_calls="$6"
  local expected_reader_architectures="$7"
  local failing_architecture="$8"
  local stdout_file="$temporary_directory/$case_name.stdout"
  local stderr_file="$temporary_directory/$case_name.stderr"
  local inspector_call_log="$temporary_directory/$case_name.inspector-calls"
  local inspector_argv_ok_log="$temporary_directory/$case_name.inspector-argv-ok"
  local reader_call_log="$temporary_directory/$case_name.reader-calls"
  local reader_argv_ok_log="$temporary_directory/$case_name.reader-argv-ok"
  local private_tmp="$temporary_directory/$case_name.verifier-tmp"
  local status
  local inspector_call_count
  local inspector_argv_ok_count
  local reader_call_count
  local reader_argv_ok_count
  local architecture_count

  : >"$inspector_call_log"
  : >"$inspector_argv_ok_log"
  : >"$reader_call_log"
  : >"$reader_argv_ok_log"
  mkdir "$private_tmp"

  if TMPDIR="$private_tmp" \
    FAKE_UNSAFE_SENTINEL="$temporary_directory/touch_pwned" \
    FAKE_LIPO_ARCHS="$raw_architectures" \
    FAKE_LIPO_STATUS="$inspector_status" \
    FAKE_LIPO_DIAGNOSTIC="$inspector_diagnostic" \
    FAKE_LIPO_CALL_LOG="$inspector_call_log" \
    FAKE_LIPO_ARGV_OK_LOG="$inspector_argv_ok_log" \
    FAKE_LIPO_ARCHIVE="$archive" \
    FAKE_NM_CASE="$case_name" \
    FAKE_NM_CALL_LOG="$reader_call_log" \
    FAKE_NM_ARGV_OK_LOG="$reader_argv_ok_log" \
    FAKE_NM_ARCHIVE="$archive" \
    bash "$verifier" "$archive" "$fake_llvm_nm" "$fake_lipo" \
    >"$stdout_file" 2>"$stderr_file"; then
    status=0
  else
    status=$?
  fi

  inspector_call_count="$(wc -l <"$inspector_call_log" | tr -d '[:space:]')"
  inspector_argv_ok_count="$(wc -l <"$inspector_argv_ok_log" | tr -d '[:space:]')"
  reader_call_count="$(wc -l <"$reader_call_log" | tr -d '[:space:]')"
  reader_argv_ok_count="$(wc -l <"$reader_argv_ok_log" | tr -d '[:space:]')"

  if [[ "$inspector_call_count" != "1" || "$inspector_argv_ok_count" != "1" ]]; then
    report_case_failure "$case_name" \
      "architecture inspector invocation or argv was not exact" \
      "$stdout_file" "$stderr_file"
  fi
  if [[ "$reader_call_count" != "$expected_reader_calls" ]]; then
    report_case_failure "$case_name" \
      "expected $expected_reader_calls reader calls, found $reader_call_count" \
      "$stdout_file" "$stderr_file"
  fi
  if [[ "$reader_argv_ok_count" != "$expected_reader_calls" ]]; then
    report_case_failure "$case_name" \
      "one or more reader argument vectors were not exact" \
      "$stdout_file" "$stderr_file"
  fi
  assert_reader_coverage "$case_name" "$expected_reader_architectures" \
    "$reader_argv_ok_log" "$stdout_file" "$stderr_file"
  assert_private_tmp_clean "$case_name" "$private_tmp" \
    "$stdout_file" "$stderr_file"

  if [[ "$expected_result" == "pass" ]]; then
    if [[ "$status" -ne 0 ]]; then
      report_case_failure "$case_name" \
        "expected success, received status $status" "$stdout_file" "$stderr_file"
    fi

    architecture_count="$expected_reader_calls"
    for architecture in $expected_reader_architectures; do
      if ! grep -Fxq \
        "architecture $architecture exact export set: PASS" "$stdout_file"; then
        report_case_failure "$case_name" \
          "missing per-slice PASS for $architecture" "$stdout_file" "$stderr_file"
      fi
    done
    for expected_symbol in \
      juris_mobile_bridge_abi_version \
      juris_mobile_bridge_execute \
      juris_mobile_bridge_string_free; do
      if [[ "$(grep -Fxc "$expected_symbol" "$stdout_file")" != "$architecture_count" ]]; then
        report_case_failure "$case_name" \
          "symbol evidence count was not per-slice exact: $expected_symbol" \
          "$stdout_file" "$stderr_file"
      fi
    done
    if [[ "$(grep -Fxc \
      "all $architecture_count architecture slices exact export set: PASS" \
      "$stdout_file")" != "1" ]]; then
      report_case_failure "$case_name" \
        "missing or duplicate aggregate PASS" "$stdout_file" "$stderr_file"
    fi
    if [[ "$case_name" == "universal_reader_no_symbols_notice_arm64" ]] && \
      ! grep -Fxq \
        'architecture arm64: accepted 1 llvm-nm no-symbol member notice(s)' \
        "$stdout_file"; then
      report_case_failure "$case_name" \
        "benign no-symbol notice was not acknowledged" \
        "$stdout_file" "$stderr_file"
    fi

    echo "case $case_name: PASS"
    return
  fi

  if [[ "$expected_result" != "fail" ]]; then
    report_case_failure "$case_name" \
      "invalid test expectation: $expected_result" "$stdout_file" "$stderr_file"
  fi
  if [[ "$status" -eq 0 ]]; then
    report_case_failure "$case_name" \
      "expected nonzero status" "$stdout_file" "$stderr_file"
  fi
  if grep -Fq 'architecture slices exact export set: PASS' "$stdout_file"; then
    report_case_failure "$case_name" \
      "negative case printed aggregate success" "$stdout_file" "$stderr_file"
  fi

  if [[ -n "$failing_architecture" ]]; then
    if ! grep -Fq "architecture $failing_architecture" "$stderr_file"; then
      report_case_failure "$case_name" \
        "diagnostics did not name failing architecture $failing_architecture" \
        "$stdout_file" "$stderr_file"
    fi
  elif ! grep -Fq 'architecture discovery:' "$stderr_file"; then
    report_case_failure "$case_name" \
      "inspector failure was not identified as architecture discovery" \
      "$stdout_file" "$stderr_file"
  fi

  if [[ "$case_name" == "universal_reader_nonzero_x86_64" ]] && \
    ! grep -Fq 'llvm-nm failed with exit status 42' "$stderr_file"; then
    report_case_failure "$case_name" \
      "reader exit status was not preserved" "$stdout_file" "$stderr_file"
  fi
  if [[ "$case_name" == "inspector_nonzero" ]] && \
    ! grep -Fq 'inspector failed with exit status 43' "$stderr_file"; then
    report_case_failure "$case_name" \
      "inspector exit status was not preserved" "$stdout_file" "$stderr_file"
  fi
  if [[ "$case_name" == "inspector_unsafe" && \
    -e "$temporary_directory/touch_pwned" ]]; then
    report_case_failure "$case_name" \
      "unsafe architecture token was evaluated" "$stdout_file" "$stderr_file"
  fi

  echo "case $case_name: PASS (rejected with status $status)"
}

selector_call_log="$temporary_directory/selector-contract.calls"
selector_argv_ok_log="$temporary_directory/selector-contract.argv-ok"
: >"$selector_call_log"
: >"$selector_argv_ok_log"
if FAKE_NM_CASE=thin_exact \
  FAKE_NM_CALL_LOG="$selector_call_log" \
  FAKE_NM_ARGV_OK_LOG="$selector_argv_ok_log" \
  FAKE_NM_ARCHIVE="$archive" \
  "$fake_llvm_nm" \
    --defined-only --extern-only --just-symbol-name "$archive" \
    >/dev/null 2>&1; then
  echo "case reader_selector_contract: FAIL: missing selector was accepted" >&2
  exit 1
else
  selector_status=$?
fi
if [[ "$selector_status" -ne 64 || \
  "$(wc -l <"$selector_call_log" | tr -d '[:space:]')" != "1" || \
  "$(wc -l <"$selector_argv_ok_log" | tr -d '[:space:]')" != "0" ]]; then
  echo "case reader_selector_contract: FAIL: fake reader contract was not strict" >&2
  exit 1
fi
echo "case reader_selector_contract: PASS"

run_case thin_exact pass 'x86_64' 0 '' 1 'x86_64' ''
run_case universal_exact pass 'x86_64 arm64' 0 '' 2 'arm64 x86_64' ''
run_case universal_darwin pass 'arm64 x86_64' 0 '' 2 'arm64 x86_64' ''
run_case universal_duplicate_symbols pass 'x86_64 arm64' 0 '' 2 \
  'arm64 x86_64' ''
run_case universal_missing_arm64 fail 'x86_64 arm64' 0 '' 1 'arm64' 'arm64'
run_case universal_fourth_arm64 fail 'arm64 x86_64' 0 '' 1 'arm64' 'arm64'
run_case universal_missing_x86_64 fail 'x86_64 arm64' 0 '' 2 \
  'arm64 x86_64' 'x86_64'
run_case universal_fourth_x86_64 fail 'x86_64 arm64' 0 '' 2 \
  'arm64 x86_64' 'x86_64'
run_case universal_reader_nonzero_x86_64 fail 'arm64 x86_64' 0 '' 2 \
  'arm64 x86_64' 'x86_64'
run_case universal_reader_diagnostic_x86_64 fail 'x86_64 arm64' 0 '' 2 \
  'arm64 x86_64' 'x86_64'
run_case universal_reader_no_symbols_notice_arm64 pass 'x86_64 arm64' 0 '' 2 \
  'arm64 x86_64' ''
run_case universal_reader_no_symbols_and_error_x86_64 fail 'arm64 x86_64' 0 '' 2 \
  'arm64 x86_64' 'x86_64'
run_case universal_no_symbols_x86_64 fail 'arm64 x86_64' 0 '' 2 \
  'arm64 x86_64' 'x86_64'
run_case inspector_nonzero fail 'x86_64 arm64' 43 \
  'lipo: error: synthetic inspector failure' 0 '' ''
run_case inspector_empty fail '' 0 '' 0 '' ''
run_case inspector_duplicate fail 'x86_64 x86_64' 0 '' 0 '' ''
run_case inspector_unsafe fail \
  'true;touch${IFS}$FAKE_UNSAFE_SENTINEL' 0 '' 0 '' ''
run_case universal_malformed_arm64 fail 'x86_64 arm64' 0 '' 1 'arm64' 'arm64'
run_case inspector_diagnostic fail 'x86_64' 0 \
  'lipo: error: zero-status synthetic diagnostic' 0 '' ''

echo 'fake verifier matrix: PASS (19/19)'

if [[ "$#" -eq 0 ]]; then
  echo 'real macOS universal fixture matrix: SKIP (non-Darwin fake-only run)'
  exit 0
fi

real_llvm_nm="$1"
real_lipo="$2"
real_clang="$3"
real_libtool="$4"
for tool in "$real_llvm_nm" "$real_lipo" "$real_clang" "$real_libtool"; do
  if [[ ! -f "$tool" || ! -x "$tool" ]]; then
    echo "real fixture tool is not an executable file: $tool" >&2
    exit 1
  fi
done

real_directory="$temporary_directory/real-universal"
mkdir "$real_directory"
source_file="$real_directory/bridge_fixture.c"
cat >"$source_file" <<'FIXTURE_SOURCE'
int juris_mobile_bridge_abi_version(void) { return 1; }
void juris_mobile_bridge_execute(void) {}
#ifndef OMIT_STRING_FREE
void juris_mobile_bridge_string_free(void) {}
#endif
#ifdef ADD_FOURTH
void juris_mobile_bridge_unexpected(void) {}
#endif
FIXTURE_SOURCE

build_thin_fixture() {
  local architecture="$1"
  local variant="$2"
  local object_file="$real_directory/$architecture-$variant.o"
  local archive_file="$real_directory/$architecture-$variant.a"

  case "$variant" in
    exact)
      "$real_clang" -arch "$architecture" -fno-common \
        -c "$source_file" -o "$object_file"
      ;;
    fourth)
      "$real_clang" -arch "$architecture" -fno-common -DADD_FOURTH=1 \
        -c "$source_file" -o "$object_file"
      ;;
    missing)
      "$real_clang" -arch "$architecture" -fno-common -DOMIT_STRING_FREE=1 \
        -c "$source_file" -o "$object_file"
      ;;
    *)
      echo "unknown real fixture variant: $variant" >&2
      exit 1
      ;;
  esac
  "$real_libtool" -static -o "$archive_file" "$object_file"
}

echo "real fixture llvm-nm: $real_llvm_nm"
echo "real fixture lipo: $real_lipo"
echo "real fixture clang: $real_clang"
echo "real fixture libtool: $real_libtool"

build_thin_fixture x86_64 exact
build_thin_fixture arm64 exact
build_thin_fixture arm64 fourth
build_thin_fixture arm64 missing

real_exact="$real_directory/universal-exact.a"
real_fourth="$real_directory/universal-arm64-fourth.a"
real_missing="$real_directory/universal-arm64-missing.a"

"$real_lipo" -create \
  "$real_directory/arm64-exact.a" \
  "$real_directory/x86_64-exact.a" \
  -output "$real_exact"
"$real_lipo" -create \
  "$real_directory/x86_64-exact.a" \
  "$real_directory/arm64-fourth.a" \
  -output "$real_fourth"
"$real_lipo" -create \
  "$real_directory/arm64-missing.a" \
  "$real_directory/x86_64-exact.a" \
  -output "$real_missing"

run_real_fixture() {
  local fixture_name="$1"
  local fixture_archive="$2"
  local expected_result="$3"
  local failing_architecture="$4"
  local stdout_file="$real_directory/$fixture_name.stdout"
  local stderr_file="$real_directory/$fixture_name.stderr"
  local private_tmp="$real_directory/$fixture_name.verifier-tmp"
  local status

  mkdir "$private_tmp"
  if TMPDIR="$private_tmp" bash "$verifier" \
    "$fixture_archive" "$real_llvm_nm" "$real_lipo" \
    >"$stdout_file" 2>"$stderr_file"; then
    status=0
  else
    status=$?
  fi
  assert_private_tmp_clean "$fixture_name" "$private_tmp" \
    "$stdout_file" "$stderr_file"

  if [[ "$expected_result" == "pass" ]]; then
    if [[ "$status" -ne 0 ]]; then
      report_case_failure "$fixture_name" \
        "real universal exact fixture failed with status $status" \
        "$stdout_file" "$stderr_file"
    fi
    for architecture in arm64 x86_64; do
      if ! grep -Fxq \
        "architecture $architecture exact export set: PASS" "$stdout_file"; then
        report_case_failure "$fixture_name" \
          "missing real per-slice PASS for $architecture" \
          "$stdout_file" "$stderr_file"
      fi
    done
    if [[ "$(grep -Fxc \
      'all 2 architecture slices exact export set: PASS' "$stdout_file")" != "1" ]]; then
      report_case_failure "$fixture_name" \
        "missing real all-slices PASS" "$stdout_file" "$stderr_file"
    fi
    echo "--- real fixture $fixture_name verifier stdout ---"
    cat "$stdout_file"
    echo "real fixture $fixture_name: PASS"
    return
  fi

  if [[ "$status" -eq 0 ]]; then
    report_case_failure "$fixture_name" \
      "real asymmetric fixture unexpectedly passed" "$stdout_file" "$stderr_file"
  fi
  if grep -Fq 'architecture slices exact export set: PASS' "$stdout_file"; then
    report_case_failure "$fixture_name" \
      "real asymmetric fixture printed aggregate success" \
      "$stdout_file" "$stderr_file"
  fi
  if ! grep -Fq "architecture $failing_architecture" "$stderr_file"; then
    report_case_failure "$fixture_name" \
      "real asymmetric failure did not identify $failing_architecture" \
      "$stdout_file" "$stderr_file"
  fi
  echo "--- real fixture $fixture_name verifier stdout ---"
  cat "$stdout_file"
  echo "--- real fixture $fixture_name expected rejection stderr ---"
  head -c 8192 "$stderr_file"
  printf '\n'
  echo "real fixture $fixture_name: PASS (rejected with status $status)"
}

run_real_fixture universal_exact "$real_exact" pass ''
run_real_fixture universal_arm64_fourth "$real_fourth" fail arm64
run_real_fixture universal_arm64_missing "$real_missing" fail arm64

echo 'real macOS universal fixture matrix: PASS (3/3)'
