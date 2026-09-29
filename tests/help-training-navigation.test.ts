import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GenesisNavigation from "../app/GenesisNavigation";
import NavigationSession from "../app/NavigationSession";
import { NavigationController } from "../app/navigation-controller";
import type { ClientOrganization } from "../app/organization-client";
import CaseTemplates, { prepareCaseTemplate } from "../app/CaseTemplates";
import { CASE_TYPE_REGISTRY } from "../app/case-type-registry";
import { caseTypeReference } from "../app/case-type-reference";
import { studioEntry } from "../app/studio-entry";
import type { StudioDraft } from "../app/types";

test("a template creates an empty case package and intake questions without copying example evidence", () => {
  const blank: StudioDraft = { caseId: "untitled_case", title: "", version: "1.0.0", caseType: caseTypeReference("general_advisory"), parent: null, jurisdiction: "", role: "", premise: "", nodes: [], links: [], editHistory: [], updatedAt: "2026-09-16T00:00:00Z" };
  const original = structuredClone(blank);
  for (const definition of CASE_TYPE_REGISTRY) {
    const result = prepareCaseTemplate(blank, definition.id, "en");
    assert.equal(result.draft.caseType?.id, definition.id);
    assert.equal(result.draft.title, "");
    assert.equal(result.draft.nodes.length, 0);
    assert.equal(result.draft.links.length, 0);
    assert.match(result.prompt, /Your answer:/);
    assert.equal(result.draft.parent, null);
  }
  assert.deepEqual(blank, original);
});

test("Templates has its own destination and no playable-case launch controls", () => {
  assert.equal(studioEntry({ view: "templates" }).initialView, "templates");
  const html = renderToStaticMarkup(createElement(CaseTemplates, { locale: "en", onStart: () => {}, onDemo: () => {} }));
  assert.match(html, /Use this template/);
  assert.doesNotMatch(html, /Launch scenario|Open Canopy in Studio|Play case/);
});

test("Studio navigation marks saved drafts and retains training with the shared signed-out state", () => {
  const html = renderToStaticMarkup(createElement(GenesisNavigation, { expandable: true, locale: "en", active: "community", location: "/studio?organization=org_A&view=community", onLanguage: () => {} }));
  assert.match(html, /class="genesis-nav-body"/);
  assert.match(html, /aria-current="page"[^>]*>Saved Studio drafts/);
  assert.match(html, /Sign in/);
  assert.doesNotMatch(html, /Manage organizations|Users &amp; access|Sign out/);
  assert.match(html, /10-minute training/);
});

test("workspace navigation without a verified session offers sign-in and hides organization controls", () => {
  const html = renderToStaticMarkup(createElement(GenesisNavigation, { locale: "en", active: "/organizations", location: "/organizations", onLanguage: () => {} }));
  assert.doesNotMatch(html, /genesis-sidebar-content|genesis-mobile-toggle/);
  assert.match(html, /Sign in/);
  assert.doesNotMatch(html, /Manage organizations|Users &amp; access|Sign out/);
});

test("verified owner workspace navigation keeps scoped organization and account destinations", async () => {
  const actorId = "actor_synthetic_navigation_owner";
  const organization: ClientOrganization = {
    id: "org_synthetic_navigation_a", name: "Synthetic organization A", kind: "team",
    status: "active", role: "org_owner", revision: 1, membershipRevision: 1, actorId,
    selection: "org_synthetic_navigation_a.1.1." + actorId,
  };
  const controller = new NavigationController({
    transport: async () => Response.json({ authenticated: true, actorId,
      identity: { displayName: "Synthetic owner", email: "navigation@example.test", authSource: "chatgpt" },
      organizations: [organization], selected: organization, profileRequired: false }),
    leave: () => {}, clear: () => {},
  });
  await controller.refresh(organization.selection);
  assert.equal(controller.getSnapshot().phase, "ready");
  const location = "/organizations?organization=" + encodeURIComponent(organization.selection);
  // React receives the required child as the positional argument below.
  for (const expandable of [false, true]) {
    const html = renderToStaticMarkup(createElement(NavigationSession,
      { controller } as Parameters<typeof NavigationSession>[0],
      createElement(GenesisNavigation, { expandable, locale: "en", active: "/organizations", location, onLanguage: () => {} }),
    ));
    assert.doesNotMatch(html, /genesis-sidebar-content|genesis-mobile-toggle|Sign in/);
    assert.match(html, /Manage organizations/);
    assert.match(html, /Users &amp; access/);
    assert.ok(html.includes('href="' + location + '"'));
    assert.ok(html.includes('href="' + location + '#organization-users"'));
    assert.ok(html.includes('href="/account?organization=' + encodeURIComponent(organization.selection) + '&amp;return_to=' + encodeURIComponent(location) + '"'));
    assert.match(html, /Synthetic owner/);
    assert.match(html, /Sign out/);
  }
});
