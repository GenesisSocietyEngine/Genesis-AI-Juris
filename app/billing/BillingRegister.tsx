import { useState } from "react";
import type { BillingRow } from "./model";
import { billingState, money, installments } from "./model";
import { names } from "./copy";

export function BillingRegister({
  rows,
  locale,
}: {
  rows: BillingRow[];
  locale: "en" | "ru";
}) {
  const t = (en: string, ru: string) => (locale === "en" ? en : ru),
    lang = locale === "en" ? 0 : 1;
  const state = billingState(rows);
  const [register, setRegister] = useState("all"),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState("");
  const groups: Record<string, string[]> = {
    all: [],
    time: ["time"],
    expense: ["expense"],
    invoice: ["invoice"],
    payment: ["payment"],
    fund_request: ["fund_request"],
    plan: ["plan"],
    trust: ["trust_deposit", "trust_withdrawal"],
    reconcile: ["reconcile"],
    void: ["void"],
  };
  const filtered = rows.filter(
    (r) =>
      (register === "all" || groups[register].includes(r.event.kind)) &&
      (!from || r.event.date >= from) &&
      (!until || r.event.date <= until),
  );
  const minutes = filtered
    .filter((r) => r.event.kind === "time" && !state.voided.has(r.sequence))
    .reduce((total, r) => total + (r.event.quantity ?? 0), 0);
  const dates = new Map<string, { billable: number; nonbillable: number }>();
  let issued = 0,
    received = 0;
  for (const row of state.active) {
    const e = row.event;
    if ((from && e.date < from) || (until && e.date > until)) continue;
    if (e.kind === "invoice") issued += e.cents;
    if (e.kind === "payment") received += e.cents;
    if (e.kind === "time") {
      const day = dates.get(e.date) ?? { billable: 0, nonbillable: 0 };
      day[e.billable ? "billable" : "nonbillable"] += e.quantity ?? 0;
      dates.set(e.date, day);
    }
  }
  return (
    <section>
      <h2>{t("Case statement", "Выписка по делу")}</h2>
      {state.invoices.map((invoice) => (
        <details key={invoice.sequence}>
          <summary>
            #{invoice.sequence} · {invoice.event.description} ·{" "}
            {t("Outstanding", "К оплате")} {money(invoice.balance, locale)}
          </summary>
          <p>
            {t("Bill to", "Получатель счёта")} {invoice.event.recipient} ·{" "}
            {t("Issued", "Выставлен")} {invoice.event.date} ·{" "}
            {t("Due", "Срок оплаты")} {invoice.event.due}
          </p>
          <ul>
            {invoice.event.entries?.map((id) => {
              const entry = rows.find((r) => r.sequence === id);
              return (
                entry && (
                  <li key={id}>
                    {entry.event.description} ·{" "}
                    {money(entry.event.cents, locale)}
                  </li>
                )
              );
            })}
          </ul>
          <strong>
            {t("Invoice total", "Сумма счёта")}{" "}
            {money(invoice.event.cents, locale)}
          </strong>
        </details>
      ))}
      <h2>{t("Activity", "Операции")}</h2>
      <label>
        {t("Register", "Реестр")}
        <select value={register} onChange={(e) => setRegister(e.target.value)}>
          {Object.keys(groups).map((key) => (
            <option key={key} value={key}>
              {key === "all"
                ? t("All activity", "Все операции")
                : key === "trust"
                  ? t("Trust accounting", "Клиентские средства")
                  : names[key as keyof typeof names][lang]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("From", "С даты")}
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        {t("Through", "По дату")}
        <input
          type="date"
          value={until}
          min={from}
          onChange={(e) => setUntil(e.target.value)}
        />
      </label>
      <details>
        <summary>
          {t(
            "Billed and collected for the period",
            "Выставлено и получено за период",
          )}
        </summary>
        <p>
          {t("Billed", "Выставлено")} {money(issued, locale)} ·{" "}
          {t("Collected", "Получено")} {money(received, locale)}
        </p>
      </details>
      <details>
        <summary>{t("Daily timesheet", "Табель по дням")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("Date", "Дата")}</th>
              <th>{t("Billable minutes", "Оплачиваемые минуты")}</th>
              <th>{t("Non-billable minutes", "Неоплачиваемые минуты")}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(dates)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, value]) => (
                <tr key={day}>
                  <th scope="row">{day}</th>
                  <td>{value.billable}</td>
                  <td>{value.nonbillable}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
      {register === "time" && (
        <p>
          {t("Recorded time", "Учтённое время")} · {Math.floor(minutes / 60)} h{" "}
          {minutes % 60} min
        </p>
      )}
      {filtered.length === 0 ? (
        <p>
          {t("No billing entries for this case.", "По делу пока нет записей.")}
        </p>
      ) : (
        <ul>
          {filtered
            .slice()
            .reverse()
            .map(({ event: e, sequence }) => (
              <li key={sequence}>
                <strong>
                  #{sequence} · {names[e.kind][lang]}
                </strong>{" "}
                · {e.date} · {e.description}
                {e.target && <> · #{e.target}</>}
                {e.quantity && (
                  <>
                    {" "}
                    · {e.quantity}{" "}
                    {e.kind === "time" ? t("min", "мин") : t("units", "ед.")} ×{" "}
                    {money(e.rate!, locale)}
                    {e.kind === "time" ? t("/hour", "/ч") : ""}
                  </>
                )}
                {e.billable === false && (
                  <> · {t("Non-billable", "Не выставляется")}</>
                )}
                {e.cents > 0 && <> · {money(e.cents, locale)}</>}
                {e.reference && <> · {e.reference}</>}
                {state.voided.has(sequence) && (
                  <> · {t("Voided", "Отменено")}</>
                )}
                {state.reconciled.has(sequence) && (
                  <> · {t("Reconciled", "Сверено")}</>
                )}
                {e.kind === "plan" && (
                  <>
                    {" "}
                    · {e.installments}{" "}
                    {t("monthly installments from", "ежемесячных платежей с")}{" "}
                    {e.due}
                    <details>
                      <summary>{t("Installments", "Платежи")}</summary>
                      <ol>
                        {installments(e).map((i) => (
                          <li key={i.due}>
                            {i.due} · {money(i.cents, locale)}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </>
                )}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
