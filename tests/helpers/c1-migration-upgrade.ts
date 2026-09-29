import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

// Local rehearsal only. No hosted access, migration-ledger edits, or authentication bypass claim.
export const exactV91 = "3986d9035b522044ad8423b50a5b620cbc13734f";
export const migrationMode = Boolean(process.env.C1_MIGRATION_BASELINE_ROOT);
const sourceRoot = process.env.C1_MIGRATION_BASELINE_ROOT ? realpathSync(process.env.C1_MIGRATION_BASELINE_ROOT) : "";
const evidenceRoot = resolve(process.env.C1_MIGRATION_EVIDENCE_ROOT ?? ".artifacts/c1-migration-upgrade");
const gitTree = new Map<string, string>();
const verified = new Map<string, { path: string; gitBlob: string; sha256: string; bytes: number }>();
export const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function writeUpgradeEvidence(name: string, value: unknown) {
  if (!migrationMode) return;
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(resolve(evidenceRoot, name + ".json"), JSON.stringify(value, null, 2) + "\n");
}
function verifyFile(path: string) {
  const absolute = realpathSync(resolve(sourceRoot, path));
  const rel = relative(sourceRoot, absolute).replaceAll("\\", "/");
  assert.ok(!isAbsolute(rel) && !rel.startsWith("../"), "baseline input escaped exact source tree: " + path);
  const expected = gitTree.get(rel);
  assert.ok(expected, "baseline dependency is not a file at exact v91: " + rel);
  const bytes = readFileSync(absolute);
  const gitBlob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  assert.equal(gitBlob, expected, "baseline source bytes differ from exact v91: " + rel);
  verified.set(rel, { path: rel, gitBlob, sha256: sha256(bytes), bytes: bytes.length });
  return bytes;
}
export function verifyBaselineInputs() {
  if (!migrationMode) return;
  assert.ok(existsSync(resolve(sourceRoot, "package.json")), "provide extracted exact-v91 archive");
  const tree = execFileSync("git", ["ls-tree", "-r", "-z", exactV91], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  for (const line of tree.split("\0").filter(Boolean)) {
    const match = /^\d+ blob ([a-f0-9]+)\t([\s\S]+)$/.exec(line);
    if (match) gitTree.set(match[2], match[1]);
  }
  assert.ok(gitTree.size > 0);
  // Bundles externalize third-party packages. Their manifests must be unchanged.
  assert.deepEqual(readFileSync("package-lock.json"), verifyFile("package-lock.json"), "old/current lock bytes changed");
  const baselinePackage = JSON.parse(new TextDecoder().decode(verifyFile("package.json")));
  const currentPackage = JSON.parse(readFileSync("package.json", "utf8"));
  const withoutScripts = (manifest: Record<string, unknown>) => Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "scripts"));
  assert.deepEqual(withoutScripts(currentPackage), withoutScripts(baselinePackage), "non-script package fields changed, including dependencies/engines/overrides");
  const withoutMigrationCommand = (scripts: Record<string, string>) => Object.fromEntries(Object.entries(scripts).filter(([key]) => key !== "migrations:verify"));
  assert.deepEqual(withoutMigrationCommand(currentPackage.scripts), withoutMigrationCommand(baselinePackage.scripts), "only the explicit migrations:verify script may differ");
  writeUpgradeEvidence("package-identity", { lockSha256: sha256(readFileSync("package-lock.json")), baselinePackageSha256: sha256(verifyFile("package.json")), currentPackageSha256: sha256(readFileSync("package.json")), baselineScripts: baselinePackage.scripts, currentScripts: currentPackage.scripts, allowedDifference: "migrations:verify script only; all other manifest fields and lock bytes identical" });
  // Fixture entry points are verified here and bundled from the old source below.
  for (const path of ["app/case-integrity.ts", "app/studio-compiler.ts"]) {
    assert.deepEqual(readFileSync(path), verifyFile(path), "shared fixture helper changed: " + path);
  }
  const oldJournal = JSON.parse(new TextDecoder().decode(verifyFile("drizzle/meta/_journal.json"))) as { entries: Array<{ idx: number; tag: string }> };
  const currentJournal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as typeof oldJournal;
  assert.deepEqual(currentJournal.entries.filter(e => e.idx < 22), oldJournal.entries);
  assert.equal(oldJournal.entries.at(-1)?.idx, 21);
  for (const entry of oldJournal.entries) {
    const path = `drizzle/${entry.tag}.sql`;
    assert.deepEqual(readFileSync(path), verifyFile(path), "pre-C1 migration differs from v91: " + path);
  }
}
export async function compileExactV91Routes(paths: Record<string, string>) {
  assert.ok(migrationMode);
  const entries = Object.entries(paths).filter(([name]) => name !== "notes");
  for (const [, path] of entries) verifyFile(path);
  const result = await build({
    absWorkingDir: sourceRoot,
    stdin: { contents: entries.map(([name, path]) => `import * as ${name} from './${path}';`).join("\n") + `\nexport {${entries.map(([name]) => name).join(",")}};\nexport {caseFingerprint,normalizeStudioDraft} from './app/case-integrity';\nexport {compileStudioDraft} from './app/studio-compiler';`, resolveDir: sourceRoot, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022", metafile: true,
    plugins: [{ name: "exact-v91-isolated-runtime", setup(b) {
      b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "test-runtime" }));
      b.onLoad({ filter: /.*/, namespace: "test-runtime" }, args => ({ contents: args.path === "cloudflare:workers"
        ? "export const env=globalThis.__p1_env; export function waitUntil(p){globalThis.__p1_jobs.push(p)}"
        : args.path === "next/headers" ? "export async function headers(){return globalThis.__p1_headers()}"
          : "export function redirect(){throw new Error('unexpected redirect')}" }));
    } }],
  });
  for (const input of Object.keys(result.metafile!.inputs)) {
    if (input === "<stdin>" || input.startsWith("test-runtime:")) continue;
    verifyFile(input);
  }
  // Keep the module beside the current test runtime so external packages resolve normally.
  const bundleFile = resolve(".artifacts/p1-route-tests/exact-v91-routes.mjs");
  mkdirSync(resolve(".artifacts/p1-route-tests"), { recursive: true });
  writeFileSync(bundleFile, result.outputFiles[0].contents);
  writeUpgradeEvidence("exact-v91-source", {
    exactCommit: exactV91,
    currentCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    currentWorkingTreeStatus: execFileSync("git", ["status", "--short"], { encoding: "utf8" }),
    sourceRoot,
    dependencyPolicy: "full bundled first-party route dependency graph verified by raw Git blob; third-party packages external, lock bytes and non-script manifest fields identical; only migrations:verify script may differ",
    routes: Object.fromEntries(entries),
    inputs: [...verified.values()].sort((a, b) => a.path.localeCompare(b.path)),
    bundleSha256: sha256(result.outputFiles[0].contents),
    migration0022Sha256: sha256(readFileSync("drizzle/0022_loving_juggernaut.sql")),
    scope: "synthetic local actual handlers and D1/R2; not hosted/browser acceptance or independent human approval",
    excludedHistoricalFixture: "historical deadline seed requires pre-0016 population; existing test setup disables its insert guard and is excluded in this mode",
  });
  return import(pathToFileURL(bundleFile).href);
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
}
export type UpgradeCapture = {
  tables: Record<string, { rows: number; sha256: string }>;
  schema: Array<{ type: string; name: string; tbl_name: string; sql: string | null }>;
  schemaSha256: string;
  r2: Array<{ key: string; bytes: number; sha256: string; httpMetadata: unknown; customMetadata: unknown }>;
  quickCheck: unknown[];
  foreignKeys: unknown[];
};
export async function captureUpgradeState(db: D1Database, bucket: R2Bucket): Promise<UpgradeCapture> {
  // Avoid retaining auth sessions, invitation tokens, or complete confidential row bodies in artifacts.
  // Full row values are compared through canonical digests; no data is changed by capture.
  const schema = (await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all<{ type: string; name: string; tbl_name: string; sql: string | null }>()).results;
  const tables: UpgradeCapture["tables"] = {};
  for (const entry of schema.filter(e => e.type === "table" && !e.name.startsWith("sqlite_") && !e.name.startsWith("_cf_"))) {
    const rows = (await db.prepare(`SELECT * FROM "${entry.name.replaceAll('"', '""')}"`).all()).results.map(canonical).sort();
    tables[entry.name] = { rows: rows.length, sha256: sha256("[" + rows.join(",") + "]") };
  }
  const r2: UpgradeCapture["r2"] = [];
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ cursor });
    for (const item of listing.objects) {
      const object = await bucket.get(item.key);
      assert.ok(object, "R2 list/get disagreed: " + item.key);
      const bytes = new Uint8Array(await object.arrayBuffer());
      r2.push({ key: item.key, bytes: bytes.byteLength, sha256: sha256(bytes), httpMetadata: object.httpMetadata, customMetadata: object.customMetadata });
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
  r2.sort((a, b) => a.key.localeCompare(b.key));
  const foreignKeys = (await db.prepare("PRAGMA foreign_key_check").all()).results;
  // D1 exposes quick_check, not SQLite's full integrity_check. Keep this evidence
  // distinct from the full integrity_check in the standalone SQLite model.
  // https://developers.cloudflare.com/d1/sql-api/sql-statements/#pragma-quick_check
  const quickCheck = (await db.prepare("PRAGMA quick_check").all()).results;
  assert.deepEqual(foreignKeys, []);
  assert.deepEqual(quickCheck.map(row => Object.values(row as Record<string, unknown>)), [["ok"]]);
  return { tables, schema, schemaSha256: sha256(canonical(schema)), r2, quickCheck, foreignKeys };
}
export function assertOriginalSchemaPreserved(before: UpgradeCapture, after: UpgradeCapture) {
  for (const item of before.schema) assert.deepEqual(after.schema.find(other => other.type === item.type && other.name === item.name), item, "existing schema changed: " + item.name);
  for (const [name, value] of Object.entries(before.tables)) assert.deepEqual(after.tables[name], value, "existing data changed: " + name);
  assert.deepEqual(after.r2, before.r2, "existing R2 bytes or metadata changed during migration");
}
