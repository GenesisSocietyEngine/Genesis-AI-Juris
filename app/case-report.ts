import { pdfBlobFromDocument } from "./pdf-blob";
import { startReportDownload } from "./report-download";
import { withLocalChunkRecovery } from "./stale-chunk-recovery";
import { calculateDealEconomics } from "./deal-economics";
import { calculateTaxEconomics } from "./tax-economics";
import { buildReportGraphLayout, deriveReportGraphLayoutInput, reportGraphGovernedTextIssue, ReportGraphLayoutError, type ReportGraphLayoutModel } from "./report-graph-layout";
import { buildReportGraphAppendix } from "./report-graph-pdf";
import { canonicalFingerprint } from "./case-integrity";
import { buildDecisionReport } from "./report-decision-pdf";
import { caseReportBriefRows } from "./case-report-brief";
import { CASE_REPORT_PDF_FONTS, REPORT_AUDIT_SYMBOL_FONT, REPORT_AUDIT_SYMBOL_FONT_SHA256, reportAuditText } from "./report-audit-symbols";
import type { StudioDraft, StudioNodeType } from "./types";
import { buildCanonicalReportModel, reportReceipt, writeStoredReportReceipt, type CanonicalReportModel, type CurrentReportReceiptBinding, type ReportSectionId } from "./report-model";
import type { Content, ContentTable, ContentText, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";

export type CaseReportOptions = {
  language: "en" | "ru";
  /** Existing API callers retain the full format; the dialog defaults to decision. */
  presentationMode?: "decision" | "medium" | "full";
  /** Decision reports omit the tree by default; legacy full exports retain it. */
  includeDecisionTree?: boolean;
  profileId: string;
  profileLabel: string;
  audience: "client" | "internal";
  confidentiality: "confidential" | "internal" | "draft";
  preparedBy: string;
  preparedFor: string;
  matterReference: string;
  includeEconomics: boolean;
  includeRegisters: boolean;
  includeSources: boolean;
  includeAuditTrail: boolean;
  includeTechnicalIds: boolean;
  generatedAt: string;
  currentFingerprint: string;
  workspaceFingerprint: string | null;
  currentPublicationFingerprint: string;
  workspacePublicationFingerprint: string | null;
  privateCase: boolean;
  /** Device-storage routing only; excluded from report and presentation fingerprints. */
  reportReceiptStorageScope: string | null;
  persistReportReceiptOnDevice: boolean;
  status?: "draft" | "final";
  reviewerName?: string;
  reviewerApproved?: boolean;
  redactedNodeIds?: string[];
};

const palette = { ink: "#10202c", navy: "#163445", cyan: "#3d9daa", gold: "#c79b3b", mist: "#edf2f3", line: "#b6c4c8", red: "#a34444", white: "#ffffff" };
const nodeNames: Record<StudioNodeType, [string, string]> = {
  trigger: ["Trigger", "Триггер"], actor: ["Actor", "Участник"], fact: ["Fact", "Факт"], evidence: ["Evidence", "Доказательство"],
  deadline: ["Deadline", "Срок"], decision: ["Decision", "Решение"], outcome: ["Outcome", "Исход"], entity: ["Entity / jurisdiction", "Организация / юрисдикция"],
  tax_rule: ["Tax rule", "Налоговое правило"], cash_flow: ["Cash flow", "Денежный поток"],
};
const reportSectionNames: Record<ReportSectionId, [string, string]> = {
  executive_summary: ["Executive summary", "Резюме"], issues: ["Issues", "Вопросы"], facts_evidence: ["Facts and evidence", "Факты и доказательства"], authorities: ["Authorities", "Источники права"], options: ["Options", "Варианты"], recommendation: ["Recommendation", "Рекомендация"],
  sources: ["Sources", "Источники"], approval: ["Approval", "Утверждение"], chronology: ["Chronology", "Хронология"], custody: ["Chain of custody", "Цепочка хранения"], risk_scenarios: ["Risk scenarios", "Сценарии риска"], obligations: ["Obligations", "Обязательства"], deadlines: ["Deadlines", "Сроки"],
  economics: ["Economics", "Экономика"], tax_position: ["Tax position", "Налоговая позиция"], controls: ["Controls", "Контроли"], gaps: ["Gaps and exceptions", "Пробелы и исключения"], remediation: ["Remediation", "Устранение"], root_cause: ["Root cause", "Первопричина"], process_design: ["Process and solution design", "Процесс и проект решения"],
  test_plan: ["Test plan", "План тестирования"], expected_results: ["Expected results", "Ожидаемые результаты"], actors: ["Actors", "Участники"], findings: ["Findings", "Выводы"], redactions: ["Redactions", "Скрытые данные"], scenario_map: ["Scenario map", "Карта сценария"], routes: ["Route coverage", "Покрытие маршрутов"], learning_objectives: ["Learning objectives", "Учебные цели"], facilitation: ["Facilitation plan", "План фасилитации"], debrief: ["Debrief", "Разбор"],
};

const tr = (language: CaseReportOptions["language"], en: string, ru: string) => language === "en" ? en : ru;
const clean = (value: string | undefined | null, fallback = "-") => value?.trim() || fallback;
const pct = (basisPoints: number | null) => basisPoints === null ? "-" : `${(basisPoints / 100).toFixed(1)}%`;

function reportSafePremise(draft: StudioDraft, language: CaseReportOptions["language"]) {
  const premise = draft.premise?.trim() ?? "";
  if (draft.premisePublication !== "author-reviewed") {
    return tr(
      language,
      "Publishable case context has not been author-reviewed; raw intake text is excluded.",
      "Публикуемый контекст кейса не проверен автором; исходный текст ввода исключён.",
    );
  }
  return clean(premise, tr(language, "No case context supplied.", "Контекст кейса не указан."));
}

function effectiveCaseReportOptions(options: CaseReportOptions): CaseReportOptions {
  const effective = { ...options, includeDecisionTree: options.presentationMode === "medium" || (options.includeDecisionTree ?? options.presentationMode !== "decision") };
  return (options.audience === "client" || options.presentationMode === "decision" || options.presentationMode === "medium") && (options.includeAuditTrail || options.includeTechnicalIds)
    ? { ...effective, includeAuditTrail: false, includeTechnicalIds: false }
    : effective;
}

function money(language: CaseReportOptions["language"], currency: string, value: number | null) {
  if (value === null) return "-";
  try { return new Intl.NumberFormat(language === "en" ? "en-GB" : "ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${Math.round(value).toLocaleString(language === "en" ? "en-GB" : "ru-RU")} ${currency}`; }
}

function table(headers: string[], rows: TableCell[][], widths?: Array<string | number>, heading?: string | ContentText): ContentTable {
  const headerRows = heading ? 2 : 1;
  const headingRow: TableCell[] = heading ? [
    { ...(typeof heading === "string" ? { text: heading, style: "subheading", margin: [0, 4, 0, 4] as [number, number, number, number] } : heading), headlineLevel: undefined, colSpan: headers.length, border: [false, false, false, false] },
    ...headers.slice(1).map<TableCell>(() => ({ text: "", border: [false, false, false, false] })),
  ] : [];
  return {
    table: {
      headerRows,
      keepWithHeaderRows: 1,
      widths: widths ?? headers.map(() => "*"),
      body: [
        ...(heading ? [headingRow] : []),
        headers.map((value) => ({ text: value, style: "tableHeader" })), ...rows,
      ],
      dontBreakRows: true,
    },
    layout: {
      fillColor: (rowIndex: number) => rowIndex === 0 && heading ? palette.white : rowIndex < headerRows ? palette.navy : (rowIndex - headerRows) % 2 === 1 ? "#f5f8f8" : palette.white,
      hLineColor: () => palette.line,
      vLineColor: () => palette.line,
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
    },
    margin: [0, 6, 0, 14],
  };
}

function section(title: string): ContentText {
  return { text: title, style: "sectionTitle", headlineLevel: 1, margin: [0, 16, 0, 6] };
}

function buildEconomics(draft: StudioDraft, options: CaseReportOptions): Content[] {
  const { language } = options;
  const content: Content[] = [];
  if (draft.dealEconomics) {
    const model = draft.dealEconomics;
    const result = calculateDealEconomics(model);
    const scenarios = model.repaymentBasis === "amortizing" ? [result.amortizing] : model.repaymentBasis === "interest_only" ? [result.interestOnly] : [result.amortizing, result.interestOnly];
    content.push({ text: tr(language, "Investment and cash-flow analysis", "Инвестиционный анализ и денежный поток"), style: "subheading", margin: [0, 8, 0, 6] });
    content.push(table(
      [tr(language, "Input", "Параметр"), tr(language, "Value", "Значение")],
      [
        [tr(language, "Purchase price", "Цена приобретения"), money(language, model.currency, model.purchasePrice)],
        ["LTV", pct(model.loanToValueBps)],
        [tr(language, "Interest rate", "Процентная ставка"), pct(model.annualInterestRateBps)],
        [tr(language, "Term", "Срок"), model.termMonths === null ? "-" : `${model.termMonths} ${tr(language, "months", "мес.")}`],
        [tr(language, "Gross annual income", "Валовой годовой доход"), money(language, model.currency, model.grossAnnualIncome)],
        [tr(language, "Known operating costs", "Известные операционные расходы"), money(language, model.currency, model.annualOperatingCosts)],
        [tr(language, "One-off structure cost", "Разовые расходы структуры"), money(language, model.currency, model.oneOffStructureCost)],
        [tr(language, "Annual structure cost", "Ежегодные расходы структуры"), money(language, model.currency, model.annualStructureCost)],
        [tr(language, "Target cash-on-cash return", "Целевая доходность на капитал"), pct(model.targetAnnualReturnBps)],
      ], ["62%", "38%"]
    ));
    content.push(table(
      [tr(language, "Repayment basis", "Вид погашения"), tr(language, "Debt service", "Обслуживание долга"), tr(language, "Annual cash flow", "Годовой денежный поток"), "CoC", "DSCR"],
      scenarios.map((scenario) => [
        scenario.basis === "amortizing" ? tr(language, "Amortizing", "Амортизируемый") : tr(language, "Interest-only", "Только проценты"),
        money(language, model.currency, scenario.annualDebtService), money(language, model.currency, scenario.annualCashFlow),
        scenario.cashOnCashReturnPercent === null ? "-" : `${scenario.cashOnCashReturnPercent.toFixed(1)}%`, scenario.dscr === null ? "-" : `${scenario.dscr.toFixed(2)}x`,
      ]), ["22%", "21%", "23%", "17%", "17%"]
    ));
    content.push({ text: tr(language, "These are deterministic calculations from supplied assumptions, not probabilities or a forecast. Currency effects, exit costs, tax and unpriced costs are excluded. Use the Decision report for explicit income sensitivities.", "Это детерминированные расчёты по указанным допущениям, не вероятности и не прогноз. Валютные эффекты, расходы выхода, налоги и неоценённые затраты исключены. Явные сценарии дохода доступны в отчёте для принятия решения."), style: "note" });
    if (result.missingInputs.length) content.push({ text: `${tr(language, "Open financial inputs", "Незаполненные финансовые параметры")}: ${result.missingInputs.join(", ")}.`, style: "warning" });
    if (model.assumptions.length) content.push({ ul: model.assumptions
      .filter(item => !/scenario probabilit|вероятност[а-я]* сценар/iu.test(item))
      .map(item => ({ text: item, unbreakable: item.length <= 240 && item.split(/\r?\n/).length <= 4 })),
      style: "bodySmall", margin: [8, 4, 0, 8] });
  }
  if (draft.taxEconomics) {
    const model = draft.taxEconomics;
    const result = calculateTaxEconomics(model);
    content.push({ text: tr(language, "The following figures are an arithmetic scenario only. Rate sources, taxable base, deductibility and eligibility are not established by this model. Do not treat the amounts as verified savings or offset them against a financing shortfall.", "Следующие суммы — только арифметический сценарий. Модель не устанавливает источники ставок, базу, вычеты и применимость. Не считайте суммы подтверждённой экономией и не компенсируйте ими дефицит финансирования."), style: "warning" });
    content.push({ text: tr(language, "Unverified tax scenario — not a tax recommendation", "Непроверенный налоговый сценарий — не налоговая рекомендация"), style: "subheading", margin: [0, 12, 0, 6] });
    content.push(table(
      [tr(language, "Metric", "Показатель"), tr(language, "Result", "Результат")],
      [
        ...(model.taxInputBasis === "rates" ? [
          [tr(language, "Annual taxable base", "Годовая налоговая база"), money(language, model.currency, model.annualTaxBase)],
          [tr(language, "Baseline / optimized tax rates", "Базовая / оптимизированная ставки"), `${pct(model.baselineTaxRateBps)} / ${pct(model.optimizedTaxRateBps)}`],
          [tr(language, "Derived baseline / optimized tax", "Расчётный базовый / оптимизированный налог"), `${money(language, model.currency, result.baselineAnnualTaxCost)} / ${money(language, model.currency, result.optimizedAnnualTaxCost)}`],
        ] : []),
        [tr(language, "Supplied benefit adjustment", "Заданная корректировка выгоды"), pct(model.benefitRealizationBps)],
        [tr(language, "Analysis horizon", "Горизонт анализа"), `${model.analysisHorizonMonths} ${tr(language, "months", "мес.")}`],
        [tr(language, "Annual discount rate", "Годовая ставка дисконтирования"), pct(model.annualDiscountRateBps)],
        [tr(language, "One-off implementation", "Разовые затраты на внедрение"), money(language, model.currency, model.implementationCost)],
        [tr(language, "Annual maintenance", "Годовые затраты на сопровождение"), money(language, model.currency, model.annualMaintenanceCost)],
        [tr(language, "Terminal tax / unwind cost", "Налог / затраты при завершении"), money(language, model.currency, model.terminalTaxOrUnwindCost)],
        [tr(language, "Gross annual tax saving", "Валовая годовая налоговая экономия"), money(language, model.currency, result.grossAnnualTaxSaving)],
        [tr(language, "Recognized annual saving", "Признанная годовая экономия"), money(language, model.currency, result.recognizedAnnualTaxSaving)],
        [tr(language, "Annualized implementation", "Внедрение в пересчёте на год"), money(language, model.currency, result.annualizedImplementationCost)],
        [tr(language, "Annualized net benefit", "Чистый годовой эффект"), money(language, model.currency, result.netAnnualBenefit)],
        [tr(language, "Simple payback", "Простая окупаемость"), result.paybackMonths === null ? tr(language, "Not reached", "Не достигается") : `${result.paybackMonths.toFixed(1)} ${tr(language, "months", "мес.")}`],
        [tr(language, "Lifecycle ROI", "ROI жизненного цикла"), result.lifecycleRoiPercent === null ? "-" : `${result.lifecycleRoiPercent.toFixed(1)}%`],
        ["NPV", money(language, model.currency, result.npv)],
      ], ["62%", "38%"]
    ));
    content.push({ text: tr(language, "The supplied benefit adjustment scales only positive modeled savings; it is not an evidenced probability. It does not reduce a modeled downside.", "Заданная корректировка применяется только к положительной расчётной экономии; это не подтверждённая вероятность. Она не уменьшает расчётный отрицательный результат."), style: "note" });
    if (result.paybackMonths !== null && result.paybackMonths > model.analysisHorizonMonths) content.push({ text: tr(language,
      `Simple payback of ${result.paybackMonths.toFixed(1)} months exceeds the ${model.analysisHorizonMonths}-month analysis horizon.`,
      `Простая окупаемость ${result.paybackMonths.toFixed(1)} мес. превышает горизонт анализа ${model.analysisHorizonMonths} мес.`), style: "warning" });
    if (model.fx) content.push({ text: `ECB ${model.fx.asOf}: 1 ${model.fx.sourceCurrency} = ${model.fx.rate.toPrecision(8)} ${model.fx.targetCurrency}.`, style: "note" });
    if (model.assumptions) content.push({ text: `${tr(language, "Assumptions", "Допущения")}: ${model.assumptions}`, style: "note" });
  }
  return content;
}

function buildCaseReportDefinitionFromModels(
  draft: StudioDraft,
  options: CaseReportOptions,
  reportModel: CanonicalReportModel,
  layoutModel: ReportGraphLayoutModel,
): TDocumentDefinitions {
  options = effectiveCaseReportOptions(options);
  const { language } = options;
  if ((reportModel.publication.status === "final" || reportModel.publication.audience === "client") && !reportModel.readiness.ready) throw new Error(`Report is not ready: ${reportModel.readiness.blockers.join("; ")}`);
  const redactions = new Set(options.redactedNodeIds ?? []);
  if (redactions.size) {
    const visibleIds = new Set(draft.nodes.filter((node) => !redactions.has(node.id)).map((node) => node.id));
    draft = { ...draft, nodes: draft.nodes.filter((node) => visibleIds.has(node.id)), links: draft.links.filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to)) };
  }
  if (options.presentationMode === "decision" || options.presentationMode === "medium") {
    const definition = buildDecisionReport(draft, options, reportModel);
    if (options.includeDecisionTree) {
      definition.content = [
        ...(Array.isArray(definition.content) ? definition.content : [definition.content]),
        ...buildReportGraphAppendix(layoutModel, options, null, [507.28, 749.89], options.presentationMode !== "medium"),
      ];
    }
    return definition;
  }
  const generated = new Date(options.generatedAt);
  const generatedLabel = Number.isNaN(generated.valueOf()) ? options.generatedAt : generated.toLocaleString(language === "en" ? "en-GB" : "ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  const classification = draft.classification;
  const sourceUrls = reportModel.governance.citations.map((citation) => citation.url);
  const safePremise = reportSafePremise(draft, language);
  const nodeCounts = Object.fromEntries(Object.keys(nodeNames).map((type) => [type, draft.nodes.filter((node) => node.type === type).length])) as Record<StudioNodeType, number>;
  const status = options.workspaceFingerprint && options.workspaceFingerprint === options.currentFingerprint
    ? tr(language, "Workspace-saved version", "Версия сохранена в workspace")
    : tr(language, "Working draft - not workspace-saved", "Рабочий черновик - не сохранён в workspace");
  const reportStatus = reportModel.publication.status === "draft"
    ? tr(language, "DRAFT - preliminary analysis", "ЧЕРНОВИК - предварительный анализ")
    : tr(language, "FINAL - Studio report", "ФИНАЛЬНЫЙ - отчёт Studio");
  const outgoing = new Map<string, string[]>();
  let sectionNumber = 1;
  const numberedSection = (en: string, ru: string) => section(`${sectionNumber++}. ${tr(language, en, ru)}`);
  for (const link of draft.links) outgoing.set(link.from, [...(outgoing.get(link.from) ?? []), link.to]);
  const titleById = new Map(draft.nodes.map((node) => [node.id, node.title]));
  const content: Content[] = [
    { text: "GENESIS: JURIS CODEX", style: "brand" },
    { text: clean(options.profileLabel, tr(language, "PROFESSIONAL CASE REPORT", "ПРОФЕССИОНАЛЬНЫЙ ОТЧЁТ ПО КЕЙСУ")).toUpperCase(), style: "kicker" },
    { text: clean(draft.title, tr(language, "Untitled case", "Кейс без названия")), style: "coverTitle" },
    { text: safePremise, style: "coverSummary" },
    {
      columns: [
        { width: "50%", stack: [{ text: tr(language, "PREPARED FOR", "ПОДГОТОВЛЕНО ДЛЯ"), style: "metaLabel" }, { text: clean(options.preparedFor, tr(language, "Not specified", "Не указано")), style: "metaValue" }] },
        { width: "50%", stack: [{ text: tr(language, "PREPARED BY", "ПОДГОТОВИЛ"), style: "metaLabel" }, { text: clean(options.preparedBy, tr(language, "Not specified", "Не указано")), style: "metaValue" }] },
      ], columnGap: 16, margin: [0, 28, 0, 12]
    },
    {
      columns: [
        { width: "50%", stack: [{ text: tr(language, "MATTER REFERENCE", "НОМЕР МАТЕРИАЛА"), style: "metaLabel" }, { text: clean(options.matterReference, "-"), style: "metaValue" }] },
        { width: "50%", stack: [{ text: tr(language, "REPORT STATUS", "СТАТУС ОТЧЁТА"), style: "metaLabel" }, { text: reportStatus, style: "metaValue" }, { text: status, style: "note" }] },
      ], columnGap: 16, margin: [0, 0, 0, 20]
    },
    { text: `${tr(language, "Classification", "Гриф")}: ${options.confidentiality.toUpperCase()}${options.privateCase ? ` - ${tr(language, "PRIVATE CASE", "ПРИВАТНЫЙ КЕЙС")}` : ""}`, style: "classification" },
    { text: tr(language, "Professional-use notice", "Уведомление для профессионального использования"), style: "subheading", margin: [0, 22, 0, 5] },
    { text: tr(language, "This report is generated from the Studio graph. It is a structured working product, not a substitute for jurisdiction-specific legal, tax, financial or regulatory advice. Validate facts, authorities, assumptions and calculations before reliance or circulation.", "Отчёт сформирован из схемы Studio. Это структурированный рабочий материал, а не замена юридической, налоговой, финансовой или регуляторной консультации по соответствующей юрисдикции. До использования или распространения проверьте факты, источники, допущения и расчёты."), style: "notice" },
    { text: tr(language, "Studio review information does not establish independent workflow approval. Recorded runs and independently approved outputs are available through the case workflow.", "Сведения о проверке в Studio не подтверждают независимое утверждение в рабочем процессе. Записанные запуски и независимо утверждённые результаты доступны в деле."), style: "note" },
    { text: `${tr(language, "Generated", "Сформирован")}: ${generatedLabel} UTC`, style: "generated" },
    { text: "", pageBreak: "after" },
    numberedSection("Decision brief", "Резюме для принятия решения"),
    { text: reportStatus, style: "warning" },
    table([tr(language, "Review question", "Вопрос проверки"), tr(language, "Case model summary", "Краткое содержание модели")], caseReportBriefRows(draft, reportModel, language, options.includeEconomics), ["25%", "75%"]),
    { text: options.includeDecisionTree
      ? tr(language, "Selected records and labelled extracts are shown above. The complete graph appendix retains all visible node and connection text. Text supplied in the case keeps its original language.", "Выше приведены выбранные записи и обозначенные фрагменты. Полное приложение к графу сохраняет весь открытый текст узлов и связей. Текст самого кейса сохраняет исходный язык.")
      : tr(language, "Selected records and labelled extracts are shown above. The complete graph text appendix is omitted. Review the case for full node and connection conditions. Text supplied in the case keeps its original language.", "Выше приведены выбранные записи и обозначенные фрагменты. Полное текстовое приложение к графу исключено. Полные условия узлов и связей проверяйте в деле. Текст самого кейса сохраняет исходный язык."), style: "note" },
    { text: "", pageBreak: "after" },
    numberedSection("Case overview", "Обзор кейса"),
    table([tr(language, "Field", "Поле"), tr(language, "Value", "Значение")], [
      [tr(language, "Case ID / version", "ID кейса / версия"), `${draft.caseId} / v${draft.version}`],
      [tr(language, "Jurisdiction", "Юрисдикция"), clean(draft.jurisdiction)],
      [tr(language, "Professional role", "Профессиональная роль"), clean(draft.role)],
      [tr(language, "Practice area", "Область практики"), clean(classification?.practiceArea)],
      [tr(language, "Difficulty", "Сложность"), clean(classification?.difficulty)],
      [tr(language, "Case-entered legal reference date", "Дата правовых источников, указанная в кейсе"), clean(classification?.legalAsOf)],
      [tr(language, "Tags", "Теги"), classification?.tags?.join(", ") || "-"],
      [tr(language, "Tax topics", "Налоговые темы"), classification?.taxTopics?.join(", ") || "-"],
      [tr(language, "Case package", "Пакет кейса"), `${reportModel.case.type.id}@${reportModel.case.type.version}`],
      [tr(language, "Report profile / renderer", "Профиль отчёта / renderer"), `${reportModel.profile.id}@${reportModel.rendererVersion}`],
      [tr(language, "Graph layout contract", "Контракт макета графа"), `${layoutModel.layoutSchemaVersion} · ${layoutModel.layoutAlgorithmVersion} · ${layoutModel.layoutRendererVersion}`],
      [tr(language, "Report state", "Состояние отчёта"), `${reportModel.publication.status.toUpperCase()} · ${reportModel.publication.audience.toUpperCase()}`],
    ], ["38%", "62%"]),
    { text: tr(language, "The case-entered reference date is not a verified legal currency check. Future-dated entries require correction; verify applicable authorities before reliance.", "Дата источников, указанная в кейсе, не подтверждает актуальность права. Будущие даты требуют исправления; проверьте применимые источники перед использованием."), style: "warning" },
    { text: tr(language, "Executive case context", "Ключевой контекст кейса"), style: "subheading", headlineLevel: 2 },
    { text: safePremise, style: "body" },
    { text: tr(language, "Model inventory", "Состав модели"), style: "subheading", headlineLevel: 2, margin: [0, 12, 0, 5] },
    table([tr(language, "Measure", "Показатель"), tr(language, "Count", "Количество")], [
      [tr(language, "Nodes", "Ноды"), String(draft.nodes.length)],
      [tr(language, "Connections", "Связи"), String(draft.links.length)],
      [tr(language, "Evidence items", "Доказательства"), String(nodeCounts.evidence)],
      [tr(language, "Decisions", "Решения"), String(nodeCounts.decision)],
      [tr(language, "Outcomes", "Исходы"), String(nodeCounts.outcome)],
      [tr(language, "Public HTTPS sources", "Публичные HTTPS-источники"), String(sourceUrls.length)],
    ], ["74%", "26%"]),
    { text: tr(language, "Type-aware report scope", "Типовой состав отчёта"), style: "subheading", headlineLevel: 2, margin: [0, 12, 0, 5] },
    { text: reportModel.profile.sections.map((id) => id.replaceAll("_", " ")).join(" · "), style: "bodySmall" },
    { text: `${tr(language, "Canonical report-model fingerprint", "Отпечаток канонической модели отчёта")}: ${reportModel.contentFingerprint}`, style: "fingerprint" },
    { text: `${tr(language, "Presentation layout fingerprint", "Отпечаток макета представления")}: ${layoutModel.layoutFingerprint}`, style: "fingerprint" },
  ];

  content.push(numberedSection("Profile-specific analysis", "Профильный анализ"));
  for (const profileSection of reportModel.sections.filter((item) => !["executive_summary", "sources", "approval", "economics", "scenario_map"].includes(item.id))) {
    const heading = reportSectionNames[profileSection.id][language === "en" ? 0 : 1];
    if (profileSection.items.length) content.push(table(
      [tr(language, "Item", "Элемент"), tr(language, "Professional record", "Профессиональная запись")],
      profileSection.items.map((item) => [options.includeTechnicalIds ? `${item.title}\n[${item.id}]` : item.title, item.detail]), ["35%", "65%"], heading
    ));
    else content.push({ stack: [
      { text: heading, style: "subheading", margin: [0, 10, 0, 5] },
      { text: tr(language, "No structured items are recorded for this section; reviewer completion is required where material.", "Для этого раздела нет структурированных элементов; рецензент должен заполнить его, если он существенен."), style: "warning" },
    ], unbreakable: true });
  }

  if (options.includeEconomics && (draft.dealEconomics || draft.taxEconomics)) {
    content.push(numberedSection("Economics and scenario analysis", "Экономика и сценарный анализ"));
    content.push(...buildEconomics(draft, options));
  }

  const scenarioHeading = numberedSection("Scenario and decision map", "Карта сценария и решений");
  content.push(table(
    [tr(language, "Type", "Тип"), tr(language, "Issue / step", "Вопрос / шаг"), tr(language, "Leads to", "Ведёт к")],
    draft.nodes.map((node) => [
      nodeNames[node.type][language === "en" ? 0 : 1],
      options.includeTechnicalIds ? `${node.title}\n[${node.id}]` : node.title,
      (outgoing.get(node.id) ?? []).map((id) => titleById.get(id) ?? id).join("; ") || tr(language, "Terminal / no outgoing path", "Финал / нет исходящей ветви"),
    ]), ["19%", "42%", "39%"], scenarioHeading
  ));

  if (options.includeRegisters) {
    const registerNodes = draft.nodes.filter((node) => ["fact", "evidence", "entity", "tax_rule", "deadline"].includes(node.type));
    const registerHeading = numberedSection("Facts, evidence and rules register", "Реестр фактов, доказательств и правил");
    if (registerNodes.length) content.push(table(
      [tr(language, "Category", "Категория"), tr(language, "Item", "Элемент"), tr(language, "Detail / verification note", "Описание / примечание о проверке")],
      registerNodes.map((node) => [nodeNames[node.type][language === "en" ? 0 : 1], options.includeTechnicalIds ? `${node.title}\n[${node.id}]` : node.title, clean(node.detail)]),
      ["20%", "31%", "49%"], registerHeading
    )); else content.push({ stack: [registerHeading, { text: tr(language, "No fact, evidence, entity, rule or deadline nodes are present.", "Ноды фактов, доказательств, организаций, правил или сроков отсутствуют."), style: "warning" }], unbreakable: true });
    content.push({ text: tr(language, "Each material item should be marked by the reviewer as verified, source-backed, judgment, confirmation required or uncertain before external circulation.", "Перед внешним распространением рецензент должен отметить каждый существенный элемент как проверенный, подтверждённый источником, суждение, требующий подтверждения или неопределённый."), style: "note" });
  }

  if (options.includeSources) {
    content.push(numberedSection("Authorities and source register", "Реестр правовых источников"));
    if (sourceUrls.length) content.push({ ol: sourceUrls.map((url) => ({ text: url, link: url, color: palette.cyan, decoration: "underline" })), style: "bodySmall", margin: [12, 5, 0, 12] });
    else content.push({ text: tr(language, "No public legal sources are recorded. Add verified HTTPS authorities and a legal as-of date before professional reliance.", "Публичные правовые источники не указаны. До профессионального использования добавьте проверенные HTTPS-источники и дату актуальности права."), style: "warning" });
  }

  if (options.includeAuditTrail && options.audience !== "client") {
    const auditHeading = numberedSection("Authoring and review trail", "История подготовки и проверки");
    const redactionsActive = reportModel.governance.redactions.length > 0;
    const safeEntries = draft.editHistory.map((entry) => {
      const promptAction = entry.action === "prompt_submitted" || entry.action === "prompt_applied" || entry.action === "graph_rebuilt";
      const safeMessage = entry.action === "graph_rebuilt"
        ? tr(language, "Draft reconstruction recorded - raw input excluded", "Зафиксировано перестроение черновика - исходный ввод исключён")
        : promptAction
        ? tr(language, "AI-assisted revision recorded - raw prompt excluded", "Зафиксирована AI-правка - исходный промпт исключён")
        : redactionsActive
          ? tr(language, "Authoring event recorded - message excluded because report redactions are active", "Событие подготовки записано - сообщение исключено из-за активного редактирования отчёта")
          : clean(entry.message);
      return [new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " "), entry.source, entry.action, reportAuditText(safeMessage)];
    });
    if (safeEntries.length) content.push(table([tr(language, "UTC", "UTC"), tr(language, "Source", "Источник"), tr(language, "Action", "Действие"), tr(language, "Record", "Запись")], safeEntries, ["18%", "13%", "20%", "49%"], auditHeading));
    else content.push({ stack: [auditHeading, { text: tr(language, "No authoring history is recorded.", "История подготовки отсутствует."), style: "body" }], unbreakable: true });
  }

  const verificationStart = content.length;
  content.push(numberedSection("Verification and sign-off", "Проверка и утверждение"));
  content.push({
    ul: [
      tr(language, "Facts and evidence reconciled to the underlying file.", "Факты и доказательства сверены с материалами дела."),
      tr(language, "Legal authorities remain current as of the stated date.", "Правовые источники актуальны на указанную дату."),
      tr(language, "Assumptions, exclusions and uncertainties are explicitly disclosed.", "Допущения, исключения и неопределённости раскрыты явно."),
      tr(language, "Economics and scenario assumptions are independently checked.", "Экономика и сценарные допущения проверены независимо."),
      tr(language, "Confidentiality, privilege, conflicts and circulation scope are confirmed.", "Конфиденциальность, privilege, конфликты и круг распространения подтверждены."),
    ].map((item) => ({ text: `[ ] ${item}` })), style: "checklist", margin: [6, 6, 0, 16]
  });
  content.push(table(
    [tr(language, "Reviewer", "Рецензент"), tr(language, "Role", "Роль"), tr(language, "Date", "Дата"), tr(language, "Sign-off / qualification", "Утверждение / оговорка")],
    [["", "", "", "\n"]], ["24%", "20%", "18%", "38%"]
  ));
  content.push({ text: `${tr(language, "Current content fingerprint", "Отпечаток текущего содержания")}: ${options.currentFingerprint || tr(language, "pending", "ожидается")}`, style: "fingerprint" });
  if (options.includeTechnicalIds && draft.protection) content.push({ text: `${tr(language, "Lineage code", "Код линии версий")}: ${draft.protection.currentCode || "pending"}\n${tr(language, "Copy policy", "Политика копирования")}: ${draft.protection.copyPolicy}`, style: "fingerprint" });
  content.push({ stack: content.splice(verificationStart), unbreakable: true });
  if (options.includeDecisionTree) content.push(...buildReportGraphAppendix(layoutModel, options, sectionNumber++));

  const confidentialityLabel = options.confidentiality.toUpperCase();
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [39.685, 39.685, 39.685, 39.685],
    language: language === "en" ? "en-GB" : "ru-RU",
    displayTitle: true,
    defaultStyle: { font: "Roboto", fontSize: 9.2, color: palette.ink, lineHeight: 1.25 },
    content,
    // A table/list container may start here while all of its rendered rows move
    // to the next page. Only actual body content can keep a heading on this page.
    pageBreakBefore: (current, following) => Boolean(current.headlineLevel)
      && !following.some((node) => !node.headlineLevel && !node.id?.startsWith("report-furniture-") && Boolean(node.text || node.svg || node.canvas)),
    header: (currentPage: number) => currentPage === 1 ? null : ({ columns: [{ id: `report-furniture-brand-${currentPage}`, text: "GENESIS: JURIS CODEX", style: "headerBrand" }, { id: `report-furniture-case-${currentPage}`, text: `${draft.caseId} · v${draft.version}`, alignment: "right", style: "headerMeta" }], margin: [44, 22, 44, 0] }),
    footer: (currentPage: number, pageCount: number) => ({ columns: [{ id: `report-furniture-classification-${currentPage}`, text: confidentialityLabel, color: palette.gold, bold: true }, { id: `report-furniture-page-${currentPage}`, text: `${currentPage} / ${pageCount}`, alignment: "right" }], fontSize: 7.5, color: "#66777e", margin: [44, 0, 44, 18] }),
    styles: {
      brand: { fontSize: 10, bold: true, color: palette.cyan, characterSpacing: 1.8, margin: [0, 8, 0, 30] },
      kicker: { fontSize: 8, bold: true, color: palette.gold, characterSpacing: 1.3, margin: [0, 0, 0, 10] },
      coverTitle: { fontSize: 28, bold: true, color: palette.ink, lineHeight: 1.08, margin: [0, 0, 0, 14] },
      coverSummary: { fontSize: 12, color: palette.navy, lineHeight: 1.45, margin: [0, 0, 0, 6] },
      metaLabel: { fontSize: 7.4, bold: true, color: "#66777e", characterSpacing: 1 },
      metaValue: { fontSize: 10.5, bold: true, color: palette.navy, margin: [0, 4, 0, 0] },
      classification: { fontSize: 8, bold: true, color: palette.white, fillColor: palette.navy, background: palette.navy, margin: [0, 4, 0, 0] },
      subheading: { fontSize: 11, bold: true, color: palette.navy },
      notice: { fontSize: 9, color: palette.ink, fillColor: palette.mist, background: palette.mist, margin: [0, 2, 0, 10] },
      generated: { fontSize: 8, color: "#66777e", margin: [0, 24, 0, 0] },
      sectionTitle: { fontSize: 16, bold: true, color: palette.navy },
      tableHeader: { color: palette.white, bold: true, fontSize: 8 },
      body: { fontSize: 9.5, lineHeight: 1.35 },
      bodySmall: { fontSize: 8.3, lineHeight: 1.3 },
      note: { fontSize: 8.2, color: "#53666e", italics: true, margin: [0, 2, 0, 10] },
      warning: { fontSize: 8.6, bold: true, color: palette.red, margin: [0, 4, 0, 10] },
      checklist: { fontSize: 9, lineHeight: 1.45 },
      fingerprint: { font: "Roboto", fontSize: 6.6, color: "#66777e", margin: [0, 5, 0, 0] },
      headerBrand: { fontSize: 7.5, bold: true, color: palette.cyan },
      headerMeta: { fontSize: 7.5, color: "#66777e" },
      graphNodeType: { fontSize: 7, bold: true, color: palette.cyan, characterSpacing: .6 },
      graphNodeTitle: { fontSize: 8.5, bold: true, color: palette.navy, margin: [0, 2, 0, 2] },
      graphNodeDetail: { fontSize: 7.3, color: palette.ink, lineHeight: 1.18 },
      graphNodeCondition: { fontSize: 6.5, color: "#53666e", lineHeight: 1.12, margin: [0, 2, 0, 0] },
    },
    info: {
      title: `${draft.title} - ${clean(options.profileLabel, "professional case report")}`,
      author: options.preparedBy || "GENESIS: JURIS CODEX",
      subject: `${draft.caseId} v${draft.version}`,
      keywords: `legal case report, ${classification?.practiceArea ?? "legal"}, ${draft.jurisdiction}`,
      creator: "GENESIS: JURIS CODEX Studio",
      creationDate: generated,
    },
  };
}

