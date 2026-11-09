import assert from "node:assert/strict";
import test from "node:test";
import { departureChangeLabel } from "../app/departure-presentation";
import { NavigationController } from "../app/navigation-controller";
import { editPortalField, portalDraftReview, type PortalField } from "../app/portal/departure";

const clean = { email: false, label: false, reply: false, upload: false };

test("a collapsed invitation remains one unsent item; Review returns to the last still-changed field", () => {
  let recent: PortalField[] = [];
  recent = editPortalField(recent, "email");
  recent = editPortalField(recent, "label");
  assert.deepEqual(portalDraftReview({ ...clean, email: true, label: true }, recent),
    { changes: ["portal_invitation"], field: "label" });
  assert.equal(portalDraftReview({ ...clean, email: true }, recent).field, "email");
  assert.deepEqual(portalDraftReview(clean, recent), { changes: [], field: null });
});

test("separate portal drafts are all listed; the last remaining edit determines the review target", () => {
  const dirty = { ...clean, reply: true, upload: true };
  const history = editPortalField(editPortalField([], "upload"), "reply");
  assert.deepEqual(portalDraftReview(dirty, history), { changes: ["portal_reply", "portal_upload"], field: "reply" });
  assert.equal(portalDraftReview(dirty, editPortalField(history, "upload")).field, "upload");
  assert.deepEqual(portalDraftReview({ ...dirty, reply: false }, history), { changes: ["portal_upload"], field: "upload" });
});

test("portal review has no save capability, including a selected file; pending operations take precedence", async () => {
  const controller = new NavigationController({ transport: async () => assert.fail("no transport"), clear: () => {}, leave: () => assert.fail("no departure") });
  let risk: "dirty" | "pending" | "clear" = "dirty", focus: PortalField | null = null;
  const state = portalDraftReview({ ...clean, upload: true }, []);
  controller.register({}, { risk: () => risk, changes: () => state.changes, review: () => { focus = state.field; }, suspend: () => {}, deny: () => {} });
  assert.deepEqual(controller.departureChanges(), ["portal_upload"]);
  assert.equal(controller.canSaveBeforeDeparture(), false); assert.equal(await controller.saveBeforeDeparture(), false);
  controller.reviewUnsaved(); assert.equal(focus, "upload"); assert.equal(controller.warnBeforeUnload(), true);
  risk = "pending"; assert.equal(controller.risk(), "pending"); assert.equal(await controller.saveBeforeDeparture(), false);
  risk = "clear"; assert.deepEqual(controller.departureChanges(), []); assert.equal(controller.warnBeforeUnload(), false);
});

test("English and Russian describe invitations, replies and files as unsent, without exposing their contents", () => {
  const changes = portalDraftReview({ email: true, label: true, reply: true, upload: true }, []).changes;
  for (const [locale, words] of [["en", [/invitation.*not been created or sent/, /reply.*not been sent/, /file.*not been uploaded/]], ["ru", [/Приглашение.*не создано/, /Ответ.*не отправлен/, /файл.*не загружен/]]] as const) {
    changes.forEach((change, idx) => assert.match(departureChangeLabel(change, locale), words[idx]));
  }
});
