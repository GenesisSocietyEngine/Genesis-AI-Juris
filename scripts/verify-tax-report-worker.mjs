/** Execute the built production Worker, real authentication and v3 history.
 * No product test route/export or replacement tax executor is introduced. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Miniflare, Log, LogLevel } from "miniflare";
import { buildReleaseIdentity } from "../build/release-identity.ts";
import { createPasswordCredential } from "../app/auth-crypto.ts";
import { caseFingerprint } from "../app/case-integrity.ts";
import { studioDeviceScope } from "../app/studio-device-storage.ts";
import { buildTaxCaseReportArtifacts } from "../app/case-report.ts";
import { taxReportReceipt } from "../app/tax-report-receipt.ts";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node.ts";
import { attach, reportFixture, reportOptions } from "../tests/helpers/tax-report-fixture.ts";

const root = fileURLToPath(new URL("../", import.meta.url)), directory = join(root, "dist/server");
const runId = `${new Date().toISOString().replaceAll(":", "-")}-${process.pid}`;
const evidence = join(root, ".artifacts/tax-report-worker", runId); mkdirSync(evidence, { recursive: true });
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(import.meta.url);
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const receipt = { schema: "juris.tax-report-worker.v1", runId, status: "preflight", checks: {} };
try {
const clean = git("status", "--porcelain", "--untracked-files=all") === "";
const identity = buildReleaseIdentity(root);
const manifest = JSON.parse(readFileSync(join(directory, "tax-runtime-entry.json"), "utf8"));
assert.equal(manifest.schema, "juris.tax-runtime-entry.v1"); assert.equal(manifest.environment, "rsc");
assert.equal(manifest.applicationInputsSha256, identity.applicationInputsSha256, "Rebuild on the current application inputs.");
if (clean) assert.equal(manifest.sourceCommit, git("rev-parse", "HEAD"));
const modules = {};
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (/\.(js|wasm)$/.test(entry.name)) modules[relative(directory, absolute).replaceAll("\\", "/")] = { type: entry.name.endsWith(".wasm") ? "wasm" : "esm", contents: readFileSync(absolute) };
  }
}
visit(directory);
assert.ok(modules["index.js"]);
const wasm = Object.entries(modules).filter(([, module]) => module.type === "wasm"); assert.ok(wasm.length);
Object.assign(receipt, {
  sourceCommit: clean ? git("rev-parse", "HEAD") : null,
  baseCommit: git("rev-parse", "HEAD"), workingTreeClean: clean,
  applicationInputsSha256: identity.applicationInputsSha256, node: process.version,
  miniflare: require("miniflare/package.json").version, workerd: require("workerd/package.json").version,
  entry: "dist/server/index.js", entrySha256: sha256(modules["index.js"].contents),
  modulesSha256: sha256(JSON.stringify(Object.entries(modules).map(([path, module]) => [path, sha256(module.contents)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))),
  wasm: wasm.map(([path, module]) => ({ path, sha256: sha256(module.contents) })),
  status: "running", checks: {},
});
const { draft } = await reportFixture();
const options = reportOptions(draft, { privateCase: false });
const expected = taxReportReceipt(await buildTaxCaseReportArtifacts(draft, options, loadNodeTaxRuntime), options.generatedAt);
const email = "worker-tax-history@example.test", password = "Synthetic-Worker-Tax-QA-30!";
const credential = await createPasswordCredential(password), scope = await studioDeviceScope(email);
const raw = JSON.stringify(draft, null, "\t") + "\r\n";

async function verify(brokenWasm) {
  const candidateModules = Object.fromEntries(Object.entries(modules).map(([path, module]) => [path, brokenWasm && module.type === "wasm" ? { ...module, contents: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]) } : module]));
  const name = brokenWasm ? "tax-report-missing-wasm-exports" : "tax-report-production-worker";
  const mf = new Miniflare({ host: "127.0.0.1", port: 0, cf: false, telemetry: { enabled: false }, log: new Log(LogLevel.WARN), resourceTmpPath: join(evidence, name),
    workers: [{ config: { name, type: "worker", compatibilityDate: "2026-09-11", compatibilityFlags: ["nodejs_compat"],
      manifest: { mainModule: "index.js", modulesRoot: directory, modules: candidateModules },
      env: { DB: { type: "d1", name }, DOSSIER_DOCUMENTS: { type: "r2", name } } } }],
  });
  try {
    const d1 = await mf.getD1Database("DB", name);
    const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8"));
    for (const entry of journal.entries) await d1.batch(readFileSync(join(root, `drizzle/${entry.tag}.sql`), "utf8").split("--> statement-breakpoint").map(text => text.trim()).filter(Boolean).map(text => d1.prepare(text)));
    await d1.prepare("insert into users(email,display_name) values(?,?)").bind(email, "Synthetic Worker report reviewer").run();
    await d1.prepare("insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)").bind(email, credential.hash, credential.salt, credential.iterations, "2026-01-01T00:00:00.000Z").run();
    await d1.prepare("insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint) values(1,?,?,?,?,?)").bind(email, draft.caseId, draft.title, draft.version, caseFingerprint(draft)).run();
    await d1.prepare("insert into case_drafts(id,custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(1,1,?,?,?,?,?,?)").bind(email, draft.caseId, draft.version, caseFingerprint(draft), draft.title, raw).run();
    let cookie;
    const fetch = async (path, body) => {
      const headers = { origin: "https://tax-report.test", "sec-fetch-site": "same-origin", ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) };
      return mf.dispatchFetch(`https://tax-report.test${path}`, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    };
    const login = await fetch("/api/auth/login", { email, password });
    assert.equal(login.status, 200, await login.clone().text());
    cookie = login.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie, "real login must issue a session");
    const payload = { customCaseId: 1, expectedScope: scope, receipt: expected, options };
    const response = await fetch("/api/custom-cases/report-receipts", payload), result = await response.json();
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    if (brokenWasm) {
      assert.equal(response.status, 409, JSON.stringify(result));
      assert.equal((await d1.prepare("select count(*) as n from audit_events where event_type='studio_report_download_started'").first()).n, 0);
      return { login: 200, v3History: 409, events: 0, missingWasmExportsFailClosed: true };
    }
    assert.equal(response.status, 201, JSON.stringify(result)); assert.deepEqual(result.record.receipt, expected);
    const retry = await fetch("/api/custom-cases/report-receipts", payload), retried = await retry.json();
    assert.equal(retry.status, 200, JSON.stringify(retried)); assert.equal(retried.record.id, result.record.id); assert.equal(retried.alreadyRecorded, true);
    const read = await fetch(`/api/custom-cases/report-receipts?customCaseId=1&expectedScope=${scope}`), page = await read.json();
    assert.equal(read.status, 200); assert.deepEqual(page.receipts[0].receipt, expected);
    const forged = await fetch("/api/custom-cases/report-receipts", { ...payload, receipt: { ...expected, tax: { ...expected.tax, evidenceFingerprint: `sha256-${"0".repeat(64)}` } } });
    assert.equal(forged.status, 409, await forged.clone().text());
    const incomplete = structuredClone(draft), edited = JSON.parse(incomplete.taxAnalysis.document);
    edited.edit.implementation_cost = ""; attach(incomplete, edited);
    const incompleteRaw = JSON.stringify(incomplete);
    await d1.prepare("update custom_cases set fingerprint=? where id=1").bind(caseFingerprint(incomplete)).run();
    await d1.prepare("update case_drafts set fingerprint=?,payload=? where id=1").bind(caseFingerprint(incomplete), incompleteRaw).run();
    const unfinished = await fetch("/api/custom-cases/report-receipts", { ...payload, options: reportOptions(incomplete, { privateCase: false }) });
    assert.equal(unfinished.status, 409, await unfinished.clone().text());
    assert.equal((await d1.prepare("select payload from case_drafts where id=1").first()).payload, incompleteRaw);
    await d1.prepare("update custom_cases set fingerprint=? where id=1").bind(caseFingerprint(draft)).run();
    await d1.prepare("update case_drafts set fingerprint=? where id=1").bind(caseFingerprint(draft)).run();
    const future = JSON.stringify({ ...draft, taxAnalysis: { ...draft.taxAnalysis, carrierVersion: 99 } });
    await d1.prepare("update case_drafts set payload=? where id=1").bind(future).run();
    const opaque = await fetch("/api/custom-cases/report-receipts", payload); assert.equal(opaque.status, 409, await opaque.clone().text());
    assert.equal((await d1.prepare("select payload from case_drafts where id=1").first()).payload, future);
    const events = await d1.prepare("select detail from audit_events where event_type='studio_report_download_started'").all();
    assert.equal(events.results.length, 1);
    const detail = JSON.parse(events.results[0].detail); assert.deepEqual(detail.receipt, expected);
    for (const privateField of ["normalized_request", "original_json", "POISON", "future-preserved"]) assert.ok(!events.results[0].detail.includes(privateField));
    return { login: 200, v3History: 201, retry: 200, historyRead: 200, forgedIdentity: 409, incompleteSource: 409, futureSource: 409, events: 1, exactReceipt: true, retainedIncompleteSha256: sha256(incompleteRaw), retainedFutureSha256: sha256(future), rawSourceSha256: sha256(raw), reportFingerprint: expected.reportFingerprint, taxEvidenceFingerprint: expected.tax.evidenceFingerprint };
  } finally { await mf.dispose(); }
}

  receipt.checks.productionWorker = await verify(false);
  receipt.checks.missingWasmExports = await verify(true);
  receipt.status = "passed";
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) { receipt.status = "failed"; receipt.failure = String(error); throw error; }
finally { writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n"); }
