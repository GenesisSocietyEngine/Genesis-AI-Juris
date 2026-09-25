"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import { caseReportReceiptBinding, type CaseReportOptions } from "./case-report";
import { caseTypePlaybook, primaryCaseOutput } from "./case-type-playbooks";
import { isReportReceiptStale, readStoredReportReceipt, validateReportReadiness, type ReportReceipt, type ReportReceiptV2 } from "./report-model";
import { reportGenerationErrorMessage } from "./report-generation-error";
import { startReportDownload } from "./report-download";

function storedReceipt(caseId: string, profileId: string, scope: string | null, eligible: boolean) {
  if (typeof window === "undefined") return null;
  try { return readStoredReportReceipt(window.localStorage, { scope, eligible, caseId, profileId }); }
  catch { return null; }
}

export default function CaseReportDialog({ locale, draft, currentFingerprint, workspaceFingerprint, currentPublicationFingerprint, workspacePublicationFingerprint, privateCase, canGenerateReport, reportAuthorityEpoch = 0, verifyReportAuthority, developerView = false, reportReceiptStorageScope, persistReportReceiptOnDevice, close, completed }: {
  locale: "en" | "ru";
  draft: StudioDraft;
  currentFingerprint: string;
  workspaceFingerprint: string | null;
  currentPublicationFingerprint: string;
  workspacePublicationFingerprint: string | null;
  privateCase: boolean;
  canGenerateReport: boolean;
  reportAuthorityEpoch?: number;
  verifyReportAuthority?: () => Promise<() => boolean>;
  developerView?: boolean;
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
  const [presentationMode, setPresentationMode] = useState<"decision" | "medium" | "full">("decision");
  const [includeDecisionTree, setIncludeDecisionTree] = useState(false);
  const chooseFormat = (format: "decision" | "medium" | "full") => {
    setPresentationMode(format);
    if (format !== "full") setIncludeDecisionTree(format === "medium");
  };
  const chooseTree = (included: boolean) => {
    setIncludeDecisionTree(included);
    if (presentationMode !== "full") setPresentationMode(included ? "medium" : "decision");
  };
  const [includeEconomics, setIncludeEconomics] = useState(true);
  const [includeRegisters, setIncludeRegisters] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true);
  const [includeTechnicalIds, setIncludeTechnicalIds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const receiptContext = useMemo(() => ({ caseId: draft.caseId, scope: reportReceiptStorageScope, canGenerateReport, reportAuthorityEpoch }), [draft.caseId, reportReceiptStorageScope, canGenerateReport, reportAuthorityEpoch]);
  const currentReceiptContext = useRef<typeof receiptContext | null>(receiptContext);
  const [renderedReceiptContext, setRenderedReceiptContext] = useState(receiptContext);
  const [completedDownload, setCompletedDownload] = useState<{ context: typeof receiptContext; receipt: ReportReceiptV2 } | null>(null);
  // Reset context-bound UI before committing the new account/case/authority.
  // An abandoned render must not change the committed async callback fence.
  if (renderedReceiptContext !== receiptContext) {
    setRenderedReceiptContext(receiptContext);
    setCompletedDownload(null);
    setBusy(false);
    setError("");
  }
  const downloadReceipt = canGenerateReport && completedDownload?.context === receiptContext ? completedDownload.receipt : null;
  const [previewDocument, setPreviewDocument] = useState<{ url: string; options: CaseReportOptions; draft: StudioDraft; context: typeof receiptContext } | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const activeReportOptions = useMemo<CaseReportOptions>(() => ({
    language: locale,
    presentationMode,
    includeDecisionTree,
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
    audience, confidentiality, currentFingerprint, presentationMode, includeDecisionTree, includeAuditTrail, includeEconomics, includeRegisters,
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
  const downloadReceiptIsStale = downloadReceipt === null
    || currentReceiptBinding === null
    || isReportReceiptStale(downloadReceipt, draft, profileId, currentReceiptBinding);
  const readiness = useMemo(() => validateReportReadiness(draft, {
    profileId, status, audience, preparedBy, preparedFor, reviewerName, reviewerApproved,
    currentFingerprint, workspaceFingerprint, currentPublicationFingerprint, workspacePublicationFingerprint, redactedNodeIds,
  }), [audience, currentFingerprint, currentPublicationFingerprint, draft, preparedBy, preparedFor, profileId, redactedNodeIds, reviewerApproved, reviewerName, status, workspaceFingerprint, workspacePublicationFingerprint]);

  useLayoutEffect(() => {
    currentReceiptContext.current = receiptContext;
    return () => { currentReceiptContext.current = null; };
  }, [receiptContext]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      if (event.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],iframe') ?? []).filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy, close]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (dialogRef.current?.querySelector<HTMLButtonElement>("[data-report-preview]:not(:disabled)")
      ?? dialogRef.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => () => { if (previewDocument) URL.revokeObjectURL(previewDocument.url); }, [previewDocument, receiptContext]);
  // Derive visibility from the exact inputs, so stale previews disappear immediately.
  const previewUrl = canGenerateReport && previewDocument?.context === receiptContext
    && previewDocument.options === activeReportOptions && previewDocument.draft === draft ? previewDocument.url : null;

  const verifyOutput = async () => {
    if (currentReceiptContext.current !== receiptContext || !canGenerateReport) throw new Error("Report context is no longer active.");
    // Private/workspace callers must provide server-backed authority. Anonymous
    // local drafts retain their existing entirely local output behavior.
    if (!verifyReportAuthority && (privateCase || workspaceFingerprint !== null)) throw new Error("Report access could not be verified. Sign in and refresh access.");
    const authorized = verifyReportAuthority ? await verifyReportAuthority() : () => true;
    const current = () => currentReceiptContext.current === receiptContext && authorized();
    if (!current()) throw new Error("Report context is no longer active.");
    return current;
  };

  const preview = async () => {
    if (!canGenerateReport || busy || !draft.title.trim() || !draft.nodes.length) return;
    setBusy(true); setError("");
    try {
      const current = await verifyOutput();
      const { createCaseReportPreview } = await import("./case-report");
      const blob = await createCaseReportPreview(draft, { ...activeReportOptions, generatedAt: new Date().toISOString() }, {
        canGenerate: canGenerateReport, isCurrent: current, revalidate: async () => { await verifyOutput(); },
      });
      if (!current()) return;
      setPreviewDocument({ url: URL.createObjectURL(blob), options: activeReportOptions, draft, context: receiptContext });
    } catch (caught) { if (currentReceiptContext.current === receiptContext) setError(reportGenerationErrorMessage(caught, locale)); }
    finally { if (currentReceiptContext.current === receiptContext) setBusy(false); }
  };

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
      const current = await verifyOutput();
      const { downloadCaseReport } = await import("./case-report");
      const receipt = await downloadCaseReport(draft, {
        ...activeReportOptions,
        generatedAt: new Date().toISOString(),
      }, { canGenerate: canGenerateReport, isCurrent: current, revalidate: async () => { await verifyOutput(); } });
      if (!current()) return;
      setCompletedDownload({ context: receiptContext, receipt });
      completed();
    } catch (caught) {
      if (currentReceiptContext.current === receiptContext) setError(reportGenerationErrorMessage(caught, locale));
    } finally { if (currentReceiptContext.current === receiptContext) setBusy(false); }
  };
  const exportDownloadReceipt = async () => {
    if (!canGenerateReport || !downloadReceipt || busy || currentReceiptContext.current !== receiptContext) return;
    setBusy(true); setError("");
    try {
      const current = await verifyOutput();
      if (!current()) return;
      const filename = `${downloadReceipt.caseId}-v${downloadReceipt.caseVersion}-${downloadReceipt.profileId}-${downloadReceipt.generatedAt}-report-receipt.json`.replace(/[^a-zA-Z0-9._-]/g, "-");
      startReportDownload(new Blob([JSON.stringify(downloadReceipt, null, 2)], { type: "application/json" }), filename);
      setError("");
    } catch {
      if (currentReceiptContext.current === receiptContext) setError(t("The receipt could not be downloaded. Verify access and try again.", "Не удалось скачать квитанцию. Подтвердите доступ и повторите."));
    } finally { if (currentReceiptContext.current === receiptContext) setBusy(false); }
  };
  const outputBlocked = !canGenerateReport || busy || !draft.title.trim() || !draft.nodes.length
    || ((status === "final" || audience === "client") && !readiness.ready);

  return <div className="case-report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section ref={dialogRef} className="case-report-dialog" role="dialog" aria-modal="true" aria-labelledby="case-report-title">
      <header><div><span>{t("PROFESSIONAL DELIVERABLE", "ПРОФЕССИОНАЛЬНЫЙ ДОКУМЕНТ")}</span><h2 id="case-report-title">{t("Create case report", "Создать отчёт по кейсу")}</h2></div><button type="button" onClick={close} disabled={busy} aria-label={t("Close report dialog", "Закрыть окно отчёта")}>×</button></header>
      <p>{t("Generate a structured A4 PDF for review, circulation or the client file. The raw AI prompt is never included.", "Сформируйте структурированный PDF A4 для проверки, распространения или клиентского досье. Исходный AI-промпт никогда не включается.")}</p>
      <fieldset className="report-format-choice" disabled={busy}>
        <legend>{t("Choose your PDF report format", "Выберите формат PDF-отчёта")}</legend>
        <div className="report-format-options">
          {([
            {value:"decision",title:t("Base", "Базовый"),detail:t("Findings, recommendations and calculations.", "Выводы, рекомендации и расчёты.")},
            {value:"medium",title:t("Medium", "Средний"),detail:t("Base report + visual decision tree.", "Базовый отчёт + визуальное дерево решений.")},
            {value:"full",title:t("Full analysis", "Полный анализ"),detail:t("Detailed records, graph and audit options.", "Подробные записи, граф и параметры аудита.")},
          ] as const).map(format=><label key={format.value} className="report-format-option"><input type="radio" name="report-presentation-format" value={format.value} checked={presentationMode===format.value} onChange={()=>chooseFormat(format.value)}/><span><b>{format.title}</b><small>{format.detail}</small></span></label>)}
        </div>
      </fieldset>
      <p className="report-draft-explainer">{t("Start with a preliminary analytical report. Previewing or downloading it does not create an independent approval. Governed outputs and a reviewer's decision are recorded separately in My cases → Reports.", "Начните с предварительного аналитического отчёта. Просмотр или скачивание не создаёт независимого утверждения. Контролируемые документы и решение проверяющего фиксируются отдельно: Мои дела → Отчёты.")}</p>
      <section className="case-report-quick-actions" aria-label={t("Create your report", "Создать отчёт")}>
        <div><b aria-live="polite">{presentationMode === "medium" ? t("Medium report — base + graph", "Средний отчёт — базовый + граф") : presentationMode === "decision" ? t("Base decision report", "Базовый отчёт для решения") : t("Full analysis report", "Полный аналитический отчёт")}</b><span>{status === "draft" ? t("Preliminary draft", "Предварительный черновик") : t("Final report", "Финальный отчёт")} · {audience === "internal" ? t("Internal review", "Внутренняя проверка") : t("For the client", "Для клиента")}</span></div>
        <div className="case-report-buttons"><button data-report-preview className="primary-cta" type="button" onClick={preview} disabled={outputBlocked}>{busy ? t("Creating PDF…", "Создание PDF…") : t("Preview PDF", "Предпросмотр PDF")}</button><button className="secondary-cta" type="button" onClick={generate} disabled={outputBlocked}>{t("Download PDF", "Скачать PDF")}</button></div>
      </section>
      {!canGenerateReport && <p className="case-report-error" role="status">{t("Report export is unavailable in inspection-only mode.", "Экспорт отчёта недоступен в режиме просмотра.")}</p>}
      {(status === "final" || audience === "client") && !readiness.ready && <p className="case-report-error" role="status">{readiness.blockers.join(" · ")}</p>}
      {error && <p className="case-report-error" role="alert">{error}</p>}
      {downloadReceipt && <section className="case-report-receipt" aria-labelledby="case-report-receipt-title">
        <h3 id="case-report-receipt-title">{t("Receipt for the last PDF download", "Квитанция последнего скачивания PDF")}</h3>
        <p role="status">{downloadReceiptIsStale ? t("The case or report settings have changed. This receipt belongs to the earlier PDF download.", "Кейс или параметры отчёта изменились. Эта квитанция относится к предыдущему скачиванию PDF.") : t("This receipt matches the current case and report settings.", "Эта квитанция соответствует текущему кейсу и параметрам отчёта.")}</p>
        <p>{downloadReceipt.caseId} · v{downloadReceipt.caseVersion} · {downloadReceipt.profileId} · {downloadReceipt.generatedAt}</p>
        <p>{t("Save this content and layout receipt with the PDF whose download was started. It does not confirm that the file was saved or independently approved. Download the receipt before closing this dialog.", "Сохраните квитанцию содержания и макета вместе с PDF, скачивание которого началось. Она не подтверждает сохранение файла или независимое утверждение. Скачайте квитанцию перед закрытием этого окна.")}</p>
        <button className="secondary-cta" type="button" onClick={exportDownloadReceipt} disabled={busy}>{t("Download receipt JSON", "Скачать квитанцию JSON")}</button>
        <details><summary>{t("Receipt fields", "Поля квитанции")}</summary><pre>{JSON.stringify(downloadReceipt, null, 2)}</pre></details>
      </section>}
      {previewUrl && <section className="case-report-preview"><h3>{t("PDF preview", "Предпросмотр PDF")}</h3><iframe src={previewUrl} title={t("Analytical PDF preview", "Предпросмотр аналитического PDF")}/><a href={previewUrl} target="_blank" rel="noreferrer">{t("Open preview in a new tab", "Открыть предпросмотр в новой вкладке")}</a></section>}
      <label className="report-tree-choice"><input type="checkbox" role="switch" checked={includeDecisionTree} disabled={busy} onChange={event => chooseTree(event.target.checked)} aria-describedby="report-tree-help"/><span>{t("Include decision tree", "Включить дерево решений")} <b aria-hidden="true">{includeDecisionTree ? t("ON", "ВКЛ") : t("OFF", "ВЫКЛ")}</b></span></label>
      <p id="report-tree-help" className="report-tree-help">{presentationMode === "full" ? t("Adds the decision tree and its detailed text alternative. Full records and calculations remain included with either setting.", "Добавляет дерево решений и подробную текстовую альтернативу. Полные записи и расчёты сохраняются при любом положении переключателя.") : t("ON selects Medium: base findings and recommendations plus the visual graph. OFF returns to Base. The detailed graph text appendix is available in Full analysis.", "ВКЛ выбирает средний отчёт: базовые выводы и рекомендации плюс визуальный граф. ВЫКЛ возвращает базовый отчёт. Подробное текстовое приложение к графу доступно в полном анализе.")}</p>
      <p className="report-draft-explainer">{t("The decision report explains what the recorded inputs imply and what to do next. Calculated findings remain conditional on evidence; they do not create an approval.", "Отчёт объясняет значение записанных данных и следующие действия. Расчётные выводы зависят от подтверждения оснований и не создают утверждения.")}</p>
      <details className="case-report-settings" open={developerView}>
      <summary>{t("Report settings and approval", "Настройки отчёта и утверждение")}</summary>
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
          <label className="report-check"><input type="checkbox" checked={includeEconomics} onChange={(event) => setIncludeEconomics(event.target.checked)}/><span>{t("Economic analysis and assumptions", "Экономический анализ и допущения")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeRegisters} onChange={(event) => setIncludeRegisters(event.target.checked)}/><span>{t("Facts, evidence and rules register", "Реестр фактов, доказательств и правил")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeSources} onChange={(event) => setIncludeSources(event.target.checked)}/><span>{t("Authorities and source register", "Реестр правовых источников")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeAuditTrail} disabled={audience === "client" || presentationMode !== "full"} onChange={(event) => setIncludeAuditTrail(event.target.checked)}/><span>{t("Safe authoring and review trail", "Безопасная история подготовки и проверки")}</span></label>
          <label className="report-check"><input type="checkbox" checked={includeTechnicalIds} disabled={audience === "client" || presentationMode !== "full"} onChange={(event) => setIncludeTechnicalIds(event.target.checked)}/><span>{t("Technical node IDs and lineage", "Технические ID нодов и линия версий")}</span></label>
          <label><span>{t("Redact from report", "Скрыть из отчёта")}</span><select multiple size={4} value={redactedNodeIds} onChange={(event) => setRedactedNodeIds([...event.currentTarget.selectedOptions].map((option) => option.value))}>{draft.nodes.filter((node) => node.type === "fact" || node.type === "evidence").map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
          <aside><b>{t("Included in this format", "В выбранном формате")}</b><p>{presentationMode !== "full" ? t("Findings, proposed actions, calculation method and limitations. Full records and technical details are available in Full analysis.", "Выводы, предлагаемые действия, метод расчёта и ограничения. Полные записи и технические сведения доступны в полном анализе.") : t("Executive summary, case records, verification checklist, report status, page numbers and content fingerprint.", "Резюме, записи дела, чек-лист проверки, статус отчёта, номера страниц и отпечаток содержания.")} {presentationMode === "medium" ? t("The visual decision tree is included; detailed graph registers are omitted.", "Визуальное дерево решений включено; подробные реестры графа не включены.") : includeDecisionTree ? t("The decision tree and its text alternative are included.", "Дерево решений и его текстовая альтернатива включены.") : t("The decision tree and its text alternative are omitted.", "Дерево решений и его текстовая альтернатива не включены.")}</p></aside>
        </fieldset>
      </div>
      <div className="case-report-status"><b>{workspaceFingerprint === currentFingerprint && workspacePublicationFingerprint === currentPublicationFingerprint ? t("Workspace-saved reviewed version", "Проверенная версия сохранена в workspace") : t("Working draft", "Рабочий черновик")}</b><span>{draft.nodes.length} {t("nodes", "нод")} · {draft.links.length} {t("connections", "связей")}</span></div>
      <div className="case-report-status"><b>{readiness.ready ? t("Report gate ready", "Отчёт готов к выпуску") : t("Report gate blocked", "Выпуск отчёта заблокирован")}</b><span>{readiness.blockers.length ? readiness.blockers.join(" · ") : readiness.warnings.join(" · ") || t("All mandatory checks passed", "Все обязательные проверки пройдены")}</span></div>
      {previousReceipt && <div className="case-report-status"><b>{previousReceiptIsStale ? t("Previous report is stale", "Предыдущий отчёт устарел") : t("Current content and layout receipt found", "Найдена актуальная квитанция содержания и макета")}</b><span>{previousReceipt.generatedAt.slice(0, 16).replace("T", " ")} UTC · {previousReceipt.reportFingerprint.slice(0, 19)}…</span></div>}
      </details>
      <footer><button className="secondary-cta" type="button" onClick={close} disabled={busy}>{t("Close", "Закрыть")}</button></footer>
    </section>
  </div>;
}
