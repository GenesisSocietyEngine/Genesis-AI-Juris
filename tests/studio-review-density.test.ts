import assert from "node:assert/strict";
import test from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudioActionPanel from "../app/StudioActionPanel";
import ActionTile from "../app/ActionTile";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { studioReviewAction } from "../app/studio-review-action";
import { validateStudioDraft, type StudioCheck } from "../app/studio-validation";

function elements(value: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement(value)) return [];
  const element = value as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children as ReactNode)];
}
const noop = () => {};
for (const locale of ["en", "ru"] as const) test(`${locale}: compact findings retain every exact text, identity and destination`, () => {
  for (const blank of [false, true]) {
    const draft = buildCanopyPackage("base").draft;
    if (blank) { draft.nodes = []; draft.links = []; draft.title = ""; draft.premise = ""; }
    const checks = validateStudioDraft(draft, locale).checks;
    // Exercise additional identity-specific and idless findings without changing validation policy.
    checks.push({ id: "identity", level: "warn", text: "Synthetic identity warning" }, { level: "warn", text: "Synthetic failure: retry validation" });
    const before = JSON.stringify({ draft, checks }), opened: unknown[] = [];
    const tree = StudioActionPanel({ draft, checks, locale, checking: false, canEdit: true, onOpen: target => opened.push(target), onReport: noop, onSave: noop, saved: false, saving: false, withinEnvelope: true });
    const warnings = checks.filter(check => check.level === "warn" && check.id);
    const tiles = elements(tree).filter(element => element.type === ActionTile && element.props.id);
    assert.deepEqual(tiles.map(tile => tile.props.id), warnings.map(check => `action-${check.id}`));
    for (const [i, tile] of tiles.entries()) {
      assert.equal(tile.props.title, warnings[i].text);
      assert.equal(tile.props.detail, "");
      assert.ok(String(tile.props.next).trim());
      (tile.props.onClick as () => void)();
      assert.deepEqual(opened[i], { ...studioReviewAction(draft, warnings[i]), reviewId: warnings[i].id });
    }
    const html = renderToStaticMarkup(createElement(StudioActionPanel, { draft, checks, locale, checking: false, canEdit: true, onOpen: noop, onReport: noop, onSave: noop, saved: false, saving: false, withinEnvelope: true }));
    assert.match(html, /class="review-check-list" role="group" aria-label=/);
    assert.ok(html.includes("Synthetic failure: retry validation"));
    assert.equal(JSON.stringify({ draft, checks }), before);
  }
});

test("checking and completed states do not expose stale or empty compact finding groups", () => {
  const draft = buildCanopyPackage("base").draft;
  for (const checking of [true, false]) {
    const checks: StudioCheck[] = checking ? [{ id: "brief", level: "warn", text: "Do not show while checking" }] : [];
    const html = renderToStaticMarkup(createElement(StudioActionPanel, { draft, checks, locale: "en", checking, canEdit: false, onOpen: noop, onReport: noop, onSave: noop, saved: true, saving: false, withinEnvelope: true }));
    assert.doesNotMatch(html, /class="review-check-list"|id="action-brief"/);
    assert.match(html, /Inspection only/);
    assert.match(html, /disabled=""/);
  }
});
