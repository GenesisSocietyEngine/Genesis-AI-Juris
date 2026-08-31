import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  const flutter = releaseScript.indexOf('"${flutter_command}" pub get');
  const cargo = releaseScript.indexOf('"${cargo_command}" test --workspace --locked');
  const android = releaseScript.indexOf('"${flutter_command}" test --no-pub');

  assert.ok(guardAndParity >= 0, "release verification must invoke the exact-SHA mobile guard and parity gate");
  assert.ok(flutter > guardAndParity, "Flutter commands must remain unreachable until the checkout guard passes");
  assert.ok(cargo > guardAndParity, "Rust commands must remain unreachable until the checkout guard passes");
  assert.ok(android > guardAndParity, "native commands must remain unreachable until the checkout guard passes");
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
  const releaseScript = readFileSync(new URL("../scripts/verify-release.sh", import.meta.url), "utf8");

  for (const gate of ["rust", "flutter", "android", "ios"]) {
    assert.match(parityScript, new RegExp(`${gate}: WorkflowEvidence`));
  }
  assert.match(parityScript, /evidence\.commit, lock\.mobile\.commit/u);
  assert.match(parityScript, /evidence\.conclusion, "success"/u);
  assert.match(parityScript, /evidence\.run > 0/u);
  assert.match(releaseScript, /Object\.entries\(lock\.hostedEvidence\)/u);
});
