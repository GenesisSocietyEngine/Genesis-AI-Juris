import { safeWorkspaceReturn } from "../workspace-navigation";

/** Older bookmarks omitted the organization inside the return URL. Bind that
 * URL only after the current workspace's authorized feed confirms the case. */
export function verifiedLibraryReturn(
  location: string,
  selection: string | undefined,
  cases: readonly { id: string }[],
) {
  if (!selection) return location;
  const page = new URL(safeWorkspaceReturn(location, "/"), "https://workspace.invalid");
  if (page.pathname !== "/library" || page.searchParams.get("organization") !== selection) return location;
  const path = safeWorkspaceReturn(page.searchParams.get("return_to"), "");
  if (!path) return location;
  const target = new URL(path, page),
    id = target.searchParams.get("dossier");
  if (
    !["/matters", "/canopy"].includes(target.pathname) ||
    target.searchParams.has("organization") ||
    !id ||
    !cases.some((c) => c.id === id)
  )
    return location;
  target.searchParams.set("organization", selection);
  page.searchParams.set("return_to", target.pathname + target.search + target.hash);
  return page.pathname + page.search + page.hash;
}
