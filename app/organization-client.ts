// Per-tab organization selectors are hints, never authorization. No private
// dossier, invitation token, or result is persisted in browser storage.
export type ClientOrganization = {
  id: string; name: string; kind: string; status: string; role: string;
  revision: number; membershipRevision: number; actorId: string; selection: string;
};
let selection: string | null = null;
export function setOrganizationSelection(value: string) {
  if (selection !== value && typeof window !== "undefined") {
    // A deferred user-imported Studio prompt must not follow an organization switch.
    window.sessionStorage.removeItem("genesis-juris-pending-case-prompt-v1");
  }
  selection = value;
}
export function scopedOrganizationHeaders(): Record<string, string> {
  return selection ? { "x-genesis-organization": selection } : {};
}
export function organizationScopedUrl(path: string) {
  if (!selection || !path.startsWith("/api/dossiers/")) return path;
  const url = new URL(path, "https://workspace.invalid");
  url.searchParams.set("organization", selection);
  return url.pathname + url.search;
}
