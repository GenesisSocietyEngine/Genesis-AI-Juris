import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REVISION = "m0-readonly-2026-09-25.2";
const HASH = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,159}$/;
const LEDGERS = ["__drizzle_migrations", "d1_migrations", "__appgarden_migrations"];
const PROVIDER_TABLES = new Set([...LEDGERS, "_cf_KV"]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const key = (object) => object.type + ":" + object.name;
const issue = (condition, code) => { if (!condition) throw new Error(code); };
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isoTime = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === (value.includes(".") ? value : value.replace("Z", ".000Z"));

function committedBytes(root, path, sourceCommit) {
  const bytes = readFileSync(resolve(root, path));
  const committed = execFileSync("git", ["show", sourceCommit + ":" + path], { cwd: root, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  issue(bytes.equals(committed), "migration_input_not_committed:" + path);
  return bytes;
}

// This database has no file, network binding, production rows or extensions.
export function buildExpectedSchema(root = ROOT) {
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  issue(/^[a-f0-9]{40}$/.test(sourceCommit), "invalid_source_commit");
  const journalBytes = committedBytes(root, "drizzle/meta/_journal.json", sourceCommit);
  const journal = JSON.parse(journalBytes.toString("utf8"));
  issue(Array.isArray(journal.entries) && journal.entries.length > 0, "invalid_migration_journal");
  const db = new DatabaseSync(":memory:");
  const migrations = [];
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const [index, entry] of journal.entries.entries()) {
      issue(entry.idx === index && typeof entry.tag === "string" && /^[0-9]{4}_[A-Za-z0-9_]+$/.test(entry.tag)
        && entry.tag.startsWith(String(index).padStart(4, "0") + "_"), "invalid_migration_entry");
      const path = "drizzle/" + entry.tag + ".sql";
      const bytes = committedBytes(root, path, sourceCommit);
      db.exec(bytes.toString("utf8"));
      migrations.push({ name: entry.tag + ".sql", sha256: sha256(bytes) });
    }
    const objects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name").all().map((row) => ({
      type: row.type, name: row.name, table: row.tbl_name,
      definitionSha256: row.sql === null ? null : sha256(row.sql),
    }));
    return { sourceCommit, journalSha256: sha256(journalBytes), migrations, objects };
  } finally { db.close(); }
}

