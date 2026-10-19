import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudioRecoveryView from "../app/StudioRecoveryView";

test("unsupported-field recovery is bilingual and raw original text never enters the document", () => {
  for (const reason of ["The draft contains fields this application cannot preserve while editing.", "The Studio draft contains unsupported fields.", "The Studio envelope contains unsupported fields."]) {
    for (const locale of ["en", "ru"] as const) for (const canExport of [false, true]) {
      let returned = 0;
      const html = renderToStaticMarkup(createElement(StudioRecoveryView, { locale, recovery: { scope: "synthetic", reason, rawText: "EXACT-PRIVATE-RAW-900719925474099312345", canExport, filename: "original.json" }, onReturn: () => { returned++; } }));
      assert.match(html, locale === "en" ? /Document retained for recovery/ : /Документ сохранён для восстановления/);
      assert.ok(html.includes(locale === "en" ? reason : "Эта версия Studio не может сохранить все поля"));
      assert.equal(html.includes(locale === "en" ? "Download the original document" : "Скачать исходный документ"), canExport);
      assert.ok(!html.includes("EXACT-PRIVATE-RAW"));
      assert.equal(returned, 0, "rendering does not return, download or write automatically");
    }
  }
});
