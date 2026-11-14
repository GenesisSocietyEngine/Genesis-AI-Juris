import { billingCaseReturn, workspaceDestination } from "../app/workspace-navigation";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBillingEvent,
  billingState,
  type BillingRow,
} from "../app/billing/model";
test("EUR invoice, partial receipt, trust and reconciliation retain independent balances", () => {
  const rows: BillingRow[] = [];
  const add = (input: Record<string, unknown>) => {
    const event = buildBillingEvent(
      {
        description: "Synthetic entry",
        date: "2026-11-10",
        recipient: "Synthetic client",
        ...input,
      },
      rows,
    );
    rows.push({
      event,
      sequence: rows.length + 1,
      actorRef: "staff",
      createdAt: "2026-11-10",
    });
    return event;
  };
  assert.equal(
    add({ kind: "time", quantity: 25, rate: "100,01", billable: true }).cents,
    4167,
  );
  add({ kind: "expense", quantity: 3, rate: "4.10", billable: true });
  add({ kind: "expense", quantity: 1, rate: "99", billable: false });
  assert.throws(() =>
    add({ kind: "invoice", entries: [1, 1], due: "2026-12-01" }),
  );
  assert.equal(
    add({ kind: "invoice", entries: [1, 2], due: "2026-12-01" }).cents,
    5397,
  );
  assert.throws(() =>
    add({ kind: "invoice", entries: [1], due: "2026-12-01" }),
  );
  assert.throws(() => add({ kind: "void", target: 1 }));
  add({ kind: "payment", amount: "10.25", target: 4, reference: "BANK-1" });
  assert.throws(() =>
    add({ kind: "payment", amount: "99", target: 4, reference: "BANK-1" }),
  );
  add({ kind: "trust_deposit", amount: "200", reference: "BANK-2" });
  assert.throws(() =>
    add({ kind: "trust_withdrawal", amount: "201", reference: "BANK-3" }),
  );
  add({ kind: "trust_withdrawal", amount: "75.10", reference: "BANK-3" });
  add({ kind: "reconcile", target: 5, reference: "STATEMENT-1" });
  assert.throws(() =>
    add({ kind: "reconcile", target: 5, reference: "STATEMENT-1" }),
  );
  add({ kind: "plan", target: 4, due: "2026-12-01", installments: 3 });
  const state = billingState(rows);
  assert.equal(state.invoices[0].balance, 4372);
  assert.equal(state.trust, 12490);
  assert.equal(state.open.length, 0);
  assert.throws(() =>
    add({ kind: "expense", quantity: 1, rate: "1.001", billable: true }),
  );
  assert.throws(() =>
    add({ kind: "fund_request", date: "2026-02-30", amount: "1" }),
  );
});

test("billing journal migration rejects duplicate sequences, operation keys and missing case references", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { readFileSync } = await import("node:fs");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "PRAGMA foreign_keys=ON; CREATE TABLE organizations(id TEXT PRIMARY KEY); CREATE TABLE dossiers(id TEXT PRIMARY KEY); INSERT INTO organizations VALUES ('a'); INSERT INTO dossiers VALUES ('c'),('d');",
    );
    db.exec(readFileSync("drizzle/0036_practice_billing.sql", "utf8"));
    const add = db.prepare(
      "INSERT INTO billing_events VALUES ('a',?,?,?,'staff','hash','{}','2026-11-10')",
    );
    add.run("c", 1, "first");
    assert.throws(() => add.run("c", 1, "concurrent"));
    assert.throws(() => add.run("d", 1, "first"));
    assert.throws(() => add.run("missing", 1, "other"));
    add.run("d", 1, "second");
  } finally {
    db.close();
  }
});

test("installments use calendar months and sum to the exact invoice balance", async () => {
  const { installments } = await import("../app/billing/model");
  const schedule = installments({
    kind: "plan",
    currency: "EUR",
    date: "2026-01-01",
    description: "Test",
    cents: 1000,
    installments: 3,
    due: "2026-01-31",
  });
  assert.deepEqual(schedule, [
    { due: "2026-01-31", cents: 334 },
    { due: "2026-02-28", cents: 333 },
    { due: "2026-03-31", cents: 333 },
  ]);
});

test("Billing preserves an exact team case entry and keeps firm entry unselected", () => {
  for (const lang of ["en", "ru"] as const) {
    const path = "/matters?organization=org_a&dossier=case_a&collection=team&section=documents&target=document-b&lang=" + lang;
    const params = new URL(workspaceDestination("/billing", path), "https://test.invalid").searchParams;
    assert.equal(params.get("dossier"), "case_a");
    assert.equal(params.get("return_to"), path);
    assert.equal(billingCaseReturn(path, "case_a", "org_a", lang), path);
    assert.equal(billingCaseReturn(path, undefined, "org_a", lang), null);
    assert.equal(billingCaseReturn(path, "case_b", "org_a", lang), null);
    assert.equal(billingCaseReturn(path, "case_a", "org_b", lang), null);
    assert.equal(billingCaseReturn("//example.invalid/matters", "case_a", "org_a", lang), null);
    for (const from of ["/work?organization=org_a", path.replace("team", "personal")]) {
      assert.equal(new URL(workspaceDestination("/billing", from), "https://test.invalid").searchParams.has("dossier"), false);
    }
    assert.equal(new URL(workspaceDestination("/billing?organization=org_b", path), "https://test.invalid").searchParams.has("return_to"), false);
  }
});
