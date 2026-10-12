import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { buildConvertedExample, CONVERTED_EXAMPLES } from '../app/converted-examples';
import { CANOPY_SCENARIOS, buildCanopyPackage } from '../app/canopy-fixture';
import { createExampleWorkingCopy } from '../app/example-working-copy';
import { caseFingerprint } from '../app/case-integrity';
import { readStudioAggregate } from '../app/studio-aggregate';
import { studioOverview } from '../app/studio-overview';
import type { StudioDraft } from '../app/types';
import { fixture } from './helpers/tax-report-fixture';

const examples = [
  ...Object.keys(CONVERTED_EXAMPLES).map(id => buildConvertedExample(id, 'en')),
  ...CANOPY_SCENARIOS.map(scenario => buildCanopyPackage(scenario.id, true).draft),
];

for (const source of examples) test(source.caseId + ' survives independent database saves and reopening', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON');
    for (const migration of ['0000_worthless_supreme_intelligence.sql', '0001_right_talon.sql', '0002_greedy_darkstar.sql', '0003_unusual_zarda.sql', '0004_petite_komodo.sql']) {
      db.exec(readFileSync(new URL('../drizzle/' + migration, import.meta.url), 'utf8'));
    }
    const owner = 'migration-review@example.test';
    const save = (draft: StudioDraft) => {
      const read = readStudioAggregate(JSON.stringify(draft), { kind: 'draft' });
      assert.equal(read.status, 'editable');
      if (read.status !== 'editable') throw new Error('Draft cannot be saved');
      const normalized = read.draft, fingerprint = caseFingerprint(normalized);
      const id = Number(db.prepare('INSERT INTO custom_cases(owner_email,case_id,title,current_version,fingerprint,is_private) VALUES(?,?,?,?,?,true)').run(owner, normalized.caseId, normalized.title, normalized.version, fingerprint).lastInsertRowid);
      db.prepare('INSERT INTO case_drafts(user_email,case_id,version,fingerprint,title,payload,custom_case_id) VALUES(?,?,?,?,?,?,?)').run(owner, normalized.caseId, normalized.version, fingerprint, normalized.title, JSON.stringify(normalized), id);
      return id;
    };
    // Simulate a user's pre-existing saved case under the legacy source identity.
    const existing = structuredClone(source);
    existing.title = 'Existing user case — preserve my edits';
    existing.nodes[0].detail += '\nPreviously saved private notes.';
    const existingId = save(existing);
    const before = db.prepare('SELECT * FROM custom_cases WHERE id=?').get(existingId);
    const beforeDraft = db.prepare('SELECT * FROM case_drafts WHERE custom_case_id=?').get(existingId);
    const first = createExampleWorkingCopy(source), second = createExampleWorkingCopy(source);
    const firstId = save(first), secondId = save(second);
    assert.notEqual(firstId, secondId);
    assert.throws(() => save(first), /UNIQUE/);
    for (const [id, original] of [[firstId, first], [secondId, second]] as const) {
      // Reopen uses the same exact envelope/version/fingerprint join as custom-cases GET.
      const row = db.prepare('SELECT d.payload FROM case_drafts d JOIN custom_cases c ON c.id=d.custom_case_id AND c.case_id=d.case_id AND c.current_version=d.version AND c.fingerprint=d.fingerprint WHERE c.id=? AND c.owner_email=?').get(id, owner);
      assert.ok(row);
      const read = readStudioAggregate(String(row.payload), { kind: 'draft' });
      assert.equal(read.status, 'editable');
      if (read.status !== 'editable') throw new Error('Saved draft cannot reopen');
      assert.equal(caseFingerprint(read.draft), caseFingerprint(original));
      assert.deepEqual(read.draft.exampleSource, original.exampleSource);
      assert.deepEqual(read.draft.nodes.filter(n => n.type === 'evidence'), original.nodes.filter(n => n.type === 'evidence'));
      if (source.caseId.startsWith('project_canopy')) {
        assert.equal(studioOverview(read.draft, 'en').documentCount, 9);
        assert.equal(studioOverview(read.draft, 'en').exactScenario, studioOverview(source, 'en').exactScenario);
      }
    }
    assert.deepEqual(db.prepare('SELECT * FROM custom_cases WHERE id=?').get(existingId), before);
    assert.deepEqual(db.prepare('SELECT * FROM case_drafts WHERE custom_case_id=?').get(existingId), beforeDraft);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('source references remain editable alongside preserved tax attachments', () => {
  const { draft } = fixture();
  const copy = createExampleWorkingCopy(draft);
  const read = readStudioAggregate(JSON.stringify(copy), { kind: 'draft' });
  assert.equal(read.status, 'editable');
  if (read.status !== 'editable') throw new Error('Known example source was rejected');
  assert.deepEqual(read.draft.exampleSource, copy.exampleSource);
  assert.equal(read.draft.taxAnalysis?.document, draft.taxAnalysis?.document);
  const future = readStudioAggregate(JSON.stringify({ ...copy, futureUnsupportedField: true }), { kind: 'draft' });
  assert.equal(future.status, 'unsupported', 'unknown tax-bearing fields still require recovery');
});
