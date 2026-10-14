import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { CANOPY_SCENARIOS, CANOPY_UNAVAILABLE, CANOPY_SOURCES, buildCanopyPackage, canopySourceText } from "../app/canopy-fixture";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { buildStudioSourcePacket, prepareStudioSourcePacketDownload } from "../app/studio-source-packet";

for (const declaration of [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE]) for (const language of ["en", "ru"] as const) test(`complete source packet ${declaration.id} ${language}`, async () => {
  const draft = createExampleWorkingCopy(buildCanopyPackage(declaration.id, true).draft);
  const original = JSON.stringify(draft);
  const packet = buildStudioSourcePacket(draft, language);
  assert.equal(packet.manifest.selectedVersions.length, 9);
  assert.equal(new Set(packet.manifest.documents.map(source => source.id)).size, 9);
  assert.equal(packet.manifest.documents.length, 15);
  assert.equal(packet.manifest.selectedVersions.find(source => source.document === "D06")?.version, declaration.d06);
  assert.equal(packet.manifest.selectedVersions.find(source => source.document === "D03")?.version, declaration.d03);
  assert.equal(packet.manifest.documents.find(source => source.id === "D05")?.selected, true);
  for (const source of CANOPY_SOURCES) assert.ok(packet.markdown.includes(canopySourceText(source)));
  const output = await prepareStudioSourcePacketDownload(draft, language, "json", () => true);
  assert.ok(output);
  const manifest = JSON.parse(output.content);
  for (const source of manifest.documents) assert.equal(source.contentSha256, "sha256:" + createHash("sha256").update(source.text).digest("hex"));
  draft.nodes[0].detail += "\nMy amended hypothesis.";
  assert.equal(buildStudioSourcePacket(draft, language).manifest.sourceScenario.id, declaration.id);
  assert.equal(JSON.stringify({ ...draft, nodes: JSON.parse(original).nodes }), original);
});

test("packet rejects fabricated provenance and does not infer versions from a familiar title", () => {
  const draft = createExampleWorkingCopy(buildCanopyPackage("base", true).draft);
  draft.exampleSource!.fingerprint = "fabricated";
  assert.throws(() => buildStudioSourcePacket(draft, "en"), /No verified/);
  delete draft.exampleSource;
  assert.throws(() => buildStudioSourcePacket(draft, "en"), /No verified/);
});

test("deferred packet digest cannot produce an export after authority or context invalidation", async () => {
  const draft = createExampleWorkingCopy(buildCanopyPackage("base", true).draft);
  assert.equal(await prepareStudioSourcePacketDownload(draft, "en", "md", () => false), null);
  let checks = 0;
  assert.equal(await prepareStudioSourcePacketDownload(draft, "en", "json", () => ++checks === 1), null);
});
