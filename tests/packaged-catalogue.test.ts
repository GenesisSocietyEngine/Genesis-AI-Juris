import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PACKAGED_CATALOGUE_HOST, archiveHash, catalogueHtmlVariant, catalogueObserver, cataloguePort, catalogueRequestAllowed, catalogueTiming, extractCatalogueArchive, validateNativeListing } from '../scripts/lib/packaged-catalogue.mjs';
import { packagedCatalogueCases } from './fixtures/packaged-catalogue-cases';
import { buildCanopyPackage } from '../app/canopy-fixture';
import { caseFingerprint } from '../app/case-integrity';
import { studioMaterials } from '../app/studio-materials';

test('packaged synthetic copies retain genuine reference identity and independent graph bytes after title amendments', async () => {
  const source = buildCanopyPackage('base').draft, before = JSON.stringify(source);
  const renamed = { ...source, caseId: 'qa_renamed_without_reference' };
  assert.equal((await studioMaterials(renamed, 'en')).filter(item => item.kind === 'reference').length, 0);
  const copies = packagedCatalogueCases();
  assert.equal(copies.length, 48); assert.equal(new Set(copies.map(item => item.draft.caseId)).size, 48);
  for (const { id, draft } of copies) {
    assert.equal(draft.exampleSource?.caseId, source.caseId);
    assert.equal(draft.exampleSource?.version, source.version);
    assert.equal(draft.exampleSource?.fingerprint, caseFingerprint(source));
    assert.match(draft.title, /SYNTHETIC packaged catalogue/); assert.notEqual(draft.caseId, source.caseId);
    const materials = await studioMaterials(draft, id % 2 ? 'en' : 'ru');
    assert.equal(materials.filter(item => item.kind === 'reference').length, 15);
    assert.equal(materials.filter(item => item.kind === 'reference' && item.selected).length, 9);
  }
  const secondBefore = JSON.stringify(copies[1].draft);
  copies[0].draft.nodes[0].detail += '\nSynthetic independent amendment.';
  assert.equal(JSON.stringify(copies[1].draft), secondBefore);
  assert.equal(JSON.stringify(source), before);
});

