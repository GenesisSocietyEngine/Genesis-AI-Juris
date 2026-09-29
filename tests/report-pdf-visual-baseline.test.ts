import assert from "node:assert/strict";
import test from "node:test";
import { assertReportPdfVisualBaseline } from "../scripts/tests/report-pdf-visual-baseline";

const outputRoot = ".artifacts/isolated review/run-1";
function fixture(root = ".artifacts/v62-report-qa") {
  return {
    schemaVersion: 1,
    runtime: { platform: "win32", architecture: "x64" },
    entries: [{
      cohort: "review:deep:en:internal", fixtureId: "stress-deep", pageRole: "middle", graphPageId: null,
      reportPage: 10, pngPath: `${root}/png/stress-deep/page-10.png`, pngSha256: "a".repeat(64),
      layoutFingerprint: `sha256-${"b".repeat(64)}`, width: 794, height: 1123,
    }],
  };
}

test("visual comparison changes only the declared artifact root and preserves its inputs", () => {
  const expected = fixture();
  const current = fixture(outputRoot);
  const before = structuredClone({ expected, current });
  assert.equal(assertReportPdfVisualBaseline(expected, current, outputRoot), 1);
  assert.equal(assertReportPdfVisualBaseline(fixture(".artifacts/approved-run"), current, outputRoot), 1);
  assert.deepEqual({ expected, current }, before);
});

test("visual comparison rejects traversal, undeclared roots and wrong fixture or page locators", () => {
  for (const path of [
    `${outputRoot}/../png/stress-deep/page-10.png`,
    `${outputRoot}/png/stress-deep/../stress-deep/page-10.png`,
    `${outputRoot}/png/other-fixture/page-10.png`,
    `${outputRoot}/png/stress-deep/page-11.png`,
    ".artifacts/other-run/png/stress-deep/page-10.png",
    "C:/outside/png/stress-deep/page-10.png",
  ]) {
    const current = fixture(outputRoot);
    current.entries[0].pngPath = path;
    assert.throws(() => assertReportPdfVisualBaseline(fixture(), current, outputRoot), /path|pngPath/u);
  }
  const expected = fixture();
  expected.entries[0].pngPath = ".artifacts/v62-report-qa/../png/stress-deep/page-10.png";
  assert.throws(() => assertReportPdfVisualBaseline(expected, fixture(outputRoot), outputRoot), /traversal/u);
  assert.throws(() => assertReportPdfVisualBaseline(fixture(), fixture(outputRoot), ".artifacts/../outside"), /traversal/u);
});

test("visual comparison retains exact hashes, suffixes, metadata and selection checks", () => {
  for (const change of [
    { pngSha256: "c".repeat(64) }, { layoutFingerprint: `sha256-${"d".repeat(64)}` }, { width: 795 },
    { pngPath: `${outputRoot}/png/stress-deep/page-010.png` },
    { reportPage: 11, pngPath: `${outputRoot}/png/stress-deep/page-11.png` },
    { fixtureId: "other-fixture", pngPath: `${outputRoot}/png/other-fixture/page-10.png` },
  ]) {
    const current = fixture(outputRoot);
    Object.assign(current.entries[0], change);
    assert.throws(() => assertReportPdfVisualBaseline(fixture(), current, outputRoot), /regression|selection/u);
  }
  const current = fixture(outputRoot);
  current.runtime.architecture = "arm64";
  assert.throws(() => assertReportPdfVisualBaseline(fixture(), current, outputRoot), /metadata/u);
  const duplicate = fixture(outputRoot);
  duplicate.entries.push({ ...duplicate.entries[0] });
  assert.throws(() => assertReportPdfVisualBaseline(fixture(), duplicate, outputRoot), /duplicates/u);
});
