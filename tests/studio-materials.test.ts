import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { buildConvertedExample } from "../app/converted-examples";
import { studioMaterials, studioMaterialsArchive } from "../app/studio-materials";
import { rearrangeStudioEvidence, deleteStudioNodeKeepingEvidence } from "../app/studio-evidence-operations";
import { studioReviewAction } from "../app/studio-review-action";

test("Canopy archives contain all immutable versions, exact file hashes and no invented binary originals", async () => {
  const draft = buildCanopyPackage("base").draft, before = JSON.stringify(draft);
  const materials = await studioMaterials(draft, "en");
  assert.equal(materials.filter(item => item.kind === "reference").length, 15);
  assert.equal(materials.filter(item => item.kind === "reference" && item.selected).length, 9);
  const archive = await studioMaterialsArchive(draft, materials, () => true); assert.ok(archive);
  const files = unzipSync(archive), manifest = JSON.parse(strFromU8(files["manifest.json"]));
  for (const entry of manifest.entries) if (entry.filename) {
    assert.match(entry.filename, /^\d+-[A-Za-z0-9_-]+\.txt$/);
    assert.equal(entry.contentSha256, "sha256:" + createHash("sha256").update(files[entry.filename]).digest("hex"));
    assert.equal(strFromU8(files[entry.filename]), materials.find(item => item.id === entry.id)!.text);
  }
  assert.equal(JSON.stringify(draft), before);
  assert.equal(await studioMaterialsArchive(draft, materials, () => false), null);
  let reads = 0; assert.equal(await studioMaterialsArchive(draft, materials, () => ++reads === 1), null);
});

for (const id of ["be_commercial_failed_erp_001", "greenfire_first_72_hours", "be_commercial_logistics_001", "nl_food_safety_goldenshell_001", "us_environmental_desert_water_001"]) test(`${id}: available correspondence and missing documents remain distinct`, async () => {
  const draft = buildConvertedExample(id, "en"), materials = await studioMaterials(draft, "en");
  assert.ok(materials.some(item => item.kind === "missing"));
  for (const item of materials.filter(item => item.kind === "missing")) assert.equal(item.text, null);
  const unknown = { ...draft, exampleSource: undefined, version: "99.0.0" };
  assert.equal((await studioMaterials(unknown, "en")).filter(item => item.kind === "reference").length, 0);
});

test("bulk reattachment and node deletion retain evidence bytes and rule carriers without mutating input", () => {
  const draft = buildCanopyPackage("base").draft;
  const evidence = draft.nodes.find(node => node.type === "evidence")!, first = draft.nodes.find(node => node.type === "decision")!, other = draft.nodes.find(node => node.type === "outcome")!;
  draft.links = [{ id: "retained_rule", from: evidence.id, to: first.id, rule: {detail: "retain exactly", cost: 42, guards: [], effects: { exposure: 1 } } }];
  const before = JSON.stringify(draft), next = rearrangeStudioEvidence(draft, [evidence.id], first.id, other.id);
  assert.deepEqual(next.links[0], { ...draft.links[0], to: other.id });
  assert.equal(next.nodes, draft.nodes);
  assert.deepEqual(rearrangeStudioEvidence(next, [evidence.id], other.id, null).links, []);
  const removed = deleteStudioNodeKeepingEvidence(draft, first.id, other.id);
  assert.deepEqual(removed.links, next.links); assert.ok(!removed.nodes.some(node => node.id === first.id));
  assert.deepEqual(removed.nodes.find(node => node.id === evidence.id), evidence);
  const disconnected = deleteStudioNodeKeepingEvidence(draft, evidence.id, null);
  assert.equal(disconnected.nodes, draft.nodes); assert.equal(disconnected.links.length, 0);
  assert.equal(JSON.stringify(draft), before);
  assert.throws(() => rearrangeStudioEvidence(draft, [first.id], null, other.id));
  assert.throws(() => deleteStudioNodeKeepingEvidence(draft, first.id, first.id));
});

test("review controls use exact affected nodes and route-start correction before generic routing", () => {
  const draft = buildCanopyPackage("base").draft, id = draft.nodes[2].id;
  assert.deepEqual(studioReviewAction(draft, {level:"warn", text:"orphan", nodeIds:[id]}), {step:4,id:`studio-node-${id}`,nodeId:id});
  assert.deepEqual(studioReviewAction(draft, {level:"warn", text:"start", missingStart:true}), {step:3,id:"studio-evidence-composer",nodeType:"trigger"});
});
