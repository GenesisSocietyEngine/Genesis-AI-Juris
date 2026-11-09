import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, Log, LogLevel } from "miniflare";
test("real workerd constructs issuer and mail requests without following redirects or forwarding credentials", async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey),
    repo = "GenesisSocietyEngine/Genesis-AI-Juris",
    now = Math.floor(Date.now() / 1000);
  const body = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://casevant.pro/api/calendar/dispatch",
    repository: repo,
    repository_id: "1311507341",
    repository_owner_id: "308170479",
    ref: "refs/heads/main",
    workflow_ref: repo + "/.github/workflows/calendar-delivery.yml@refs/heads/main",
    event_name: "workflow_dispatch",
    exp: now + 300,
    nbf: now - 300,
  };
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url"),
    unsigned = encode({ alg: "RS256", kid: "fixture" }) + "." + encode(body);
  const assertion =
    unsigned +
    "." +
    Buffer.from(
      await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(unsigned)),
    ).toString("base64url");
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
 import {verifyAssertion} from "./app/calendar/dispatcher-auth";
 import {providerRequest} from "./app/calendar/provider-request";
 export default {async fetch(request){
  const fixture=await request.json(),observed=[];
  const service=async(url,init)=>{const req=new Request(url,init);observed.push([req.method,req.redirect]);
   if(req.redirect!=="manual")throw Error("unsafe provider redirect");
   if(url.startsWith("https://token.actions.githubusercontent.com/"))return Response.json({keys:[{...fixture.jwk,kid:"fixture",use:"sig"}]});
   if(new URL(url).hostname!=="api.resend.com")throw Error("credentials crossed an origin");
   return Response.redirect("https://different.invalid/do-not-follow",307);};
  const verified=await verifyAssertion(fixture.assertion,service);
  const post=await providerRequest(service,"https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer fixture"},body:"{}"},7000);
  const receipt=await providerRequest(service,"https://api.resend.com/emails/fixture",{headers:{Authorization:"Bearer fixture"}},7000);
  return Response.json({verified,post:post.status,receipt:receipt.status,observed});}};`,
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    conditions: ["workerd", "worker"],
  });
  const worker = new Miniflare({
    host: "127.0.0.1",
    port: 0,
    cf: false,
    telemetry: { enabled: false },
    log: new Log(LogLevel.WARN),
    workers: [
      {
        config: {
          name: "calendar-requests",
          type: "worker",
          compatibilityDate: "2026-09-01",
          manifest: {
            mainModule: "index.js",
            modules: { "index.js": { type: "esm", contents: result.outputFiles[0].text } },
          },
        },
      },
    ],
  });
  try {
    const r = await worker.dispatchFetch("https://casevant.test/", {
      method: "POST",
      body: JSON.stringify({ assertion, jwk }),
    });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      verified: "verified",
      post: 307,
      receipt: 307,
      observed: [
        ["GET", "manual"],
        ["POST", "manual"],
        ["GET", "manual"],
      ],
    });
  } finally {
    await worker.dispose();
  }
});
