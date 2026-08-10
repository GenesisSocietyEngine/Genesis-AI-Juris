#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C

if [[ "$#" -ne 3 ]]; then
  echo "usage: $0 <archive-path> <llvm-nm-path> <lipo-path>" >&2
  exit 2
fi

archive="$1"
llvm_nm="$2"
lipo="$3"

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

if [[ ! -f "$lipo" ]]; then
  echo "architecture inspector does not exist: $lipo" >&2
  exit 1
fi

if [[ ! -x "$lipo" ]]; then
  echo "architecture inspector is not executable: $lipo" >&2
  exit 1
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/juris-ios-ffi-exports.XXXXXX")"
cleanup() {
  if [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf "$temporary_directory"
  fi
}
trap cleanup EXIT

emit_bounded_diagnostics() {
  local diagnostics_file="$1"
  local diagnostics_size

  if [[ ! -s "$diagnostics_file" ]]; then
    return
  fi

  diagnostics_size="$(wc -c <"$diagnostics_file" | tr -d '[:space:]')"
  head -c 8192 "$diagnostics_file" >&2
  printf '\n' >&2
  if [[ "$diagnostics_size" -gt 8192 ]]; then
    echo "diagnostics truncated after 8192 bytes" >&2
  fi
}

contains_error_diagnostic() {
  local diagnostics_file="$1"

  grep -Eiq \
    '(^|[[:space:]])((fatal([[:space:]]+error)?)|error):|unknown attribute kind' \
    "$diagnostics_file"
}

expected="$temporary_directory/expected.txt"
architecture_stdout="$temporary_directory/architectures.stdout"
architecture_diagnostics="$temporary_directory/architectures.stderr"
raw_architectures="$temporary_directory/architectures.raw.txt"
sorted_architectures="$temporary_directory/architectures.sorted.txt"
duplicate_architectures="$temporary_directory/architectures.duplicates.txt"

cat >"$expected" <<'EXPECTED'
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
EXPECTED

inspector_status=0
if "$lipo" -archs "$archive" \
  >"$architecture_stdout" 2>"$architecture_diagnostics"; then
  inspector_status=0
else
  inspector_status=$?
fi

if [[ "$inspector_status" -ne 0 ]]; then
  emit_bounded_diagnostics "$architecture_diagnostics"
  echo \
    "architecture discovery: inspector failed with exit status $inspector_status" \
    >&2
  exit 1
fi

if [[ -s "$architecture_diagnostics" ]]; then
  emit_bounded_diagnostics "$architecture_diagnostics"
  if contains_error_diagnostic "$architecture_diagnostics"; then
    echo \
      "architecture discovery: inspector emitted an error diagnostic" \
      >&2
  else
    echo "architecture discovery: inspector emitted a diagnostic" >&2
  fi
  exit 1
fi

if ! awk '{ for (field = 1; field <= NF; field++) print $field }' \
  "$architecture_stdout" >"$raw_architectures"; then
  echo "architecture discovery: cannot tokenize inspector output" >&2
  exit 1
fi

if [[ ! -s "$raw_architectures" ]]; then
  echo "architecture discovery: inspector returned no architectures" >&2
  exit 1
fi

while IFS= read -r architecture || [[ -n "$architecture" ]]; do
  if [[ "$architecture" == "all" || "${#architecture}" -gt 64 ]]; then
    echo "architecture discovery: unsafe architecture token: $architecture" >&2
    exit 1
  fi

  case "$architecture" in
    [[:alnum:]]*) ;;
    *)
      echo "architecture discovery: unsafe architecture token: $architecture" >&2
      exit 1
      ;;
  esac

  case "$architecture" in
    *[![:alnum:]_.-]*)
      echo "architecture discovery: unsafe architecture token: $architecture" >&2
      exit 1
      ;;
  esac
done <"$raw_architectures"