function validateReport(envelope, expectedDigest, notBefore) {
  issue(HASH.test(expectedDigest), "invalid_expected_digest");
  issue(isoTime(notBefore), "invalid_not_before");
  issue(plain(envelope) && plain(envelope.report) && plain(envelope.logDelivery), "invalid_response_envelope");
  issue(typeof envelope.requestId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(envelope.requestId), "invalid_request_id");
  const report = envelope.report;
  issue(sha256(JSON.stringify(report)) === expectedDigest && envelope.logDelivery.digest === expectedDigest, "report_digest_mismatch");
  // A directly saved response is evidence even if the separate logging sink failed.
  issue(["submitted", "failed"].includes(envelope.logDelivery.status), "invalid_log_delivery");
  issue(Number.isSafeInteger(envelope.logDelivery.chunks) && envelope.logDelivery.chunks > 0, "invalid_log_chunk_count");
  issue(envelope.logDelivery.chunks === Math.ceil(JSON.stringify(report).length / 2500), "log_chunk_count_mismatch");
  issue(report.revision === REVISION && report.scope === "application_binding_metadata_only" && report.binding === "DB", "unsupported_report_contract");
  issue(report.state === "collected" && report.schemaStable === true, "report_incomplete_or_unstable");
  issue(isoTime(report.capturedAt) && Date.parse(report.capturedAt) >= Date.parse(notBefore), "report_older_than_requested_window");
  issue(Array.isArray(report.objects) && report.objects.length > 0 && report.objects.length <= 1024, "invalid_catalogue");
  issue(report.objectCount === report.objects.length && HASH.test(report.schemaDigest), "invalid_catalogue_count_or_digest");
  issue(sha256(JSON.stringify(report.objects)) === report.schemaDigest, "schema_digest_mismatch");
  const keys = new Set();
  let previous = "";
  for (const object of report.objects) {
    issue(plain(object) && Object.keys(object).sort().join(",") === "definitionSha256,name,table,type", "invalid_schema_object");
    issue(["table", "index", "trigger", "view"].includes(object.type) && IDENTIFIER.test(object.name) && IDENTIFIER.test(object.table), "invalid_schema_identifier");
    issue(object.definitionSha256 === null || HASH.test(object.definitionSha256), "invalid_definition_digest");
    const identity = key(object);
    issue(!keys.has(identity) && identity > previous, "duplicate_or_unsorted_schema_object");
    keys.add(identity); previous = identity;
  }
  issue(Array.isArray(report.ledgers) && report.ledgers.length === LEDGERS.length, "incomplete_ledger_inventory");
  const names = new Set();
  for (const ledger of report.ledgers) {
    issue(plain(ledger) && LEDGERS.includes(ledger.name) && !names.has(ledger.name), "invalid_ledger_inventory");
    names.add(ledger.name);
    issue(["read", "absent"].includes(ledger.status), "ledger_incomplete");
    const tablePresent = report.objects.some((object) => object.type === "table" && object.name === ledger.name);
    issue(tablePresent === (ledger.status === "read"), "ledger_catalogue_disagreement");
    if (ledger.status === "read") {
      issue(Array.isArray(ledger.rows) && ledger.rows.length <= 128 && ledger.rows.every(plain), "invalid_ledger_rows");
      issue(ledger.stable !== false && (!ledger.omittedValueColumns || ledger.omittedValueColumns.length === 0), "ledger_incomplete");
      if (ledger.name === "__appgarden_migrations") {
        const allowed = ["id", "name", "filename", "migration_name", "version", "hash", "checksum", "applied_at", "created_at", "executed_at", "timestamp", "batch", "status"];
        issue(Array.isArray(ledger.columns) && ledger.columns.length > 0 && ledger.columns.length <= 64
          && ledger.columns.every((column) => plain(column) && allowed.includes(column.name) && typeof column.type === "string"), "invalid_platform_columns");
        const columns = ledger.columns.map((column) => column.name).sort();
        issue(new Set(columns).size === columns.length && ledger.rows.every((row) => Object.keys(row).sort().join(",") === columns.join(",")), "platform_projection_mismatch");
      }
    }
  }
  return report;
}

function providerOnly(object, objects) {
  if (object.type === "table") return object.name === object.table && PROVIDER_TABLES.has(object.name);
  return object.type === "index" && PROVIDER_TABLES.has(object.table) && object.definitionSha256 === null
    && objects.some((owner) => owner.type === "table" && owner.name === object.table && owner.table === object.table)
    && object.name.startsWith("sqlite_autoindex_" + object.table + "_")
    && /^[1-9][0-9]*$/.test(object.name.slice(("sqlite_autoindex_" + object.table + "_").length));
}

