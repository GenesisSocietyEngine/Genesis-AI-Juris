#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: $0 <archive-path> <llvm-nm-path>" >&2
  exit 2
fi

archive="$1"
llvm_nm="$2"

if [[ ! -f "$archive" ]]; then
  echo "iOS static archive does not exist: $archive" >&2
  exit 1
fi

if [[ ! -f "$llvm_nm" ]]; then
  echo "llvm-nm does not exist: $llvm_nm" >&2
  exit 1
fi

if [[ ! -x "$llvm_nm" ]]; then
  echo "llvm-nm is not executable: $llvm_nm" >&2
  exit 1
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/juris-ios-ffi-exports.XXXXXX")"
cleanup() {
  if [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf "$temporary_directory"
  fi
}
trap cleanup EXIT

expected="$temporary_directory/expected.txt"
raw="$temporary_directory/raw.txt"
diagnostics="$temporary_directory/diagnostics.txt"
actual="$temporary_directory/actual.txt"
invalid="$temporary_directory/invalid.txt"

cat >"$expected" <<'EXPECTED'
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
EXPECTED

nm_status=0
if "$llvm_nm" \
  --defined-only \
  --extern-only \
  --just-symbol-name \
  "$archive" >"$raw" 2>"$diagnostics"; then
  nm_status=0
else
  nm_status=$?
fi

if [[ "$nm_status" -ne 0 ]]; then
  if [[ -s "$diagnostics" ]]; then
    cat "$diagnostics" >&2
  fi
  echo "llvm-nm failed with exit status $nm_status; export set is untrusted" >&2
  exit 1
fi

if grep -Eiq '(^|[[:space:]])(fatal[[:space:]]+)?error:|unknown attribute kind' \
  "$diagnostics"; then
  cat "$diagnostics" >&2
  echo "llvm-nm emitted an error diagnostic; export set is untrusted" >&2
  exit 1
fi

awk -v invalid="$invalid" '
  {
    symbol = $0
    sub(/^_/, "", symbol)
    if (symbol ~ /^juris_mobile_bridge_/) {
      if (symbol ~ /^juris_mobile_bridge_[A-Za-z0-9_]+$/) {
        print symbol
      } else {
        print symbol > invalid
      }
    }
  }
' "$raw" | LC_ALL=C sort -u >"$actual"

if [[ -s "$invalid" ]]; then
  cat "$invalid" >&2
  echo "llvm-nm emitted an invalid bridge namespace symbol; export set is untrusted" >&2
  exit 1
fi

actual_count="$(wc -l <"$actual" | tr -d '[:space:]')"
validation_failed=0

if [[ "$actual_count" != "3" ]]; then
  echo "expected 3 unique bridge exports, found $actual_count" >&2
  validation_failed=1
fi

if ! diff -u "$expected" "$actual"; then
  validation_failed=1
fi

if [[ "$validation_failed" -ne 0 ]]; then
  echo "exact bridge export set mismatch" >&2
  exit 1
fi

cat "$actual"
echo "exact export set: PASS"
