import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import { subscribeSessionBoundary } from "../session-boundary";
import { studioCaseQuery } from "../studio-case-search";

export type SavedStudioCase = { id: number; caseId: string; title: string; currentVersion: string; access: "owner" | "shared" | "admin"; isPrivate: boolean; updatedAt: string; ownerDisplayName: string };
type Page = { customCases: SavedStudioCase[]; nextCursor: string | null };
export type StudioCatalogueState = { phase: "idle" | "loading" | "ready" | "error"; cases: SavedStudioCase[]; nextCursor: string | null; issue: string; query: string; pages: number; refreshing: boolean };

function readPage(value: unknown): Page {
  if (!value || typeof value !== "object") throw new Error("Invalid catalogue");
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.customCases) || !(page.nextCursor === null || typeof page.nextCursor === "string")) throw new Error("Invalid catalogue");
  const customCases = page.customCases.map((value: unknown): SavedStudioCase => {
    if (!value || typeof value !== "object") throw new Error("Invalid catalogue");
    const item = value as Record<string, unknown>;
    if (!Number.isSafeInteger(item.id) || Number(item.id) < 1 || typeof item.caseId !== "string" || typeof item.title !== "string" || typeof item.currentVersion !== "string" || !["owner", "shared", "admin"].includes(String(item.access)) || typeof item.isPrivate !== "boolean" || typeof item.updatedAt !== "string") throw new Error("Invalid catalogue");
    return { id: Number(item.id), caseId: item.caseId, title: item.title, currentVersion: item.currentVersion, access: item.access as SavedStudioCase["access"], isPrivate: item.isPrivate, updatedAt: item.updatedAt, ownerDisplayName: typeof item.ownerDisplayName === "string" ? item.ownerDisplayName : "Case author" };
  });
  return { customCases, nextCursor: page.nextCursor as string | null };
}

