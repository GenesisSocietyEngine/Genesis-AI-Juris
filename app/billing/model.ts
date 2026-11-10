export const kinds = [
  "time",
  "expense",
  "invoice",
  "payment",
  "trust_deposit",
  "trust_withdrawal",
  "fund_request",
  "plan",
  "reconcile",
  "void",
] as const;
export type BillingKind = (typeof kinds)[number];
export type BillingEvent = {
  kind: BillingKind;
  date: string;
  description: string;
  cents: number;
  currency: "EUR";
  billable?: boolean;
  quantity?: number;
  rate?: number;
  entries?: number[];
  target?: number;
  due?: string;
  installments?: number;
  reference?: string;
  recipient?: string;
  receipt?: { id: string; title: string; version: string };
};
export type BillingRow = {
  sequence: number;
  event: BillingEvent;
  actorRef: string;
  createdAt: string;
};
export function money(cents: number, locale = "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
function amount(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,7}([.,]\d{1,2})?$/.test(value))
    throw Error("Enter a euro amount with up to two decimal places.");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
function integer(value: unknown, max: number) {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > max)
    throw Error("Enter a valid whole number.");
  return Number(value);
}
function date(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw Error("Enter a valid date.");
  return value;
}
function note(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 500)
    throw Error("Enter a description of up to 500 characters.");
  return value.trim();
}
export function billingState(rows: BillingRow[]) {
  const voided = new Set(
    rows.filter((r) => r.event.kind === "void").map((r) => r.event.target),
  );
  const active = rows.filter((r) => !voided.has(r.sequence));
  const billed = new Set(
    active.flatMap((r) =>
      r.event.kind === "invoice" ? (r.event.entries ?? []) : [],
    ),
  );
  const open = active.filter(
    (r) =>
      ["time", "expense"].includes(r.event.kind) &&
      r.event.billable &&
      !billed.has(r.sequence),
  );
  const reconciled = new Set(
    active
      .filter((r) => r.event.kind === "reconcile")
      .map((r) => r.event.target),
  );
  const invoices = active
    .filter((r) => r.event.kind === "invoice")
    .map((row) => ({
      ...row,
      balance:
        row.event.cents -
        active
          .filter(
            (r) =>
              r.event.kind === "payment" && r.event.target === row.sequence,
          )
          .reduce((n, r) => n + r.event.cents, 0),
    }));
  const trust = active.reduce(
    (n, r) =>
      n +
      (r.event.kind === "trust_deposit"
        ? r.event.cents
        : r.event.kind === "trust_withdrawal"
          ? -r.event.cents
          : 0),
    0,
  );
  return { active, open, invoices, reconciled, voided, trust };
}
export function buildBillingEvent(
  input: Record<string, unknown>,
  rows: BillingRow[],
): BillingEvent {
  const kind = input.kind as BillingKind;
  if (!kinds.includes(kind)) throw Error("Unknown billing operation.");
  const event: BillingEvent = {
    kind,
    date: date(input.date),
    description: note(input.description),
    cents: 0,
    currency: "EUR",
  };
  const state = billingState(rows);
  if (kind === "time" || kind === "expense") {
    if (typeof input.billable !== "boolean")
      throw Error("Choose whether this entry is billable.");
    const quantity = integer(input.quantity, kind === "time" ? 1440 : 10000),
      rate = amount(input.rate);
    const cents =
      kind === "time"
        ? Math.floor((quantity * rate + 30) / 60)
        : quantity * rate;
    return { ...event, quantity, rate, cents, billable: input.billable };
  }
  if (kind === "invoice") {
    if (
      !Array.isArray(input.entries) ||
      !input.entries.length ||
      input.entries.length > 250
    )
      throw Error("Select up to 250 unbilled entries.");
    const entries = input.entries.map((id) =>
      integer(id, Number.MAX_SAFE_INTEGER),
    );
    if (new Set(entries).size !== entries.length)
      throw Error("Duplicate invoice entry.");
    let cents = 0;
    for (const id of entries) {
      const row = state.open.find((r) => r.sequence === id);
      if (!row) throw Error("An entry is no longer available for invoicing.");
      if (row.event.date > event.date)
        throw Error("The invoice date precedes a selected entry.");
      cents += row.event.cents;
    }
    const due = date(input.due);
    if (due < event.date || cents <= 0)
      throw Error("Check the due date and invoice total.");
    return { ...event, entries, cents, due, recipient: note(input.recipient) };
  }
  if (
    kind === "trust_deposit" ||
    kind === "trust_withdrawal" ||
    kind === "fund_request" ||
    kind === "payment"
  ) {
    const cents = amount(input.amount);
    if (!cents || (kind === "trust_withdrawal" && cents > state.trust))
      throw Error("Check the amount and available balance.");
    if (
      (kind === "trust_deposit" || kind === "trust_withdrawal") &&
      state.active.some(
        (r) =>
          (r.event.kind === "trust_deposit" ||
            r.event.kind === "trust_withdrawal") &&
          r.event.date > event.date,
      )
    )
      throw Error("Record trust entries in statement date order.");
    if (kind === "payment") {
      const invoice = state.invoices.find((r) => r.sequence === input.target);
      if (
        !invoice ||
        cents > invoice.balance ||
        event.date < invoice.event.date
      )
        throw Error(
          "Choose an outstanding invoice and an amount within its balance.",
        );
      return {
        ...event,
        target: invoice.sequence,
        cents,
        reference: note(input.reference),
      };
    }
    return {
      ...event,
      cents,
      ...(kind === "fund_request" ? {} : { reference: note(input.reference) }),
    };
  }
  const target = state.active.find((r) => r.sequence === input.target);
  if (!target || event.date < target.event.date)
    throw Error("Select a current record and check the date.");
  if (kind === "reconcile") {
    if (
      !["trust_deposit", "trust_withdrawal", "payment"].includes(
        target.event.kind,
      ) ||
      state.reconciled.has(target.sequence)
    )
      throw Error("Select an unreconciled transaction.");
    return {
      ...event,
      target: target.sequence,
      reference: note(input.reference),
    };
  }
  if (kind === "plan") {
    const invoice = state.invoices.find((r) => r.sequence === target.sequence);
    const due = date(input.due);
    if (
      !invoice?.balance ||
      due < event.date ||
      state.active.some(
        (r) => r.event.kind === "plan" && r.event.target === target.sequence,
      )
    )
      throw Error("Choose an outstanding invoice without a current plan.");
    return {
      ...event,
      target: target.sequence,
      cents: invoice.balance,
      due,
      installments: integer(input.installments, Math.min(120, invoice.balance)),
    };
  }
  if (
    !state.open.some((r) => r.sequence === target.sequence) &&
    !(["time", "expense"].includes(target.event.kind) && !target.event.billable)
  )
    throw Error("Only unbilled entries can be voided.");
  return { ...event, target: target.sequence };
}

export function installments(event: BillingEvent) {
  if (event.kind !== "plan" || !event.installments || !event.due) return [];
  const first = new Date(event.due + "T00:00:00Z");
  const each = Math.floor(event.cents / event.installments),
    remainder = event.cents % event.installments;
  return Array.from({ length: event.installments }, (_, index) => {
    const year = first.getUTCFullYear(),
      month = first.getUTCMonth() + index;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const due = new Date(
      Date.UTC(year, month, Math.min(first.getUTCDate(), last)),
    )
      .toISOString()
      .slice(0, 10);
    return { due, cents: each + (index < remainder ? 1 : 0) };
  });
}
