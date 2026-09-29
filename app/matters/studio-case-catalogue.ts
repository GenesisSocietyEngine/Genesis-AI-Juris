import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import { subscribeSessionBoundary } from "../session-boundary";

export type SavedStudioCase = { id: number; caseId: string; title: string; currentVersion: string; access: "owner" | "shared" | "admin"; isPrivate: boolean; updatedAt: string; ownerDisplayName: string };
type Page = { customCases: SavedStudioCase[]; nextCursor: string | null };
export type StudioCatalogueState = { phase: "idle" | "loading" | "ready" | "error"; cases: SavedStudioCase[]; nextCursor: string | null; issue: string };

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
  private state: StudioCatalogueState = { phase: "idle", cases: [], nextCursor: null, issue: "" };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private scope = "";
  constructor(private navigation: NavigationController, private transport: (path: string, init?: RequestInit) => Promise<Response>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: StudioCatalogueState) { this.state = state; this.listeners.forEach(listener => listener()); }
  private currentScope() {
    const state = this.navigation.getSnapshot();
    return state.phase === "ready" && !state.busy && !state.endingSession && state.actorId && state.identity ? JSON.stringify([this.navigation.authorityVersion, state.actorId, state.identity.email, state.selected?.selection]) : "";
  }
  sync = () => {
    const scope = this.currentScope();
    if (!scope && scope === this.scope) return;
    this.scope = scope; this.epoch++;
    this.publish({ phase: "idle", cases: [], nextCursor: null, issue: "" });
    if (scope) void this.load();
  };
  attach() {
    this.sync();
    const stop = this.navigation.subscribe(this.sync);
    const stopBoundary = subscribeSessionBoundary(phase => this.navigation.invalidate(phase === "revoke" ? "denied" : "expired"));
    return () => { stop(); stopBoundary(); this.scope = ""; this.epoch++; this.publish({ phase: "idle", cases: [], nextCursor: null, issue: "" }); };
  }
  async load(more = false) {
    const scope = this.currentScope();
    if (!scope || scope !== this.scope || this.state.phase === "loading" || more && !this.state.nextCursor) return;
    const ticket = ++this.epoch, previous = more ? this.state.cases : [], cursor = more ? this.state.nextCursor : null;
    this.publish({ phase: "loading", cases: previous, nextCursor: cursor, issue: "" });
    try {
      const page = await readWithTimeout(async signal => {
        const response = await this.transport("/api/custom-cases?limit=25" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), { credentials: "same-origin", cache: "no-store", signal });
        if (!response.ok) throw new Error("Catalogue unavailable");
        return readPage(await response.json());
      });
      if (ticket !== this.epoch || scope !== this.currentScope()) return;
      this.publish({ phase: "ready", cases: [...new Map([...previous, ...page.customCases].map(item => [item.id, item])).values()], nextCursor: page.nextCursor, issue: "" });
    } catch {
      if (ticket !== this.epoch || scope !== this.currentScope()) return;
      // A failed/denied refresh is never presented as a current private list.
      this.publish({ phase: "error", cases: [], nextCursor: null, issue: "unavailable" });
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
