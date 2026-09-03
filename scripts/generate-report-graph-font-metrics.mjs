#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputPath = resolve(projectRoot, "app/report-graph-font-metrics.v1.json");
const vfsModule = "pdfmake/build/vfs_fonts.js";
const fontSources = [
  ["regular", "Roboto-Regular.ttf"],
  ["medium", "Roboto-Medium.ttf"],
];
const lockedFaces = {
  "Roboto-Medium.ttf": {
    byteLength: 152_776,
    sha256: "79a763229b01229cfd921a9a0108e58c162d045d828037e32c6fb85ed6f914be",
    unitsPerEm: 2_048,
  },
  "Roboto-Regular.ttf": {
    byteLength: 152_588,
    sha256: "a93f6bc56ef0349a4426b717c182482bb878534f31077ae5e1b2b4dae7a089d1",
    unitsPerEm: 2_048,
  },
};
const require = createRequire(import.meta.url);
const lockedPdfmakeVersion = "0.2.20";
const lockedFontkitVersion = "1.9.2";
const lockedMetricProofs = {
  "Roboto-Medium.ttf": {
    defaultAdvance: 908,
    gdefMarkCodePoints: [768, 769, 771, 777, 783, 803, 1155, 1156, 1157, 1158],
    mappedCodePointCount: 923,
    maximumInkOverhang: { left: 1_498, right: 450 },
    maximumPositiveShapingAdjustment: 100,
    positiveAdjustmentRecordCount: 220,
    positiveAdjustmentRecordSha256: "0407d3d60012d4211dcca97c27a674b591ea7be1b81c2f271636d7882211f3f1",
    postScriptName: "Roboto-Medium",
    unsafePairRecordCount: 362,
    unsafePairRecordSha256: "5aecaab7413910592b08b7d5e8e8b67f493c4c94461cd03948cca6083ead18b8",
    unsafeShapingTripleOracleThrows: 4_682,
  },
  "Roboto-Regular.ttf": {
    defaultAdvance: 908,
    gdefMarkCodePoints: [768, 769, 771, 777, 783, 803, 1155, 1156, 1157, 1158],
    mappedCodePointCount: 923,
    maximumInkOverhang: { left: 1_510, right: 438 },
    maximumPositiveShapingAdjustment: 100,
    positiveAdjustmentRecordCount: 219,
    positiveAdjustmentRecordSha256: "62e534598a4f8dc27fafb0862a67caccc46ac16dca6e29d2af25a2f248976401",
    postScriptName: "Roboto-Regular",
    unsafePairRecordCount: 362,
    unsafePairRecordSha256: "5aecaab7413910592b08b7d5e8e8b67f493c4c94461cd03948cca6083ead18b8",
    unsafeShapingTripleOracleThrows: 4_682,
  },
};

function fail(message) {
  throw new Error(`report graph font metrics: ${message}`);
}

