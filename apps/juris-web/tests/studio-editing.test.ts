import assert from "node:assert/strict";
import test from "node:test";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { addStudioLink, appendStudioHistory, applyStudioPromptIteration, deleteStudioLink, relinkStudioLink, STUDIO_HISTORY_LIMIT, toPublicStudioDraft } from "../app/studio-editing";
import type { StudioDraft, StudioEditEntry, StudioLink, StudioNodeType } from "../app/types";

const at = "2026-08-21T12:00:00.000Z";
const visualHistory = (message: string) => ({ role: "studio" as const, source: "visual" as const, action: "link_added" as const, message });
const nodeLabels: Record<StudioNodeType, string> = { trigger: "Trigger", actor: "Actor", fact: "Fact", evidence: "Evidence", deadline: "Deadline", decision: "Decision", outcome: "Outcome", entity: "Entity", tax_rule: "Tax rule", cash_flow: "Cash flow" };

function studioDraft(): StudioDraft {
  return {
    caseId: "editor_graph_test",
    version: "1.0.0",
    parent: null,
    title: "Editor graph test",
    jurisdiction: "Belgium",
    role: "Counsel",
    premise: "Test direct graph editing.",
    classification: { domain: "general", practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true, purpose: "compliance_review", legalAsOf: "", sourceUrls: [] },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Trigger", detail: "", x: 10, y: 10 },
      { id: "actor-1", type: "actor", title: "Actor", detail: "", x: 210, y: 10 },
      { id: "decision-1", type: "decision", title: "Decision", detail: "", x: 410, y: 10 },
      { id: "evidence-1", type: "evidence", title: "Evidence", detail: "", x: 210, y: 160 },
      { id: "outcome-1", type: "outcome", title: "Outcome A", detail: "", x: 610, y: 10 },
      { id: "outcome-2", type: "outcome", title: "Outcome B", detail: "", x: 610, y: 160 },
    ],
    links: [{ id: "link-1", from: "trigger-1", to: "actor-1" }],
    editHistory: [],
    updatedAt: at,
  };
}

test("direct relation add validates atomically and records exactly one visual turn", () => {
  const base = studioDraft();
  const result = addStudioLink(base, { id: "link-2", from: "actor-1", to: "decision-1" }, visualHistory("Created Actor → Decision."), at);
  assert.equal(result.changed, true);
  assert.equal(result.draft.links.length, 2);
  assert.equal(result.draft.editHistory.length, 1);
  assert.equal(result.draft.editHistory[0].message, "Created Actor → Decision.");
  assert.equal(base.links.length, 1, "the source draft stays immutable");

  for (const [link, issue] of [
    [{ id: "link-3", from: "actor-1", to: "actor-1" }, "self_link"],
    [{ id: "link-3", from: "trigger-1", to: "actor-1" }, "duplicate_link"],
    [{ id: "link-3", from: "missing", to: "actor-1" }, "missing_endpoint"],
    [{ id: "INVALID ID", from: "actor-1", to: "decision-1" }, "invalid_link_id"],
  ] as Array<[StudioLink, string]>) {
    const invalid = addStudioLink(base, link, visualHistory("Must not be stored."), at);
    assert.equal(invalid.changed, false);
    assert.equal(invalid.issue, issue);
    assert.equal(invalid.draft, base);
    assert.equal(invalid.draft.editHistory.length, 0);
  }

  const saturated = { ...base, links: Array.from({ length: 500 }, (_, index) => ({ id: `link-${index + 1}`, from: "trigger-1", to: "actor-1" })) };
  const limited = addStudioLink(saturated, { id: "link-501", from: "actor-1", to: "decision-1" }, visualHistory("Must not be stored."), at);
  assert.equal(limited.changed, false);
  assert.equal(limited.issue, "link_limit");
  assert.equal(limited.draft.editHistory.length, 0);
});

test("relink preserves stable identity, rejects collisions, and delete targets the exact relation", () => {
  const base = { ...studioDraft(), links: [
    { id: "link-1", from: "trigger-1", to: "actor-1" },
    { id: "link-2", from: "actor-1", to: "decision-1" },
  ] };
  const relinked = relinkStudioLink(base, base.links[1], { id: "attempted-new-id", from: "evidence-1", to: "decision-1" }, { ...visualHistory("Relinked Evidence → Decision."), action: "link_relinked" }, at);
  assert.equal(relinked.changed, true);
  assert.deepEqual(relinked.draft.links[1], { id: "link-2", from: "evidence-1", to: "decision-1" });
  assert.equal(relinked.draft.editHistory.length, 1);

  const duplicate = relinkStudioLink(base, base.links[1], { ...base.links[1], from: "trigger-1", to: "actor-1" }, { ...visualHistory("No."), action: "link_relinked" }, at);
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.issue, "duplicate_link");
  assert.deepEqual(duplicate.draft.links, base.links);
  assert.equal(duplicate.draft.editHistory.length, 0);

  const self = relinkStudioLink(base, base.links[1], { ...base.links[1], from: "decision-1", to: "decision-1" }, { ...visualHistory("No."), action: "link_relinked" }, at);
  assert.equal(self.changed, false);
  assert.equal(self.issue, "self_link");

  const deleted = deleteStudioLink(relinked.draft, relinked.draft.links[1], { ...visualHistory("Deleted Evidence → Decision."), action: "link_deleted" }, at);
  assert.equal(deleted.changed, true);
  assert.deepEqual(deleted.draft.links, [{ id: "link-1", from: "trigger-1", to: "actor-1" }]);
  assert.equal(deleted.draft.editHistory.length, 2);
});

