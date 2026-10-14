import assert from "node:assert/strict";
import test from "node:test";
import bundle from "../app/canonical-case-bundle.json";
import { EXAMPLE_REGISTRY, prepareExample } from "../app/example-registry";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { caseFingerprint, canonicalFingerprint } from "../app/case-integrity";
import { buildExampleProvenance, prepareExampleProvenanceDownload } from "../app/example-provenance";
import { buildConvertedProjectionAudit } from "../app/converted-projection-audit";
import { projectionInventory, validateProjectionAudit } from "../app/projection-audit";
import { buildConvertedExample } from "../app/converted-examples";

for (const descriptor of EXAMPLE_REGISTRY) for (const locale of ["en", "ru"] as const) test(`provenance ${descriptor.id} ${locale}: exact reference, independent copy and source preservation`, async () => {
  const before = JSON.stringify(bundle);
  const { draft } = await prepareExample(descriptor.id, locale);
  const copy = createExampleWorkingCopy(draft), original = JSON.stringify(copy);
  const manifest = await buildExampleProvenance(copy);
  assert.ok(manifest); assert.equal(manifest.source.packageId, descriptor.id);
  assert.equal(manifest.source.language, locale === "ru" && descriptor.family !== "canopy" ? "ru" : "en");
  assert.equal(manifest.source.fingerprint, copy.exampleSource?.fingerprint);
  assert.deepEqual(manifest.status.integrityIssues, []); assert.equal(manifest.status.professionalReview, "not_recorded");
  assert.equal(manifest.status.synthetic, true); assert.equal(manifest.status.workingChanges, 0); assert.equal(manifest.status.workingContentChanged, false);
  assert.ok(manifest.entries.every(entry => entry.reason && entry.sourceFingerprint === canonicalFingerprint(entry.original)));
  assert.ok(manifest.entries.every(entry => entry.workingTargets.every(target => target.state === "unchanged")));
  assert.equal(JSON.stringify(copy), original); assert.equal(JSON.stringify(bundle), before);
  const reopened = JSON.parse(original);
  assert.deepEqual(await buildExampleProvenance(reopened), manifest);
  const exportFile = await prepareExampleProvenanceDownload(copy, () => true);
  assert.ok(exportFile); assert.deepEqual(JSON.parse(exportFile.content), manifest);
  assert.equal(caseFingerprint(reopened), caseFingerprint(copy));
});

test("unrecognized, historical or fabricated lineage cannot receive a current-template audit", async () => {
  const draft = createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours", "en"));
  const raw = JSON.stringify(draft);
  for (const change of [{ caseId: "unknown" }, { version: "2.1.0" }, { fingerprint: "sha256-" + "0".repeat(64) }]) {
    const altered = structuredClone(draft); Object.assign(altered.exampleSource!, change);
    assert.equal(await buildExampleProvenance(altered), null);
  }
  const named = structuredClone(draft); delete named.exampleSource; named.caseId = "greenfire_first_72_hours";
  named.nodes[0].detail += " A familiar name is insufficient.";
  assert.equal(await buildExampleProvenance(named), null);
  assert.equal(JSON.stringify(draft), raw);
});

test("edited/missing/added statements and changed links/context differ without upgrading the saved case", async () => {
  const draft = createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours", "en"));
  const source = JSON.stringify(draft);
  draft.nodes[0].detail += " Hypothetical amendment.";
  const removed = draft.nodes.splice(1, 1)[0];
  draft.nodes.push({ id: "working-only", type: "fact", factStatus: "assumed", title: "Local disputed assertion", detail: "No template provenance", x: 0, y: 0 });
  const manifest = await buildExampleProvenance(draft);
  assert.ok(manifest); assert.equal(manifest.status.workingContentChanged, true); assert.equal(manifest.status.workingChanges, 3);
  assert.ok(manifest.entries.some(entry => entry.workingTargets.some(target => target.id === removed.id && target.state === "missing")));
  assert.deepEqual(manifest.workingOnlyNodeIds, ["working-only"]);
  assert.ok(!manifest.entries.some(entry => entry.targets.includes("working-only")));
  const context = JSON.parse(source); context.premise += " Changed mandate."; context.links.pop();
  const changed = await buildExampleProvenance(context);
  assert.equal(changed?.status.workingChanges, 0); assert.equal(changed?.status.workingContentChanged, true);
});

