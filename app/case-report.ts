import { calculateDealEconomics, estimateDealCashFlowProbabilities } from "./deal-economics";
import { calculateTaxEconomics } from "./tax-economics";
import { layoutStudioNodes, studioNodeEstimatedHeight } from "./studio-layout";
import type { StudioDraft, StudioLink, StudioNode, StudioNodeType } from "./types";
import type { Content, ContentTable, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";

export type CaseReportOptions = {
  language: "en" | "ru";
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
  privateCase: boolean;
};

const palette = { ink: "#10202c", navy: "#163445", cyan: "#3d9daa", gold: "#c79b3b", mist: "#edf2f3", line: "#b6c4c8", red: "#a34444", white: "#ffffff" };
const nodeNames: Record<StudioNodeType, [string, string]> = {
  trigger: ["Trigger", "Триггер"], actor: ["Actor", "Участник"], fact: ["Fact", "Факт"], evidence: ["Evidence", "Доказательство"],
  deadline: ["Deadline", "Срок"], decision: ["Decision", "Решение"], outcome: ["Outcome", "Исход"], entity: ["Entity / jurisdiction", "Организация / юрисдикция"],
  tax_rule: ["Tax rule", "Налоговое правило"], cash_flow: ["Cash flow", "Денежный поток"],
};

const tr = (language: CaseReportOptions["language"], en: string, ru: string) => language === "en" ? en : ru;
const clean = (value: string | undefined | null, fallback = "-") => value?.trim() || fallback;
const pct = (basisPoints: number | null) => basisPoints === null ? "-" : `${(basisPoints / 100).toFixed(1)}%`;

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

const xml = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const clipped = (value: string, limit: number) => value.length <= limit ? value : `${value.slice(0,limit-1).trimEnd()}...`;

function relationCondition(link: StudioLink) {
  const rule=link.rule;
  if(!rule)return "";
  return [rule.label,rule.detail,rule.result,
    rule.guards?.map((item)=>`${item.metric} ${item.comparison} ${item.value}`).join(", "),
    rule.effects&&Object.entries(rule.effects).map(([key,value])=>`${key} ${Number(value)>=0?"+":""}${value}`).join(", "),
    rule.cost!==undefined?`EUR ${rule.cost}`:"",rule.minutes!==undefined?`${rule.minutes} min`:"",rule.repeatability,
    rule.maxUses!==undefined?`max ${rule.maxUses}`:"",
  ].filter(Boolean).join("; ");
}

function nodeRuntime(node: StudioNode, language: CaseReportOptions["language"]){
  const value=node.runtime;
  if(!value)return "";
  return [value.day!==undefined?`${tr(language,"day","день")} ${value.day}`:"",value.time,
    value.pressure,value.terminalOutcome?`${tr(language,"outcome","исход")}: ${value.terminalOutcome}`:"",
    value.deadlineDay!==undefined?`${tr(language,"deadline day","день срока")}: ${value.deadlineDay}`:"",value.deadlineTime,
    value.budgetCostEur!==undefined?`EUR ${value.budgetCostEur}`:"",value.durationMinutes!==undefined?`${value.durationMinutes} min`:"",
  ].filter(Boolean).join("; ");
}

function graphSvg(draft: StudioDraft, activeIds: Set<string>){
  const nodes=layoutStudioNodes(draft.nodes,draft.links,"vertical");
  const byId=new Map(nodes.map((node)=>[node.id,node]));
  const numberById=new Map(nodes.map((node,index)=>[node.id,`N${String(index+1).padStart(2,"0")}`]));
  const maxX=Math.max(1,...nodes.map((node)=>node.x+165+46));
  const maxY=Math.max(1,...nodes.map((node)=>node.y+studioNodeEstimatedHeight(node)+86));
  const paths=draft.links.flatMap((link)=>{const from=byId.get(link.from);const to=byId.get(link.to);if(!from||!to)return[];const x1=from.x+82.5;const y1=from.y+studioNodeEstimatedHeight(from);const x2=to.x+82.5;const y2=to.y;const bend=Math.max(45,Math.abs(y2-y1)*.42);return [`<path d="M ${x1} ${y1} C ${x1} ${y1+bend}, ${x2} ${y2-bend}, ${x2} ${y2}" fill="none" stroke="#3d9daa" stroke-width="3" opacity="0.72"/><circle cx="${x2}" cy="${y2}" r="5" fill="#3d9daa"/>`];}).join("");
  const cards=nodes.map((node)=>{const height=studioNodeEstimatedHeight(node);const active=activeIds.has(node.id);const title=clipped(node.title,31);return `<g><rect x="${node.x}" y="${node.y}" width="165" height="${height}" rx="3" fill="#ffffff" stroke="${active?palette.gold:palette.line}" stroke-width="${active?5:2}"/><rect x="${node.x}" y="${node.y}" width="8" height="${height}" fill="${node.type==="outcome"?"#7b68a8":node.type==="decision"?palette.gold:node.type==="tax_rule"?"#c27847":palette.cyan}"/><text x="${node.x+17}" y="${node.y+24}" font-family="Roboto" font-size="15" font-weight="700" fill="#163445">${numberById.get(node.id)} ${xml(nodeNames[node.type][0].toUpperCase())}</text><text x="${node.x+17}" y="${node.y+50}" font-family="Roboto" font-size="17" fill="#10202c">${xml(title)}</text></g>`;}).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}"><rect width="100%" height="100%" fill="#f5f8f8"/>${paths}${cards}</svg>`;
}

