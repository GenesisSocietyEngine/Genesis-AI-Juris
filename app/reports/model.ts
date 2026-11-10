import { billingState, type BillingRow } from "../billing/model";
import type { Contact } from "../contacts/contact-model";
import type { PracticePlan } from "../matters/practice-plan";

export const categories = {
  financial: ["Financial reports", "Финансовые отчёты"],
  cases: ["Case and contact reports", "Дела и контакты"],
  productivity: ["Productivity reports", "Продуктивность"],
  leads: ["Leads reports", "Потенциальные клиенты"],
} as const;
export const fields = {
  matter: ["Case", "Дело"],
  reference: ["Case number", "Номер дела"],
  name: ["Name", "Название"],
  user: ["User", "Сотрудник"],
  status: ["Status", "Статус"],
  date: ["Date", "Дата"],
  end: ["End", "Окончание"],
  due: ["Due date", "Срок оплаты"],
  age: ["Days overdue", "Дни просрочки"],
  bracket: ["Age bracket", "Интервал"],
  billed: ["Billed (EUR)", "Выставлено (EUR)"],
  paid: ["Collected (EUR)", "Получено (EUR)"],
  balance: ["Outstanding (EUR)", "К оплате (EUR)"],
  amount: ["Amount (EUR)", "Сумма (EUR)"],
  minutes: ["Minutes", "Минуты"],
  expenses: ["Expenses (EUR)", "Расходы (EUR)"],
  unbilled: ["Unbilled (EUR)", "К выставлению (EUR)"],
  trust: ["Trust balance (EUR)", "Доверительный остаток (EUR)"],
  email: ["Email", "Эл. почта"],
  group: ["Group", "Группа"],
  source: ["Referral source", "Источник обращения"],
  forecast: ["Estimated value (EUR)", "Оценка (EUR)"],
  stage: ["Lead stage", "Этап обращения"],
  type: ["Type", "Тип"],
  days: ["Days unbilled", "Дней без счёта"],
  count: ["Count", "Количество"],
  recipient: ["Recipient", "Получатель"],
  description: ["Description", "Описание"],
} as const;
export type Field = keyof typeof fields;
type Spec = {
  group: keyof typeof categories;
  title: [string, string];
  columns: Field[];
  source: "billing" | "contacts" | "work";
};
export const reports = {
  aging: {
    group: "financial",
    title: ["Aging invoices", "Просрочка по счетам"],
    columns: [
      "matter",
      "name",
      "recipient",
      "due",
      "age",
      "bracket",
      "balance",
    ],
    source: "billing",
  },
  receivables: {
    group: "financial",
    title: ["Accounts receivable", "Дебиторская задолженность"],
    columns: [
      "matter",
      "recipient",
      "name",
      "date",
      "due",
      "billed",
      "paid",
      "balance",
    ],
    source: "billing",
  },
  balances: {
    group: "financial",
    title: ["Case balance summary", "Остатки по делам"],
    columns: ["matter", "billed", "paid", "balance", "unbilled", "trust"],
    source: "billing",
  },
  revenue: {
    group: "financial",
    title: ["Case revenue", "Выручка по делам"],
    columns: ["matter", "billed", "paid", "expenses", "minutes"],
    source: "billing",
  },
  fees: {
    group: "financial",
    title: ["Fee allocation", "Распределение гонораров"],
    columns: ["matter", "name", "user", "billed", "paid"],
    source: "billing",
  },
  trustSummary: {
    group: "financial",
    title: ["Trust account summary", "Доверительные остатки"],
    columns: ["matter", "trust"],
    source: "billing",
  },
  trustActivity: {
    group: "financial",
    title: ["Trust account activity", "Доверительные операции"],
    columns: ["matter", "date", "description", "type", "amount", "trust"],
    source: "billing",
  },
  cases: {
    group: "cases",
    title: ["Case list report", "Реестр дел"],
    columns: ["matter", "reference", "status", "date"],
    source: "work",
  },
  contacts: {
    group: "cases",
    title: ["Contact report", "Контакты"],
    columns: ["name", "email", "group", "type", "status"],
    source: "contacts",
  },
  limitations: {
    group: "cases",
    title: ["Statute of limitations", "Сроки исковой давности"],
    columns: ["matter", "name", "date", "status"],
    source: "work",
  },
  userTime: {
    group: "productivity",
    title: ["User time and expenses", "Время и расходы сотрудника"],
    columns: [
      "user",
      "matter",
      "date",
      "description",
      "type",
      "minutes",
      "amount",
      "status",
    ],
    source: "billing",
  },
  firmTime: {
    group: "productivity",
    title: ["Firm time and expenses", "Время и расходы фирмы"],
    columns: ["user", "minutes", "expenses", "amount"],
    source: "billing",
  },
  caseTime: {
    group: "productivity",
    title: ["Case time and expenses", "Время и расходы по делам"],
    columns: ["matter", "minutes", "expenses", "amount"],
    source: "billing",
  },
  events: {
    group: "productivity",
    title: ["Events", "События"],
    columns: ["matter", "name", "date", "end", "description", "status"],
    source: "work",
  },
  wip: {
    group: "productivity",
    title: ["Work in progress", "Незавершённая работа"],
    columns: ["matter", "name", "date", "days", "user", "unbilled"],
    source: "billing",
  },
  consultations: {
    group: "leads",
    title: ["Consultation fee revenue", "Доход от консультаций"],
    columns: ["matter", "recipient", "name", "billed", "paid"],
    source: "billing",
  },
  referrals: {
    group: "leads",
    title: ["Leads referral source", "Источники обращений"],
    columns: ["source", "name", "stage", "status"],
    source: "contacts",
  },
  pipeline: {
    group: "leads",
    title: ["Leads forecasted pipeline value", "Прогноз стоимости обращений"],
    columns: ["stage", "name", "source", "forecast"],
    source: "contacts",
  },
} satisfies Record<string, Spec>;
export type Report = keyof typeof reports;
export type Row = Partial<Record<Field, string | number>>;
export type WorkCase = {
  id: string;
  title: string;
  reference: string;
  status: string;
  createdAt: string;
  plan: PracticePlan;
};
export type Period = { from: string; to: string };
const day = (date: string) =>
  Date.parse(date.slice(0, 10) + "T00:00:00Z") / 86400000;
