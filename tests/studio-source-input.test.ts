import assert from "node:assert/strict";
import test from "node:test";
import { parseStudioSources, studioSourceFeedback, suggestStudioHttps } from "../app/studio-source-input";
import { validateStudioDraft } from "../app/studio-validation";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseTypeReference } from "../app/case-type-reference";

test("bare authority address explains the warning and explicit correction clears the actual Review check", () => {
  const draft = buildCanopyPackage("base").draft;
  draft.caseType = caseTypeReference("compliance");
  draft.classification = { ...draft.classification!, sourceUrls: ["www.nbb.be"] };
  for (const locale of ["en", "ru"] as const) {
    const check = validateStudioDraft(draft, locale).checks.find(check => check.id === "https-sources")!;
    assert.equal(check.level, "warn");
    assert.match(check.text, /https:\/\//);
  }
  const before = JSON.stringify(draft);
  const suggestion = suggestStudioHttps("www.nbb.be");
  assert.equal(suggestion, "https://www.nbb.be/");
  assert.equal(JSON.stringify(draft), before, "suggesting never changes existing work");
  const corrected = { ...draft, classification: { ...draft.classification!, sourceUrls: [suggestion!] } };
  assert.equal(validateStudioDraft(corrected, "en").checks.find(check => check.id === "https-sources")?.level, "ok");
  assert.match(studioSourceFeedback([suggestion!], "en").message, /authority and relevance still require review/);
  assert.equal(studioSourceFeedback([suggestion!, "broken"], "en").valid, false);
});

test("HTTPS suggestion preserves paths and never upgrades explicit schemes, credentials, prose or relative addresses", () => {
  assert.equal(suggestStudioHttps(" nbb.be/en/page?q=one#part "), "https://nbb.be/en/page?q=one#part");
  for (const value of ["http://nbb.be", "javascript:alert(1)", "//nbb.be", "/nbb.be", "user@nbb.be", "nbb.be\\@evil.example", "not a source", "https://nbb.be", "nbb.be/has space", "localhost"]) assert.equal(suggestStudioHttps(value), null, value);
  for (const value of [[], ["http://nbb.be"], ["https://user:password@nbb.be"], ["https://nbb.be/" + "x".repeat(2048)], Array.from({length:31}, (_, i) => `https://nbb.be/${i}`)]) assert.equal(studioSourceFeedback(value, "en").valid, false);
  assert.deepEqual(parseStudioSources(" https://nbb.be/\r\n\nhttps://example.org/ \n"), ["https://nbb.be/", "https://example.org/"]);
});
