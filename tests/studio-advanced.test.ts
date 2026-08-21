import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import { normalizePlayableScenario, playableFingerprint } from "../app/playable-integrity";
import { compileStudioDraft } from "../app/studio-compiler";
import { applyStudioPromptIteration, planStudioPromptIteration } from "../app/studio-editing";
import { applyStudioSnapshot, diffDraftToRevision, emptyStudioTimeline, recordStudioRevision, stepStudioTimeline } from "../app/studio-revisions";
import type { StudioDraft, StudioNodeType } from "../app/types";

const at = "2026-08-21T13:00:00.000Z";
const nodeLabels: Record<StudioNodeType, string> = { trigger: "Trigger", actor: "Actor", fact: "Fact", evidence: "Evidence", deadline: "Deadline", decision: "Decision", outcome: "Outcome", entity: "Entity", tax_rule: "Tax rule", cash_flow: "Cash flow" };

function draft(): StudioDraft {
  return {
    caseId: "advanced_studio_test",
    version: "1.2.3",
    parent: null,
    title: "Advanced Studio test",
    jurisdiction: "Belgium",
    role: "Counsel",
    premise: "A regulator requests a documented response.",
    classification: { domain: "general", practiceArea: "Regulatory", difficulty: "Advanced", tags: [], taxTopics: [], complianceOnly: true, purpose: "compliance_review", legalAsOf: "", sourceUrls: [] },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Regulatory request", detail: "A response is required.", x: 20, y: 180 },
      { id: "actor-1", type: "actor", title: "Legal team", detail: "Coordinates the response.", x: 220, y: 70 },
      { id: "evidence-1", type: "evidence", title: "Board minutes", detail: "Source record.", x: 220, y: 280 },
      { id: "decision-1", type: "decision", title: "Select response", detail: "Choose a defensible path.", x: 460, y: 180 },
      { id: "outcome-1", type: "outcome", title: "Defensible response", detail: "The position is protected.", x: 720, y: 80 },
      { id: "outcome-2", type: "outcome", title: "Compromised response", detail: "The position is weakened.", x: 720, y: 300 },
    ],
    links: [
      { id: "link-1", from: "trigger-1", to: "actor-1" },
      { id: "link-2", from: "trigger-1", to: "evidence-1" },
      { id: "link-3", from: "actor-1", to: "decision-1" },
      { id: "link-4", from: "evidence-1", to: "decision-1" },
      { id: "link-5", from: "decision-1", to: "outcome-1" },
      { id: "link-6", from: "decision-1", to: "outcome-2" },
    ],
    editHistory: [],
    updatedAt: at,
  };
}

test("deterministic prompt planning exposes compound edits, titles and blocking ambiguity before apply", () => {
  const base = draft();
  const plan = planStudioPromptIteration(base, {
    instruction: "Add 2 evidence nodes named “Signed record”; connect evidence-2 to decision-1; rename actor-1 to “Response team”.",
    locale: "en",
    nodeLabels,
    selectedNodeId: "actor-1",
  });
  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.operations.map((operation) => operation.kind), ["add_node", "add_node", "update_node", "add_link"]);
  const applied = applyStudioPromptIteration(base, { instruction: plan.instruction, locale: "en", nodeLabels, selectedNodeId: "actor-1", createdAt: at });
  assert.equal(applied.changed, true);
  assert.equal(applied.draft.nodes.find((node) => node.id === "evidence-2")?.title, "Signed record 1");
  assert.equal(applied.draft.nodes.find((node) => node.id === "actor-1")?.title, "Response team");
  assert.ok(applied.draft.links.some((link) => link.from === "evidence-2" && link.to === "decision-1"));
  assert.equal(applied.draft.premise, base.premise);

  const duplicateTitle = { ...base, nodes: [...base.nodes, { ...base.nodes[2], id: "evidence-copy", x: 330 }] };
  const blocked = planStudioPromptIteration(duplicateTitle, { instruction: "Connect “Board minutes” to decision-1.", locale: "en", nodeLabels });
  assert.equal(blocked.canApply, false);
  assert.ok(blocked.diagnostics.some((item) => item.level === "error" && /ambiguous/i.test(item.message)));
});

test("negated graph commands are not executed and context-only turns remain explicit", () => {
  const base = draft();
  const negated = planStudioPromptIteration(base, { instruction: "Do not add evidence.", locale: "en", nodeLabels });
  assert.equal(negated.operations.length, 0);
  assert.equal(negated.contextOnly, true);
  const applied = applyStudioPromptIteration(base, { instruction: "Do not add evidence.", locale: "en", nodeLabels, createdAt: at });
  assert.equal(applied.draft.nodes.length, base.nodes.length);
  assert.match(applied.draft.premise, /Do not add evidence/);
});

