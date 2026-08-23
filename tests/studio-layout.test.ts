import assert from "node:assert/strict";
import test from "node:test";
import { layoutStudioNodes, studioGraphBounds, studioNodeEstimatedHeight, studioNodesOverlap } from "../app/studio-layout";
import type { StudioLink, StudioNode } from "../app/types";

test("layered Studio layout is deterministic and collision-free for a populated graph", () => {
  const nodes: StudioNode[] = Array.from({ length: 27 }, (_, index) => ({
    id: `fact-${index + 1}`, type: "fact", title: `Node ${index + 1}`, detail: "", x: 400, y: 240,
  }));
  const links: StudioLink[] = [
    ...Array.from({ length: 8 }, (_, index) => ({ id: `link-${index + 1}`, from: nodes[0].id, to: nodes[index + 1].id })),
    ...Array.from({ length: 9 }, (_, index) => ({ id: `link-${index + 9}`, from: nodes[index + 1].id, to: nodes[index + 9].id })),
    ...Array.from({ length: 9 }, (_, index) => ({ id: `link-${index + 18}`, from: nodes[index + 9].id, to: nodes[index + 18].id })),
  ];
  const first = layoutStudioNodes(nodes, links);
  const second = layoutStudioNodes(nodes, links);
  assert.deepEqual(first, second);
  for (let left = 0; left < first.length; left += 1) {
    for (let right = left + 1; right < first.length; right += 1) assert.equal(studioNodesOverlap(first[left], first[right]), false, `${first[left].id} overlaps ${first[right].id}`);
  }
  const byId = new Map(first.map((node) => [node.id, node]));
  for (const link of links) assert.ok((byId.get(link.to)?.x ?? 0) > (byId.get(link.from)?.x ?? 0), `${link.id} must flow left to right`);
  const bounds = studioGraphBounds(first);
  assert.ok(bounds.width >= Math.max(...first.map((node) => node.x + 165)));
  assert.ok(bounds.height >= Math.max(...first.map((node) => node.y + 96)));
});

test("cyclic repair state still receives unique non-overlapping slots", () => {
  const nodes: StudioNode[] = [
    { id: "fact-1", type: "fact", title: "One", detail: "", x: 1, y: 1 },
    { id: "fact-2", type: "fact", title: "Two", detail: "", x: 1, y: 1 },
    { id: "fact-3", type: "fact", title: "Three", detail: "", x: 1, y: 1 },
  ];
  const links: StudioLink[] = [
    { id: "link-1", from: "fact-1", to: "fact-2" },
    { id: "link-2", from: "fact-2", to: "fact-1" },
  ];
  const laidOut = layoutStudioNodes(nodes, links);
  assert.equal(studioNodesOverlap(laidOut[0], laidOut[1]), false);
  assert.equal(studioNodesOverlap(laidOut[1], laidOut[2]), false);
});

test("layout reserves real vertical space for wrapped titles and runtime summaries", () => {
  const longTitle = "Commission the three-country legal and tax work across every reviewed ownership vehicle";
  const nodes: StudioNode[] = Array.from({ length: 8 }, (_, index) => ({
    id: `decision-${index + 1}`, type: "decision", title: `${longTitle} ${index + 1}`, detail: "", x: 0, y: 0,
    runtime: index % 2 === 0 ? { budgetCostEur: 12_000, durationMinutes: 1_440 } : undefined,
  }));
  const laidOut = layoutStudioNodes(nodes, []);
  assert.ok(studioNodeEstimatedHeight(laidOut[0]) > 96);
  for (let left = 0; left < laidOut.length; left += 1) {
    for (let right = left + 1; right < laidOut.length; right += 1) assert.equal(studioNodesOverlap(laidOut[left], laidOut[right]), false);
  }
  assert.ok(Math.min(...laidOut.map((node) => node.y)) >= 70, "the first row retains a visible top gutter");
});

test("disconnected subgraphs receive separate vertical bands", () => {
  const nodes: StudioNode[] = [
    { id: "trigger-1", type: "trigger", title: "First component", detail: "", x: 0, y: 0 },
    { id: "outcome-1", type: "outcome", title: "First result", detail: "", x: 0, y: 0 },
    { id: "trigger-2", type: "trigger", title: "Second component", detail: "", x: 0, y: 0 },
    { id: "outcome-2", type: "outcome", title: "Second result", detail: "", x: 0, y: 0 },
  ];
  const links: StudioLink[] = [
    { id: "link-1", from: "trigger-1", to: "outcome-1" },
    { id: "link-2", from: "trigger-2", to: "outcome-2" },
  ];
  const laidOut = layoutStudioNodes(nodes, links);
  const byId = new Map(laidOut.map((node) => [node.id, node]));
  const firstBottom = Math.max(byId.get("trigger-1")!.y + studioNodeEstimatedHeight(byId.get("trigger-1")), byId.get("outcome-1")!.y + studioNodeEstimatedHeight(byId.get("outcome-1")));
  const secondTop = Math.min(byId.get("trigger-2")!.y, byId.get("outcome-2")!.y);
  assert.ok(secondTop - firstBottom >= 100, "components should be visibly separated rather than interleaved");
});
