import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { discoverPoppler, inspectPdf, assertA4Portrait, renderAndInspectPdf, sha256File } from '../../../scripts/tests/report-pdf-qa';

const revised = process.argv.includes('--disclosures');
const root = resolve('docs/testing/inv01-2026-09-28/fiveflats-pdfs', revised ? 'disclosures' : '.');
const tools = discoverPoppler(process.cwd());
const files = revised ? ['full-on', 'full-off'] : ['base', 'medium', 'full-on', 'full-off'];
const results = [];
for (const format of files) {
  const path = resolve(root, format + '.pdf');
  const info = inspectPdf(tools, path); assertA4Portrait(info, path);
  const text = readFileSync(resolve(root, format + '.txt'), 'utf8');
  assert.match(text, /146,000/); assert.match(text, /36,500/); assert.match(text, /14,45[34]/);
  assert.match(text, /DRAFT/);
  if(revised) { for(const phrase of ['not a verified legal currency check', 'Future-dated entries require correction', '85.0%', '36 months', '8.0%', '25,000', '68.6 months exceeds']) assert.ok(text.includes(phrase),phrase); }
  const pages = renderAndInspectPdf(tools, path, resolve('.artifacts/fiveflats-render', revised ? 'disclosures' : '.', format), info, 72);
  results.push({ format, sha256: sha256File(path), pages: info.pages, title: info.title, pageBoxes: info.pageBoxes, renderSanity: pages });
}
const off = readFileSync(resolve(root, 'full-off.txt'), 'utf8');
for (const phrase of ['Profile-specific analysis', 'Facts, evidence and rules register', 'Authorities and source register', 'Authoring and review trail', 'Verification and sign-off', 'Unverified tax scenario', 'baseline=unset; optimized=unset.', 'The complete graph text appendix is omitted']) assert.ok(off.includes(phrase), phrase);
assert.ok(!off.includes('Complete node and connection text'));
writeFileSync(resolve(root, 'inspection.json'), JSON.stringify({ purpose: 'Actual local browser downloads, not hosted acceptance or independent approval', applicationBase: '23575c62863f299fec0faef9a6f5adb254094f91', sourceDelta: revised ? 'Full renderer3: explicit authored date and economic control disclosures' : 'Only expanded-map authority/focus correction during these downloads; report renderer unchanged', tools: tools.versions, results }, null, 2) + '\n');
console.log(JSON.stringify(results.map(({format,sha256,pages})=>({format,sha256,pages}))));
