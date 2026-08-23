import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeStudioDraft } from "../app/case-integrity";
import { applyStudioPromptPlan, describeStudioPromptOperation, toPublicStudioDraft } from "../app/studio-editing";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "../app/studio-envelope";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "../app/studio-prompt-limit";
import { applyValidatedAIStudioPlan, materializeAIStudioPlan, normalizeStudioAIContext, previewValidatedAIStudioPlan, STUDIO_AI_PLAN_SCHEMA, studioAIBaseFingerprint, toStudioAIContext } from "../app/studio-ai-plan";
import type { StudioDraft, StudioNodeType } from "../app/types";

const at = "2026-08-23T12:00:00.000Z";
const emptyRuntime = { day: null, time: null, pressure: null, terminalOutcome: null, deadlineDay: null, deadlineTime: null, budgetCostEur: null, durationMinutes: null };
const emptyRule = { label: null, detail: null, result: null, cost: null, minutes: null, effects: { position: null, evidence: null, trust: null, exposure: null }, repeatability: null, maxUses: null };
const emptyEconomics = { currency: null, purchasePrice: null, loanToValueBps: null, annualInterestRateBps: null, termMonths: null, repaymentBasis: null, grossAnnualIncome: null, annualOperatingCosts: null, oneOffStructureCost: null, annualStructureCost: null, otherInitialCosts: null, targetAnnualReturnBps: null, scenarioProbabilities: null, assumptions: [] };

function blankDraft(): StudioDraft {
  return {
    caseId: "untitled_case", version: "1.0.0", parent: null, title: "", jurisdiction: "", role: "", premise: "",
    classification: { domain: "general", practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true },
    nodes: [], links: [], editHistory: [], updatedAt: at,
  };
}

function node(ref: string, type: StudioNodeType, title: string, detail: string, terminalOutcome: "strong" | "mixed" | "weak" | null = null) {
  return { action: "add", ref, existingNodeId: null, type, title, detail, runtime: { ...emptyRuntime, terminalOutcome } };
}

function link(fromRef: string, toRef: string, label: string) {
  return { action: "add", existingLinkId: null, fromRef, toRef, ...emptyRule, label };
}

function bhopalProposal() {
  return {
    compatible: true,
    clarification: null,
    summary: "Build a source-grounded industrial-disaster accountability scenario.",
    assumptions: ["The player acts as counsel reviewing accountability and remediation options."],
    warnings: ["Verify historical and legal assertions against the cited public source."],
    case: {
      title: "Bhopal disaster: accountability and remediation",
      jurisdiction: "India · environmental, corporate and public law",
      role: "Counsel reviewing accountability and remediation",
      context: "A toxic gas release caused mass death and long-term harm; the scenario examines responsibility, compensation, evidence and prevention.",
      domain: "general",
      practiceArea: "Environmental liability and public health",
      tags: ["industrial disaster", "corporate accountability", "compensation"],
      taxTopics: [],
    },
    economics: emptyEconomics,
    nodes: [
      node("release", "trigger", "Toxic gas release at Bhopal plant", "More than 40 tons of methyl isocyanate escaped from the pesticide plant."),
      node("company", "actor", "Union Carbide corporate interests", "The company disputed legal responsibility before later accepting moral responsibility."),
      node("government", "actor", "Government of India", "The government represented affected interests in the Supreme Court-mediated settlement."),
      node("harm", "fact", "Mass death and long-term morbidity", "Thousands died immediately and many more experienced long-term health consequences."),
      node("record", "evidence", "Exposure and health-impact record", "Casualty estimates, exposure evidence and longitudinal health data affect compensation adequacy."),
      node("response", "decision", "Choose the accountability and remediation response", "Compare settlement finality, further remediation and enforceable prevention measures."),
      node("credible", "outcome", "Evidence-led remediation and prevention", "The response addresses documented harm and strengthens enforceable safety preparedness.", "strong"),
      node("inadequate", "outcome", "Under-compensation and unresolved risk", "Underestimated exposure and weak prevention leave affected communities and future sites exposed.", "weak"),
    ],
    links: [
      link("release", "company", "Identify operator responsibility"), link("release", "government", "Open the public response"),
      link("release", "harm", "Document immediate and long-term harm"), link("harm", "record", "Build the exposure record"),
      link("company", "response", "Assess responsibility position"), link("government", "response", "Assess settlement and regulatory options"),
      link("record", "response", "Test compensation assumptions"), link("response", "credible", "Pursue evidence-led remediation"),
      link("response", "inadequate", "Accept an under-supported resolution"),
    ],
  };
}

