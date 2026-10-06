import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { casevantCanonicalRedirect, isPrivateSearchSurface } from "../app/seo-policy";
import { withSecurityHeaders } from "../worker/security-headers";

test("www redirects permanently to the fixed apex without losing the continuation", () => {
  const target = casevantCanonicalRedirect(new URL("https://www.casevant.pro/studio?custom_case=42&lang=ru"));
  assert.equal(target?.href, "https://casevant.pro/studio?custom_case=42&lang=ru");
  for (const host of ["casevant.pro", "www.casevant.pro.evil.test", "studio.falcon-merlin.com"]) {
    assert.equal(casevantCanonicalRedirect(new URL(`https://${host}/`)), null);
  }
});

test("account, team, API and saved-case query surfaces are always noindex", () => {
  for (const path of ["/account", "/account/reset", "/matters", "/organizations", "/invitations", "/canopy", "/api/me", "/signin-with-chatgpt", "/studio?custom_case=42", "/?view=community", "/studio?organization=private"]) {
    const url = new URL(path, "https://casevant.pro");
    assert.equal(isPrivateSearchSurface(url), true, path);
    assert.match(withSecurityHeaders(new Response("ok"), url).headers.get("X-Robots-Tag")!, /noindex/);
  }
  for (const path of ["/", "/studio", "/studio?lang=ru", "/templates", "/help/studio-demo", "/robots.txt", "/sitemap.xml"]) {
    assert.equal(isPrivateSearchSurface(new URL(path, "https://casevant.pro")), false, path);
  }
});

test("crawler files expose only intended public apex routes", () => {
  const robots = readFileSync("public/robots.txt", "utf8");
  assert.match(robots, /User-agent: \*\nAllow: \/\n/);
  for (const route of ["/account", "/api/", "/canopy", "/matters", "/organizations", "/invitations", "/studio?"]) assert.ok(robots.includes(`Disallow: ${route}`));
  const sitemap = readFileSync("public/sitemap.xml", "utf8");
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, ["https://casevant.pro/", "https://casevant.pro/studio", "https://casevant.pro/templates", "https://casevant.pro/help/studio-demo"]);
});