test("session timeline provides exact diff, undo, redo and branch truncation", () => {
  const base = draft();
  const moved = { ...base, title: "Renamed case", nodes: base.nodes.map((node) => node.id === "actor-1" ? { ...node, x: 333 } : node) };
  let timeline = recordStudioRevision(emptyStudioTimeline(), base, moved, { label: "Rename and move", source: "visual", createdAt: at });
  assert.equal(timeline.cursor, 1);
  const revision = timeline.revisions[0];
  const diff = diffDraftToRevision(base, revision);
  assert.deepEqual(diff.fields, ["title"]);
  assert.deepEqual(diff.nodesChanged, ["actor-1"]);

  const undo = stepStudioTimeline(timeline, "undo");
  assert.ok(undo);
  const restored = applyStudioSnapshot(moved, undo.snapshot, at);
  assert.equal(restored.title, base.title);
  assert.equal(restored.nodes.find((node) => node.id === "actor-1")?.x, 220);
  timeline = undo.timeline;
  const redo = stepStudioTimeline(timeline, "redo");
  assert.ok(redo);
  assert.equal(applyStudioSnapshot(restored, redo.snapshot, at).title, "Renamed case");

  const branched = { ...restored, jurisdiction: "Netherlands" };
  timeline = recordStudioRevision(timeline, restored, branched, { label: "Change jurisdiction", source: "visual", createdAt: "2026-08-21T13:01:00.000Z" });
  assert.equal(timeline.revisions.length, 1, "a new edit after undo discards the redo branch");
  assert.equal(timeline.cursor, 1);
});

test("arbitrary acyclic Studio graph compiles into the full validated player runtime", () => {
  const base = draft();
  const compiled = compileStudioDraft(base);
  assert.deepEqual(compiled.issues, []);
  assert.ok(compiled.scenario);
  const scenario = normalizePlayableScenario(structuredClone(compiled.scenario));
  assert.equal(scenario.sourceFingerprint, caseFingerprint(base));
  assert.equal(playableFingerprint(scenario), scenario.fingerprint);
  assert.equal(scenario.stages.length, base.nodes.length);
  assert.equal(scenario.stages.find((stage) => stage.id === "studio-outcome-1")?.terminalOutcome, "strong");
  assert.equal(scenario.stages.find((stage) => stage.id === "studio-outcome-2")?.terminalOutcome, "weak");

  const walk = (stageId: string, seen: Set<string>) => {
    assert.ok(!seen.has(stageId), "compiled v1 graph is acyclic");
    const stage = scenario.stages.find((item) => item.id === stageId);
    assert.ok(stage);
    if (stage.terminal) return;
    assert.ok(stage.options.length > 0);
    for (const option of stage.options) walk(option.nextStageId!, new Set([...seen, stageId]));
  };
  walk(scenario.initialStageId, new Set());

  const cyclic = structuredClone(base);
  cyclic.links.push({ id: "link-cycle", from: "decision-1", to: "trigger-1" });
  const rejected = compileStudioDraft(cyclic);
  assert.equal(rejected.scenario, null);
  assert.ok(rejected.issues.some((issue) => issue.code === "cycle"));
});

test("Help ships two local accessible walkthroughs with bilingual monotonic captions", () => {
  const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.equal((appSource.match(/<video controls preload="metadata" playsInline/g) ?? []).length, 2);
  assert.equal((appSource.match(/kind="captions"/g) ?? []).length, 4);
  assert.doesNotMatch(appSource, /<video[^>]+autoPlay/);
  assert.match(appSource, /aria-describedby="editor-video-description editor-video-transcript"/);
  assert.match(appSource, /aria-describedby="play-video-description play-video-transcript"/);
  assert.match(appSource, /Your browser does not support HTML video/);
  assert.match(appSource, /Ваш браузер не поддерживает HTML-видео/);

  const assets = [
    "case-studio-iterative-editing.mp4",
    "case-studio-iterative-editing-poster.jpg",
    "play-your-studio-case.mp4",
    "play-your-studio-case-poster.jpg",
  ];
  for (const name of assets) assert.ok(statSync(new URL(`../public/help/${name}`, import.meta.url)).size > 10_000, `${name} should be a non-empty local asset`);

  const captionFiles = [
    "case-studio-iterative-editing.en.vtt",
    "case-studio-iterative-editing.ru.vtt",
    "play-your-studio-case.en.vtt",
    "play-your-studio-case.ru.vtt",
  ];
  for (const name of captionFiles) {
    const vtt = readFileSync(new URL(`../public/help/${name}`, import.meta.url), "utf8");
    assert.ok(vtt.startsWith("WEBVTT\n"));
    const starts = [...vtt.matchAll(/^(\d{2}):(\d{2})\.(\d{3}) -->/gm)].map((match) => Number(match[1]) * 60_000 + Number(match[2]) * 1_000 + Number(match[3]));
    assert.ok(starts.length >= 5, `${name} should contain a useful caption sequence`);
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), `${name} cues should be monotonic`);
  }
});
