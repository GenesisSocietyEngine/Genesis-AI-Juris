"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import {
  billingState,
  buildBillingEvent,
  kinds,
  money,
  type BillingKind,
  type BillingRow,
} from "./model";
import { BillingRegister } from "./BillingRegister";
import { names } from "./copy";
import styles from "./billing.module.css";

type Data = {
  scope: string;
  caseId: string;
  cases: { id: string; title: string }[];
  rows: BillingRow[];
  receipts: { id: string; title: string; version: string }[];
  canEnter: boolean;
  canManage: boolean;
};
export default function BillingClient() {
  const session = useNavigationSession(),
    [locale] = useInterfaceLocale(), location = useWorkspaceLocation();
  if (
    session.phase !== "ready" ||
    session.busy ||
    session.endingSession ||
    !session.selected
  )
    return null;
  return (
    <BillingWorkspace
      key={session.actorId + ":" + session.selected.selection}
      scope={session.selected.selection}
      initialCase={new URL(location, "https://workspace.invalid").searchParams.get("dossier") ?? ""}
      locale={locale}
    />
  );
}
export function BillingWorkspace({
  scope,
  locale,
  initialCase = "",
}: {
  scope: string;
  locale: "en" | "ru";
  initialCase?: string;
}) {
  const t = (en: string, ru: string) => (locale === "en" ? en : ru);
  const [caseId, setCase] = useState(initialCase),
    [loaded, setLoaded] = useState<Data | null>(null),
    [refresh, setRefresh] = useState(0),
    [issue, setIssue] = useState("");
  const data =
    loaded?.caseId === caseId && loaded.scope === scope ? loaded : null;
  useEffect(() => {
    const abort = new AbortController();
    async function read() {
      try {
        const res = await fetch(
          "/api/billing?case=" + encodeURIComponent(caseId),
          {
            headers: { "x-genesis-organization": scope },
            cache: "no-store",
            signal: abort.signal,
          },
        );
        const value = (await res.json()) as Data;
        if (caseId && (res.status === 403 || res.status === 404) && !abort.signal.aborted) {
          setLoaded(null);
          setCase("");
          return;
        }
        if (
          !res.ok ||
          value?.scope !== scope ||
          value.caseId !== caseId ||
          !Array.isArray(value.rows) ||
          !Array.isArray(value.cases)
        )
          throw Error();
        if (!abort.signal.aborted) {
          setLoaded(value);
          setIssue("");
        }
      } catch {
        if (!abort.signal.aborted) {
          setLoaded(null);
          setIssue(
            locale === "en"
              ? "Billing records could not be loaded."
              : "Не удалось загрузить записи.",
          );
        }
      }
    }
    void read();
    return () => abort.abort();
  }, [caseId, scope, refresh, locale]);
  const state = billingState(data?.rows ?? []);
  return (
    <main className={styles.page}>
      <header>
        <h1>{t("Billing", "Счета")}</h1>
        <p>
          {t(
            "Case billing and reconciliation · EUR",
            "Расчёты по делу и сверка · EUR",
          )}
        </p>
      </header>
      {issue && (
        <p role="alert">
          {issue}{" "}
          <button onClick={() => setRefresh((n) => n + 1)}>
            {t("Retry", "Повторить")}
          </button>
        </p>
      )}
      <label>
        {t("Case", "Дело")}{" "}
        <select
          value={caseId}
          onChange={(e) => {
            setCase(e.target.value);
            setIssue("");
          }}
        >
          <option value="">{t("Choose a case", "Выберите дело")}</option>
          {(loaded?.cases ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      {caseId && data && (
        <>
          <dl className={styles.totals}>
            {[
              [
                t("Unbilled", "Не выставлено"),
                state.open.reduce((n, r) => n + r.event.cents, 0),
              ],
              [
                t("Outstanding", "К оплате"),
                state.invoices.reduce((n, r) => n + r.balance, 0),
              ],
              [t("Trust balance", "Клиентские средства"), state.trust],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{money(Number(value), locale)}</dd>
              </div>
            ))}
          </dl>
          {data.canEnter && (
            <BillingForm
              key={caseId}
              data={data}
              locale={locale}
              onReload={() => setRefresh((n) => n + 1)}
            />
          )}
          <BillingRegister
            rows={data.rows}
            locale={locale}
            caseId={data.caseId}
            scope={scope}
          />
        </>
      )}
    </main>
  );
}
function BillingForm({
  data,
  locale,
  onReload,
}: {
  data: Data;
  locale: "en" | "ru";
  onReload: () => void;
}) {
  const t = (en: string, ru: string) => (locale === "en" ? en : ru),
    lang = locale === "en" ? 0 : 1;
  const [kind, select] = useState<BillingKind>("time"),
    [busy, setBusy] = useState(false),
    [issue, error] = useState(""),
    [notice, setNotice] = useState("");
  const retained = useRef<Record<string, unknown> | null>(null),
    sending = useRef(false),
    [uncertain, setUncertain] = useState(false);
  const state = billingState(data.rows),
    hasQuantity = kind === "time" || kind === "expense",
    needsAmount = [
      "payment",
      "trust_deposit",
      "trust_withdrawal",
      "fund_request",
    ].includes(kind);
  const availableTargets =
    kind === "void"
      ? state.active.filter(
          (r) =>
            state.open.includes(r) ||
            (["time", "expense"].includes(r.event.kind) && !r.event.billable),
        )
      : kind === "reconcile"
        ? state.active.filter(
            (r) =>
              ["payment", "trust_deposit", "trust_withdrawal"].includes(
                r.event.kind,
              ) && !state.reconciled.has(r.sequence),
          )
        : state.invoices.filter((r) => r.balance > 0);
  async function post(form: HTMLFormElement) {
    if (sending.current) return;
    let body = retained.current;
    if (!body) {
      const f = new FormData(form);
      body = {
        ...Object.fromEntries(f),
        kind,
        caseId: data.caseId,
        operationKey: crypto.randomUUID(),
        revision: data.rows.at(-1)?.sequence ?? 0,
        quantity: Number(f.get("quantity")),
        billable: f.has("billable"),
        target: Number(f.get("target")),
        entries: f.getAll("entries").map(Number),
        installments: Number(f.get("installments")),
      };
      try {
        buildBillingEvent(body, data.rows);
      } catch (e) {
        error(e instanceof Error ? e.message : "Invalid entry");
        return;
      }
      retained.current = body;
    }
    sending.current = true;
    setBusy(true);
    error("");
    setNotice("");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-genesis-organization": data.scope,
        },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as {
        error?: string;
        operationKey?: string;
        scope?: string;
        sequence?: number;
      };
      if (!res.ok) {
        if ([400, 403, 409, 422].includes(res.status)) {
          retained.current = null;
          setUncertain(false);
          if (res.status === 409 || res.status === 403) onReload();
        }
        throw Error(
          result.error ??
            t(
              "Save could not be confirmed.",
              "Не удалось подтвердить сохранение.",
            ),
        );
      }
      if (
        result.operationKey !== body.operationKey ||
        result.scope !== data.scope
      )
        throw Error(
          t("Check the saved entry.", "Проверьте сохранённую запись."),
        );
      retained.current = null;
      setUncertain(false);
      form.reset();
      setNotice(t("Recorded", "Записано") + " #" + result.sequence);
      onReload();
    } catch (e) {
      setUncertain(Boolean(retained.current));
      error(
        e instanceof Error
          ? e.message
          : t("Check the saved entry.", "Проверьте запись."),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{t("Record billing activity", "Добавить операцию")}</h2>
      <label>
        {t("Action", "Операция")}{" "}
        <select
          value={kind}
          disabled={busy || uncertain}
          onChange={(e) => {
            select(e.target.value as BillingKind);
            error("");
            setNotice("");
          }}
        >
          {kinds
            .filter((k) => data.canManage || k === "time" || k === "expense")
            .map((k) => (
              <option key={k} value={k}>
                {names[k][lang]}
              </option>
            ))}
        </select>
      </label>
      <form
        key={kind}
        onSubmit={(e) => {
          e.preventDefault();
          void post(e.currentTarget);
        }}
      >
        <fieldset disabled={busy || uncertain}>
          <label>
            {t("Date", "Дата")}
            <input
              type="date"
              name="date"
              defaultValue={new Date().toLocaleDateString("sv-SE")}
              required
            />
          </label>
          <label>
            {t("Description", "Описание")}
            <input name="description" required maxLength={500} />
          </label>
          {hasQuantity && (
            <>
              <label>
                {kind === "time"
                  ? t("Duration in minutes", "Длительность в минутах")
                  : t("Quantity", "Количество")}
                <input
                  type="number"
                  min="1"
                  step="1"
                  name="quantity"
                  required
                />
              </label>
              <label>
                {kind === "time"
                  ? t("Hourly rate, EUR", "Ставка в час, EUR")
                  : t("Unit cost, EUR", "Цена за единицу, EUR")}
                <input name="rate" inputMode="decimal" required />
              </label>
              <label>
                <input type="checkbox" name="billable" defaultChecked />
                {t("Billable", "Включать в счёт")}
              </label>
            </>
          )}
          {kind === "expense" && (
            <label>
              {t("Receipt from case documents", "Квитанция из документов дела")}
              <select name="receiptVersion" defaultValue="">
                <option value="">
                  {t("No receipt selected", "Без квитанции")}
                </option>
                {data.receipts.map((file) => (
                  <option key={file.version} value={file.version}>
                    {file.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "invoice" && <label><input type="checkbox" name="consultation" />{t("Consultation fee invoice", "Счёт за консультацию")}</label>}
          {kind === "invoice" && (
            <label>
              {t("Bill to", "Получатель счёта")}
              <input name="recipient" required maxLength={500} />
            </label>
          )}
          {kind === "invoice" && (
            <fieldset>
              <legend>
                {t(
                  "Unbilled entries for this invoice",
                  "Записи для включения в счёт",
                )}
              </legend>
              {state.open.length ? (
                state.open.map((r) => (
                  <label key={r.sequence}>
                    <input type="checkbox" name="entries" value={r.sequence} />#
                    {r.sequence} {r.event.description} ·{" "}
                    {money(r.event.cents, locale)}
                  </label>
                ))
              ) : (
                <p>
                  {t("No unbilled entries.", "Нет записей для выставления.")}
                </p>
              )}
            </fieldset>
          )}
          {["invoice", "plan"].includes(kind) && (
            <label>
              {kind === "invoice"
                ? t("Due date", "Срок оплаты")
                : t("First installment date", "Дата первого платежа")}
              <input name="due" type="date" required />
            </label>
          )}
          {kind === "plan" && (
            <label>
              {t("Monthly installments", "Количество ежемесячных платежей")}
              <input
                name="installments"
                type="number"
                min="1"
                max="120"
                required
              />
            </label>
          )}
          {["payment", "reconcile", "plan", "void"].includes(kind) && (
            <label>
              {t("Related record", "Связанная запись")}
              <select name="target" required defaultValue="">
                <option value="">
                  {t("Select a record", "Выберите запись")}
                </option>
                {availableTargets.map((r) => (
                  <option value={r.sequence} key={r.sequence}>
                    #{r.sequence} {r.event.description} ·{" "}
                    {money(
                      "balance" in r ? Number(r.balance) : r.event.cents,
                      locale,
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsAmount && (
            <label>
              {t("Amount, EUR", "Сумма, EUR")}
              <input name="amount" inputMode="decimal" required />
            </label>
          )}
          {[
            "payment",
            "trust_deposit",
            "trust_withdrawal",
            "reconcile",
          ].includes(kind) && (
            <label>
              {t(
                "External transaction or statement reference",
                "Номер операции или выписки",
              )}
              <input name="reference" required maxLength={500} />
            </label>
          )}
        </fieldset>
        <button disabled={busy}>
          {uncertain
            ? t("Retry the same entry", "Повторить ту же запись")
            : t("Record entry", "Сохранить запись")}
        </button>
      </form>
      {issue && <p role="alert">{issue}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
