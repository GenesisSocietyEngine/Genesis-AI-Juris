import { calculateDealEconomics, estimateDealCashFlowProbabilities } from "./deal-economics";
import { calculateTaxEconomics } from "./tax-economics";
import { buildReportGraphLayout, deriveReportGraphLayoutInput, reportGraphGovernedTextIssue, ReportGraphLayoutError, type ReportGraphLayoutModel } from "./report-graph-layout";
import { buildReportGraphAppendix } from "./report-graph-pdf";
import { canonicalFingerprint } from "./case-integrity";
import type { StudioDraft, StudioNodeType } from "./types";
import { buildCanonicalReportModel, reportReceipt, writeStoredReportReceipt, type CanonicalReportModel, type CurrentReportReceiptBinding, type ReportSectionId } from "./report-model";
import type { Content, ContentTable, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";

export type CaseReportOptions = {
  language: "en" | "ru";
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
  return options.audience === "client" && (options.includeAuditTrail || options.includeTechnicalIds)
    ? { ...options, includeAuditTrail: false, includeTechnicalIds: false }
    : options;
}

function money(language: CaseReportOptions["language"], currency: string, value: number | null) {
  if (value === null) return "-";
  try { return new Intl.NumberFormat(language === "en" ? "en-GB" : "ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${Math.round(value).toLocaleString(language === "en" ? "en-GB" : "ru-RU")} ${currency}`; }
}

function table(headers: string[], rows: TableCell[][], widths?: Array<string | number>): ContentTable {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => "*"),
      body: [headers.map((value) => ({ text: value, style: "tableHeader" })), ...rows],
      dontBreakRows: true,
    },
    layout: {
      fillColor: (rowIndex: number) => rowIndex === 0 ? palette.navy : rowIndex % 2 === 0 ? "#f5f8f8" : palette.white,
      hLineColor: () => palette.line,
      vLineColor: () => palette.line,
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
    },
    margin: [0, 6, 0, 14],
  };
}

