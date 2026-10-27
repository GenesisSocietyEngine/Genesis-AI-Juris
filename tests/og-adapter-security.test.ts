import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';

const shim = import.meta.resolve('vinext/shims/og');
const requireFromShim = createRequire(shim);
const adapterManifest = requireFromShim.resolve('@vercel/og/package.json');
const adapterDirectory = path.dirname(adapterManifest);

test('Vinext resolves patched Satori in both shipped adapter distributions', async () => {
  const manifest = JSON.parse(await readFile(adapterManifest, 'utf8'));
  assert.equal(manifest.version, '1.0.3');
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
    const response = new ImageResponse(createElement('div', {style:{display:'flex',background:'white'}}, 'CaseVant synthetic probe'), {
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