LC_ALL=C sort "$raw_architectures" | uniq -d >"$duplicate_architectures"
if [[ -s "$duplicate_architectures" ]]; then
  emit_bounded_diagnostics "$duplicate_architectures"
  echo "architecture discovery: duplicate architecture token" >&2
  exit 1
fi

LC_ALL=C sort "$raw_architectures" >"$sorted_architectures"

architectures=()
architecture_count=0
while IFS= read -r architecture || [[ -n "$architecture" ]]; do
  architectures[$architecture_count]="$architecture"
  architecture_count=$((architecture_count + 1))
done <"$sorted_architectures"

if [[ "$architecture_count" -eq 0 ]]; then
  echo "architecture discovery: validated architecture list is empty" >&2
  exit 1
fi

echo "archive path: $archive"
echo "architecture inspector path: $lipo"
printf 'raw architecture list:'
while IFS= read -r architecture || [[ -n "$architecture" ]]; do
  printf ' %s' "$architecture"
done <"$raw_architectures"
printf '\n'

printf 'archive architectures (%d):' "$architecture_count"
for architecture in "${architectures[@]}"; do
  printf ' %s' "$architecture"
done
printf '\n'

audited_count=0
architecture_index=0
for architecture in "${architectures[@]}"; do
  architecture_index=$((architecture_index + 1))
  raw="$temporary_directory/slice.$architecture_index.raw.txt"
  diagnostics="$temporary_directory/slice.$architecture_index.stderr"
  actual="$temporary_directory/slice.$architecture_index.actual.txt"
  invalid="$temporary_directory/slice.$architecture_index.invalid.txt"
  difference="$temporary_directory/slice.$architecture_index.diff.txt"

  echo "architecture $architecture export audit: START"

  nm_status=0
  if "$llvm_nm" \
    "--arch=$architecture" \
    --defined-only \
    --extern-only \
    --just-symbol-name \
    "$archive" >"$raw" 2>"$diagnostics"; then
    nm_status=0
  else
    nm_status=$?
  fi

  if [[ "$nm_status" -ne 0 ]]; then
    emit_bounded_diagnostics "$diagnostics"
    echo \
      "architecture $architecture: llvm-nm failed with exit status $nm_status; export set is untrusted" \
      >&2
    exit 1
  fi

  if [[ -s "$diagnostics" ]]; then
    emit_bounded_diagnostics "$diagnostics"
    if contains_error_diagnostic "$diagnostics"; then
      echo \
        "architecture $architecture: llvm-nm emitted an error diagnostic; export set is untrusted" \
        >&2
    else
      echo \
        "architecture $architecture: llvm-nm emitted a diagnostic; export set is untrusted" \
        >&2
    fi
    exit 1
  fi

  : >"$invalid"
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
    emit_bounded_diagnostics "$invalid"
    echo \
      "architecture $architecture: llvm-nm emitted an invalid bridge namespace symbol; export set is untrusted" \
      >&2
    exit 1
  fi

  actual_count="$(wc -l <"$actual" | tr -d '[:space:]')"
  validation_failed=0

  if [[ "$actual_count" != "3" ]]; then
    echo \
      "architecture $architecture: expected 3 unique bridge exports, found $actual_count" \
      >&2
    validation_failed=1
  fi

  if diff -u "$expected" "$actual" >"$difference"; then
    :
  else
    validation_failed=1
  fi

  if [[ "$validation_failed" -ne 0 ]]; then
    emit_bounded_diagnostics "$difference"
    echo "architecture $architecture: exact bridge export set mismatch" >&2
    exit 1
  fi

  cat "$actual"
  echo "architecture $architecture exact export set: PASS"
  audited_count=$((audited_count + 1))
done

if [[ "$audited_count" -ne "$architecture_count" ]]; then
  echo \
    "audited architecture count mismatch: discovered=$architecture_count audited=$audited_count" \
    >&2
  exit 1
fi

echo "all $architecture_count architecture slices exact export set: PASS"