function caseReportPresentationFingerprint(
  draft: StudioDraft,
  options: CaseReportOptions,
  reportModel: CanonicalReportModel,
  layoutModel: ReportGraphLayoutModel,
) {
  const effectiveOptions = effectiveCaseReportOptions(options);
  const redactionsActive = (effectiveOptions.redactedNodeIds?.length ?? 0) > 0;
  const auditTrail = effectiveOptions.includeAuditTrail && effectiveOptions.audience !== "client"
    ? draft.editHistory.map((entry) => ({
      action: entry.action,
      at: entry.createdAt,
      message: entry.action === "graph_rebuilt"
        ? "reconstruction-input-excluded-v1"
        : ["prompt_submitted", "prompt_applied"].includes(entry.action)
        ? "prompt-excluded"
        : redactionsActive ? "redaction-excluded" : entry.message,
      source: entry.source,
    }))
    : [];
  return canonicalFingerprint({
    format: "genesis-juris-case-report-presentation-binding",
    version: 5,
    presentationMode: effectiveOptions.presentationMode ?? "full",
    decisionRendererVersion: effectiveOptions.presentationMode === "medium" ? "1.2.0" : "1.1.0",
    // Full keeps short economic assumptions together, avoiding orphaned final words.
    // Keep existing Base/Medium receipts stable; earlier Full output is stale.
    ...((effectiveOptions.presentationMode ?? "full") === "full" ? { fullBriefRendererVersion: 4 } : {}),
    includeDecisionTree: effectiveOptions.includeDecisionTree,
    auditSymbolFont: REPORT_AUDIT_SYMBOL_FONT_SHA256,
    reportFingerprint: reportModel.contentFingerprint,
    layoutFingerprint: layoutModel.layoutFingerprint,
    language: effectiveOptions.language,
    profileId: effectiveOptions.profileId,
    profileLabel: effectiveOptions.profileLabel.trim(),
    audience: effectiveOptions.audience,
    confidentiality: effectiveOptions.confidentiality,
    preparedBy: effectiveOptions.preparedBy.trim(),
    preparedFor: effectiveOptions.preparedFor.trim(),
    matterReference: effectiveOptions.matterReference.trim(),
    includeEconomics: effectiveOptions.includeEconomics,
    includeRegisters: effectiveOptions.includeRegisters,
    includeSources: effectiveOptions.includeSources,
    includeAuditTrail: effectiveOptions.includeAuditTrail,
    includeTechnicalIds: effectiveOptions.includeTechnicalIds,
    technicalProtection: effectiveOptions.includeTechnicalIds && draft.protection ? {
      currentCode: draft.protection.currentCode,
      copyPolicy: draft.protection.copyPolicy,
    } : null,
    currentFingerprint: effectiveOptions.currentFingerprint,
    workspaceFingerprint: effectiveOptions.workspaceFingerprint,
    currentPublicationFingerprint: effectiveOptions.currentPublicationFingerprint,
    workspacePublicationFingerprint: effectiveOptions.workspacePublicationFingerprint,
    privateCase: effectiveOptions.privateCase,
    status: effectiveOptions.status ?? "draft",
    reviewerName: effectiveOptions.reviewerName?.trim() ?? "",
    reviewerApproved: effectiveOptions.reviewerApproved ?? false,
    redactedNodeIds: [...new Set(effectiveOptions.redactedNodeIds ?? [])].sort(),
    premisePublication: draft.premisePublication === "author-reviewed" ? "author-reviewed" : "unreviewed",
    auditTrail,
  });
}

