"use client";

import { useEffect, useState } from "react";
import type { StudioDraft } from "./types";
import type { CaseReportOptions } from "./case-report";

export default function CaseReportDialog({ locale, draft, currentFingerprint, workspaceFingerprint, privateCase, close, completed }: {
  locale: "en" | "ru";
  draft: StudioDraft;
  currentFingerprint: string;
  workspaceFingerprint: string | null;
  privateCase: boolean;
  close: () => void;
  completed: () => void;
}) {
  const [audience, setAudience] = useState<CaseReportOptions["audience"]>("internal");
  const [confidentiality, setConfidentiality] = useState<CaseReportOptions["confidentiality"]>(privateCase ? "confidential" : "draft");
  const [preparedBy, setPreparedBy] = useState("");
  const [preparedFor, setPreparedFor] = useState("");
  const [matterReference, setMatterReference] = useState("");
  const [includeEconomics, setIncludeEconomics] = useState(true);
  const [includeRegisters, setIncludeRegisters] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true);
  const [includeTechnicalIds, setIncludeTechnicalIds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = (en: string, ru: string) => locale === "en" ? en : ru;

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) close(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy, close]);

  const chooseAudience = (next: CaseReportOptions["audience"]) => {
    setAudience(next);
    if (next === "client") { setIncludeAuditTrail(false); setIncludeTechnicalIds(false); }
  };
  const generate = async () => {
    if (!draft.title.trim() || !draft.nodes.length || busy) return;
    setBusy(true); setError("");
    try {
      const { downloadCaseReport } = await import("./case-report");
      await downloadCaseReport(draft, {
        language: locale, audience, confidentiality, preparedBy, preparedFor, matterReference,
        includeEconomics, includeRegisters, includeSources, includeAuditTrail, includeTechnicalIds,
        generatedAt: new Date().toISOString(), currentFingerprint, workspaceFingerprint, privateCase,
      });
      completed();
      close();
    } catch {
      setError(t("The report could not be created. Review the case data and try again.", "Не удалось сформировать отчёт. Проверьте данные кейса и повторите попытку."));
    } finally { setBusy(false); }
  };

  return <div className="case-report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="case-report-dialog" role="dialog" aria-modal="true" aria-labelledby="case-report-title">
      <header><div><span>{t("PROFESSIONAL DELIVERABLE", "ПРОФЕССИОНАЛЬНЫЙ ДОКУМЕНТ")}</span><h2 id="case-report-title">{t("Create case report", "Создать отчёт по кейсу")}</h2></div><button type="button" onClick={close} disabled={busy} aria-label={t("Close report dialog", "Закрыть окно отчёта")}>×</button></header>
      <p>{t("Generate a structured A4 PDF for review, circulation or the client file. The raw AI prompt is never included.", "Сформируйте структурированный PDF A4 для проверки, распространения или клиентского досье. Исходный AI-промпт никогда не включается.")}</p>
      <div className="case-report-grid">
        <fieldset><legend>{t("REPORT PROFILE", "ПРОФИЛЬ ОТЧЁТА")}</legend>
          <label><span>{t("Audience", "Аудитория")}</span><select value={audience} onChange={(event) => chooseAudience(event.target.value as CaseReportOptions["audience"])}><option value="internal">{t("Internal professional review", "Внутренняя профессиональная проверка")}</option><option value="client">{t("Client-facing report", "Отчёт для клиента")}</option></select></label>
          <label><span>{t("Classification", "Гриф")}</span><select value={confidentiality} onChange={(event) => setConfidentiality(event.target.value as CaseReportOptions["confidentiality"])}><option value="confidential">{t("Confidential", "Конфиденциально")}</option><option value="internal">{t("Internal", "Для внутреннего использования")}</option><option value="draft">{t("Draft", "Черновик")}</option></select></label>
          <label><span>{t("Prepared by", "Подготовил")}</span><input maxLength={120} value={preparedBy} onChange={(event) => setPreparedBy(event.target.value)} placeholder={t("Name / firm", "Имя / фирма")}/></label>
          <label><span>{t("Prepared for", "Подготовлено для")}</span><input maxLength={120} value={preparedFor} onChange={(event) => setPreparedFor(event.target.value)} placeholder={t("Client / team", "Клиент / команда")}/></label>
          <label><span>{t("Matter reference", "Номер материала")}</span><input maxLength={80} value={matterReference} onChange={(event) => setMatterReference(event.target.value)} placeholder={t("Optional", "Необязательно")}/></label>
        </fieldset>
        <fieldset><legend>{t("INCLUDE", "ВКЛЮЧИТЬ")}</legend>
          <label className="report-check"><input type="checkbox" checked={includeEconomics} onChange={(event) => setIncludeEconomics(event.target.checked)}/><span>{t("Economics, cash flow and probabilities", "Экономика, денежный поток и вероятности")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeRegisters} onChange={(event) => setIncludeRegisters(event.target.checked)}/><span>{t("Facts, evidence and rules register", "Реестр фактов, доказательств и правил")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeSources} onChange={(event) => setIncludeSources(event.target.checked)}/><span>{t("Authorities and source register", "Реестр правовых источников")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeAuditTrail} disabled={audience === "client"} onChange={(event) => setIncludeAuditTrail(event.target.checked)}/><span>{t("Safe authoring and review trail", "Безопасная история подготовки и проверки")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeTechnicalIds} disabled={audience === "client"} onChange={(event) => setIncludeTechnicalIds(event.target.checked)}/><span>{t("Technical node IDs and lineage", "Технические ID нодов и линия версий")}</span></label>
          <aside><b>{t("Always included", "Всегда включается")}</b><p>{t("Executive summary, decision map, verification checklist, report status, page numbers and content fingerprint.", "Резюме, карта решений, чек-лист проверки, статус отчёта, номера страниц и отпечаток содержания.")}</p></aside>
        </fieldset>
      </div>
      <div className="case-report-status"><b>{workspaceFingerprint === currentFingerprint ? t("Workspace-saved version", "Версия сохранена в workspace") : t("Working draft", "Рабочий черновик")}</b><span>{draft.nodes.length} {t("nodes", "нод")} · {draft.links.length} {t("connections", "связей")}</span></div>
      {error && <p className="case-report-error" role="alert">{error}</p>}
      <footer><button className="secondary-cta" type="button" onClick={close} disabled={busy}>{t("Cancel", "Отмена")}</button><button className="primary-cta" type="button" onClick={generate} disabled={busy || !draft.title.trim() || !draft.nodes.length}>{busy ? t("Creating PDF…", "Создание PDF…") : t("Download PDF report", "Скачать PDF-отчёт")}</button></footer>
    </section>
  </div>;
}
