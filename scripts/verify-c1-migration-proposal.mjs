#!/usr/bin/env node
// LOCAL RESEARCH ONLY / NOT FOR HOSTED EXECUTION. Never opens a supplied database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
if (![1, 3].includes(args.length) || (args.length === 3 && args[1] !== '--output')) {
  throw new Error('Usage: node --experimental-sqlite verify-c1-migration-proposal.mjs /path/to/proposal-checkout [--output /path/to/new-result.json]');
}
const checkout = resolve(args[0]), output = args[2] && resolve(args[2]);
if (output) assert(!relative(checkout, output).split(sep).every(part => part !== '..'), 'Research output must be outside the Site checkout');
const originalCommit = 'adf1023b06458e8fdeb390f524e86b3fa7097329';
const migrationPath = 'drizzle/0022_loving_juggernaut.sql';
const originalHash = '2ebc937ea8ab24670754d13247aaf4251ae941949bf99301c9f605a89808b111';
const proposedHash = '5a7d2c2ca5b724e5f29bf27660a45191fb68b6d676491a1af7414e55f2f3760a';
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...argv) => execFileSync('git', argv, { cwd: checkout, maxBuffer: 32 * 1024 * 1024 });
const original = git('show', `${originalCommit}:${migrationPath}`).toString('utf8');
const proposed = readFileSync(resolve(checkout, migrationPath), 'utf8');
assert.equal(hash(original), originalHash); assert.equal(hash(proposed), proposedHash);
let attached = 0, parenthesized = 0;
const expected = original.replace(/;\s*\n\s*--> statement-breakpoint/gu, () => { attached++; return ';--> statement-breakpoint'; })
  .replace(/SELECT (CASE[\s\S]*? END);/gu, (_, body) => { parenthesized++; return `SELECT (${body});`; });
