import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  advanceCanonicalTime,
  canonicalAvailableActionIds,
  canonicalOutcomePresentation,
  canonicalPresentationState,
  createCanonicalRuntime,
  dispatchCanonicalAction,
  normalizeCanonicalRuntimeState,
  type CanonicalRuntimeState,
} from "../app/canonical-runtime";
import { deriveRunLedger } from "../app/run-ledger";
import { scenarios } from "../app/scenarios";

type Command = string | number;

test("v14 carries the byte-exact mobile case bundle", () => {
  const bundle = readFileSync(new URL("../app/canonical-case-bundle.json", import.meta.url));
  assert.equal(createHash("sha256").update(bundle).digest("hex"), "e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a");
});

function run(caseId: string, seed: number, commands: Command[]) {
  let state = createCanonicalRuntime(caseId, seed);
  for (const command of commands) state = typeof command === "string" ? dispatchCanonicalAction(state, command) : advanceCanonicalTime(state, command);
  return state;
}

const erpPrepared = [
  "run-conflict-check", "prepare-partner-brief", "issue-preservation-notice", "delegate-review", "ask-ai-research", "request-documents",
  "review-junior-findings", "reject-settlement", "request-budget", "future-expert", "future-damages", "commence-proceedings",
  "prepare-statement-of-claim", "prepare-evidence-bundle", "rest", "rest", "review-expert-report", "prepare-hearing-strategy",
  "prepare-key-witness", "reconcile-damages-schedule", "wait-until-hearing", "attend-hearing", "rest", "inform-client-judgment",
  "prepare-cassation-response", "await-cassation-decision",
] satisfies Command[];

const greenProtected = [
  "accept_emergency_mandate", "issue_legal_hold", "run_conflict_assessment", "appoint_separate_director_counsel", "notify_insurers",
  "retain_independent_fire_expert", "open_controlled_regulator_channel", "submit_initial_regulatory_response", 360,
  "review_preliminary_fire_assessment", "establish_response_protocol", 360, 360, 360, 360, 360, 360, 360, 360, 360,
  "complete_protected_handoff",
] satisfies Command[];

const greenCompromised = ["accept_emergency_mandate", 360, "release_unreviewed_documents", 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, "complete_compromised_handoff"] satisfies Command[];

const shellCoordinated = [
  "accept_cooperative_mandate", "issue_coordinated_legal_hold", "preserve_reference_samples", "obtain_blocking_decisions", "notify_cleaning_contractor",
  "notify_farm_insurers", "coordinate_recall_response", "request_product_composition_records", "retain_independent_residue_expert", 360, 360,
  "review_preliminary_residue_assessment", "map_common_and_individual_losses", "prepare_protective_attachment_strategy",
  "establish_coordinated_claim_protocol", 360, 360, 360, 360, 360, 360, 360, "complete_coordinated_handoff",
] satisfies Command[];

const shellFragmented = ["accept_cooperative_mandate", "authorise_recall_without_reference_samples", "prioritise_regulator_claim", 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, "complete_fragmented_handoff"] satisfies Command[];

const desertCoordinated = [
  "accept_residents_mandate", "commission_defensible_sampling", "demand_plant_record_preservation", "interview_affected_residents",
  "map_wells_and_exposure_periods", "obtain_regulatory_records", "obtain_cooling_and_disposal_records", "retain_independent_hydrogeologist",
  "test_alternative_source_defence", "investigate_corporate_notice", "protect_limitation_period", 360, 90,
  "review_hydrological_source_assessment", "prepare_expert_evidence", 1185, "file_evidence_backed_claim", "receive_supported_first_instance_judgment",
] satisfies Command[];

const desertCompromised = [
  "accept_residents_mandate", "rely_on_unverified_samples", "interview_affected_residents", 511, 720, 1439,
  "prepare_incomplete_claim", "file_underdeveloped_claim", "receive_adverse_first_instance_judgment", "file_appeal",
  "receive_adverse_appeal_judgment", "close_after_adverse_appeal",
] satisfies Command[];

