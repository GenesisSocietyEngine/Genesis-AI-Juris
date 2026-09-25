import type { Content, ContentTable, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { CaseReportOptions } from "./case-report";
import type { CanonicalReportModel } from "./report-model";
import type { StudioDraft } from "./types";
import { decisionEconomics } from "./report-decision-analysis";

const ink = "#173345", teal = "#197a80", muted = "#536774", line = "#dae3e8";
const red = "#a63e35";

/** Receives only visible records. Recommendations are proposals, never selected outcomes. */
export function buildDecisionReport(draft: StudioDraft, options: CaseReportOptions, report: CanonicalReportModel): TDocumentDefinitions {
  const t = (en: string, ru: string) => options.language === "en" ? en : ru;
  const money = (n: number | null, decimals = 0) => n === null || !Number.isFinite(n) ? t("Not established", "Не установлено")
    : new Intl.NumberFormat(options.language === "en" ? "en-GB" : "ru-RU", { style: "currency", currency: draft.dealEconomics?.currency ?? draft.taxEconomics?.currency ?? "GBP", maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n);
  const percent = (n: number | null) => n === null || !Number.isFinite(n) ? t("Not established", "Не установлено") : `${n.toFixed(1)}%`;
  const p = (text: string): Content => ({ text, margin: [0, 0, 0, 10] });
  const h = (text: string): Content => ({ text, style: "h2", margin: [0, 12, 0, 7] });
  const page = (label: string, title: string): Content[] => [
    { text: label.toUpperCase(), style: "eyebrow", pageBreak: "before", margin: [0, 3, 0, 12] },
    { text: title, style: "h1", margin: [0, 0, 0, 17] },
  ];
  const box = (title: string, detail: string, warning = false): Content => ({ table: { widths: ["*"], body: [[{ stack: [
    { text: title, bold: true, color: warning ? red : teal, fontSize: 13, margin: [0, 0, 0, 7] }, p(detail),
  ], fillColor: warning ? "#fff1ed" : "#edf6f5", margin: [12, 10, 12, 3] }]] }, layout: "noBorders", margin: [0, 8, 0, 14] });
  const table = (headers: string[], rows: TableCell[][], widths: Array<string | number>): ContentTable => ({
    table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths, body: [headers.map(text => ({ text, bold: true, color: "#ffffff", fillColor: ink, fontSize: 9 })), ...rows] },
    layout: { hLineWidth: () => .5, vLineWidth: () => 0, hLineColor: () => line, paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 8, paddingRight: () => 8,
      fillColor: row => row > 0 && row % 2 === 0 ? "#f5f8fa" : null }, margin: [0, 6, 0, 13], fontSize: 9.3,
  });
  const m = options.includeEconomics ? draft.dealEconomics : undefined;
  const a = m ? decisionEconomics(m) : null;
  const cash = a?.selected?.annualCashFlow ?? null;
  const debt = a?.selected?.annualDebtService ?? null;
  const adverse = cash !== null && cash < 0;
  const hasBasis = !!a?.selected && debt !== null && m?.grossAnnualIncome !== null;
  const operatingDeficit = adverse && debt === 0;
  const recommendation = operatingDeficit
    ? t("Reassess operating economics before commitment", "Пересмотреть операционную экономику до обязательств")
    : adverse
    ? t("Reassess financing before commitment", "Пересмотреть финансирование до принятия обязательств")
    : hasBasis ? t("Validate the economics before choosing a route", "Проверить экономику до выбора структуры")
      : t("Resolve the material evidence gaps before deciding", "Закрыть существенные пробелы до принятия решения");
  const rationale = adverse
    ? t(`The recorded assumptions imply an annual cash shortfall of ${money(-cash!)} before tax and unpriced costs. Rework financing or the acquisition economics, then compare the available ownership routes.`,
      `Указанные допущения дают годовой дефицит ${money(-cash!)} до налогов и неоценённых затрат. Пересмотрите финансирование или экономику приобретения, затем сравните доступные структуры владения.`)
    : hasBasis ? t("The current model result is not an execution approval. Confirm income, complete costs, financing terms and legal feasibility before relying on it.", "Текущий результат модели не является разрешением на сделку. Подтвердите доход, полные затраты, условия финансирования и правовую допустимость.")
      : t("The available records support a review agenda, not a selected outcome. Complete the missing inputs and document the reasoning for the chosen route.", "Имеющиеся записи задают план проверки, но не выбранный исход. Заполните пробелы и зафиксируйте основания выбранного решения.");
  const status = report.publication.status === "draft" ? t("REVIEW DRAFT", "ЧЕРНОВИК ДЛЯ ПРОВЕРКИ") : t("STUDIO FINAL REPORT", "ФИНАЛЬНЫЙ ОТЧЁТ STUDIO");
  const content: Content[] = [
    { text: "GENESIS: JURIS", style: "brand", margin: [0, 2, 0, 20] },
    { text: t("DECISION REPORT", "ОТЧЁТ ДЛЯ ПРИНЯТИЯ РЕШЕНИЯ"), style: "eyebrow", margin: [0, 0, 0, 10] },
    { text: draft.title, style: "h1", margin: [0, 0, 0, 10] },
    { text: `${t("Report purpose", "Назначение отчёта")}: ${options.profileLabel.trim() || t("Case decision review", "Проверка решения по делу")}`, color: muted, fontSize: 10, margin: [0, 0, 0, 8] },
    { text: `${status} · ${options.confidentiality.toUpperCase()} · ${options.generatedAt.slice(0, 10)}`, style: "small", margin: [0, 0, 0, 10] },
    box(recommendation, rationale, adverse),
  ];
  if (hasBasis && a && m) {
    content.push({ columns: [
      [t("Annual cash flow", "Годовой денежный поток"), money(cash)],
      [t("Debt coverage", "Покрытие долга"), a.selected?.dscr === null ? t("Not applicable", "Неприменимо") : `${a.selected!.dscr!.toFixed(2)}x`],
      [t("Return on known cash", "Доходность известного капитала"), a.initialCostsKnown && a.knownCosts ? percent(a.selected?.cashOnCashReturnPercent ?? null) : t("Incomplete costs", "Неполные затраты")],
    ].map(([label, value]) => ({ width: "*", stack: [{ text: label, style: "small", margin: [0, 0, 0, 5] }, { text: value, fontSize: 19, bold: true, color: ink }] })), columnGap: 18, margin: [0, 5, 0, 18] });
    content.push(p(t("Calculated from supplied inputs; before tax and unpriced costs. Missing costs make available income and cash flow upper bounds. Debt coverage divides income after recorded operating and structure costs by scheduled debt service.", "Расчёт по указанным данным; до налогов и неоценённых затрат. При отсутствующих расходах доход и поток — верхние оценки. Покрытие долга: доход после указанных операционных затрат и расходов структуры, делённый на обслуживание долга.")));
    content.push(h(t("The findings that matter", "Ключевые выводы")));
    content.push(p(operatingDeficit ? t("1. Recorded operating and structure costs exceed income even without debt service. Reconcile income and the cost base before proceeding.", "1. Операционные расходы и затраты структуры превышают доход даже без долга. Сверьте доход и расходы до продолжения.") : adverse ? t(`1. Income does not cover the selected loan payments. Available income is ${money(a.result.netOperatingIncomeBeforeUnknownCosts)}, against ${money(debt)} annual debt service. The shortfall needs funding; it is not a forecast probability.`,
      `1. Доход не покрывает выбранный график кредита: доступно ${money(a.result.netOperatingIncomeBeforeUnknownCosts)}, обслуживание долга ${money(debt)} в год. Дефицит требует финансирования; это не вероятностный прогноз.`)
      : t("1. Test resilience. Compare the base case with lower income and higher costs before judging whether the surplus is sufficient.", "1. Проверьте устойчивость. Сопоставьте базовый случай со снижением дохода и ростом затрат, прежде чем считать запас достаточным.")));
    content.push(p(t(`2. The model interprets the return target as cash-on-cash${m.targetAnnualReturnBps === null ? "" : ` (${percent(m.targetAnnualReturnBps / 100)})`}. Confirm the investor's definition, tax basis and time horizon. Gross yield and principal repayment are different measures.`,
      `2. Модель трактует цель как доходность внесённого капитала${m.targetAnnualReturnBps === null ? "" : ` (${percent(m.targetAnnualReturnBps / 100)})`}. Подтвердите определение инвестора, налоговую базу и горизонт. Валовая доходность и погашение основного долга — другие показатели.`)));
  } else {
    const purpose = draft.premisePublication === "author-reviewed" ? draft.premise : draft.nodes.find(n => n.type === "trigger")?.detail;
    // Some authored demo premises append machine-readable scenario inputs.
    // Keep the human objective; the complete pinned record stays in Full analysis.
    const objective = purpose?.split(/\s*Pinned reviewed inputs:/u)[0].trim();
    content.push(h(t("Recorded objective", "Зафиксированная цель")), p(objective || t("An author-reviewed objective is not recorded.", "Проверенная автором цель не записана.")));
    if (purpose && objective !== purpose.trim()) content.push(p(t("Detailed pinned scenario inputs remain in the case and Full analysis export.", "Подробные закреплённые параметры сценария доступны в деле и полном отчёте.")));
    if (m) content.push(p(t("The repayment basis or financial inputs are incomplete, or the loan runs for less than a year. A supported annual cash-flow conclusion is not available.", "Вид погашения или данные неполны либо срок кредита меньше года. Обоснованный годовой вывод о денежном потоке недоступен.")));
  }
  if (options.includeEconomics && draft.taxEconomics) content.push(p(t("3. A tax advantage is not established. Recorded tax estimates do not evidence verified rates, deductibility or eligibility. Do not offset the financing shortfall with an assumed tax saving.", "3. Налоговое преимущество не установлено. Налоговые оценки не подтверждают ставки, вычеты и применимость режима. Не компенсируйте дефицит предполагаемой налоговой экономией.")));
  content.push({ text: t("Analytical recommendation only. No selected case outcome or independent professional approval is implied.", "Только аналитическая рекомендация. Выбранный исход дела и независимое профессиональное утверждение не подразумеваются."), style: "small", margin: [0, 12, 0, 0] });

  if (m && a && hasBasis) {
    content.push(...page(t("Financial findings", "Финансовые выводы"), t("From income to spendable cash", "От дохода к доступным деньгам")));
    content.push(table([t("Annual cash bridge", "Годовой денежный поток"), t("Amount", "Сумма")], [
      [t("Gross income", "Валовой доход"), money(m.grossAnnualIncome)],
      [t("Less: operating expenses", "Минус: операционные расходы"), money(m.annualOperatingCosts)],
      [t("Surplus before financing and other costs", "Остаток до финансирования и других затрат"), money(m.grossAnnualIncome !== null && m.annualOperatingCosts !== null ? m.grossAnnualIncome - m.annualOperatingCosts : null)],
      [t("Less: annual structure costs", "Минус: годовые расходы структуры"), money(m.annualStructureCost)],
      [t("Available before debt and tax", "Доступно до обслуживания долга и налогов"), money(a.result.netOperatingIncomeBeforeUnknownCosts)],
      [t("Less: selected annual debt service", "Минус: выбранное обслуживание долга за год"), money(debt)],
      [{ text: t("Cash after debt, before tax and unpriced costs", "Поток после долга, до налогов и неоценённых затрат"), bold: true }, { text: money(cash, 2), bold: true, color: adverse ? red : teal }],
    ], ["72%", "28%"]));
    if (!a.knownCosts) content.push(p(t("Some costs are missing: the displayed available income and cash flow are upper bounds using recorded costs only.", "Часть затрат отсутствует: доступный доход и поток — верхние оценки только по записанным затратам.")));
    content.push(h(t("Financing and initial cash", "Финансирование и первоначальный капитал")));
    content.push(p(t(`Loan ${money(a.result.loanPrincipal)}; annual rate ${percent(m.annualInterestRateBps === null ? null : m.annualInterestRateBps / 100)}; term ${m.termMonths ?? "?"} months; ${m.repaymentBasis === "amortizing" ? "monthly amortization" : "interest-only"}. Annual debt service is the unrounded monthly payment multiplied by 12.`,
      `Кредит ${money(a.result.loanPrincipal)}; ставка ${percent(m.annualInterestRateBps === null ? null : m.annualInterestRateBps / 100)}; срок ${m.termMonths ?? "?"} месяцев; ${m.repaymentBasis === "amortizing" ? "ежемесячная амортизация" : "только проценты"}. Годовое обслуживание — неокруглённый месячный платёж × 12.`)));
    if (m.termMonths !== null && m.termMonths < 12) content.push(p(t("The loan term is shorter than a year: the annualized payment is not a first-year repayment schedule.", "Срок меньше года: годовая экстраполяция платежа не является графиком выплат первого года.")));
    content.push(p(t(`Known initial cash: ${money(a.result.initialEquity)} = purchase price less borrowing, plus recorded acquisition and setup costs. This is a model input total, not a confirmed all-in budget or a purchaser-specific tax calculation.`,
      `Известный первоначальный капитал: ${money(a.result.initialEquity)} = цена минус кредит плюс записанные расходы приобретения и создания структуры. Это сумма параметров модели, а не подтверждённый полный бюджет или налоговый расчёт покупателя.`)));
    if (a.firstYearInterest !== null) content.push(box(t("Principal repayment is not spendable income", "Погашение долга не является доступным доходом"),
      t(`In year one, the loan schedule allocates ${money(a.firstYearInterest, 2)} to interest and ${money(a.firstYearPrincipal, 2)} to principal. Principal reduction builds equity but does not remove the cash shortfall. Interest is not automatically tax-deductible.`,
        `За первый год по графику: проценты ${money(a.firstYearInterest, 2)}, основной долг ${money(a.firstYearPrincipal, 2)}. Снижение долга увеличивает капитал, но не устраняет дефицит денег. Проценты не становятся автоматически налоговым вычетом.`)));
    if (m.repaymentBasis === "interest_only") content.push(box(t("Principal remains payable", "Основной долг остаётся к погашению"), t(`The ${money(a.result.loanPrincipal)} principal is not repaid by the interest-only payments. Confirm the maturity repayment and refinancing plan.`, `Платежи только процентов не погашают ${money(a.result.loanPrincipal)} основного долга. Подтвердите погашение в конце срока и рефинансирование.`), true));

    content.push(...page(t("Sensitivity", "Чувствительность"), t("What would change the conclusion?", "Что изменит вывод?")));
    if (a.sensitivity.length) {
      content.push(p(t(`Illustrative income changes of −10%, base and +10%. Operating expenses stay at ${percent(a.costRatio! * 100)} of income; structure costs and loan terms stay unchanged. This is a stated scenario assumption, not a forecast or a verified cost-behaviour model.`,
        `Иллюстративные изменения дохода: −10%, база и +10%. Операционные расходы остаются ${percent(a.costRatio! * 100)} дохода; расходы структуры и кредит неизменны. Это сценарное допущение, не прогноз и не проверенная модель поведения затрат.`)));
      content.push(table([t("Scenario / income", "Сценарий / доход"), t("Cash after debt", "Поток после долга"), t("Debt coverage", "Покрытие долга")], a.sensitivity.map(s => [
        `${s.change < 0 ? "−10%" : s.change > 0 ? "+10%" : t("Base", "База")} · ${money(s.income)}`, money(s.cashFlow, 2), s.dscr === null ? t("Not applicable", "Неприменимо") : `${s.dscr.toFixed(2)}x`,
      ]), ["40%", "33%", "27%"]));
      if (a.sensitivity.every(s => s.cashFlow < 0)) content.push(box(t("A modest income increase is insufficient", "Умеренного роста дохода недостаточно"), t("All three scenarios remain cash-negative before tax and unpriced costs. Test financing, price, costs and additional equity together; do not treat higher rent as an evidenced solution.", "Все три сценария отрицательны до налогов и неоценённых затрат. Совместно проверьте кредит, цену, затраты и дополнительный капитал; рост аренды не является доказанным решением."), true));
      content.push(h(t("Calculated decision thresholds", "Расчётные пороги решения")));
      content.push(p(t(`Cash break-even requires annual gross income of ${money(a.breakEvenIncome, 2)} under this same cost-ratio assumption. It only covers modelled cash costs; it provides no contingency or tax allowance.`,
        `Безубыточность потока требует ${money(a.breakEvenIncome, 2)} валового дохода в год при той же доле расходов. Покрываются только модельные денежные затраты, без резервов и налогов.`)));
      if (a.targetIncome !== null) content.push(p(t(`The model's ${percent(m.targetAnnualReturnBps! / 100)} pre-tax cash-on-cash target requires ${money(a.targetIncome, 2)} annual gross income with initial cash unchanged. This is an algebraic threshold, not achievable market rent or an after-tax return.`,
        `Цель модели ${percent(m.targetAnnualReturnBps! / 100)} до налогов на внесённый капитал требует ${money(a.targetIncome, 2)} валового дохода при неизменном капитале. Это алгебраический порог, не рыночная аренда и не доходность после налогов.`)));
      content.push(p(t("Confirm the lender's own income definition and covenant before assessing compliance. No default debt-coverage requirement is assumed here.", "Подтвердите определение дохода и ковенант кредитора до проверки соответствия. Требование покрытия долга по умолчанию не подставляется.")));
    } else content.push(p(t("A meaningful income sensitivity needs recorded operating and structure costs, positive income and a usable cost ratio. Complete these inputs rather than substituting probability weights.", "Для чувствительности нужны указанные операционные расходы, расходы структуры, положительный доход и применимая доля затрат. Заполните данные вместо подстановки вероятностей.")));
  }

  content.push(...page(t("Recommendation and actions", "Рекомендация и действия"), t("A practical route to a decision", "Практический путь к решению")));
  if (hasBasis) {
    content.push(table([t("Option", "Вариант"), t("Implication / next test", "Значение / следующая проверка")], [
      [t("Retain current terms", "Сохранить условия"), adverse ? t("Requires recurring cash support. Do not describe the base case as self-funding.", "Требует постоянного покрытия дефицита. Базовый случай не самофинансируется.") : t("Verify the complete cost base and downside resilience.", "Проверьте полные затраты и устойчивость к ухудшению.")],
      [t("Restructure financing or price", "Изменить кредит или цену"), t("Obtain priced alternatives for loan size, term, rate and additional equity. Recalculate cash flow and returns together.", "Получите предложения по сумме, сроку, ставке и дополнительному капиталу. Пересчитайте поток и доходность вместе.")],
      [t("Choose an ownership structure", "Выбрать структуру владения"), t("Compare verified legal availability, full setup/running costs and tax treatment. A preferred structure is not evidence of a tax benefit.", "Сравните правовую доступность, полные начальные и текущие затраты и налоги. Предпочтение структуры не доказывает выгоду.")],
      [t("Pause or renegotiate", "Приостановить или пересогласовать"), t("Preserve the option to stop while material financing, source or legal conditions remain unresolved.", "Сохраните возможность отказаться, пока существенные финансовые, доказательственные и правовые вопросы не решены.")],
    ], ["30%", "70%"]));
  } else {
    const decisions = draft.nodes.filter(n => n.type === "decision").slice(0, 3);
    content.push(p(t("These are recorded review questions, not automatically selected decisions. Read the complete conditions in the case before acting.", "Это записанные вопросы проверки, а не автоматически выбранные решения. До действий прочтите полные условия в деле.")));
    for (const n of decisions) content.push(h(n.title), p(n.detail));
  }
  content.push(h(t("Priority actions before commitment", "Приоритетные действия до обязательств")));
  content.push(table([t("Proposed owner", "Предлагаемая роль"), t("Deliverable / completion condition", "Результат / условие завершения")], [
    [t("Case lead / client", "Ведущий / клиент"), t("Confirm the objective, decision criteria, scope and acceptable downside; reconcile material facts to original evidence.", "Подтвердить цель, критерии решения, охват и допустимое ухудшение; сверить существенные факты с оригиналами.")],
    ...(m ? [[t("Finance adviser", "Финансовый консультант"), t("Validate income and expenses, obtain the lender schedule and conditions, and complete base/downside/full-cost calculations.", "Проверить доход и расходы, получить график и условия кредитора, завершить базовый и стрессовый расчёт полных затрат.")]] : []),
    [t("Relevant specialists", "Профильные специалисты"), t("Provide current, source-supported legal/tax conclusions for the available routes; identify prerequisites and unresolved risks.", "Подготовить актуальные правовые и налоговые выводы с источниками; определить условия и оставшиеся риски.")],
    [t("Independent reviewer", "Независимый проверяющий"), t("Challenge the recommendation and record the actual decision, conditions and approval in the case workflow.", "Проверить рекомендацию и зафиксировать решение, условия и утверждение в рабочем процессе дела.")],
  ], ["28%", "72%"]));
  content.push({ text: t("Roles are proposed responsibilities, not assigned tasks or completed approvals.", "Роли — предлагаемая ответственность, не назначенные задачи и не полученные утверждения."), style: "small" });

  const evidenceStart = content.length;
  content.push(...page(t("Evidence and method", "Основания и метод"), t("What this assessment rests on", "На чём основана оценка")));
  content.push(p(t("The calculations use the recorded case assumptions; their inclusion does not verify them. Findings are rule-based interpretations of those calculations and visible case records. No independent expert approval, completed scenario run or AI prediction is inferred.", "Расчёты используют допущения дела; включение в отчёт не подтверждает их. Выводы — интерпретация расчётов и открытых записей по явным правилам. Независимое экспертное утверждение, завершённый сценарий и AI-прогноз не подразумеваются.")));
  if (options.includeEconomics && m) {
    content.push(p(t("No probabilities are estimated. Currency effects, exit costs, tax and unpriced costs are outside these calculations.", "Вероятности не оцениваются. Валютные эффекты, расходы выхода, налоги и неоценённые затраты исключены из расчётов.")));
    content.push(h(t("Material assumptions from the case", "Существенные допущения дела")));
    // Preserve complete assumptions, including uncertainty and comparisons; never silently clip them.
    content.push({ ul: m.assumptions.length ? m.assumptions.filter(item => !/scenario probabilit|вероятност[а-я]* сценар/iu.test(item)) : [t("No separate assumptions recorded.", "Отдельные допущения не записаны.")], fontSize: 8.6, margin: [10, 0, 0, 12] });
    if (draft.taxEconomics) content.push(p(t("Tax estimates are excluded from the recommendation. Reconcile the taxable base, finance-cost treatment, rates and their sources before comparing after-tax returns. An amortizing principal repayment is not an interest expense.", "Налоговые оценки исключены из рекомендации. Сверьте базу, учёт финансирования, ставки и источники до сравнения доходности после налогов. Погашение основного долга не является процентным расходом.")));
  }
  if (options.includeRegisters) {
    const records = draft.nodes.filter(n => ["fact", "evidence", "tax_rule"].includes(n.type));
    content.push(h(t("Evidence to reconcile", "Основания для сверки")));
    content.push({ ul: records.map(n => n.title), fontSize: 9, margin: [10, 0, 0, 12] });
    content.push(p(t("These titles index the recorded material; they do not certify it. Full text, conditions and provenance remain in the case and the full analysis export.", "Заголовки указывают на записанные материалы, но не подтверждают их. Полные тексты, условия и происхождение доступны в деле и полном отчёте.")));
  }
  if (options.includeSources) {
    content.push(h(t("Recorded source references", "Записанные ссылки на источники")));
    if (report.governance.citations.length) content.push({ ol: report.governance.citations.map(c => ({ text: c.url, link: c.url, color: teal })), fontSize: 8.6, margin: [10, 0, 0, 12] });
    else content.push(p(t("No public source references recorded. Obtain authoritative sources for material conclusions.", "Публичные ссылки отсутствуют. Получите авторитетные источники для существенных выводов.")));
    content.push(p(t(`Case-entered legal reference date: ${draft.classification?.legalAsOf || "not recorded"}. This is not a verified legal currency check; future-dated entries require correction.`,
      `Введённая в деле дата правовой актуальности: ${draft.classification?.legalAsOf || "не указана"}. Это не подтверждение актуальности права; будущие даты требуют исправления.`)));
  }
  if (hasBasis) {
  content.push(h(t("Reading the measures", "Как читать показатели")));
  content.push(p(t("Cash flow = gross income − operating costs − structure costs − debt service. Debt coverage = available income ÷ debt service. Cash-on-cash = cash after debt ÷ known initial cash. All figures here exclude tax and unpriced costs. Sensitivities are hypothetical, not likelihood estimates.", "Поток = валовой доход − операционные расходы − расходы структуры − обслуживание долга. Покрытие = доступный доход ÷ обслуживание долга. Доходность капитала = поток после долга ÷ известный первоначальный капитал. Показатели исключают налоги и неоценённые затраты. Сценарии гипотетические, не вероятностные.")));
  }
  content.push(p(options.presentationMode === "medium"
    ? t("The visual decision tree follows as a graph section. Full analysis with the tree enabled provides the detailed text alternative, complete records and audit options.", "Визуальное дерево решений приведено в следующем разделе. Полный анализ с включённым деревом содержит подробную текстовую альтернативу, полные записи и параметры аудита.")
    : options.includeDecisionTree
    ? t("The decision tree and its text alternative follow as an appendix. Complete records and audit details remain available in Full analysis.", "Дерево решений и его текстовая альтернатива приведены в приложении. Полные записи и аудит доступны в формате «Полный анализ».")
    : t("The decision tree is omitted. Enable Include decision tree in report settings to add it. Complete records and audit details remain available in Full analysis.", "Дерево решений не включено. Включите параметр «Включить дерево решений» в настройках отчёта, чтобы добавить его. Полные записи и аудит доступны в формате «Полный анализ».")));
  if (options.preparedBy || options.preparedFor || options.matterReference) content.push({ text: [options.preparedBy && `${t("Prepared by", "Подготовил")}: ${options.preparedBy}`, options.preparedFor && `${t("For", "Для")}: ${options.preparedFor}`, options.matterReference].filter(Boolean).join(" · "), style: "small" });
  content.push({ stack: content.splice(evidenceStart), fontSize: 9.4, lineHeight: 1.15 });
  return {
    pageSize: "A4", pageMargins: [44, 48, 44, 44], displayTitle: true, language: options.language === "en" ? "en-GB" : "ru-RU",
    defaultStyle: { font: "Roboto", fontSize: 10.2, color: ink, lineHeight: 1.2 }, content,
    header: n => n === 1 ? null : ({ text: "GENESIS: JURIS  /  " + t("Decision report", "Отчёт для решения"), color: muted, fontSize: 8, margin: [44, 24, 44, 0] }),
    footer: (n, total) => ({ columns: [{ text: `${options.confidentiality.toUpperCase()} · ${status}` }, { text: `${n} / ${total}`, alignment: "right" }], color: muted, fontSize: 8, margin: [44, 0, 44, 20] }),
    styles: { brand: { bold: true, fontSize: 11, color: teal, characterSpacing: 1.1 }, eyebrow: { bold: true, fontSize: 8, characterSpacing: 1.3, color: teal }, h1: { bold: true, fontSize: 24, lineHeight: 1.05 }, h2: { bold: true, fontSize: 13 }, small: { fontSize: 8.3, color: muted, lineHeight: 1.2 },
      sectionTitle: { bold: true, fontSize: 18, color: ink }, subheading: { bold: true, fontSize: 12, color: ink },
      notice: { fontSize: 9, color: muted, margin: [0, 2, 0, 10] }, body: { fontSize: 10, lineHeight: 1.2 },
      graphNodeType: { bold: true, fontSize: 8, color: teal }, graphNodeDetail: { fontSize: 9, color: ink, lineHeight: 1.2 },
    },
    info: { title: `${draft.title} - ${options.presentationMode === "medium" ? "Decision report + graph" : "Decision report"}`, author: options.preparedBy || "GENESIS: JURIS", creator: "GENESIS: JURIS", subject: `${draft.caseId} / v${draft.version} / ${options.presentationMode === "medium" ? "medium-report-v1" : "decision-report-v1"}` },
  };
}
