import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildExpectedSchema, compareDatabaseState, sha256 } from "../scripts/compare-database-state.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expected = buildExpectedSchema(root);
const notBefore = "2026-09-29T00:00:00.000Z";
function fixture() {
  const objects = [...expected.objects,
    { type: "table", name: "__appgarden_migrations", table: "__appgarden_migrations", definitionSha256: "a".repeat(64) },
    { type: "table", name: "_cf_KV", table: "_cf_KV", definitionSha256: "b".repeat(64) },
  ].sort((a, b) => (a.type + ":" + a.name < b.type + ":" + b.name ? -1 : 1));
  // Mutable synthetic metadata for adversarial input tests; no customer data.
  const report = JSON.parse(JSON.stringify({
    revision: "m0-readonly-2026-09-25.2", capturedAt: "2026-09-29T15:30:00.000Z", state: "collected",
    scope: "application_binding_metadata_only", binding: "DB", schemaStable: true,
    schemaDigest: sha256(JSON.stringify(objects)), objectCount: objects.length, objects,
    ledgers: [
      { name: "__drizzle_migrations", status: "absent" },
      { name: "d1_migrations", status: "absent" },
      { name: "__appgarden_migrations", status: "read", stable: true,
        columns: [{ name: "name", type: "TEXT" }, { name: "applied_at", type: "TEXT" }], omittedValueColumns: [],
        rows: expected.migrations.map((migration) => ({ name: migration.name, applied_at: "2026-09-29T15:00:00.000Z" })) },
    ],
  }));
  return { requestId: "synthetic-readback", report, logDelivery: { status: "submitted", digest: "", chunks: 0 } };
}
function seal(value: ReturnType<typeof fixture>) {
  value.report.schemaDigest = sha256(JSON.stringify(value.report.objects));
  value.report.objectCount = value.report.objects.length;
  const payload = JSON.stringify(value.report);
  value.logDelivery.digest = sha256(payload);
  value.logDelivery.chunks = Math.ceil(payload.length / 2500);
  return value;
}
function compare(value: ReturnType<typeof fixture>) {
  seal(value);
  return compareDatabaseState(value, expected, { expectedDigest: value.logDelivery.digest, notBefore });
}
test("current committed migration chain produces a matched schema and named ledger without historical counts", () => {
  const result = compare(fixture());
  assert.equal(result.status, "MATCH");
  assert.equal(result.expectedApplicationObjects, expected.objects.length);
  assert.equal(result.platformLedger.observedMigrationCount, expected.migrations.length);
  assert.deepEqual(result.providerObjects.map((object: { name: string }) => object.name), ["__appgarden_migrations", "_cf_KV"]);
  assert.ok(result.limitations.includes("physical_D1_R2_identity_backup_and_restore_not_verified"));
  assert.ok(expected.objects.some((object) => object.name === "email_invitations"));
  assert.ok(expected.objects.some((object) => object.name === "invitation_mailbox_proofs"));
});
test("missing or changed app objects cannot be hidden by provider objects or a complete ledger", () => {
  const absent = fixture();
  absent.report.objects = absent.report.objects.filter((object: { name: string }) => object.name !== "email_invitations");
  assert.equal(compare(absent).status, "MISMATCH");
  assert.ok(compare(absent).missing.some((object: { name: string }) => object.name === "email_invitations"));
  const changed = fixture();
  changed.report.objects.find((object: { name: string }) => object.name === "invitation_mailbox_proofs").definitionSha256 = "f".repeat(64);
  assert.equal(compare(changed).changed.length, 1);
  assert.equal(compare(changed).status, "MISMATCH");
});
test("unexpected trigger or provider-looking app table remains a failure", () => {
  for (const object of [
    { type: "trigger", name: "provider_change", table: "email_invitations", definitionSha256: "c".repeat(64) },
    { type: "table", name: "_cf_extra", table: "_cf_extra", definitionSha256: "c".repeat(64) },
    { type: "index", name: "sqlite_autoindex_d1_migrations_1", table: "d1_migrations", definitionSha256: null },
  ]) {
    const value = fixture();
    value.report.objects.push(object);
    value.report.objects.sort((a: { type: string; name: string }, b: { type: string; name: string }) => (a.type + ":" + a.name < b.type + ":" + b.name ? -1 : 1));
    const result = compare(value);
    assert.equal(result.status, "MISMATCH");
    assert.deepEqual(result.unexpectedObjects, [object]);
  }
});
test("invalid digest, catalogue count, object duplication, stale capture and incomplete report are rejected", () => {
  const value = seal(fixture());
  assert.throws(() => compareDatabaseState(value, expected, { expectedDigest: "0".repeat(64), notBefore }), /report_digest_mismatch/);
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => { value.report.state = "incomplete"; },
    (value) => { value.report.schemaStable = false; },
    (value) => { value.report.binding = "OTHER"; },
    (value) => { value.report.revision = "future-contract"; },
    (value) => { value.report.capturedAt = "2026-09-28T00:00:00Z"; },
    (value) => { value.report.capturedAt = "2026-09-29T15:30:00"; },
    (value) => { value.report.capturedAt = "2026-02-30T15:30:00Z"; },
    (value) => { value.report.ledgers[2].columns = []; },
    (value) => { value.report.objects.push(value.report.objects[0]); },
    (value) => { value.report.ledgers.pop(); },
    (value) => { value.report.ledgers[2].status = "truncated"; },
  ];
  for (const mutate of mutations) { const candidate = fixture(); mutate(candidate); assert.throws(() => compare(candidate)); }
  value.report.objectCount++;
  value.logDelivery.digest = sha256(JSON.stringify(value.report));
  value.logDelivery.chunks = Math.ceil(JSON.stringify(value.report).length / 2500);
  assert.throws(() => compareDatabaseState(value, expected, { expectedDigest: value.logDelivery.digest, notBefore }), /invalid_catalogue_count/);
});
test("ledger omissions, duplicate identities, unverified timestamps and pending status cannot pass", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => { value.report.ledgers[2].rows.pop(); },
    (value) => { value.report.ledgers[2].rows.push(value.report.ledgers[2].rows[0]); },
    (value) => { value.report.ledgers[2].rows[0].name = "9999_unexpected.sql"; },
    (value) => { value.report.ledgers[2].columns.push({ name: "filename", type: "TEXT" }); for (const row of value.report.ledgers[2].rows) row.filename = row.name; value.report.ledgers[2].rows[0].filename = "9999_conflict.sql"; },
    (value) => { value.report.ledgers[2].columns.push({ name: "status", type: "TEXT" }); for (const row of value.report.ledgers[2].rows) row.status = "applied"; value.report.ledgers[2].rows[0].status = "pending"; },
    (value) => { value.report.ledgers[2].rows[0].applied_at = null; },
    (value) => { value.report.ledgers[2].stable = undefined; },
  ];
  for (const mutate of mutations) { const value = fixture(); mutate(value); assert.equal(compare(value).status, "MISMATCH"); }
});
test("an absent known ledger is not interpreted as an unapplied chain or successful migration acceptance", () => {
  const value = fixture();
  value.report.objects = value.report.objects.filter((object: { name: string }) => object.name !== "__appgarden_migrations");
  value.report.ledgers[2] = { name: "__appgarden_migrations", status: "absent" };
  const result = compare(value);
  assert.equal(result.status, "MISMATCH");
  assert.ok(result.platformLedger.problems.includes("platform_ledger_not_read_and_stable"));
});
test("logging failure does not invalidate a complete direct response or claim log retention", () => {
  const value = fixture(); value.logDelivery.status = "failed";
  assert.equal(compare(value).status, "MATCH");
});
test("CLI returns 0 match, 1 mismatch and 2 invalid, without echoing private input", () => {
  const directory = mkdtempSync(join(tmpdir(), "schema-comparator-"));
  const path = join(directory, "report.json");
  const run = (value: ReturnType<typeof fixture>) => {
    seal(value); writeFileSync(path, JSON.stringify(value));
    return spawnSync(process.execPath, ["--experimental-sqlite", "scripts/compare-database-state.mjs",
      "--report", path, "--expected-digest", value.logDelivery.digest, "--not-before", notBefore], { cwd: root, encoding: "utf8" });
  };
  try {
    assert.equal(run(fixture()).status, 0);
    const missing = fixture(); missing.report.objects.shift();
    assert.equal(run(missing).status, 1);
    writeFileSync(path, "PRIVATE_SENTINEL not JSON");
    const invalid = spawnSync(process.execPath, ["--experimental-sqlite", "scripts/compare-database-state.mjs",
      "--report", path, "--expected-digest", "a".repeat(64), "--not-before", notBefore], { cwd: root, encoding: "utf8" });
    assert.equal(invalid.status, 2); assert.doesNotMatch(invalid.stderr, /PRIVATE_SENTINEL/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test("uncommitted migration changes are refused before replay", () => {
  const directory = mkdtempSync(join(tmpdir(), "schema-source-"));
  try {
    execFileSync("git", ["init", "-q", directory]);
    execFileSync("git", ["-C", directory, "config", "user.email", "synthetic@example.test"]);
    execFileSync("git", ["-C", directory, "config", "user.name", "Synthetic comparator test"]);
    mkdirSync(join(directory, "drizzle/meta"), { recursive: true });
    const journal = join(directory, "drizzle/meta/_journal.json");
    const migration = join(directory, "drizzle/0000_fixture.sql");
    writeFileSync(journal, JSON.stringify({ entries: [{ idx: 0, tag: "0000_fixture" }] }));
    writeFileSync(migration, "CREATE TABLE fixture(id INTEGER PRIMARY KEY);");
    execFileSync("git", ["-C", directory, "add", "drizzle"]);
    execFileSync("git", ["-C", directory, "commit", "-qm", "synthetic"]);
    assert.equal(buildExpectedSchema(directory).objects.length, 1);
    writeFileSync(migration, "CREATE TABLE fixture(id INTEGER PRIMARY KEY, changed TEXT);");
    assert.throws(() => buildExpectedSchema(directory), /migration_input_not_committed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
