/** Original archived Worker/client, synthetic local storage, no rebuild. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { Miniflare, Log, LogLevel, Response as LocalResponse } from 'miniflare';
import { createPasswordCredential } from '../app/auth-crypto.ts';
import { packagedCatalogueCases } from '../tests/fixtures/packaged-catalogue-cases.ts';
import { caseFingerprint } from '../app/case-integrity.ts';
import { PACKAGED_CATALOGUE_HOST as host, archiveHash, archivedFiles, catalogueHtmlVariant, catalogueObserver, cataloguePort, catalogueRequestAllowed, catalogueTiming, extractCatalogueArchive } from './lib/packaged-catalogue.mjs';

const args = process.argv.slice(2), options = new Map();
for (let index = 0; index < args.length; index += 2) {
  const key = args[index], value = args[index + 1];
  assert.ok(['--archive', '--review', '--port'].includes(key) && value && !options.has(key), 'Use --archive RAW_ARCHIVE --review NATIVE_REVIEW_RECEIPT [--port UNUSED_TEST_PORT]');
  options.set(key, value);
}
assert.ok(options.has('--archive') && options.has('--review'), 'Specify the original archive and native review receipt');
const root = process.cwd(), port = cataloguePort(options.get('--port'));
const review = JSON.parse(readFileSync(resolve(options.get('--review')), 'utf8'));
const output = resolve('.artifacts', `packaged-catalogue-${Date.now()}-${process.pid}`);
const inspected = extractCatalogueArchive(root, resolve(options.get('--archive')), review, output);
const serverRoot = join(inspected.directory, 'dist/server'), modules = {};
for (const file of inspected.files) if (file.path.startsWith('dist/server/') && /\.(js|wasm)$/.test(file.path)) {
  modules[file.path.slice('dist/server/'.length)] = { type: file.path.endsWith('.wasm') ? 'wasm' : 'esm', contents: new Uint8Array(readFileSync(join(inspected.directory, file.path))) };
}
assert.ok(modules['index.js']);
const name = 'packaged-catalogue-synthetic', origin = `http://${host}:${port}`, events = [];
const timingPath = join(output, 'timing.json'), receiptPath = join(output, 'receipt.json');
writeFileSync(timingPath, JSON.stringify(catalogueTiming({}), null, 2));
let outboundDenied = 0;
const mf = new Miniflare({ host, port: 0, cf: false, telemetry: { enabled: false }, log: new Log(LogLevel.WARN), resourceTmpPath: join(output, 'runtime'),
  workers: [{ config: { name, type: 'worker', compatibilityDate: '2026-09-16', compatibilityFlags: ['nodejs_compat'],
    manifest: { mainModule: 'index.js', modulesRoot: serverRoot, modules },
    assets: { directory: join(inspected.directory, 'dist/client'), hasUserWorker: true, runWorkerFirst: false },
    env: { DB: { type: 'd1', name }, DOSSIER_DOCUMENTS: { type: 'r2', name }, ASSETS: { type: 'assets' } },
  }, dev: { outboundService: { type: 'fetcher', handler: () => { outboundDenied++; return new LocalResponse('Archived QA outbound network disabled', { status: 502 }); } } } }],
});
const receipt = { schema: 'casevant.packaged-catalogue-execution.v1', applicationVersion: review.version.version_number,
  sourceCommit: review.runtimeCommit, applicationInputsSha256: review.applicationInputsSha256, hostingConfigSha256: review.hostingConfigSha256,
  rawArchive: review.rawArchive, nativeArchive: review.version.archive_storage, nativeNormalizationRecomputed: false,
  rebuilt: false, originalWorker: true, originalClient: true, productionBindingsUsed: false,
  fixturePreparationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  fixturePreparation: 'normal independent working-copy contract; exact exampleSource retained; synthetic title amendments',
  host, port, archiveFiles: inspected.files.length, inventorySha256: inspected.inventorySha256,
  workerEntrySha256: archiveHash(modules['index.js'].contents), status: 'starting' };
const saveTrace = () => writeFileSync(join(output, 'requests.json'), JSON.stringify(events, null, 2));
const saveReceipt = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
const expectedFiles = new Map(inspected.files.map(file => [file.path, file]));
let proxy, database, baseline, stopPromise, stopPoll;
const snapshot = async () => archiveHash(JSON.stringify({
  cases: (await database.prepare('select * from custom_cases order by id').all()).results,
  drafts: (await database.prepare('select * from case_drafts order by id').all()).results,
  caseAudits: (await database.prepare('select * from audit_events order by id').all()).results,
}));
async function stop() {
  if (stopPromise) return stopPromise;
  stopPromise = (async () => {
    clearInterval(stopPoll);
    if (proxy?.listening) await new Promise(resolve => proxy.close(resolve));
    const after = await snapshot();
    Object.assign(receipt, { status: 'stopped', caseBytesBefore: baseline, caseBytesAfter: after,
      caseBytesUnchanged: after === baseline, archiveBytesUnchanged: archiveHash(JSON.stringify(archivedFiles(inspected.directory))) === inspected.inventorySha256, outboundDenied });
    saveTrace(); saveReceipt(); await mf.dispose();
    console.log(JSON.stringify({ status: receipt.status, receiptPath, caseBytesUnchanged: receipt.caseBytesUnchanged, archiveBytesUnchanged: receipt.archiveBytesUnchanged }));
    process.exit(receipt.caseBytesUnchanged && receipt.archiveBytesUnchanged ? 0 : 1);
  })();
  return stopPromise;
}

try {
  database = await mf.getD1Database('DB', name);
  const journal = JSON.parse(readFileSync(join(inspected.directory, 'dist/.openai/drizzle/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries) await database.batch(readFileSync(join(inspected.directory, `dist/.openai/drizzle/${entry.tag}.sql`), 'utf8').split('--> statement-breakpoint').map(text => text.trim()).filter(Boolean).map(text => database.prepare(text)));
  const email = 'packaged-catalogue@example.test', password = 'Synthetic-Catalogue-2026!', credential = await createPasswordCredential(password);
  await database.prepare('insert into users(email,display_name) values(?,?)').bind(email, 'SYNTHETIC original packaged catalogue QA').run();
  await database.prepare('insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)').bind(email, credential.hash, credential.salt, credential.iterations, '2026-01-01T00:00:00.000Z').run();
  const fixtures = [];
  for (const { id, draft } of packagedCatalogueCases()) {
    const raw = JSON.stringify(draft), fingerprint = caseFingerprint(draft);
    fixtures.push({ id, caseId: draft.caseId, templateVersion: draft.version, exampleSource: draft.exampleSource, sha256: archiveHash(raw), raw });
    await database.prepare('insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint,is_private) values(?,?,?,?,?,?,1)').bind(id, email, draft.caseId, draft.title, draft.version, fingerprint).run();
    await database.prepare('insert into case_drafts(id,custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(?,?,?,?,?,?,?,?)').bind(id, id, email, draft.caseId, draft.version, fingerprint, draft.title, raw).run();
  }
  writeFileSync(join(output, 'synthetic-fixtures.json'), JSON.stringify(fixtures)); baseline = await snapshot();
  proxy = createServer(async (request, response) => {
    if (request.headers.host !== `${host}:${port}`) { response.writeHead(403); response.end(); return; }
    const url = new URL(request.url, origin);
    if (url.origin !== origin) { response.writeHead(403); response.end(); return; }
    if (request.method === 'GET' && ['/__qa/scroll.css', '/__qa/observer.js'].includes(url.pathname)) {
      response.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(url.pathname.endsWith('.css') ? 'html{scroll-behavior:auto!important}' : catalogueObserver); return;
    }
    if (url.pathname === '/__qa/trace' && request.method === 'GET') {
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({ events, outboundDenied, caseBytesUnchanged: await snapshot() === baseline })); return;
    }
    if (!catalogueRequestAllowed(request.method, url.pathname)) {
      response.writeHead(405); response.end('Read-only catalogue QA permits only normal local login'); return;
    }
    const event = { id: events.length + 1, startedAt: Date.now(), method: request.method, path: url.pathname,
      query: url.searchParams.get('q'), cursor: url.searchParams.has('cursor'), selected: url.searchParams.has('organization') };
    events.push(event); saveTrace();
    response.on('close', () => { if (!event.completedAt) { event.clientClosedBeforeEnd = true; saveTrace(); } });
    try {
      const timingText = existsSync(timingPath) ? readFileSync(timingPath, 'utf8') : '{}'; assert.ok(timingText.length <= 2048);
      const timing = catalogueTiming(JSON.parse(timingText));
      event.delayMs = event.path === '/api/workspace-session' && event.selected ? timing.selectedSessionMs : event.path === '/api/custom-cases' && event.cursor ? timing.cursorMs : 0;
      if (event.delayMs) await new Promise(resolve => setTimeout(resolve, event.delayMs));
      const parts = []; let length = 0;
      for await (const part of request) { length += part.length; assert.ok(length <= 12000, 'Only bounded synthetic login bodies'); parts.push(part); }
      const result = await mf.dispatchFetch(url.href, { method: request.method, headers: request.headers, ...(parts.length ? { body: Buffer.concat(parts) } : {}) });
      event.status = result.status;
      if (event.path === '/api/custom-cases' && request.method === 'GET' && !url.searchParams.has('id')) {
        const page = await result.clone().json(); event.rows = page.customCases?.length; event.nextCursor = Boolean(page.nextCursor);
      }
      let bytes = Buffer.from(await result.arrayBuffer());
      const headers = Object.fromEntries(result.headers), expected = expectedFiles.get('dist/client' + event.path);
      if ((result.headers.get('content-type') || '').includes('text/html')) {
        const variant = catalogueHtmlVariant(bytes.toString('utf8'), event.path, url.searchParams);
        if (variant.observed || variant.immediateScroll) {
          event.localHtmlVariant = { observed: variant.observed, immediateScroll: variant.immediateScroll };
          bytes = Buffer.from(variant.html); delete headers['content-length']; delete headers['content-encoding'];
        }
      }
      if (event.path.startsWith('/_next/') && result.status === 200) {
        event.sha256 = archiveHash(bytes); event.archivedExact = Boolean(expected && expected.bytes === bytes.length && expected.sha256 === event.sha256);
        assert.ok(event.archivedExact, 'Served client asset differs from archived bytes');
      }
      event.completedAt = Date.now();
      if (!response.destroyed) { response.writeHead(result.status, headers); response.end(bytes); }
      saveTrace();
    } catch (error) {
      event.error = error instanceof Error ? error.message : String(error); saveTrace();
      if (!response.destroyed && !response.headersSent) { response.writeHead(500); response.end('Local packaged QA failed; retain evidence'); }
    }
  });
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(port, host, resolve); });
  Object.assign(receipt, { status: 'serving-local', caseBytesBefore: baseline }); saveReceipt();
  const stopPath = join(output, 'stop.request');
  stopPoll = setInterval(() => { if (existsSync(stopPath) && readFileSync(stopPath, 'utf8').trim() === 'stop') void stop(); }, 500);
  console.log(JSON.stringify({ url: `${origin}/account?lang=en&return_to=%2Fmatters%3Fcollection%3Dpersonal%26lang%3Den`,
    email, password, timingPath, receiptPath, stopPath, note: 'Synthetic local credentials only. Original client/Worker; outbound denied; no case writes. Optional /matters?qa_observe=1 or qa_scroll=auto adds labelled local HTML instrumentation, not unmodified delivery. Type stop on interactive stdin or write stop to stopPath to retain final receipt and dispose.' }));
  createInterface({ input: process.stdin }).on('line', line => { if (line.trim() === 'stop') void stop(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void stop());
} catch (error) {
  Object.assign(receipt, { status: 'failed', error: error instanceof Error ? error.message : String(error), outboundDenied });
  saveReceipt(); if (proxy?.listening) await new Promise(resolve => proxy.close(resolve)); await mf.dispose(); throw error;
}
