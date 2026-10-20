import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

export const artifactHash = bytes => createHash("sha256").update(bytes).digest("hex");
const text = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\0.*$/s, "");
const octal = bytes => { const value = text(bytes).trim(); assert.match(value, /^[0-7]*$/, "Unsupported tar number"); return parseInt(value || "0", 8); };
function safeName(name) {
  assert.ok(name && !name.includes("\\") && !name.includes(":") && !/[\u0000-\u001f\u007f]/.test(name), "Unsafe artifact path");
  assert.ok(!name.startsWith("/") && name.split("/").every(part => part && part !== "." && part !== ".." && !/[\u0000-\u001f. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), "Unsafe artifact path");
  assert.ok(name === "dist" || name.startsWith("dist/"), "Artifact must contain only dist");
  return name;
}

/** Read original published gzip/GNU tar bytes; no rebuild or current-source fallback. */
export function inspectPublishedStudioArtifact(bytes, expected) {
  assert.equal(artifactHash(bytes), expected.rawArchiveSha256, "Published raw archive hash mismatch");
  assert.equal(bytes.length, expected.rawArchiveBytes, "Published raw archive size mismatch");
  const tar = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 160_000_000 }) : bytes;
  assert.ok(tar.length <= 160_000_000 && tar.length % 512 === 0, "Invalid tar size");
  const files = new Map(), seen = new Set(); let longName = null, offset = 0;
  while (offset + 512 <= tar.length && tar.subarray(offset, offset + 512).some(byte => byte !== 0)) {
    const header = tar.subarray(offset, offset + 512), checksum = octal(header.subarray(148, 156));
    assert.equal([...header].reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0), checksum, "Tar checksum mismatch");
    const size = octal(header.subarray(124, 136)), type = String.fromCharCode(header[156] || 48);
    offset += 512; assert.ok(size <= 80_000_000 && offset + size <= tar.length, "Truncated/oversized tar file");
    const body = tar.subarray(offset, offset + size); offset += Math.ceil(size / 512) * 512;
    if (type === "L") { assert.equal(longName, null, "Repeated GNU long-name header"); longName = text(body); continue; }
    const prefix = text(header.subarray(345, 500));
    const name = safeName((longName ?? (prefix ? prefix + "/" : "") + text(header.subarray(0, 100))).replace(/\/$/, "")); longName = null;
    assert.ok(type === "0" || type === "5", "Links and special tar entries are forbidden");
    assert.ok(!seen.has(name.toLowerCase()), "Duplicate artifact path"); seen.add(name.toLowerCase());
    if (type === "0") files.set(name, Buffer.from(body));
    else assert.equal(size, 0, "Directory cannot contain file data");
  }
  assert.equal(longName, null, "Orphan GNU long-name header");
  assert.ok(tar.subarray(offset).every(byte => byte === 0), "Unexpected trailing tar data");
  assert.equal(files.size, expected.nativeArchive.fileCount, "Native file count mismatch");
  const provenance = JSON.parse(files.get("dist/.openai/release-provenance.json")?.toString("utf8") ?? "null");
  assert.equal(provenance?.sourceCommit, expected.sourceCommit, "Published source mismatch");
  assert.equal(provenance?.applicationInputsSha256, expected.applicationInputsSha256, "Published application hash mismatch");
  assert.equal(provenance?.hostingConfigSha256, expected.hostingConfigSha256, "Published hosting hash mismatch");
  assert.ok(files.has("dist/server/index.js") && files.has("dist/client/.vite/manifest.json"), "Full Worker/client artifact required");
  return { files, receipt: { schema: "casevant.published-artifact-inspection.v1", siteVersion: expected.siteVersion,
    sourceCommit: expected.sourceCommit, savedVersionId: expected.savedVersionId, deploymentId: expected.deploymentId,
    rawArchiveSha256: artifactHash(bytes), rawArchiveBytes: bytes.length,
    originalTarSha256: artifactHash(tar), originalTarBytes: tar.length,
    nativeArchive: expected.nativeArchive, nativeNormalizationRecomputed: false,
    fileCount: files.size, workerEntrySha256: artifactHash(files.get("dist/server/index.js")),
    fileHashes: [...files].map(([path, content]) => ({ path, bytes: content.length, sha256: artifactHash(content) })),
    rebuilt: false, productionBindingsUsed: false } };
}

export function extractPublishedStudioArtifact(archivePath, expected, destination, workspace = process.cwd()) {
  const directory = resolve(destination), allowed = resolve(workspace, ".artifacts") + sep;
  assert.ok(directory.startsWith(allowed), "Extraction must stay inside workspace .artifacts");
  assert.ok(!existsSync(directory), "Never overwrite an existing artifact environment");
  const inspected = inspectPublishedStudioArtifact(readFileSync(archivePath), expected);
  // Inspect every entry before creating any output. Original archive stays untouched.
  mkdirSync(directory, { recursive: true });
  for (const [path, bytes] of inspected.files) {
    const target = resolve(directory, path); assert.ok(target.startsWith(directory + sep));
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: "wx" });
  }
  writeFileSync(resolve(directory, "artifact-inspection.json"), JSON.stringify(inspected.receipt, null, 2) + "\n", { flag: "wx" });
  return inspected.receipt;
}