function recordSha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildFontMetrics(fontkit, sourceFile, sourceBytes) {
  const font = fontkit.create(sourceBytes);
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const locked = lockedFaces[sourceFile];
  if (!locked
    || sourceSha256 !== locked.sha256
    || sourceBytes.length !== locked.byteLength
    || font.unitsPerEm !== locked.unitsPerEm) {
    fail(`${sourceFile} differs from the exact governed pdfmake face`);
  }
  const codePoints = [...new Set(font.characterSet)]
    .filter((codePoint) => Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff))
    .sort((left, right) => left - right);
  const advances = {};
  for (const codePoint of codePoints) {
    const glyph = font.glyphForCodePoint(codePoint);
    if (!glyph || glyph.id === 0 || !Number.isInteger(glyph.advanceWidth) || glyph.advanceWidth < 0) continue;
    advances[String(codePoint)] = glyph.advanceWidth;
  }
  const mappedCodePoints = codePoints.filter((codePoint) => Object.hasOwn(advances, String(codePoint)));
  const glyphClass = (glyphId) => {
    for (const range of font.GDEF?.glyphClassDef?.classRangeRecord ?? []) {
      if (glyphId >= range.start && glyphId <= range.end) return range.class;
    }
    return 0;
  };
  const gdefMarkCodePoints = mappedCodePoints.filter((codePoint) => glyphClass(font.glyphForCodePoint(codePoint).id) === 3);
  const maxPositiveShapingAdjustments = {};
  const unsafeShapingPairs = [];
  let maximumPositiveShapingAdjustment = 0;
  for (const leftCodePoint of mappedCodePoints) {
    const leftAdvance = advances[String(leftCodePoint)];
    let maximum = 0;
    const left = String.fromCodePoint(leftCodePoint);
    for (const rightCodePoint of mappedCodePoints) {
      const nominal = leftAdvance + advances[String(rightCodePoint)];
      let shaped;
      try {
        shaped = font.layout(left + String.fromCodePoint(rightCodePoint)).advanceWidth;
      } catch {
        unsafeShapingPairs.push(`${leftCodePoint},${rightCodePoint}`);
        continue;
      }
      if (!Number.isFinite(shaped) || shaped < 0) fail(`${sourceFile} produced an invalid shaped pair advance`);
      maximum = Math.max(maximum, shaped - nominal);
    }
    if (maximum > 0) maxPositiveShapingAdjustments[String(leftCodePoint)] = maximum;
    maximumPositiveShapingAdjustment = Math.max(maximumPositiveShapingAdjustment, maximum);
  }
  const unsafeShapingPairSet = new Set(unsafeShapingPairs);
  let unsafeShapingTripleOracleThrows = 0;
  for (const baseCodePoint of mappedCodePoints) {
    for (const firstMarkCodePoint of gdefMarkCodePoints) {
      for (const secondMarkCodePoint of gdefMarkCodePoints) {
        try {
          font.layout(String.fromCodePoint(baseCodePoint, firstMarkCodePoint, secondMarkCodePoint));
        } catch {
          unsafeShapingTripleOracleThrows += 1;
          const rejectedByPolicy = unsafeShapingPairSet.has(`${baseCodePoint},${firstMarkCodePoint}`)
            || unsafeShapingPairSet.has(`${firstMarkCodePoint},${secondMarkCodePoint}`)
            || gdefMarkCodePoints.includes(firstMarkCodePoint) && gdefMarkCodePoints.includes(secondMarkCodePoint);
          if (!rejectedByPolicy) fail(`${sourceFile} has an unsafe stacked-mark sequence outside the committed policy`);
        }
      }
    }
  }
  let maximumLeftInkOverhang = 0;
  let maximumRightInkOverhang = 0;
  for (let glyphId = 0; glyphId < font.numGlyphs; glyphId += 1) {
    const glyph = font.getGlyph(glyphId);
    if (!glyph || !glyph.bbox || !Number.isFinite(glyph.bbox.minX) || !Number.isFinite(glyph.bbox.maxX)) continue;
    maximumLeftInkOverhang = Math.max(maximumLeftInkOverhang, -glyph.bbox.minX);
    maximumRightInkOverhang = Math.max(maximumRightInkOverhang, glyph.bbox.maxX - glyph.advanceWidth);
  }
  const fallbackGlyph = font.getGlyph(0);
  if (!fallbackGlyph || !Number.isInteger(fallbackGlyph.advanceWidth) || fallbackGlyph.advanceWidth < 0) fail(`${sourceFile} has no usable glyph-0 advance`);
  const result = {
    postScriptName: font.postscriptName,
    sourceFile,
    sourceVfsPath: `${vfsModule}#${sourceFile}`,
    sourceSha256,
    sourceByteLength: sourceBytes.length,
    unitsPerEm: font.unitsPerEm,
    mappedCodePointCount: Object.keys(advances).length,
    defaultAdvance: fallbackGlyph.advanceWidth,
    gdefMarkCodePoints,
    maxPositiveShapingAdjustments,
    maximumPositiveShapingAdjustment,
    maximumInkOverhang: {
      left: maximumLeftInkOverhang,
      right: maximumRightInkOverhang,
    },
    unsafeShapingPairs,
    unsafeShapingTripleOracleThrows,
    advances,
  };
  const exactProof = {
    defaultAdvance: result.defaultAdvance,
    gdefMarkCodePoints: result.gdefMarkCodePoints,
    mappedCodePointCount: result.mappedCodePointCount,
    maximumInkOverhang: result.maximumInkOverhang,
    maximumPositiveShapingAdjustment: result.maximumPositiveShapingAdjustment,
    positiveAdjustmentRecordCount: Object.keys(result.maxPositiveShapingAdjustments).length,
    positiveAdjustmentRecordSha256: recordSha256(result.maxPositiveShapingAdjustments),
    postScriptName: result.postScriptName,
    unsafePairRecordCount: result.unsafeShapingPairs.length,
    unsafePairRecordSha256: recordSha256(result.unsafeShapingPairs),
    unsafeShapingTripleOracleThrows: result.unsafeShapingTripleOracleThrows,
  };
  if (JSON.stringify(exactProof) !== JSON.stringify(lockedMetricProofs[sourceFile])) {
    fail(`${sourceFile} shaping, cmap, GDEF, or ink proof drifted from the audited exact-face contract`);
  }
  return result;
}

