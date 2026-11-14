import assert from "node:assert/strict";
import test from "node:test";
import {
  billingRows,
  contactRows,
  workRows,
  reports,
} from "../app/reports/model";
import { csv, defaults, present, validConfig } from "../app/reports/config";
import { buildBillingEvent, type BillingRow } from "../app/billing/model";
import { blankContact } from "../app/contacts/contact-model";
test("report catalog excludes accounting and all eighteen configurations validate", () => {
  assert.equal(Object.keys(reports).length, 18);
  for (const key of Object.keys(reports) as (keyof typeof reports)[])
    assert.equal(validConfig(defaults(key)), true);
  assert.equal(validConfig({ ...defaults("cases"), columns: ["paid"] }), false);
});
test("partial payments, aging, consultation fees and proportional fee shares", () => {
  const ledger: BillingRow[] = [];
  for (const input of [
    { kind: "time", quantity: 60, rate: "1", billable: true },
    { kind: "expense", quantity: 1, rate: "1", billable: true },
    {
      kind: "invoice",
      entries: [1, 2],
      recipient: "Client",
      due: "2026-01-15",
      consultation: "on",
    },
    { kind: "payment", target: 3, amount: "0.51", reference: "settled" },
  ]) {
    const event = buildBillingEvent(
      { ...input, description: "Synthetic", date: "2026-01-01" },
      ledger,
    );
    ledger.push({
      sequence: ledger.length + 1,
      event,
      actorRef: "A",
      createdAt: event.date,
    });
  }
  const run = (report: keyof typeof reports) =>
    billingRows(
      report,
      "Case",
      ledger,
      { from: "", to: "2026-02-01" },
      "2026-02-01",
    )[0];
  assert.equal(run("aging").balance, 1.49);
  assert.equal(run("aging").age, 17);
  assert.equal(run("fees").paid, 0.26);
  assert.equal(run("consultations").paid, 0.51);
  assert.equal(run("balances").unbilled, 0);
  assert.equal(run("trustSummary").trust, 0);
});
test("unknown values remain distinct from zero and exports escape spreadsheet formulas", () => {
  const contact = {
    ...blankContact("person"),
    id: "p",
    name: "=unsafe",
    status: "active" as const,
    relationship: "prospect" as const,
    revision: 1,
    caseIds: [],
  };
  const rows = contactRows("pipeline", [
    contact,
    { ...contact, forecastEUR: "0" },
  ]);
  assert.equal(rows[0].forecast, undefined);
  assert.equal(rows[1].forecast, 0);
  const cfg = {
    ...defaults("pipeline"),
    calculate: "forecast" as const,
    group: "stage" as const,
  };
  assert.equal(present(rows, cfg, "en").total, 0);
  assert.equal(present(rows.slice(0, 1), cfg, "en").total, null);
  assert.match(csv(rows, ["name", "forecast"], 0), /"'=unsafe",""/);
});
test("limitations only use explicitly classified case records", () => {
  const item = {
    kind: "event" as const,
    id: "a",
    title: "Hearing",
    description: "",
    dueDate: "2026-04-01",
    assignee: null,
    priority: "normal" as const,
    status: "open" as const,
    checklist: [],
    workflow: null,
  };
  const c = {
    id: "c",
    title: "Case",
    status: "active",
    reference: "C",
    createdAt: "2026-01-01",
    plan: {
      revision: 1,
      items: [item, { ...item, id: "b", title: "Filing", limitation: true }],
    },
  };
  assert.equal(workRows("events", c, { from: "", to: "" }).length, 2);
  assert.deepEqual(
    workRows("limitations", c, { from: "", to: "" }).map((r) => r.name),
    ["Filing"],
  );
});

test("lead stage labels follow the directory in results, saved filters, groups and exports", () => {
  const rows = [{ stage: "consultation", name: "consultation" }];
  const cfg = { ...defaults("pipeline"), filter: "stage" as const };
  for (const [locale, text] of [["en", "Consultation"], ["ru", "Консультация"]] as const) {
    const view = present(rows, { ...cfg, query: text }, locale);
    assert.deepEqual(view.rows, [{ stage: text, name: "consultation" }]);
    const grouped = present(rows, { ...cfg, group: "stage", query: "consultation" }, locale);
    assert.equal(grouped.rows[0].stage, text);
    assert.ok(csv(grouped.rows, grouped.columns, locale === "en" ? 0 : 1).includes(text));
  }
  assert.equal(rows[0].stage, "consultation");
});
