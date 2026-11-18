import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { evidenceHarness } from "./fixtures/evidence-owner";
import { evidenceNotice, evidenceCitationLabel, evidenceCount, evidenceIssue, proposalStatement } from "../app/matters/evidence-copy";

const built = await build({ entryPoints: ["app/matters/MattersClient.tsx"], bundle: true, write: false, format: "esm", platform: "node", packages: "external", loader: { ".css": "empty", ".module.css": "empty" }, jsx: "automatic", plugins: [{ name: "locale-render", setup(b) {
  b.onResolve({ filter: /use-interface-locale$/ }, () => ({ path: "locale", namespace: "fixture" }));
  b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "router" ? "export function useRouter(){return {push(){}}}" : "export function useInterfaceLocale(){return [globalThis.__evidenceLocale ?? 'en',()=>{}]} export function useWorkspaceLocation(){return '/'}" }));
} }] });
mkdirSync(".artifacts/evidence-render", { recursive: true });
const file = resolve(".artifacts/evidence-render/parent.mjs"); writeFileSync(file, built.outputFiles[0].text);
const { AuthorizedMattersClient } = await import(pathToFileURL(file).href);

test("integrated review localizes both directions without altering exact history, raw data or writes", async () => {
  const h = await evidenceHarness();
  const state = globalThis as unknown as { __evidenceLocale?: string };
  const render = (locale: string) => { state.__evidenceLocale = locale; return renderToStaticMarkup(createElement(AuthorizedMattersClient, { actorId: "synthetic-owner", organizationId: "synthetic-org", controller: h.owner })); };
  try {
    h.owner.setNotice("AI proposal review recorded. The historical proposal remains attributable.");
    const en = render("en"), ru = render("ru");
    assert.match(en, /Generate source-grounded AI proposals/);
    assert.match(ru, /Подготовить предложения ИИ по источникам/);
    assert.match(ru, /Решение по предложению ИИ записано/);
    assert.match(ru, /Утвердить с источниками/);
    assert.match(en, /aria-label="Inspect AI proposal source Synthetic long source \/ Синтетический источник, version 2, document anchor"/);
    assert.match(ru, /aria-label="Проверить источник предложения ИИ Synthetic long source \/ Синтетический источник, версия 2, ссылка на документ"/);
    assert.doesNotMatch(ru, />Accept with sources<|>Professional assertions<|>Review note<|>Inspectable sources</);
    for (const html of [en, ru]) {
      assert.ok(html.includes(h.note));
      assert.ok(html.includes(h.statement));
      assert.match(html, /<details[^>]*><summary>[^<]+<\/summary><pre[^>]*>\{\n  &quot;schema_version&quot;: 1,/);
      assert.match(html, /href="#source-qa-anchor"/);
    }
    assert.match(ru, /версия 2, ссылка на документ/);
    assert.equal(render("en"), en);
    h.owner.navigate("activity");
    assert.match(render("ru"), /Предложение ИИ утверждено/);
    assert.match(render("ru"), /Участник: Владелец/);
    assert.match(render("en"), /AI PROPOSAL ACCEPTED/);
    assert.equal(h.writeCount(), 0);
  } finally { delete state.__evidenceLocale; h.owner.dispose(); }
});

test("readable proposal extraction preserves arbitrary, malformed and future payloads", () => {
  assert.equal(proposalStatement('{"schema_version":1,"statement":"  Original\nvalue  "}'), null);
  assert.equal(proposalStatement(JSON.stringify({schema_version:1,statement:"  Original\nvalue  "})), "  Original\nvalue  ");
  for (const raw of ['plain original', '{bad', '["original"]', '{"schema_version":2,"statement":"future"}', '{"statement":42}', '{"statement":" "}']) assert.equal(proposalStatement(raw), null);
  assert.equal(proposalStatement('{"statement":"Legacy exact statement"}'), "Legacy exact statement");
});

test("generation notices switch from the same receipt, retaining exact counts and unknown text", () => {
  const receipt = "AI analysis created 2 grounded proposal(s) for explicit review. 3 bounded source range(s), 80 characters total, were analyzed. 1 source(s) exceeded the disclosed context bound.";
  assert.match(evidenceNotice(receipt, "ru"), /проверки: 2\..*фрагментов: 3; всего символов: 80\..*контекста: 1\./);
  assert.equal(evidenceNotice(receipt, "en"), receipt);
  assert.equal(evidenceNotice("Unrecognized receipt / Авторский текст", "ru"), "Unrecognized receipt / Авторский текст");
  assert.equal(evidenceCitationLabel(undefined, "exact-id", "ru"), "Ссылка на источник exact-id");
});

test("Russian counts and error recovery retain the original server evidence", () => {
  assert.equal(evidenceCount("records", 1, "ru"), "1 запись");
  assert.equal(evidenceCount("records", 22, "ru"), "22 записи");
  assert.equal(evidenceCount("citations", 11, "ru"), "11 точных ссылок");
  const issue = { kind: "error" as const, title: "The workspace could not complete that request", message: "Unknown provider response", detail: "Exact diagnostic" };
  const ru = evidenceIssue(issue, "ru");
  assert.match(ru.message, /автоматическая повторная отправка не выполнялась/);
  assert.equal(ru.detail, "Unknown provider response\n\nExact diagnostic");
  assert.equal(evidenceIssue(issue, "en"), issue);
});
