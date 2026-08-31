#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
mobile_root="${JURIS_MOBILE_REPO:-}"
flutter_command="${JURIS_FLUTTER_BIN:-flutter}"
cargo_command="${JURIS_CARGO_BIN:-cargo}"
android_device="${JURIS_ANDROID_DEVICE_ID:-emulator-5554}"

if [[ -z "${mobile_root}" || ! -d "${mobile_root}" ]]; then
  echo "JURIS_MOBILE_REPO must name the exact locked mobile Git checkout." >&2
  exit 64
fi

cd "${project_root}"

echo "[web 1/6] strict TypeScript"
npx tsc --noEmit --incremental false

echo "[web 2/6] lint"
npm run lint

echo "[web 3/6] tests (including verified build)"
npm test

echo "[web 4/6] production dependency audit"
npm audit --omit=dev

echo "[web 5/6] patch hygiene"
git diff --check

echo "[web 6/6] final verified build"
npm run build

echo "[mobile 1/5] exact-SHA checkout and 18-route cross-runtime fixture parity"
npm run parity:mobile -- --mobile-repo "${mobile_root}"

echo "[mobile 2/5] dependency resolution"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" pub get
)

echo "[mobile 3/5] Flutter analysis"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" analyze
)

echo "[mobile 4/5] Flutter tests"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" test
)

echo "[mobile 5/5] locked Rust workspace tests"
(
  cd "${mobile_root}"
  "${cargo_command}" test --workspace --locked
)

echo "[native 1/2] Android FFI persistence smoke"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" test --no-pub integration_test/native_android_persistence_smoke_test.dart -d "${android_device}"
)

echo "[native 2/2] exact-SHA hosted Rust, Flutter, Android, and iOS evidence lock"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const lock = JSON.parse(readFileSync("parity/mobile-parity.lock.json", "utf8"));
  for (const [gate, evidence] of Object.entries(lock.hostedEvidence)) {
    if (evidence.commit !== lock.mobile.commit
      || evidence.conclusion !== "success"
      || !Number.isSafeInteger(evidence.run)
      || evidence.run <= 0) {
      throw new Error(`exact-SHA successful ${gate} workflow evidence is not locked`);
    }
    console.log(`PASS ${gate} workflow ${evidence.run} for ${lock.mobile.commit}`);
  }
'

echo "PASS v54 release verification. Deployment remains a separate, explicit Sites operation."