const sum = (rows: BillingRow[]) => rows.reduce((n, r) => n + r.event.cents, 0);
export const inPeriod = (date: string, p: Period) =>
  (!p.from || date.slice(0, 10) >= p.from) &&
  (!p.to || date.slice(0, 10) <= p.to);
export function contactRows(report: Report, contacts: Contact[]): Row[] {
  return contacts
    .filter(
      (c) =>
        report === "contacts" ||
        (c.relationship === "prospect" &&
          (report !== "pipeline" ||
            (c.status === "active" && c.leadStage !== "not_pursuing"))),
    )
    .map((c) => ({
      name: c.name,
      email: c.email,
      group: c.group,
      type: c.kind,
      status: c.status,
      source: c.referralSource || "",
      stage: c.leadStage || "",
      ...(c.forecastEUR
        ? { forecast: Number(c.forecastEUR.replace(",", ".")) }
        : {}),
    }));
}
export function workRows(report: Report, c: WorkCase, p: Period): Row[] {
  if (report === "cases")
    return inPeriod(c.createdAt, p)
      ? [
          {
            matter: c.title,
            reference: c.reference,
            status: c.status,
            date: c.createdAt.slice(0, 10),
          },
        ]
      : [];
  return c.plan.items
    .filter(
      (i) =>
        (report === "events" ? i.kind === "event" : i.limitation) &&
        i.dueDate &&
        inPeriod(i.dueDate, p),
    )
    .map((i) => ({
      matter: c.title,
      name: i.title,
      date: i.timing?.start.local ?? i.dueDate ?? "",
      end: i.timing?.end.local ?? "",
      description: i.description,
      status: i.status,
    }));
}
// Distribute collected cents by invoice line value, including expenses in the denominator.
// Largest remainders break ties in immutable invoice-line order.
function shares(lines: BillingRow[], collected: number, total: number) {
  if (!total) return lines.map(() => 0);
  const values = lines.map((line, i) => {
    const scaled = BigInt(line.event.cents) * BigInt(collected);
    return {
      i,
      cents: Number(scaled / BigInt(total)),
      rest: scaled % BigInt(total),
    };
  });
  const remaining = collected - values.reduce((n, v) => n + v.cents, 0);
  const ranked = [...values].sort((a, b) =>
    a.rest === b.rest ? a.i - b.i : a.rest > b.rest ? -1 : 1,
  );
  ranked.slice(0, remaining).forEach((v) => v.cents++);
  return values.map((v) => v.cents);
}
export function billingRows(
  report: Report,
  matter: string,
  rows: BillingRow[],
  p: Period,
  today: string,
): Row[] {
  const asOf = p.to || today;
  const s = billingState(rows.filter((r) => r.event.date <= asOf));
  const inRange = (r: BillingRow) => inPeriod(r.event.date, p);
  const entries = s.active.filter(
    (r) => ["time", "expense"].includes(r.event.kind) && inRange(r),
  );
  const invoices = s.invoices,
    payments = s.active.filter((r) => r.event.kind === "payment");
  const invoiceName = (r: BillingRow) =>
    "#" + r.sequence + " " + r.event.description;
  const billed = sum(invoices),
    paid = sum(payments);
  switch (report) {
    case "aging":
    case "receivables":
      return invoices
        .filter((r) => r.balance > 0 && (!p.from || r.event.date >= p.from))
        .map((r) => {
          const age = Math.max(0, day(asOf) - day(r.event.due!));
          return {
            matter,
            name: invoiceName(r),
            recipient: r.event.recipient,
            date: r.event.date,
            due: r.event.due,
            age,
            bracket:
              age === 0
                ? "0"
                : age <= 30
                  ? "1–30"
                  : age <= 60
                    ? "31–60"
                    : age <= 90
                      ? "61–90"
                      : "91+",
            billed: r.event.cents / 100,
            paid: (r.event.cents - r.balance) / 100,
            balance: r.balance / 100,
          };
        });
    case "balances":
      return [
        {
          matter,
          billed: billed / 100,
          paid: paid / 100,
          balance: (billed - paid) / 100,
          unbilled: sum(s.open) / 100,
          trust: s.trust / 100,
        },
      ];
    case "trustSummary":
      return [{ matter, trust: s.trust / 100 }];
    case "trustActivity": {
      let balance = 0;
      return s.active
        .filter((r) => r.event.kind.startsWith("trust_"))
        .sort(
          (a, b) =>
            a.event.date.localeCompare(b.event.date) || a.sequence - b.sequence,
        )
        .flatMap((r) => {
          const amount =
            r.event.cents * (r.event.kind === "trust_deposit" ? 1 : -1);
          balance += amount;
          return inRange(r)
            ? [
                {
                  matter,
                  date: r.event.date,
                  description: r.event.description,
                  type: r.event.kind,
                  amount: amount / 100,
                  trust: balance / 100,
                },
              ]
            : [];
        });
    }
    case "revenue":
      return [
        {
          matter,
          billed: sum(invoices.filter(inRange)) / 100,
          paid: sum(payments.filter(inRange)) / 100,
          expenses:
            sum(entries.filter((r) => r.event.kind === "expense")) / 100,
          minutes: entries
            .filter((r) => r.event.kind === "time")
            .reduce((n, r) => n + (r.event.quantity ?? 0), 0),
        },
      ];
    case "consultations":
      return invoices
        .filter((r) => r.event.consultation)
        .flatMap((r) => {
          const collected = sum(
            payments.filter(
              (payment) =>
                payment.event.target === r.sequence && inRange(payment),
            ),
          );
          return inRange(r) || collected
            ? [
                {
                  matter,
                  name: invoiceName(r),
                  recipient: r.event.recipient,
                  billed: inRange(r) ? r.event.cents / 100 : 0,
                  paid: collected / 100,
                },
              ]
            : [];
        });
    case "fees":
      return invoices.filter(inRange).flatMap((r) => {
        const lines = (r.event.entries ?? []).map((id) => {
          const line = rows.find((entry) => entry.sequence === id);
          if (!line) throw Error("Incomplete invoice lines");
          return line;
        });
        const portions = shares(
          lines,
          r.event.cents - r.balance,
          r.event.cents,
        );
        return lines.flatMap((line, i) =>
          line.event.kind === "time"
            ? [
                {
                  matter,
                  name: invoiceName(r),
                  user: line.actorRef,
                  billed: line.event.cents / 100,
                  paid: portions[i] / 100,
                },
              ]
            : [],
        );
      });
    case "wip":
      return s.open
        .filter(inRange)
        .map((r) => ({
          matter,
          name: r.event.description,
          date: r.event.date,
          days: day(asOf) - day(r.event.date),
          user: r.actorRef,
          unbilled: r.event.cents / 100,
        }));
    default:
      return entries.map((r) => ({
        matter,
        user: r.actorRef,
        date: r.event.date,
        description: r.event.description,
        type: r.event.kind,
        minutes: r.event.kind === "time" ? r.event.quantity : 0,
        amount: r.event.cents / 100,
        expenses: r.event.kind === "expense" ? r.event.cents / 100 : 0,
        status: r.event.billable ? "billable" : "non-billable",
      }));
  }
}
export function summarize(rows: Row[], key: Field, columns: Field[]): Row[] {
  const groups = new Map<string | number, Row>();
  for (const row of rows) {
    const label = row[key] ?? "";
    const total = groups.get(label) ?? { [key]: label, count: 0 };
    total.count = Number(total.count) + 1;
    for (const f of columns)
      if (f !== key && f !== "count" && typeof row[f] === "number")
        total[f] =
          Math.round((Number(total[f] ?? 0) + Number(row[f])) * 100) / 100;
    groups.set(label, total);
  }
  return [...groups.values()];
}