test("history compaction is explicit, bounded and keeps unique IDs", () => {
  const seed: StudioEditEntry[] = Array.from({ length: STUDIO_HISTORY_LIMIT }, (_, index) => ({
    id: `edit-seed-${index + 1}`,
    role: "studio",
    source: "visual",
    action: "node_updated",
    message: `Edit ${index + 1}`,
    createdAt: at,
  }));
  const compacted = appendStudioHistory({ ...studioDraft(), editHistory: seed }, { role: "studio", source: "visual", action: "node_added", message: "Added a node." }, at);
  assert.equal(compacted.editHistory.length, STUDIO_HISTORY_LIMIT);
  assert.equal(compacted.editHistory[0].action, "history_compacted");
  assert.equal(new Set(compacted.editHistory.map((entry) => entry.id)).size, STUDIO_HISTORY_LIMIT);
  assert.throws(() => appendStudioHistory(studioDraft(), { role: "studio", source: "visual", action: "node_added", message: "   " }, at), /cannot be empty/i);
});

test("iterative prompt appends turns and graph operations without replacing manual work or lineage", () => {
  const base = appendStudioHistory({
    ...studioDraft(),
    version: "2.4.1",
    parent: { caseId: "editor_graph_test", version: "2.4.0", fingerprint: `sha256-${"a".repeat(64)}` },
    nodes: studioDraft().nodes.map((node) => node.id === "actor-1" ? { ...node, x: 333, title: "Manually renamed actor" } : node),
  }, { role: "studio", source: "visual", action: "node_updated", message: "Visual edit: renamed the actor." }, at);
  const beforeNodes = structuredClone(base.nodes);
  const beforeLinks = structuredClone(base.links);
  const result = applyStudioPromptIteration(base, {
    instruction: "Add a deadline and connect actor-1 to decision-1.",
    locale: "en",
    nodeLabels,
    selectedNodeId: "actor-1",
    createdAt: "2026-08-21T12:01:00.000Z",
  });
  assert.equal(result.changed, true);
  assert.equal(result.draft.caseId, base.caseId);
  assert.equal(result.draft.version, "2.4.1");
  assert.deepEqual(result.draft.parent, base.parent);
  assert.deepEqual(result.draft.nodes.slice(0, beforeNodes.length), beforeNodes);
  assert.deepEqual(result.draft.links.slice(0, beforeLinks.length), beforeLinks);
  assert.equal(result.draft.nodes.find((node) => node.id === "actor-1")?.x, 333);
  assert.equal(result.addedNodeIds.length, 1);
  assert.equal(result.draft.nodes.at(-1)?.type, "deadline");
  assert.equal(result.addedLinkIds.length, 1);
  assert.deepEqual(result.draft.links.at(-1), { id: "link-2", from: "actor-1", to: "decision-1" });
  assert.deepEqual(result.draft.editHistory.map((entry) => entry.action), ["node_updated", "prompt_submitted", "prompt_applied"]);
  assert.equal(result.draft.premise, base.premise, "editing commands stay in prompt history instead of leaking into the playable premise");
  assert.match(result.draft.editHistory.find((entry) => entry.action === "prompt_submitted")?.message ?? "", /Add a deadline/);

  const blank = applyStudioPromptIteration(result.draft, { instruction: "   ", locale: "en", nodeLabels, createdAt: at });
  assert.equal(blank.changed, false);
  assert.equal(blank.draft, result.draft);
});

test("legacy links receive deterministic IDs while history stays private and non-normative", () => {
  const base = studioDraft();
  const raw = structuredClone(base) as unknown as Record<string, unknown>;
  raw.links = [{ from: "trigger-1", to: "actor-1" }];
  delete raw.editHistory;
  const normalized = normalizeStudioDraft(raw);
  assert.deepEqual(normalized.links, [{ id: "link-1", from: "trigger-1", to: "actor-1" }]);
  assert.deepEqual(normalized.editHistory, []);

  const withHistory = appendStudioHistory(base, { role: "author", source: "prompt", action: "prompt_submitted", message: "Add a deadline." }, at);
  assert.equal(caseFingerprint(withHistory), caseFingerprint(base), "authoring history does not alter the content fingerprint");
  const publicDraft = toPublicStudioDraft(withHistory);
  assert.equal("editHistory" in publicDraft, false);
  assert.equal(withHistory.editHistory.length, 1, "the private workspace draft keeps the history");
});
