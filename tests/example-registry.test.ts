import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { EXAMPLE_REGISTRY, exampleDescriptor, prepareExample, type ExampleId } from "../app/example-registry";

const baseline = JSON.parse(readFileSync("tests/example-registry-baseline.json", "utf8")) as Array<{
  id: ExampleId; locale: "en" | "ru"; caseId: string; version: string; fingerprint: string; workingSourceFingerprint: string;
}>;

test("the registry groups eighteen public packages into fifteen cards and retains the compatibility alternative", () => {
  const visible = EXAMPLE_REGISTRY.filter(item => item.visible);
  assert.equal(visible.length, 18);
  assert.equal(new Set(visible.map(item => item.cardId)).size, 15);
  assert.equal(new Set(EXAMPLE_REGISTRY.map(item => item.id)).size, 19);
  assert.deepEqual(visible.filter(item => item.family === "canopy").map(item => item.id), ["canopy:base", "canopy:upside", "canopy:hard_stop", "canopy:downside"]);
  assert.equal(exampleDescriptor("canopy:hard_stop_unavailable").visible, false);
  assert.throws(() => exampleDescriptor("converted:unknown"), /Unknown example/);
});

for (const row of baseline) test(`frozen pre-refactor ${row.locale} ${row.id} identity and semantic fingerprint survive registry preparation`, async () => {
  const descriptor = exampleDescriptor(row.id);
  const { draft, prompt } = await prepareExample(row.id, row.locale);
  assert.deepEqual(descriptor.source, { caseId: row.caseId, version: row.version });
  assert.equal(draft.caseId, row.caseId);
  assert.equal(draft.version, row.version);
  assert.equal(caseFingerprint(draft), row.fingerprint);
  assert.equal(draft.caseType?.id, descriptor.category);
  assert.ok(prompt.length > 0);
  const first = createExampleWorkingCopy(draft), second = createExampleWorkingCopy(draft);
  assert.notEqual(first.caseId, second.caseId);
  assert.deepEqual(first.exampleSource, second.exampleSource);
  assert.equal(first.exampleSource?.fingerprint, row.workingSourceFingerprint);
  assert.equal(caseFingerprint(draft), row.fingerprint, "preparing copies must not mutate the reference");
});
