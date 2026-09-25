// Fixed, read-only platform-administrator diagnostics. No customer rows or raw
// definitions leave this helper; this report never authorizes a migration.
export const DATABASE_DIAGNOSTIC_REVISION = "m0-readonly-2026-09-25.2";
const MAX_OBJECTS = 1024;
const MAX_LEDGER_ROWS = 128;
const CATALOG_SQL = "SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name LIMIT 1025";
const LEDGERS = [
  { name: "__drizzle_migrations", columns: ["id", "hash", "created_at"],
    schema: "SELECT name FROM pragma_table_info('__drizzle_migrations')",
    query: "SELECT id,hash,created_at FROM __drizzle_migrations ORDER BY id LIMIT 129" },
  { name: "d1_migrations", columns: ["id", "name", "applied_at"],
    schema: "SELECT name FROM pragma_table_info('d1_migrations')",
    query: "SELECT id,name,applied_at FROM d1_migrations ORDER BY id LIMIT 129" },
] as const;

interface Reader {
  prepare(sql: string): { all<T>(): Promise<{ success: boolean; results: T[] }> };
}
interface SchemaRow { type: string; name: string; tbl_name: string; sql: string | null }
interface SchemaObject { type: string; name: string; table: string; definitionSha256: string | null }
interface LedgerResult {
  name: string;
  status: "absent" | "read" | "unsupported_columns" | "unsupported_value" | "truncated" | "read_failed" | "changed_during_read";
  rows?: Record<string, string | number | null>[];
  columns?: { name: string; type: string }[];
  omittedValueColumns?: string[];
  stable?: boolean;
}

// This exact table was observed in the production catalogue. Only identifiers
// from this constant can enter the projection; discovered names and requests
// never become SQL. Unknown provider values (including SQL/JSON) are not read.
const PLATFORM_FIELDS = {
  id: "identity", name: "migration", filename: "migration", migration_name: "migration",
  version: "identity", hash: "hash", checksum: "hash", applied_at: "time",
  created_at: "time", executed_at: "time", timestamp: "time", batch: "integer", status: "status",
} as const;
type PlatformField = keyof typeof PLATFORM_FIELDS;

function safePlatformValue(column: PlatformField, value: unknown): value is string | number | null {
  if (value === null) return true; // Recorded null is evidence, never proof of application.
  const kind = PLATFORM_FIELDS[column];
  const integer = typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const migration = typeof value === "string" && /^(?:drizzle\/)?[0-9]{4}_[A-Za-z0-9_-]{1,120}(?:\.sql)?$/.test(value);
  if (kind === "integer") return integer;
  if (kind === "identity") return integer || migration;
  if (kind === "migration") return migration;
  if (kind === "hash") return typeof value === "string" && /^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(value);
  if (kind === "status") return typeof value === "string" && ["applied", "succeeded", "completed", "pending", "failed", "running"].includes(value);
  return integer || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}[T ][0-9:.+Z-]{8,32}$/.test(value) && Number.isFinite(Date.parse(value)));
}

async function readPlatformLedger(db: Reader, objects: SchemaObject[]): Promise<LedgerResult> {
  const name = "__appgarden_migrations";
  if (!objects.some((object) => object.type === "table" && object.name === name)) return { name, status: "absent" };
  let metadata: Pick<LedgerResult, "columns" | "omittedValueColumns"> = {};
  try {
    const schema = await db.prepare("SELECT name,type FROM pragma_table_info('__appgarden_migrations') LIMIT 65")
      .all<{ name: string; type: string }>();
    if (!schema.success || !Array.isArray(schema.results)) throw new Error("columns_unavailable");
    if (schema.results.length > 64) return { name, status: "truncated" };
    if (schema.results.length === 0 || !schema.results.every((c) =>
      typeof c.name === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,159}$/.test(c.name)
      && typeof c.type === "string" && /^[A-Za-z0-9_(), ]{0,64}$/.test(c.type))) return { name, status: "unsupported_columns" };
    const columns = schema.results.map((c) => ({ name: c.name, type: c.type }));
    const selected = (Object.keys(PLATFORM_FIELDS) as PlatformField[]).filter((field) => columns.some((c) => c.name === field));
    const omittedValueColumns = columns.filter((c) => !Object.hasOwn(PLATFORM_FIELDS, c.name)).map((c) => c.name);
    metadata = { columns, omittedValueColumns };
    if (selected.length === 0) return { name, status: "unsupported_columns", ...metadata };
    const sql = `SELECT ${selected.map((field) => `"${field}"`).join(",")} FROM "__appgarden_migrations" LIMIT 129`;
    async function readRows() {
      const result = await db.prepare(sql).all<Record<string, unknown>>();
      if (!result.success || !Array.isArray(result.results)) throw new Error("ledger_unavailable");
      if (result.results.length > MAX_LEDGER_ROWS) return { status: "truncated" as const };
      if (!result.results.every((row) => selected.every((field) => safePlatformValue(field, row[field])))) return { status: "unsupported_value" as const };
      const rows = result.results.map((row) => Object.fromEntries(selected.map((field) => [field, row[field] as string | number | null])));
      rows.sort((a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : x > y ? 1 : 0; });
      return { status: "read" as const, rows };
    }
    const first = await readRows();
    if (first.status !== "read") return { name, ...metadata, status: first.status };
    const second = await readRows();
    if (second.status !== "read") return { name, ...metadata, status: second.status };
    const stable = JSON.stringify(first.rows) === JSON.stringify(second.rows);
    return { name, ...metadata, stable, rows: first.rows,
      status: !stable ? "changed_during_read" : omittedValueColumns.length ? "unsupported_columns" : "read" };
  } catch { return { name, ...metadata, status: "read_failed" }; }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function readCatalog(db: Reader) {
  const result = await db.prepare(CATALOG_SQL).all<SchemaRow>();
  if (!result.success || !Array.isArray(result.results)) throw new Error("catalog_unavailable");
  const rows = result.results;
  if (rows.length > MAX_OBJECTS) throw new Error("catalog_limit");
  const objects: SchemaObject[] = [];
  for (const row of rows) {
    if (!["table", "index", "trigger", "view"].includes(row.type)
      || !/^[A-Za-z_][A-Za-z0-9_]{0,159}$/.test(row.name)
      || !/^[A-Za-z_][A-Za-z0-9_]{0,159}$/.test(row.tbl_name)
      || (row.sql !== null && (typeof row.sql !== "string" || row.sql.length > 65_536))) {
      throw new Error("unsupported_catalog");
    }
    objects.push({ type: row.type, name: row.name, table: row.tbl_name,
      definitionSha256: row.sql === null ? null : await sha256(row.sql) });
  }
  return { objects, digest: await sha256(JSON.stringify(objects)) };
}

