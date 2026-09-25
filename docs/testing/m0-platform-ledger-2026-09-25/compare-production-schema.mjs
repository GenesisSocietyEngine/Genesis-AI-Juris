import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const uploadedBytes = readFileSync(`${dir}uploaded-production-report.md`);
const text = uploadedBytes.toString('utf8');
const uploaded = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
assert.equal(sha(JSON.stringify(uploaded.report.objects)), uploaded.report.schemaDigest);
assert.equal(sha(JSON.stringify(uploaded.report)), uploaded.logDelivery.digest);
const native = JSON.parse(readFileSync(`${dir}native-diagnostic-chunks.json`, 'utf8'));
const chunks = native.chunks.sort((a, b) => a.index - b.index);
assert.equal(chunks.length, 44);
chunks.forEach((chunk, index) => {
  assert.equal(chunk.index, index); assert.equal(chunk.count, 44);
  assert.equal(chunk.requestId, uploaded.requestId); assert.equal(chunk.digest, uploaded.logDelivery.digest);
});
const payload = chunks.map((c) => c.data).join('');
assert.equal(sha(payload), uploaded.logDelivery.digest);
assert.deepEqual(JSON.parse(payload), uploaded.report);
const db = new DatabaseSync(':memory:');
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
for (const entry of journal.entries) db.exec(readFileSync(`drizzle/${entry.tag}.sql`, 'utf8'));
const objects = () => db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all().map((r) => ({
  type: r.type, name: r.name, table: r.tbl_name, definitionSha256: r.sql === null ? null : sha(r.sql),
}));
const baseline = objects();
const key = (o) => `${o.type}:${o.name}`;
const observed = new Map(uploaded.report.objects.map((o) => [key(o), o]));
assert.equal(observed.size, uploaded.report.objects.length);
const missing = baseline.filter((o) => !observed.has(key(o)));
const mismatched = baseline.filter((o) => observed.has(key(o)) && JSON.stringify(observed.get(key(o))) !== JSON.stringify(o));
const baseKeys = new Set(baseline.map(key));
const extra = uploaded.report.objects.filter((o) => !baseKeys.has(key(o)));
const migration = readFileSync('tests/fixtures/m0-corrected-pending.sql');
db.exec(migration.toString('utf8'));
const pendingObjects = objects().filter((o) => !baseKeys.has(key(o)));
const retainedPending = pendingObjects.filter((o) => observed.has(key(o)));
db.close();
assert.equal(baseline.length, 591); assert.equal(missing.length, 0); assert.equal(mismatched.length, 0);
assert.equal(pendingObjects.length, 36); assert.equal(retainedPending.length, 0); assert.equal(extra.length, 3);
const result = {
  requestId: uploaded.requestId, capturedAt: uploaded.report.capturedAt,
  uploadedFileSha256: sha(uploadedBytes), schemaDigestVerified: true, reportDigestVerified: true,
  nativeChunksVerified: chunks.length, nativeScriptVersion: native.scriptVersion,
  objectCount: observed.size, baselineObjectCount: baseline.length, missing, mismatched, extra,
  corrected0022Sha256: sha(migration), corrected0022Objects: pendingObjects, retained0022Objects: retainedPending,
  conclusion: 'At capture, every baseline schema object matches exactly and no 0022 schema object is retained. Ledger contents, application data, physical resource identity and recovery remain separate.',
};
writeFileSync(`${dir}SCHEMA_COMPARISON.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ baselineExact: baseline.length, missing: missing.length, mismatched: mismatched.length, pendingAbsent: pendingObjects.length, extra: extra.map((o) => o.name), nativeChunks: chunks.length }));
