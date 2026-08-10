#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
verifier="$script_directory/verify_ios_ffi_exports.sh"

if [[ ! -f "$verifier" ]]; then
  echo "verifier does not exist: $verifier" >&2
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
printf 'deterministic dummy archive\n' >"$archive"

cat >"$fake_llvm_nm" <<'FAKE_LLVM_NM'
#!/usr/bin/env bash
set -euo pipefail

: "${FAKE_NM_CASE:?FAKE_NM_CASE is required}"
: "${FAKE_NM_CALL_LOG:?FAKE_NM_CALL_LOG is required}"
: "${FAKE_NM_ARGV_OK_LOG:?FAKE_NM_ARGV_OK_LOG is required}"
: "${FAKE_NM_ARCHIVE:?FAKE_NM_ARCHIVE is required}"

printf 'called\n' >>"$FAKE_NM_CALL_LOG"

if [[ "$#" -ne 4 || \
  "$1" != "--defined-only" || \
  "$2" != "--extern-only" || \
  "$3" != "--just-symbol-name" || \
  "$4" != "$FAKE_NM_ARCHIVE" ]]; then
  echo "unexpected llvm-nm arguments" >&2
  exit 64
fi

printf 'valid\n' >>"$FAKE_NM_ARGV_OK_LOG"

print_exact() {
  cat <<'SYMBOLS'
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
SYMBOLS
}

case "$FAKE_NM_CASE" in
  exact)
    print_exact
    ;;
  darwin)
    cat <<'SYMBOLS'
_juris_mobile_bridge_abi_version
_juris_mobile_bridge_execute
_juris_mobile_bridge_string_free
SYMBOLS
    ;;
  duplicate)
    print_exact
    print_exact
    ;;
  missing)
    cat <<'SYMBOLS'
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
SYMBOLS
    ;;
  fourth_export)
    print_exact
    echo 'juris_mobile_bridge_unexpected'
    ;;
  masked_reader_failure)
    print_exact
    exit 42
    ;;
  diagnostic_failure)
    print_exact
    echo 'llvm-nm: error: synthetic reader failure' >&2
    ;;
  no_bridge_symbols)
    cat <<'SYMBOLS'
_main
unrelated_export
SYMBOLS
    ;;
  *)
    echo "unknown fake llvm-nm case: $FAKE_NM_CASE" >&2
    exit 65
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

run_case() {
  local case_name="$1"
  local expected_result="$2"
  local stdout_file="$temporary_directory/$case_name.stdout"
  local stderr_file="$temporary_directory/$case_name.stderr"
  local call_log="$temporary_directory/$case_name.calls"
  local argv_ok_log="$temporary_directory/$case_name.argv-ok"
  local status
  local call_count
  local argv_ok_count

  : >"$call_log"
  : >"$argv_ok_log"

  if FAKE_NM_CASE="$case_name" \
    FAKE_NM_CALL_LOG="$call_log" \
    FAKE_NM_ARGV_OK_LOG="$argv_ok_log" \
    FAKE_NM_ARCHIVE="$archive" \
    bash "$verifier" "$archive" "$fake_llvm_nm" \
    >"$stdout_file" 2>"$stderr_file"; then
    status=0
  else
    status=$?
  fi

  call_count="$(wc -l <"$call_log" | tr -d '[:space:]')"
  argv_ok_count="$(wc -l <"$argv_ok_log" | tr -d '[:space:]')"

  if [[ "$call_count" != "1" ]]; then
    report_case_failure "$case_name" \
      "expected exactly one llvm-nm invocation, found $call_count" \
      "$stdout_file" "$stderr_file"
  fi

  if [[ "$argv_ok_count" != "1" ]]; then
    report_case_failure "$case_name" \
      "llvm-nm arguments were not exact" "$stdout_file" "$stderr_file"
  fi

  if [[ "$expected_result" == "pass" ]]; then
    if [[ "$status" -ne 0 ]]; then
      report_case_failure "$case_name" \
        "expected success, received status $status" "$stdout_file" "$stderr_file"
    fi

    for expected_line in \
      juris_mobile_bridge_abi_version \
      juris_mobile_bridge_execute \
      juris_mobile_bridge_string_free \
      'exact export set: PASS'; do
      if ! grep -Fxq "$expected_line" "$stdout_file"; then
        report_case_failure "$case_name" \
          "missing success evidence: $expected_line" "$stdout_file" "$stderr_file"
      fi
    done

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

  if grep -Fxq 'exact export set: PASS' "$stdout_file"; then
    report_case_failure "$case_name" \
      "negative case printed a success marker" "$stdout_file" "$stderr_file"
  fi

  if [[ "$case_name" == "masked_reader_failure" ]] && \
    ! grep -Fq 'llvm-nm failed with exit status 42' "$stderr_file"; then
    report_case_failure "$case_name" \
      "reader exit status was not preserved" "$stdout_file" "$stderr_file"
  fi

  if [[ "$case_name" == "diagnostic_failure" ]] && \
    ! grep -Fq 'llvm-nm emitted an error diagnostic' "$stderr_file"; then
    report_case_failure "$case_name" \
      "zero-status error diagnostic was not rejected" "$stdout_file" "$stderr_file"
  fi

  echo "case $case_name: PASS (rejected with status $status)"
}

run_case exact pass
run_case darwin pass
run_case duplicate pass
run_case missing fail
run_case fourth_export fail
run_case masked_reader_failure fail
run_case diagnostic_failure fail
run_case no_bridge_symbols fail

echo 'verifier test matrix: PASS (8/8)'
