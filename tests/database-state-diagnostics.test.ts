import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { collectDatabaseState, emitDatabaseState } from "../app/database-state-diagnostics";

const issued: string[] = [];
function reader(db: DatabaseSync) {
  return { prepare(sql: string) {
    assert.match(sql, /^SELECT /); issued.push(sql);
    return { async all<T>() { return { success: true, results: db.prepare(sql).all() as T[] }; } };
  } };
}
function database(mode: "baseline" | "partial" | "complete") {
  const db = new DatabaseSync(":memory:");
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  // Baseline/partial/complete fixtures remain explicitly pre-0022 even after
  // the production migration chain includes the accepted 0022 file.
  for (const entry of journal.entries.filter((item: { idx: number }) => item.idx < 22)) db.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  db.exec("INSERT INTO users(email,display_name) VALUES ('private-canary@example.test','Customer private text')");
  const pending = readFileSync("tests/fixtures/m0-corrected-pending.sql", "utf8");
  if (mode === "complete") db.exec(pending);
  if (mode === "partial") db.exec(pending.split("--> statement-breakpoint")[0]);
  return db;
}
function snapshot(db: DatabaseSync) {
  const schema = db.prepare("SELECT * FROM sqlite_schema ORDER BY type,name").all();
  const rows = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all()
    .map((r) => ({ name: r.name, rows: db.prepare(`SELECT * FROM "${String(r.name).replaceAll('"', '""')}"`).all() }));
  return JSON.stringify({ schema, rows });
}

for (const mode of ["baseline", "partial", "complete"] as const) {
  test(`actual ${mode} schema is observed without changing any schema or row`, async () => {
    const db = database(mode); const beforeState = snapshot(db);
    try {
      const report = await collectDatabaseState(reader(db));
      assert.equal(report.state, "collected");
      assert.ok("objects" in report);
      const names = report.objects!.map((o) => o.name);
      assert.equal(names.includes("dossier_request_operations"), mode !== "baseline");
      assert.equal(names.includes("working_note_versions_update_guard"), mode === "complete");
      assert.ok(report.ledgers!.every((l) => l.status === "absent"));
      assert.match(JSON.stringify(report.limitations), /absent_known_ledger_does_not_mean_unapplied/);
      assert.doesNotMatch(JSON.stringify(report), /Customer private|private-canary|CREATE TABLE|CREATE TRIGGER/);
      assert.equal(snapshot(db), beforeState);
    } finally { db.close(); }
  });
}

test("recognized ledger metadata, malformed ledgers and truncation remain distinct", async () => {
  const db = database("baseline");
  try {
    db.exec("CREATE TABLE __drizzle_migrations(id INTEGER,hash TEXT,created_at INTEGER)");
    db.prepare("INSERT INTO __drizzle_migrations VALUES(1,?,123)").run("a".repeat(64));
    let state = await collectDatabaseState(reader(db));
    assert.equal(state.ledgers![0].status, "read");
    assert.deepEqual(state.ledgers![0].rows, [{ id: 1, hash: "a".repeat(64), created_at: 123 }]);
    db.exec("CREATE TABLE d1_migrations(secret TEXT)");
    state = await collectDatabaseState(reader(db));
    assert.equal(state.state, "incomplete");
    assert.equal(state.ledgers![1].status, "unsupported_columns");
    db.exec("DROP TABLE d1_migrations;CREATE TABLE d1_migrations(id INTEGER,name TEXT,applied_at TEXT)");
    db.exec("INSERT INTO d1_migrations VALUES(1,'PRIVATE CONTENT','2026-09-25 00:00:00')");
    state = await collectDatabaseState(reader(db));
    assert.equal(state.ledgers![1].status, "unsupported_value");
    assert.doesNotMatch(JSON.stringify(state), /PRIVATE CONTENT/);
    for (let i = 2; i <= 130; i++) db.prepare("INSERT INTO __drizzle_migrations VALUES(?,?,123)").run(i,"b".repeat(64));
    assert.equal((await collectDatabaseState(reader(db))).ledgers![0].status, "truncated");
  } finally { db.close(); }
});

test("catalog failure and schema changes never become complete evidence", async () => {
  const db = database("baseline"); let reads = 0;
  try {
    const wrapped = { prepare(sql: string) { if (++reads === 2) db.exec("CREATE TABLE intervening_change(id INTEGER)"); return reader(db).prepare(sql); } };
    const report = await collectDatabaseState(wrapped);
    assert.equal(report.schemaStable, false); assert.equal(report.state, "incomplete");
    const failed = await collectDatabaseState({ prepare() { throw new Error("private database detail"); } });
    assert.equal(failed.state, "incomplete"); assert.doesNotMatch(JSON.stringify(failed), /private database detail/);
  } finally { db.close(); }
});

