import React from 'react';
import { createRoot } from 'react-dom/client';
import NavigationSession from '../../app/NavigationSession';
import OrganizationBoundary from '../../app/organizations/OrganizationBoundary';
import MyCasesClient from '../../app/matters/MyCasesClient';
import { NavigationController } from '../../app/navigation-controller';
import { createCatalogueInteractionTransport } from './catalogue-interaction-transport.mjs';

const params = new URL(location.href).searchParams;
const events = [];
function trace(kind, detail = {}) {
  events.push({ ms: Math.round(performance.now()), kind, ...detail });
  if (events.length > 60) events.shift();
  document.getElementById('trace').textContent = events.map(row => JSON.stringify(row)).join('\n');
}
for (const name of ['pointerdown', 'pointerup', 'click']) {
  document.addEventListener(name, event => {
    const element = event.target instanceof Element ? event.target : null;
    const button = element?.closest('button');
    trace(name, { trusted: event.isTrusted, target: button?.textContent || element?.tagName,
      x: event.clientX, y: event.clientY, scrollY: window.scrollY });
  }, true);
}
window.addEventListener('focus', () => trace('window-focus'));
let holdNextPage = false, holdNextCursor = params.get('mode') === 'held-cursor', releasePage = null;
const syntheticRead = createCatalogueInteractionTransport({ trace, overlap: params.get('mode') === 'overlap',
  focusGap: params.get('mode') === 'focus-gap',
  refresh: () => { void navigation.refresh(); } });
const transport = async (path, init) => {
  if ((holdNextPage && !path.includes('cursor=') || holdNextCursor && path.includes('cursor=')) && path.startsWith('/api/custom-cases?') &&
      !init?.body && (!init?.method || init.method === 'GET')) {
    holdNextPage = false; holdNextCursor = false;
    trace('held-fresh-page');
    await new Promise(resolve => { releasePage = () => { releasePage = null; resolve(); }; });
    trace('released-fresh-page');
  }
  return syntheticRead(path, init);
};
window.fetch = transport;
const navigation = new NavigationController({ transport,
  leave: () => trace('blocked-navigation'), clear: () => trace('synthetic-memory-cleanup') });
navigation.subscribe(() => trace('navigation', { phase: navigation.getSnapshot().phase,
  authorityVersion: navigation.authorityVersion }));

createRoot(document.getElementById('root')).render(
  <NavigationSession controller={navigation}>
    {['held-refresh', 'held-cursor'].includes(params.get('mode')) && <aside aria-label="Local synthetic verification controls">
      <button type="button" onClick={() => { if (!releasePage) { holdNextPage = true; void navigation.refresh(); } }}>Recheck synthetic access and hold page</button>
      <button type="button" onClick={() => releasePage?.()}>Release synthetic page</button>
      <button type="button" onClick={() => navigation.invalidate('denied')}>Withdraw synthetic access</button>
    </aside>}
    <OrganizationBoundary signedIn={true} signInUrl="/signin">
      <MyCasesClient initialLocation={'/matters?collection=personal&lang=' + (params.get('lang') === 'ru' ? 'ru' : 'en')}/>
    </OrganizationBoundary>
  </NavigationSession>,
);
