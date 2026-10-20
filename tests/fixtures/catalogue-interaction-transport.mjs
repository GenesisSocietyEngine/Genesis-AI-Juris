/** Local synthetic reads only. This fixture never forwards a request. */
export const syntheticActor = 'actor_synthetic_catalogue_owner';
export const syntheticOrganization = {
  id: 'org_synthetic_catalogue', name: 'Synthetic workspace', kind: 'personal',
  status: 'active', role: 'org_owner', revision: 1, membershipRevision: 1,
  actorId: syntheticActor, selection: `org_synthetic_catalogue.1.1.${syntheticActor}`,
};

/** @param {{ trace?: (kind: string, detail: object) => void, delay?: (ms: number) => Promise<void>, overlap?: boolean, refresh?: () => void }} [options] */
export function createCatalogueInteractionTransport({
  trace = () => {}, delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
  overlap = false, refresh = () => {},
} = {}) {
  let read = 0;
  const rows = Array.from({ length: 48 }, (_, index) => ({
    id: index + 1, caseId: `synthetic_${index + 1}`,
    title: `QA synthetic case ${String(index + 1).padStart(2, '0')}`,
    currentVersion: '1.0.0', access: 'owner', isPrivate: true,
    updatedAt: '2026-10-20T12:00:00Z', ownerDisplayName: 'Synthetic owner',
  }));
  /** @param {string} path @param {RequestInit} [init] */
  return async (path, init) => {
    // Fail closed before any read, delay or callback. No real fetch is used.
    if (typeof path !== 'string' || !path.startsWith('/api/') || path.startsWith('//') ||
        init?.body != null || init?.method && init.method !== 'GET') throw Error('Synthetic read-only fixture');
    const url = new URL(path, 'http://fixture.invalid');
    if (url.origin !== 'http://fixture.invalid' ||
        !['/api/workspace-session', '/api/custom-cases'].includes(url.pathname)) throw Error('Unexpected fixture route');
    const id = ++read;
    trace('read', { id, path });
    init?.signal?.addEventListener('abort', () => trace('abort', { id }), { once: true });
    await delay(120);
    if (url.pathname === '/api/workspace-session') {
      trace('session', { id, phase: 'ready' });
      return Response.json({ authenticated: true,
        identity: { displayName: 'Synthetic owner', email: 'catalogue@example.test', authSource: 'local' },
        actorId: syntheticActor, organizations: [syntheticOrganization], selected: syntheticOrganization, profileRequired: false });
    }
    const cursor = url.searchParams.get('cursor'), query = url.searchParams.get('q') || '';
    if (cursor && cursor !== 'page_two') throw Error('Unknown synthetic cursor');
    if (cursor && overlap) {
      overlap = false;
      // A deliberately late response may still resolve after abort: the real
      // catalogue must fence it and reconstruct depth using fresh cursors.
      refresh();
      await delay(300);
    }
    const matches = rows.filter(row => row.title.toLowerCase().includes(query));
    trace('response', { id, page: cursor ? 2 : 1 });
    return Response.json({ customCases: cursor ? matches.slice(25) : matches.slice(0, 25),
      nextCursor: !cursor && matches.length > 25 ? 'page_two' : null });
  };
}
