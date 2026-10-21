import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { buildConvertedExample } from "../app/converted-examples";
import { buildExampleProvenance } from "../app/example-provenance";
import { buildStudioSourcePacket } from "../app/studio-source-packet";
import { fixture } from "./helpers/tax-report-fixture";
import { preparePublishedStudioFixture } from "../scripts/lib/published-studio-fixtures";

test("published QA keeps historical source references while preparing independent manual placement", async () => {
  const original = buildConvertedExample("be_commercial_failed_erp_001", "en", "2026-10-20T10:00:00Z", "2.2.0");
  const before = structuredClone(original);
  const prepared = await preparePublishedStudioFixture(original, "erp-2.2-en");
  assert.equal(prepared.caseId, "qa_original_v149_erp_2_2_en");
  assert.match(prepared.title, /^SYNTHETIC original v149 QA/);
  assert.ok(prepared.exampleSource);
  assert.equal(prepared.exampleSource.caseId, original.caseId);
  assert.equal(prepared.exampleSource.version, "2.2.0");
  assert.equal((await buildExampleProvenance(prepared))?.source.version, "2.2.0");
  assert.deepEqual(prepared.nodes[0].mapPosition, { x: 413, y: 14003 });
  assert.deepEqual(original, before);
});

test("renamed Canopy input keeps its inspectable nine-document source packet", async () => {
  const original = buildCanopyPackage("base").draft;
  const prepared = await preparePublishedStudioFixture(original, "canopy-base-en");
  const packet = buildStudioSourcePacket(prepared, "en");
  assert.equal(packet.manifest.selectedVersions.length, 9);
  assert.equal(packet.manifest.case.exampleSource?.caseId, original.caseId);
});

test("full-tax published input retains the whole bound draft and exact carrier text", async () => {
  const original = fixture().draft;
  const before = structuredClone(original);
  const prepared = await preparePublishedStudioFixture(original, "full-tax-en");
  assert.deepEqual(prepared, before);
  assert.equal(prepared.taxAnalysis?.document, before.taxAnalysis?.document);
  assert.notEqual(prepared, original);
  assert.deepEqual(original, before);
});

test("published QA refuses the previously generated stale binding without rebinding or mutating it", async () => {
  for (const mutate of [
    (draft: ReturnType<typeof fixture>["draft"]) => { draft.caseId = "qa_original_v149_full_tax_en"; },
    (draft: ReturnType<typeof fixture>["draft"]) => { draft.title = "SYNTHETIC renamed tax source"; },
    (draft: ReturnType<typeof fixture>["draft"]) => { draft.nodes[0].mapPosition = { x: 413, y: 14003 }; },
  ]) {
    const draft = fixture().draft;
    mutate(draft);
    const before = structuredClone(draft);
    await assert.rejects(preparePublishedStudioFixture(draft, "full-tax-en"), /exact bound source/);
    assert.deepEqual(draft, before);
  }
});

test("published QA refuses unsupported carriers and invalid labels without changing originals", async () => {
  const draft = fixture().draft;
  Object.assign(draft.taxAnalysis!, { carrierVersion: 99 });
  const before = structuredClone(draft);
  await assert.rejects(preparePublishedStudioFixture(draft, "full-tax-en"), /requires recovery/);
  assert.deepEqual(draft, before);
  const canopy = buildCanopyPackage("base").draft;
  await assert.rejects(preparePublishedStudioFixture(canopy, "../unsafe"), /Invalid local fixture label/);
});

test("unknown source fields refuse before the working-copy normalizer can discard them", async () => {
  const draft = buildCanopyPackage("base").draft;
  Object.assign(draft, { futureExact: "retained synthetic unknown field" });
  const before = structuredClone(draft);
  await assert.rejects(preparePublishedStudioFixture(draft, "canopy-base-en"), /Invalid source fixture/);
  assert.deepEqual(draft, before);
});
