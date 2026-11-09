import test from "node:test";
import assert from "node:assert/strict";
import { renderCalendar } from "../app/calendar/ical";
import { authorized } from "../app/calendar/dispatcher-auth";
import { zonedMoment } from "../app/matters/practice-scheduling";
test("iCalendar keeps local dates and UTC instants across the DST fold, escapes injection and folds UTF-8 at 75 octets", async () => {
  const title = "Échéance, pièces; " + "🗂️".repeat(18) + "\r\nATTENDEE:private",
    id = "calendar-row";
  const base = {
    id,
    kind: "event" as const,
    title,
    description: "secret",
    dueDate: "2026-10-25",
    timing: {
      start: zonedMoment("2026-10-25T02:15", "Europe/Brussels", "earlier"),
      end: zonedMoment("2026-10-25T02:45", "Europe/Brussels", "later"),
    },
    assignee: null,
    priority: "normal" as const,
    status: "open" as const,
    checklist: [],
    workflow: null,
  };
  const raw = await renderCalendar("a", "b", { revision: 8, items: [base] }, "2026-10-20T09:10:11.000Z", []),
    unfold = raw.replaceAll("\r\n ", "");
  assert(raw.endsWith("\r\n"));
  assert(!raw.split("\r\n").some((line) => Buffer.byteLength(line) > 75));
  assert.match(unfold, /DTSTART:20261025T001500Z\r\nDTEND:20261025T014500Z/);
  assert.match(unfold, /Échéance\\, pièces\\;/);
  assert(!raw.includes("\r\nATTENDEE"));
  assert(!raw.includes("secret"));
  assert.throws(() => zonedMoment("2027-03-28T02:15", "Europe/Brussels"));
  const second = await renderCalendar("a", "c", { revision: 8, items: [base] }, "2026-10-20T09:10:11Z", []);
  assert.notEqual(unfold.match(/UID:(.*)/)![1], second.replaceAll("\r\n ", "").match(/UID:(.*)/)![1]);
});
test("unattended delivery accepts only a signed, current identity for the canonical main workflow", async () => {
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
  const key = await crypto.subtle.exportKey("jwk", pair.publicKey),
    get: typeof fetch = async (url) => {
      assert.equal(url, "https://token.actions.githubusercontent.com/.well-known/jwks");
      return Response.json({ keys: [{ ...key, kid: "fixture" }] });
    };
  const now = Date.now(),
    n = Math.floor(now / 1000);
  const repo = "GenesisSocietyEngine/Genesis-AI-Juris";
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://casevant.pro/api/calendar/dispatch",
    repository: repo,
    repository_id: "1311507341",
    repository_owner_id: "308170479",
    ref: "refs/heads/main",
    workflow_ref: repo + "/.github/workflows/calendar-delivery.yml@refs/heads/main",
    event_name: "schedule",
    exp: n + 300,
    nbf: n - 10,
  };
  const token = async (p: Record<string, unknown>) => {
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url"),
      head = encode({ alg: "RS256", kid: "fixture" }) + "." + encode(p);
    return (
      head +
      "." +
      Buffer.from(
        await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(head)),
      ).toString("base64url")
    );
  };
  assert(await authorized(await token(claims), get, now));
  for (const v of [
    { aud: "other" },
    { ref: "refs/heads/fork" },
    { repository_id: "0" },
    { workflow_ref: repo + "/.github/workflows/other.yml@refs/heads/main" },
    { event_name: "pull_request_target" },
    { exp: n - 1 },
  ])
    assert(!(await authorized(await token({ ...claims, ...v }), get, now)));
  const real = await token(claims),
    p = real.split(".");
  assert(!(await authorized(p[0] + "." + p[1] + "." + Buffer.alloc(256).toString("base64url"), get, now)));
});
