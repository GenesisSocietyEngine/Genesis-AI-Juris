import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import { normalizePlayableScenario, playableFingerprint } from "../app/playable-integrity";
import { compileStudioDraft } from "../app/studio-compiler";
import { applyStudioPromptIteration, nextStudioNodePosition, planStudioPromptIteration } from "../app/studio-editing";
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

test("manual node placement honours the current viewport centre and avoids occupied cards", () => {
  const nodes = draft().nodes;
  const centred = nextStudioNodePosition(nodes, nodes[0], { x: 1_480, y: 920 });
  assert.deepEqual(centred, { x: 1_480, y: 920 });
  const occupied = nextStudioNodePosition([...nodes, { ...nodes[0], id: "occupied-centre", x: 1_480, y: 920 }], nodes[0], { x: 1_480, y: 920 });
  assert.notDeepEqual(occupied, { x: 1_480, y: 920 });
  assert.ok(Math.abs(occupied.x - 1_480) <= 440 && Math.abs(occupied.y - 920) <= 300);
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
  const protection = {
    kind: "case-protection-v1" as const,
    copyProtected: true,
    copyPolicy: "lineage_locked" as const,
    parentCode: null,
    currentCode: `sha256-${"a".repeat(64)}`,
    seal: `hmac-sha256-${"b".repeat(64)}`,
  };
  const restored = applyStudioSnapshot({ ...moved, protection }, undo.snapshot, at);
  assert.equal(restored.title, base.title);
  assert.equal(restored.nodes.find((node) => node.id === "actor-1")?.x, 220);
  assert.deepEqual(restored.protection, protection, "undo must preserve the server-attested lineage lock");
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

test("node budget and duration are compiler defaults while a relation rule wins", () => {
  const base = draft();
  base.nodes = base.nodes.map((node) => node.id === "outcome-1" ? { ...node, runtime: { budgetCostEur: 12_500, durationMinutes: 75 } } : node);
  let compiled = compileStudioDraft(base);
  assert.ok(compiled.scenario);
  let option = compiled.scenario.stages.find((stage) => stage.id === "studio-decision-1")?.options.find((item) => item.id === "action-link-5");
  assert.equal(option?.cost, 12_500);
  assert.equal(option?.minutes, 75);
  assert.equal(option?.costAuthored, true);

  base.links = base.links.map((link) => link.id === "link-5" ? { ...link, rule: { cost: 900, minutes: 15 } } : link);
  compiled = compileStudioDraft(base);
  option = compiled.scenario?.stages.find((stage) => stage.id === "studio-decision-1")?.options.find((item) => item.id === "action-link-5");
  assert.equal(option?.cost, 900);
  assert.equal(option?.minutes, 15);

  base.nodes = base.nodes.map((node) => node.id === "trigger-1" ? { ...node, runtime: { budgetCostEur: 2_500, durationMinutes: 45 } } : node);
  compiled = compileStudioDraft(base);
  const opening = compiled.scenario?.stages.find((stage) => stage.id === "studio-root");
  assert.equal(compiled.scenario?.initialStageId, "studio-root");
  assert.equal(opening?.options[0].cost, 2_500);
  assert.equal(opening?.options[0].minutes, 45);
  assert.equal(opening?.options[0].nextStageId, "studio-trigger-1");

  base.nodes = base.nodes.map((node) => node.id === "trigger-1" ? { ...node, runtime: { budgetCostEur: 2_500 } } : node);
  compiled = compileStudioDraft(base);
  assert.equal(compiled.scenario?.stages.find((stage) => stage.id === "studio-root")?.options[0].minutes, 0, "cost-only root authoring must not invent elapsed time");
});

test("compiler synthetic opening IDs cannot collide with valid Studio node or relation IDs", () => {
  const base = draft();
  base.nodes = base.nodes.map((node) => node.id === "trigger-1" ? { ...node, id: "root", runtime: { budgetCostEur: 1 } } : node);
  base.links = base.links.map((link) => ({ ...link, id: link.id === "link-1" ? "root-1" : link.id, from: link.from === "trigger-1" ? "root" : link.from }));
  const compiled = compileStudioDraft(base);
  assert.deepEqual(compiled.issues, []);
  assert.ok(compiled.scenario);
  assert.notEqual(compiled.scenario.initialStageId, "studio-root", "the real studio-root stage ID is reserved by node root");
  const ids = compiled.scenario.stages.flatMap((stage) => [stage.id, ...stage.options.map((option) => option.id)]);
  assert.equal(new Set(ids).size, ids.length);
});

test("Studio UI exposes intuitive blank reset, selectable relation deletion and dark option contrast", () => {
  const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const cashFlowEditorSource = readFileSync(new URL("../app/CashFlowScenarioEditor.tsx", import.meta.url), "utf8");
  const reportDialogSource = readFileSync(new URL("../app/CaseReportDialog.tsx", import.meta.url), "utf8");
  const markdownDialogSource = readFileSync(new URL("../app/CaseMarkdownDialog.tsx", import.meta.url), "utf8");
  const markdownActionsSource = readFileSync(new URL("../app/CaseMarkdownActions.tsx", import.meta.url), "utf8");
  const canonicalReviewSource = readFileSync(new URL("../app/CanonicalMarkdownReview.tsx", import.meta.url), "utf8");
  const promptAuxiliarySource = readFileSync(new URL("../app/StudioPromptAuxiliary.tsx", import.meta.url), "utf8");
  const milestonesSource = readFileSync(new URL("../app/GraphMilestones.tsx", import.meta.url), "utf8");
  const taxEconomicsSource = readFileSync(new URL("../app/TaxEconomicsPanel.tsx", import.meta.url), "utf8");
  const outcomeParametersSource = readFileSync(new URL("../app/StudioOutcomeParameters.tsx", import.meta.url), "utf8");
  const moreActionsSource = readFileSync(new URL("../app/StudioUserMoreActions.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(appSource, /function blankStudioDraft/);
  assert.match(appSource, /nodes: \[\],\s*links: \[\],\s*editHistory: \[\]/);
  assert.match(appSource, /graph-link-hit/);
  assert.match(appSource, /event\.key !== "Delete" && event\.key !== "Backspace"/);
  assert.match(appSource, /target instanceof HTMLInputElement/);
  assert.match(appSource, /Press Delete to remove it/);
  assert.match(appSource, /function visibleGraphCenter\(\)/);
  assert.match(appSource, /viewport\.scrollLeft \+ viewport\.clientWidth \/ 2/);
  assert.match(appSource, /useState<GraphOrientation>\("vertical"\)/, "Studio opens new and loaded graphs in the consistent vertical review orientation");
  assert.match(appSource, /setGraphOrientation\("vertical"\)/);
  assert.match(appSource, /<option value="vertical">/);
  assert.match(appSource, /<option value="horizontal">/);
  assert.match(appSource, /graphLinkGeometry\(from,to,graphOrientation\)/, "relation curves follow the chosen orientation");
  assert.match(appSource, /GraphMilestones/, "the graph exposes temporal milestones without adding them to the initial bundle");
  assert.match(milestonesSource, /deadlineDay/);
  assert.match(milestonesSource, /localeCompare/);
  assert.match(milestonesSource, /select\(node\.id\)/, "milestones navigate to their graph nodes");
  assert.match(appSource, /function focusGraphNode\(nodeId: string\)/);
  assert.match(appSource, /link\.from===selectedNodeId\?"active":""/, "source number tags retain the selected-node highlight");
  assert.match(appSource, /link\.to===selectedNodeId\?"active":""/, "destination number tags retain the selected-node highlight");
  assert.match(appSource, /aria-pressed=\{link\.from===selectedNodeId\}/);
  assert.match(appSource, /aria-pressed=\{link\.to===selectedNodeId\}/);
  assert.match(appSource, /viewport\.scrollTo\(/, "node navigation centres the selected node inside the graph viewport");
  assert.match(appSource, /nodeButton\?\.focus\(\{ preventScroll: true \}\)/, "node focus remains stable after viewport centring");
  assert.match(css, /graph-orientation-vertical \.node-port\{top:auto;right:auto;left:50%;transform:translateX\(-50%\)\}/, "vertical ports are centred on the node");
  assert.match(css, /graph-orientation-vertical \.node-port-in\{top:-17px;bottom:auto\}/, "vertical inputs sit above the node");
  assert.match(css, /graph-orientation-vertical \.node-port-out\{top:auto;right:auto;bottom:-17px\}/, "vertical outputs sit below the node");
  assert.match(appSource, /graphOrientation === "vertical" \? \{top:-17,left:"50%",right:"auto",bottom:"auto",transform:"translateX\(-50%\)"\}/, "vertical input placement is also guaranteed inline against stale or reordered stylesheets");
  assert.match(appSource, /graphOrientation === "vertical" \? \{top:"auto",left:"50%",right:"auto",bottom:-17,transform:"translateX\(-50%\)"\}/, "vertical output placement is also guaranteed inline against stale or reordered stylesheets");
  assert.match(css, /relation-node-tag\.destination\.active/, "destination highlights persist after focus moves");
  assert.match(appSource, /press Delete to remove/, "selected nodes expose their keyboard deletion shortcut");
  assert.match(appSource, /CashFlowScenarioEditor/, "a selected cash-flow node exposes editable model controls");
  assert.match(cashFlowEditorSource, /CASH-FLOW SCENARIO/);
  assert.match(cashFlowEditorSource, /setProbability/, "cash-flow scenario weights are directly editable");
  assert.match(appSource, /PDF report/);
  assert.match(appSource, /await import\("\.\/CaseReportDialog"\)/, "report UI is preloaded on demand before the editor is covered");
  assert.match(appSource, /setCaseReportOpen\(true\)/);
  assert.match(appSource, /PDF unavailable/, "a stale report chunk leaves Studio visible with a recoverable error");
  const reportButtonSource = appSource.slice(appSource.indexOf('className="secondary-cta report-cta"'), appSource.indexOf('className="primary-cta"'));
  assert.doesNotMatch(reportButtonSource, /disabled=/, "PDF options remain clickable while background derivations settle");
  assert.match(markdownActionsSource, /Export Final case prompt \(\.md\)/);
  assert.match(markdownActionsSource, /Import canonical case \(\.md\)/);
  assert.match(markdownActionsSource, /closest\("details"\)\?\.removeAttribute\("open"\)/, "opening Markdown export closes the More actions menu");
  assert.match(appSource, /CanonicalPromptAction/);
  assert.match(promptAuxiliarySource, /Verify canonical case/);
  assert.match(appSource, /<progress className="ai-progress-fallback" max=\{100\} value=\{8\}/, "the lazy-loading fallback keeps a native activity track in every theme");
  assert.match(markdownDialogSource, /Download \.md/);
  assert.match(markdownDialogSource, /Final reviewed/);
  assert.match(markdownDialogSource, /Case filename/);
  assert.match(markdownDialogSource, /YYYYMMDD_HHMMSS/);
  assert.match(canonicalReviewSource, /Apply exact case/);
  assert.match(css, /\.ai-progress-track\{position:relative;height:9px;min-height:9px/, "progress track has explicit geometry independent of theme paints");
  assert.match(reportDialogSource, /raw AI prompt is never included/);
  assert.match(reportDialogSource, /Client-facing report/);
  assert.match(taxEconomicsSource, /Tax base \+ rates \(%\)/, "tax economics supports percentage-rate inputs");
  assert.match(taxEconomicsSource, /select value=\{model\.currency\}/, "tax currency uses a controlled dropdown");
  assert.match(taxEconomicsSource, /"EUR", "GBP", "USD", "CHF", "CNY"/);
  assert.match(appSource, /const pointerX = \(event\.clientX - rect\.left\) \/ scale/,
    "scaled graph dragging must translate pointer coordinates back into graph space");
  assert.match(appSource, /moveNode\(event,node,graphZoom\)/,
    "graph interactions must provide their current scale");
  assert.match(appSource, /Math\.max\(0\.55/,
    "Fit must retain a legible minimum scale while supporting larger auto-laid-out graphs");
  const autoLayoutSource = appSource.slice(appSource.indexOf("async function autoLayoutGraph"), appSource.indexOf("function clearTransientEditorSelection"));
  assert.match(autoLayoutSource, /applied \$\{orientation\} auto-layout/);
  assert.doesNotMatch(autoLayoutSource, /studioCanDuplicate|commitStudioDraft|showSessionNotice/,
    "Studio auto-layout must use the state and callbacks actually available inside StudioView");
  assert.match(appSource, /id="graph-connect-status"[\s\S]*tabIndex=\{-1\}/,
    "relation deletion must have a programmatically focusable status destination");
  assert.match(appSource, /focusRelationStatus\(\)/,
    "relation deletion must restore keyboard focus after removing its control");
  assert.match(appSource, /Fix on decision map/);
  assert.match(appSource, /runtimeForNodeType\(selectedNode\.runtime,type\)/, "node type changes must strip incompatible runtime fields");
  assert.match(appSource, /parent: \{ caseId: current\.caseId, version: current\.version, fingerprint: studioServerFingerprint \}/, "child lineage must use the exact persisted parent fingerprint");
  assert.match(appSource, /Studio case envelope/);
  assert.match(appSource, /useState<"user" \| "developer">\("user"\)/, "User view must be the default Studio surface");
  assert.match(appSource, /Вид пользователя/);
  assert.match(appSource, /Вид разработчика/);
  assert.match(appSource, /studio-more-actions/, "secondary User-view commands must be grouped under More actions");
  assert.match(css, /\.studio-hero:has\(\.studio-more-actions\[open\]\)\{z-index:140\}/, "an open actions menu raises its parent stacking context above later Studio panels");
  assert.match(css, /\.studio-more-actions>\.studio-more-menu\{[^}]*z-index:151[^}]*background:var\(--strong\)/, "the actions menu is an opaque top-layer surface");
  assert.match(moreActionsSource, /Portable final prompt/);
  assert.match(moreActionsSource, /CaseMarkdownActions/);
  assert.match(outcomeParametersSource, /Outcome recalculation parameters/);
  assert.match(outcomeParametersSource, /Financial & financing/);
  assert.match(outcomeParametersSource, /Tax economics/);
  assert.match(cashFlowEditorSource, /Purchase price/);
  assert.match(cashFlowEditorSource, /Loan-to-value/);
  assert.match(appSource, /const \[guidedStep, setGuidedStep\] = useState<GuidedStudioStep>\(1\)/, "Guided Studio must start at the plain-language brief");
  assert.match(appSource, /guidedStep === 3\) && <><div id="studio-case-settings"/, "case settings must be progressively disclosed at the Facts & Assumptions stage");
  assert.match(appSource, /aria-describedby=\{submitBlocker \? "studio-submit-blocker"/, "a disabled submission must expose its concrete blocker");
  assert.match(appSource, /inert=\{!canDuplicate\}/, "inspection-only authoring regions must be removed from keyboard interaction");
  assert.doesNotMatch(appSource, /aria-disabled=\{!canDuplicate\}/, "generic regions must not misuse aria-disabled");
  assert.match(appSource, /type !== "tax_rule"/, "the general User-view palette must hide the specialist tax-rule node");
  assert.match(appSource, /displayMode === "developer" && <section className="studio-history/, "technical history stays in Developer view");
  assert.match(appSource, /displayMode === "developer" && !canonicalPrompt && prompt\.trim\(\) && <details className="prompt-fallback-preview/, "exact-command DSL stays in Developer view and out of canonical imports");
  assert.match(appSource, /displayMode === "developer" && draft\.protection/, "raw lineage seals stay in Developer view");
  assert.match(appSource, /Publishable case context/);
  assert.match(appSource, /\{taxDraft && <><label><span>\{locale === "en" \? "Tax-case purpose"/, "tax-only controls should stay hidden for general cases");
  const deleteHandler = appSource.slice(appSource.indexOf("function deleteSelectedGraphItem"), appSource.indexOf("async function shareDraft"));
  assert.match(deleteHandler, /deleteLink\(link\)/, "Delete removes a selected relation");
  assert.match(deleteHandler, /deleteNode\(\)/, "Delete removes a selected node");
  assert.match(deleteHandler, /window\.confirm/, "keyboard node deletion confirms removal of connected relations");
  assert.match(css, /\.theme-after-hours \.node-inspector \.inspector-form select option\{color:#14212c;background-color:#fff\}/);
  assert.match(css, /\.studio-submit-blocker\{/);
});

test("Help ships an English no-subtitle expert demo and two local accessible walkthroughs with bilingual captions", () => {
  const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const guidedSource = readFileSync(new URL("../app/StudioGuidedDemo.tsx", import.meta.url), "utf8");
  const helpSource = `${appSource}\n${guidedSource}`;
  const directPage = readFileSync(new URL("../app/help/studio-demo/page.tsx", import.meta.url), "utf8");
  assert.equal((helpSource.match(/<video controls preload="metadata" playsInline/g) ?? []).length, 3);
  assert.equal((helpSource.match(/kind="captions"/g) ?? []).length, 4);
  assert.doesNotMatch(helpSource, /<video[^>]+autoPlay/);
  assert.match(helpSource, /aria-describedby="guided-video-description guided-video-transcript"/);
  assert.match(helpSource, /aria-describedby="editor-video-description editor-video-transcript"/);
  assert.match(helpSource, /aria-describedby="play-video-description play-video-transcript"/);
  assert.match(helpSource, /href="\/help\/studio-demo"/);
  assert.match(directPage, /studio-ai-guided-demo\.en\.mp4/);
  assert.match(directPage, /English narration · No subtitles · Studio only/);
  assert.doesNotMatch(guidedSource, /<track|studio-ai-guided-demo\.(?:en|ru)\.vtt/);
  assert.match(directPage, /Five Flats, Three Countries/);
  assert.match(directPage, /03:00/);
  assert.match(guidedSource, /27-node, 31-connection graph/);
  assert.match(guidedSource, /£24,328 annual cash flow/);
  assert.match(helpSource, /Your browser does not support HTML video/);
  assert.match(helpSource, /Ваш браузер не поддерживает HTML-видео/);

  const assets = [
    "studio-ai-guided-demo.en.mp4",
    "studio-ai-guided-demo-poster.jpg",
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
    assert.match(vtt, /^WEBVTT\r?\n/u);
    const starts = [...vtt.matchAll(/^(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3}) -->/gm)].map((match) => Number(match[1] ?? 0) * 3_600_000 + Number(match[2]) * 60_000 + Number(match[3]) * 1_000 + Number(match[4]));
    assert.ok(starts.length >= 5, `${name} should contain a useful caption sequence`);
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), `${name} cues should be monotonic`);
  }
});
