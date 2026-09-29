import assert from "node:assert/strict";
import test from "node:test";
import { FALCON_STUDIO_HOST, isFalconStudioHost } from "../app/host-mode";

test("the Falcon-Merlin custom host opens the standalone Studio experience", () => {
  assert.equal(FALCON_STUDIO_HOST, "studio.falcon-merlin.com");
  assert.equal(isFalconStudioHost("studio.falcon-merlin.com"), true);
  assert.equal(isFalconStudioHost("studio.falcon-merlin.com:443"), true);
  assert.equal(isFalconStudioHost("studio.falcon-merlin.com, sites-proxy.internal"), true);
  assert.equal(isFalconStudioHost("genesis-juris-web.maxim-hayan.chatgpt.site"), false);
  assert.equal(isFalconStudioHost("www.falcon-merlin.com"), false);
  assert.equal(isFalconStudioHost(null), false);
});
