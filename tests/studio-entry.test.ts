import assert from "node:assert/strict";
import test from "node:test";
import { studioEntry } from "../app/studio-entry";

test("the main entry opens Case Studio with Canopy, including a stale play bookmark", () => {
  for (const params of [{}, { view: "studio" }, { view: "play" }, { view: "unknown" }]) {
    assert.deepEqual(studioEntry(params), { initialView: "studio", autoStartCanopy: true });
  }
});

test("explicit destinations and existing work continuations never trigger the starter", () => {
  for (const view of ["library", "demos", "community", "help"] as const) {
    assert.deepEqual(studioEntry({ view }), { initialView: view, autoStartCanopy: false });
  }
  for (const key of ["studio_step", "example", "import", "auth_continue", "dossier", "return_to"]) {
    assert.equal(studioEntry({ [key]: "existing-work" }).autoStartCanopy, false, key);
  }
  assert.deepEqual(studioEntry({}, "library"), { initialView: "library", autoStartCanopy: false });
});