test("AI semantic intents materialize into a meaningful, collision-free, non-destructive graph", () => {
  const draft = blankDraft();
  const plan = materializeAIStudioPlan(draft, "Turn this Bhopal review into a playable legal case.", bhopalProposal(), "en");
  assert.equal(plan.planner, "ai");
  assert.equal(plan.canApply, true);
  assert.equal(plan.operations.some((operation) => operation.kind === "delete_node" || operation.kind === "delete_link" || operation.kind === "relink_link"), false);
  const addedNodes = plan.operations.filter((operation) => operation.kind === "add_node");
  const addedLinks = plan.operations.filter((operation) => operation.kind === "add_link");
  assert.equal(addedNodes.length, 8);
  assert.equal(addedLinks.length, 9);
  assert.equal(addedNodes.some((operation) => operation.node.type === "deadline"), false, "AI must not invent a deadline absent from the source");
  assert.deepEqual(addedNodes.filter((operation) => operation.node.type === "actor").map((operation) => operation.node.title), ["Union Carbide corporate interests", "Government of India"]);
  assert.equal(new Set(addedNodes.map((operation) => operation.node.id)).size, addedNodes.length);
  assert.equal(new Set(addedLinks.map((operation) => operation.link.id)).size, addedLinks.length);

  const reviewedPlan = { ...plan, aiProvenance: {
    model: "gpt-5.6",
    requestId: "resp-test",
    baseFingerprint: studioAIBaseFingerprint(draft),
    planFingerprint: `sha256-${"c".repeat(64)}`,
  } };
  const applied = applyValidatedAIStudioPlan(draft, { plan: reviewedPlan, locale: "en", createdAt: at });
  assert.equal(applied.changed, true);
  assert.equal(applied.draft.title, "Bhopal disaster: accountability and remediation");
  assert.equal(applied.draft.nodes.length, 8);
  assert.equal(applied.draft.links.length, 9);
  assert.deepEqual(applied.draft.editHistory.map((entry) => entry.action), ["prompt_submitted", "prompt_applied"]);
  assert.match(applied.draft.editHistory[1].message, /reviewed AI-assisted plan/i);
  assert.match(applied.draft.editHistory[1].message, /model=gpt-5\.6/);
});

test("AI cash-flow facts materialize as a reviewable non-destructive economics operation", () => {
  const proposal = { ...bhopalProposal(), economics: {
    currency: "GBP", purchasePrice: 1_000_000, loanToValueBps: 8_000, annualInterestRateBps: 750, termMonths: 120,
    repaymentBasis: "unknown", grossAnnualIncome: 129_600, annualOperatingCosts: null, oneOffStructureCost: 15_000,
    annualStructureCost: 10_000, otherInitialCosts: null, targetAnnualReturnBps: 1_000,
    scenarioProbabilities: { interestOnlyBps: 5_000, favorableBps: 2_500, baseBps: 5_000, stressedBps: 2_500 },
    assumptions: ["Monthly rent was annualized from an explicit total."],
  } };
  const plan = materializeAIStudioPlan(blankDraft(), "Model the supplied property cash flow.", proposal, "en");
  const economics = plan.operations.find((operation) => operation.kind === "set_deal_economics");
  assert.ok(economics && economics.kind === "set_deal_economics");
  assert.equal(economics.economics.repaymentBasis, "unknown");
  assert.equal(economics.economics.annualStructureCost, 10_000);
  assert.equal(economics.economics.scenarioProbabilities.stressedBps, 2_500);
  assert.match(describeStudioPromptOperation(economics, "en"), /purchase.*1,000,000.*LTV 80\.00%/i);
  assert.match(describeStudioPromptOperation(economics, "en"), /scenario weights.*25\.0%\/50\.0%\/25\.0%/i);
});

