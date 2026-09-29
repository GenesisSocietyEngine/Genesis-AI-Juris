// Local test-only fault transport. No authentication/header substitution.
import { createServer, request as forward } from 'node:http';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const flags = '.artifacts/inv01-faults.json';
const evidence = 'docs/testing/inv01-2026-09-28/transport-faults.jsonl';
function take(flag) {
  let current; try { current = JSON.parse(readFileSync(flags, 'utf8')); } catch { return false; }
  if (!current[flag]) return false;
  current[flag] = false; writeFileSync(flags, JSON.stringify(current)); return true;
}
function record(value) { appendFileSync(evidence, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); }
createServer((req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1:5294').pathname;
  const operation = req.method + ' ' + path;
  if ((path === '/api/me' && req.method === 'GET' && take('identity')) || (path === '/api/auth/logout' && take('logout')) || (path === '/api/custom-cases/report-receipts' && req.method === 'GET' && take('historyRead'))
    || (path === '/api/custom-cases/report-receipts' && req.method === 'POST' && take('historyWrite'))) {
    record({ operation, fault: 'synthetic_503_before_handler' });
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Synthetic local test outage' })); return;
  }
  const loseSave = path === '/api/submissions' && req.method === 'POST' && take('saveResponse');
  const upstream = forward({ hostname: '127.0.0.1', port: 5291, path: req.url, method: req.method, headers: req.headers }, reply => {
    if (!loseSave) { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); return; }
    const chunks = [];
    reply.on('data', chunk => chunks.push(chunk));
    reply.on('end', () => {
      const body = Buffer.concat(chunks);
      writeFileSync('docs/testing/inv01-2026-09-28/lost-save-upstream-response.json', body);
      record({ operation, fault: 'response_lost_after_upstream_finished', upstreamStatus: reply.statusCode, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      res.destroy();
    });
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
}).listen(5294, '127.0.0.1');