assert.equal(attached, 7); assert.equal(parenthesized, 8); assert.equal(proposed, expected, 'Only the seven breakpoint attachments and eight CASE wrappers are permitted');
const normalizeCaseWrappers = text => text.replace(/SELECT \((CASE[\s\S]*? END)\);/gu, 'SELECT $1;');
const units = text => text.split('--> statement-breakpoint').map(unit => unit.trim());
const originalUnits = units(original), proposedUnits = units(proposed);
assert.equal(originalUnits.length, 31); assert.equal(proposedUnits.length, 31);
assert(proposedUnits.every(unit => unit && Buffer.byteLength(unit) <= 100000));
assert.deepEqual(proposedUnits.map(normalizeCaseWrappers), originalUnits);
const trackedDrizzle = git('ls-tree', '-r', '--name-only', originalCommit, '--', 'drizzle').toString('utf8').trim().split('\n').filter(Boolean).sort();
function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(resolve(directory, item.name)) : [relative(checkout, resolve(directory, item.name)).split(sep).join('/')]); }
assert.deepEqual(files(resolve(checkout, 'drizzle')).sort(), trackedDrizzle, 'No migration or metadata file may be added/removed');
const fileManifest = trackedDrizzle.map(path => {
  const prior = git('show', `${originalCommit}:${path}`), current = readFileSync(resolve(checkout, path));
  if (path !== migrationPath) assert.equal(hash(current), hash(prior), `${path} must remain byte-identical`);
  return { path, originalSha256: hash(prior), proposalSha256: hash(current) };
});
const journal = JSON.parse(readFileSync(resolve(checkout, 'drizzle/meta/_journal.json'), 'utf8'));
assert.equal(journal.entries.length, 23);
assert.deepEqual(journal.entries.map(entry => entry.idx), Array.from({ length: 23 }, (_, index) => index));
assert.equal(journal.entries.at(-1).tag + '.sql', '0022_loving_juggernaut.sql');
const chain = journal.entries.map(entry => ({ path: `drizzle/${entry.tag}.sql`, sql: readFileSync(resolve(checkout, `drizzle/${entry.tag}.sql`), 'utf8') }));
const encode = value => JSON.stringify(value, (_, part) => typeof part === 'bigint' ? `${part}n` : part instanceof Uint8Array ? { blobHex: Buffer.from(part).toString('hex') } : part);
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const schema = db => db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all().map(row => ({ ...row, sql: row.sql === null ? null : normalizeCaseWrappers(row.sql) }));
const summarizeSchema = rows => ({ objects: rows.length, sha256: hash(encode(rows)), counts: Object.fromEntries(['table', 'index', 'trigger', 'view'].map(type => [type, rows.filter(row => row.type === type).length])) });
function rowsSnapshot(db, names) {
  return names.map(name => ({ table: name, rows: db.prepare(`SELECT * FROM ${quote(name)}`).all().map(encode).sort() }));
}
function rowSummary(snapshot) { return { sha256: hash(encode(snapshot)), tables: snapshot.map(item => ({ name: item.table, rows: item.rows.length, sha256: hash(encode(item.rows)) })) }; }
function integrity(db, allowIncompleteParents = false) {
  const enabled = db.prepare('PRAGMA foreign_keys').get().foreign_keys;
  assert.equal(enabled, 1, 'Foreign-key enforcement must remain enabled');
  const check = db.prepare('PRAGMA integrity_check').all();
  assert.deepEqual(check.map(row => row.integrity_check), ['ok']);
  let foreignKeys;
  try {
    foreignKeys = { completed: true, violations: db.prepare('PRAGMA foreign_key_check').all() };
    assert.deepEqual(foreignKeys.violations, []);
  } catch (error) {
    if (!allowIncompleteParents) throw error;
    // Incomplete prefix schemas can legitimately lack a referenced table/index.
    assert.match(String(error.message), /no such table|foreign key mismatch/i);
    foreignKeys = { completed: false, reason: error.message, acceptedAsValidFinalState: false };
  }
  return { foreignKeysEnabled: true, integrityCheck: 'ok', foreignKeys };
}
const databases = new Set();
function fresh(lastIndex = 22, finalSql = proposed) {
  const db = new DatabaseSync(':memory:'); databases.add(db); db.exec('PRAGMA foreign_keys=ON');
  for (let i = 0; i <= lastIndex; i++) db.exec(i === 22 ? finalSql : chain[i].sql);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  return db;
}
function close(db) { db.close(); databases.delete(db); }
const seedSql = [
  "INSERT INTO users (email,display_name,created_at,updated_at) VALUES ('local-migration-research@example.test','Synthetic migration research','2026-09-23T00:00:00.000Z','2026-09-23T00:00:00.000Z')",
  "INSERT INTO audit_events (actor_email,event_type,object_type,object_id,detail,created_at) VALUES ('local-migration-research@example.test','research_baseline','local_only','research-case','{\"synthetic\":true}','2026-09-23T00:00:00.000Z')",
  "INSERT INTO case_drafts (user_email,case_id,version,fingerprint,title,payload,created_at,updated_at) VALUES ('local-migration-research@example.test','research-case','1.0.0','sha256-local-research-only','Synthetic pre-0022 draft','{\"synthetic\":true}','2026-09-23T00:00:00.000Z','2026-09-23T00:00:00.000Z')",
];
function baseline() { const db = fresh(21); for (const sql of seedSql) db.exec(sql); integrity(db); return db; }
function failKnownIncomplete(db, submittedSql) {
  let failure;
  try { db.exec(submittedSql); } catch (error) { failure = { name: error.name, message: error.message, code: error.code, errcode: error.errcode, errstr: error.errstr }; }
  assert(failure, 'Injected incomplete SQL must fail'); assert.match(failure.message, /incomplete input/i);
  return failure;
}
function truncateUnit(unit) {
  if (/^CREATE TRIGGER\b/u.test(unit)) return unit.slice(0, unit.indexOf(';') + 1);
  assert(/^CREATE (?:UNIQUE )?(?:TABLE|INDEX)\b/u.test(unit));
  return unit.slice(0, unit.indexOf('(') + 1);
}
const startedAt = new Date().toISOString();
let report;
try {
  const originalDb = fresh(22, original), proposedDb = fresh(22, proposed);
  const originalSchema = schema(originalDb), finalSchema = schema(proposedDb);
  assert.equal(originalSchema.length, 627); assert.deepEqual(originalSchema, finalSchema);
  const sqliteVersion = proposedDb.prepare('SELECT sqlite_version() version').get().version;
  const freshChecks = { original: integrity(originalDb), proposed: integrity(proposedDb) };
  close(originalDb); close(proposedDb);
  const reference = baseline(), initialSchema = schema(reference), baselineTables = initialSchema.filter(item => item.type === 'table').map(item => item.name);
  const referenceRows = rowsSnapshot(reference, baselineTables), expectedPrefixSchemas = [initialSchema];
  for (const unit of proposedUnits) { reference.exec(unit); expectedPrefixSchemas.push(schema(reference)); }
  assert.deepEqual(schema(reference), finalSchema); assert.deepEqual(rowsSnapshot(reference, baselineTables), referenceRows);
  const ledgerObjects = initialSchema.filter(item => /(?:migration|ledger)/iu.test(item.name)).map(item => item.name);
  assert.deepEqual(ledgerObjects, [], 'Research does not fabricate platform migration tables');
  const baselineInventory = rowSummary(referenceRows); close(reference);
  const prefixModels = [];
  for (let prefix = 0; prefix < proposedUnits.length; prefix++) {
    const db = baseline(), beforeRows = rowsSnapshot(db, baselineTables);
    for (let index = 0; index < prefix; index++) db.exec(proposedUnits[index]);
    const beforeFailure = schema(db); assert.deepEqual(beforeFailure, expectedPrefixSchemas[prefix]);
    const submitted = truncateUnit(originalUnits[prefix]);
    const failure = failKnownIncomplete(db, submitted);
    assert.deepEqual(schema(db), beforeFailure, 'Failed truncated statement must leave this observed local prefix unchanged');
    assert.deepEqual(rowsSnapshot(db, baselineTables), beforeRows);
    const prefixChecks = integrity(db, true);
    // This suffix-only continuation is justified ONLY by this model's exact known prefix.
    for (let index = prefix; index < proposedUnits.length; index++) db.exec(proposedUnits[index]);
    assert.deepEqual(schema(db), finalSchema); assert.deepEqual(rowsSnapshot(db, baselineTables), beforeRows);
    const finalChecks = integrity(db);
    const finalNames = new Set(initialSchema.map(item => item.name));
    prefixModels.push({
      model: 'MODELED_NONTRANSACTIONAL_PREFIX_NOT_OBSERVED_HOSTED_STATE', completedUnitsBeforeInjectedFailure: prefix,
      failedUnitOneBased: prefix + 1, submittedSql: submitted, submittedSqlSha256: hash(submitted), failure,
      observedPrefixSchema: summarizeSchema(beforeFailure), newlyPresentObjects: beforeFailure.filter(item => !finalNames.has(item.name)).map(({ type, name }) => ({ type, name })),
      prefixChecks, baselineRowsBeforeAndAfter: rowSummary(beforeRows), failedStatementLeftInventoryAndRowsUnchanged: true,
      continuation: { precondition: 'exact observed modeled schema and baseline row digests match; failed statement has no observed effects', executedOnlyUnitNumbers: Array.from({ length: 31 - prefix }, (_, index) => prefix + index + 1), fullFileReplayed: false, resultingSchema: summarizeSchema(schema(db)), originalRowsPreserved: true, checks: finalChecks },
    });
    close(db);
  }
  const firstTrigger = originalUnits.findIndex(unit => /^CREATE TRIGGER\b/u.test(unit)); assert.equal(firstTrigger, 15);
  const transactional = baseline(), priorRows = rowsSnapshot(transactional, baselineTables), priorSchema = schema(transactional);
  transactional.exec('BEGIN IMMEDIATE');
  for (let index = 0; index < firstTrigger; index++) transactional.exec(proposedUnits[index]);
  const transactionPrefix = schema(transactional), submitted = truncateUnit(originalUnits[firstTrigger]);
  const transactionFailure = failKnownIncomplete(transactional, submitted);
  assert.deepEqual(schema(transactional), transactionPrefix);
  transactional.exec('ROLLBACK');
  assert.deepEqual(schema(transactional), priorSchema); assert.deepEqual(rowsSnapshot(transactional, baselineTables), priorRows);
  const transactionChecks = integrity(transactional); close(transactional);
  // A fully completed local chain is identified by its inventory and never rerun.
  const completed = baseline(); for (const unit of proposedUnits) completed.exec(unit);
  assert.deepEqual(schema(completed), finalSchema); const completedChecks = integrity(completed); close(completed);
  for (const item of fileManifest) assert.equal(hash(readFileSync(resolve(checkout, item.path))), item.proposalSha256, 'Checkout migration inputs changed during research');
  report = {
    kind: 'c1-migration-proposal-local-research-v1', status: 'LOCAL RESEARCH PASS / NOT FOR HOSTED EXECUTION', startedAt, completedAt: new Date().toISOString(),
    environment: { node: process.version, sqlite: sqliteVersion, platform: process.platform, database: ':memory: only', checkoutHead: git('rev-parse', 'HEAD').toString('utf8').trim() },
    inputs: { originalCommit, migrationPath, originalHash, proposedHash, fileManifest, journalAndSnapshotsByteIdentical: true },
    exactDiff: { breakpointAttachments: attached, caseParenthesizations: parenthesized, statementUnits: proposedUnits.length, normalizedUnitsEqualInExactOrder: true, otherSqlChanges: false },
    normalization: 'Only SELECT (CASE ... END); -> SELECT CASE ... END; for statement/schema comparison. Whitespace, business predicates, exception messages, constraints and names are otherwise retained; rootpage/storage placement excluded.',
    freshChain: { migrations: chain.map(item => ({ path: item.path, units: units(item.sql).length, sha256: hash(item.sql) })), originalAndProposalNormalizedSchemaEqual: true, finalSchema: summarizeSchema(finalSchema), checks: freshChecks },
    schemaInventories: { pre0022: initialSchema, finalNormalized: finalSchema },
    baselineData: { scope: 'Bundled migration seed rows plus one synthetic users/audit_events/case_drafts row; NOT a representative populated-v91 dossier/R2/handler rehearsal', seedSql, referenceInventory: baselineInventory },
    migrationLedger: { platformLedgerAvailable: false, localLedgerObjects: ledgerObjects, fabricatedLedger: false, sourceJournalIsNotDatabaseLedger: true },
    statementManifest: proposedUnits.map((sql, index) => ({ oneBased: index + 1, originalSql: originalUnits[index], proposedSql: sql, originalSha256: hash(originalUnits[index]), proposedSha256: hash(sql) })),
    modeledNontransactionalPrefixes: prefixModels,
    modeledAlreadyComplete: { completedUnits: 31, observedSchema: summarizeSchema(finalSchema), attemptedMigrationRerun: false, checks: completedChecks },
    modeledTransactionalRollback: { label: 'EXPLICIT LOCAL SQLITE TRANSACTION; HOSTED TRANSACTION BOUNDARY UNKNOWN', completedUnitsBeforeFailure: firstTrigger, submittedSql: submitted, failure: transactionFailure, before: summarizeSchema(priorSchema), uncommittedPrefix: summarizeSchema(transactionPrefix), rollbackCommand: 'ROLLBACK', exactBaselineSchemaAndRowsRestored: true, baselineRows: rowSummary(priorRows), checks: transactionChecks, fullChainRerunAfterRollback: false, restoreMechanismTested: false },
    validity: { originalFilesUnchanged: true, noDataDeletion: true, noTriggerOrConstraintDisabling: true, foreignKeysAlwaysEnabled: true, noLedgerWrites: true, noHostedExecution: true, modeledFailureCauseIsDeliberateTruncation: true },
    limitations: [
      'The deliberate truncation model reproduces SQLite incomplete input; it does not identify the historical hosted failing migration, submitted bytes, parser or batch boundary.',
      'Every modeled target is independently created in memory with known pre-state. No production/review database, ledger, retained partial state or recovery capability was inspected.',
      'Suffix-only continuation is safe only under the verified local prefix assumptions. It is not a supported hosted reconciliation procedure or permission to modify an applied migration.',
      'Explicit local SQL ROLLBACK is not backup/restore rehearsal and proves nothing about hosted D1 transaction semantics, D1/R2 consistency, or application rollback.',
      'Populated dossier/receipt/document/permission/handler probes and exact v91 application compatibility are separate checks; this verifier does not claim them.',
    ],
  };
} finally { for (const db of databases) db.close(); }
const result = JSON.stringify(report, null, 2) + '\n';
if (output) {
  writeFileSync(output, result, { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, output, resultSha256: hash(result), exactDiff: report.exactDiff, finalSchema: report.freshChain.finalSchema, prefixModels: report.modeledNontransactionalPrefixes.length, localTransactionRollback: report.modeledTransactionalRollback.exactBaselineSchemaAndRowsRestored, hostedRootCauseProven: false }, null, 2));
} else process.stdout.write(result);
