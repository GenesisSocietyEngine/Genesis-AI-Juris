#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/release-gate-env.sh"
cd "${gate_root}"
node --version
npm --version
"${JURIS_DART_BIN}" --version
"${JURIS_DART_BIN}" "${script_dir}/probe-args.dart" --manifest "${gate_root}/app/report-manifest.v1.json"
"${JURIS_CARGO_BIN}" --version
"${RUSTC}" --version
pdfinfo -v
command -v timeout
command -v node
command -v npm
command -v cargo
printf 'Public npm registry: %s\n' "${npm_config_registry}"
"${JURIS_FLUTTER_BIN}" --version
