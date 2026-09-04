import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the v62 social preview is an exact project-bound 1200 by 630 PNG", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../public/og-v62.png", import.meta.url));

  assert.match(layout, /url: "\/og-v62\.png"/u);
  assert.match(layout, /images: \["\/og-v62\.png"\]/u);
  assert.deepEqual([...preview.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const pngUint32 = (offset: number) => (
    preview[offset]! * 0x1000000
    + preview[offset + 1]! * 0x10000
    + preview[offset + 2]! * 0x100
    + preview[offset + 3]!
  );
  assert.equal(pngUint32(16), 1200);
  assert.equal(pngUint32(20), 630);
  assert.equal(
    createHash("sha256").update(preview).digest("hex"),
    "cf92f43273d9cb9e0c1390405a1a445d7e23cfe434721ed76f61e5f1cc33b7b2",
  );
});

test("the verified build fails closed on strict TypeScript validation", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const buildScript = readFileSync(new URL("../scripts/build-verified.sh", import.meta.url), "utf8");

  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit --incremental false");
  assert.equal(packageJson.scripts["parity:lock"], "node --import tsx scripts/verify-mobile-parity.ts --lock-only");
  assert.equal(packageJson.scripts["parity:mobile"], "node --import tsx scripts/verify-mobile-parity.ts");
  assert.match(buildScript, /^set -euo pipefail$/m);
  const typecheck = buildScript.indexOf("npm run typecheck");
  const parity = buildScript.indexOf("npm run parity:lock");
  const bundler = buildScript.indexOf('"${vinext}" build');
  assert.ok(typecheck >= 0, "verified builds must invoke the dedicated typecheck command");
  assert.ok(parity > typecheck, "the mobile parity lock must run after strict typechecking");
  assert.ok(bundler > parity, "the bundler must remain unreachable after either release gate fails");
});

test("the release verifier guards a linked mobile worktree before running mobile tools", () => {
  const releaseScript = readFileSync(new URL("../scripts/verify-release.sh", import.meta.url), "utf8");

  assert.ok(!releaseScript.includes('! -d "${mobile_root}/.git"'));
  assert.ok(releaseScript.includes('! -d "${mobile_root}"'));

  const guardAndParity = releaseScript.indexOf('npm run parity:mobile -- --mobile-repo "${mobile_root}"');
  const layoutProbe = releaseScript.indexOf('"${dart_command}" run tool/verify_report_graph_layout.dart --check');
  const dartFormat = releaseScript.indexOf('"${dart_command}" format --output=none --set-exit-if-changed lib test tool integration_test');
  const flutter = releaseScript.indexOf('"${flutter_command}" pub get');
  const flutterAnalyze = releaseScript.indexOf('"${flutter_command}" analyze');
  const cargo = releaseScript.indexOf('"${cargo_command}" test --workspace --locked');
  const cargoFmt = releaseScript.indexOf('"${cargo_command}" fmt --all -- --check');
  const cargoClippy = releaseScript.indexOf('"${cargo_command}" clippy --workspace --all-targets --locked -- -D warnings');
  const android = releaseScript.indexOf('"${flutter_command}" test --no-pub');
  const hostedEvidence = releaseScript.indexOf("exact-SHA hosted Rust, Flutter, Android, and iOS evidence lock");
  const finalCheckoutGuard = releaseScript.indexOf('node --import tsx scripts/verify-mobile-checkout.ts "${mobile_root}"');

  assert.ok(guardAndParity >= 0, "release verification must invoke the exact-SHA mobile guard and parity gate");
  assert.ok(layoutProbe > guardAndParity, "the executable layout probe must follow the checkout/runtime gate");
  assert.ok(dartFormat > layoutProbe, "Dart formatting must remain unreachable until report-layout parity passes");
  assert.ok(flutter > dartFormat, "dependency resolution must run only after fail-closed Dart formatting");
  assert.ok(flutterAnalyze > flutter, "Flutter analysis must run after dependency resolution");
  assert.ok(cargo > guardAndParity, "Rust commands must remain unreachable until the checkout guard passes");
  assert.ok(cargoFmt > guardAndParity && cargoFmt < cargo, "Rust formatting must pass before tests");
  assert.ok(cargoClippy > cargoFmt && cargoClippy < cargo, "Rust Clippy must pass before tests");
  assert.ok(android > guardAndParity, "native commands must remain unreachable until the checkout guard passes");
  assert.ok(finalCheckoutGuard > android && finalCheckoutGuard > hostedEvidence, "the exact checkout must be revalidated after every mobile/native gate");
});

