"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import { isReportReceiptStale, type CurrentReportReceiptBinding } from "./report-model";
import { parseStudioReportHistoryPage, type StudioReportHistoryRecord } from "./studio-report-history";
import { readWithTimeout } from "./read-with-timeout";
import type { TaxCaseReportArtifacts } from "./case-report";
import { isTaxReportReceiptStale } from "./tax-report-receipt";
import styles from "./case-report-dialog.module.css";

type HistoryState = { context: string; phase: "loading" | "ready" | "error"; records: StudioReportHistoryRecord[]; cursor: string | null };

export default function StudioReportHistory({ customCaseId, scope, authorityEpoch, allowed, draft, profileId, binding, taxArtifacts = null, recorded, locale }: {
  customCaseId: number; scope: string; authorityEpoch: number; allowed: boolean;
  draft: StudioDraft; profileId: string; binding: CurrentReportReceiptBinding | null;
  taxArtifacts?: TaxCaseReportArtifacts | null;
  recorded: StudioReportHistoryRecord | null; locale: "en" | "ru";
}) {
  const context = JSON.stringify([customCaseId, scope, authorityEpoch, allowed]);
  const current = useRef<string | null>(null);
  const request = useRef(0);
  const [state, setState] = useState<HistoryState>({ context, phase: "loading", records: [], cursor: null });
  const [refresh, setRefresh] = useState(0);
  const en = locale === "en";
  useLayoutEffect(() => {
    const sequence = request;
    current.current = context;
    return () => { current.current = null; sequence.current++; };
  }, [context]);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController(), ticket = ++request.current;
    void readHistory(customCaseId, scope, null, controller.signal).then(page => {
      if (current.current === context && request.current === ticket) setState({ context, phase: "ready", records: page.receipts, cursor: page.nextCursor });
    }).catch(() => {
      if (current.current === context && request.current === ticket) setState({ context, phase: "error", records: [], cursor: null });
    });
    return () => { controller.abort(); };
  }, [allowed, context, customCaseId, scope, refresh, recorded]);
  const visible = state.context === context ? state : { context, phase: "loading" as const, records: [], cursor: null };
  async function loadMore() {
    if (!allowed || !visible.cursor || visible.phase === "loading") return;
    const ticket = ++request.current, cursor = visible.cursor;
    setState({ ...visible, phase: "loading" });
    try {
      const page = await readHistory(customCaseId, scope, cursor);
      if (current.current !== context || request.current !== ticket) return;
      setState({ context, phase: "ready", records: [...new Map([...visible.records, ...page.receipts].map(record => [record.id, record])).values()], cursor: page.nextCursor });
    } catch {
      if (current.current === context && request.current === ticket) setState({ context, phase: "error", records: [], cursor: null });
    }
  }
  if (!allowed) return null;
  return <details className={styles.receipt}>
    <summary>{en ? "My account export history" : "История экспортов моего аккаунта"}</summary>
    <p>{en ? "Receipts for this saved Studio case, recorded under your account. They record a client-reported download start, not delivery of a file or independent approval. PDF files are not stored here. Account deletion removes these receipts; losing case access can make them unavailable." : "Квитанции этого сохранённого кейса Studio в вашем аккаунте. Они фиксируют сообщение браузера о начале скачивания, а не получение файла или независимое утверждение. PDF-файлы здесь не хранятся. Удаление аккаунта удаляет квитанции; при потере доступа к кейсу история может стать недоступной."}</p>
    <button type="button" onClick={() => { setState({ context, phase: "loading", records: [], cursor: null }); setRefresh(value => value + 1); }} disabled={visible.phase === "loading"}>{en ? "Refresh history" : "Обновить историю"}</button>
    {visible.phase === "loading" && <p role="status">{en ? "Loading account receipts…" : "Загрузка квитанций аккаунта…"}</p>}
    {visible.phase === "error" && <p role="alert">{en ? "History could not be verified. Refresh to retry, or check your account and case access." : "Не удалось проверить историю. Обновите её или проверьте аккаунт и доступ к кейсу."}</p>}
    {visible.phase === "ready" && visible.records.length === 0 && <p>{en ? "No exports have been recorded for this case under your account." : "В вашем аккаунте нет записанных экспортов этого кейса."}</p>}
    <ol className={styles.historyList}>{visible.records.map(record => {
      const stale = record.receipt.receiptSchemaVersion === 3
        ? !taxArtifacts || isTaxReportReceiptStale(record.receipt, taxArtifacts)
        : !binding || isReportReceiptStale(record.receipt, draft, profileId, binding);
      const format = record.format.presentationMode === "decision" ? "Base" : record.format.presentationMode === "medium" ? "Medium" : "Full";
      return <li key={record.id}>
        <strong>{format} · {en ? "Tree" : "Схема"} {record.format.includeDecisionTree ? "ON" : "OFF"}</strong>
        <p>v{record.receipt.caseVersion} · <time dateTime={record.receipt.generatedAt}>{new Date(record.receipt.generatedAt).toLocaleString(locale === "en" ? "en-GB" : "ru-RU")}</time></p>
        <p>{stale ? (en ? "Earlier version or settings — not the current report" : "Прежняя версия или настройки — не текущий отчёт") : (en ? "Matches the current content and report settings" : "Соответствует текущему содержанию и настройкам отчёта")}</p>
        <details><summary>{en ? "Receipt details" : "Данные квитанции"}</summary><p>{en ? "Recorded by the server" : "Записано сервером"}: <time dateTime={record.recordedAt}>{record.recordedAt}</time></p><pre>{JSON.stringify(record.receipt, null, 2)}</pre></details>
      </li>;
    })}</ol>
    {visible.cursor && <button type="button" onClick={() => void loadMore()} disabled={visible.phase === "loading"}>{en ? "Load earlier receipts" : "Загрузить более ранние квитанции"}</button>}
  </details>;
}

async function readHistory(customCaseId: number, expectedScope: string, cursor: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ customCaseId: String(customCaseId), expectedScope, limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return readWithTimeout(async requestSignal => {
    const response = await fetch("/api/custom-cases/report-receipts?" + query, { cache: "no-store", signal: requestSignal });
    if (!response.ok) throw new Error("History unavailable");
    const page = parseStudioReportHistoryPage(await response.json());
    if (!page) throw new Error("History could not be verified");
    return page;
  }, { signal });
}