async function generateMetrics() {
  const pdfmakePackagePath = require.resolve("pdfmake/package.json", { paths: [projectRoot] });
  const pdfmakePackage = JSON.parse(await readFile(pdfmakePackagePath, "utf8"));
  if (pdfmakePackage.version !== lockedPdfmakeVersion) fail(`expected pdfmake ${lockedPdfmakeVersion}, received ${pdfmakePackage.version}`);
  const fontkitPackagePath = require.resolve("@foliojs-fork/fontkit/package.json", { paths: [projectRoot] });
  const fontkitPackage = JSON.parse(await readFile(fontkitPackagePath, "utf8"));
  if (fontkitPackage.version !== lockedFontkitVersion) fail(`expected @foliojs-fork/fontkit ${lockedFontkitVersion}, received ${fontkitPackage.version}`);
  const vfs = require(require.resolve(vfsModule, { paths: [projectRoot] }));
  const fontkit = require(require.resolve("@foliojs-fork/fontkit", { paths: [projectRoot] }));
  const fonts = {};
  for (const [fontKey, sourceFile] of fontSources) {
    const encoded = vfs[sourceFile];
    if (typeof encoded !== "string" || encoded.length === 0) fail(`${vfsModule} has no ${sourceFile}`);
    const sourceBytes = Buffer.from(encoded, "base64");
    if (sourceBytes.toString("base64") !== encoded) fail(`${sourceFile} is not canonical base64`);
    fonts[fontKey] = buildFontMetrics(fontkit, sourceFile, sourceBytes);
  }
  return {
    format: "genesis-juris-report-graph-font-metrics",
    schemaVersion: 1,
    unitPerEm: 2_048,
    advanceNormalization: "Exact integer source-font units; sum once and ceil once when converting the complete run to micrometres",
    advanceSemantics: "Per scalar: exact nominal hmtx advance plus its exhaustive maximum positive default-shaping delta as the preceding mapped scalar; exact governed faces have non-expansive liga and only pair/context expansions covered by that charge",
    unicodeKeys: "Unicode scalar values as decimal strings; iterate text by code point",
    fallback: "Layout input rejects scalars outside both governed cmaps, exact-face shaping-unsafe adjacent pairs, and every governed grapheme with two or more exact GDEF class-3 marks; defaultAdvance is exact glyph-0 width for defensive verification only and has zero shaping allowance",
    inkBounds: "Each non-empty measured run reserves the face maximum left and right outline overhang once; SVG start anchors add the left reservation",
    shapingProof: {
      method: "Exhaustively shape every ordered pair in each exact face cmap with @foliojs-fork/fontkit default features; charge every positive pair/context delta to the preceding scalar",
      faceLock: "pdfmake version, face SHA-256, byte length, and 2048 UPM are hard failures",
      longerRuns: "Exact locked Roboto ccmp expansions are pair/context covered; default liga is non-expansive; GPOS positive advances are pair positioning and combining marks may be skipped by that positioning; audited record hashes fail closed on feature-plan drift",
      unsafeSequences: "Every exact-face unsafe adjacent pair is rejected; exhaustive mapped-base plus ordered GDEF-mark-pair oracles prove all throwing triples are rejected by the pair-or-stacked-mark policy",
    },
    source: {
      package: "pdfmake",
      version: pdfmakePackage.version,
      vfsModule,
      parser: "@foliojs-fork/fontkit (pdfmake transitive dependency)",
      parserVersion: fontkitPackage.version,
    },
    fonts,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--check") || args.filter((argument) => argument === "--check").length > 1) {
    fail("usage: generate-report-graph-font-metrics.mjs [--check]");
  }
  const output = `${JSON.stringify(await generateMetrics(), null, 2)}\n`;
  if (args[0] === "--check") {
    let current;
    try {
      current = await readFile(outputPath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") fail(`${outputPath} does not exist; run the generator without --check`);
      throw error;
    }
    if (current !== output) fail(`${outputPath} is stale; run the generator without --check`);
    console.log(`verified ${outputPath}`);
    return;
  }
  await writeFile(outputPath, output, "utf8");
  console.log(`wrote ${outputPath}`);
}

await main();
