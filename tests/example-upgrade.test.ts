import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import bundle from "../app/canonical-case-bundle.json";
import { buildConvertedExample, CONVERTED_EXAMPLES } from "../app/converted-examples";
import { buildConvertedProjectionAudit } from "../app/converted-projection-audit";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { buildExampleProvenance } from "../app/example-provenance";
import { prepareExampleUpgrade, createReviewedExampleUpgrade, compareExampleContent } from "../app/example-upgrade";
import { normalizeStudioDraft } from "../app/case-integrity";

test("all projection gaps are resolved in new templates; historical ERP and GreenFire audit gaps remain truthful", async () => {
  const original = JSON.stringify(bundle);
  for (const id of Object.keys(CONVERTED_EXAMPLES)) for (const language of ["en", "ru"] as const) {
    const next = normalizeStudioDraft(buildConvertedExample(id, language));
    const { audit, issues } = buildConvertedProjectionAudit(id, next);
    assert.deepEqual(issues, []); assert.deepEqual(audit.entries.filter(entry => entry.disposition === "requires_review"), []);
    assert.ok(next.nodes.length <= 200 && next.links.length <= 500);
    const legacy = createExampleWorkingCopy(buildConvertedExample(id, language, undefined, "2.2.0"));
    const manifest = await buildExampleProvenance(legacy);
    assert.ok(manifest); assert.equal(manifest.source.version, "2.2.0");
    if (id === "be_commercial_failed_erp_001") assert.equal(manifest.status.requiresReview, 10);
    if (id === "greenfire_first_72_hours") assert.equal(manifest.status.requiresReview, 6);
    for (const entry of audit.entries.filter(entry => entry.kind === "events" && typeof entry.original === "object" && entry.original && "effects" in entry.original && Array.isArray(entry.original.effects) && !entry.original.effects.length)) {
      if (entry.disposition === "excluded_gameplay") continue;
      assert.equal(entry.disposition, "hypothetical"); assert.ok(entry.targets.length);
      assert.ok(next.nodes.find(node => node.id === entry.targets[0])?.detail.includes("occurrence is not recorded"));
    }
  }
  assert.equal(JSON.stringify(bundle), original);
});

test("review and cancellation preserve original bytes; acceptance creates separate latest lineage without adopting local work or approval", async () => {
  const old = createExampleWorkingCopy(buildConvertedExample("be_commercial_failed_erp_001", "en", undefined, "2.2.0"));
  old.nodes[0].detail += " My independent analysis.";
  const bytes = JSON.stringify(old), review = await prepareExampleUpgrade(old);
  assert.ok(review); assert.equal(review.fromVersion, "2.2.0"); assert.equal(review.toVersion, "2.3.0");
  assert.ok(review.changes.some(change => change.id === "event-appeal_authorized"));
  assert.ok(review.localChanges.some(change => change.id === "brief"));
  assert.equal(await createReviewedExampleUpgrade(old, review, () => false), null);
  const copy = await createReviewedExampleUpgrade(old, review, () => true);
  assert.ok(copy); assert.notEqual(copy.caseId, old.caseId); assert.equal(copy.exampleSource?.version, "2.3.0");
  assert.equal(copy.parent, null); assert.equal(copy.protection, undefined);
  assert.ok(!copy.nodes[0].detail.includes("My independent analysis"));
  assert.equal(JSON.stringify(old), bytes);
  assert.deepEqual(await buildExampleProvenance(JSON.parse(JSON.stringify(copy))), await buildExampleProvenance(copy));
  assert.equal(await prepareExampleUpgrade(copy), null);
});

test("stale content, changed authority, forged source and altered preview cannot authorize an upgrade", async () => {
  const old = createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours", "ru", undefined, "2.2.0"));
  const review = await prepareExampleUpgrade(old); assert.ok(review);
  const changed = structuredClone(old); changed.premise += " changed";
  assert.equal(await createReviewedExampleUpgrade(changed, review, () => true), null);
  let checks = 0;
  assert.equal(await createReviewedExampleUpgrade(old, review, () => ++checks < 2), null);
  assert.equal(await createReviewedExampleUpgrade(old, { ...review, changes: [] }, () => true), null);
  const forged = structuredClone(old); forged.exampleSource!.fingerprint = "sha256-" + "0".repeat(64);
  assert.equal(await prepareExampleUpgrade(forged), null);
});

test("semantic review includes connections and context, while layout changes do not masquerade as content", () => {
  const before = buildConvertedExample("greenfire_first_72_hours", "en"), after = structuredClone(before);
  after.nodes[0].x += 500; after.updatedAt = "different";
  after.links.forEach((link, index) => { link.id = "renumbered-" + index; });
  assert.deepEqual(compareExampleContent(before, after), []);
  after.links[0].rule = { ...after.links[0].rule, label: "amended relationship" }; after.jurisdiction += " revised";
  assert.ok(compareExampleContent(before, after).some(change => change.area === "connection"));
  assert.ok(compareExampleContent(before, after).some(change => change.area === "context" && change.id === "jurisdiction"));
});

test("actual Studio acceptance handler rejects pending, stale, denied and cancelled replacement; successful new-copy flow reaches Overview", () => {
  const source = readFileSync("app/JurisApp.tsx", "utf8");
  const start = source.indexOf("  function openUpdatedExample("), end = source.indexOf("  function startCaseTemplate(", start);
  const handler = source.slice(start, end).replace("expectedFingerprint: string, next: StudioDraft", "expectedFingerprint, next");
  const old = createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours", "en", undefined, "2.2.0"));
  const next = createExampleWorkingCopy(buildConvertedExample("greenfire_first_72_hours", "en"));
  for (const mode of ["pending", "stale", "denied", "cancelled", "accepted"]) {
    let resets = 0, overview = 0;
    const context = { studioOperationPending: {current: mode === "pending"}, studioCanDuplicate: mode !== "denied", studioReportAuthority: {allowed:true},
      caseFingerprint: () => "exact", draftRef:{current:old}, resetStudioDraft: (received: unknown) => { assert.equal(received, next); resets++; return mode !== "cancelled"; }, enterExampleOverview: () => {overview++;} };
    const accepted = runInNewContext(handler + "; openUpdatedExample", context)(mode === "stale" ? "stale" : "exact", next);
    assert.equal(accepted, mode === "accepted"); assert.equal(overview, mode === "accepted" ? 1 : 0);
    assert.equal(resets, ["cancelled", "accepted"].includes(mode) ? 1 : 0);
  }
});
