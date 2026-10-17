import assert from "node:assert/strict";
import { createElement, isValidElement, Children, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import RelationRuleEditor from "../app/StudioRelationRuleEditor";
import { studioInspectorPresentation } from "../app/studio-inspector-presentation";
import { caseTypeReference } from "../app/case-type-reference";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { validateStudioDraft } from "../app/studio-validation";
import type { CaseTypeId, StudioLink } from "../app/types";

type Props = Parameters<typeof RelationRuleEditor>[0];
const professional: Array<CaseTypeId | undefined> = [undefined, "general_advisory", "litigation_strategy", "contract_review", "tax_planning", "compliance", "tax_compliance", "erp_incident", "investigation"];
const link: StudioLink = { id: "retained-route", from: "a", to: "b", rule: {
  label: "Retained option", cost: 725, minutes: 95, result: "Retained hypothetical consequence",
  effects: { position: 8, evidence: -2 }, guards: [{ metric: "trust", comparison: "gte", value: 65 }], repeatability: "limited", maxUses: 4,
} };
function props(locale: "en" | "ru", id?: CaseTypeId): Props {
  return { locale, caseType: id ? caseTypeReference(id) : undefined, link, developerMode: false, disabled: false,
    beginFieldEdit: () => assert.fail("render must not begin an edit"), setRule: () => assert.fail("render must not edit"),
    applyRule: () => assert.fail("render must not apply a rule"), commitField: () => assert.fail("render must not commit history") };
}
function elements(node: ReactNode): Array<ReactElement<Record<string, unknown>>> {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}

for (const locale of ["en", "ru"] as const) {
  for (const id of professional) test(`${id ?? "legacy default"} ${locale}: actual option editor is professional and retains authored values`, () => {
    const before = JSON.stringify(link);
    const html = renderToStaticMarkup(createElement(RelationRuleEditor, props(locale, id)));
    assert.doesNotMatch(html, /player|игрок/i);
    assert.match(html, locale === "en" ? /Option settings/ : /Настройки варианта/);
    assert.match(html, locale === "en" ? /Hypothetical consequence/ : /Гипотетическое последствие/);
    assert.match(html, /value="725"/); assert.match(html, /value="95"/);
    assert.match(html, /Retained hypothetical consequence/);
    assert.match(html, locale === "en" ? /do not record work done/ : /не подтверждают выполненную работу/);
    assert.equal(JSON.stringify(link), before, "presentation must not strip non-visible technical rule carriers");
  });
  test(`Training ${locale}: actual editor keeps deliberate player language and original defaults`, () => {
    const html = renderToStaticMarkup(createElement(RelationRuleEditor, { ...props(locale, "training_simulation"), link: { ...link, rule: undefined } }));
    assert.match(html, locale === "en" ? /Player choice settings/ : /Настройки выбора игрока/);
    assert.match(html, /placeholder="0"/); assert.match(html, /placeholder="20"/);
    assert.doesNotMatch(html, /Hypothetical consequence|Гипотетическое последствие/);
  });
  test(`developer/read-only ${locale}: retained technical rules stay visible with native disabled fieldset`, () => {
    const html = renderToStaticMarkup(createElement(RelationRuleEditor, { ...props(locale, "general_advisory"), developerMode: true, disabled: true }));
    assert.match(html, /RULES DSL · retained-route/); assert.match(html, /<fieldset[^>]*disabled=""/);
    for (const value of ["725", "95", "8", "-2", "65", "4"]) assert.ok(html.includes(`value="${value}"`));
    assert.match(html, /value="limited" selected/); assert.match(html, /value="trust" selected/);
  });
  test(`category/language projections ${locale}: check severity and runtime data are unchanged`, () => {
    const draft = buildCanopyPackage("base").draft;
    const before = JSON.stringify(draft);
    const checks = validateStudioDraft(draft, locale).checks;
    const training = validateStudioDraft({ ...draft, caseType: caseTypeReference("training_simulation") }, locale).checks;
    assert.equal(checks.find(c => c.id === "participants")?.level, training.find(c => c.id === "participants")?.level);
    assert.doesNotMatch(checks.find(c => c.id === "participants")!.text, /player|игрок/i);
    assert.match(training.find(c => c.id === "participants")!.text, /player|игрок/i);
    assert.match(studioInspectorPresentation(undefined, locale).stepHelp, locale === "en" ? /do not record actual/ : /не учёт фактического/);
    assert.match(studioInspectorPresentation(caseTypeReference("training_simulation"), locale).stepHelp, /player|игрок/i);
    assert.equal(JSON.stringify(draft), before);
  });
}

test("actual component callbacks keep numeric clearing and original history labels", () => {
  const changes: Array<NonNullable<StudioLink["rule"]>> = [];
  const commits: Array<[string, string]> = [];
  const tree = RelationRuleEditor({ ...props("en", "general_advisory"), setRule: change => changes.push(change), commitField: (label, value) => commits.push([label, value]) });
  const cost = elements(tree).find(e => e.type === "input" && e.props.value === 725)!;
  const change = cost.props.onChange as (event: { target: { value: string } }) => void;
  change({ target: { value: "0" } }); change({ target: { value: "" } });
  (cost.props.onBlur as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: "" } });
  assert.deepEqual(changes, [{ cost: 0 }, { cost: undefined }]);
  assert.deepEqual(commits, [["cost", ""]]);
});

test("authored player prose is preserved verbatim instead of globally replaced", () => {
  const authored = "Original player statement · исходный текст игрока";
  const html = renderToStaticMarkup(createElement(RelationRuleEditor, { ...props("en", "general_advisory"), link: { ...link, rule: { ...link.rule, result: authored } } }));
  assert.ok(html.includes(authored));
  assert.match(html, /aria-label="Option settings"/);
});
