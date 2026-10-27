import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const verify = process.argv.includes('--verify');
function archive(name, integrity) {
  const compressed = readFileSync(join(root, 'upstream', name));
  if (createHash('sha512').update(compressed).digest('base64') !== integrity) throw Error(`Upstream integrity mismatch: ${name}`);
  const tar = gunzipSync(compressed), entries = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const text = (start, end) => header.toString('utf8', start, end).replace(/\0.*$/s, '');
    const path = text(0, 100), sizeText = text(124, 136).trim(), checksumText = text(148, 156).trim();
    if (!/^[0-7]+$/.test(sizeText) || !/^[0-7]+$/.test(checksumText)) throw Error('Invalid upstream tar numbers');
    const size = parseInt(sizeText, 8), checksum = parseInt(checksumText, 8);
    const actual = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (checksum !== actual || !path.startsWith('package/') || path.split('/').includes('..') || text(345, 500) || entries.has(path)) throw Error(`Invalid upstream tar entry: ${path}`);
    const type = text(156, 157);
    if (!['', '0', '5'].includes(type) || offset + 512 + size > tar.length) throw Error(`Unsupported upstream tar entry: ${path}`);
    if (type !== '5') entries.set(path, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}
const og = archive('vercel-og-1.0.3.tgz', '/iYJ34PDu4lty1TXdL86qHEw8viveHTllG1PWLuJX8tSFfqKL7kyVJeUORJmQ250bHB0h+alcalXUlza3c/NSA==');
const hb = archive('harfbuzzjs-0.10.0.tgz', 'SN8LVwCOzvTq3OPNd0+EAghgXugItz56wst567D1vs7LnnKGWprhi3EG58aVOBwhN8HEbQxL4I9NDWkcXUutRw==');
function once(code, before, after) {
  if (code.split(before).length !== 2) throw Error(`Backport input changed: ${before}`);
  return code.replace(before, after);
}
const outputs = new Map();
// Emscripten normally compiles a tiny typed callback wrapper at runtime.
// Workers require these modules to be compiled at deployment instead.
const callbackSource = hb.get('package/hbjs.js').toString('utf8');
const signatures = [...new Set([...callbackSource.matchAll(/,\s*["']([vipjfd]+)["']\s*\)/g)].map(match => match[1]))].sort();
if (!signatures.includes('vi') || signatures.length < 5) throw Error('Unexpected HarfBuzz callback signatures');
const unsigned = number => { const result = []; do { let byte = number & 127; number >>>= 7; if (number) byte |= 128; result.push(byte); } while (number); return result; };
const section = (id, bytes) => [id, ...unsigned(bytes.length), ...bytes];
const typeCodes = { i: 127, p: 127, j: 126, f: 125, d: 124 };
let callbackImports = '';
const callbackNames = [];
for (const [index, signature] of signatures.entries()) {
  const parameters = [...signature.slice(1)].map(type => typeCodes[type]);
  const returns = signature[0] === 'v' ? [] : [typeCodes[signature[0]]];
  const bytes = Buffer.from([0,97,115,109,1,0,0,0,
    ...section(1, [1,96,...unsigned(parameters.length),...parameters,...unsigned(returns.length),...returns]),
    ...section(2, [1,1,101,1,102,0,0]), ...section(7, [1,1,102,0,0])]);
  if (!WebAssembly.validate(bytes)) throw Error(`Invalid callback wrapper: ${signature}`);
  outputs.set(`dist/hb-callback-${signature}.wasm`, bytes);
  callbackImports += `import casevantCallback${index} from "./hb-callback-${signature}.wasm?module";\n`;
  callbackNames.push(`${JSON.stringify(signature)}:casevantCallback${index}`);
}
for (const name of ['index.node.js', 'index.edge.js']) {
  let code = og.get(`package/dist/${name}`).toString('utf8');
  // Upstream embeds the Node-only fflate entry even in its Edge distribution.
  // The adapter only consumes inflateSync; use the pinned public browser entry.
  const fflateStart = code.indexOf('// node_modules/.pnpm/fflate@0.7.3/node_modules/fflate/esm/index.mjs');
  const fflateEnd = code.indexOf('// node_modules/.pnpm/satori@0.33.5/', fflateStart);
  if (fflateStart < 0 || fflateEnd < 0 || !code.slice(fflateStart, fflateEnd).includes('function inflateSync2(')) throw Error('Unexpected embedded fflate block');
  code = code.slice(0, fflateStart) + 'import { inflateSync as inflateSync2 } from "fflate/browser";\n\n' + code.slice(fflateEnd);
  if (name === 'index.node.js') {
    code = 'import casevantHarfbuzz from "harfbuzzjs";\n' + once(code, '__toESM(require_harfbuzzjs(), 1)', '__toESM(casevantHarfbuzz, 1)');
  } else {
    // Only the HarfBuzz loader gets an explicit compiled module. Shaping is retained.
    code = 'import casevantHarfbuzzWasm from "./hb.wasm?module";\n' + once(code,
      '__toESM(require_harfbuzzjs(), 1)',
      '__toESM(require_hb()({instantiateWasm(imports, receive) { const instance = new WebAssembly.Instance(casevantHarfbuzzWasm, imports); receive(instance, casevantHarfbuzzWasm); return instance.exports; }}).then(instance => require_hbjs()(instance)), 1)');
    code = once(code, 'if (ENVIRONMENT_IS_NODE) {', 'if (ENVIRONMENT_IS_NODE && !Module["instantiateWasm"]) {');
    code = once(code, '} else if (ENVIRONMENT_IS_WORKER) {\n          _scriptName = self.location.href;', '} else if (ENVIRONMENT_IS_WORKER && !Module["instantiateWasm"]) {\n          _scriptName = self.location.href;');
    const callbackStart = code.indexOf('        var convertJsFunctionToWasm = (func, sig) => {');
    const callbackEnd = code.indexOf('        var wasmTable;', callbackStart);
    if (callbackStart < 0 || callbackEnd < 0 || !code.slice(callbackStart, callbackEnd).includes('new WebAssembly.Module(bytes)')) throw Error('Unexpected callback compiler');
    code = callbackImports + `const casevantCallbacks = {${callbackNames.join(',')}};\n` + code.slice(0, callbackStart) +
      '        var convertJsFunctionToWasm = (func, sig) => { const module = casevantCallbacks[sig]; if (!module) throw Error("Unsupported HarfBuzz callback signature: " + sig); return new WebAssembly.Instance(module, {e:{f:func}}).exports.f; };\n' + code.slice(callbackEnd);
  }
  code = code.replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
  outputs.set(`dist/${name}`, Buffer.from(code));
}
for (const name of ['Geist-Regular.ttf', 'resvg.wasm', 'yoga.wasm', 'index.node.d.ts', 'index.edge.d.ts', 'types.d.ts']) outputs.set(`dist/${name}`, og.get(`package/dist/${name}`));
outputs.set('LICENSE', og.get('package/LICENSE'));
outputs.set('HarfBuzz-LICENSE', hb.get('package/LICENSE'));
outputs.set('dist/hb.wasm', hb.get('package/hb.wasm'));
const hashes = {};
for (const [name, bytes] of outputs) {
  if (!bytes) throw Error(`Missing upstream file: ${name}`);
  if (verify) { if (!readFileSync(join(root, name)).equals(bytes)) throw Error(`Backport output mismatch: ${name}`); }
  else { mkdirSync(join(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), bytes); }
  hashes[name] = createHash('sha256').update(bytes).digest('hex');
}
const receipt = Buffer.from(JSON.stringify({ upstream: '@vercel/og@1.0.3', harfbuzz: 'harfbuzzjs@0.10.0', backport: 1, hashes }, null, 2) + '\n');
if (verify) { if (!readFileSync(join(root, 'provenance.json')).equals(receipt)) throw Error('Backport receipt mismatch'); }
else writeFileSync(join(root, 'provenance.json'), receipt);
console.log(`OG adapter backport ${verify ? 'verified' : 'generated'}: ${outputs.size} exact files`);
