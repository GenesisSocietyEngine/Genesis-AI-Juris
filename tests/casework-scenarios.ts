import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { type CaseChoice, type WorkRecord, preview, filterCases } from "../app/casework/model";
type Call = (
  r: string,
  m?: string,
  b?: unknown,
  email?: string,
  org?: string,
  h?: Record<string, string>,
  query?: string,
) => Promise<Response>;
export async function workflows(call: Call, db: D1Database, org: string, id: string) {
  const get = (q = "", email?: string) => call("casework", "GET", undefined, email, org, undefined, q),
    post = (p: Record<string, unknown>, email?: string) => call("casework", "POST", p, email);
  const snapshot = async () =>
    (await (await get()).json()) as {
      records: WorkRecord[];
      cases: CaseChoice[];
      firm: string;
      scope: string;
    };
  const first = await snapshot(),
    matter = first.cases.find((c) => c.id === id)!;
  assert.ok(matter.canEdit);
  const invariant = async () =>
    Promise.all(
      [
        "SELECT * FROM dossiers WHERE id=?",
        "SELECT * FROM dossier_participants WHERE dossier_id=?",
        "SELECT * FROM dossier_organization_bindings WHERE dossier_id=?",
      ].map((q) =>
        db
          .prepare(q)
          .bind(id)
          .all()
          .then((v) => v.results),
      ),
    );
  const before = await invariant(),
    tid = "template_" + "1".repeat(32),
    did = "document_" + "2".repeat(32),
    vid = "view_" + "3".repeat(32);
  const base = {
    action: "template",
    id: tid,
    revision: 0,
    title: "Bilingual brief",
    body: "{{firm.name}}\n{{case.title}}\n{{case.stage}}: {{case.update}}",
    operationKey: "casework-template-1",
  };
  assert.equal((await post({ ...base, body: "{{case.private}}" })).status, 400);
  assert.equal((await post(base)).status, 200);
  const gen = {
    action: "generate",
    id: did,
    revision: 0,
    title: "Reviewed brief",
    caseId: id,
    sourceId: tid,
    sourceRevision: 1,
    caseRevision: matter.revision,
    locale: "en",
    preview: "Wrong",
    deidentified: true,
    operationKey: "casework-doc-1",
  };
  assert.equal((await post(gen)).status, 409);
  const update = {
    action: "progress",
    id: "progress_" + id,
    caseId: id,
    revision: 0,
    stage: "review",
    body: "Check <date> & {{firm.name}}.",
    deidentified: true,
    operationKey: "casework-update-1",
  };
  assert.equal((await post(update)).status, 200);
  assert.equal((await post({ ...update, operationKey: "casework-lost-race" })).status, 409);
  assert.deepEqual(await invariant(), before);
  const second = await snapshot(),
    p = second.records.find((v) => v.id === update.id)!;
  const pr = preview(base.body, first.firm, matter, p, "en");
  assert.deepEqual(pr.missing, []);
  assert.ok(pr.text.endsWith("Review: Check <date> & {{firm.name}}."));
  const exact = { ...gen, preview: pr.text };
  const response = await post(exact);
  assert.equal(response.status, 200, await response.clone().text());
  const receipt = await response.json();
  assert.deepEqual(await (await post(exact)).json(), receipt);
  assert.deepEqual(await (await get("?operation=casework-doc-1")).json(), receipt);
  assert.equal((await post({ ...exact, title: "Changed" })).status, 409);
  assert.equal(
    (await post({ ...base, revision: 1, body: "Changed", operationKey: "casework-template-2" })).status,
    200,
  );
  assert.equal(
    (await post({ action: "archive", id: tid, revision: 2, operationKey: "casework-template-3" })).status,
    200,
  );
  assert.equal(
    (await post({ ...exact, id: "document_" + "4".repeat(32), operationKey: "casework-doc-new" })).status,
    409,
  );
  assert.equal(
    (
      await post({
        ...update,
        revision: 1,
        stage: "follow_up",
        body: "Now complete",
        operationKey: "casework-update-2",
      })
    ).status,
    200,
  );
  const history = (await (await get("?history=" + id)).json()) as { history: WorkRecord[] };
  assert.deepEqual(
    history.history.map((r) => r.revision),
    [2, 1],
  );
  assert.equal(history.history[1].body, update.body);
  const filter = { query: "now complete", stage: "follow_up", status: matter.status },
    latest = await snapshot();
  assert.deepEqual(
    filterCases(latest.cases, latest.records, filter).map((v) => v.id),
    [id],
  );
  const view = {
    action: "view",
    id: vid,
    revision: 0,
    title: "My follow-ups",
    filter,
    operationKey: "casework-private-view",
  };
  assert.equal((await post(view)).status, 200);
  assert.equal(
    (await post({ action: "archive", id: vid, revision: 1, operationKey: "casework-view-archive" })).status,
    200,
  );
  assert.equal(
    (await post({ action: "restore", id: vid, revision: 2, operationKey: "casework-view-restore" })).status,
    200,
  );
  const file = await get("?download=" + did);
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-type")!, /wordprocessingml/);
  assert.equal(file.headers.get("x-workspace-scope"), first.scope);
  const parts = unzipSync(new Uint8Array(await file.arrayBuffer()));
  assert.deepEqual(
    Object.keys(parts).sort(),
    ["[Content_Types].xml", "_rels/.rels", "word/document.xml"].sort(),
  );
  const xml = strFromU8(parts["word/document.xml"]);
  assert.ok(xml.includes("Review: Check &lt;date&gt; &amp; {{firm.name}}."));
  assert.ok(!xml.includes("Now complete"));
  await assert.rejects(
    db.prepare("UPDATE case_work_revisions SET body='overwritten' WHERE id=?").bind(did).run(),
    /immutable_case_work_revision/,
  );
  await assert.rejects(
    db.prepare("DELETE FROM case_work_revisions WHERE id=?").bind(did).run(),
    /immutable_case_work_revision/,
  );
  const email = "casework-auditor@example.test";
  await db
    .prepare("INSERT INTO users(email,display_name) VALUES(?,?)")
    .bind(email, "Synthetic auditor")
    .run();
  const a = await db
    .prepare("SELECT id,actor_id FROM users WHERE email=?")
    .bind(email)
    .first<{ id: number; actor_id: string }>();
  await db
    .prepare(
      "INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,status,revision,created_at) VALUES(?,?,?,'auditor','active',1,?)",
    )
    .bind(org, a!.id, a!.actor_id, new Date().toISOString())
    .run();
  const restricted = (await (await get("", email)).json()) as { cases: unknown[]; records: WorkRecord[] };
  assert.deepEqual(restricted.cases, []);
  assert.deepEqual(
    restricted.records.map((v) => v.id),
    [tid],
  );
  assert.equal((await get("?download=" + did, email)).status, 404);
  assert.equal((await get("?history=" + id, email)).status, 404);
  assert.equal(
    (await post({ ...update, revision: 2, operationKey: "casework-no-grant" }, email)).status,
    403,
  );
  assert.equal(
    (await post({ ...view, id: "view_" + "5".repeat(32), operationKey: "casework-auditor-view" }, email))
      .status,
    200,
  );
  assert.equal(
    (await post({ ...view, revision: 3, operationKey: "casework-wrong-owner" }, email)).status,
    409,
  );
  assert.deepEqual(await invariant(), before);
}
export async function prospect(call: Call) {
  const profile = {
    kind: "person",
    name: "Synthetic lead",
    relationship: "prospect",
    leadStage: "consultation",
  };
  const cmd = {
    action: "create",
    id: "",
    revision: 0,
    reviewed: [],
    profile,
    operationKey: "lead-new-prospect",
  };
  const r = await call("contacts", "POST", cmd);
  assert.equal(r.status, 200);
  const id = ((await r.json()) as { ids: string[] }).ids[0];
  const stage = async () =>
    (
      (await (await call("contacts")).json()) as {
        contacts: { id: string; leadStage: string; caseIds: string[] }[];
      }
    ).contacts.find((v) => v.id === id)!;
  assert.equal((await stage()).leadStage, "consultation");
  const legacy = { kind: "person", name: "Synthetic lead renamed", relationship: "prospect" };
  assert.equal(
    (
      await call("contacts", "POST", {
        ...cmd,
        id,
        action: "edit",
        revision: 1,
        operationKey: "lead-legacy",
        profile: legacy,
      })
    ).status,
    200,
  );
  assert.equal((await stage()).leadStage, "consultation");
  assert.equal(
    (
      await call("contacts", "POST", {
        ...cmd,
        id,
        action: "edit",
        revision: 2,
        operationKey: "lead-invalid",
        profile: { ...profile, relationship: "client" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("contacts", "POST", {
        ...cmd,
        id,
        action: "edit",
        revision: 2,
        operationKey: "lead-conversion",
        profile: { ...legacy, relationship: "client", leadStage: "" },
      })
    ).status,
    200,
  );
  assert.equal((await stage()).leadStage, "");
  assert.deepEqual((await stage()).caseIds, []);
}
