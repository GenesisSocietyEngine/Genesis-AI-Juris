import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function fixturePort(args) {
  if (!args.length) return 4182;
  if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) throw Error('Use --port 4182 (or another unused test port)');
  const port = Number(args[1]);
  if (port < 1024 || port > 65535 || port === 4173) throw Error('Use an unprivileged test port other than the user preview 4173');
  return port;
}

export async function startCatalogueInteractionPreview(root, port) {
  const output = resolve(root, '.artifacts/catalogue-interactions');
  await mkdir(output, { recursive: true });
  await build({ entryPoints: [join(root, 'tests/fixtures/catalogue-interactions.jsx')],
    outfile: join(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser',
    plugins: [{ name: 'unused-team-boundary', setup(builder) {
      builder.onResolve({ filter: /^\.\/MattersClient$/ }, () => ({ path: 'team', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Team(){return null}', loader: 'js' }));
    } }],
  });
  const files = new Map([
    ['/bundle.js', [join(output, 'bundle.js'), 'text/javascript']],
    ['/bundle.css', [join(output, 'bundle.css'), 'text/css']],
    ...['globals.css', 'workspace-design.css', 'casevant.css'].map(name => [`/${name}`, [join(root, 'app', name), 'text/css']]),
  ]);
  const server = createServer(async (request, response) => {
    // Loopback binding plus Host validation; no CORS, proxies, credentials or
    // arbitrary filesystem exposure. No production endpoints or bindings.
    const listeningPort = server.address()?.port ?? port;
    if (![`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`].includes(request.headers.host)) {
      response.writeHead(403); response.end(); return;
    }
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (url.pathname === '/' || url.pathname === '/matters') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/workspace-design.css"><link rel="stylesheet" href="/casevant.css"><link rel="stylesheet" href="/bundle.css">
<style>${url.searchParams.get('scroll') === 'auto' ? 'html{scroll-behavior:auto!important}' : ''}
#notice{padding:12px;margin-left:220px;background:#fff2ce;color:#12394b;font:16px system-ui}
#trace{position:fixed;right:0;top:0;max-width:40vw;width:380px;height:150px;overflow:auto;z-index:999;background:#fff8df;color:#12394b;border:1px solid #aa8700;font:10px/1.2 monospace;pointer-events:none}
@media(max-width:700px){#notice{margin-left:0}#trace{max-width:60vw;height:100px}}</style>
<body><p id="notice">LOCAL SYNTHETIC ONLY — actual catalogue, navigation and organization shell. No production data or writes. Capture the trace after one activation. Only the unused Team component is stubbed.</p><pre id="trace" aria-label="Local pointer and read trace"></pre><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>`);
      return;
    }
    let file = files.get(url.pathname);
    if (/^\/(fonts|brand)\/[a-zA-Z0-9_-]+\.(woff2|png|svg)$/.test(url.pathname)) {
      file = [join(root, 'public', url.pathname.slice(1)), url.pathname.endsWith('.woff2') ? 'font/woff2' : url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png'];
    }
    if (!file) { response.writeHead(404); response.end(); return; }
    try { const bytes = await readFile(file[0]); response.setHeader('Content-Type', file[1]); response.end(bytes); }
    catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = fixturePort(process.argv.slice(2));
  const server = await startCatalogueInteractionPreview(resolve(import.meta.dirname, '..'), port);
  console.log(`Synthetic catalogue trace: http://127.0.0.1:${port}/matters?collection=personal&lang=en`);
  console.log('Comparisons: &scroll=auto; &mode=overlap; &mode=focus-gap (500ms access, 450ms page one, 1200ms cursor); &mode=held-refresh (explicit synthetic controls); &lang=ru. Fixture results are not production acceptance.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