test("every original converted record, effect, action reference and nested condition is accounted for", () => {
  for (const source of bundle.cases) {
    const draft = buildConvertedExample(source.case_id, "en");
    const { audit, issues } = buildConvertedProjectionAudit(source.case_id, draft);
    assert.deepEqual(issues, []);
    const inventory = projectionInventory(source.scenario as unknown as Record<string, unknown>);
    assert.deepEqual(audit.entries.map(entry => entry.path), inventory.map(entry => entry.path));
    for (const kind of ["effect", "condition"]) assert.ok(audit.entries.some(entry => entry.kind === kind));
    assert.ok(audit.entries.filter(entry => entry.disposition === "excluded_gameplay").every(entry => entry.reason && !entry.targets.length));
    assert.ok(audit.entries.filter(entry => entry.kind === "effect" && typeof entry.original === "object" && entry.original !== null && "resource" in entry.original)
      .filter(entry => String((entry.original as {resource:string}).resource).endsWith("_eur")).every(entry => entry.disposition !== "excluded_gameplay"
        || audit.entries.some(parent => parent.path === entry.path.split("/effects/")[0] && parent.disposition === "excluded_gameplay")
          && entry.reason.includes("explicitly training-only parent")));
  }
});

test("coverage validation rejects missing records, unexplained exclusions, altered operands and absent graph targets", () => {
  const source = bundle.cases[0], draft = buildConvertedExample(source.case_id, "en");
  const { audit } = buildConvertedProjectionAudit(source.case_id, draft);
  const scenario = source.scenario as unknown as Record<string, unknown>;
  const missing = structuredClone(audit); missing.entries.pop();
  assert.ok(validateProjectionAudit(missing, scenario, draft, source.scenario_fingerprint).some(issue => issue.startsWith("unaccounted-source:")));
  const unexplained = structuredClone(audit); unexplained.entries.find(entry => entry.disposition === "excluded_gameplay")!.reason = "";
  assert.ok(validateProjectionAudit(unexplained, scenario, draft, source.scenario_fingerprint).some(issue => issue.startsWith("unexplained-disposition:")));
  const changed = structuredClone(audit); changed.entries.find(entry => entry.kind === "condition")!.original = {type:"all",conditions:[]};
  assert.ok(validateProjectionAudit(changed, scenario, draft, source.scenario_fingerprint).some(issue => issue.startsWith("source-mismatch:")));
  const target = structuredClone(audit); target.entries.find(entry => entry.targets.length)!.targets = ["not-a-node"];
  assert.ok(validateProjectionAudit(target, scenario, draft, source.scenario_fingerprint).some(issue => issue.startsWith("unknown-projection-target:")));
  const identity = structuredClone(audit); identity.source.scenarioFingerprint = "fabricated";
  assert.ok(validateProjectionAudit(identity, scenario, draft, source.scenario_fingerprint).includes("source-identity-mismatch"));
});

test("unknown effects and monetary comparisons require review; substantive constraint actions are never classified as strain", () => {
  const source = bundle.cases[0], scenario = source.scenario as unknown as { actions: Array<Record<string,unknown>> };
  const original = JSON.stringify(bundle);
  const action = { ...structuredClone(scenario.actions[0]), id: "assess_contract_constraint", effects: [{type:"unknown_regulatory_effect",value:42}],
    available_when: {type:"integer_compare",left:{source:"resource",resource:"authorized_budget_eur"},operator:"less_than",right:{source:"constant",value:10000}} };
  scenario.actions.push(action);
  try {
    const {audit} = buildConvertedProjectionAudit(source.case_id, buildConvertedExample(source.case_id, "en"));
    const entries = audit.entries.filter(entry => entry.sourceId === action.id);
    assert.ok(entries.some(entry => entry.kind === "actions" && entry.disposition === "hypothetical"));
    assert.ok(entries.filter(entry => ["effect","condition"].includes(entry.kind)).every(entry => entry.disposition === "requires_review"));
    assert.ok(!entries.some(entry => entry.disposition === "excluded_gameplay"));
  } finally { scenario.actions.pop(); }
  assert.equal(JSON.stringify(bundle), original);
});

test("a stale export cannot finish after context or authority changes", async () => {
  const draft = createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours", "en"));
  let calls = 0;
  assert.equal(await prepareExampleProvenanceDownload(draft, () => ++calls === 1), null);
  assert.equal(await prepareExampleProvenanceDownload(draft, () => false), null);
});
