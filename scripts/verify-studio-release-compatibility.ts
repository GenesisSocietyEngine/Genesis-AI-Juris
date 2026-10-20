import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { buildPinnedStudioReader } from "./lib/pinned-studio-reader";
import { EXAMPLE_REGISTRY, prepareExampleVersion } from "../app/example-registry";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { buildConvertedExample } from "../app/converted-examples";
import { buildCategoryDemo } from "../app/category-demo-draft";
import { caseFingerprint } from "../app/case-integrity";
import { fixture as taxFixture } from "../tests/helpers/tax-report-fixture";
import type { StudioDraft } from "../app/types";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--output")) throw new Error("Usage: --output RECEIPT_PATH");
const output = resolve(root, args[1] ?? ".artifacts/release-compatibility/receipt.json");
const releases = [
  { release: "v148", commit: "6e2910758a6f13b4bf1a65167bbc070c4a950792", rejectsUnknownFields: false },
  { release: "v149", commit: "bcd50f3342413fb5ac8cd55811a519d3c9b5239b", rejectsUnknownFields: true },
  { release: "v150", commit: "d4547efd3fcc1f36207f121ffe43348fc8530f6f", rejectsUnknownFields: true },
];
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const scope = "a".repeat(64);
const factoryTimestamp = "2026-10-20T06:00:00.000Z";
const fixtures: Array<{ id: string; draft: StudioDraft; sourceFactoryOutputSha256: string; sourceFingerprint: string }> = [];
for (const descriptor of EXAMPLE_REGISTRY) for (const version of descriptor.family === "converted" ? ["2.2.0", "2.3.0", "2.4.0", descriptor.source.version] : [descriptor.source.version]) for (const locale of ["en", "ru"] as const) {
  // The converted/category factories accept their clock; never alter a factory,
  // frozen content hash or historical object merely to stabilize the receipt.
  const source = descriptor.family === "converted" ? buildConvertedExample(descriptor.source.caseId,locale,factoryTimestamp,version)
    : descriptor.family === "category" ? buildCategoryDemo(descriptor.category,locale,factoryTimestamp)
    : (await prepareExampleVersion(descriptor.id, locale, version)).draft;
  assert.equal(source.caseId,descriptor.source.caseId); assert.equal(source.version,version); assert.equal(source.caseType?.id,descriptor.category);
  const before = JSON.stringify(source), fingerprint = caseFingerprint(source);
  const draft = createExampleWorkingCopy(source);
  draft.caseId = `qa_release_matrix_${hash(`${descriptor.id}/${version}/${locale}`).slice(0,24)}`;
  draft.updatedAt = factoryTimestamp;
  draft.nodes[0].mapPosition = { x: 413, y: 14003 };
  assert.equal(JSON.stringify(source), before); assert.equal(caseFingerprint(source), fingerprint);
  fixtures.push({ id: `${descriptor.id}@${version}/${locale}`, draft: copy(draft), sourceFactoryOutputSha256: hash(before), sourceFingerprint: fingerprint });
}
assert.equal(fixtures.length, 68);
const taxSource = taxFixture().draft, taxSourceBytes = JSON.stringify(taxSource), taxSourceFingerprint = caseFingerprint(taxSource);
const tax = createExampleWorkingCopy(taxSource); tax.caseId = "qa_release_matrix_tax"; tax.updatedAt = factoryTimestamp; tax.nodes[0].mapPosition = { x: 413, y: 14003 };
assert.equal(JSON.stringify(taxSource),taxSourceBytes); assert.equal(caseFingerprint(taxSource),taxSourceFingerprint);
fixtures.push({ id: "synthetic-complete-tax-carrier", draft: copy(tax), sourceFactoryOutputSha256: hash(taxSourceBytes), sourceFingerprint: taxSourceFingerprint });
const rows: Array<Record<string, unknown>> = [], provenance: Array<Record<string, unknown>> = [];
for (const release of releases) {
  const { api, provenance: receipt } = await buildPinnedStudioReader(root, release.commit, resolve(dirname(output), "modules"));
  provenance.push({ release: release.release, ...receipt });
  for (const fixture of fixtures) {
    const draft = copy(fixture.draft), expected = copy(draft), raw = JSON.stringify(draft, null, "\t") + "\r\n";
    const read = api.readStudioAggregate(raw, { kind: "draft" });
    assert.equal(read.status, "editable", `${release.release}/${fixture.id}: known draft`);
    assert.equal(read.rawText, raw); assert.deepEqual(copy(read.draft), expected);
    const envelope = JSON.stringify({ format: "genesis-juris-custom-case", schemaVersion: draft.taxAnalysis ? 5 : 4, draft });
    const carrier = api.readStudioAggregate(envelope, { kind: "custom-case" });
    assert.equal(carrier.status, "editable"); assert.equal(carrier.rawText, envelope); assert.deepEqual(copy(carrier.draft), expected);
    const values = new Map<string,string>();
    const storage = { getItem: (key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value);}, removeItem:(key:string)=>{values.delete(key);} };
    api.writeStudioDeviceDraft(storage, scope, draft);
    const device = api.readStudioDeviceDraft(storage, scope);
    assert.equal(device.status, "editable"); assert.deepEqual(copy(device.draft), expected);
    const revision = api.applyStudioSnapshot(draft, api.snapshotStudioDraft(draft), draft.updatedAt);
    assert.deepEqual(copy(revision), expected);
    assert.equal(JSON.stringify(draft), JSON.stringify(fixture.draft), "Historical execution must not mutate input");
    rows.push({ release: release.release, fixture: fixture.id, kind: "known-carriers", status: "preserved", checks: ["draft-and-raw", "custom-envelope-and-raw", "device-write-reopen", "revision-apply", "input-immutable"],
      fixtureSha256: hash(raw), sourceFactoryOutputSha256: fixture.sourceFactoryOutputSha256, sourceFingerprint: fixture.sourceFingerprint });
  }
  const base = fixtures[0].draft;
  for (const field of ["node", "position", "classification", "root"] as const) {
    const draft = copy(base);
    if (field === "node") Object.assign(draft.nodes[0], { futureReview: { exact: "900719925474099312345" } });
    if (field === "position") Object.assign(draft.nodes[0].mapPosition!, { futureUnit: "mm" });
    if (field === "classification") Object.assign(draft.classification!, { futureSourceReview: ["retain"] });
    if (field === "root") Object.assign(draft, { futureCarrier: { exact: "900719925474099312345" } });
    const raw = JSON.stringify(draft, null, "\t") + "\r\n", read = api.readStudioAggregate(raw, { kind: "draft" });
    assert.equal(read.rawText, raw);
    const lossy = read.status === "editable" && !isDeepStrictEqual(copy(read.draft), draft);
    if (release.rejectsUnknownFields) assert.equal(read.status, "unsupported", `${release.release}/${field}: future work requires recovery`);
    else assert.ok(read.status === "unsupported" || lossy, "Historical hazard must be detected, not accepted as compatible");
    rows.push({ release: release.release, fixture: `future-${field}`, kind: "future-field", status: lossy ? "unsafe-lossy-editable" : read.status, compatible: !lossy, rawSha256: hash(raw), rawPreserved: true });
    const denied = api.readStudioAggregate(raw, { kind: "draft", access: "denied" });
    assert.equal(denied.status,"denied"); assert.equal(Object.hasOwn(denied,"rawText"),false);
    const deviceRaw = JSON.stringify({ format: "genesis-juris-device-draft", schemaVersion: 2, scope, draft }, null, "\t") + "\r\n";
    const values = new Map([[`genesis-juris-device-draft-v2:${scope}`,deviceRaw],[`genesis-juris-device-draft-v1:${scope}`,JSON.stringify({format:"genesis-juris-device-draft",schemaVersion:1,scope,draft:base})]]);
    const originals = [...values]; let writes = 0;
    const storage = { getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{writes++;values.set(key,value);},removeItem:(key:string)=>{writes++;values.delete(key);} };
    const deviceRead = api.readStudioDeviceDraft(storage,scope); let writeOutcome = "written";
    try { api.writeStudioDeviceDraft(storage,scope,base); } catch { writeOutcome = "blocked"; }
    const originalsPreserved = isDeepStrictEqual([...values],originals);
    if(release.rejectsUnknownFields){ assert.equal(deviceRead.status,"unsupported");assert.equal(writeOutcome,"blocked");assert.equal(writes,0);assert.equal(originalsPreserved,true); }
    rows.push({release:release.release,fixture:`future-device-${field}`,kind:"future-device",status:originalsPreserved&&writes===0?"preserved-readonly":"unsafe-device-replacement",deviceReadStatus:deviceRead.status,writeOutcome,writes,originalsPreserved,rawSha256:hash(deviceRaw)});
  }
  const future = JSON.stringify({ format: "genesis-juris-custom-case", schemaVersion: 999, draft: base }, null, "\t") + "\r\n";
  const read = api.readStudioAggregate(future, { kind: "custom-case" });
  assert.equal(read.status,"unsupported"); assert.equal(read.rawText,future);
  rows.push({ release: release.release, fixture: "unknown-envelope-999", kind: "future-envelope", status: read.status, rawPreserved: true, rawSha256: hash(future) });
}
const unsafe = rows.filter(row=>String(row.status).startsWith("unsafe-"));
const receipt = { schema: "casevant.release-data-module-matrix.v1", executionPassed: true,
  allReleasesSafe: unsafe.length === 0,
  boundary: "Original historical data modules only. No historical UI binary, server authorization, production browser save or upgrade-merge acceptance.",
  node: process.version, factoryTimestamp, lockSha256: hash(readFileSync(resolve(root,"package-lock.json"))), provenance,
  knownFixtures: fixtures.length, knownRows: rows.filter(row=>row.kind === "known-carriers").length, rows, unsafeRows: unsafe.length,
  recommendation: "Known carriers preserved in tested modules. v148 future-field handling is unsafe where marked; use current recovery guards and preserve original bytes. Never substitute current templates or treat a successful harness run as universal backward compatibility." };
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({ output, executionPassed: true, allReleasesSafe: receipt.allReleasesSafe, knownFixtures: receipt.knownFixtures, knownRows: receipt.knownRows, unsafeRows: unsafe, boundary: receipt.boundary }));
