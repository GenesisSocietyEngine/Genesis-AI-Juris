import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { canonicalWebTaxJson, deriveWebTaxSource, projectWebTaxSource } from "../app/studio-tax-source";
import { normalizeStudioDraft } from "../app/case-integrity";
import { projectCaseCoreV2 } from "../app/case-core";
import { createWebTaxRepository } from "../app/tax-runtime/web-repository";
import { TAX_RUNTIME_CONTRACT, type TaxRuntime } from "../app/tax-runtime/runtime";
import type { StudioDraft } from "../app/types";

const fixture = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-source.json", import.meta.url), "utf8"));
const draft = (): StudioDraft => structuredClone(fixture.draft);

test("source fixture pins complete canonical bytes, independent SHA and exact CaseCore indexes", async () => {
  const source = await deriveWebTaxSource(draft());
  assert.deepEqual(source, { projection: fixture.projection, canonicalJson: fixture.canonicalJson, descriptor: fixture.descriptor });
  assert.equal(createHash("sha256").update(fixture.canonicalJson, "utf8").digest("hex"), source.descriptor.scenario_fingerprint);
  const core = projectCaseCoreV2(draft());
  assert.deepEqual(source.descriptor.fact_ids, core.facts.map(fact => fact.id).sort());
  assert.deepEqual(source.descriptor.reference_ids, core.evidence.map(item => item.id).sort());
  assert.equal((await deriveWebTaxSource(normalizeStudioDraft(draft()))).canonicalJson, source.canonicalJson, "browser snapshot and stored normalized source agree");
});

test("canonical encoding is locale independent, emits numeric keys in specified order and follows JSON scalar conventions", () => {
  const previous = String.prototype.localeCompare;
  String.prototype.localeCompare = () => { throw new Error("Locale sorting is forbidden for this source schema"); };
  try {
    for (const entry of fixture.canonicalCases) assert.equal(canonicalWebTaxJson(JSON.parse(entry.inputJson)), entry.expected);
    const value = { "2": "two", "10": "ten", z: undefined, A: -0, b: 1.25, c: null, s: "\ud800", text: "café\ncafe\u0301" };
    assert.equal(canonicalWebTaxJson(value), '{"10":"ten","2":"two","A":0,"b":1.25,"c":null,"s":"\\ud800","text":"café\\ncafé"}');
    assert.equal(canonicalWebTaxJson({ "\uffff": 2, "𐀀": 1 }), '{"𐀀":1,"￿":2}');
    assert.equal(canonicalWebTaxJson({ z: 3, a: 1 }), canonicalWebTaxJson({ a: 1, z: 3 }));
    assert.notEqual(canonicalWebTaxJson([1, 2]), canonicalWebTaxJson([2, 1]));
  } finally { String.prototype.localeCompare = previous; }
  for (const value of [NaN, Infinity, -Infinity, undefined, BigInt(1), () => {}, new Date(), [undefined], new Array(2)]) assert.throws(() => canonicalWebTaxJson(value));
});

test("every known source leaf is bound; tax/cache/audit/protection remain outside source identity", () => {
  const original = projectWebTaxSource(draft());
  const baseline = canonicalWebTaxJson(original);
  function leaves(value: unknown, path: string[] = []): string[][] {
    if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
    return [path];
  }
  for (const path of leaves(original.source)) {
    // Unsupported case-type identities must reject rather than produce another supported hash.
    if (path[0] === "caseType") continue;
    const changed = draft() as unknown as Record<string, unknown>;
    let parent = changed;
    for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    const key = path.at(-1)!;
    const old = parent[key];
    parent[key] = typeof old === "string" ? `${old}_changed` : typeof old === "number" ? old + 1 : typeof old === "boolean" ? !old : { changed: true };
    assert.notEqual(canonicalWebTaxJson(projectWebTaxSource(changed as unknown as StudioDraft)), baseline, path.join("."));
  }
  const changed = { ...draft(), taxEconomics: { future: true }, taxAnalysis: { document: "future original" }, updatedAt: "later", editHistory: [{ future: true }], protection: { future: true } };
  assert.equal(canonicalWebTaxJson(projectWebTaxSource(changed as unknown as StudioDraft)), baseline);
  const absent = draft(); delete absent.premisePublication;
  assert.notEqual(canonicalWebTaxJson(projectWebTaxSource(absent)), baseline);
});

