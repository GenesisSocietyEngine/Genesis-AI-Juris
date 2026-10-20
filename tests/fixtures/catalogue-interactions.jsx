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
let navigation;
const transport = createCatalogueInteractionTransport({ trace, overlap: params.get('mode') === 'overlap',
  refresh: () => { void navigation.refresh(); } });
window.fetch = transport;
navigation = new NavigationController({ transport,
  leave: () => trace('blocked-navigation'), clear: () => trace('synthetic-memory-cleanup') });
navigation.subscribe(() => trace('navigation', { phase: navigation.getSnapshot().phase,
  authorityVersion: navigation.authorityVersion }));

createRoot(document.getElementById('root')).render(
  <NavigationSession controller={navigation}>
    <OrganizationBoundary signedIn={true} signInUrl="/signin">
      <MyCasesClient initialLocation={'/matters?collection=personal&lang=' + (params.get('lang') === 'ru' ? 'ru' : 'en')}/>
    </OrganizationBoundary>
  </NavigationSession>,
);
