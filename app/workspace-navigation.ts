const ORIGIN = "https://workspace.invalid";
const RESERVED = new Set(["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"]);
const PAGES = new Set(["/", "/studio", "/templates", "/library", "/matters", "/work", "/canopy", "/organizations", "/invitations", "/account"]);

/** A return destination is a same-origin browser page, never an auth callback or API. */
export function safeWorkspaceReturn(value: unknown, fallback = "/studio"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n\t]/.test(value)) return fallback;
  try {
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN || RESERVED.has(url.pathname) || !PAGES.has(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

export function workspaceSignInPath(returnTo: string) {
  return "/signin-with-chatgpt?return_to=" + encodeURIComponent(safeWorkspaceReturn(returnTo));
}

export function workspacePagePath(path: string, params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const key of ["organization", "dossier", "scenario", "run", "lang", "view", "custom_case", "studio_case", "studio_panel", "studio_step", "section", "workflow", "return_to"]) {
    const value = params[key];
    if (typeof value === "string" && value.length <= 2048) query.set(key, key === "return_to" ? safeWorkspaceReturn(value) : value);
  }
  return path + (query.size ? "?" + query.toString() : "");
}

/** Preserve only navigation hints. Every destination still authorizes on the server. */
export function workspaceDestination(path: string, current: string) {
  const target = new URL(path, ORIGIN);
  if (target.origin !== ORIGIN || !PAGES.has(target.pathname)) return path;
  const source = new URL(safeWorkspaceReturn(current), ORIGIN);
  const returnPath = safeWorkspaceReturn(source.searchParams.get("return_to"), "");
  const context = returnPath ? new URL(returnPath, ORIGIN) : source;
  const changesCase = target.searchParams.has("dossier") && target.searchParams.get("dossier") !== context.searchParams.get("dossier");
  const selectedOrganization = target.searchParams.get("organization") ?? source.searchParams.get("organization");
  const changesOrganization = selectedOrganization !== null && selectedOrganization !== context.searchParams.get("organization");
  const changesScenario = target.searchParams.has("scenario") && target.searchParams.get("scenario") !== context.searchParams.get("scenario");
  const studioId = source.searchParams.get(source.pathname === "/studio" ? "custom_case" : "studio_case");
  const changesStudio = target.searchParams.has("custom_case") && target.searchParams.get("custom_case") !== studioId;
  for (const key of ["organization", "lang"]) {
    const value = source.searchParams.get(key) ?? context.searchParams.get(key);
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value);
  }
  if (!changesOrganization && !target.searchParams.has("dossier") && ["/matters", "/canopy"].includes(target.pathname) && ["/matters", "/canopy"].includes(context.pathname) && context.searchParams.has("dossier")) {
    target.searchParams.set("dossier", context.searchParams.get("dossier")!);
  }
  if (!changesCase && !changesOrganization && target.pathname === "/canopy" && context.pathname === "/canopy") {
    for (const key of ["scenario", "run"]) {
      const value = context.searchParams.get(key);
      if (value && !target.searchParams.has(key) && !(key === "run" && changesScenario)) target.searchParams.set(key, value);
    }
  }
  if (!changesCase && !changesOrganization && !target.searchParams.has("return_to") && ["/studio", "/work", "/templates", "/library", "/account"].includes(target.pathname)) {
    const returnTo = (["/matters", "/canopy"].includes(source.pathname) || (source.pathname === "/organizations" && target.pathname === "/account")) ? source.pathname + source.search + source.hash : returnPath;
    if (returnTo && returnTo !== target.pathname) target.searchParams.set("return_to", returnTo);
  }
  // Saved Studio identity is a navigation hint, never a governed dossier ID.
  // Only carry it inside the same explicitly selected case/organization context.
  if (!changesCase && !changesOrganization && !changesStudio && studioId && /^[1-9]\d*$/.test(studioId) && Number.isSafeInteger(Number(studioId))) {
    const key = target.pathname === "/studio" ? "custom_case" : "studio_case";
    if (!target.searchParams.has(key)) target.searchParams.set(key, studioId);
    for (const name of ["studio_step", "studio_panel"]) {
      const value = source.searchParams.get(name);
      if (value && value.length <= 100 && !target.searchParams.has(name)) target.searchParams.set(name, value);
    }
  }
  return target.pathname + target.search + target.hash;
}

/** A save may create the first durable ID after a link was clicked. Rebind only
 * same-origin suite links; history plans and external destinations remain owned
 * by the existing departure controller. */
export function resumeWorkspaceDestination(destination: string, current: string) {
  try {
    const source = new URL(current, ORIGIN), target = new URL(destination, source);
    if (source.origin !== target.origin || !PAGES.has(target.pathname)) return destination;
    return workspaceDestination(target.pathname + target.search + target.hash, source.pathname + source.search + source.hash);
  } catch { return destination; }
}

/** A personal Studio draft may accompany a team case but never identifies it.
 * Only the current case or a same-suite return path can supply the team's ID. */
export function selectedTeamCase(current: string) {
  const page = new URL(safeWorkspaceReturn(current, "/"), ORIGIN);
  const teamPage = (u: URL) => u.pathname === "/matters" || u.pathname === "/canopy";
  const back = safeWorkspaceReturn(page.searchParams.get("return_to"), "");
  const origin = teamPage(page) ? page : back ? new URL(back, ORIGIN) : null;
  if (!origin || !teamPage(origin) || origin.searchParams.get("collection") === "personal") return null;
  const id = origin.searchParams.get("dossier");
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  const outer = page.searchParams.get("organization"), inner = origin.searchParams.get("organization");
  if (outer && inner && outer !== inner) return null;
  const organization = outer || inner;
  const params = new URLSearchParams({ collection: "team", dossier: id, section: "overview" });
  if (organization) params.set("organization", organization);
  const overview = workspaceDestination("/matters?" + params, current);
  return { id, organization, overview };
}

/** The suite tab opens the team record first. A standalone personal draft
 * retains its analytical overview when there is no team case to return to. */
export function currentCaseOverviewDestination(current: string): string | null {
  const team = selectedTeamCase(current);
  if (team) return team.overview;
  const studio = workspaceDestination("/studio?studio_panel=overview", current);
  return new URL(studio, ORIGIN).searchParams.has("custom_case") ? studio : null;
}

/** History between views of this same mounted Studio is not a page departure. */
export function isStudioPanelNavigation(from: string, to: string): boolean {
  try {
    const source = new URL(from, ORIGIN), target = new URL(to, ORIGIN);
    if (source.origin !== target.origin || source.pathname !== "/studio" || target.pathname !== "/studio") return false;
    for (const url of [source, target]) {
      if ((url.searchParams.get("view") ?? "studio") !== "studio") return false;
      url.searchParams.set("view", "studio");
      url.searchParams.delete("studio_panel"); url.searchParams.delete("studio_step");
      url.searchParams.sort(); url.hash = "";
    }
    return source.href === target.href;
  } catch { return false; }
}

/** Older bookmarks omitted the organization inside the return URL. Bind that
 * URL only after the current workspace's authorized feed confirms the case. */
export function verifiedWorkspaceCaseReturn(
  location: string,
  selection: string | undefined,
  cases: readonly { id: string }[],
) {
  if (!selection) return location;
  const page = new URL(safeWorkspaceReturn(location, "/"), "https://workspace.invalid");
  if (!["/library", "/work"].includes(page.pathname) || page.searchParams.get("organization") !== selection) return location;
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
