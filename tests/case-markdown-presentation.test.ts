import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CaseMarkdownDialog from '../app/CaseMarkdownDialog';
import CaseMarkdownActions from '../app/CaseMarkdownActions';
import TrainingVideo from '../app/TrainingVideo';
import { buildCaseMarkdown, parseCaseMarkdown } from '../app/case-markdown';

const directory = new URL('./fixtures/markdown-presentation-v1/', import.meta.url);
const receipt = JSON.parse(readFileSync(new URL('receipt.json', directory), 'utf8')) as { entries: Array<{ file: string; sha256: string; fingerprint: string }> };
const marker = (text: string) => text.match(/<!-- GENESIS-JURIS-CANONICAL-V1\n[\s\S]*?-->/)?.[0];

test('export entry is neutral and dated tutorial has an explicit current-label correction', () => {
  for (const locale of ['en', 'ru'] as const) {
    const menu = renderToStaticMarkup(createElement(CaseMarkdownActions, { locale, loadDisabled: false, exportDisabled: false, loaded() {}, opened() {}, failed() {} }));
    assert.ok(menu.includes(locale === 'en' ? 'Export case brief (.md)' : 'Экспорт описания кейса (.md)'));
    assert.doesNotMatch(menu, /Final case prompt/);
    const training = renderToStaticMarkup(createElement(TrainingVideo, { locale }));
    assert.ok(training.includes(locale === 'en' ? 'does not record human review or approval' : 'не фиксирует проверку или утверждение человеком'));
    assert.match(training, /training-20261103\/guide\.en\.mp4/);
    assert.ok(readFileSync(new URL('../public/help/casevant-training-20261005.en.mp4',import.meta.url)).byteLength>10000,'historical video remains intact');
  }
});

test('retained presentation-v1 fixtures keep their exact bytes and historical status', async () => {
  for (const entry of receipt.entries) {
    const text = readFileSync(new URL(entry.file, directory), 'utf8');
    assert.equal(createHash('sha256').update(text).digest('hex'), entry.sha256);
    const parsed = await parseCaseMarkdown(text);
    assert.ok(parsed);
    assert.equal(parsed.status, 'final');
    assert.equal(parsed.fingerprint, entry.fingerprint);
    assert.ok(parsed.draft.links[0].rule?.effects, 'retained execution data remains recoverable');
  }
});

test('presentation-v2 preserves the same-option canonical payload with only the platform gzip OS byte allowed to differ', async () => {
  for (const language of ['en', 'ru'] as const) {
    const old = readFileSync(new URL(`${language}-final.md`, directory), 'utf8');
    const parsed = await parseCaseMarkdown(old);
    assert.ok(parsed);
    const before = structuredClone(parsed.draft);
    const built = await buildCaseMarkdown(parsed.draft, { status: 'final', language });
    assert.match(built.markdown, /CASEVANT-BRIEF-PRESENTATION-V2/);
    assert.doesNotMatch(built.markdown, /Final reviewed|Reviewed value|Финальное проверенное|Проверенное значение/);
    assert.match(built.markdown, language === 'en' ? /Prepared brief/ : /Подготовленное описание/);
    assert.match(built.markdown, language === 'en' ? /Retained execution effects/ : /Сохранённые эффекты исполнения/);
    assert.match(built.markdown, language === 'en' ? /does not record human review or approval/ : /не фиксирует проверку или утверждение человеком/);
    assert.ok(marker(old));
    const oldMarker = marker(old)!, newMarker = marker(built.markdown)!;
    assert.equal(newMarker.replace(/payload:[^\n]+/, 'payload:'), oldMarker.replace(/payload:[^\n]+/, 'payload:'), 'canonical envelope metadata is unchanged');
    const compressed = (value: string) => Buffer.from(value.match(/payload:([^\n]+)/)![1], 'base64url');
    const originalBytes = compressed(oldMarker), currentBytes = compressed(newMarker);
    assert.deepEqual(currentBytes.subarray(0, 9), originalBytes.subarray(0, 9), 'all gzip header fields before OS stay exact');
    assert.deepEqual(currentBytes.subarray(10), originalBytes.subarray(10), 'compressed body and checksum/length trailer stay byte-identical');
    assert.deepEqual(gunzipSync(currentBytes), gunzipSync(originalBytes), 'entire uncompressed canonical JSON stays byte-identical');
    if (process.platform === 'win32') assert.equal(newMarker, oldMarker, 'same-platform envelope stays entirely byte-identical');
    if (process.platform === 'linux') assert.equal(currentBytes[9], 3, 'Linux gzip OS metadata');
    assert.equal(originalBytes[9], 10, 'retained Windows fixture OS metadata is immutable');
    assert.deepEqual(parsed.draft, before, 'the source case is not mutated');
    const restored = await parseCaseMarkdown(built.markdown);
    assert.deepEqual(restored?.draft, parsed.draft);
    assert.equal(restored?.fingerprint, parsed.fingerprint);
    assert.equal(restored?.status, 'final', 'historic wire value remains presentation metadata');
  }
});

test('the actual export dialog starts with a working brief in both locales', async () => {
  const parsed = await parseCaseMarkdown(readFileSync(new URL('en-final.md', directory), 'utf8'));
  assert.ok(parsed);
  for (const locale of ['en', 'ru'] as const) {
    const html = renderToStaticMarkup(createElement(CaseMarkdownDialog, { locale, draft: parsed.draft, close() {}, completed() {} }));
    assert.match(html, /<option value="amended" selected="">/);
    assert.ok(html.includes(locale === 'en' ? 'Working brief' : 'Рабочее описание'));
    assert.doesNotMatch(html, /Final reviewed|Финальный проверенный/);
    assert.match(html, /amended_\d{8}_\d{6}\.md/);
    assert.ok(html.includes(locale === 'en' ? 'Case filename' : 'Имя файла кейса'));
    assert.match(html, /aria-describedby="case-markdown-intro case-markdown-preparation-note"/);
    assert.match(html, /data-dialog-initial-focus/);
  }
});
