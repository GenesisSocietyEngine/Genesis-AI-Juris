import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { artifactHash, inspectPublishedStudioArtifact, extractPublishedStudioArtifact } from "../scripts/lib/published-studio-artifact.mjs";

const provenance = { sourceCommit: "a".repeat(40), applicationInputsSha256: "b".repeat(64), hostingConfigSha256: "c".repeat(64) };
function header(name: string, body: Buffer, type = "0") {
  const h = Buffer.alloc(512); h.write(name, 0, 100); h.write("0000644\0", 100); h.write(body.length.toString(8).padStart(11, "0") + "\0", 124); h.fill(32, 148, 156); h.write(type, 156); h.write("ustar\0", 257);
  const sum = [...h].reduce((a, b) => a + b, 0); h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return Buffer.concat([h, body, Buffer.alloc((512 - body.length % 512) % 512)]);
}
function fixture(extra: Array<[string, string, string?]> = []) {
  const entries: Array<[string, string, string?]> = [["dist/.openai/release-provenance.json", JSON.stringify(provenance)], ["dist/server/index.js", "export default {fetch(){return new Response('synthetic')}}"], ["dist/client/.vite/manifest.json", "{}"], ...extra];
  const tar = Buffer.concat([...entries.map(([path, text, type]) => header(path, Buffer.from(text), type)), Buffer.alloc(1024)]), bytes = gzipSync(tar);
  const expected = { ...provenance, siteVersion: 149, savedVersionId: "synthetic-native-version", deploymentId: "synthetic-deployment", rawArchiveSha256: artifactHash(bytes), rawArchiveBytes: bytes.length, nativeArchive: { fileCount: entries.length } };
  return { bytes, expected };
}
test("published inspector preserves all original executable bytes and keeps archive representations distinct", () => {
  const f = fixture(), result = inspectPublishedStudioArtifact(f.bytes, f.expected);
  assert.equal(result.files.size, 3); assert.equal(result.receipt.rebuilt, false); assert.equal(result.receipt.nativeNormalizationRecomputed, false);
  assert.notEqual(result.receipt.rawArchiveSha256, result.receipt.originalTarSha256);
  assert.equal(result.receipt.workerEntrySha256, artifactHash(result.files.get("dist/server/index.js")!));
  assert.throws(() => inspectPublishedStudioArtifact(f.bytes, { ...f.expected, rawArchiveSha256: "d".repeat(64) }), /hash mismatch/);
  assert.throws(() => inspectPublishedStudioArtifact(f.bytes, { ...f.expected, sourceCommit: "d".repeat(40) }), /source mismatch/);
});
test("published inspector rejects traversal, NTFS aliases, duplicates, links and truncated/checksum-invalid archives before extraction", () => {
  for (const path of ["../outside", "/dist/absolute", "dist/../outside", "dist/CON", "dist/file:stream", "dist/file.", "dist/server/index.js", "dist/SERVER/index.js"]) {
    const f = fixture([[path, "unsafe"]]); assert.throws(() => inspectPublishedStudioArtifact(f.bytes, f.expected), /Unsafe|Duplicate|only dist/);
  }
  const link = fixture([["dist/link", "", "2"]]); assert.throws(() => inspectPublishedStudioArtifact(link.bytes, link.expected), /special tar/);
  const f = fixture(), bad = Buffer.from(f.bytes); bad[bad.length - 5] ^= 1;
  assert.throws(() => inspectPublishedStudioArtifact(bad, { ...f.expected, rawArchiveSha256: artifactHash(bad) }));
});
test("extraction is confined to a fresh workspace artifact directory and never overwrites an earlier run", () => {
  mkdirSync(".artifacts", { recursive: true }); const root = mkdtempSync(resolve(".artifacts/published-inspector-test-"));
  const f = fixture(), archive = join(root, "original.gz"), output = join(root, "inspected"); writeFileSync(archive, f.bytes);
  extractPublishedStudioArtifact(archive, f.expected, output);
  const before = readFileSync(join(output, "dist/server/index.js"));
  assert.throws(() => extractPublishedStudioArtifact(archive, f.expected, output), /Never overwrite/); assert.deepEqual(readFileSync(join(output, "dist/server/index.js")), before);
  assert.throws(() => extractPublishedStudioArtifact(archive, f.expected, resolve("unsafe-output")), /inside workspace/); assert.equal(existsSync(resolve("unsafe-output")), false);
  assert.equal(artifactHash(readFileSync(archive)), f.expected.rawArchiveSha256);
});