function graphAppendix(draft: StudioDraft, options: CaseReportOptions, nextSectionNumber:()=>number):Content[]{
  const {language}=options;
  const numberById=new Map(draft.nodes.map((node,index)=>[node.id,`N${String(index+1).padStart(2,"0")}`]));
  const titleById=new Map(draft.nodes.map((node)=>[node.id,node.title]));
  const pages=Array.from({length:Math.ceil(draft.nodes.length/5)},(_,index)=>draft.nodes.slice(index*5,index*5+5));
  const sectionIndex=nextSectionNumber();
  return pages.map((pageNodes,pageIndex)=>({
    pageBreak:"before",pageOrientation:"landscape",
    stack:[
      {text:`${sectionIndex}. ${tr(language,"Graph and node conditions","Граф и условия нодов")}${pages.length>1?` - ${pageIndex+1}/${pages.length}`:""}`,style:"sectionTitle",margin:[0,0,0,8]},
      {text:tr(language,"The highlighted nodes are described in the right-hand register. Relation conditions include authored guards, effects, costs, duration and repeatability.","Выделенные ноды описаны в реестре справа. Условия связей включают заданные guards, эффекты, стоимость, длительность и повторяемость."),style:"note",margin:[0,0,0,8]},
      {columns:[
        {width:"58%",stack:[{svg:graphSvg(draft,new Set(pageNodes.map((node)=>node.id))),width:425,height:360}]},
        {width:"42%",stack:pageNodes.map((node)=>{
          const incoming=draft.links.filter((link)=>link.to===node.id).map((link)=>`${tr(language,"IN","ВХОД")} ${numberById.get(link.from)} ${clipped(titleById.get(link.from)??link.from,28)}${relationCondition(link)?`: ${clipped(relationCondition(link),105)}`:""}`);
          const outgoing=draft.links.filter((link)=>link.from===node.id).map((link)=>`${tr(language,"OUT","ВЫХОД")} ${numberById.get(link.to)} ${clipped(titleById.get(link.to)??link.to,28)}${relationCondition(link)?`: ${clipped(relationCondition(link),105)}`:""}`);
          const conditions=[nodeRuntime(node,language),...incoming,...outgoing].filter(Boolean);
          return {stack:[{text:`${numberById.get(node.id)} · ${nodeNames[node.type][language==="en"?0:1]}`,style:"graphNodeType"},{text:node.title,style:"graphNodeTitle"},{text:clipped(clean(node.detail),170),style:"graphNodeDetail"},{text:conditions.length?clipped(conditions.join("\n"),420):tr(language,"No authored runtime or relation conditions.","Runtime или условия связей не заданы."),style:"graphNodeCondition"}],margin:[8,0,0,7]};
        })},
      ],columnGap:12},
    ],
  } as Content));
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

export function buildCaseReportDefinition(draft: StudioDraft, options: CaseReportOptions): TDocumentDefinitions {
  const { language } = options;
  const generated = new Date(options.generatedAt);
  const generatedLabel = Number.isNaN(generated.valueOf()) ? options.generatedAt : generated.toLocaleString(language === "en" ? "en-GB" : "ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  const classification = draft.classification;
  const sourceUrls = classification?.sourceUrls ?? [];
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
    { text: tr(language, "PROFESSIONAL CASE REPORT", "ПРОФЕССИОНАЛЬНЫЙ ОТЧЁТ ПО КЕЙСУ"), style: "kicker" },
    { text: clean(draft.title, tr(language, "Untitled case", "Кейс без названия")), style: "coverTitle" },
    { text: clean(draft.premise, tr(language, "No case context supplied.", "Контекст кейса не указан.")), style: "coverSummary" },
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
    ], ["38%", "62%"]),
    { text: tr(language, "Executive case context", "Ключевой контекст кейса"), style: "subheading" },
    { text: clean(draft.premise, tr(language, "No context supplied.", "Контекст не указан.")), style: "body" },
    { text: tr(language, "Review snapshot", "Сводка проверки"), style: "subheading", margin: [0, 12, 0, 5] },
    table([tr(language, "Measure", "Показатель"), tr(language, "Count", "Количество")], [
      [tr(language, "Nodes", "Ноды"), String(draft.nodes.length)],
      [tr(language, "Connections", "Связи"), String(draft.links.length)],
      [tr(language, "Evidence items", "Доказательства"), String(nodeCounts.evidence)],
      [tr(language, "Decisions", "Решения"), String(nodeCounts.decision)],
      [tr(language, "Outcomes", "Исходы"), String(nodeCounts.outcome)],
      [tr(language, "Public HTTPS sources", "Публичные HTTPS-источники"), String(sourceUrls.length)],
    ], ["74%", "26%"]),
  ];

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

  if (options.includeAuditTrail) {
    content.push(numberedSection("Authoring and review trail", "История подготовки и проверки"));
    const safeEntries = draft.editHistory.map((entry) => {
      const promptAction = entry.action === "prompt_submitted" || entry.action === "prompt_applied" || entry.action === "graph_rebuilt";
      return [new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " "), entry.source, entry.action, promptAction ? tr(language, "AI-assisted revision recorded - raw prompt excluded", "Зафиксирована AI-правка - исходный промпт исключён") : clean(entry.message)];
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
  content.push(...graphAppendix(draft,options,()=>sectionNumber++));

  const confidentialityLabel = options.confidentiality.toUpperCase();
  return {
    pageSize: "A4",
    pageMargins: [44, 48, 44, 48],
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
      title: `${draft.title} - professional case report`,
      author: options.preparedBy || "GENESIS: JURIS CODEX",
      subject: `${draft.caseId} v${draft.version}`,
      keywords: `legal case report, ${classification?.practiceArea ?? "legal"}, ${draft.jurisdiction}`,
      creator: "GENESIS: JURIS CODEX Studio",
      creationDate: generated,
    },
  };
}

export async function downloadCaseReport(draft: StudioDraft, options: CaseReportOptions) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake.js"), import("pdfmake/build/vfs_fonts.js"),
  ]);
  (pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);
  const definition = buildCaseReportDefinition(draft, options);
  const blob = await new Promise<Blob>((resolve) => pdfMake.createPdf(definition).getBlob(resolve));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${draft.caseId || "case"}-v${draft.version || "0"}-${options.audience}-report.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
