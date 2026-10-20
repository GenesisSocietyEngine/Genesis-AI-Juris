import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Dedicated finite-file preview. It has no fetch override or production API.
const root = process.cwd(), host = '127.0.0.1', port = 4184;
const output = resolve(root, '.artifacts/materials-interactions'); await mkdir(output, { recursive: true });
await build({ entryPoints: [join(root, 'tests/fixtures/materials-interactions.jsx')], outfile: join(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser' });
const files = new Map([
  ['/bundle.js', [join(output, 'bundle.js'), 'text/javascript']], ['/bundle.css', [join(output, 'bundle.css'), 'text/css']],
  ...['globals.css', 'workspace-design.css', 'casevant.css'].map(name => [`/${name}`, [join(root, 'app', name), 'text/css']]),
]);
const server = createServer(async (request, response) => {
  if (request.headers.host !== `${host}:${port}`) { response.writeHead(403); response.end(); return; }
  if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
  const url = new URL(request.url, `http://${host}:${port}`);
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (url.pathname === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/workspace-design.css"><link rel="stylesheet" href="/casevant.css"><link rel="stylesheet" href="/bundle.css">
<style>body{background:#fff;color:#123345}.fixture-controls,#notice{padding:16px;border-bottom:1px solid #bed4e3}.fixture-compact{width:250px;margin:24px auto}.fixture-wide{max-width:1000px;margin:24px auto}.fixture-controls button{min-height:44px}.fixture-controls label{display:block}pre{white-space:pre-wrap}</style>
<div id="root"></div><script type="module" src="/bundle.js"></script></html>`); return;
  }
  let file = files.get(url.pathname);
  if (/^\/(fonts|brand)\/[a-zA-Z0-9_-]+\.(woff2|png|svg)$/.test(url.pathname)) file = [join(root, 'public', url.pathname.slice(1)), url.pathname.endsWith('.woff2') ? 'font/woff2' : url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png'];
  if (!file) { response.writeHead(404); response.end(); return; }
  try { response.setHeader('Content-Type', file[1]); response.end(await readFile(file[0])); }
  catch { response.writeHead(404); response.end(); }
});
server.listen(port, host, () => console.log(`Synthetic materials component: http://${host}:${port}/ (compact; ?layout=wide; &lang=ru). No case writes or real authority.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