test("same detached snapshot supplies projection and indexes despite mutation during asynchronous hashing", async () => {
  const input = draft();
  const pending = deriveWebTaxSource(input);
  input.caseId = "changed_after_call";
  input.nodes[0].id = "changed_node";
  input.nodes.reverse();
  input.links[0].rule!.detail = "changed rule";
  const result = await pending;
  assert.deepEqual(result.descriptor, fixture.descriptor);
  assert.equal(result.canonicalJson, fixture.canonicalJson);
  assert.equal(Object.isFrozen(result.projection.source.nodes[0]), true);
});

test("source IDs retain exact bytes; invalid future packages and duplicate indexes do not normalize into supported data", async () => {
  const input = draft(); input.caseId = "Ω".repeat(64);
  assert.equal((await deriveWebTaxSource(input)).descriptor.case_id, input.caseId);
  input.caseId += "Ω";
  await assert.rejects(deriveWebTaxSource(input), { field: "case_id" });
  input.caseId = " exact_identity ";
  assert.equal((await deriveWebTaxSource(input)).descriptor.case_id, " exact_identity ");
  input.nodes[1].id = input.nodes[0].id;
  await assert.rejects(deriveWebTaxSource(input), { field: "node.id" });
  const future = draft(); future.caseType!.version = "2.0.0" as "1.0.0";
  await assert.rejects(deriveWebTaxSource(future), /Unsupported case type version/);
  const unicode = draft(); unicode.nodes[0].id = "𐀀"; unicode.nodes[1].id = "\ue000";
  assert.deepEqual((await deriveWebTaxSource(unicode)).descriptor.fact_ids, ["\ue000", "𐀀"]);
  for (const malformed of ["\ud800", "\udc00", "a\ud800b", "\ud800\ud800", "\udc00\udc00"]) {
    const badCase = draft(); badCase.caseId = malformed;
    await assert.rejects(deriveWebTaxSource(badCase), { field: "case_id" });
    const badNode = draft(); badNode.nodes[0].id = malformed;
    await assert.rejects(deriveWebTaxSource(badNode), { field: "node.id" });
  }
  const overlap = draft(); overlap.nodes[2].id = overlap.nodes[0].id;
  await assert.rejects(deriveWebTaxSource(overlap), { field: "node.id" });
});

test("web repository fails closed and caches unsupported capability/runtime failures", async () => {
  for (const response of [JSON.stringify(TAX_RUNTIME_CONTRACT), "null", "not json", JSON.stringify({ ...TAX_RUNTIME_CONTRACT, type: "tax_web_capabilities", source_schema: "future", currencies: ["EUR", "GBP", "USD"] })]) {
    let commands = 0;
    const repository = createWebTaxRepository(async () => ({ capabilities: TAX_RUNTIME_CONTRACT, execute() { commands++; return response; } }));
    await assert.rejects(repository.prepare(draft(), { artifact_id: "x", revision: "0", currency: "EUR" }), { code: "incompatible_runtime" });
    await assert.rejects(repository.ready(), { code: "incompatible_runtime" });
    assert.equal(commands, 1, "only capability discovery executes, no fallback calculation");
  }
  let loads = 0;
  const repository = createWebTaxRepository(() => { loads++; throw new Error("unavailable"); });
  await assert.rejects(repository.ready(), /unavailable/);
  await assert.rejects(repository.ready(), /unavailable/);
  assert.equal(loads, 1);
});

test("web repository freezes source and raw arguments before readiness resolves", async () => {
  const commands: string[] = [];
  let resolve!: (runtime: TaxRuntime) => void;
  const ready = new Promise<TaxRuntime>(value => { resolve = value; });
  const repository = createWebTaxRepository(() => ready);
  const input = draft();
  const args = { artifact_id: "unchanged", revision: "9007199254740993", currency: "EUR" };
  const operation = repository.prepare(input, args);
  input.nodes[0].detail = "new input"; args.artifact_id = "late mutation";
  resolve({ capabilities: TAX_RUNTIME_CONTRACT, execute(command) {
    commands.push(command);
    return commands.length === 1 ? JSON.stringify({ ...TAX_RUNTIME_CONTRACT, type: "tax_web_capabilities", source_schema: "web-studio-tax-source-v1", currencies: ["EUR", "GBP", "USD"] }) : '{"type":"tax_error","detail":{"code":"example"}}';
  } });
  const result = await operation;
  assert.equal(result.response, '{"type":"tax_error","detail":{"code":"example"}}');
  assert.deepEqual(JSON.parse(result.request).source, fixture.descriptor);
  assert.equal(JSON.parse(result.request).artifact_id, "unchanged");
  assert.equal(JSON.parse(result.request).revision, "9007199254740993");
});
