const CONTENT_SECURITY_POLICY = [
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
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export function withSecurityHeaders(response: Response, requestUrl: URL) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
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

export { CONTENT_SECURITY_POLICY };
