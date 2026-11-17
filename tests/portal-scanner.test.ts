import assert from "node:assert/strict";
import { test } from "node:test";
import { configuredScanner, scanPortalBytes } from "../app/portal/scan";

test("private HTTPS scanner sends only bytes to its configured origin and requires credentials", async () => {
  const bytes = new TextEncoder().encode("Synthetic upload");
  const digest = "sha256-fixture";
  const original = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = async (input, init) => {
      requests++;
      assert.equal(String(input), "https://scan.example.test/scan");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("CF-Access-Client-Id"), "test-id");
      assert.equal(new Headers(init?.headers).get("CF-Access-Client-Secret"), "test-secret");
      assert.deepEqual(init?.body, bytes);
      return Response.json({digest, verdict:"clean"});
    };
    const bindings = {PORTAL_SCANNER_ORIGIN:"https://scan.example.test",PORTAL_SCANNER_CLIENT_ID:"test-id",PORTAL_SCANNER_CLIENT_SECRET:"test-secret"};
    assert.equal(await scanPortalBytes(configuredScanner(bindings)!,bytes,digest),"clean");
    for (const incomplete of [{PORTAL_SCANNER_REQUIRED:"1"}, {...bindings,PORTAL_SCANNER_CLIENT_SECRET:""}, {...bindings,PORTAL_SCANNER_ORIGIN:"http://scan.example.test"}]) {
      assert.equal(await scanPortalBytes(configuredScanner(incomplete)!,bytes,digest),"unavailable");
    }
    assert.equal(requests,1);
  } finally {
    globalThis.fetch = original;
  }
});
