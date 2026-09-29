import assert from "node:assert/strict";
import test from "node:test";
import { graphOverviewScale } from "../app/graph-viewport";

test("overview contains both axes including tall maps at narrow widths", () => {
  for (const viewport of [{width:900,height:500},{width:310,height:420}]) {
    for (const bounds of [{width:650,height:6000},{width:5000,height:600},{width:50,height:50}]) {
      const scale=graphOverviewScale(viewport,bounds);
      assert.ok(scale > 0 && scale <= 1);
      assert.ok(bounds.width*scale <= viewport.width-28+.001);
      assert.ok(bounds.height*scale <= viewport.height-28+.001);
    }
  }
});
test("an unavailable viewport does not produce a corrupt zoom", () => {
  assert.equal(graphOverviewScale({width:0,height:500},{width:600,height:600}),1);
});
