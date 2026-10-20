import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { Miniflare, Log, LogLevel, Response as LocalResponse } from "miniflare";
import { createHash } from "node:crypto";
import { createPasswordCredential } from "../app/auth-crypto";
import { buildConvertedExample } from "../app/converted-examples";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { fixture as taxFixture } from "../tests/helpers/tax-report-fixture";
import { caseFingerprint } from "../app/case-integrity";
import { readStudioAggregate } from "../app/studio-aggregate";

// Execute the original inspected Worker/client, never a same-source rebuild.
// Current fixture factories only prepare labelled synthetic input, not executors.
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--directory") throw Error("Usage: --directory VERIFIED_ARTIFACT_DIRECTORY");
const directory = resolve(args[1]), allowed = resolve(".artifacts") + sep;
assert.ok(directory.startsWith(allowed), "Only isolated workspace artifacts may execute");
const inspection = JSON.parse(readFileSync(join(directory, "artifact-inspection.json"), "utf8"));
assert.equal(inspection.schema, "casevant.published-artifact-inspection.v1");
assert.equal(inspection.siteVersion, 149); assert.equal(inspection.sourceCommit, "bcd50f3342413fb5ac8cd55811a519d3c9b5239b");
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
for (const file of inspection.fileHashes) {
  const path = resolve(directory, file.path); assert.ok(path.startsWith(directory + sep));
  const bytes = readFileSync(path); assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256, `Changed archived byte: ${file.path}`);
}
const server = join(directory, "dist/server"), modules: Record<string, { type: "esm" | "wasm"; contents: Uint8Array<ArrayBuffer> }> = {};
function visit(path: string) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (/\.(js|wasm)$/.test(entry.name)) modules[relative(server, absolute).replaceAll("\\", "/")] = { type: entry.name.endsWith(".wasm") ? "wasm" : "esm", contents: new Uint8Array(readFileSync(absolute)) };
  }
}
visit(server); assert.equal(hash(modules["index.js"].contents), inspection.workerEntrySha256);
const name = "original-v149-synthetic-local-only", evidence = join(directory, "local-execution-" + new Date().toISOString().replaceAll(":", "-")); mkdirSync(evidence);
let outboundDenied = 0;
const mf = new Miniflare({ host: "127.0.0.2", port: 4175, cf: false, telemetry: { enabled: false }, log: new Log(LogLevel.WARN), resourceTmpPath: join(evidence, "runtime"),
  workers: [{ config: { name, type: "worker", compatibilityDate: "2026-09-16", compatibilityFlags: ["nodejs_compat"],
    manifest: { mainModule: "index.js", modulesRoot: server, modules },
    assets: { directory: join(directory, "dist/client"), hasUserWorker: true, runWorkerFirst: false },
    env: { DB: { type: "d1", name }, DOSSIER_DOCUMENTS: { type: "r2", name }, ASSETS: { type: "assets" } },
  }, dev: { outboundService: { type: "fetcher", handler: () => { outboundDenied++; return new LocalResponse("External network disabled in archived application QA", { status: 502 }); } } } }],
});
const receipt: Record<string, unknown> = { schema: "casevant.original-application-execution.v1", applicationVersion: 149, sourceCommit: inspection.sourceCommit,
  rawArchiveSha256: inspection.rawArchiveSha256, workerEntrySha256: inspection.workerEntrySha256, rebuilt: false,
  originalWorker: true, originalClient: true, currentFixturesOnly: true, productionBindingsUsed: false, outboundNetwork: "denied", status: "starting" };
