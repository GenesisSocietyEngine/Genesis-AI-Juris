import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { buildConvertedExample } from "../app/converted-examples";
import { studioMaterials, studioMaterialsArchive } from "../app/studio-materials";
import { rearrangeStudioEvidence, deleteStudioNodeKeepingEvidence } from "../app/studio-evidence-operations";
import { studioReviewAction } from "../app/studio-review-action";
import { normalizeStudioDraft } from "../app/case-integrity";

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

test("evidence connection IDs fit the saved contract and conflicting rules are never silently merged", () => {
  const draft = buildCanopyPackage("base").draft;
  const evidence = draft.nodes.find(node => node.type === "evidence")!, first = draft.nodes.find(node => node.type === "decision")!, other = draft.nodes.find(node => node.type === "outcome")!;
  evidence.id = "e".repeat(80); first.id = "d".repeat(80); other.id = "o".repeat(80);
  draft.links = [];
  const added = rearrangeStudioEvidence(draft, [evidence.id], null, first.id);
  assert.match(added.links[0].id, /^[a-z0-9][a-z0-9_-]{0,79}$/);
  assert.doesNotThrow(() => normalizeStudioDraft(added));
  const connected = rearrangeStudioEvidence(added, [evidence.id], null, other.id), before = JSON.stringify(connected);
  assert.throws(() => rearrangeStudioEvidence(connected, [evidence.id], first.id, other.id), /evidence-destination-conflict/);
  assert.throws(() => deleteStudioNodeKeepingEvidence(connected, first.id, other.id), /evidence-destination-conflict/);
  assert.equal(JSON.stringify(connected), before);
  const deadline = { ...draft.nodes[0], id:"deadline_test", type:"deadline" as const, runtime:{missedOutcomeNodeId:other.id} };
  assert.throws(() => deleteStudioNodeKeepingEvidence({...connected,nodes:[...connected.nodes,deadline]},other.id,null), /deadline-fallback-in-use/);
});

test("evidence operations retain complete tax and approval carrier references", () => {
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/fiveflats-rent-146000.studio-draft.json',import.meta.url),'utf8'));
 const base=buildCanopyPackage('base').draft;
 const draft={...base,taxEconomics:fixture.taxEconomics,taxAnalysis:{format:'genesis-juris-tax-attachment' as const,carrierVersion:1 as const,document:' {"exact":"historical bytes","approval":"unreviewed"} \r\n'}};
 const evidence=draft.nodes.find(node=>node.type==='evidence')!, target=draft.nodes.find(node=>node.type==='outcome')!;
 const next=rearrangeStudioEvidence(draft,[evidence.id],null,target.id);
 assert.equal(next.taxAnalysis,draft.taxAnalysis);assert.equal(next.taxEconomics,draft.taxEconomics);
 assert.equal(next.taxAnalysis.document,draft.taxAnalysis.document);
});

test("multiple evidence records move together and a conflict rejects the whole batch", () => {
  const draft=buildCanopyPackage("base").draft, first=draft.nodes.find(node=>node.type==="decision")!, target=draft.nodes.find(node=>node.type==="outcome")!, evidence=draft.nodes.find(node=>node.type==="evidence")!;
  const second={...evidence,id:"evidence_second",detail:"Exact second working record\nNo acceptance inferred."};
  draft.nodes=[...draft.nodes,second];
  draft.links=[{id:"batch_a",from:evidence.id,to:first.id,rule:{detail:"Retain A"}},{id:"batch_b",from:second.id,to:first.id,rule:{detail:"Retain B"}}];
  const before=JSON.stringify(draft), ids=[evidence.id,second.id];
  const next=rearrangeStudioEvidence(draft,ids,first.id,target.id);
  assert.deepEqual(next.links,draft.links.map(link=>({...link,to:target.id})));
  assert.equal(next.nodes,draft.nodes);assert.equal(JSON.stringify(draft),before);
  const conflicting={...draft,links:[...draft.links,{id:"existing",from:second.id,to:target.id,rule:{detail:"Independent existing details"}}]}, bytes=JSON.stringify(conflicting);
  assert.throws(()=>rearrangeStudioEvidence(conflicting,ids,first.id,target.id),/evidence-destination-conflict/);
  assert.equal(JSON.stringify(conflicting),bytes);
});