test("AI keeps the raw blank-draft source private and publishes only reviewed case context", () => {
  const privateMarker = "PRIVATE-SOURCE-TAIL-DO-NOT-PUBLISH";
  const instruction = `Bhopal source record: ${"documented public facts and chronology. ".repeat(160)}${privateMarker}`.slice(0, 8_000);
  const plan = materializeAIStudioPlan(blankDraft(), instruction, bhopalProposal(), "en");
  const applied = applyStudioPromptPlan(blankDraft(), { plan, locale: "en", createdAt: at });
  assert.equal(applied.draft.premise, bhopalProposal().case.context);
  assert.doesNotMatch(JSON.stringify(toPublicStudioDraft(applied.draft)), new RegExp(privateMarker));
  const sourceEntries = applied.draft.editHistory.filter((entry) => entry.action === "prompt_submitted");
  assert.ok(sourceEntries.length > 1);
  assert.ok(sourceEntries.every((entry) => entry.message.length <= 2_000));
  const reconstructed = sourceEntries.map((entry) => entry.message.replace(/^AI source \d+\/\d+:\n/, "").replace(/\n\[END AI SOURCE PART\]$/, "")).join("");
  assert.equal(reconstructed, instruction.trim(), "bounded private history chunks retain the complete accepted AI source");
});

test("AI preview uses the final apply trust boundary without mutating the live draft", () => {
  const base = blankDraft();
  const before = structuredClone(base);
  const plan = materializeAIStudioPlan(base, "Build a playable case.", bhopalProposal(), "en");
  const preview = previewValidatedAIStudioPlan(base, { plan, locale: "en" });
  const applied = applyValidatedAIStudioPlan(base, { plan, locale: "en", createdAt: "2026-08-23T13:00:00.000Z" }).draft;
  assert.deepEqual(base, before, "preview must not mutate the live draft");
  assert.deepEqual(preview.nodes, applied.nodes);
  assert.deepEqual(preview.links, applied.links);
  assert.equal(preview.premise, applied.premise);
});

test("AI review descriptions expose every authored runtime and relation rule field", () => {
  const hiddenTail = "UNIQUE-LEGAL-TAIL-MUST-BE-VISIBLE";
  const deadlineDescription = describeStudioPromptOperation({ kind: "add_node", node: {
    id: "deadline-1", type: "deadline", title: "File the response", detail: `${"A sourced procedural limit. ".repeat(8)}${hiddenTail}`, x: 20, y: 20,
    runtime: { day: 3, time: "16:30", pressure: "Escalates if counsel waits.", deadlineDay: 4, deadlineTime: "12:00", missedOutcomeNodeId: "outcome-2", budgetCostEur: 500, durationMinutes: 90 },
  } }, "en", new Map([["outcome-2", "Missed filing"]]));
  assert.match(deadlineDescription, /pressure:.*Escalates/);
  assert.match(deadlineDescription, /deadline: day 4, 12:00/);
  assert.match(deadlineDescription, /missed outcome:.*Missed filing/);
  assert.match(deadlineDescription, new RegExp(hiddenTail), "review must disclose content after character 120 before Apply");

  const relationDescription = describeStudioPromptOperation({ kind: "add_link", link: {
    id: "link-1", from: "decision-1", to: "outcome-1", rule: {
      label: "File now", detail: "Use the verified record.", result: "The response is accepted.", cost: 250, minutes: 45,
      effects: { evidence: 8, exposure: -3 }, guards: [{ metric: "evidence", comparison: "gte", value: 40 }], repeatability: "limited", maxUses: 2,
    },
  } }, "en");
  assert.match(relationDescription, /detail:.*verified record/);
  assert.match(relationDescription, /effects: evidence \+8, exposure -3/);
  assert.match(relationDescription, /conditions: evidence gte 40/);
  assert.match(relationDescription, /repeatability: limited \(max 2\)/);
});