function safeLedgerValue(column: string, value: unknown): value is string | number | null {
  if (value === null) return true;
  if (column === "id" || column === "created_at") return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (typeof value !== "string") return false;
  if (column === "hash") return /^[a-fA-F0-9]{64}$/.test(value);
  if (column === "name") return /^[0-9]{4}_[A-Za-z0-9_-]{1,120}(?:\.sql)?$/.test(value);
  if (column === "applied_at") return /^\d{4}-\d{2}-\d{2}[T ][0-9:.+Z-]{8,32}$/.test(value);
  return false;
}

export async function collectDatabaseState(db: Reader) {
  const capturedAt = new Date().toISOString();
  try {
    const before = await readCatalog(db);
    const ledgers: LedgerResult[] = [];
    for (const ledger of LEDGERS) {
      if (!before.objects.some((object) => object.type === "table" && object.name === ledger.name)) {
        ledgers.push({ name: ledger.name, status: "absent" });
        continue;
      }
      try {
        const columns = await db.prepare(ledger.schema).all<{ name: string }>();
        if (!columns.success || !columns.results) throw new Error("columns_unavailable");
        if (!ledger.columns.every((column) => columns.results.some((row) => row.name === column))) {
          ledgers.push({ name: ledger.name, status: "unsupported_columns" }); continue;
        }
        const result = await db.prepare(ledger.query).all<Record<string, unknown>>();
        if (!result.success || !Array.isArray(result.results)) throw new Error("ledger_unavailable");
        if (result.results.length > MAX_LEDGER_ROWS) {
          ledgers.push({ name: ledger.name, status: "truncated" }); continue;
        }
        const valid = result.results.every((row) => ledger.columns.every((column) => safeLedgerValue(column, row[column])));
        if (!valid) { ledgers.push({ name: ledger.name, status: "unsupported_value" }); continue; }
        ledgers.push({ name: ledger.name, status: "read", rows: result.results.map((row) =>
          Object.fromEntries(ledger.columns.map((column) => [column, row[column] as string | number | null]))) });
      } catch { ledgers.push({ name: ledger.name, status: "read_failed" }); }
    }
    ledgers.push(await readPlatformLedger(db, before.objects));
    const after = await readCatalog(db);
    const schemaStable = before.digest === after.digest;
    return {
      revision: DATABASE_DIAGNOSTIC_REVISION, capturedAt,
      state: schemaStable && ledgers.every((l) => l.status === "read" || l.status === "absent") ? "collected" : "incomplete",
      scope: "application_binding_metadata_only", binding: "DB", schemaStable,
      schemaDigest: before.digest, objectCount: before.objects.length, objects: before.objects, ledgers,
      limitations: ["not_an_atomic_database_snapshot", "absent_known_ledger_does_not_mean_unapplied", "physical_resource_and_external_ledger_unverified", "backup_and_restore_unverified", "not_a_migration_execution_approval"],
    };
  } catch {
    return { revision: DATABASE_DIAGNOSTIC_REVISION, capturedAt, state: "incomplete",
      scope: "application_binding_metadata_only", binding: "DB", schemaStable: false,
      reason: "catalog_unavailable_or_outside_limits" };
  }
}

// Chunks carry a full-report digest/count so incomplete platform log delivery
// cannot be mistaken for complete evidence. No diagnostic writes use D1/R2.
export async function emitDatabaseState(report: Awaited<ReturnType<typeof collectDatabaseState>>,
  requestId: string, sink: (line: string) => void = console.info) {
  const payload = JSON.stringify(report);
  const digest = await sha256(payload);
  const pieces = payload.match(/[\s\S]{1,2500}/g) ?? [];
  try {
    pieces.forEach((data, index) => sink(JSON.stringify({ schema: "genesis.juris.database-state.v1",
      requestId, digest, index, count: pieces.length, data })));
    return { status: "submitted" as const, digest, chunks: pieces.length };
  } catch { return { status: "failed" as const, digest, chunks: pieces.length }; }
}
