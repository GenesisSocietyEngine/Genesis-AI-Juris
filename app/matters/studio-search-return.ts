import { SESSION_BOUNDARY_KEY } from "../session-boundary";
import { studioCaseQuery } from "../studio-case-search";
import type { StudioCaseSort } from "./studio-case-list";

const KEY = "casevantStudioSearch";
export type StudioSearchReturn = { version: 1; scope: string; boundary: string; query: string; input: string; sort: StudioCaseSort; pages: number };
/** A withdrawal stamp, never identity or permission. Unavailable storage disables restore. */
export function studioSearchBoundary(storage: Pick<Storage, "getItem"> | (() => Pick<Storage, "getItem">)): string | null {
  try { return (typeof storage === "function" ? storage() : storage).getItem(SESSION_BOUNDARY_KEY) ?? ""; } catch { return null; }
}
export function readStudioSearchReturn(state: unknown, scope: string, boundary: string | null): StudioSearchReturn | null {
  if (!scope || boundary === null || !state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[KEY];
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || item.scope !== scope || item.boundary !== boundary || typeof item.query !== "string" || typeof item.input !== "string"
    || studioCaseQuery(item.query) !== item.query || studioCaseQuery(item.input) === null || !["updated", "oldest", "title"].includes(String(item.sort))
    || !Number.isSafeInteger(item.pages) || Number(item.pages) < 1 || Number(item.pages) > 40) return null;
  return item as StudioSearchReturn;
}
export function withStudioSearchReturn(state: unknown, value: StudioSearchReturn | null) {
  const next = state && typeof state === "object" && !Array.isArray(state) ? { ...state } : {};
  if (value) Object.assign(next, { [KEY]: value }); else delete (next as Record<string, unknown>)[KEY];
  return next;
}
