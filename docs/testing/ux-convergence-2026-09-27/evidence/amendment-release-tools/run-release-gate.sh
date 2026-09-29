#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/release-gate-env.sh"
if [[ $# -ne 1 || ! "$1" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Supply the explicit reviewed, clean, committed web SHA as the only argument.' >&2
  exit 64
fi
export GENESIS_RELEASE_WEB_HEAD="$1"
cd "${gate_root}"
log_path="${script_dir}/aggregate-${GENESIS_RELEASE_WEB_HEAD}-$(date -u +%Y%m%dT%H%M%SZ).log"
printf 'Aggregate release log: %s\n' "${log_path}"
printf 'Toolchain: Node22.23.2/npm10.9.8; Flutter3.44.8/Dart3.12.2 cached snapshot; Rust1.97.1 stable Windows-MSVC with installed Android targets; Poppler25.07; emulator-5580.\n' | tee "${log_path}"
# Invoke the existing gate unchanged. pipefail preserves its real failure status.
bash scripts/verify-release.sh 2>&1 | tee -a "${log_path}"
