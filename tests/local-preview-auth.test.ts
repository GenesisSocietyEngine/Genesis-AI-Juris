import assert from "node:assert/strict";
import test from "node:test";
import { localPreviewAuth, localPreviewSignIn } from "../scripts/lib/local-preview-auth.mjs";
function request(url: string, host = "127.0.0.1:4173", method = "GET") {
  let next = 0, body = ""; const headers: Record<string, string> = {};
  const response = { statusCode: 0, setHeader(key: string, value: string) { headers[key] = value; }, end(value: string) { body = value; } };
  localPreviewSignIn({ url, headers: { host }, method }, response, () => { next++; });
  return { body, headers, status: response.statusCode, next };
}
test("local provider URL has an EN/RU explanation and same-preview return without transmitting draft context", () => {
  for (const locale of ["en", "ru"]) {
    const target = `/studio?view=studio&lang=${locale}&studio_step=describe&custom_case=47`;
    const result = request("/signin-with-chatgpt?return_to=" + encodeURIComponent(target));
    assert.equal(result.status, 200); assert.equal(result.next, 0); assert.match(result.headers["Cache-Control"], /no-store/);
    assert.equal(result.headers["Referrer-Policy"], "no-referrer"); assert.match(result.headers["Content-Security-Policy"], /form-action 'none'/);
    assert.ok(result.body.includes(`https://casevant.pro/account?lang=${locale}`));
    assert.ok(result.body.includes(`href="${target.replaceAll("&", "&amp;")}"`));
    assert.ok(!/https:\/\/casevant.pro\/[^" ]*custom_case/.test(result.body), "Local case context must not transfer to hosted sign-in");
    assert.doesNotMatch(result.body, /<form|<input|<script/i);
    assert.ok(result.body.includes(locale === "en" ? "does not transfer or save" : "не переносит и не сохраняет"));
  }
});
test("preview handling never claims provider callbacks, production hosts, sign-out or non-GET authority", () => {
  assert.equal(localPreviewAuth().apply, "serve");
  for (const [url, host, method] of [["/callback", "localhost", "GET"], ["/signout-with-chatgpt", "localhost", "GET"], ["/signin-with-chatgpt", "casevant.pro", "GET"], ["/signin-with-chatgpt", "localhost", "POST"]]) assert.equal(request(url, host, method).next, 1);
  for (const value of ["https://evil.test", "//evil.test", "/api/auth/login", "/callback", "/studio\\evil", "/studio\r\nX:bad"]) assert.ok(request("/signin-with-chatgpt?return_to=" + encodeURIComponent(value)).body.includes('href="/studio"'));
  const injection = request("/signin-with-chatgpt?return_to=" + encodeURIComponent('/studio?q="><script>bad</script>'));
  assert.doesNotMatch(injection.body, /<script>/); assert.match(injection.body, /%22%3E%3Cscript%3E/);
  assert.equal(request("/signin-with-chatgpt", "localhost", "HEAD").body, "");
});