function buildCaseReportModels(draft: StudioDraft, options: CaseReportOptions) {
  options = effectiveCaseReportOptions(options);
  const reportModel = buildCanonicalReportModel(draft, {
    profileId: options.profileId,
    status: options.status ?? "draft",
    audience: options.audience,
    preparedBy: options.preparedBy,
    preparedFor: options.preparedFor,
    reviewerName: options.reviewerName ?? "",
    reviewerApproved: options.reviewerApproved ?? false,
    currentFingerprint: options.currentFingerprint,
    workspaceFingerprint: options.workspaceFingerprint,
    currentPublicationFingerprint: options.currentPublicationFingerprint,
    workspacePublicationFingerprint: options.workspacePublicationFingerprint,
    redactedNodeIds: options.redactedNodeIds,
    confidential: options.privateCase || options.confidentiality === "confidential",
  });
  const layoutModel = buildReportGraphLayout(deriveReportGraphLayoutInput(draft, reportModel, {
    language: options.language,
    redactedNodeIds: options.redactedNodeIds,
  }));
  const presentationFingerprint = caseReportPresentationFingerprint(draft, options, reportModel, layoutModel);
  return { reportModel, layoutModel, presentationFingerprint };
}

/** Derives the bindings used by receipt freshness checks through the same
 * canonical-model and deterministic-layout path as final artifact generation. */