test("v14 reproduces the authoritative outcomes and clocks for all five library cases", () => {
  const traces: Array<{ caseId: string; seed: number; commands: Command[]; minute: number; stage: string; outcome: string | null }> = [
    { caseId: "be_commercial_failed_erp_001", seed: 20_260_724, commands: ["run-conflict-check", "request-documents", "future-settle"], minute: 570, stage: "resolved", outcome: "settlement_64500" },
    { caseId: "be_commercial_failed_erp_001", seed: 6, commands: erpPrepared, minute: 8_640, stage: "resolved", outcome: "judgment_preserved_after_cassation" },
    { caseId: "be_commercial_failed_erp_001", seed: 28, commands: [...erpPrepared, "continue-limited-cassation-review", "continue-remitted-rehearing", "rest"], minute: 10_080, stage: "post_judgment", outcome: null },
    { caseId: "be_commercial_logistics_001", seed: 0, commands: ["audit_claim_file", "issue_formal_demand", "accept_negotiated_payment"], minute: 270, stage: "resolved", outcome: "negotiated_recovery" },
    { caseId: "be_commercial_logistics_001", seed: 0, commands: ["audit_claim_file", "issue_formal_demand", "request_judgment", "enforce_judgment"], minute: 480, stage: "resolved", outcome: "judgment_recovery" },
    { caseId: "greenfire_first_72_hours", seed: 0, commands: greenProtected, minute: 4_440, stage: "handoff_complete", outcome: "protected_crisis_position" },
    { caseId: "greenfire_first_72_hours", seed: 0, commands: greenCompromised, minute: 4_590, stage: "handoff_complete", outcome: "compromised_crisis_position" },
    { caseId: "nl_food_safety_goldenshell_001", seed: 0, commands: shellCoordinated, minute: 4_545, stage: "handoff_complete", outcome: "coordinated_claim_position" },
    { caseId: "nl_food_safety_goldenshell_001", seed: 0, commands: shellFragmented, minute: 4_710, stage: "handoff_complete", outcome: "fragmented_claim_position" },
    { caseId: "us_environmental_desert_water_001", seed: 0, commands: desertCoordinated, minute: 3_180, stage: "resolved", outcome: "credible_source_and_remedy" },
    { caseId: "us_environmental_desert_water_001", seed: 0, commands: desertCompromised, minute: 3_510, stage: "resolved", outcome: "compromised_claim_closed" },
  ];
  for (const trace of traces) {
    const first = run(trace.caseId, trace.seed, trace.commands);
    const second = run(trace.caseId, trace.seed, trace.commands);
    assert.deepEqual(first, second);
    assert.equal(first.clockMinutes, trace.minute, `${trace.caseId} clock`);
    assert.equal(first.stageId, trace.stage, `${trace.caseId} stage`);
    assert.equal(first.outcomeId, trace.outcome, `${trace.caseId} outcome`);
  }
});

test("v14 exposes exact spend, billable time, stamina and verdict economics", () => {
  const settlement = run("be_commercial_failed_erp_001", 20_260_724, ["run-conflict-check", "request-documents", "future-settle"]);
  assert.deepEqual(
    { award: settlement.resources.award_eur, spend: settlement.resources.spend_eur, billable: settlement.resources.billable_minutes, costs: settlement.resources.outcome_costs_eur },
    { award: 64_500, spend: 2_350, billable: 540, costs: 0 },
  );
  const scenario = scenarios.find((item) => item.caseId === settlement.caseId)!;
  const decisions = ["run-conflict-check", "request-documents", "future-settle"].map((actionId) => ({
    option: scenario.stages.flatMap((stage) => stage.options).find((option) => option.canonicalActionId === actionId)!,
  }));
  const ledger = deriveRunLedger(scenario, decisions, { resources: settlement.resources, numericMetrics: settlement.numericMetrics });
  assert.equal(ledger.spendEur, 2_350);
  assert.equal(ledger.billableMinutes, 540);
  assert.equal(ledger.awardEur - ledger.outcomeCostsEur - ledger.spendEur, 62_150);
  assert.equal(ledger.spendAuthoritative, true);
  assert.equal(ledger.stamina, 100 - settlement.numericMetrics.fatigue);

  const coordinated = run("us_environmental_desert_water_001", 0, desertCoordinated);
  assert.equal(coordinated.resources.spend_eur, 54_150);
  assert.equal(coordinated.resources.billable_minutes, 1_545);
  const compromised = run("us_environmental_desert_water_001", 0, desertCompromised);
  assert.equal(compromised.resources.spend_eur, 23_350);
  assert.equal(compromised.resources.billable_minutes, 840);
});

