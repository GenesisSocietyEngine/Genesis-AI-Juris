import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseVantDomainGuide } from "../app/CaseVantDomainNotice";

test("domain recovery preserves the original tab and offers same-account personal cases in both languages", () => {
  for (const locale of ["en", "ru"] as const) {
    const html = renderToStaticMarkup(createElement(CaseVantDomainGuide, { locale }));
    assert.match(html, new RegExp(`https://studio\\.falcon-merlin\\.com/studio\\?lang=${locale}`));
    assert.ok(html.includes(`/matters?collection=personal&amp;lang=${locale}`));
    assert.ok(html.includes(encodeURIComponent(`/matters?collection=personal&lang=${locale}`)));
    assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) ?? []).length, 3);
    assert.match(html, locale === "en" ? /Do not sign out or clear/ : /Не выходите из аккаунта и не очищайте/);
    assert.match(html, locale === "en" ? /If export is allowed/ : /Если экспорт разрешён/);
    assert.match(html, locale === "en" ? /does not transfer an unsaved draft/ : /не переносит несохранённый черновик/);
  }
});
