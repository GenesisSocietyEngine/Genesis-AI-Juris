import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import { compileStudioDraft } from "../app/studio-compiler";
import { STUDIO_NODE_MENU_PAGE_SIZE, studioNodeMenuOptions, studioNodeMenuPage } from "../app/studio-node-menu";
import type { StudioDraft, StudioNode } from "../app/types";

function nodes(count: number): StudioNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "trigger-1" : index === count - 1 ? "outcome-1" : `decision-${index}`,
    type: index === 0 ? "trigger" : index === count - 1 ? "outcome" : "decision",
    title: `Node ${String(index + 1).padStart(3, "0")}`,
    detail: `Pilot graph step ${index + 1}.`,
    x: (index % 10) * 210,
    y: Math.floor(index / 10) * 110,
  }));
}

function maxPilotDraft(): StudioDraft {
  const graphNodes = nodes(200);
  return {
    caseId: "max_pilot_graph",
    version: "1.0.0",
    parent: null,
    title: "Maximum pilot graph",
    jurisdiction: "EU",
    role: "Counsel",
    premise: "A bounded graph used to exercise the Studio pilot envelope.",
    classification: { domain: "general", practiceArea: "General legal", difficulty: "Advanced", tags: [], taxTopics: [], complianceOnly: true, purpose: "compliance_review", legalAsOf: "", sourceUrls: [] },
    nodes: graphNodes,
    links: graphNodes.slice(0, -1).map((node, index) => ({ id: `link-${index + 1}`, from: node.id, to: graphNodes[index + 1].id })),
    editHistory: [],
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}

test("node endpoint menus stay DOM-bounded while search and paging expose every pilot node", () => {
  const graphNodes = nodes(200);
  const byId = new Map(graphNodes.map((node) => [node.id, node]));
  const allIds = new Set<string>();
  const first = studioNodeMenuPage(graphNodes, "", 0);
  assert.equal(first.nodes.length, STUDIO_NODE_MENU_PAGE_SIZE);
  assert.equal(first.pageCount, Math.ceil(200 / STUDIO_NODE_MENU_PAGE_SIZE));
  for (let page = 0; page < first.pageCount; page += 1) {
    for (const node of studioNodeMenuPage(graphNodes, "", page).nodes) allIds.add(node.id);
  }
  assert.equal(allIds.size, 200, "paging must preserve access to every endpoint");

  const pinned = studioNodeMenuOptions(first.nodes, byId, "outcome-1");
  assert.equal(pinned[0].id, "outcome-1");
  assert.ok(pinned.length <= STUDIO_NODE_MENU_PAGE_SIZE + 1);
  assert.equal(studioNodeMenuPage(graphNodes, "Node 173", 0).nodes[0].title, "Node 173");
  assert.equal(studioNodeMenuPage(graphNodes, "decision-172", 0).nodes[0].id, "decision-172");
});

test("the maximum 200-node pilot graph compiles with the exact supplied fingerprint", () => {
  const draft = maxPilotDraft();
  const fingerprint = caseFingerprint(draft);
  const result = compileStudioDraft(draft, fingerprint);
  assert.deepEqual(result.issues, []);
  assert.equal(result.scenario?.stages.length, 200);
  assert.equal(result.scenario?.stages.reduce((sum, stage) => sum + stage.options.length, 0), 199);
  assert.equal(result.scenario?.sourceFingerprint, fingerprint);
});

test("Studio schedules heavy derivations for idle time and never renders all endpoint options", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(source, /requestIdleCallback\(derive, \{ timeout: 700 \}\)/);
  assert.match(source, /watchdogHandle = window\.setTimeout\(derive, 1_000\)/, "busy browsers cannot strand validation waiting for idle time");
  assert.match(source, /else watchdogHandle = globalThis\.setTimeout\(derive, 0\)/, "non-idle-callback browsers retain an immediate fallback");
  assert.match(source, /\}, \[derivationAttempt, draft\]\);/, "derivation state updates must not cancel their own completed request");
  assert.match(source, /setDerivationAttempt\(\(attempt\) => attempt \+ 1\)/, "a failed calculation exposes a bounded manual retry");
  assert.doesNotMatch(source, /useMemo\(\(\) => compileStudioDraft/);
  assert.doesNotMatch(source, /<code>\{caseFingerprint\(draft\)\}<\/code>/);
  assert.match(source, /studioNodeMenuOptions\(relationNodeMenu\.nodes,nodeById,link\.to\)/);
  assert.match(source, /destinationNodeMenu\.nodes\.map/);
});