test("v14 enforces global repeatability, future handoff gates and the next-workday recovery", () => {
  let erp = createCanonicalRuntime("be_commercial_failed_erp_001", 6);
  erp = dispatchCanonicalAction(erp, "run-conflict-check");
  erp = dispatchCanonicalAction(erp, "prepare-partner-brief");
  erp = dispatchCanonicalAction(erp, "issue-preservation-notice");
  assert.ok(!canonicalAvailableActionIds(erp).includes("issue-preservation-notice"));

  for (const action of ["delegate-review", "ask-ai-research", "request-documents", "review-junior-findings", "reject-settlement", "request-budget", "future-expert", "future-damages", "commence-proceedings", "prepare-statement-of-claim", "prepare-evidence-bundle"]) {
    erp = dispatchCanonicalAction(erp, action);
  }
  const beforeRest = canonicalPresentationState(erp);
  erp = dispatchCanonicalAction(erp, "rest");
  const afterRest = canonicalPresentationState(erp);
  assert.ok(afterRest.clockMinute > beforeRest.clockMinute);
  assert.equal(afterRest.clockMinute % 1_440, 8 * 60);
  assert.equal(erp.numericMetrics.fatigue, 0);
  assert.equal(erp.numericMetrics.cumulative_strain, 1);

  let green = createCanonicalRuntime("greenfire_first_72_hours", 0);
  green = dispatchCanonicalAction(green, "accept_emergency_mandate");
  assert.ok(!canonicalAvailableActionIds(green).includes("complete_compromised_handoff"));
  let shell = createCanonicalRuntime("nl_food_safety_goldenshell_001", 0);
  shell = dispatchCanonicalAction(shell, "accept_cooperative_mandate");
  shell = dispatchCanonicalAction(shell, "preserve_reference_samples");
  assert.ok(!canonicalAvailableActionIds(shell).includes("authorise_recall_without_reference_samples"));
});

test("canonical internal flags stay separate from the public presentation projection", () => {
  const runtime: CanonicalRuntimeState = dispatchCanonicalAction(createCanonicalRuntime("greenfire_first_72_hours", 0), "accept_emergency_mandate");
  const presentation = canonicalPresentationState(runtime) as Record<string, unknown>;
  assert.ok(Object.keys(runtime.flags).length > 0);
  assert.equal("flags" in presentation, false);
  assert.equal("decisionResolutions" in presentation, false);
  assert.ok(Array.isArray(presentation.availableActionIds));
});

test("canonical state is fingerprint-pinned and GreenFire exposes the mobile opening inbox", () => {
  const runtime = createCanonicalRuntime("greenfire_first_72_hours", 0);
  assert.ok(runtime.visibleInbox.includes("separate_counsel_decision"));
  assert.ok(normalizeCanonicalRuntimeState(runtime, runtime.caseId, runtime.sourceFingerprint));
  assert.equal(normalizeCanonicalRuntimeState({ ...runtime, sourceFingerprint: "sha256-tampered" }, runtime.caseId, runtime.sourceFingerprint), null);
});

test("verdict presentation is keyed by the authoritative outcome id", () => {
  const cassation = canonicalOutcomePresentation("be_commercial_failed_erp_001", "judgment_preserved_after_cassation");
  assert.equal(cassation?.classification, "strong");
  assert.match(cassation?.title.ru ?? "", /решени/i);
  const logistics = canonicalOutcomePresentation("be_commercial_logistics_001", "negotiated_recovery");
  assert.equal(logistics?.title.ru, "Согласованное взыскание");
});

test("canonical played-case exports retain an exact server session or local replay", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(source, /schemaVersion: activeScenario\.mobileParity \? 3 : 2/);
  assert.match(source, /mode: "server-session"/);
  assert.match(source, /expectedRevision: serverPlaySession\.revision/);
  assert.match(source, /session\.revision !== descriptor\.expectedRevision/);
  assert.match(source, /mode: "local-replay"/);
  assert.match(source, /runtimeModule\.dispatchCanonicalAction/);
  assert.match(source, /runtimeModule\.advanceCanonicalTime/);
});