export function compareDatabaseState(envelope, expected, { expectedDigest, notBefore }) {
  const report = validateReport(envelope, expectedDigest, notBefore);
  const observed = new Map(report.objects.map((object) => [key(object), object]));
  const expectedKeys = new Set(expected.objects.map(key));
  const missing = expected.objects.filter((object) => !observed.has(key(object)));
  const changed = expected.objects.filter((object) => observed.has(key(object)) && (
    observed.get(key(object)).table !== object.table || observed.get(key(object)).definitionSha256 !== object.definitionSha256
  )).map((object) => ({ expected: object, observed: observed.get(key(object)) }));
  const extras = report.objects.filter((object) => !expectedKeys.has(key(object)));
  const providerObjects = extras.filter((object) => providerOnly(object, report.objects));
  const unexpectedObjects = extras.filter((object) => !providerOnly(object, report.objects));
  const platform = report.ledgers.find((ledger) => ledger.name === "__appgarden_migrations");
  const expectedNames = expected.migrations.map((migration) => migration.name);
  const migrationNames = [];
  const ledgerProblems = [];
  if (platform.status !== "read" || platform.stable !== true) ledgerProblems.push("platform_ledger_not_read_and_stable");
  else {
    if (!Array.isArray(platform.columns) || platform.omittedValueColumns?.length !== 0) ledgerProblems.push("platform_columns_incomplete");
    for (const row of platform.rows) {
      const aliases = ["name", "filename", "migration_name"].filter((column) => Object.hasOwn(row, column));
      const names = aliases.map((column) => {
        const value = row[column];
        if (typeof value !== "string" || !/^(?:drizzle\/)?[0-9]{4}_[A-Za-z0-9_-]{1,120}(?:\.sql)?$/.test(value)) return null;
        const name = value.replace(/^drizzle\//, "");
        return name.endsWith(".sql") ? name : name + ".sql";
      });
      if (!names.length || names.some((name) => name === null || name !== names[0])) ledgerProblems.push("unresolved_or_conflicting_migration_identity");
      else migrationNames.push(names[0]);
      if (!isoTime(row.applied_at) && !(typeof row.applied_at === "string" && /^\d{4}-\d{2}-\d{2} /.test(row.applied_at) && Number.isFinite(Date.parse(row.applied_at)))) ledgerProblems.push("applied_timestamp_unverified");
      if (Object.hasOwn(row, "status") && !["applied", "succeeded", "completed"].includes(row.status)) ledgerProblems.push("migration_status_not_applied");
    }
  }
  const missingMigrations = expectedNames.filter((name) => !migrationNames.includes(name));
  const unexpectedMigrations = migrationNames.filter((name) => !expectedNames.includes(name));
  if (new Set(migrationNames).size !== migrationNames.length) ledgerProblems.push("duplicate_migration_identity");
  const matched = !missing.length && !changed.length && !unexpectedObjects.length && !ledgerProblems.length && !missingMigrations.length && !unexpectedMigrations.length;
  return {
    status: matched ? "MATCH" : "MISMATCH",
    scope: "application_schema_and_named_platform_ledger_only",
    sourceCommit: expected.sourceCommit, journalSha256: expected.journalSha256, migrations: expected.migrations,
    requestId: envelope.requestId, capturedAt: report.capturedAt, notBefore,
    reportDigest: expectedDigest, schemaDigest: report.schemaDigest,
    expectedApplicationObjects: expected.objects.length, observedObjects: report.objectCount,
    missing, changed, unexpectedObjects, providerObjects,
    platformLedger: { status: platform.status, stable: platform.stable === true, observedMigrationCount: migrationNames.length,
      missingMigrations, unexpectedMigrations, problems: [...new Set(ledgerProblems)] },
    limitations: [
      "input_provenance_and_deployed_binary_not_attested",
      "capture_timestamp_is_not_independently_attested",
      "not_an_atomic_database_snapshot",
      "provider_objects_classified_not_definition_verified",
      "migration_ledger_hash_semantics_not_verified",
      "foreign_key_data_integrity_and_existing_rows_not_checked",
      "physical_D1_R2_identity_backup_and_restore_not_verified",
      "no_production_queries_writes_migrations_or_release_approval",
    ],
  };
}

export function main(args = process.argv.slice(2)) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    issue(["--report", "--expected-digest", "--not-before"].includes(args[index]) && args[index + 1] && !flags.has(args[index]), "invalid_arguments");
    flags.set(args[index], args[index + 1]);
  }
  issue(flags.size === 3, "usage: node --experimental-sqlite scripts/compare-database-state.mjs --report FILE --expected-digest SHA256 --not-before UTC_ISO");
  const bytes = readFileSync(resolve(flags.get("--report")));
  issue(bytes.length <= 2 * 1024 * 1024, "report_file_too_large");
  const expected = buildExpectedSchema();
  const result = compareDatabaseState(JSON.parse(bytes.toString("utf8")), expected, {
    expectedDigest: flags.get("--expected-digest"), notBefore: flags.get("--not-before"),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return result.status === "MATCH" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) {
    // Do not echo paths, report bytes, SQL, or third-party exception details.
    const message = error instanceof Error ? error.message : "";
    const safe = /^(?:[a-z_]+(?::drizzle\/[A-Za-z0-9_./]+)?|usage: .+)$/.test(message) ? message : "comparison_input_or_execution_failed";
    process.stderr.write(JSON.stringify({ status: "INVALID", error: safe }) + "\n");
    process.exitCode = 2;
  }
}
