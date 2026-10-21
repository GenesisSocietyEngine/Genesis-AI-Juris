import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalogueInteractionTransport, syntheticActor, syntheticOrganization } from './fixtures/catalogue-interaction-transport.mjs';
import { fixturePort, startCatalogueInteractionPreview } from '../scripts/preview-catalogue-interactions.mjs';
import { NavigationController } from '../app/navigation-controller';
import { StudioCaseCatalogue, type SavedStudioCase } from '../app/matters/studio-case-catalogue';
import type { AddressInfo } from 'node:net';
import { get } from 'node:http';

type FixturePage = { customCases: SavedStudioCase[]; nextCursor: string | null };

test('focus-gap fixture separately delays access, fresh page one and cursor delivery without changing responses', async () => {
  const delays: number[] = [];
  const transport = createCatalogueInteractionTransport({ focusGap: true, delay: async ms => { delays.push(ms); } });
  await transport('/api/workspace-session');
  const first = await (await transport('/api/custom-cases?limit=25')).json() as FixturePage;
  const second = await (await transport('/api/custom-cases?limit=25&cursor=page_two')).json() as FixturePage;
  assert.deepEqual(delays, [500, 450, 1200]);
  assert.equal(first.customCases.length, 25); assert.equal(second.customCases.length, 23);
});

test('diagnostic transport rejects writes, foreign URLs and unexpected routes before side effects', async () => {
  let sideEffects = 0;
  const transport = createCatalogueInteractionTransport({ delay: async () => { sideEffects++; }, trace: () => { sideEffects++; } });
  for (const path of ['https://casevant.pro/api/custom-cases', '//casevant.pro/api/custom-cases', '/api/auth/logout', '/api/../private', '/api/custom-cases/other']) {
    await assert.rejects(transport(path));
  }
  for (const init of [{ method: 'POST' }, { method: 'DELETE' }, { body: '' }]) await assert.rejects(transport('/api/custom-cases', init));
  assert.equal(sideEffects, 0);
});

test('diagnostic pages have separate synthetic identities, literal search and a finite cursor', async () => {
  const transport = createCatalogueInteractionTransport({ delay: async () => {} });
  const session = await (await transport('/api/workspace-session')).json() as { actorId: string; selected: typeof syntheticOrganization };
  assert.equal(session.actorId, syntheticActor); assert.deepEqual(session.selected, syntheticOrganization);
  const first = await (await transport('/api/custom-cases?limit=25')).json() as FixturePage;
  const second = await (await transport('/api/custom-cases?limit=25&cursor=' + first.nextCursor)).json() as FixturePage;
  assert.equal(first.customCases.length, 25); assert.equal(second.customCases.length, 23); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.customCases, ...second.customCases].map(row => row.id)).size, 48);
  const filtered = await (await transport('/api/custom-cases?limit=25&q=case%2004')).json() as FixturePage;
  assert.equal(filtered.customCases[0].id, 4);
  await assert.rejects(transport('/api/custom-cases?cursor=foreign'));
});

test('actual navigation and catalogue reconstruct received pagination after fixture overlap; late aborted response is ignored', async () => {
  const events: Array<{ kind: string; id?: number }> = [];
  const transport = createCatalogueInteractionTransport({ overlap: true,
    trace: (kind: string, detail: object) => events.push({ kind, ...detail }),
    refresh: () => { void navigation.refresh(); }, delay: async () => { await new Promise(resolve => setImmediate(resolve)); } });
  const navigation = new NavigationController({ transport, leave: () => assert.fail('No navigation'), clear: () => assert.fail('No cleanup') });
  await navigation.refresh();
  const catalogue = new StudioCaseCatalogue(navigation, transport);
  const stop = catalogue.attach();
  try {
    for (let count = 0; count < 50 && catalogue.getSnapshot().phase !== 'ready'; count++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(catalogue.getSnapshot().cases.length, 25);
    await catalogue.load(true);
    for (let count = 0; count < 50 && catalogue.getSnapshot().cases.length !== 48; count++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(catalogue.getSnapshot().cases.length, 48); assert.equal(catalogue.getSnapshot().pages, 2);
    assert.equal(catalogue.getSnapshot().nextCursor, null);
    assert.ok(events.some(row => row.kind === 'abort'));
    assert.equal(events.filter(row => row.kind === 'session').length, 2);
  } finally { stop(); }
});

test('preview uses an explicit unused loopback test port and refuses the user preview port', () => {
  assert.equal(fixturePort([]), 4182); assert.equal(fixturePort(['--port', '4186']), 4186);
  for (const args of [['--port', '4173'], ['--port', '80'], ['--port', '65536'], ['--host', '0.0.0.0'], ['--port', '4182', '--extra']]) assert.throws(() => fixturePort(args));
});

test('preview serves actual bundled shell locally, refuses foreign hosts/writes and exposes no repository files', async () => {
  const server = await startCatalogueInteractionPreview(process.cwd(), 0);
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const page = await fetch(origin + '/matters?lang=ru&scroll=auto');
    assert.equal(page.status, 200); assert.equal(page.headers.get('cache-control'), 'no-store');
    const html = await page.text(); assert.match(html, /LOCAL SYNTHETIC ONLY/); assert.match(html, /scroll-behavior:auto/);
    assert.equal((await fetch(origin + '/bundle.js')).status, 200);
    assert.equal((await fetch(origin + '/matters', { method: 'POST' })).status, 405);
    // Node fetch normalizes Host; use HTTP's explicit header for this server boundary.
    const foreignHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(origin + '/matters', { headers: { host: 'foreign.example' } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    assert.equal(foreignHostStatus, 403);
    for (const path of ['/.git/config', '/.openai/hosting.json', '/api/custom-cases', '/tests/fixtures/catalogue-interactions.jsx', '/fonts/../../package.json']) {
      assert.equal((await fetch(origin + path)).status, 404, path);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve())); }
});
