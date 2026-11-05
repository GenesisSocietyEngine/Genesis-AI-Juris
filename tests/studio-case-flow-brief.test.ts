import assert from "node:assert/strict";
import test from "node:test";
import { appendCaseFlowOutline } from "../app/studio-case-flow-brief";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "../app/studio-prompt-limit";

test("case-flow outline preserves authored text and supplies empty evidence and decision headings in both languages", () => {
  const original = "Original author text  \r\nLiteral source: <claim> & 450 packs\n";
  for (const locale of ["en", "ru"] as const) {
    const result = appendCaseFlowOutline(original, locale);
    assert.equal(result.status, "ready");
    assert.ok(result.prompt.startsWith(original + "\n\n"));
    assert.equal((result.prompt.match(/^### /gm) ?? []).length, 7);
    assert.match(result.prompt, locale === "en" ? /document, version and passage/ : /документ, версия, фрагмент/);
    assert.match(result.prompt, locale === "en" ? /alternatives and conditions/ : /альтернативы и условия/);
    // Repeated activation or a locale switch cannot append a duplicate outline.
    assert.deepEqual(appendCaseFlowOutline(result.prompt, "en"), { status: "already_present", prompt: result.prompt });
    assert.deepEqual(appendCaseFlowOutline(result.prompt.replace(/\n/g, "\r\n"), "ru"), { status: "already_present", prompt: result.prompt.replace(/\n/g, "\r\n") });
  }
});

test("case-flow outline fits the exact limit or refuses without truncating existing text", () => {
  for (const locale of ["en", "ru"] as const) {
    const length = appendCaseFlowOutline("", locale).prompt.length;
    const exact = "x".repeat(STUDIO_PROMPT_CHARACTER_LIMIT - length - 2);
    const result = appendCaseFlowOutline(exact, locale);
    assert.equal(result.status, "ready");
    assert.equal(result.prompt.length, STUDIO_PROMPT_CHARACTER_LIMIT);
    const overflow = exact + "x";
    assert.deepEqual(appendCaseFlowOutline(overflow, locale), { status: "too_long", prompt: overflow });
  }
});

test("ordinary mentions of a case-flow brief do not block the outline", () => {
  const result = appendCaseFlowOutline("Please prepare a Case-flow brief", "en");
  assert.equal(result.status, "ready");
});