test("observed platform ledger is read through constant projections without selecting unknown values", async () => {
  const db = database("baseline");
  try {
    db.exec("CREATE TABLE __appgarden_migrations(name TEXT PRIMARY KEY,applied_at TEXT,internal_payload TEXT)");
    db.prepare("INSERT INTO __appgarden_migrations VALUES (?,?,?)").run("0000_synthetic.sql", "2026-09-25T09:11:37.880Z", "PRIVATE_SECRET_SQL".repeat(10000));
    const beforeState = snapshot(db); issued.length = 0;
    const report = await collectDatabaseState(reader(db)); const ledger = report.ledgers!.find((l) => l.name === "__appgarden_migrations")!;
    assert.equal(report.state, "incomplete"); assert.equal(ledger.status, "unsupported_columns"); assert.equal(ledger.stable, true);
    assert.deepEqual(ledger.omittedValueColumns, ["internal_payload"]);
    assert.deepEqual(ledger.rows, [{ name: "0000_synthetic.sql", applied_at: "2026-09-25T09:11:37.880Z" }]);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_SECRET_SQL/);
    assert.ok(issued.every((sql) => !sql.includes("internal_payload") && !sql.includes("SELECT *")));
    assert.equal(snapshot(db), beforeState);
    db.exec("ALTER TABLE __appgarden_migrations DROP COLUMN internal_payload");
    const complete = await collectDatabaseState(reader(db));
    assert.equal(complete.state, "collected"); assert.equal(complete.ledgers!.at(-1)!.status, "read");
  } finally { db.close(); }
});

test("platform ledger incompatible values, row/column limits and read failure preserve schema evidence", async () => {
  const db = database("baseline");
  try {
    db.exec("CREATE TABLE __appgarden_migrations(id INTEGER,name TEXT,hash TEXT,status TEXT)");
    db.prepare("INSERT INTO __appgarden_migrations VALUES (1,?,?,?)").run("0000_synthetic", "a".repeat(64), "unknown-private-status");
    let report = await collectDatabaseState(reader(db));
    assert.equal(report.ledgers!.at(-1)!.status, "unsupported_value"); assert.doesNotMatch(JSON.stringify(report), /unknown-private-status/);
    db.exec("UPDATE __appgarden_migrations SET status='applied',name=NULL,hash=NULL");
    report = await collectDatabaseState(reader(db));
    assert.deepEqual(report.ledgers!.at(-1)!.rows, [{ id: 1, name: null, hash: null, status: "applied" }]);
    assert.ok(report.limitations!.includes("not_a_migration_execution_approval"));
    for (let i = 2; i <= 129; i++) db.prepare("INSERT INTO __appgarden_migrations VALUES (?,NULL,NULL,'applied')").run(i);
    assert.equal((await collectDatabaseState(reader(db))).ledgers!.at(-1)!.status, "truncated");
    const failure = { prepare(sql: string) { if (sql.includes('FROM "__appgarden_migrations"')) throw new Error("private failure"); return reader(db).prepare(sql); } };
    report = await collectDatabaseState(failure);
    assert.equal(report.ledgers!.at(-1)!.status, "read_failed"); assert.ok(report.objects!.length > 591); assert.doesNotMatch(JSON.stringify(report), /private failure/);
    db.exec("DROP TABLE __appgarden_migrations");
    db.exec(`CREATE TABLE __appgarden_migrations(${Array.from({ length: 65 }, (_, i) => `column_${i} TEXT`).join(',')})`);
    assert.equal((await collectDatabaseState(reader(db))).ledgers!.at(-1)!.status, "truncated");
  } finally { db.close(); }
});

test("platform ledger changes during collection cannot become complete evidence", async () => {
  const db = database("baseline"); let reads = 0;
  try {
    db.exec("CREATE TABLE __appgarden_migrations(name TEXT PRIMARY KEY,applied_at TEXT)");
    db.exec("INSERT INTO __appgarden_migrations VALUES ('0000_synthetic.sql','2026-09-25T09:11:37Z')");
    const changing = { prepare(sql: string) {
      if (sql.includes('FROM "__appgarden_migrations"') && ++reads === 2) db.exec("INSERT INTO __appgarden_migrations VALUES ('0001_synthetic.sql','2026-09-25T09:12:37Z')");
      return reader(db).prepare(sql);
    } };
    const report = await collectDatabaseState(changing);
    assert.equal(report.state, "incomplete"); assert.equal(report.ledgers!.at(-1)!.status, "changed_during_read");
  } finally { db.close(); }
});

test("actual D1 supports the fixed catalog and ledger queries without writes", async () => {
  const mf = new Miniflare({ workers: [{ config: { name: "diagnostics-test", type: "worker", compatibilityDate: "2026-09-01",
    manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } },
    env: { DB: { type: "d1", name: "diagnostics-test" } } }, dev: {} }] });
  try {
    const db = await mf.getD1Database("DB", "diagnostics-test") as unknown as D1Database;
    await db.prepare("CREATE TABLE __drizzle_migrations(id INTEGER,hash TEXT,created_at INTEGER)").run();
    await db.prepare("INSERT INTO __drizzle_migrations VALUES(1,?,123)").bind("c".repeat(64)).run();
    await db.prepare("CREATE TABLE __appgarden_migrations(name TEXT PRIMARY KEY,applied_at TEXT)").run();
    await db.prepare("INSERT INTO __appgarden_migrations VALUES('0000_synthetic.sql','2026-09-25T09:11:37Z')").run();
    const beforeState = await db.prepare("SELECT * FROM __drizzle_migrations").all();
    const report = await collectDatabaseState(db);
    assert.equal(report.state, "collected"); assert.equal(report.ledgers![0].status,"read");
    assert.deepEqual(report.ledgers!.at(-1)!.rows, [{ name: "0000_synthetic.sql", applied_at: "2026-09-25T09:11:37Z" }]);
    assert.deepEqual((await db.prepare("SELECT * FROM __drizzle_migrations").all()).results, beforeState.results);
  } finally { await mf.dispose(); }
});

