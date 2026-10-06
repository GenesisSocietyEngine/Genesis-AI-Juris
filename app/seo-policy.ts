export const CASEVANT_ORIGIN = "https://casevant.pro";

const PRIVATE_PREFIXES = ["/account", "/api", "/matters", "/organizations", "/invitations", "/canopy", "/signin-with-chatgpt", "/signout", "/logout"];

/** Public landing routes are indexable; their workspace/query continuations are not. */
export function isPrivateSearchSurface(url: URL): boolean {
  if (PRIVATE_PREFIXES.some(prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return true;
  return (url.pathname === "/" || url.pathname === "/studio")
    && [...url.searchParams.keys()].some(key => key !== "lang");
}

/** Fixed destination prevents untrusted Host/forwarded headers creating an open redirect. */
export function casevantCanonicalRedirect(url: URL): URL | null {
  if (url.hostname !== "www.casevant.pro") return null;
  const target = new URL(CASEVANT_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  return target;
}
