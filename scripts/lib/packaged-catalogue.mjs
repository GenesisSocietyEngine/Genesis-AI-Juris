import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const PACKAGED_CATALOGUE_HOST = '127.0.0.3';
export const archiveHash = bytes => createHash('sha256').update(bytes).digest('hex');

export function catalogueRequestAllowed(method, path) {
  return ['GET', 'HEAD'].includes(method) || method === 'POST' && path === '/api/auth/login';
}

export function catalogueHtmlVariant(html, path, query) {
  const observed = path === '/matters' && query.get('qa_observe') === '1';
  const immediateScroll = path === '/matters' && query.get('qa_scroll') === 'auto';
  const extra = (immediateScroll ? '<link rel="stylesheet" href="/__qa/scroll.css">' : '') +
    (observed ? '<script src="/__qa/observer.js"></script>' : '');
  return { html: extra ? html.replace('</head>', extra + '</head>') : html, observed, immediateScroll };
}

// Operator-authored local instrumentation only. It does not prevent events,
// change handlers, inspect React state, issue requests or enter production.
export const catalogueObserver = `(()=>{let n=0;function record(e){if(n++>=100)return;const t=e.target instanceof Element?e.target.closest('button,a,input,select'):null;console.info('LOCAL_CATALOGUE_POINTER '+JSON.stringify({event:e.type,trusted:e.isTrusted,target:t?.tagName,label:t?.tagName==='BUTTON'?t.textContent:null,x:e.clientX,y:e.clientY,scrollY,behavior:getComputedStyle(document.documentElement).scrollBehavior}));}for(const name of ['pointerdown','pointerup','click'])document.addEventListener(name,record,true);window.addEventListener('focus',record);})();`;

export function validateNativeListing(paths, types) {
  assert.equal(paths.length, types.length, 'Archive listings disagree');
  const seen = new Set();
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index].replace(/\/$/, '');
    assert.ok(path === 'dist' || path.startsWith('dist/'), 'Only dist may be extracted');
    assert.ok(!/[\\:\x00-\x1f]/.test(path), 'Unsafe archive path');
    for (const part of path.split('/')) assert.ok(part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part), 'Unsafe archive segment');
    assert.ok(!seen.has(path.toLowerCase()), 'Duplicate archive path'); seen.add(path.toLowerCase());
    assert.ok(/^[-d]/.test(types[index]), 'Archive links/special files refused');
  }
}

export function catalogueTiming(value) {
  const source = value && typeof value === 'object' ? value : {};
  const bounded = key => Number.isInteger(source[key]) && source[key] >= 0 && source[key] <= 10000 ? source[key] : 0;
  return { selectedSessionMs: bounded('selectedSessionMs'), cursorMs: bounded('cursorMs') };
}

export function cataloguePort(value = '4183') {
  assert.match(value, /^\d+$/); const port = Number(value);
  assert.ok(port >= 1024 && port <= 65535 && port !== 4173, 'Use an unused test port, never 4173'); return port;
}

export function archivedFiles(directory) {
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const absolute = join(path, entry.name); assert.ok(!lstatSync(absolute).isSymbolicLink(), 'Archived links refused');
      if (entry.isDirectory()) visit(absolute);
      else { assert.ok(entry.isFile(), 'Archived special file refused'); const bytes = readFileSync(absolute); files.push({ path: relative(directory, absolute).replaceAll('\\', '/'), bytes: bytes.length, sha256: archiveHash(bytes) }); }
    }
  }
  visit(join(directory, 'dist')); return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

/** Native tar interprets the pinned PAX archive. This does not relax the
 * separate strict GNU inspector or recompute the provider-normalized hash. */
export function extractCatalogueArchive(root, archive, receipt, output) {
  assert.equal(receipt.schema, 'casevant.release-review.v1');
  assert.equal(receipt.runtimeCommit, receipt.version.source.commit_sha);
  assert.equal(receipt.version.id, receipt.deployment.version_id);
  const bytes = readFileSync(archive);
  assert.equal(bytes.length, receipt.rawArchive.bytes); assert.equal(archiveHash(bytes), receipt.rawArchive.sha256);
  const parent = resolve(root, '.artifacts');
  assert.ok(resolve(output).startsWith(parent + sep), 'Extract only inside workspace artifacts');
  assert.equal(dirname(resolve(output)), parent, 'Use a direct fresh artifact child, never a linked ancestor');
  assert.ok(!existsSync(output), 'Never overwrite an earlier run');
  assert.ok(!lstatSync(parent).isSymbolicLink(), 'Artifact parent must not be a link');
  mkdirSync(output); const copy = join(output, 'original.tar.gz'); writeFileSync(copy, bytes, { flag: 'wx' });
  const list = flag => execFileSync('tar', [flag, copy], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trimEnd().split(/\r?\n/);
  const paths = list('-tf'), types = list('-tvf'); validateNativeListing(paths, types);
  const directory = join(output, 'unpacked'); mkdirSync(directory);
  execFileSync('tar', ['-xf', copy, '-C', directory]);
  assert.equal(archiveHash(readFileSync(copy)), receipt.rawArchive.sha256);
  const files = archivedFiles(directory);
  assert.equal(files.length, receipt.version.archive_storage.file_count);
  const provenance = JSON.parse(readFileSync(join(directory, 'dist/.openai/release-provenance.json'), 'utf8'));
  assert.equal(provenance.sourceCommit, receipt.runtimeCommit);
  assert.equal(provenance.applicationInputsSha256, receipt.applicationInputsSha256);
  assert.equal(provenance.hostingConfigSha256, receipt.hostingConfigSha256);
  const hosting = JSON.parse(readFileSync(join(directory, 'dist/.openai/hosting.json'), 'utf8'));
  assert.equal(hosting.project_id, receipt.version.project_id);
  return { directory, files, provenance, inventorySha256: archiveHash(JSON.stringify(files)) };
}
