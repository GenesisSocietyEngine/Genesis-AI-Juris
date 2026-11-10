import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { feedQuery, type Filter } from "../app/activity/feed";

test("activity respects grants, filters before pagination, and retains actual work edits and deletions", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE dossiers(id,title);
    CREATE TABLE dossier_organization_bindings(dossier_id,organization_id);
    CREATE TABLE dossier_participants(dossier_id,user_id,actor_id,status,role);
    CREATE TABLE dossier_practice_revisions(dossier_id,revision,actor_ref,occurred_at,plan);
    CREATE TABLE organization_work_revisions(organization_id,revision,actor_ref,occurred_at,plan);
    CREATE TABLE dossier_audit_events(id,occurred_at,actor_ref,event_type,object_ref_type,object_ref_id,dossier_id);
    CREATE TABLE dossier_working_note_versions(id,occurred_at,actor_ref,action,title,dossier_id);
    CREATE TABLE dossier_documents(id,dossier_id,title,is_provisional);
    CREATE TABLE dossier_document_versions(id,dossier_id,document_id);
    CREATE TABLE billing_events(case_id,sequence,created_at,actor_ref,event,organization_id);
    CREATE TABLE firm_document_versions(document_id,version,occurred_at,actor_ref,title,organization_id);
    CREATE TABLE users(actor_id,display_name);
    INSERT INTO users VALUES ('a','Member');
    INSERT INTO dossiers VALUES ('c','Case'),('v','Viewer case'),('x','Private case');
    INSERT INTO dossier_organization_bindings VALUES ('c','org'),('v','org'),('x','other');
    INSERT INTO dossier_participants VALUES ('c',1,'a','active','owner'),('v',1,'a','active','viewer'),('x',1,'a','active','owner');
    INSERT INTO billing_events SELECT id,1,'2026-11-01','a','{"kind":"invoice","description":"Invoice"}',CASE WHEN id='x' THEN 'other' ELSE 'org' END FROM dossiers;
    INSERT INTO dossier_working_note_versions SELECT id,'2026-11-01','a','create','Note',id FROM dossiers;
    INSERT INTO firm_document_versions VALUES ('f',1,'2026-11-01','a','Firm file','org'),('x',1,'2026-11-01','a','Foreign file','other');
  `);
  try {
    const plan = db.prepare(
      "INSERT INTO organization_work_revisions VALUES ('org',?,'a','2026-11-01',?)",
    );
    const task = { id: "t", title: "Draft", kind: "task" },
      event = { id: "e", title: "Meeting", kind: "event" };
    [[task, event], [{ ...task, title: "Draft 2" }, event], [event]].forEach(
      (items, i) => plan.run(i + 1, JSON.stringify({ items })),
    );
    const read = (filter: Filter = "all", stamp = "", id = "", limit = 50) => {
      const query = new SQLiteSyncDialect().sqlToQuery(
        feedQuery("org", 1, "a", filter, stamp, id, limit),
      );
      return db.prepare(query.sql).all(...(query.params as SQLInputValue[]));
    };
    assert.deepEqual(
      read("deleted").map((r) => [r.action, r.subject]),
      [["deleted_task", "Draft 2"]],
    );
    assert.deepEqual(
      read("task").map((r) => r.action),
      ["updated_task", "added_task"],
    );
    assert.equal(read("event").length, 1);
    assert.deepEqual(
      read("invoice").map((r) => r.caseId),
      ["c"],
    );
    assert.deepEqual(
      read("document").map((r) => r.subject),
      ["Firm file"],
    );
    const all = read(),
      first = read("all", "", "", 3),
      last = first[2];
    assert.equal(all.length, 8);
    assert.deepEqual(
      [...first, ...read("all", String(last.stamp), String(last.id))],
      all,
    );
    db.exec(
      "UPDATE dossier_participants SET status='removed' WHERE dossier_id='c'",
    );
    assert.equal(
      read().some((r) => r.caseId === "c"),
      false,
    );
  } finally {
    db.close();
  }
});
