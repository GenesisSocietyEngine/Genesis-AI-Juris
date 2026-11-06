import assert from "node:assert/strict";
import test from "node:test";
import { caseEditorHarness } from "./fixtures/case-editor";

async function editing() { const h = caseEditorHarness(); await h.start(); h.owner.openCaseEditor(); return h; }

test("case editor saves only supported changed fields against the edit-start revision and preserves unrelated drafts", async () => {
  const h = await editing(); h.owner.rememberDraft("request-reason", "Unrelated unsaved reason", "");
  h.owner.editCaseField("title", "  Updated agreement review  "); h.owner.editCaseField("jurisdictions", "Belgium\nFrance\nFrance");
  assert.equal(await h.owner.saveCaseDetails(), true);
  assert.deepEqual(h.writes, [{ expectedRevision: 4, title: "Updated agreement review", jurisdictions: ["Belgium", "France"] }]);
  assert.equal(h.owner.caseEditor, null); assert.equal(h.read().revision, 5); assert.equal(h.read().status, "active");
  assert.equal(h.owner.draft("request-reason"), "Unrelated unsaved reason"); assert.equal(h.owner.getSnapshot().bundle?.matter.title, "Updated agreement review");
});

test("case editor retains unsaved fields through section navigation and unrelated draft cleanup", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My retained draft"); h.owner.navigate("outputs"); h.owner.clearDrafts(); h.owner.navigate("overview");
  assert.equal(h.owner.caseEditor?.values.title, "My retained draft"); assert.equal(h.owner.caseEditor?.revision, 4); assert.equal(h.owner.departureRisk(), "dirty");
  h.owner.reviewBeforeLeaving(); assert.equal(h.owner.getSnapshot().destination, "overview");
});

test("cancel asks before discarding, Keep editing preserves values, and confirmed discard sends no write", async () => {
  const h = await editing(); h.owner.editCaseField("priority", "urgent"); h.owner.cancelCaseEditor();
  assert.equal(h.owner.caseEditor?.discard, "close"); h.owner.keepCaseEdits(); assert.equal(h.owner.caseEditor?.values.priority, "urgent");
  h.owner.cancelCaseEditor(); h.owner.discardCaseEdits(); assert.equal(h.owner.caseEditor, null); assert.equal(h.writes.length, 0); assert.equal(h.owner.departureRisk(), "clear");
});

test("untouched cancel and whitespace-only save produce no revision", async () => {
  const h = await editing(); h.owner.cancelCaseEditor(); assert.equal(h.owner.caseEditor, null);
  h.owner.openCaseEditor(); h.owner.editCaseField("title", "  " + h.read().title + "  "); await h.owner.saveCaseDetails();
  assert.equal(h.writes.length, 0); assert.equal(h.read().revision, 4);
});

for (const [field, value] of [["title", " "], ["jurisdictions", Array.from({ length: 13 }, (_, i) => "Country " + i).join("\n")], ["jurisdictions", "x".repeat(101)], ["priority", "invalid"], ["classification", "invalid"]] as const) test(`invalid ${field} is retained without writing`, async () => {
  const h = await editing(); h.owner.editCaseField(field, value); await h.owner.saveCaseDetails();
  assert.equal(h.owner.caseEditor?.phase, "invalid"); assert.equal(h.owner.caseEditor?.values[field], value); assert.equal(h.writes.length, 0);
});

test("refresh never rebases a dirty editor onto a newer revision", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.change(); await h.owner.load(); await h.owner.saveCaseDetails();
  assert.equal(h.owner.caseEditor?.phase, "conflict"); assert.equal(h.owner.caseEditor?.revision, 4); assert.equal(h.owner.caseEditor?.values.title, "My draft"); assert.equal(h.writes.length, 0);
  h.owner.cancelCaseEditor("latest"); assert.equal(h.owner.caseEditor?.values.title, "My draft"); h.owner.discardCaseEdits();
  assert.equal(h.owner.caseEditor?.revision, 5); assert.equal(h.owner.caseEditor?.values.title, "Colleague's saved case name");
});

test("server conflict retains draft, reads latest details, and never auto-replays", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.conflict(); await h.owner.saveCaseDetails(); await h.owner.saveCaseDetails();
  assert.equal(h.owner.caseEditor?.phase, "conflict"); assert.equal(h.owner.caseEditor?.values.title, "My draft"); assert.equal(h.writes.length, 1);
  assert.equal(h.owner.getSnapshot().bundle?.matter.title, "Colleague's saved case name");
});

test("a committed save with a lost response is recovered by readback without a duplicate write", async () => {
  const h = await editing(); h.owner.editCaseField("title", "Recovered case"); h.lose("after"); await h.owner.saveCaseDetails();
  assert.equal(h.owner.caseEditor?.phase, "unconfirmed"); assert.equal(h.owner.departureRisk(), "pending");
  h.owner.editCaseField("title", "Must not replace submitted draft"); await h.owner.saveCaseDetails(); h.owner.cancelCaseEditor();
  assert.equal(h.owner.caseEditor?.values.title, "Recovered case"); assert.equal(h.owner.caseEditor?.discard, null);
  await h.owner.checkCaseDetailsSave(); assert.equal(h.owner.caseEditor, null); assert.equal(h.writes.length, 1); assert.equal(h.read().revision, 5);
  assert.match(h.owner.getSnapshot().notice, /match your edits/);
});

