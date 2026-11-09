import assert from "node:assert/strict";
import type { PortalView } from "../app/portal/contracts";
type Call = (
  route: string,
  method?: string,
  body?: unknown,
  email?: string,
  org?: string,
  h?: Record<string, string>,
  query?: string,
  dossier?: string,
) => Promise<Response>;
export async function portalScenarios(
  call: Call,
  db: D1Database,
  org: string,
  foreign: string,
  replaceBucket: (op: "put" | "get", after: () => Promise<void>) => () => void,
) {
  const uid = () => crypto.randomUUID(),
    owner = "practice-owner@example.test",
    alice = "portal-alice@example.test",
    bob = "portal-bob@example.test",
    eve = "portal-eve@example.test";
  async function good(r: Response, status = 200) {
    assert.equal(r.status, status, await r.clone().text());
    return r;
  }
  const made = await good(
    await call("dossiers", "POST", {
      title: "Internal litigation plan — do not disclose",
      jurisdictions: ["Test"],
      classification: "internal",
    }),
    201,
  );
  const caseId = ((await made.json()) as { dossier: { dossier_id: string } }).dossier.dossier_id,
    scope = "?case=" + caseId;
  const staff = (body?: Record<string, unknown>, q = "", email = owner, o = org) =>
    call("portalStaff", body ? "POST" : "GET", body, email, o, {}, scope + q);
  const client = (email: string, body?: Record<string, unknown>, q = "") =>
    call("portalClient", body ? "POST" : "GET", body, email, org, {}, q);
  const make = async (email: string) => {
    const id = uid(),
      cmd = { id, action: "invite", email, label: "Harbour appointment" };
    const r = await good(await staff(cmd));
    const link = ((await r.json()) as { path: string }).path;
    assert.equal(((await (await good(await staff(cmd))).json()) as { path: string }).path, link);
    assert.match(link, /^\/portal#invite=/);
    return { id, proof: link.split(".").at(-1), action: "accept" };
  };
  const view = async (email: string, id?: string, before?: number) =>
    (await (
      await good(
        await client(email, undefined, id ? "?grant=" + id + (before ? "&before=" + before : "") : ""),
      )
    ).json()) as PortalView;
  const teamView = async (id: string) =>
    (await (await good(await staff(undefined, "&grant=" + id))).json()) as PortalView;
  const count = async (table: string) =>
    await db.prepare("SELECT COUNT(*) AS n FROM " + table).first<number>("n");
  const memberCount = await count("organization_memberships"),
    participantCount = await count("dossier_participants");
  const a = await make(alice),
    b = await make(bob);
  assert.equal((await client("", a)).status, 401);
  assert.equal((await client(eve, a)).status, 404);
  assert.equal((await client(alice, { ...a, proof: "wrong" })).status, 404);
  assert.deepEqual((await view(alice)).grants, []);
  await good(await client(alice, a));
  await good(await client(bob, b));
  assert.equal((await client(alice, a)).status, 404);
  assert.equal((await client(bob, undefined, "?grant=" + a.id)).status, 404);
  assert.equal(
    (await staff(undefined, "&grant=" + a.id, "practice-outsider@example.test", foreign)).status,
    404,
  );
  assert.equal((await call("detail", "GET", undefined, alice, org, {}, "", caseId)).status, 403);
  assert.equal(await count("organization_memberships"), memberCount);
  assert.equal(await count("dossier_participants"), participantCount);
  const docs = async (bytes: string, doc?: string) => {
    const revision = await db
      .prepare("SELECT revision FROM dossiers WHERE id=?")
      .bind(caseId)
      .first<number>("revision");
    const form = new FormData();
    for (const [k, v] of Object.entries({
      privacyAcknowledged: "true",
      title: "Client letter",
      documentType: "letter",
      classification: "internal",
      expectedRevision: String(revision),
      mediaType: "text/plain",
      idempotencyKey: uid(),
      sourceNote: "STAFF-NOTE-NOT-FOR-PORTAL",
      ...(doc ? { documentId: doc } : {}),
    }))
      form.set(k, v);
    form.set("file", new File([bytes], "letter.txt", { type: "text/plain" }));
    const r = await call("portalDocuments", "POST", form, owner, org, {}, "", caseId);
    assert.ok(r.ok, await r.text());
    return (await teamView(a.id)).choices.find((c) => c.kind === "document")!;
  };
  const v1 = await docs("Synthetic original letter.");
  const share1 = {
    action: "share",
    id: uid(),
    grant: a.id,
    kind: "document",
    target: v1.id,
    revision: v1.revision,
  };
  await good(await staff(share1));
  await good(await staff(share1));
  const v2 = await docs("Synthetic updated letter.", v1.id);
  assert.notEqual(v2.revision, v1.revision);
  const dl = (g: string, item: string, kind: string, email: string, mode = "client") =>
    call(
      "portalFile",
      "GET",
      undefined,
      email,
      org,
      {},
      scope + "&grant=" + g + "&item=" + item + "&kind=" + kind + "&mode=" + mode,
    );
  const r = await good(await dl(a.id, share1.id, "document", alice));
  assert.equal(await r.text(), "Synthetic original letter.");
  assert.match(r.headers.get("content-disposition") || "", /attachment/);
  assert.match(r.headers.get("cache-control") || "", /no-store/);
  assert.equal((await dl(a.id, share1.id, "document", bob)).status, 404);
  assert.equal((await dl(b.id, share1.id, "document", bob)).status, 404);
  assert.equal((await dl(a.id, v1.revision, "document", alice)).status, 404);
  await good(await staff({ ...share1, id: uid(), revision: v2.revision }));
  assert.equal((await dl(a.id, share1.id, "document", alice)).status, 404);
  const sharedDoc = (await view(alice, a.id)).thread!.shared[0];
  assert.equal(sharedDoc.detail, "2");
  const e = {
    id: "work_portal_meeting",
    kind: "event",
    title: "Harbour meeting",
    description: "STAFF-NOTE-NOT-FOR-PORTAL",
    dueDate: "2026-11-15",
    assignee: null,
    priority: "normal",
    status: "open",
    checklist: [],
    workflow: null,
  };
  const author = await db
    .prepare("SELECT owner_actor_id FROM dossiers WHERE id=?")
    .bind(caseId)
    .first<string>("owner_actor_id");
  const event = async (revision: number, date: string) =>
    db
      .prepare("INSERT INTO dossier_practice_revisions VALUES(?,?,?,?,?,?,?)")
      .bind(
        caseId,
        revision,
        author,
        uid(),
        "fixture",
        JSON.stringify({
          revision,
          items: [
            { ...e, dueDate: date },
            { ...e, id: "private_task", kind: "task", title: "INTERNAL-TASK" },
          ],
        }),
        new Date().toISOString(),
      )
      .run();
  await event(1, e.dueDate);
  const pub = { action: "share", id: uid(), grant: a.id, kind: "event", target: e.id, revision: "1" };
  await good(await staff(pub));
  const publicView = await view(alice, a.id);
  assert.equal(publicView.thread!.shared.length, 2);
  assert.doesNotMatch(
    JSON.stringify(publicView),
    /STAFF-NOTE|INTERNAL-TASK|Internal litigation|binary_object|portal-bob|version_|@example|target|actor/i,
  );
  await event(2, "2026-11-20");
  await event(3, e.dueDate);
  assert.equal((await view(alice, a.id)).thread!.shared.filter((x) => x.kind === "event").length, 0);
  assert.equal((await staff({ ...pub, id: uid() })).status, 409);
  await good(await staff({ ...pub, id: uid(), revision: "3" }));
  assert.equal((await view(alice, a.id)).thread!.shared.filter((x) => x.kind === "event").length, 1);
  assert.equal((await view(bob, b.id)).thread!.shared.length, 0);
  const post = { action: "message", id: uid(), grant: a.id, text: "Client message\n<plain text>" };
  await good(await client(alice, post));
  await good(await client(alice, post));
  assert.equal((await client(alice, { ...post, text: "different" })).status, 409);
  assert.equal((await client(bob, { ...post, id: uid() })).status, 404);
  await good(await staff({ ...post, id: uid(), text: "Case team reply" }));
  assert.deepEqual(
    (await view(alice, a.id)).thread!.messages.map((m) => m.author),
    ["client", "team"],
  );
  assert.deepEqual((await view(bob, b.id)).thread!.messages, []);
  const put = (
    g: string,
    email: string,
    id: string,
    body: string,
    name = "client.txt",
    media = "text/plain",
    h: Record<string, string> = {},
  ) =>
    call(
      "portalFile",
      "POST",
      body,
      email,
      org,
      {
        "content-type": media,
        "x-file-name": encodeURIComponent(name),
        "x-portal-pilot": "confirmed",
        "x-upload-id": id,
        ...h,
      },
      "?grant=" + g,
    );
  const fid = uid(),
    bytes = "Synthetic client upload";
  assert.equal(
    (await put(a.id, alice, uid(), bytes, "note.txt", "text/plain", { "x-portal-pilot": "" })).status,
    400,
  );
  await good(await put(a.id, alice, fid, bytes), 201);
  await good(await put(a.id, alice, fid, bytes), 201);
  assert.equal((await put(a.id, alice, fid, "Other contents")).status, 409);
  assert.equal((await put(a.id, bob, uid(), bytes)).status, 404);
  assert.equal((await put(a.id, alice, uid(), bytes, "bad.pdf", "application/pdf")).status, 415);
  assert.equal((await put(a.id, alice, uid(), bytes, "../bad.txt")).status, 415);
  assert.equal((await put(a.id, alice, uid(), "<html>not plain text</html>")).status, 415);
  assert.equal((await put(a.id, alice, uid(), "x".repeat(5 * 1024 * 1024 + 1))).status, 413);
  assert.equal(
    (await put(a.id, alice, uid(), bytes, "f.txt", "text/plain", { origin: "https://elsewhere.test" }))
      .status,
    403,
  );
  assert.equal(await (await good(await dl(a.id, fid, "upload", owner, "staff"))).text(), bytes);
  assert.equal((await dl(a.id, fid, "upload", bob)).status, 404);
  assert.equal((await teamView(a.id)).thread!.uploads.length, 1);
  const undo = replaceBucket("get", async () => {
    await good(await staff({ action: "withdraw", id: uid(), grant: a.id, target: sharedDoc.id }));
  });
  try {
    assert.equal((await dl(a.id, sharedDoc.id, "document", alice)).status, 404);
  } finally {
    undo();
  }
  const revoke = () => staff({ action: "revoke", id: a.id });
  const during = replaceBucket("put", async () => {
    await good(await revoke());
  });
  try {
    assert.equal((await put(a.id, alice, uid(), "Revoked while storing")).status, 404);
  } finally {
    during();
  }
  assert.equal((await client(alice, undefined, "?grant=" + a.id)).status, 404);
  assert.equal((await client(alice, { ...post, id: uid() })).status, 404);
  assert.equal((await dl(a.id, fid, "upload", alice)).status, 404);
  assert.equal((await teamView(a.id)).thread!.messages.length, 2);
  assert.equal((await teamView(a.id)).thread!.uploads.length, 1);
  const anew = await make(alice);
  await good(await client(alice, anew));
  assert.deepEqual((await view(alice, anew.id)).thread, {
    shared: [],
    uploads: [],
    messages: [],
    older: null,
  });
  await assert.rejects(
    db.prepare("UPDATE portal_grants SET state='active' WHERE id=?").bind(a.id).run(),
    /invalid_portal_transition/,
  );
  await assert.rejects(
    db.prepare("DELETE FROM portal_entries WHERE grant_id=?").bind(a.id).run(),
    /immutable_portal_history/,
  );
  const inserts = Array.from({ length: 56 }, (_, i) =>
    db
      .prepare(
        "INSERT INTO portal_entries(id,grant_id,kind,author,actor,target,title,detail,stamp) VALUES(?,?,'message','team','fixture','','Earlier '||?,'',?)",
      )
      .bind(uid(), anew.id, i, new Date().toISOString()),
  );
  await db.batch(inserts);
  const page1 = (await view(alice, anew.id)).thread!,
    page2 = (await view(alice, anew.id, page1.older!)).thread!;
  assert.equal(page1.messages.length, 50);
  assert.equal(page2.messages.length, 6);
  assert.ok(page2.messages.at(-1)!.seq < page1.messages[0].seq);
  const expired = uid();
  await db
    .prepare(
      "INSERT INTO portal_grants(id,organization_id,case_id,email,label,state,issuer,created_at,expires_at) VALUES(?,?,?,?,?,'invited',?,?,?)",
    )
    .bind(
      expired,
      org,
      caseId,
      eve,
      "Expired case",
      author,
      "2026-01-01T00:00:00.000Z",
      "2026-01-08T00:00:00.000Z",
    )
    .run();
  assert.equal((await teamView(expired)).grants.find((g) => g.id === expired)!.status, "expired");
  assert.equal((await staff({ action: "invitation", id: expired })).status, 409);
  const outsider = "client-portal-staff@example.test";
  await db
    .prepare("INSERT INTO users(email,display_name) VALUES(?,?)")
    .bind(outsider, "Portal contributor")
    .run();
  const u = await db
    .prepare("SELECT id,actor_id FROM users WHERE email=?")
    .bind(outsider)
    .first<{ id: number; actor_id: string }>();
  await db
    .prepare(
      "INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,status,revision,created_at) VALUES(?,?,?,'member','active',1,?)",
    )
    .bind(org, u!.id, u!.actor_id, new Date().toISOString())
    .run();
  assert.equal(
    (await staff(undefined, "&grant=" + anew.id, outsider)).status,
    404,
    "firm membership alone cannot see any portal",
  );
  const revision = await db
    .prepare("SELECT revision FROM dossiers WHERE id=?")
    .bind(caseId)
    .first<number>("revision");
  await good(
    await call(
      "participants",
      "POST",
      { actorId: u!.actor_id, role: "contributor", expectedRevision: revision },
      owner,
      org,
      {},
      "",
      caseId,
    ),
    201,
  );
  const cv = (await (
    await good(await staff(undefined, "&grant=" + anew.id, outsider))
  ).json()) as PortalView;
  assert.equal(cv.canInvite, false);
  assert.equal((await staff({ action: "revoke", id: anew.id }, "", outsider)).status, 404);
  await good(
    await staff(
      { action: "message", id: uid(), grant: anew.id, text: "Contribution from the case team" },
      "",
      outsider,
    ),
  );
  const transition = async (newStatus: string) => {
    const expectedRevision = await db
      .prepare("SELECT revision FROM dossiers WHERE id=?")
      .bind(caseId)
      .first<number>("revision");
    await good(
      await call(
        "portalTransitions",
        "POST",
        { newStatus, reason: "Synthetic closure and reopening check", expectedRevision },
        owner,
        org,
        {},
        "",
        caseId,
      ),
    );
  };
  await transition("declined");
  assert.deepEqual((await view(alice)).grants, []);
  await transition("active");
  assert.deepEqual((await view(alice)).grants, [], "reopening a case cannot resurrect client sessions");
}
