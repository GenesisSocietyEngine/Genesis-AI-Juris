#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
mobile_root="${JURIS_MOBILE_REPO:-}"
flutter_command="${JURIS_FLUTTER_BIN:-flutter}"
dart_command="${JURIS_DART_BIN:-dart}"
cargo_command="${JURIS_CARGO_BIN:-cargo}"
android_device="${JURIS_ANDROID_DEVICE_ID:-emulator-5554}"
expected_web_head="${GENESIS_RELEASE_WEB_HEAD:-}"

if [[ -n "${REPORT_PDF_UPDATE_VISUAL_BASELINE:-}" ]]; then
  echo "REPORT_PDF_UPDATE_VISUAL_BASELINE must be unset during read-only release verification." >&2
  exit 65
fi

if [[ -z "${mobile_root}" || ! -d "${mobile_root}" ]]; then
  echo "JURIS_MOBILE_REPO must name the exact locked mobile Git checkout." >&2
  exit 64
fi

if [[ ! "${expected_web_head}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "GENESIS_RELEASE_WEB_HEAD must name the exact reviewed lowercase web commit SHA." >&2
  exit 64
fi

if [[ ! -f "${project_root}/tests/dossier-e2e.test.ts" ]]; then
  echo "The five-scenario dossier E2E gate is absent; v62 release verification is blocked." >&2
  exit 66
fi

mobile_layout_probe="${mobile_root}/apps/juris-mobile/tool/verify_report_graph_layout.dart"
if [[ ! -f "${mobile_layout_probe}" ]]; then
  echo "The executable Flutter report-layout parity probe is absent; v62 release verification is blocked." >&2
  exit 67
fi

cd "${project_root}"

echo "[web 1/10] exact clean HEAD, tracked-byte, and untracked-file preflight"
web_checkout_before="$(node --import tsx scripts/verify-web-checkout.ts --repo "${project_root}" --expected-head "${expected_web_head}")"
echo "PASS ${web_checkout_before}"

echo "[web 2/10] strict TypeScript"
npx tsc --noEmit --incremental false

echo "[web 3/10] lint"
npm run lint

echo "[web 4/10] tests (including verified build and dossier gates)"
npm test

echo "[web 5/10] five required decision-centric dossier E2E scenarios"
node --experimental-sqlite --import tsx --test tests/dossier-e2e.test.ts

echo "[web 6/10] bilingual professional PDF structural, text, and visual verification"
env -u REPORT_PDF_UPDATE_VISUAL_BASELINE npm run reports:verify

echo "[web 7/10] production dependency audit"
npm audit --omit=dev

echo "[web 8/10] patch hygiene"
git diff --check

echo "[web 9/10] final verified build"
npm run build

echo "[mobile 1/9] exact-SHA checkout and 18-route runtime parity"
npm run parity:mobile -- --mobile-repo "${mobile_root}"

echo "[mobile 2/9] executable report-layout fixture and fingerprint parity"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${dart_command}" run tool/verify_report_graph_layout.dart --check \
    --manifest "${project_root}/app/report-manifest.v1.json" \
    --font-metrics "${project_root}/app/report-graph-font-metrics.v1.json" \
    --fixtures "${project_root}/parity/report-graph-layout-fixtures.v1.json"
)

echo "[mobile 3/9] fail-closed Dart formatting"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${dart_command}" format --output=none --set-exit-if-changed lib test tool integration_test
)

echo "[mobile 4/9] dependency resolution"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" pub get
)

echo "[mobile 5/9] Flutter analysis"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" analyze
)

echo "[mobile 6/9] Flutter tests"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" test
)

echo "[mobile 7/9] locked Rust formatting"
(
  cd "${mobile_root}"
  "${cargo_command}" fmt --all -- --check
)

echo "[mobile 8/9] locked Rust Clippy"
(
  cd "${mobile_root}"
  "${cargo_command}" clippy --workspace --all-targets --locked -- -D warnings
)

echo "[mobile 9/9] locked Rust workspace tests"
(
  cd "${mobile_root}"
  "${cargo_command}" test --workspace --locked
)

echo "[native 1/3] Android FFI persistence smoke"
(
  cd "${mobile_root}/apps/juris-mobile"
  "${flutter_command}" test --no-pub integration_test/native_android_persistence_smoke_test.dart -d "${android_device}"
)

echo "[native 2/3] exact-SHA hosted Rust, Flutter, Android, and iOS evidence lock"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const lock = JSON.parse(readFileSync("parity/mobile-parity.lock.json", "utf8"));
  const requiredGates = ["android", "flutter", "ios", "rust"];
  const actualGates = Object.keys(lock.hostedEvidence ?? {}).sort();
  if (JSON.stringify(actualGates) !== JSON.stringify(requiredGates)) {
    throw new Error(`hosted workflow evidence must have exact keys ${requiredGates.join(", ")}`);
  }
  for (const gate of requiredGates) {
    const evidence = lock.hostedEvidence[gate];
    if (evidence.commit !== lock.mobile.commit
      || evidence.conclusion !== "success"
      || !Number.isSafeInteger(evidence.run)
      || evidence.run <= 0) {
      throw new Error(`exact-SHA successful ${gate} workflow evidence is not locked`);
    }
    console.log(`PASS ${gate} workflow ${evidence.run} for ${lock.mobile.commit}`);
  }
'

echo "[native 3/3] final exact-HEAD and tracked-byte immutability guard"
node --import tsx scripts/verify-mobile-checkout.ts "${mobile_root}"

echo "[web 10/10] final exact-source immutability guard"
web_checkout_after="$(node --import tsx scripts/verify-web-checkout.ts --repo "${project_root}" --expected-head "${expected_web_head}")"
if [[ "${web_checkout_after}" != "${web_checkout_before}" ]]; then
  echo "Web tracked bytes changed during release verification." >&2
  exit 68
fi

echo "PASS v62 Decision-Centric Dossier Workspace release verification on exact web and mobile heads. Deployment remains a separate, explicitly approved Sites operation."
