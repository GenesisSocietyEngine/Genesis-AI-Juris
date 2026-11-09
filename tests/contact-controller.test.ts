import assert from "node:assert/strict";
import { test } from "node:test";
import { ContactController } from "../app/contacts/contact-controller";
import { blankContact, type Contact } from "../app/contacts/contact-model";
import { reviewContactCsv } from "../app/contacts/contact-import";
import {
  currentCaseOverviewDestination,
  verifiedWorkspaceCaseReturn,
  workspaceDestination,
} from "../app/workspace-navigation";
import { firmHarness } from "./fixtures/firm-work";

test("CSV preview handles quotes, archived duplicates, mixed bad rows and UTF-8 headers", () => {
  const archived = {
    ...blankContact("person"),
    name: "Alex Jones",
    email: "a@example.test",
    status: "archived",
  } as const;
  const rows = reviewContactCsv(
    '\uFEFFkind,name,email\r\nperson,"O""Keefe, Alex",x@example.test\r\ncompany,Separate Co,A@example.test\r\nperson,alex jones,\r\nperson,Other,bad\r\nperson,Internal,X@EXAMPLE.TEST\r\nperson,missing column',
    [archived],
  );
  assert.equal(rows[0].profile?.name, 'O"Keefe, Alex');
  assert.deepEqual(
    rows.map((r) => r.issue),
    [undefined, "duplicate", "duplicate", "email", "duplicate", "csvColumns"],
  );
  assert.throws(() => reviewContactCsv("kind,kind,name\nperson,person,A", []), /csvHeader/);
  assert.throws(() => reviewContactCsv('kind,name\nperson,"missing end', []), /csvQuotes/);
  assert.throws(() => reviewContactCsv("kind,name\n" + "person,Example\n".repeat(26), []), /csvRows/);
});

test("an untouched editor can leave, a changed contact can save on departure and a lost response is checked without resending", async () => {
  const h = firmHarness();
  await h.start();
  const entries: Contact[] = [],
    receipts = new Map<string, string[]>();
  let posts = 0,
    lose = false;
  const c = new ContactController(h.navigation, async (path, init) => {
    const selection = (init.headers as Record<string, string>)["x-genesis-organization"];
    assert.equal(selection, h.org.selection);
    const data = (data: object) => Response.json({ scope: h.org.selection, ...data });
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body)),
        id = "contact_" + "a".repeat(31) + posts;
      posts++;
      entries.push({ ...body.profile, id, revision: 1, status: "active", caseIds: [] });
      receipts.set(body.operationKey, [id]);
      if (lose) throw Error("Lost response");
      return data({ operationKey: body.operationKey, ids: [id] });
    }
    const key = new URL(path, "https://fixture.test").searchParams.get("operation");
    return key
      ? data({ operationKey: key, ids: receipts.get(key) ?? null })
      : data({ contacts: entries, batches: [], next: null, canWrite: true });
  });
  const stop = c.attach();
  await c.refresh();
  c.open("person");
  assert.equal(h.navigation.risk(), "clear");
  c.setProfile("name", "One");
  assert.equal(h.navigation.canSaveBeforeDeparture(), true);
  assert.equal(await h.navigation.saveBeforeDeparture(), true);
  assert.equal(posts, 1);
  assert.equal(h.navigation.risk(), "clear");
  c.open("person");
  c.setProfile("name", "One");
  assert.equal(c.draftCommand(), null);
  c.reviewMatches(true);
  assert.ok(c.draftCommand());
  c.setProfile("name", "Two");
  lose = true;
  assert.equal(await c.save(), false);
  assert.equal(h.navigation.risk(), "pending");
  const command = c.getSnapshot().pending;
  h.navigation.invalidate("expired");
  assert.deepEqual(c.getSnapshot().entries, []);
  assert.deepEqual(c.getSnapshot().pending, command);
  await h.navigation.refresh();
  await c.refresh();
  assert.equal(await c.save(), true);
  assert.equal(posts, 2);
  assert.equal(c.getSnapshot().entries.length, 2);
  stop();
});

test("revocation during a directory read prevents late contact data and drafts from reappearing", async () => {
  const h = firmHarness();
  await h.start();
  let release!: () => void,
    delayed = false;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const c = new ContactController(h.navigation, async () => {
    if (delayed) await gate;
    return Response.json({ scope: h.org.selection, contacts: [], batches: [], next: null, canWrite: true });
  });
  const stop = c.attach();
  await c.refresh();
  c.open("person");
  c.setProfile("name", "Retained input");
  delayed = true;
  const late = c.refresh();
  h.navigation.invalidate("denied");
  release();
  await late;
  assert.equal(c.getSnapshot().draft, null);
  assert.equal(c.getSnapshot().loaded, false);
  stop();
});

test("Contacts, Library and other work views retain both case identities and reject unverified old bookmarks", () => {
  const start =
    "/work?view=people&studio_case=51&organization=org_A&return_to=" +
    encodeURIComponent("/matters?dossier=case_A&section=overview");
  const bound = verifiedWorkspaceCaseReturn(start, "org_A", [{ id: "case_A" }]);
  for (const path of ["/library", "/work?view=tasks", "/work?view=people"]) {
    const url = workspaceDestination(path, bound),
      overview = new URL(currentCaseOverviewDestination(url)!, "https://local.test");
    assert.equal(overview.pathname, "/matters");
    assert.equal(overview.searchParams.get("dossier"), "case_A");
    assert.equal(overview.searchParams.get("section"), "overview");
    assert.equal(overview.searchParams.get("studio_case"), "51");
  }
  assert.equal(verifiedWorkspaceCaseReturn(start, "org_A", []), start);
  assert.equal(verifiedWorkspaceCaseReturn(start, "org_B", [{ id: "case_A" }]), start);
});
