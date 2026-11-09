import assert from "node:assert/strict";
import { zonedMoment } from "../app/matters/practice-scheduling";
import type { dispatch as runner } from "../app/calendar/delivery";
type Call = (
  route: string,
  method?: string,
  body?: unknown,
  email?: string,
  org?: string,
  headers?: Record<string, string>,
  query?: string,
  dossier?: string,
) => Promise<Response>;
export async function calendarScenarios(
  call: Call,
  db: D1Database,
  run: (
    ...args: Parameters<typeof runner> extends [unknown, ...infer R] ? R : never
  ) => ReturnType<typeof runner>,
) {
  const owner = "practice-owner@example.test",
    other = "calendar-reviewer@example.test";
  const org = (
    (await (await call("organizations", "POST", { action: "create", name: "Calendar fixture" })).json()) as {
      organization: { id: string };
    }
  ).organization.id;
  const scope = (
    (await (
      await call(
        "dossiers",
        "POST",
        { title: "Calendar fixture case", jurisdictions: ["Test"], classification: "internal" },
        owner,
        org,
      )
    ).json()) as { dossier: { dossier_id: string } }
  ).dossier.dossier_id;
  const api = (method: string, body?: unknown, email = owner, which = scope, extra = "") =>
    call(
      "calendar",
      method,
      body,
      email,
      org,
      undefined,
      "?scope=" + encodeURIComponent(which) + extra,
      scope,
    );
  const post = (command: Record<string, unknown>, email = owner, which = scope) =>
    api("POST", { operation: crypto.randomUUID(), ...command }, email, which);
  const save = (revision: number, item: Record<string, unknown>, id?: string) =>
    call(
      "practice",
      "POST",
      {
        action: id ? "update" : "create",
        operationKey: crypto.randomUUID(),
        expectedRevision: revision,
        item,
        ...(id ? { id } : {}),
      },
      owner,
      org,
      undefined,
      "",
      scope,
    );
  const ok = async (r: Response) => {
    assert(r.ok, "HTTP " + r.status + ": " + (await r.clone().text()));
    return r.json() as Promise<{
      plan: { items: { id: string }[] };
      path: string;
      receipts: import("../app/calendar/contracts").CalendarReceipt[];
    }>;
  };
  await db
    .prepare("INSERT INTO users(email,display_name) VALUES(?,?)")
    .bind(other, "Calendar reviewer")
    .run();
  const user = await db
    .prepare("SELECT id,actor_id FROM users WHERE email=?")
    .bind(other)
    .first<{ id: number; actor_id: string }>();
  assert(user);
  const self = await db
    .prepare("SELECT actor_id FROM users WHERE email=?")
    .bind(owner)
    .first<string>("actor_id");
  assert(self);
  await db
    .prepare(
      "INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,status,revision,created_at) VALUES(?,?,?,'member','active',1,?)",
    )
    .bind(org, user.id, user.actor_id, new Date().toISOString())
    .run();
  assert.equal((await api("GET", undefined, other)).status, 404);
  const item = {
    kind: "task",
    title: "Review, evidence; λ",
    description: "Never export privileged notes",
    dueDate: "2027-03-28",
    assignee: null,
    priority: "normal",
    status: "open",
    checklist: [],
  };
  const p = (await ok(await save(0, item))).plan,
    id = p.items[0].id;
  const enable = { action: "enable", revision: 0, operation: "calendar-enable-once" };
  await ok(await post(enable));
  await ok(await post(enable));
  const readToken = async (which = scope) =>
    (await ok(await api("GET", undefined, owner, which, "&link=1"))).path.split("/").at(-1)!;
  const token = await readToken(),
    feed = (t: string) => call("feed", "GET", undefined, other, org, undefined, "", t);
  const response = await feed(token);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type")!, /text\/calendar/);
  const first = await response.text(),
    uid = first.match(/UID:([^\r\n]+)/)?.[1];
  assert(uid);
  assert.match(first, /DTSTART;VALUE=DATE:20270328\r\nDTEND;VALUE=DATE:20270329/);
  assert(!first.includes("privileged"));
  assert(!first.includes(user.actor_id));
  await ok(await save(1, { ...item, dueDate: "2027-03-30" }, id));
  const moved = await (await feed(token)).text();
  assert(moved.includes(uid));
  assert.match(moved, /SEQUENCE:2/);
  assert.match(moved, /DTSTART;VALUE=DATE:20270330/);
  assert.equal(moved.match(/BEGIN:VEVENT/g)?.length, 1);
  await ok(await save(2, { ...item, dueDate: null }, id));
  const cancelled = await (await feed(token)).text();
  assert(cancelled.includes(uid));
  assert.match(cancelled, /STATUS:CANCELLED/);
  assert(!cancelled.includes("Review"));
  await ok(await save(3, item, id));
  assert(!(await (await feed(token)).text()).includes("STATUS:CANCELLED"));
  await ok(await post({ action: "rotate", revision: 1 }));
  assert.equal((await feed(token)).status, 404);
  const token2 = await readToken();
  assert.equal((await post({ action: "revoke", revision: 1 })).status, 409);
  await ok(await post({ action: "revoke", revision: 2 }));
  assert.equal((await feed(token2)).status, 404);
  await ok(await post({ action: "enable", revision: 0 }, owner, "firm"));
  const firmFeed = await (await feed(await readToken("firm"))).text();
  assert(!firmFeed.includes(uid));
  const when = zonedMoment("2031-10-26T02:30", "Europe/Brussels", "later"),
    cmd = {
      action: "schedule",
      operation: "calendar-save-recipients",
      channel: "app",
      item: id,
      recipients: [user.actor_id, self],
      when,
      revision: 4,
    };
  assert.equal((await post(cmd)).status, 409, "cannot include an organization member outside the case");
  assert.equal(
    await db
      .prepare("SELECT COUNT(*) AS n FROM calendar_reminders WHERE organization_id=?")
      .bind(org)
      .first("n"),
    0,
    "batch is atomic",
  );
  await ok(
    await call(
      "participants",
      "POST",
      { actorId: user.actor_id, role: "viewer", expectedRevision: 1 },
      owner,
      org,
      undefined,
      "",
      scope,
    ),
  );
  assert.equal((await post({ action: "enable", revision: 0 }, other)).status, 403);
  await ok(await post(cmd));
  await ok(await post(cmd));
  assert.equal((await post({ ...cmd, channel: "email" })).status, 409);
  const mine = (await ok(await api("GET", undefined, other))).receipts;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].mine, true);
  const sent = (await ok(await api("GET"))).receipts;
  assert.equal(sent.length, 2);
  const owned = sent.find((r: { mine: boolean }) => r.mine);
  assert.equal((await post({ action: "dismiss", id: owned!.id }, other)).status, 404);
  await ok(await post({ action: "dismiss", id: mine[0].id }, other));
  const after = (await ok(await api("GET"))).receipts;
  assert.equal(after.filter((r: { dismissed: boolean }) => r.dismissed).length, 1);
  assert.equal((await post({ action: "cancel", id: owned!.id }, other)).status, 403);
  await ok(await post({ action: "cancel", id: owned!.id }));
  await ok(await post({ action: "cancel", id: owned!.id }));
  assert.equal((await ok(await api("GET"))).receipts.find((r) => r.id === owned!.id)?.state, "cancelled");
  const mail = { ...cmd, operation: "calendar-test-email", channel: "email", recipients: [self] };
  await ok(await post(mail));
  const time = Date.parse(when.at) + 1000;
  let sends = 0,
    gets = 0;
  const keys: string[] = [];
  const config = {
    RESEND_API_KEY: "synthetic",
    GENESIS_INVITATION_FROM_EMAIL: "fixture@example.test",
    GENESIS_PUBLIC_ORIGIN: "https://example.test",
  };
  const provider: typeof fetch = async (_url, init) => {
    if (init?.method === "POST") {
      sends++;
      keys.push(new Headers(init.headers).get("Idempotency-Key")!);
      assert(!String(init.body).includes("evidence"));
      const url = new URL(JSON.parse(String(init.body)).text.split("\n").at(-1));
      const back = new URL(url.searchParams.get("return_to")!, url);
      assert.equal(back.searchParams.get("dossier"), scope);
      assert.equal(back.searchParams.get("organization"), url.searchParams.get("organization"));
      return sends === 1 ? new Response("", { status: 503 }) : Response.json({ id: "synthetic-delivery" });
    }
    gets++;
    return Response.json({ last_event: "delivered" });
  };
  assert.equal((await run(config, provider, time, true)).due, 1);
  assert.equal(sends, 0);
  assert.equal((await run(config, provider, time)).retry, 1);
  const parallel = await Promise.all([
    run(config, provider, time + 5 * 60000),
    run(config, provider, time + 5 * 60000),
  ]);
  assert.equal(
    parallel.reduce((a, v) => a + v.accepted, 0),
    1,
  );
  assert.deepEqual(keys, [keys[0], keys[0]]);
  assert.equal((await run(config, provider, time + 11 * 60000)).delivered, 1);
  assert.equal(gets, 1);
  await ok(await post({ ...mail, operation: "calendar-test-failure" }));
  assert.equal((await run(config, async () => new Response(null, { status: 422 }), time)).failed, 1);
  await ok(await post({ ...mail, operation: "calendar-test-unknown" }));
  await run(
    config,
    async () => {
      throw Error("connection lost");
    },
    time,
  );
  assert.equal(
    (
      await run(
        config,
        async () => {
          throw Error("no resend after expiry");
        },
        time + 24 * 3600000,
      )
    ).unknown,
    1,
  );
  await ok(await post({ ...mail, operation: "calendar-test-revoke", recipients: [user.actor_id] }));
  await ok(await post({ action: "enable", revision: 0 }, other, "firm"));
  const otherToken = (await ok(await api("GET", undefined, other, "firm", "&link=1"))).path
    .split("/")
    .at(-1)!;
  await db
    .prepare(
      "UPDATE organization_memberships SET status='suspended',revision=revision+1 WHERE organization_id=? AND actor_id=?",
    )
    .bind(org, user.actor_id)
    .run();
  assert.equal((await run(config, provider, time)).due, 0);
  assert.equal((await api("GET", undefined, other)).status, 404);
  await ok(await post({ ...mail, operation: "calendar-test-complete" }));
  await ok(await save(4, { ...item, status: "completed" }, id));
  assert.equal((await run(config, provider, time)).due, 0, "completing work removes pending deliveries");
  assert.equal((await feed(otherToken)).status, 404);
  await db
    .prepare(
      "UPDATE organization_memberships SET status='active',revision=revision+1 WHERE organization_id=? AND actor_id=?",
    )
    .bind(org, user.actor_id)
    .run();
  assert.equal(
    (await feed(otherToken)).status,
    404,
    "restoring membership cannot restore an old public link",
  );
}