test("an uncommitted uncertain save can retry only after baseline readback", async () => {
  const h = await editing(); h.owner.editCaseField("priority", "high"); h.lose("before"); await h.owner.saveCaseDetails(); await h.owner.checkCaseDetailsSave();
  assert.equal(h.owner.caseEditor?.phase, "editing"); assert.equal(h.owner.caseEditor?.revision, 4); await h.owner.saveCaseDetails();
  assert.equal(h.writes.length, 2); assert.equal(h.read().revision, 5); assert.equal(h.owner.caseEditor, null);
});

test("readback with intervening changes retains the draft as a conflict", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.lose("after"); await h.owner.saveCaseDetails(); h.change(); await h.owner.checkCaseDetailsSave();
  assert.equal(h.owner.caseEditor?.phase, "conflict"); assert.equal(h.owner.caseEditor?.values.title, "My draft"); assert.equal(h.writes.length, 1);
});

test("failed recovery reads keep the original operation unresolved", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.lose("after"); await h.owner.saveCaseDetails(); h.failReads(); await h.owner.checkCaseDetailsSave();
  assert.equal(h.owner.caseEditor?.phase, "unconfirmed"); assert.equal(h.writes.length, 1);
});

test("double save and a late response after a case switch cannot update the new visit", async () => {
  const h = await editing(); let finish!: () => void; h.delay(() => new Promise(resolve => { finish = resolve; }));
  h.owner.editCaseField("title", "Old visit draft"); const pending = h.owner.saveCaseDetails(); await h.owner.saveCaseDetails();
  assert.equal(h.writes.length, 1); h.owner.enter("other-case"); finish(); await pending;
  assert.equal(h.owner.caseEditor, null); assert.equal(h.owner.getSnapshot().notice, ""); assert.equal(h.owner.getSnapshot().visit?.caseId, "other-case");
});

test("session expiry during save retains recoverable input and fences its late receipt", async () => {
  const h = await editing(); let finish!: () => void; h.delay(() => new Promise(resolve => { finish = resolve; }));
  h.owner.editCaseField("title", "Recover after sign-in"); const pending = h.owner.saveCaseDetails(); h.owner.suspendAuthority(); finish(); await pending;
  assert.equal(h.owner.getSnapshot().authority, "session_expired"); assert.equal(h.owner.caseEditor?.phase, "unconfirmed");
  await h.owner.load(); await h.owner.checkCaseDetailsSave(); assert.equal(h.owner.caseEditor, null); assert.equal(h.writes.length, 1);
});

test("read-only access refuses editor entry and retained drafts cannot bypass a role downgrade", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.readonly(); await h.owner.load();
  h.owner.editCaseField("title", "Blocked edit"); await h.owner.saveCaseDetails();
  assert.equal(h.owner.caseEditor?.values.title, "My draft"); assert.equal(h.writes.length, 0);
  h.owner.cancelCaseEditor(); h.owner.discardCaseEdits(); h.owner.openCaseEditor(); assert.equal(h.owner.caseEditor, null);
});

for (const reason of ["case", "account"] as const) test(`${reason} denial clears private editor data and prevents writes`, async () => {
  const h = await editing(); h.owner.editCaseField("title", "Private draft"); if (reason === "case") h.deny(); else h.changeAccount(); await h.owner.load(); await h.owner.saveCaseDetails();
  assert.equal(h.owner.caseEditor, null); assert.equal(h.owner.getSnapshot().bundle, null); assert.equal(h.writes.length, 0);
});

test("clean open editor adopts refreshed details without manufacturing a dirty draft", async () => {
  const h = await editing(); h.change(); await h.owner.load();
  assert.equal(h.owner.caseEditor?.values.title, "Colleague's saved case name"); assert.equal(h.owner.caseEditor?.revision, 5); assert.equal(h.owner.departureRisk(), "clear");
});

test("post-save read failure preserves the confirmed save and unrelated draft", async () => {
  const h = await editing(); h.owner.rememberDraft("notes", "Keep this", ""); h.owner.editCaseField("priority", "high"); h.failReads();
  assert.equal(await h.owner.saveCaseDetails(), true); assert.equal(h.owner.caseEditor, null); assert.equal(h.owner.draft("notes"), "Keep this");
  assert.match(h.owner.getSnapshot().notice, /saved.*Refresh/); assert.equal(h.read().revision, 5);
});

test("departure recovery prioritizes an unresolved work operation over a dirty case editor", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.owner.practice.pending = { operationKey: "synthetic-pending" };
  assert.equal(h.owner.departureRisk(), "pending"); h.owner.reviewBeforeLeaving(); assert.equal(h.owner.getSnapshot().destination, "tasks");
  assert.equal(h.owner.caseEditor?.values.title, "My draft");
});

test("departure lock and guarded catalogue entry preserve the active editor", async () => {
  const h = await editing(); h.owner.editCaseField("title", "My draft"); h.owner.setDepartureLocked(true); await h.owner.saveCaseDetails();
  assert.equal(h.writes.length, 0); h.owner.setDepartureLocked(false); assert.equal(h.owner.enterFromCatalogue("other-case"), false);
  assert.equal(h.owner.getSnapshot().visit?.caseId, "synthetic-case"); assert.equal(h.owner.caseEditor?.values.title, "My draft");
});