export function caseReportReceiptBinding(draft: StudioDraft, options: CaseReportOptions): CurrentReportReceiptBinding {
  const { reportModel, layoutModel, presentationFingerprint } = buildCaseReportModels(draft, options);
  return {
    reportFingerprint: reportModel.contentFingerprint,
    layoutFingerprint: layoutModel.layoutFingerprint,
    presentationFingerprint,
  };
}

export type CaseReportArtifacts = {
  definition: TDocumentDefinitions;
  reportModel: CanonicalReportModel;
  layoutModel: ReportGraphLayoutModel;
  presentationFingerprint: string;
};

function assertGovernedReportDefinitionText(definition: TDocumentDefinitions) {
  const visited = new WeakSet<object>();
  const inspect = (value: unknown): void => {
    if (typeof value === "string") {
      const issue = reportGraphGovernedTextIssue(value);
      if (issue) {
        throw new ReportGraphLayoutError(
          "INPUT_INVALID",
          issue.reason === "XML_INVALID"
            ? `The report definition contains ${issue.codePoint}, which is forbidden by the XML 1.0 renderer`
            : `The report definition contains ${issue.codePoint}, which is absent from the governed Roboto fonts`,
          { codePoint: issue.codePoint, field: "documentDefinition", reason: issue.reason },
        );
      }
      return;
    }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) inspect(item);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) {
      // Only the exact scalar supported by the pinned audit face bypasses the
      // Roboto check. XML, other unsupported glyphs and graph inputs stay strict.
      if (key === "text" && record.font === REPORT_AUDIT_SYMBOL_FONT
        && typeof item === "string" && /^→+$/u.test(item)) continue;
      inspect(item);
    }
  };
  inspect(definition);

  const dynamic = definition as TDocumentDefinitions & {
    header?: unknown;
    footer?: unknown;
    background?: unknown;
  };
  const pageSize = { height: 841.89, orientation: "portrait", width: 595.28 };
  for (const source of [dynamic.header, dynamic.footer, dynamic.background]) {
    if (typeof source !== "function") continue;
    const render = source as (currentPage: number, pageCount: number, size: typeof pageSize) => unknown;
    inspect(render(2, 2, pageSize));
  }
}