test("the release verifier is dossier-complete and binds exact clean web bytes before and after tools", () => {
  const releaseScript = readFileSync(new URL("../scripts/verify-release.sh", import.meta.url), "utf8");
  const checkoutVerifier = readFileSync(new URL("../scripts/verify-web-checkout.ts", import.meta.url), "utf8");
  const preflight = releaseScript.indexOf("web_checkout_before=");
  const dossierE2e = releaseScript.lastIndexOf("tests/dossier-e2e.test.ts");
  const layoutProbe = releaseScript.lastIndexOf("tool/verify_report_graph_layout.dart");
  const finalGuard = releaseScript.indexOf("web_checkout_after=");
  const pass = releaseScript.indexOf("PASS v62 Decision-Centric Dossier Workspace release verification");

  assert.match(releaseScript, /GENESIS_RELEASE_WEB_HEAD must name the exact reviewed lowercase web commit SHA/u);
  assert.ok(preflight >= 0 && dossierE2e > preflight && layoutProbe > preflight, "dossier and mobile-layout gates must follow exact-source preflight");
  assert.ok(finalGuard > dossierE2e && pass > finalGuard, "PASS must remain unreachable until post-tool source revalidation");
  assert.doesNotMatch(releaseScript, /PASS v62 Professional Report Graph Pagination/u);
  assert.match(checkoutVerifier, /--untracked-files=all/u);
  assert.match(checkoutVerifier, /trackedByteSha256/u);
  assert.match(checkoutVerifier, /diff-index/u);
});

test("the release verifier cannot mutate or bless the PDF visual baseline", () => {
  const releaseScript = readFileSync(new URL("../scripts/verify-release.sh", import.meta.url), "utf8");
  const environmentGuard = releaseScript.indexOf('[[ -n "${REPORT_PDF_UPDATE_VISUAL_BASELINE:-}" ]]');
  const reportVerification = releaseScript.indexOf("env -u REPORT_PDF_UPDATE_VISUAL_BASELINE npm run reports:verify");

  assert.ok(environmentGuard >= 0, "release verification must reject an inherited baseline-update mode");
  assert.ok(reportVerification > environmentGuard, "release verification must clear update mode before PDF QA");
  assert.match(releaseScript, /REPORT_PDF_UPDATE_VISUAL_BASELINE must be unset during read-only release verification/u);
});

test("the mobile parity probe gives tar only cwd-relative archive paths", () => {
  const parityScript = readFileSync(new URL("../scripts/verify-mobile-parity.ts", import.meta.url), "utf8");

  assert.match(
    parityScript,
    /run\("tar", \[\s*"-xf",\s*relative\(probeRoot, archivePath\),\s*"-C",\s*relative\(probeRoot, sourceRoot\),\s*\], probeRoot\);/u,
  );
  assert.doesNotMatch(parityScript, /run\("tar", \["-xf", archivePath/u);
});

test("the parity lock requires exact-SHA receipts for every mobile platform gate", () => {
  const parityScript = readFileSync(new URL("../scripts/verify-mobile-parity.ts", import.meta.url), "utf8");
  const parityAssertions = readFileSync(new URL("../scripts/parity-contract-assertions.ts", import.meta.url), "utf8");
  const releaseScript = readFileSync(new URL("../scripts/verify-release.sh", import.meta.url), "utf8");

  for (const gate of ["rust", "flutter", "android", "ios"]) {
    assert.match(parityScript, new RegExp(`${gate}: WorkflowEvidence`));
  }
  assert.match(parityScript, /assertHostedWorkflowEvidence\(lock\.hostedEvidence, lock\.mobile\.commit\)/u);
  assert.match(parityAssertions, /REQUIRED_HOSTED_EVIDENCE_GATES = \["android", "flutter", "ios", "rust"\]/u);
  assert.match(parityAssertions, /Object\.keys\(hostedEvidence\)\.sort\(\)/u);
  assert.match(releaseScript, /const requiredGates = \["android", "flutter", "ios", "rust"\]/u);
  assert.match(releaseScript, /Object\.keys\(lock\.hostedEvidence \?\? \{\}\)\.sort\(\)/u);
});