function section(title: string): Content {
  return { text: title, style: "sectionTitle", margin: [0, 16, 0, 6] };
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
    const estimate = estimateDealCashFlowProbabilities(model, result);
    if (estimate) {
      const labels = language === "en"
        ? { loss: "Loss", below_target: "Positive - below target", target_to_double: "Target to 2x target", strong_upside: "Strong upside" }
        : { loss: "Убыток", below_target: "Плюс - ниже цели", target_to_double: "От цели до 2x", strong_upside: "Сильный рост" };
      content.push({ text: tr(language, "Illustrative annual cash-flow probability ranges", "Иллюстративные диапазоны вероятности годового денежного потока"), style: "subheading" });
      content.push(table(
        [tr(language, "Range", "Диапазон"), tr(language, "Probability", "Вероятность"), tr(language, "Cash-flow boundary", "Граница потока")],
        estimate.bands.map((band) => [labels[band.key], `${band.probabilityPercent.toFixed(1)}%`, band.minimum === null ? `< ${money(language, model.currency, band.maximum)}` : band.maximum === null ? `>= ${money(language, model.currency, band.minimum)}` : `${money(language, model.currency, band.minimum)} - ${money(language, model.currency, band.maximum)}`]),
        ["38%", "20%", "42%"]
      ));
      content.push({ text: tr(language,
        `Rationale: ${estimate.usesRepaymentBasisPrior ? `repayment-basis weights are ${(100 - model.scenarioProbabilities.interestOnlyBps / 100).toFixed(1)}% amortizing and ${(model.scenarioProbabilities.interestOnlyBps / 100).toFixed(1)}% interest-only; ` : "only the stated repayment basis is used; "}${estimate.usesOperatingCostStress ? `combined vacancy and operating-cost stresses are 10%, 20% and 30% of gross rent with weights ${(model.scenarioProbabilities.favorableBps / 100).toFixed(1)}%, ${(model.scenarioProbabilities.baseBps / 100).toFixed(1)}% and ${(model.scenarioProbabilities.stressedBps / 100).toFixed(1)}%.` : "the stated operating-cost amount is used without an extra stress deduction."}`,
        `Обоснование: ${estimate.usesRepaymentBasisPrior ? `веса вида погашения составляют ${(100 - model.scenarioProbabilities.interestOnlyBps / 100).toFixed(1)}% для амортизации и ${(model.scenarioProbabilities.interestOnlyBps / 100).toFixed(1)}% для interest-only; ` : "используется только указанный вид погашения; "}${estimate.usesOperatingCostStress ? `совокупные потери от вакантности и операционные расходы моделируются на уровнях 10%, 20% и 30% валовой аренды с весами ${(model.scenarioProbabilities.favorableBps / 100).toFixed(1)}%, ${(model.scenarioProbabilities.baseBps / 100).toFixed(1)}% и ${(model.scenarioProbabilities.stressedBps / 100).toFixed(1)}%.` : "используется указанная сумма операционных расходов без дополнительного стресс-вычета."}`
      ), style: "note" });
    }
    if (result.missingInputs.length) content.push({ text: `${tr(language, "Open financial inputs", "Незаполненные финансовые параметры")}: ${result.missingInputs.join(", ")}.`, style: "warning" });
    if (model.assumptions.length) content.push({ ul: model.assumptions, style: "bodySmall", margin: [8, 4, 0, 8] });
  }
  if (draft.taxEconomics) {
    const model = draft.taxEconomics;
    const result = calculateTaxEconomics(model);
    content.push({ text: tr(language, "Tax-structure economics", "Экономика налоговой структуры"), style: "subheading", margin: [0, 12, 0, 6] });
    content.push(table(
      [tr(language, "Metric", "Показатель"), tr(language, "Result", "Результат")],
      [
        ...(model.taxInputBasis === "rates" ? [
          [tr(language, "Annual taxable base", "Годовая налоговая база"), money(language, model.currency, model.annualTaxBase)],
          [tr(language, "Baseline / optimized tax rates", "Базовая / оптимизированная ставки"), `${pct(model.baselineTaxRateBps)} / ${pct(model.optimizedTaxRateBps)}`],
          [tr(language, "Derived baseline / optimized tax", "Расчётный базовый / оптимизированный налог"), `${money(language, model.currency, result.baselineAnnualTaxCost)} / ${money(language, model.currency, result.optimizedAnnualTaxCost)}`],
        ] : []),
        [tr(language, "Gross annual tax saving", "Валовая годовая налоговая экономия"), money(language, model.currency, result.grossAnnualTaxSaving)],
        [tr(language, "Recognized annual saving", "Признанная годовая экономия"), money(language, model.currency, result.recognizedAnnualTaxSaving)],
        [tr(language, "Annualized implementation", "Внедрение в пересчёте на год"), money(language, model.currency, result.annualizedImplementationCost)],
        [tr(language, "Annualized net benefit", "Чистый годовой эффект"), money(language, model.currency, result.netAnnualBenefit)],
        [tr(language, "Simple payback", "Простая окупаемость"), result.paybackMonths === null ? tr(language, "Not reached", "Не достигается") : `${result.paybackMonths.toFixed(1)} ${tr(language, "months", "мес.")}`],
        [tr(language, "Lifecycle ROI", "ROI жизненного цикла"), result.lifecycleRoiPercent === null ? "-" : `${result.lifecycleRoiPercent.toFixed(1)}%`],
        ["NPV", money(language, model.currency, result.npv)],
      ], ["62%", "38%"]
    ));
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
  const generated = new Date(options.generatedAt);
  const generatedLabel = Number.isNaN(generated.valueOf()) ? options.generatedAt : generated.toLocaleString(language === "en" ? "en-GB" : "ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  const classification = draft.classification;
  const sourceUrls = reportModel.governance.citations.map((citation) => citation.url);
  const safePremise = reportSafePremise(draft, language);
  const nodeCounts = Object.fromEntries(Object.keys(nodeNames).map((type) => [type, draft.nodes.filter((node) => node.type === type).length])) as Record<StudioNodeType, number>;
  const status = options.workspaceFingerprint && options.workspaceFingerprint === options.currentFingerprint
    ? tr(language, "Workspace-saved version", "Версия сохранена в workspace")
    : tr(language, "Working draft - not workspace-saved", "Рабочий черновик - не сохранён в workspace");
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
        { width: "50%", stack: [{ text: tr(language, "REPORT STATUS", "СТАТУС ОТЧЁТА"), style: "metaLabel" }, { text: status, style: "metaValue" }] },
      ], columnGap: 16, margin: [0, 0, 0, 20]
    },
    { text: `${tr(language, "Classification", "Гриф")}: ${options.confidentiality.toUpperCase()}${options.privateCase ? ` - ${tr(language, "PRIVATE CASE", "ПРИВАТНЫЙ КЕЙС")}` : ""}`, style: "classification" },
    { text: tr(language, "Professional-use notice", "Уведомление для профессионального использования"), style: "subheading", margin: [0, 22, 0, 5] },
    { text: tr(language, "This report is generated from the reviewed Studio graph. It is a structured working product, not a substitute for jurisdiction-specific legal, tax, financial or regulatory advice. Validate facts, authorities, assumptions and calculations before reliance or circulation.", "Отчёт сформирован из проверенной схемы Studio. Это структурированный рабочий материал, а не замена юридической, налоговой, финансовой или регуляторной консультации по соответствующей юрисдикции. До использования или распространения проверьте факты, источники, допущения и расчёты."), style: "notice" },
    { text: `${tr(language, "Generated", "Сформирован")}: ${generatedLabel} UTC`, style: "generated" },
    { text: "", pageBreak: "after" },
    numberedSection("Case overview", "Обзор кейса"),
    table([tr(language, "Field", "Поле"), tr(language, "Value", "Значение")], [
      [tr(language, "Case ID / version", "ID кейса / версия"), `${draft.caseId} / v${draft.version}`],
      [tr(language, "Jurisdiction", "Юрисдикция"), clean(draft.jurisdiction)],
      [tr(language, "Professional role", "Профессиональная роль"), clean(draft.role)],
      [tr(language, "Practice area", "Область практики"), clean(classification?.practiceArea)],
      [tr(language, "Difficulty", "Сложность"), clean(classification?.difficulty)],
      [tr(language, "Legal / guidance as of", "Право / guidance на дату"), clean(classification?.legalAsOf)],
      [tr(language, "Tags", "Теги"), classification?.tags?.join(", ") || "-"],
      [tr(language, "Tax topics", "Налоговые темы"), classification?.taxTopics?.join(", ") || "-"],
      [tr(language, "Case package", "Пакет кейса"), `${reportModel.case.type.id}@${reportModel.case.type.version}`],
      [tr(language, "Report profile / renderer", "Профиль отчёта / renderer"), `${reportModel.profile.id}@${reportModel.rendererVersion}`],
      [tr(language, "Graph layout contract", "Контракт макета графа"), `${layoutModel.layoutSchemaVersion} · ${layoutModel.layoutAlgorithmVersion} · ${layoutModel.layoutRendererVersion}`],
      [tr(language, "Report state", "Состояние отчёта"), `${reportModel.publication.status.toUpperCase()} · ${reportModel.publication.audience.toUpperCase()}`],
    ], ["38%", "62%"]),
    { text: tr(language, "Executive case context", "Ключевой контекст кейса"), style: "subheading" },
    { text: safePremise, style: "body" },
    { text: tr(language, "Review snapshot", "Сводка проверки"), style: "subheading", margin: [0, 12, 0, 5] },
    table([tr(language, "Measure", "Показатель"), tr(language, "Count", "Количество")], [
      [tr(language, "Nodes", "Ноды"), String(draft.nodes.length)],
      [tr(language, "Connections", "Связи"), String(draft.links.length)],
      [tr(language, "Evidence items", "Доказательства"), String(nodeCounts.evidence)],
      [tr(language, "Decisions", "Решения"), String(nodeCounts.decision)],
      [tr(language, "Outcomes", "Исходы"), String(nodeCounts.outcome)],
      [tr(language, "Public HTTPS sources", "Публичные HTTPS-источники"), String(sourceUrls.length)],
    ], ["74%", "26%"]),
    { text: tr(language, "Type-aware report scope", "Типовой состав отчёта"), style: "subheading", margin: [0, 12, 0, 5] },
    { text: reportModel.profile.sections.map((id) => id.replaceAll("_", " ")).join(" · "), style: "bodySmall" },
    { text: `${tr(language, "Canonical report-model fingerprint", "Отпечаток канонической модели отчёта")}: ${reportModel.contentFingerprint}`, style: "fingerprint" },
    { text: `${tr(language, "Presentation layout fingerprint", "Отпечаток макета представления")}: ${layoutModel.layoutFingerprint}`, style: "fingerprint" },
  ];

  content.push(numberedSection("Profile-specific analysis", "Профильный анализ"));
  for (const profileSection of reportModel.sections.filter((item) => !["executive_summary", "sources", "approval", "economics", "scenario_map"].includes(item.id))) {
    content.push({ text: reportSectionNames[profileSection.id][language === "en" ? 0 : 1], style: "subheading", margin: [0, 10, 0, 5] });
    if (profileSection.items.length) content.push(table(
      [tr(language, "Item", "Элемент"), tr(language, "Professional record", "Профессиональная запись")],
      profileSection.items.map((item) => [options.includeTechnicalIds ? `${item.title}\n[${item.id}]` : item.title, item.detail]), ["35%", "65%"]
    ));
    else content.push({ text: tr(language, "No structured items are recorded for this section; reviewer completion is required where material.", "Для этого раздела нет структурированных элементов; рецензент должен заполнить его, если он существенен."), style: "warning" });
  }

  if (options.includeEconomics && (draft.dealEconomics || draft.taxEconomics)) {
    content.push(numberedSection("Economics and scenario analysis", "Экономика и сценарный анализ"));
    content.push(...buildEconomics(draft, options));
  }

  content.push(numberedSection("Scenario and decision map", "Карта сценария и решений"));
  content.push(table(
    [tr(language, "Type", "Тип"), tr(language, "Issue / step", "Вопрос / шаг"), tr(language, "Leads to", "Ведёт к")],
    draft.nodes.map((node) => [
      nodeNames[node.type][language === "en" ? 0 : 1],
      options.includeTechnicalIds ? `${node.title}\n[${node.id}]` : node.title,
      (outgoing.get(node.id) ?? []).map((id) => titleById.get(id) ?? id).join("; ") || tr(language, "Terminal / no outgoing path", "Финал / нет исходящей ветви"),
    ]), ["19%", "42%", "39%"]
  ));

  if (options.includeRegisters) {
    const registerNodes = draft.nodes.filter((node) => ["fact", "evidence", "entity", "tax_rule", "deadline"].includes(node.type));
    content.push(numberedSection("Facts, evidence and rules register", "Реестр фактов, доказательств и правил"));
    if (registerNodes.length) content.push(table(
      [tr(language, "Category", "Категория"), tr(language, "Item", "Элемент"), tr(language, "Detail / verification note", "Описание / примечание о проверке")],
      registerNodes.map((node) => [nodeNames[node.type][language === "en" ? 0 : 1], options.includeTechnicalIds ? `${node.title}\n[${node.id}]` : node.title, clean(node.detail)]),
      ["20%", "31%", "49%"]
    )); else content.push({ text: tr(language, "No fact, evidence, entity, rule or deadline nodes are present.", "Ноды фактов, доказательств, организаций, правил или сроков отсутствуют."), style: "warning" });
    content.push({ text: tr(language, "Each material item should be marked by the reviewer as verified, source-backed, judgment, confirmation required or uncertain before external circulation.", "Перед внешним распространением рецензент должен отметить каждый существенный элемент как проверенный, подтверждённый источником, суждение, требующий подтверждения или неопределённый."), style: "note" });
  }

  if (options.includeSources) {
    content.push(numberedSection("Authorities and source register", "Реестр правовых источников"));
    if (sourceUrls.length) content.push({ ol: sourceUrls.map((url) => ({ text: url, link: url, color: palette.cyan, decoration: "underline" })), style: "bodySmall", margin: [12, 5, 0, 12] });
    else content.push({ text: tr(language, "No public legal sources are recorded. Add verified HTTPS authorities and a legal as-of date before professional reliance.", "Публичные правовые источники не указаны. До профессионального использования добавьте проверенные HTTPS-источники и дату актуальности права."), style: "warning" });
  }

  if (options.includeAuditTrail && options.audience !== "client") {
    content.push(numberedSection("Authoring and review trail", "История подготовки и проверки"));
    const redactionsActive = reportModel.governance.redactions.length > 0;
    const safeEntries = draft.editHistory.map((entry) => {
      const promptAction = entry.action === "prompt_submitted" || entry.action === "prompt_applied" || entry.action === "graph_rebuilt";
      const safeMessage = promptAction
        ? tr(language, "AI-assisted revision recorded - raw prompt excluded", "Зафиксирована AI-правка - исходный промпт исключён")
        : redactionsActive
          ? tr(language, "Authoring event recorded - message excluded because report redactions are active", "Событие подготовки записано - сообщение исключено из-за активного редактирования отчёта")
          : clean(entry.message);
      return [new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " "), entry.source, entry.action, safeMessage];
    });
    if (safeEntries.length) content.push(table([tr(language, "UTC", "UTC"), tr(language, "Source", "Источник"), tr(language, "Action", "Действие"), tr(language, "Record", "Запись")], safeEntries, ["18%", "13%", "20%", "49%"]));
    else content.push({ text: tr(language, "No authoring history is recorded.", "История подготовки отсутствует."), style: "body" });
  }

  content.push(numberedSection("Verification and sign-off", "Проверка и утверждение"));
  content.push({
    ul: [
      tr(language, "Facts and evidence reconciled to the underlying file.", "Факты и доказательства сверены с материалами дела."),
      tr(language, "Legal authorities remain current as of the stated date.", "Правовые источники актуальны на указанную дату."),
      tr(language, "Assumptions, exclusions and uncertainties are explicitly disclosed.", "Допущения, исключения и неопределённости раскрыты явно."),
      tr(language, "Economics and probability weights are independently recalculated.", "Экономика и вероятностные веса пересчитаны независимо."),
      tr(language, "Confidentiality, privilege, conflicts and circulation scope are confirmed.", "Конфиденциальность, privilege, конфликты и круг распространения подтверждены."),
    ].map((item) => ({ text: `[ ] ${item}` })), style: "checklist", margin: [6, 6, 0, 16]
  });
  content.push(table(
    [tr(language, "Reviewer", "Рецензент"), tr(language, "Role", "Роль"), tr(language, "Date", "Дата"), tr(language, "Sign-off / qualification", "Утверждение / оговорка")],
    [["", "", "", "\n"]], ["24%", "20%", "18%", "38%"]
  ));
  content.push({ text: `${tr(language, "Current content fingerprint", "Отпечаток текущего содержания")}: ${options.currentFingerprint || tr(language, "pending", "ожидается")}`, style: "fingerprint" });
  if (options.includeTechnicalIds && draft.protection) content.push({ text: `${tr(language, "Lineage code", "Код линии версий")}: ${draft.protection.currentCode || "pending"}\n${tr(language, "Copy policy", "Политика копирования")}: ${draft.protection.copyPolicy}`, style: "fingerprint" });
  content.push(...buildReportGraphAppendix(layoutModel, options, sectionNumber++));

  const confidentialityLabel = options.confidentiality.toUpperCase();
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [39.685, 39.685, 39.685, 39.685],
    language: language === "en" ? "en-GB" : "ru-RU",
    displayTitle: true,
    defaultStyle: { font: "Roboto", fontSize: 9.2, color: palette.ink, lineHeight: 1.25 },
    content,
    header: (currentPage: number) => currentPage === 1 ? null : ({ columns: [{ text: "GENESIS: JURIS CODEX", style: "headerBrand" }, { text: `${draft.caseId} · v${draft.version}`, alignment: "right", style: "headerMeta" }], margin: [44, 22, 44, 0] }),
    footer: (currentPage: number, pageCount: number) => ({ columns: [{ text: confidentialityLabel, color: palette.gold, bold: true }, { text: `${currentPage} / ${pageCount}`, alignment: "right" }], fontSize: 7.5, color: "#66777e", margin: [44, 0, 44, 18] }),
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
      message: ["prompt_submitted", "prompt_applied", "graph_rebuilt"].includes(entry.action)
        ? "prompt-excluded"
        : redactionsActive ? "redaction-excluded" : entry.message,
      source: entry.source,
    }))
    : [];
  return canonicalFingerprint({
    format: "genesis-juris-case-report-presentation-binding",
    version: 1,
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
    for (const item of Object.values(value as Record<string, unknown>)) inspect(item);
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
  const definition = buildCaseReportDefinitionFromModels(draft, options, reportModel, layoutModel);
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

export async function downloadCaseReport(draft: StudioDraft, options: CaseReportOptions, authorization: { canGenerate: boolean }) {
  assertCaseReportGenerationAuthorized(authorization?.canGenerate);
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake.js"), import("pdfmake/build/vfs_fonts.js"),
  ]);
  (pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);
  const { definition, reportModel, layoutModel, presentationFingerprint } = buildCaseReportArtifacts(draft, options);
  const blob = await new Promise<Blob>((resolve) => pdfMake.createPdf(definition).getBlob(resolve));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${draft.caseId || "case"}-v${draft.version || "0"}-${options.profileId || "case-report"}-${options.audience}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  const receipt = reportReceipt(reportModel, options.generatedAt, {
    layoutSchemaVersion: layoutModel.layoutSchemaVersion,
    layoutAlgorithmVersion: layoutModel.layoutAlgorithmVersion,
    layoutRendererVersion: layoutModel.layoutRendererVersion,
    layoutFingerprint: layoutModel.layoutFingerprint,
    presentationFingerprint,
  });
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
