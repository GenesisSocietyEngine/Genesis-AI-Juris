import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { build } from 'esbuild';
import { Log, LogLevel, Miniflare } from 'miniflare';

const shim = import.meta.resolve('vinext/shims/og');
const requireFromShim = createRequire(shim);
const adapterManifest = requireFromShim.resolve('@vercel/og/package.json');
const adapterDirectory = path.dirname(adapterManifest);

test('the adapter backport reproduces exactly from integrity-pinned upstream archives', () => {
  const result = spawnSync(process.execPath, ['vendor/og-adapter/rebuild.mjs', '--verify'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('precompiled HarfBuzz callbacks preserve every retained argument and return signature', async () => {
  const receipt = JSON.parse(await readFile(path.join(adapterDirectory, 'provenance.json'), 'utf8'));
  const names = Object.keys(receipt.hashes).filter(name => name.startsWith('dist/hb-callback-'));
  assert.equal(names.length, 14);
  for (const name of names) {
    const signature = path.basename(name, '.wasm').replace('hb-callback-', '');
    const args = [...signature.slice(1)].map(type => type === 'j' ? BigInt(7) : ['f', 'd'].includes(type) ? 3.5 : 17);
    let called = false;
    const returned = signature[0] === 'v' ? undefined : signature[0] === 'j' ? BigInt(11) : ['f', 'd'].includes(signature[0]) ? 2.5 : 23;
    const compiled = new WebAssembly.Module(Buffer.from(await readFile(path.join(adapterDirectory, name))));
    const instance = new WebAssembly.Instance(compiled, { e: { f: (...actual: unknown[]) => { called = true; assert.deepEqual(actual, args, name); return returned; } } });
    assert.equal((instance.exports.f as CallableFunction)(...args), returned, name);
    assert.ok(called, name);
  }
});

test('Vinext resolves patched Satori in both shipped adapter distributions', async () => {
  const manifest = JSON.parse(await readFile(adapterManifest, 'utf8'));
  assert.equal(manifest.version, '1.0.3+casevant.1');
  assert.equal(manifest.dependencies.satori, '0.33.5');
  for (const name of ['index.node.js', 'index.edge.js']) {
    const code = await readFile(path.join(adapterDirectory, 'dist', name), 'utf8');
    assert.match(code, /satori@0\.33\.5\//);
    assert.doesNotMatch(code, /satori@0\.16\.0\//);
  }
});

test('the actual Vinext adapter produces PNG bytes and preserves response options in plain Node', () => {
  // A separate plain-Node process distinguishes shipped adapter errors from tsx behavior.
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {createElement} from 'react';
    import {ImageResponse} from 'vinext/shims/og';
    const response = new ImageResponse(createElement('div', {style:{display:'flex',background:'white',fontFeatureSettings:'"liga" 1'}}, 'CaseVant synthetic probe'), {
      width:240,height:80,status:201,headers:{'x-casevant-probe':'synthetic'}
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    console.log(JSON.stringify({status:response.status,probe:response.headers.get('x-casevant-probe'),type:response.headers.get('content-type'),png:bytes.toString('base64')}));
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout.trim());
  const bytes = Buffer.from(response.png, 'base64');
  assert.equal(response.status, 201);
  assert.equal(response.probe, 'synthetic');
  assert.equal(response.type, 'image/png');
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 240);
  assert.equal(bytes.readUInt32BE(20), 80);
});

test('the actual Worker adapter renders with compiled HarfBuzz, Yoga and resvg modules', async () => {
  const { createOgInlineFetchAssetsPlugin } = await import(new URL('./plugins/og-assets.js', import.meta.resolve('vinext')).href);
  const inline = createOgInlineFetchAssetsPlugin();
  inline.configResolved({ command: 'build', root: process.cwd(), resolve: { alias: [] } });
  inline.buildStart();
  const wasm: Record<string, { type: 'wasm'; contents: Buffer }> = {};
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      import {createElement} from 'react';
      export default {async fetch() {
        try {
        const {ImageResponse} = await import('vinext/shims/og');
        const image = new ImageResponse(createElement('div',{style:{display:'flex',background:'white',fontFeatureSettings:'"liga" 1'}},'CaseVant synthetic probe'),{width:240,height:80,status:201,headers:{'x-casevant-probe':'synthetic'}});
        const bytes = await image.arrayBuffer();
        let blocked = false;
        try { await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])); } catch { blocked = true; }
        return new Response(bytes,{status:image.status,headers:{...Object.fromEntries(image.headers),'x-dynamic-compilation-blocked':String(blocked)}});
        } catch (error) { return new Response(error.stack,{status:500}); }
      }};
    ` }, bundle: true, write: false, platform: 'browser', format: 'esm', conditions: ['workerd', 'worker'],
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'actual-vinext-og-assets', setup(builder) {
      builder.onResolve({ filter: /\.wasm\?module$/ }, async args => {
        const filename = path.resolve(args.resolveDir, args.path.replace(/\?module$/, ''));
        const name = path.basename(filename);
        wasm[name] = { type: 'wasm', contents: Buffer.from(await readFile(filename)) };
        return { path: `./${name}`, external: true };
      });
      builder.onLoad({ filter: /index\.edge\.js$/ }, async args => {
        const source = await readFile(args.path, 'utf8');
        const transformed = await inline.transform.handler(source, args.path);
        assert.ok(transformed, 'actual font loader transform is required');
        return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(args.path) };
      });
    } }],
  });
  for (const name of ['hb.wasm', 'resvg.wasm', 'yoga.wasm', 'hb-callback-vi.wasm']) assert.ok(wasm[name], name);
  const worker = new Miniflare({ host: '127.0.0.1', port: 0, cf: false, telemetry: { enabled: false }, log: new Log(LogLevel.WARN),
    workers: [{ config: { name: 'synthetic-og-backport', type: 'worker', compatibilityDate: '2026-09-11', compatibilityFlags: ['nodejs_compat'],
      manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: result.outputFiles[0].text }, ...wasm } } } }],
  });
  try {
    const response = await worker.dispatchFetch('https://synthetic-og.test/');
    assert.equal(response.status, 201, response.status === 201 ? undefined : await response.text());
    assert.equal(response.headers.get('x-casevant-probe'), 'synthetic');
    assert.equal(response.headers.get('x-dynamic-compilation-blocked'), 'true');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 240);
    assert.equal(bytes.readUInt32BE(20), 80);
  } finally { await worker.dispose(); }
});

test('Satori refuses private style carriers and escapes XML attribute payloads', async () => {
  const adapterRequire = createRequire(adapterManifest);
  const manifest = JSON.parse(await readFile(adapterRequire.resolve('satori/package.json'), 'utf8'));
  const directory = path.dirname(adapterRequire.resolve('satori/package.json'));
  const { default: satori } = await import(pathToFileURL(path.join(directory, manifest.exports['.'].import)).href);
  const font = await readFile(path.join(adapterDirectory, 'dist', 'Geist-Regular.ttf'));
  const options = { width: 240, height: 80, embedFont: false, fonts: [{ name: 'Probe', data: font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength), weight: 400 }] };
  const svg = await satori(createElement('div', { style: { color: 'red"/><path data-casevant-injection="yes"/><text fill="red' } }, 'Synthetic'), options);
  assert.doesNotMatch(svg, /<path data-casevant-injection=/);
  assert.match(svg, /&quot;/);
  await assert.rejects(() => satori(createElement('div', { style: { _inheritedClipPathId: 'synthetic' } }, 'Synthetic'), options), /Invalid style property/);
});

test('Vinext inlines the real Node and Edge adapter font assets', async () => {
  const pluginUrl = new URL('./plugins/og-assets.js', import.meta.resolve('vinext'));
  const { createOgInlineFetchAssetsPlugin } = await import(pluginUrl.href);
  const plugin = createOgInlineFetchAssetsPlugin();
  plugin.configResolved({ command: 'build', root: process.cwd(), resolve: { alias: [] } });
  plugin.buildStart();
  const fontBase64 = Buffer.from(await readFile(path.join(adapterDirectory, 'dist', 'Geist-Regular.ttf'))).toString('base64');
  for (const name of ['index.node.js', 'index.edge.js']) {
    const filename = path.join(adapterDirectory, 'dist', name);
    const result = await plugin.transform.handler(await readFile(filename, 'utf8'), filename);
    assert.ok(result, name);
    assert.ok(result.code.includes(fontBase64), `${name} embeds exact installed font bytes`);
    assert.doesNotMatch(result.code, /new URL\("\.\/Geist-Regular\.ttf", import\.meta\.url\)/);
  }
});
