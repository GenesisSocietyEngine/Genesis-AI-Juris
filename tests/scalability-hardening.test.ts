import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { LatestRequestGate } from "../app/latest-request";
import { STUDIO_AI_PROVIDER_CONTEXT_LIMIT, studioAIProviderContextBytes } from "../app/studio-ai-provider-context";
import type { StudioDraft } from "../app/types";

const at = "2026-08-23T12:00:00.000Z";

function draftWithDetails(nodeCount: number, detailLength: number): StudioDraft {
  return {
    caseId: "ai_capacity_test",
    version: "1.0.0",
    parent: null,
    title: "AI capacity test",
    jurisdiction: "Test",
    role: "Counsel",
    premise: "A bounded authoring context.",
    classification: { domain: "general", practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true },
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `fact-${index + 1}`,
      type: "fact" as const,
      title: `Fact ${index + 1}`,
      detail: "x".repeat(detailLength),
      x: index * 10,
      y: index * 10,
    })),
    links: [],
    editHistory: [],
    updatedAt: at,
  };
}

test("AI provider context has an independent 128 KB budget", () => {
  const small = studioAIProviderContextBytes({ draft: draftWithDetails(4, 500), instruction: "Improve the graph.", locale: "en" });
  const large = studioAIProviderContextBytes({ draft: draftWithDetails(34, 4_000), instruction: "Improve the graph.", locale: "en" });
  assert.ok(small < STUDIO_AI_PROVIDER_CONTEXT_LIMIT);
  assert.ok(large > STUDIO_AI_PROVIDER_CONTEXT_LIMIT);

  const route = readFileSync(new URL("../app/api/studio/ai-plan/route.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../app/studio-ai-server.ts", import.meta.url), "utf8");
  assert.match(route, /ai_context_too_large/);
  assert.match(route, /}, 413\)/);
  assert.match(server, /max_output_tokens:\s*6_000/);
  assert.doesNotMatch(route, /detail:\s*\{[^}]*instruction/, "audit detail must not retain the author prompt");
  assert.match(route, /inputTokens:/);
  assert.match(route, /latencyMs:/);
});

test("tenant AI lease migration stores only pseudonymous, expiring capacity metadata", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0009_medical_princess_powerful.sql", import.meta.url), "utf8"));
  const columns = (db.prepare("PRAGMA table_info(studio_ai_leases)").all() as Array<{ name: string }>).map((column) => column.name);
  assert.deepEqual(columns, ["id", "subject_hash", "created_at", "expires_at"]);

  const acquire = db.prepare(`
    INSERT INTO studio_ai_leases (id, subject_hash, created_at, expires_at)
    SELECT ?, ?, ?, ?
    WHERE (SELECT count(*) FROM studio_ai_leases WHERE expires_at > ?) < 8
  `);
  const now = "2026-08-23T12:00:00.000Z";
  const expires = "2026-08-23T12:01:00.000Z";
  for (let index = 0; index < 8; index += 1) {
    assert.equal(acquire.run(`lease-${index}`, `subject-${index}`, now, expires, now).changes, 1);
  }
  assert.equal(acquire.run("lease-blocked", "subject-blocked", now, expires, now).changes, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM studio_ai_leases").get()?.count, 8);

  db.prepare("DELETE FROM studio_ai_leases WHERE expires_at <= ?").run(expires);
  assert.equal(acquire.run("lease-after-ttl", "subject-new", expires, "2026-08-23T12:02:00.000Z", expires).changes, 1);
});

test("latest-request gate aborts and invalidates stale catalogue responses", () => {
  const gate = new LatestRequestGate();
  const first = gate.start();
  const second = gate.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.finish(first);
  assert.equal(gate.isCurrent(second), true, "finishing an old request must not clear the current owner");
  gate.abort();
  assert.equal(second.signal.aborted, true);
  assert.equal(gate.isCurrent(second), false);

  const app = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(app, /catalogueRequestGateRef\.current\.start\(\)/);
  assert.match(app, /signal:\s*requestTicket\.signal/);
  assert.ok((app.match(/isCurrent\(requestTicket\)/g) ?? []).length >= 3);
});

test("guarded share cannot revive a grant after Private revocation", () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of [
    "0000_worthless_supreme_intelligence.sql",
    "0001_right_talon.sql",
    "0002_greedy_darkstar.sql",
    "0003_unusual_zarda.sql",
    "0004_petite_komodo.sql",
  ]) db.exec(readFileSync(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));

  const customCaseId = Number(db.prepare(`
    INSERT INTO custom_cases (owner_email, case_id, title, current_version, fingerprint)
    VALUES ('owner@example.com', 'race_case', 'Race case', '1.0.0', 'race-fingerprint')
  `).run().lastInsertRowid);
  // The sharing request observed Restricted, but the privacy transaction wins
  // before its guarded batch starts.
  db.prepare("UPDATE custom_cases SET is_private = true WHERE id = ?").run(customCaseId);
  db.prepare("DELETE FROM custom_case_grants WHERE custom_case_id = ?").run(customCaseId);

  assert.throws(() => {
    db.exec("BEGIN");
    try {
      db.prepare(`
        INSERT INTO custom_case_grants (custom_case_id, recipient_email, granted_by_email, can_reshare, created_at)
        SELECT id, 'recipient@example.com', 'owner@example.com', false, ?
        FROM custom_cases WHERE id = ? AND is_private = false
        ON CONFLICT(custom_case_id, recipient_email) DO UPDATE SET granted_by_email = excluded.granted_by_email
      `).run(at, customCaseId);
      db.prepare(`
        INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail)
        VALUES ('owner@example.com', 'custom_case_shared', 'custom_case', (
          SELECT CAST(id AS TEXT) FROM custom_cases
          WHERE id = ? AND is_private = false
            AND EXISTS (
              SELECT 1 FROM custom_case_grants
              WHERE custom_case_id = ? AND recipient_email = 'recipient@example.com'
            )
        ), '{}')
      `).run(customCaseId, customCaseId);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }, /NOT NULL/);
  assert.equal(db.prepare("SELECT count(*) AS count FROM custom_case_grants WHERE custom_case_id = ?").get(customCaseId)?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM audit_events WHERE event_type = 'custom_case_shared'").get()?.count, 0);

  const route = readFileSync(new URL("../app/api/custom-cases/route.ts", import.meta.url), "utf8");
  assert.match(route, /const grantWrite = db\.insert\(customCaseGrants\)\.select/);
  assert.match(route, /objectId: confirmedCaseId/);
  assert.match(route, /objectId is NOT NULL/);
});