export function buildCaseReportArtifacts(draft: StudioDraft, options: CaseReportOptions): CaseReportArtifacts {
  const { reportModel, layoutModel, presentationFingerprint } = buildCaseReportModels(draft, options);
  // pdfmake mutates content arrays during layout. A report must never lend it
  // live Studio state: those mutations otherwise corrupt the case on rerender.
  const definition = buildCaseReportDefinitionFromModels(structuredClone(draft), options, reportModel, layoutModel);
  assertGovernedReportDefinitionText(definition);
  return {
    definition,
    reportModel,
    layoutModel,
    presentationFingerprint,
  };
}

export function buildCaseReportDefinition(draft: StudioDraft, options: CaseReportOptions): TDocumentDefinitions {
  return buildCaseReportArtifacts(draft, options).definition;
}

export function mayPersistGeneratedReportReceipt(draft: Pick<StudioDraft, "protection">, options: Pick<CaseReportOptions, "persistReportReceiptOnDevice" | "privateCase">) {
  return options.persistReportReceiptOnDevice
    && !options.privateCase
    && !draft.protection?.copyProtected
    && !draft.protection?.parentCode
    && !draft.protection?.currentCode
    && !draft.protection?.seal;
}

export function assertCaseReportGenerationAuthorized(canGenerate: boolean) {
  if (canGenerate !== true) throw new Error("Report generation is unavailable in inspection-only mode.");
}

