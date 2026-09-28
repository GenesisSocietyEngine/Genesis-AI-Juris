const ORIGIN = "https://workspace.invalid";
const RESERVED = new Set(["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"]);
const PAGES = new Set(["/", "/studio", "/templates", "/matters", "/canopy", "/organizations", "/invitations", "/account"]);

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
  for (const key of ["organization", "dossier", "scenario", "run", "lang", "view", "studio_step", "section", "return_to"]) {
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
  if (!changesCase && !changesOrganization && !target.searchParams.has("return_to") && ["/studio", "/templates", "/account"].includes(target.pathname)) {
    const returnTo = (["/matters", "/canopy"].includes(source.pathname) || (source.pathname === "/organizations" && target.pathname === "/account")) ? source.pathname + source.search + source.hash : returnPath;
    if (returnTo && returnTo !== target.pathname) target.searchParams.set("return_to", returnTo);
  }
  return target.pathname + target.search + target.hash;
}
