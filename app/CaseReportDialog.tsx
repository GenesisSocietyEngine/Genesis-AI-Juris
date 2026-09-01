"use client";

import { useEffect, useMemo, useState } from "react";
import type { StudioDraft } from "./types";
import { caseReportReceiptBinding, type CaseReportOptions } from "./case-report";
import { caseTypePlaybook, primaryCaseOutput } from "./case-type-playbooks";
import { isReportReceiptStale, readStoredReportReceipt, validateReportReadiness, type ReportReceipt } from "./report-model";
import { reportGenerationErrorMessage } from "./report-generation-error";

function storedReceipt(caseId: string, profileId: string, scope: string | null, eligible: boolean) {
  if (typeof window === "undefined") return null;
  try { return readStoredReportReceipt(window.localStorage, { scope, eligible, caseId, profileId }); }
  catch { return null; }
}

export default function CaseReportDialog({ locale, draft, currentFingerprint, workspaceFingerprint, currentPublicationFingerprint, workspacePublicationFingerprint, privateCase, canGenerateReport, reportReceiptStorageScope, persistReportReceiptOnDevice, close, completed }: {
  locale: "en" | "ru";
  draft: StudioDraft;
  currentFingerprint: string;
  workspaceFingerprint: string | null;
  currentPublicationFingerprint: string;
  workspacePublicationFingerprint: string | null;
  privateCase: boolean;
  canGenerateReport: boolean;
  reportReceiptStorageScope: string | null;
  persistReportReceiptOnDevice: boolean;
  close: () => void;
  completed: () => void;
}) {
  const [audience, setAudience] = useState<CaseReportOptions["audience"]>("internal");
  const playbook = caseTypePlaybook(draft.caseType);
  const primaryOutput = primaryCaseOutput(draft.caseType);
  const [profileId, setProfileId] = useState(primaryOutput.id);
  const [confidentiality, setConfidentiality] = useState<CaseReportOptions["confidentiality"]>(privateCase ? "confidential" : "draft");
  const [preparedBy, setPreparedBy] = useState("");
  const [preparedFor, setPreparedFor] = useState("");
  const [matterReference, setMatterReference] = useState("");
  const [status, setStatus] = useState<"draft" | "final">("draft");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerApproved, setReviewerApproved] = useState(false);
  const [redactedNodeIds, setRedactedNodeIds] = useState<string[]>([]);
  const [previousReceipt, setPreviousReceipt] = useState<ReportReceipt | null>(() => storedReceipt(
    draft.caseId,
    primaryOutput.id,
    reportReceiptStorageScope,
    persistReportReceiptOnDevice,
  ));
  const [includeEconomics, setIncludeEconomics] = useState(true);
  const [includeRegisters, setIncludeRegisters] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true);
  const [includeTechnicalIds, setIncludeTechnicalIds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const activeReportOptions = useMemo<CaseReportOptions>(() => ({
    language: locale,
    profileId,
    profileLabel: caseTypePlaybook(draft.caseType).outputs.find((output) => output.id === profileId)?.label[locale]
      ?? primaryCaseOutput(draft.caseType).label[locale],
    audience,
    confidentiality,
    preparedBy,
    preparedFor,
    matterReference,
    includeEconomics,
    includeRegisters,
    includeSources,
    includeAuditTrail,
    includeTechnicalIds,
    // Generation time is PDF metadata only and is excluded from both locked fingerprints.
    generatedAt: "1970-01-01T00:00:00.000Z",
    currentFingerprint,
    workspaceFingerprint,
    currentPublicationFingerprint,
    workspacePublicationFingerprint,
    privateCase,
    reportReceiptStorageScope,
    persistReportReceiptOnDevice,
    status,
    reviewerName,
    reviewerApproved,
    redactedNodeIds,
  }), [
    audience, confidentiality, currentFingerprint, includeAuditTrail, includeEconomics, includeRegisters,
    includeSources, includeTechnicalIds, locale, matterReference, persistReportReceiptOnDevice, preparedBy, preparedFor, privateCase,
    reportReceiptStorageScope,
    currentPublicationFingerprint, draft.caseType, profileId, redactedNodeIds, reviewerApproved, reviewerName,
    status, workspaceFingerprint, workspacePublicationFingerprint,
  ]);
  const currentReceiptBinding = useMemo(() => {
    try { return caseReportReceiptBinding(draft, activeReportOptions); }
    catch { return null; }
  }, [activeReportOptions, draft]);
  const previousReceiptIsStale = previousReceipt === null
    || currentReceiptBinding === null
    || isReportReceiptStale(previousReceipt, draft, profileId, currentReceiptBinding);
  const readiness = useMemo(() => validateReportReadiness(draft, {
    profileId, status, audience, preparedBy, preparedFor, reviewerName, reviewerApproved,
    currentFingerprint, workspaceFingerprint, currentPublicationFingerprint, workspacePublicationFingerprint, redactedNodeIds,
  }), [audience, currentFingerprint, currentPublicationFingerprint, draft, preparedBy, preparedFor, profileId, redactedNodeIds, reviewerApproved, reviewerName, status, workspaceFingerprint, workspacePublicationFingerprint]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) close(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy, close]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviousReceipt(storedReceipt(
        draft.caseId,
        profileId,
        reportReceiptStorageScope,
        persistReportReceiptOnDevice,
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft.caseId, persistReportReceiptOnDevice, profileId, reportReceiptStorageScope]);

  const chooseAudience = (next: CaseReportOptions["audience"]) => {
    setAudience(next);
    if (next === "client") { setStatus("final"); setIncludeAuditTrail(false); setIncludeTechnicalIds(false); }
  };
  const generate = async () => {
    if (!canGenerateReport) {
      setError(t("Report export is unavailable in inspection-only mode.", "Экспорт отчёта недоступен в режиме просмотра."));
      return;
    }
    if (!draft.title.trim() || !draft.nodes.length || busy) return;
    setBusy(true); setError("");
    try {
      const { downloadCaseReport } = await import("./case-report");
      await downloadCaseReport(draft, {
        ...activeReportOptions,
        generatedAt: new Date().toISOString(),
      }, { canGenerate: canGenerateReport });
      completed();
      close();
    } catch (caught) {
      setError(reportGenerationErrorMessage(caught, locale));
    } finally { setBusy(false); }
  };

  return <div className="case-report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="case-report-dialog" role="dialog" aria-modal="true" aria-labelledby="case-report-title">
      <header><div><span>{t("PROFESSIONAL DELIVERABLE", "ПРОФЕССИОНАЛЬНЫЙ ДОКУМЕНТ")}</span><h2 id="case-report-title">{t("Create case report", "Создать отчёт по кейсу")}</h2></div><button type="button" onClick={close} disabled={busy} aria-label={t("Close report dialog", "Закрыть окно отчёта")}>×</button></header>
      <p>{t("Generate a structured A4 PDF for review, circulation or the client file. The raw AI prompt is never included.", "Сформируйте структурированный PDF A4 для проверки, распространения или клиентского досье. Исходный AI-промпт никогда не включается.")}</p>
      <div className="case-report-grid">
        <fieldset><legend>{t("REPORT PROFILE", "ПРОФИЛЬ ОТЧЁТА")}</legend>
          <label><span>{t("Professional output", "Профессиональный результат")}</span><select value={profileId} onChange={(event) => setProfileId(event.target.value)}>{playbook.outputs.map((output) => <option key={output.id} value={output.id}>{output.label[locale]}{output.primary ? ` · ${t("primary", "основной")}` : ""}</option>)}</select></label>
          <label><span>{t("Audience", "Аудитория")}</span><select value={audience} onChange={(event) => chooseAudience(event.target.value as CaseReportOptions["audience"])}><option value="internal">{t("Internal professional review", "Внутренняя профессиональная проверка")}</option><option value="client">{t("Client-facing report", "Отчёт для клиента")}</option></select></label>
          <label><span>{t("Publication state", "Статус публикации")}</span><select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "final")}><option value="draft">{t("Review draft", "Черновик для проверки")}</option><option value="final">{t("Approved final", "Утверждённый финальный")}</option></select></label>
          <label><span>{t("Classification", "Гриф")}</span><select value={confidentiality} onChange={(event) => setConfidentiality(event.target.value as CaseReportOptions["confidentiality"])}><option value="confidential">{t("Confidential", "Конфиденциально")}</option><option value="internal">{t("Internal", "Для внутреннего использования")}</option><option value="draft">{t("Draft", "Черновик")}</option></select></label>
          <label><span>{t("Prepared by", "Подготовил")}</span><input maxLength={120} value={preparedBy} onChange={(event) => setPreparedBy(event.target.value)} placeholder={t("Name / firm", "Имя / фирма")}/></label>
          <label><span>{t("Prepared for", "Подготовлено для")}</span><input maxLength={120} value={preparedFor} onChange={(event) => setPreparedFor(event.target.value)} placeholder={t("Client / team", "Клиент / команда")}/></label>
          <label><span>{t("Matter reference", "Номер материала")}</span><input maxLength={80} value={matterReference} onChange={(event) => setMatterReference(event.target.value)} placeholder={t("Optional", "Необязательно")}/></label>
          <label><span>{t("Approving reviewer", "Утверждающий рецензент")}</span><input maxLength={120} value={reviewerName} onChange={(event) => { setReviewerName(event.target.value); setReviewerApproved(false); }} placeholder={t("Required for final/external", "Обязательно для финального/внешнего")}/></label>
          <label className="report-check"><input type="checkbox" checked={reviewerApproved} onChange={(event) => setReviewerApproved(event.target.checked)}/><span>{t("I confirm reviewer approval for this exact saved version", "Подтверждаю рецензию именно этой сохранённой версии")}</span></label>
        </fieldset>
        <fieldset><legend>{t("INCLUDE", "ВКЛЮЧИТЬ")}</legend>
          <label className="report-check"><input type="checkbox" checked={includeEconomics} onChange={(event) => setIncludeEconomics(event.target.checked)}/><span>{t("Economics, cash flow and probabilities", "Экономика, денежный поток и вероятности")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeRegisters} onChange={(event) => setIncludeRegisters(event.target.checked)}/><span>{t("Facts, evidence and rules register", "Реестр фактов, доказательств и правил")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeSources} onChange={(event) => setIncludeSources(event.target.checked)}/><span>{t("Authorities and source register", "Реестр правовых источников")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeAuditTrail} disabled={audience === "client"} onChange={(event) => setIncludeAuditTrail(event.target.checked)}/><span>{t("Safe authoring and review trail", "Безопасная история подготовки и проверки")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeTechnicalIds} disabled={audience === "client"} onChange={(event) => setIncludeTechnicalIds(event.target.checked)}/><span>{t("Technical node IDs and lineage", "Технические ID нодов и линия версий")}</span></label>
          <label><span>{t("Redact from report", "Скрыть из отчёта")}</span><select multiple size={4} value={redactedNodeIds} onChange={(event) => setRedactedNodeIds([...event.currentTarget.selectedOptions].map((option) => option.value))}>{draft.nodes.filter((node) => node.type === "fact" || node.type === "evidence").map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
          <aside><b>{t("Always included", "Всегда включается")}</b><p>{t("Executive summary, decision map, verification checklist, report status, page numbers, content fingerprint, the full portrait graph, and its complete text alternative.", "Резюме, карта решений, чек-лист проверки, статус отчёта, номера страниц, отпечаток содержания, полный граф в книжной ориентации и его полная текстовая альтернатива.")}</p></aside>
        </fieldset>
      </div>
      <div className="case-report-status"><b>{workspaceFingerprint === currentFingerprint && workspacePublicationFingerprint === currentPublicationFingerprint ? t("Workspace-saved reviewed version", "Проверенная версия сохранена в workspace") : t("Working draft", "Рабочий черновик")}</b><span>{draft.nodes.length} {t("nodes", "нод")} · {draft.links.length} {t("connections", "связей")}</span></div>
      <div className="case-report-status"><b>{readiness.ready ? t("Report gate ready", "Отчёт готов к выпуску") : t("Report gate blocked", "Выпуск отчёта заблокирован")}</b><span>{readiness.blockers.length ? readiness.blockers.join(" · ") : readiness.warnings.join(" · ") || t("All mandatory checks passed", "Все обязательные проверки пройдены")}</span></div>
      {previousReceipt && <div className="case-report-status"><b>{previousReceiptIsStale ? t("Previous report is stale", "Предыдущий отчёт устарел") : t("Current content and layout receipt found", "Найдена актуальная квитанция содержания и макета")}</b><span>{previousReceipt.generatedAt.slice(0, 16).replace("T", " ")} UTC · {previousReceipt.reportFingerprint.slice(0, 19)}…</span></div>}
      {error && <p className="case-report-error" role="alert">{error}</p>}
      <footer><button className="secondary-cta" type="button" onClick={close} disabled={busy}>{t("Cancel", "Отмена")}</button><button className="primary-cta" type="button" onClick={generate} disabled={!canGenerateReport || busy || !draft.title.trim() || !draft.nodes.length || ((status === "final" || audience === "client") && !readiness.ready)}>{busy ? t("Creating PDF…", "Создание PDF…") : t("Generate locally and download", "Сформировать локально и скачать")}</button></footer>
    </section>
  </div>;
}
