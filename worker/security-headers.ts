const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Vinext streams React hydration instructions as inline scripts. Keep those
  // enabled while disallowing third-party scripts, eval and inline handlers.
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  // The graph editor uses React style attributes for node coordinates.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Analytical previews are locally generated PDF blobs. Remote frames remain
  // disallowed; this does not expand who may embed the Studio itself.
  "frame-src blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
];

function contentSecurityPolicy(requestUrl: URL, development: boolean) {
  const frameAncestors = requestUrl.pathname === "/studio" || requestUrl.pathname.startsWith("/studio/")
    ? "frame-ancestors https://falcon-merlin.com https://www.falcon-merlin.com"
    : "frame-ancestors 'none'";
  // Vite serves local QA over HTTP. Upgrading its module URLs to HTTPS leaves
  // the server-rendered page visible but prevents React from becoming usable.
  // This opt-in comes from Vite's compile-time DEV flag, never the request host.
  const directives = development && requestUrl.protocol === "http:"
    ? BASE_CONTENT_SECURITY_POLICY.filter((directive) => directive !== "upgrade-insecure-requests")
    : BASE_CONTENT_SECURITY_POLICY;
  return [...directives, frameAncestors].join("; ");
}

export function withSecurityHeaders(response: Response, requestUrl: URL, development = false) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy(requestUrl, development));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (requestUrl.pathname === "/studio" || requestUrl.pathname.startsWith("/studio/")) headers.delete("X-Frame-Options");
  else headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  if (requestUrl.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  const publicCatalogue = requestUrl.pathname === "/api/catalog" || requestUrl.pathname.startsWith("/api/catalog/");
  if (requestUrl.pathname.startsWith("/api/") && !publicCatalogue) {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const CONTENT_SECURITY_POLICY = [...BASE_CONTENT_SECURITY_POLICY, "frame-ancestors 'none'"].join("; ");
export { CONTENT_SECURITY_POLICY };
