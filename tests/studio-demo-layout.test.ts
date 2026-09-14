import test from "node:test";
import assert from "node:assert/strict";
import { layoutStudioNodes } from "../app/studio-layout";
import { buildCanopyPackage, CANOPY_SCENARIOS } from "../app/canopy-fixture";

test("demo entry produces independent Canopy drafts with a downward decision flow", () => {
  for (const declaration of CANOPY_SCENARIOS) {
    const first = buildCanopyPackage(declaration.id, true);
    const second = buildCanopyPackage(declaration.id, true);
    assert.equal(first.draft.parent, null);
    assert.ok(first.scenario.stages.length > 0);
    const original = JSON.stringify(second.draft);
    const nodes = layoutStudioNodes(first.draft.nodes, first.draft.links, "vertical");
    const positions = new Map(nodes.map((node) => [node.id, node]));
    for (const link of first.draft.links) {
      const from = positions.get(link.from);
      const to = positions.get(link.to);
      assert.ok(from && to, "every relation keeps its endpoints");
      assert.ok(to.y > from.y, declaration.id + ": every relation progresses downward");
    }
    first.draft.nodes[0].title = "Edited working copy";
    assert.equal(JSON.stringify(second.draft), original, "editing a demo copy does not change the next opening");
  }
});

test("view-only portrait layout preserves the protected source and its node identities", () => {
  const source = buildCanopyPackage("base", true).draft;
  const before = JSON.stringify(source);
  const displayed = layoutStudioNodes(source.nodes, source.links, "vertical");
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(displayed.map((node) => node.id), source.nodes.map((node) => node.id));
  assert.notEqual(displayed[0], source.nodes[0]);
});