type CaseReportAuthorization = { canGenerate: boolean; isCurrent?: () => boolean; revalidate?: () => Promise<void> };

function assertCurrentReportAuthority(authorization: CaseReportAuthorization) {
  assertCaseReportGenerationAuthorized(authorization?.canGenerate);
  if (authorization.isCurrent && !authorization.isCurrent()) throw new Error("Report context is no longer active.");
}

async function renderCaseReport(draft: StudioDraft, options: CaseReportOptions, authorization: CaseReportAuthorization) {
  assertCurrentReportAuthority(authorization);
  const [{ default: pdfMake }, { default: pdfFonts }, { default: auditFont }] = await Promise.all([
    withLocalChunkRecovery(() => import("pdfmake/build/pdfmake.js")),
    withLocalChunkRecovery(() => import("pdfmake/build/vfs_fonts.js")),
    withLocalChunkRecovery(() => import("./report-audit-symbol-font.v1.json")),
  ]);
  assertCurrentReportAuthority(authorization);
  (pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem({ ...pdfFonts, ...auditFont.vfs });
  const { definition, reportModel, layoutModel, presentationFingerprint } = buildCaseReportArtifacts(draft, options);
  const blob = await pdfBlobFromDocument(pdfMake.createPdf(definition, undefined, CASE_REPORT_PDF_FONTS));
  assertCurrentReportAuthority(authorization);
  // Logout may happen during PDF rendering even if a cross-tab signal is lost.
  // Recheck the server before exposing the blob, download or receipt.
  await authorization.revalidate?.();
  assertCurrentReportAuthority(authorization);
  return { blob, reportModel, layoutModel, presentationFingerprint };
}

/** The preview uses the export renderer and its authorization/readiness checks.
 * Viewing a preview does not record a download receipt or reviewer approval. */
export async function createCaseReportPreview(draft: StudioDraft, options: CaseReportOptions, authorization: CaseReportAuthorization) {
  return (await renderCaseReport(draft, options, authorization)).blob;
}

export async function downloadCaseReport(draft: StudioDraft, options: CaseReportOptions, authorization: CaseReportAuthorization) {
  const { blob, reportModel, layoutModel, presentationFingerprint } = await renderCaseReport(draft, options, authorization);
  assertCurrentReportAuthority(authorization);
  startReportDownload(blob, `${draft.caseId || "case"}-v${draft.version || "0"}-${options.profileId || "case-report"}-${options.audience}.pdf`);
  const receipt = reportReceipt(reportModel, options.generatedAt, {
    layoutSchemaVersion: layoutModel.layoutSchemaVersion,
    layoutAlgorithmVersion: layoutModel.layoutAlgorithmVersion,
    layoutRendererVersion: layoutModel.layoutRendererVersion,
    layoutFingerprint: layoutModel.layoutFingerprint,
    presentationFingerprint,
  });
  assertCurrentReportAuthority(authorization);
  try {
    writeStoredReportReceipt(window.localStorage, {
      scope: options.reportReceiptStorageScope,
      eligible: mayPersistGeneratedReportReceipt(draft, options),
      caseId: draft.caseId,
      profileId: options.profileId,
    }, receipt);
  } catch { /* Receipt persistence is optional and contains no case content. */ }
  return receipt;
}