test('local observation/scroll variants are explicit, confined and never interpolate query code into original HTML', () => {
  const html = '<html><head></head><body>original</body></html>';
  assert.equal(catalogueHtmlVariant(html, '/matters', new URLSearchParams()).html, html);
  assert.equal(catalogueHtmlVariant(html, '/studio', new URLSearchParams('qa_observe=1&qa_scroll=auto')).html, html);
  assert.equal(catalogueHtmlVariant(html, '/account', new URLSearchParams()).html, html);
  const account = catalogueHtmlVariant(html, '/account', new URLSearchParams('qa_observe=1&qa_scroll=auto'));
  assert.equal(account.observed, true); assert.equal(account.immediateScroll, false);
  assert.match(account.html, /\/__qa\/observer.js/); assert.doesNotMatch(account.html, /\/__qa\/scroll.css/);
  const variant = catalogueHtmlVariant(html, '/matters', new URLSearchParams('qa_observe=1&qa_scroll=auto&other=%3Cscript%3E'));
  assert.ok(variant.observed && variant.immediateScroll); assert.match(variant.html, /\/__qa\/observer.js/); assert.match(variant.html, /\/__qa\/scroll.css/);
  assert.doesNotMatch(variant.html, /other|<script>/); assert.doesNotMatch(catalogueObserver, /preventDefault|stopPropagation|fetch\(|XMLHttpRequest|cookie|localStorage/);
  assert.doesNotMatch(catalogueObserver, /\.value|FormData|password|email/);
  for (const boundary of ['submit', 'focusin', 'elementFromPoint', 'document.hasFocus()', 'Date.now()']) assert.ok(catalogueObserver.includes(boundary));
});

test('packaged catalogue permits real local login but refuses every case/account mutation', () => {
  assert.equal(catalogueRequestAllowed('POST', '/api/auth/login'), true);
  for (const path of ['/api/custom-cases', '/api/auth/logout', '/api/profile', '/api/custom-cases/report-receipts', '/__qa/trace']) {
    assert.equal(catalogueRequestAllowed('GET', path), true);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(catalogueRequestAllowed(method, path), false);
  }
});

test('packaged fixture keeps a dedicated cookie host, refuses user preview port and bounds timing', () => {
  assert.equal(PACKAGED_CATALOGUE_HOST, '127.0.0.3'); assert.equal(cataloguePort(), 4183);
  for (const port of ['4173', '80', '65536', '4183;echo', '0']) assert.throws(() => cataloguePort(port));
  assert.deepEqual(catalogueTiming({ selectedSessionMs: 8000, cursorMs: 10000, firstPageMs: 450 }), { selectedSessionMs: 8000, cursorMs: 10000, firstPageMs: 450 });
  for (const value of [-1, 10001, Infinity, '8000', 1.5]) assert.deepEqual(catalogueTiming({ selectedSessionMs: value, cursorMs: value, firstPageMs: value }), { selectedSessionMs: 0, cursorMs: 0, firstPageMs: 0 });
});

test('native listing rejects traversal, duplicate/case aliases, Windows aliases and links before extraction', () => {
  validateNativeListing(['dist/', 'dist/server/', 'dist/server/index.js'], ['d', 'd', '-']);
  for (const path of ['/dist/absolute', 'dist/../out', 'dist/file:stream', 'dist/CON', 'dist/name.', 'dist/a\\b', 'elsewhere']) assert.throws(() => validateNativeListing([path], ['-']));
  assert.throws(() => validateNativeListing(['dist/a', 'dist/A'], ['-', '-']));
  for (const type of ['l', 'h', 'p', 'c']) assert.throws(() => validateNativeListing(['dist/a'], [type]));
  assert.throws(() => validateNativeListing(['dist/a'], []));
});

function tarFile(path: string, text: string) {
  const body = Buffer.from(text), header = Buffer.alloc(512);
  header.write(path); header.write('0000644\0', 100); header.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
  header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257);
  header.write([...header].reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([header, body, Buffer.alloc((512 - body.length % 512) % 512)]);
}

test('native extraction pins raw archive, source, provider file count and all executable bytes without rebuilding', () => {
  mkdirSync('.artifacts', { recursive: true }); const root = mkdtempSync(resolve('.artifacts/packaged-catalogue-test-'));
  mkdirSync(join(root, '.artifacts'));
  const provenance = { sourceCommit: 'a'.repeat(40), applicationInputsSha256: 'b'.repeat(64), hostingConfigSha256: 'c'.repeat(64) };
  const files = [['dist/.openai/release-provenance.json', JSON.stringify(provenance)], ['dist/.openai/hosting.json', '{"project_id":"synthetic-site"}'], ['dist/server/index.js', 'export default {fetch(){return new Response("synthetic")}}']];
  const bytes = gzipSync(Buffer.concat([...files.map(([path, text]) => tarFile(path, text)), Buffer.alloc(1024)]));
  const archive = join(root, 'original.gz'); writeFileSync(archive, bytes);
  const receipt = { schema: 'casevant.release-review.v1', runtimeCommit: provenance.sourceCommit, ...provenance,
    rawArchive: { bytes: bytes.length, sha256: archiveHash(bytes) }, version: { id: 'synthetic-version', project_id: 'synthetic-site', source: { commit_sha: provenance.sourceCommit }, archive_storage: { file_count: 3 } }, deployment: { version_id: 'synthetic-version' } };
  const output = join(root, '.artifacts/extracted');
  const inspected = extractCatalogueArchive(root, archive, receipt, output);
  assert.equal(inspected.files.length, 3); assert.equal(readFileSync(join(inspected.directory, 'dist/server/index.js'), 'utf8'), files[2][1]);
  assert.equal(archiveHash(readFileSync(archive)), receipt.rawArchive.sha256);
  assert.throws(() => extractCatalogueArchive(root, archive, receipt, output), /Never overwrite/);
  assert.throws(() => extractCatalogueArchive(root, archive, { ...receipt, rawArchive: { ...receipt.rawArchive, sha256: 'd'.repeat(64) } }, join(root, '.artifacts/wrong')), /strictEqual|Expected|equal/);
  assert.throws(() => extractCatalogueArchive(root, archive, receipt, join(root, 'outside')), /inside workspace/);
});
