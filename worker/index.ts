/// <reference types="vite/client" />
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  beginOperationalTelemetryRequest,
  finishOperationalTelemetryRequest,
  observeWorkerRequestEvent,
  type ObservabilityBindings,
} from "../app/server-observability";
import { runObservedWorkerRequest } from "./request-lifecycle";
import { withSecurityHeaders } from "./security-headers";
import { casevantCanonicalRedirect } from "../app/seo-policy";
import robotsText from "../public/robots.txt?raw";
import sitemapXml from "../public/sitemap.xml?raw";

interface Env extends ObservabilityBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  DOSSIER_DOCUMENTS: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return runObservedWorkerRequest(request, {
      telemetry: {
        begin(requestId, route) {
          beginOperationalTelemetryRequest(requestId, {
            bindings: env,
            database: route === "play_sessions" || route === "admin" ? env.DB : null,
            defer: (promise: Promise<unknown>) => ctx.waitUntil(promise),
          });
        },
        finish(requestId) {
          finishOperationalTelemetryRequest(requestId);
        },
        emit(input) {
          observeWorkerRequestEvent(input, { bindings: env });
        },
      },
      async dispatch(observedRequest, url) {
        const canonical = casevantCanonicalRedirect(url);
        if (canonical) return Response.redirect(canonical.href, 308);
        if ((observedRequest.method === "GET" || observedRequest.method === "HEAD") && (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml")) {
          const robots = url.pathname === "/robots.txt";
          return new Response(observedRequest.method === "HEAD" ? null : robots ? robotsText : sitemapXml, {
            headers: { "Content-Type": robots ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
          });
        }
        if (url.pathname === "/_vinext/image") {
          const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
          return handleImageOptimization(observedRequest, {
            fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, observedRequest.url))),
            transformImage: async (body, { width, format, quality }) => {
              const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
              return result.response();
            },
          }, allowedWidths);
        }
        return handler.fetch(observedRequest, env, ctx);
      },
      decorateResponse(response, url) {
        return withSecurityHeaders(response, url, import.meta.env.DEV);
      },
    });
  },
};

export default worker;
