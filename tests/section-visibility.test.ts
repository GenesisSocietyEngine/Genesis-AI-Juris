import assert from "node:assert/strict";
import test from "node:test";
import { selectedTabScrollLeft } from "../app/matters/section-visibility";

test("selected tabs reveal their full horizontal extent without moving an already visible tab", () => {
  assert.equal(selectedTabScrollLeft(0, 300, 600, 150), 450);
  assert.equal(selectedTabScrollLeft(450, 300, 600, 150), 450);
  assert.equal(selectedTabScrollLeft(450, 300, 100, 100), 100);
  assert.equal(selectedTabScrollLeft(450, 900, 600, 150), 450);
  assert.equal(selectedTabScrollLeft(0, 200, 400, 250), 400);
  assert.equal(selectedTabScrollLeft(450, 0, 0, 0), 450, "hidden phone tabs do not reset the strip");
});