test("User-view AI review identifies updated nodes and relations without exposing technical IDs", () => {
  const titles = new Map([
    ["actor-1", "Original operator"],
    ["decision-1", "Choose the response"],
    ["outcome-1", "Compliant outcome"],
  ]);
  const updateNodeDescription = describeStudioPromptOperation({
    kind: "update_node",
    nodeId: "actor-1",
    change: { title: "Renamed operator" },
  }, "en", titles, { showIds: false });
  assert.match(updateNodeDescription, /Original operator/);
  assert.match(updateNodeDescription, /Renamed operator/);
  assert.doesNotMatch(updateNodeDescription, /actor-1/);

  const updateLinkDescription = describeStudioPromptOperation({
    kind: "update_link",
    linkId: "link-1",
    change: { label: "Use the verified route" },
  }, "en", titles, {
    showIds: false,
    linkEndpoints: new Map([["link-1", { from: "decision-1", to: "outcome-1" }]]),
  });
  assert.match(updateLinkDescription, /Choose the response.*→.*Compliant outcome/);
  assert.match(updateLinkDescription, /Use the verified route/);
  assert.doesNotMatch(updateLinkDescription, /link-1/);
});

test("AI plan materialization rejects unknown semantic references atomically", () => {
  const proposal = bhopalProposal();
  proposal.links[0].fromRef = "missing-ref";
  assert.throws(() => materializeAIStudioPlan(blankDraft(), "Build it.", proposal, "en"), /invalid endpoint/i);
});

test("AI response schema mirrors the materializer text and reference bounds", () => {
  type SchemaNode = { maxLength?: number; maximum?: number; pattern?: string; properties?: Record<string, SchemaNode>; items?: SchemaNode };
  const schema = STUDIO_AI_PLAN_SCHEMA as unknown as { properties: Record<string, SchemaNode>; required: readonly string[] };
  assert.equal(schema.properties.summary.maxLength, 800);
  assert.equal(schema.properties.case.properties?.context.maxLength, 4000);
  assert.equal(schema.properties.nodes.items?.properties?.detail.maxLength, 4000);
  assert.equal(schema.properties.nodes.items?.properties?.ref.pattern, "^[A-Za-z][A-Za-z0-9_-]{0,79}$");
  assert.equal(schema.properties.links.items?.properties?.fromRef.maxLength, 80);
  assert.equal(schema.properties.economics.properties?.loanToValueBps.maximum, 10000);
  assert.ok((STUDIO_AI_PLAN_SCHEMA.required as readonly string[]).includes("economics"));
});

test("AI plans that introduce cycles are review-blocked before apply", () => {
  const proposal = bhopalProposal();
  proposal.links.push(link("credible", "release", "Reopen the initial trigger"));
  const plan = materializeAIStudioPlan(blankDraft(), "Build a playable case.", proposal, "en");
  assert.equal(plan.canApply, false);
  assert.ok(plan.diagnostics.some((item) => item.level === "error" && /invalid playable path/i.test(item.message)));
});

test("final AI apply boundary rejects destructive or lineage-field operations", () => {
  const basePlan = materializeAIStudioPlan(blankDraft(), "Build a playable case.", bhopalProposal(), "en");
  const base = applyStudioPromptPlan(blankDraft(), { plan: basePlan, locale: "en", createdAt: at }).draft;
  const destructive = { ...basePlan, operations: [{ kind: "delete_node", nodeId: base.nodes[0].id }] };
  assert.throws(() => applyValidatedAIStudioPlan(base, { plan: destructive, locale: "en", createdAt: at }), /destructive/i);
  const lineageMutation = { ...basePlan, operations: [{ kind: "set_case_field", field: "protection", value: "removed" }] };
  assert.throws(() => applyValidatedAIStudioPlan(base, { plan: lineageMutation, locale: "en", createdAt: at }), /not permitted/i);
});

test("blank AI context is bounded and fingerprints exclude history and protection metadata", () => {
  const draft = blankDraft();
  const normalized = normalizeStudioAIContext(toStudioAIContext(draft));
  assert.equal(normalized.nodes.length, 0);
  assert.equal(normalized.title, "");
  const fingerprint = studioAIBaseFingerprint(draft);
  const noisy = { ...draft, editHistory: [{ id: "edit-1", role: "author" as const, source: "prompt" as const, action: "prompt_submitted" as const, message: "private", createdAt: at }], protection: { kind: "case-protection-v1" as const, copyProtected: false, copyPolicy: "fork_allowed" as const, parentCode: null, currentCode: `sha256-${"a".repeat(64)}`, seal: `hmac-sha256-${"b".repeat(64)}` } };
  assert.equal(studioAIBaseFingerprint(noisy), fingerprint);
});

