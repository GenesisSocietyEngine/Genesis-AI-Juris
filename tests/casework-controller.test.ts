import assert from "node:assert/strict";
import { test } from "node:test";
import { firmHarness } from "./fixtures/firm-work";
import { CaseworkController } from "../app/casework/controller";
import { describeTemplate, preview, type CaseChoice, type WorkRecord } from "../app/casework/model";
const source: WorkRecord = {
  kind: "template",
  caseId: null,
  sourceId: null,
  sourceRevision: null,
  id: "template_" + "a".repeat(32),
  revision: 1,
  title: "Notes",
  body: "{{case.title}}",
  stage: "",
  statusFilter: "",
  archived: false,
  savedAt: "2026-11-08T12:00:00Z",
};
const matter: CaseChoice = {
  id: "dossier_" + "a".repeat(32),
  title: "North Harbour",
  reference: "SYN",
  status: "draft",
  revision: 1,
  jurisdictions: ["Test"],
  canEdit: true,
};
test("case document requires the reviewed case and template version, clears with revoked access and never treats a Studio hint as a case grant", async () => {
  const body="{{case.title}} / {{case.stage}}", literal={...matter,title:"Synthetic {{firm.name}}"};
  assert.equal(describeTemplate(body,"ru"),"«Название дела» / «Этап дела»");
  assert.equal(preview(body,"Firm",literal,undefined,"en").display,"Synthetic {{firm.name}} / «Case stage»");
  const complete=preview(body,"Firm",literal,{stage:"review",body:"Synthetic"},"en");
  assert.equal(complete.display,complete.text);
  const h = firmHarness();
  await h.start();
  let src = { ...source },
    cases = [matter];
  const c = new CaseworkController(h.navigation, async () =>
    Response.json({
      scope: h.org.selection,
      canWrite: true,
      firm: "Practice",
      cases,
      records: [src],
      next: null,
    }),
  );
  const stop = c.attach();
  await c.refresh();
  c.generate(src, "51", "en");
  assert.equal(c.getSnapshot().draft?.caseId, "");
  c.update({ caseId: matter.id, confirmed: true });
  assert.equal(c.command(), null);
  c.reviewPreview();
  c.update({ confirmed: true });
  assert.equal(c.command()?.action, "generate");
  src = { ...src, revision: 2, body: "Revised: {{case.title}}" };
  await c.refresh();
  assert.equal(c.command(), null);
  assert.equal(c.projection()?.text, "Revised: North Harbour");
  c.reviewPreview();
  assert.equal(c.command(), null);
  c.update({ confirmed: true });
  assert.equal(c.command()?.action, "generate");
  cases = [];
  await c.refresh();
  assert.equal(c.getSnapshot().draft, null);
  assert.equal(c.getSnapshot().issue, "access");
  stop();
});
test("register drafts participate in Save and continue; an uncertain save accepts only its exact receipt", async () => {
  const h = firmHarness();
  await h.start();
  let posts = 0,
    lose = true,
    wrong = true,
    key = "",
    id = "",
    revision = 0;
  const c = new CaseworkController(h.navigation, async (path, init) => {
    const out = (v: object) => Response.json({ scope: h.org.selection, ...v });
    if (init.method === "POST") {
      const p = JSON.parse(String(init.body));
      posts++;
      id = p.id;
      key = p.operationKey;
      revision = p.revision + 1;
      if (lose) throw Error("missing receipt");
      return out({ operationKey: key, saved: { id, revision } });
    }
    if (path.includes("?operation="))
      return out({ operationKey: key, saved: { id, revision: wrong ? 19 : revision } });
    return out({ canWrite: true, firm: "Example", cases: [matter], records: [], next: null });
  });
  const stop = c.attach();
  await c.refresh();
  c.progress(matter);
  c.update({ stage: "review", body: "Synthetic update", confirmed: true });
  assert.ok(h.navigation.canSaveBeforeDeparture());
  assert.equal(await h.navigation.saveBeforeDeparture(), false);
  assert.equal(h.navigation.risk(), "pending");
  h.navigation.invalidate("expired");
  assert.equal(c.getSnapshot().loaded, false);
  await h.navigation.refresh();
  await c.refresh();
  assert.equal(await c.save(), false);
  assert.equal(posts, 1);
  wrong = false;
  assert.equal(await c.save(), true);
  assert.equal(posts, 1);
  assert.equal(h.navigation.risk(), "clear");
  lose = false;
  c.view({ query: "Example", stage: "", status: "draft" });
  c.update({ title: "My draft cases" });
  assert.equal(await h.navigation.saveBeforeDeparture(), true);
  assert.equal(posts, 2);
  stop();
});