test("diagnostic log chunks reassemble with a digest and sink failure is explicit", async () => {
  const db = database("complete");
  try {
    const report = await collectDatabaseState(reader(db)); const lines: string[] = [];
    const delivery = await emitDatabaseState(report, "synthetic-request", (line) => lines.push(line));
    const chunks = lines.map((line) => JSON.parse(line));
    const payload = chunks.map((c) => c.data).join("");
    assert.deepEqual(JSON.parse(payload), report);
    assert.equal(createHash("sha256").update(payload).digest("hex"), delivery.digest);
    assert.equal(chunks.length, delivery.chunks);
    assert.ok(lines.every((line) => Buffer.byteLength(line) < 6000));
    assert.doesNotMatch(lines.join(""), /private-canary|Customer private|CREATE TABLE/);
    assert.equal((await emitDatabaseState(report, "synthetic", () => { throw new Error("sink down"); })).status, "failed");
  } finally { db.close(); }
});

const harnessRoot = mkdtempSync(join(tmpdir(), "juris-diagnostics-"));
const globals = globalThis as unknown as { __diagHeaders: Headers; __diagEnv: { DB?: ReturnType<typeof reader>; GENESIS_ADMIN_EMAILS: string }; __diagLocalCalls: number };
let route: { GET(request: Request): Promise<Response> };
before(async () => {
  globals.__diagHeaders = new Headers(); globals.__diagEnv = { GENESIS_ADMIN_EMAILS: "admin@example.test" }; globals.__diagLocalCalls = 0;
  const compiled = await build({ entryPoints: [resolve("app/api/admin/database-state/route.ts")], bundle: true, write: false,
    platform: "node", format: "esm", packages: "external", target: "es2022", plugins: [{ name: "isolated-runtime", setup(b) {
      b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, (a) => ({ path: a.path, namespace: "runtime" }));
      b.onResolve({ filter: /^\.\/local-auth$/ }, (a) => a.importer.endsWith("chatgpt-auth.ts") ? { path: "local-auth", namespace: "runtime" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "runtime" }, (a) => ({ contents: a.path === "cloudflare:workers"
        ? "export const env=globalThis.__diagEnv;export function waitUntil(){}" : a.path === "next/headers"
          ? "export async function headers(){return globalThis.__diagHeaders}" : a.path === "local-auth"
            ? "export async function getLocalSessionUser(){globalThis.__diagLocalCalls++;throw new Error('local fallback must not run')}"
            : "export function redirect(){throw new Error('unexpected redirect')}" }));
    } }] });
  const path = join(harnessRoot,"route.mjs"); writeFileSync(path,compiled.outputFiles[0].text);
  route = await import(pathToFileURL(path).href);
});
after(() => rmSync(harnessRoot,{recursive:true,force:true}));

test("real handler denies anonymous/local/ordinary users before diagnostic DB or session access", async () => {
  for (const candidate of [new Headers(), new Headers({cookie:"session=local"}), new Headers({"oai-authenticated-user-email":"owner@example.test"})]) {
    globals.__diagHeaders = candidate; issued.length = 0;
    const response = await route.GET(new Request("https://app.test/api/admin/database-state"));
    assert.equal(response.status,403); assert.equal(issued.length,0); assert.equal(globals.__diagLocalCalls,0);
    assert.match(response.headers.get("cache-control")!,/no-store/);
  }
});

test("authorized real handler executes fixed readonly queries, rejects query parameters, and preserves all rows", async () => {
  const db = database("partial"); globals.__diagEnv.DB = reader(db);
  globals.__diagHeaders = new Headers({"oai-authenticated-user-email":"admin@example.test"});
  const savedConsole = console.info; const logs: string[] = []; console.info = (line) => logs.push(String(line));
  try {
    const beforeState = snapshot(db); issued.length = 0;
    assert.equal((await route.GET(new Request("https://app.test/api/admin/database-state?sql=DROP"))).status,400);
    assert.equal(issued.length,0);
    const response = await route.GET(new Request("https://app.test/api/admin/database-state"));
    assert.equal(response.status,200); const body = await response.json() as { report: { state: string }; logDelivery: { status: string } };
    assert.equal(body.report.state,"collected"); assert.equal(body.logDelivery.status,"submitted");
    assert.ok(logs.length > 1); assert.ok(issued.length > 0); assert.equal(snapshot(db),beforeState);
  } finally { console.info = savedConsole; db.close(); }
});
