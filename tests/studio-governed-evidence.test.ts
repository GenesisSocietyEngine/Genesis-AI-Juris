import assert from "node:assert/strict";
import test from "node:test";
import { studioGovernedEvidenceDestination } from "../app/studio-governed-evidence";

function destination(location: string) {
  const result = studioGovernedEvidenceDestination(location);
  return { ...result, url: new URL(result.href, "https://workspace.invalid") };
}

test("generic Studio chooses an organization case without implying a dossier or evidence association", () => {
  const result = destination("/studio?organization=org-current&lang=ru&dossier=unrelated&custom_case=7");
  assert.equal(result.returning, false);
  assert.equal(result.url.pathname, "/matters");
  assert.deepEqual(Object.fromEntries(result.url.searchParams), { collection: "team", organization: "org-current", lang: "ru" });
});

test("explicit originating Matter returns to its evidence, retaining opaque identity and dropping stale action targets", () => {
  const previous = "/matters?organization=org-a&dossier=matter-a&section=outputs&target=old-output&request=old-request&lang=ru#old";
  const result = destination("/studio?return_to=" + encodeURIComponent(previous));
  assert.equal(result.returning, true);
  assert.deepEqual(Object.fromEntries(result.url.searchParams), { collection: "team", organization: "org-a", lang: "ru", dossier: "matter-a", section: "evidence" });
  assert.equal(result.url.hash, "");
});

test("organization switch discards originating-case selection instead of crossing organization contexts", () => {
  const previous = "/matters?organization=org-a&dossier=matter-a&lang=en";
  const result = destination("/studio?organization=org-b&lang=ru&return_to=" + encodeURIComponent(previous));
  assert.equal(result.returning, false);
  assert.deepEqual(Object.fromEntries(result.url.searchParams), { collection: "team", organization: "org-b", lang: "ru" });
});

test("Canopy, external, malformed and unselected return destinations cannot become an originating Matter", () => {
  for (const previous of [
    "/canopy?organization=org-a&dossier=canopy-copy&scenario=base&run=old-run",
    "https://outside.invalid/matters?dossier=foreign",
    "//outside.invalid/matters?dossier=foreign",
    "/api/dossiers/foreign",
    "/matters?organization=org-a",
    "/matters?dossier=" + "x".repeat(2049),
    "/matters?dossier=foreign\n",
  ]) {
    const result = destination("/studio?return_to=" + encodeURIComponent(previous));
    assert.equal(result.returning, false, previous);
    assert.equal(result.url.searchParams.has("dossier"), false);
    assert.equal(result.url.searchParams.has("section"), false);
    assert.equal(result.url.origin, "https://workspace.invalid");
  }
});
