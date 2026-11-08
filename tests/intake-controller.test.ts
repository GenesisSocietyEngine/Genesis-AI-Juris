import assert from "node:assert/strict";
import { test } from "node:test";
import { IntakeController } from "../app/intake/intake-controller";
import { type IntakeRecord } from "../app/intake/intake-model";
import { firmHarness } from "./fixtures/firm-work";
const template: IntakeRecord = {
  id: "intake_" + "a".repeat(32),
  revision: 1,
  caseId: null,
  templateId: null,
  templateRevision: null,
  status: "available",
  title: "Intake",
  questions: [{ label: "Reason?", required: true }],
  answers: [],
  canEdit: true,
  savedAt: "2026-11-08",
};
test("an intake can save a partial draft on departure and recovers only its exact receipt", async () => {
  const h = firmHarness();
  await h.start();
  let posts = 0,
    lose = false,
    wrong = false;
  const receipts = new Map<string, { id: string; revision: number }>(),
    rows = [template];
  const c = new IntakeController(h.navigation, async (path, init) => {
    const out = (body: object) => Response.json({ scope: h.org.selection, ...body });
    assert.equal((init.headers as Record<string, string>)["x-genesis-organization"], h.org.selection);
    const key = new URL(path, "https://test.invalid").searchParams.get("operation");
    if (key)
      return out({
        operationKey: key,
        saved: wrong ? { id: template.id, revision: 18 } : (receipts.get(key) ?? null),
      });
    if (init.method === "POST") {
      posts++;
      const p = JSON.parse(String(init.body));
      const saved = { id: p.id, revision: p.revision + 1 };
      receipts.set(p.operationKey, saved);
      rows.push({ ...template, ...p, ...saved, caseId: "case-a" });
      if (lose) throw Error("reply lost");
      return out({ operationKey: p.operationKey, saved });
    }
    return out({
      canWrite: true,
      cases: [{ id: "case-a", title: "Example", canEdit: true }],
      records: rows,
      next: null,
    });
  });
  const detach = c.attach();
  await c.refresh();
  c.answer(template, "case-a");
  assert.equal(h.navigation.risk(), "clear");
  c.update({ confirmed: true });
  assert.equal(c.command(true), null);
  assert.equal(h.navigation.canSaveBeforeDeparture(), true);
  assert.equal(await h.navigation.saveBeforeDeparture(), true);
  assert.equal(posts, 1);
  c.answer(template, "case-a");
  c.update({ confirmed: true, answers: ["De-identified facts"] });
  lose = true;
  assert.equal(await c.save(c.command(true)!), false);
  assert.equal(h.navigation.risk(), "pending");
  h.navigation.invalidate("expired");
  assert.equal(c.getSnapshot().loaded, false);
  await h.navigation.refresh();
  await c.refresh();
  wrong = true;
  assert.equal(await c.save(), false);
  assert.equal(posts, 2);
  assert.equal(c.getSnapshot().issue, "unconfirmed");
  wrong = false;
  assert.equal(await c.save(), true);
  assert.equal(posts, 2);
  assert.equal(h.navigation.risk(), "clear");
  detach();
});
test("a changed questionnaire never silently rebases open answers; revocation erases them", async () => {
  const h = firmHarness();
  await h.start();
  let source = { ...template },
    granted = true;
  const c = new IntakeController(h.navigation, async () =>
    Response.json({
      scope: h.org.selection,
      records: [source],
      cases: granted ? [{ id: "case-a", canEdit: true, title: "Case A" }] : [],
      canWrite: true,
      next: null,
    }),
  );
  const stop = c.attach();
  await c.refresh();
  c.answer(source, "case-a");
  c.update({ answers: ["in this tab"], confirmed: true });
  source = { ...source, revision: 2, questions: [{ label: "Different", required: false }] };
  await c.refresh();
  assert.equal(c.command(), null);
  assert.equal(c.getSnapshot().draft?.questions[0].label, "Reason?");
  assert.equal(h.navigation.risk(), "dirty");
  granted = false;
  await c.refresh();
  assert.equal(c.getSnapshot().draft, null);
  assert.equal(h.navigation.risk(), "clear");
  stop();
});
