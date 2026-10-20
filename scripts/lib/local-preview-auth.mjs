import { URL } from "node:url";
const pages = new Set(["/", "/studio", "/templates", "/matters", "/canopy", "/organizations", "/invitations", "/account"]);
const escape = value => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function localReturn(value) {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n\t]/.test(value)) return "/studio";
  try { const url = new URL(value, "http://preview.invalid"); return url.origin === "http://preview.invalid" && pages.has(url.pathname) ? url.pathname + url.search + url.hash : "/studio"; } catch { return "/studio"; }
}

/** Sites owns this provider URL in production. This explicit local launcher
 * explains its absence; it never impersonates authentication or copies a draft. */
export function localPreviewSignIn(request, response, next) {
  if (!["GET", "HEAD"].includes(request.method ?? "")) return next();
  const host = request.headers.host ?? "";
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return next();
  const url = new URL(request.url ?? "/", "http://preview.invalid");
  if (url.pathname !== "/signin-with-chatgpt") return next();
  const returnTo = localReturn(url.searchParams.get("return_to")), destination = new URL(returnTo, "http://preview.invalid");
  const ru = (url.searchParams.get("lang") ?? destination.searchParams.get("lang")) === "ru", lang = ru ? "ru" : "en";
  const t = (en, translated) => ru ? translated : en;
  const html = `<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${t("Sign in · CaseVant local preview", "Вход · Локальный просмотр CaseVant")}</title><style>body{margin:0;background:#eff7fb;color:#103949;font:18px/1.6 system-ui,sans-serif}main{max-width:680px;margin:10vh auto;padding:32px;background:white;border:1px solid #bdd7df;border-top:6px solid #087d81;border-radius:16px}p{margin:16px 0}.label{color:#087d81;font-weight:700}h1{font-size:30px;line-height:1.25}a{display:inline-flex;align-items:center;min-height:48px;padding:8px 18px;margin:8px 12px 8px 0;border-radius:8px;border:1px solid #087d81;color:#075d63;text-decoration:none}a.primary{background:#087d81;color:white}a:focus-visible{outline:3px solid #e1ab21;outline-offset:3px}@media(max-width:740px){main{margin:24px 12px;padding:22px}a{display:flex;justify-content:center;margin-right:0}}</style><main><p class="label">CASEVANT · ${t("LOCAL PREVIEW", "ЛОКАЛЬНЫЙ ПРОСМОТР")}</p><h1>${t("Sign in on the hosted CaseVant site", "Войдите на основном сайте CaseVant")}</h1><p>${t("ChatGPT sign-in is available on the hosted site. This local preview cannot sign you in through ChatGPT.", "Вход через ChatGPT доступен на основном сайте. Локальный просмотр не поддерживает этот способ входа.")}</p><p>${t("Your local draft stays in this browser. Opening the hosted site does not transfer or save it there. Return to your draft to export it first if needed.", "Локальный черновик остаётся в этом браузере. Открытие основного сайта не переносит и не сохраняет его там. При необходимости вернитесь к черновику и экспортируйте его.")}</p><a class="primary" href="https://casevant.pro/account?lang=${lang}" target="_blank" rel="noopener noreferrer">${t("Open hosted sign-in", "Открыть вход на основном сайте")}</a><a href="${escape(returnTo)}">${t("Return to local draft", "Вернуться к локальному черновику")}</a></main></html>`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer"); response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  response.end(request.method === "HEAD" ? "" : html);
}
export function localPreviewAuth() {
  return { name: "casevant-local-provider-sign-in", apply: "serve", configureServer(server) { server.middlewares.use(localPreviewSignIn); } };
}