async function stop() { await mf.dispose(); process.exit(0); }
process.on("SIGINT", () => void stop()); process.on("SIGTERM", () => void stop());
try {
  const d1 = await mf.getD1Database("DB", name) as unknown as D1Database;
  const journal = JSON.parse(readFileSync(join(directory, "dist/.openai/drizzle/meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) await d1.batch(readFileSync(join(directory, `dist/.openai/drizzle/${entry.tag}.sql`), "utf8").split("--> statement-breakpoint").map(text => text.trim()).filter(Boolean).map(text => d1.prepare(text)));
  const email = "original-v149-owner@example.test", foreign = "original-v149-foreign@example.test", password = "Synthetic-Local-Artifact-QA-2026!";
  const credential = await createPasswordCredential(password);
  for (const actor of [email, foreign]) {
    await d1.prepare("insert into users(email,display_name) values(?,?)").bind(actor, "SYNTHETIC archived application QA").run();
    await d1.prepare("insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)").bind(actor, credential.hash, credential.salt, credential.iterations, "2026-01-01T00:00:00.000Z").run();
  }
  const fixtures: Array<Record<string, unknown>> = [];
  const fixtureDirectory = join(evidence, "fixtures"); mkdirSync(fixtureDirectory);
  const cases = [
    ["erp-2.2-en", buildConvertedExample("be_commercial_failed_erp_001", "en", "2026-10-20T10:00:00Z", "2.2.0")],
    ["erp-2.5-ru", buildConvertedExample("be_commercial_failed_erp_001", "ru", "2026-10-20T10:00:00Z", "2.5.0")],
    ["greenfire-2.3-en", buildConvertedExample("greenfire_first_72_hours", "en", "2026-10-20T10:00:00Z", "2.3.0")],
    ["greenfire-2.5-ru", buildConvertedExample("greenfire_first_72_hours", "ru", "2026-10-20T10:00:00Z", "2.5.0")],
    ["canopy-base-en", buildCanopyPackage("base").draft], ["full-tax-en", taxFixture().draft],
  ] as const;
  for (const [id, original] of cases) {
    const draft = structuredClone(original); draft.caseId = `qa_original_v149_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    draft.title = `SYNTHETIC original v149 QA — ${id}`;
    draft.nodes[0].mapPosition = { x: 413, y: 14003 };
    const raw = JSON.stringify(draft, null, "\t") + "\r\n", path = join(fixtureDirectory, id + ".json");
    const preflight = readStudioAggregate(raw, { kind: "draft" });
    assert.equal(preflight.status, "editable", `Invalid synthetic fixture ${id}: ${preflight.status === "editable" ? "" : preflight.reason}`);
    writeFileSync(path, raw);
    fixtures.push({ id, templateVersion: original.version, caseId: draft.caseId, envelopeVersion: null, kind: "raw-draft", bytes: Buffer.byteLength(raw), sha256: hash(raw), path });
  }
  const known = structuredClone(cases[4][1]); known.caseId = "qa_original_v149_stored_recovery"; known.title = "SYNTHETIC owner-only unsupported recovery";
  const raw = JSON.stringify({ ...known, futureExact: "__RAW_BIG__" }, null, "\t").replace('"__RAW_BIG__"', "900719925474099312345") + "\r\n";
  await d1.prepare("insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint,is_private) values(1,?,?,?,?,?,1)").bind(email, known.caseId, known.title, known.version, caseFingerprint(known)).run();
  await d1.prepare("insert into case_drafts(id,custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(1,1,?,?,?,?,?,?)").bind(email, known.caseId, known.version, caseFingerprint(known), known.title, raw).run();
  writeFileSync(join(fixtureDirectory, "stored-owner-original.json"), raw);
  const login = async (actor: string) => {
    const response = await mf.dispatchFetch("http://127.0.0.2:4175/api/auth/login", { method: "POST", headers: { origin: "http://127.0.0.2:4175", "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify({ email: actor, password }) });
    assert.equal(response.status, 200, await response.clone().text()); const cookie = response.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie); return cookie;
  };
  const ownerCookie = await login(email), foreignCookie = await login(foreign);
  const snapshot = async () => JSON.stringify({ cases: (await d1.prepare("select * from custom_cases order by id").all()).results, drafts: (await d1.prepare("select * from case_drafts order by id").all()).results, audits: (await d1.prepare("select * from audit_events order by id").all()).results });
  const before = await snapshot();
  const owner = await mf.dispatchFetch("http://127.0.0.2:4175/api/custom-cases?id=1", { headers: { cookie: ownerCookie } }); assert.equal(owner.status, 200);
  const recovered = await owner.json() as { recovery: { rawText: string; canExport: boolean } }; assert.equal(recovered.recovery.canExport, true); assert.equal(recovered.recovery.rawText, raw);
  const denied = await mf.dispatchFetch("http://127.0.0.2:4175/api/custom-cases?id=1", { headers: { cookie: foreignCookie } }); assert.equal(denied.status, 404); assert.ok(!(await denied.text()).includes("futureExact"));
  assert.equal(await snapshot(), before, "Original Worker recovery and foreign denial must write no case/audit row");
  const page = await mf.dispatchFetch("http://127.0.0.2:4175/studio?lang=en"); assert.equal(page.status, 200); const html = await page.text(); assert.ok(html.includes("CaseVant"));
  const paths = [...html.matchAll(/(?:src|href)="(\/_next\/[^"?]+\.(?:js|css))"/g)].map(match => match[1]); assert.ok(paths.length >= 2);
  const assets = [];
  for (const path of [...new Set(paths)]) {
    const response = await mf.dispatchFetch("http://127.0.0.2:4175" + path); assert.equal(response.status, 200, `Original client asset ${path}`);
    const bytes = new Uint8Array(await response.arrayBuffer()), archived = readFileSync(join(directory, "dist/client", path));
    assert.equal(hash(bytes), hash(archived)); assert.match(response.headers.get("content-type") ?? "", path.endsWith(".css") ? /text\/css/ : /javascript/);
    assets.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  Object.assign(receipt, { status: "serving-local", url: "http://127.0.0.2:4175", checks: { ownerRecovery: 200, foreignDenial: 404, exactRawSha256: hash(raw), zeroCaseAndAuditWrites: true, originalPage: 200, originalClientAssets: assets }, fixtures, outboundDenied });
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify({ ...receipt, fixtures: `${fixtures.length} labelled local fixture files; hashes in receipt.json`, syntheticLogin: { email, password }, note: "Test-only local credentials; no real account, token, production binding or archive modification." }));
  await mf.ready;
} catch (error) {
  Object.assign(receipt, { status: "failed", error: error instanceof Error ? error.message : String(error), outboundDenied });
  writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n"); await mf.dispose(); throw error;
}