test("Studio rejects aggregate drafts that cannot fit the shared request envelope", () => {
  const nodes = Array.from({ length: 12 }, (_, index) => ({ id: `fact-${index + 1}`, type: "fact" as const, title: `Fact ${index + 1}`, detail: "", x: index * 20, y: index * 20 }));
  const pairs: Array<[string, string]> = [];
  for (const from of nodes) for (const to of nodes) if (from.id !== to.id && pairs.length < 120) pairs.push([from.id, to.id]);
  const links = pairs.map(([from, to], index) => ({ id: `link-${index + 1}`, from, to, rule: { detail: "d".repeat(4_000), result: "r".repeat(4_000) } }));
  const oversized = { ...blankDraft(), title: "Oversized aggregate case", nodes, links };
  assert.ok(studioJsonBytes(oversized) > STUDIO_DRAFT_SERIALIZED_LIMIT);
  assert.throws(() => normalizeStudioDraft(oversized), /aggregate JSON size limit/i);
});

test("AI route keeps the key server-side and enforces auth, same-origin, limits and no response storage", () => {
  const route = readFileSync(new URL("../app/api/studio/ai-plan/route.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../app/studio-ai-server.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const progress = readFileSync(new URL("../app/StudioAIProgress.tsx", import.meta.url), "utf8");
  const review = readFileSync(new URL("../app/StudioAIReview.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const me = readFileSync(new URL("../app/api/me/route.ts", import.meta.url), "utf8");
  const localAuth = readFileSync(new URL("../app/local-auth.ts", import.meta.url), "utf8");
  assert.match(route, /isSameOriginCredentialMutation/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /profile_required/);
  assert.match(route, /consumeAuthRateLimit/);
  assert.match(route, /studio-ai-tenant-daily/);
  assert.match(route, /studio-ai-plan-burst/);
  assert.match(route, /checkSuccessfulAuthEventLimit\("studio_ai_plan"/);
  assert.doesNotMatch(route, /consumeAuthRateLimit\(request,\s*"studio-ai-plan",/);
  assert.match(localAuth, /eq\(authAuditEvents\.success, true\)/);
  assert.match(route, /GENESIS_AI_DAILY_REQUEST_LIMIT/);
  assert.match(route, /STUDIO_CASE_BODY_LIMIT/);
  assert.match(route, /baseFingerprint/);
  assert.match(server, /OPENAI_API_KEY/);
  assert.match(server, /store: false/);
  assert.match(server, /safety_identifier/);
  assert.match(server, /reasoning:\s*\{\s*effort:\s*"low"\s*\}/);
  assert.match(server, /STUDIO_AI_TIMEOUT_MS\s*=\s*300_000/);
  assert.match(server, /STUDIO_AI_REPAIR_TIMEOUT_MS\s*=\s*120_000/);
  assert.match(server, /SEMANTIC REPAIR PASS/);
  assert.match(server, /reasoning:\s*\{\s*effort:\s*"none"\s*\}/);
  assert.match(server, /AbortSignal\.any/);
  assert.match(server, /text:\s*\{\s*format:\s*\{/);
  assert.doesNotMatch(`${route}\n${ui}`, /OPENAI_API_KEY|NEXT_PUBLIC_OPENAI/);
  assert.match(ui, /Understand with AI/);
  assert.match(ui, /StudioAIProgress/);
  assert.match(progress, /Estimated AI planning progress/);
  assert.match(progress, /role="progressbar"/);
  assert.match(progress, /the model does not stream an exact completion percentage/);
  assert.match(progress, /complex case can take several minutes/);
  assert.match(review, /Apply all .*reviewed changes/);
  assert.match(review, /displayed in full below/);
  assert.match(styles, /\.ai-plan-notes ul li\{display:block;/, "assumptions and warnings must use the full review width rather than the diagnostic icon column");
  assert.match(me, /studioAIAvailable/);
  assert.match(ui, /not_configured/);
  assert.match(ui, /useState<"user" \| "developer">\("user"\)/);
  assert.equal(STUDIO_PROMPT_CHARACTER_LIMIT, 64_000);
  assert.match(ui, /maxLength=\{STUDIO_PROMPT_CHARACTER_LIMIT\}/);
});