/** Read-only, memory-only catalogue; existing server policy owns visibility. */
export class StudioCaseCatalogue {
  private state: StudioCatalogueState = { phase: "idle", cases: [], nextCursor: null, issue: "", query: "", pages: 0, refreshing: false };
  private pages = 0;
  private requestedPages = 0;
  private restoreEpoch = 0;
  private query = "";
  private readController: AbortController | null = null;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private scope = "";
  constructor(private navigation: NavigationController, private transport: (path: string, init?: RequestInit) => Promise<Response>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: Omit<StudioCatalogueState, "query" | "pages" | "refreshing"> & { refreshing?: boolean }) { this.state = { ...state, refreshing: state.refreshing ?? false, query: this.query, pages: this.pages }; this.listeners.forEach(listener => listener()); }
  private currentScope() {
    const state = this.navigation.getSnapshot();
    return state.phase === "ready" && !state.busy && !state.endingSession && state.actorId && state.identity ? JSON.stringify([this.navigation.authorityVersion, state.actorId, state.identity.email, state.selected?.selection]) : "";
  }
  sync = () => {
    const scope = this.currentScope();
    if (!scope && scope === this.scope) return;
    // Focus verification still refreshes server visibility. Rebuild the depth
    // already requested in this exact authority scope, including an active
    // Load more request, rather than silently replacing it with page one.
    const depth = scope && scope === this.scope ? Math.max(1, this.requestedPages) : 1;
    if (scope && scope === this.scope) { void this.revalidate(scope, depth); return; }
    this.readController?.abort();
    this.scope = scope; this.epoch++; this.restoreEpoch++; this.pages = 0; this.requestedPages = 0;
    this.publish({ phase: "idle", cases: [], nextCursor: null, issue: "" });
    if (scope) void this.restore(this.query, depth);
  };
  private read(cursor: string | null, controller: AbortController) {
    return readWithTimeout(async signal => {
      const response = await this.transport("/api/custom-cases?limit=25" + (this.query ? "&q=" + encodeURIComponent(this.query) : "") + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { credentials: "same-origin", cache: "no-store", signal });
      if (!response.ok) throw new Error("Catalogue unavailable");
      return readPage(await response.json());
    }, { signal: controller.signal });
  }
  private async revalidate(scope: string, depth: number) {
    this.readController?.abort();
    const ticket = ++this.epoch; this.restoreEpoch++; this.requestedPages = depth;
    const controller = new AbortController(); this.readController = controller;
    // Only the identical, freshly verified authority may retain the previously
    // loaded presentation while fresh pages build. Removing it here relocates a
    // target measured before window focus, so a trusted click can hit <main>.
    // The visible old cursor is never used for these reads or queued intentions.
    this.publish({ phase: "loading", cases: this.state.cases, nextCursor: this.state.nextCursor, issue: "", refreshing: true });
    let cases: SavedStudioCase[] = [], cursor: string | null = null, pages = 0;
    try {
      do {
        const page = await this.read(cursor, controller);
        if (ticket !== this.epoch || scope !== this.currentScope()) return;
        cases = [...new Map([...cases, ...page.customCases].map(item => [item.id, item])).values()];
        cursor = page.nextCursor; pages++;
      } while (cursor && pages < this.requestedPages);
      this.pages = pages; this.requestedPages = pages;
      this.publish({ phase: "ready", cases, nextCursor: cursor, issue: "" });
    } catch {
      if (ticket !== this.epoch || scope !== this.currentScope()) return;
      this.pages = 0; this.requestedPages = 0;
      this.publish({ phase: "error", cases: [], nextCursor: null, issue: "unavailable" });
    } finally {
      if (this.readController === controller) this.readController = null;
    }
  }
  attach() {
    this.sync();
    const stop = this.navigation.subscribe(this.sync);
    const stopBoundary = subscribeSessionBoundary(phase => this.navigation.invalidate(phase === "revoke" ? "denied" : "expired"));
    return () => { stop(); stopBoundary(); this.readController?.abort(); this.scope = ""; this.epoch++; this.restoreEpoch++; this.pages = 0; this.requestedPages = 0; this.publish({ phase: "idle", cases: [], nextCursor: null, issue: "" }); };
  }
  async restore(value: string, pages: number) {
    const scope = this.currentScope(), pending = this.search(value), ticket = this.restoreEpoch;
    const depth = Math.max(1, Math.min(40, pages));
    this.requestedPages = depth;
    await pending;
    for (let page = 1; page < depth; page++) {
      if (ticket !== this.restoreEpoch || scope !== this.currentScope() || this.state.phase !== "ready" || !this.state.nextCursor) return;
      await this.load(true);
    }
    if (ticket === this.restoreEpoch) this.requestedPages = this.pages;
  }
  async search(value: string) {
    const query = studioCaseQuery(value);
    this.readController?.abort();
    this.epoch++; this.restoreEpoch++; this.pages = 0; this.requestedPages = 0;
    this.query = query ?? "";
    this.publish({ phase: query === null ? "error" : "idle", cases: [], nextCursor: null, issue: query === null ? "invalid-search" : "" });
    if (query !== null) await this.load();
  }
  async load(more = false) {
    const scope = this.currentScope();
    if (!scope || scope !== this.scope || more && !this.state.nextCursor) return;
    if (this.state.phase === "loading") {
      // One explicit More intent can arrive during same-authority revalidation.
      // Rebuild it with a newly authorized cursor; coalesce repeated activation.
      if (more && this.state.refreshing) this.requestedPages = Math.max(this.requestedPages, this.pages + 1);
      return;
    }
    const ticket = ++this.epoch, previous = more ? this.state.cases : [], cursor = more ? this.state.nextCursor : null;
    const previousPages = more ? this.pages : 0;
    this.requestedPages = more ? Math.max(this.requestedPages, previousPages + 1) : 1;
    if (!more) this.pages = 0;
    const controller = new AbortController(); this.readController = controller;
    this.publish({ phase: "loading", cases: previous, nextCursor: cursor, issue: "" });
    try {
      const page = await this.read(cursor, controller);
      if (ticket !== this.epoch || scope !== this.currentScope()) return;
      this.pages = previousPages + 1;
      this.publish({ phase: "ready", cases: [...new Map([...previous, ...page.customCases].map(item => [item.id, item])).values()], nextCursor: page.nextCursor, issue: "" });
    } catch {
      if (ticket !== this.epoch || scope !== this.currentScope()) return;
      // A failed/denied refresh is never presented as a current private list.
      this.pages = 0; this.requestedPages = 0;
      this.publish({ phase: "error", cases: [], nextCursor: null, issue: "unavailable" });
    } finally {
      if (this.readController === controller) this.readController = null;
    }
  }
}

export function myCasesView(location: string): "personal" | "team" {
  const params = new URL(location, "https://workspace.invalid").searchParams;
  if (params.has("dossier") || params.get("collection") === "team") return "team";
  if (params.get("collection") === "personal") return "personal";
  // Preserve the established /matters landing and organization picker. Adding
  // the selected organization to an unqualified URL must not switch views.
  return "team";
}

export function myCasesHref(view: "personal" | "team", location: string) {
  const source = new URL(location, "https://workspace.invalid"), target = new URL("/matters", source.origin);
  target.searchParams.set("collection", view);
  for (const key of ["organization", "lang"]) { const value = source.searchParams.get(key); if (value) target.searchParams.set(key, value); }
  return target.pathname + target.search;
}
