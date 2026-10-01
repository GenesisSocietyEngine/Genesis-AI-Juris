import { applyCaseType, CASE_TYPE_REGISTRY } from "./case-type-registry";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypePresentation } from "./case-type-presentation";
import { caseTypeReference } from "./case-type-reference";
import { defaultTaxEconomics } from "./tax-economics";
import type { CaseTypeId, LocalText, StudioDraft, StudioNode, StudioNodeType } from "./types";

const text = (en: string, ru: string): LocalText => ({ en, ru });
export type CategoryDemo = {
  caseTypeId: CaseTypeId; title: LocalText; question: LocalText; owner: LocalText;
  facts: [LocalText, LocalText]; evidence: LocalText; decision: LocalText;
  proceed: LocalText; pause: LocalText;
};

/** Editorial teaching fixtures. No statement here represents verified law or legal advice. */
export const CATEGORY_DEMOS: readonly CategoryDemo[] = [
  {
    caseTypeId: "general_advisory", title: text("Harbor — approve a supplier pilot?", "Harbor — одобрить пилот поставщика?"),
    question: text("Should Harbor approve a 60-day warehouse supplier pilot, renegotiate or defer?", "Одобрить 60-дневный пилот поставщика склада, пересмотреть условия или отложить?"),
    owner: text("Operations director; procurement owns the evidence review.", "Операционный директор; закупки отвечают за проверку доказательств."),
    facts: [text("Synthetic quote: EUR 24,000 for a capped 60-day pilot; full rollout is a separate decision.", "Учебное предложение: 24 000 EUR за ограниченный 60-дневный пилот; внедрение требует отдельного решения."), text("Capacity benefit is an assumption. The supplier's promised throughput has not been independently measured.", "Рост мощности — допущение. Заявленная производительность не измерена независимо.")],
    evidence: text("Fictional dossier H-01: quote, scope and capacity worksheet. Quote is available; signed acceptance criteria remain missing.", "Учебные материалы H-01: предложение, объём и расчёт мощности. Критерии приёмки ещё не подписаны."),
    decision: text("Approve only a capped pilot with signed acceptance criteria; otherwise defer.", "Одобрить ограниченный пилот после подписания критериев приёмки; иначе отложить."),
    proceed: text("Conditional pilot: procurement signs scope, operations measures throughput weekly, director reviews on day 60.", "Условный пилот: закупки согласуют объём, операции еженедельно измеряют производительность, директор проверяет итог на 60-й день."),
    pause: text("Defer rollout; obtain missing acceptance evidence and revised pricing before returning to the decision.", "Отложить внедрение; получить критерии приёмки и уточнённую цену перед новым решением."),
  },
  {
    caseTypeId: "litigation_strategy", title: text("Northline — disputed delivery invoices", "Northline — спорные счета за доставку"),
    question: text("Should Northline negotiate a documented settlement or prepare a claim for unpaid deliveries?", "Провести переговоры об урегулировании или подготовить требование по неоплаченным поставкам?"),
    owner: text("Disputes counsel; finance reconciles invoices and service credits.", "Юрист по спорам; финансы сверяют счета и сервисные компенсации."),
    facts: [text("Synthetic invoice balance: EUR 48,000. The customer disputes EUR 12,000 for delayed deliveries.", "Учебная задолженность: 48 000 EUR. Клиент оспаривает 12 000 EUR из-за задержек."), text("Delivery dates appear in the dispatch log; receipt signatures for two shipments are missing.", "Даты есть в журнале отправки; подписи о получении двух поставок отсутствуют.")],
    evidence: text("Fictional dossier N-01: invoice ledger, dispatch log and disputed service-credit clause. Authenticity and applicable procedure need counsel review.", "Учебные материалы N-01: счета, журнал отправки и спорное условие компенсации. Подлинность и процедуру проверяет юрист."),
    decision: text("Compare settlement costs with a claim; verify receipt evidence and applicable deadlines first.", "Сравнить затраты на соглашение и спор; сначала проверить получение поставок и применимые сроки."),
    proceed: text("Present a reconciled settlement range; preserve a claim route with counsel-confirmed deadlines and costs.", "Предложить сверенный диапазон урегулирования; сохранить путь к требованию с проверенными сроками и затратами."),
    pause: text("Do not issue a final demand on incomplete receipt evidence; collect signatures and reassess recoverable amounts.", "Не направлять окончательное требование при неполных доказательствах; собрать подписи и уточнить сумму."),
  },
  {
    caseTypeId: "contract_review", title: text("Cloudbridge — SaaS renewal review", "Cloudbridge — проверка продления SaaS"),
    question: text("Can Cloudbridge renew its support platform contract with an acceptable risk allocation?", "Можно ли продлить договор платформы поддержки с приемлемым распределением рисков?"),
    owner: text("Commercial counsel and IT service owner; procurement tracks negotiated changes.", "Коммерческий юрист и владелец ИТ-сервиса; закупки фиксируют согласованные изменения."),
    facts: [text("Fictional renewal offer: EUR 36,000 annually, with an automatic 12-month extension.", "Учебное предложение: 36 000 EUR в год с автоматическим продлением на 12 месяцев."), text("Draft liability cap excludes data restoration; the exit clause has no export delivery deadline.", "Лимит ответственности исключает восстановление данных; условие выхода не задаёт срок выгрузки.")],
    evidence: text("Fictional dossier C-01: clauses 8, 12 and 15, service-level schedule and procurement risk register. No redline has been agreed.", "Учебные материалы C-01: пункты 8, 12 и 15, SLA и реестр рисков. Правки ещё не согласованы."),
    decision: text("Request a restoration remedy and timed data export; record any residual risk accepted by the service owner.", "Запросить восстановление данных и срок выгрузки; зафиксировать остаточный риск владельца сервиса."),
    proceed: text("Renew after agreed clause changes; procurement records obligations and the renewal reminder.", "Продлить после согласования правок; закупки фиксируют обязанности и напоминание о продлении."),
    pause: text("Escalate unresolved exit and liability terms; assess an alternative supplier before commitment.", "Передать нерешённые условия выхода и ответственности на согласование; оценить альтернативного поставщика."),
  },
  {
    caseTypeId: "tax_planning", title: text("Orchard — compare investment economics", "Orchard — сравнение экономики инвестиций"),
    question: text("Does a proposed investment remain attractive after implementation and recurring compliance costs?", "Выгодна ли инвестиция с учётом внедрения и регулярных расходов на соблюдение требований?"),
    owner: text("Tax director and finance analyst; a qualified reviewer verifies jurisdiction-specific treatment.", "Налоговый директор и финансовый аналитик; квалифицированный рецензент проверяет режим юрисдикции."),
    facts: [text("Synthetic annual cash-tax estimates: baseline EUR 100,000; alternative EUR 80,000. These are teaching inputs, not statutory rates.", "Учебные годовые оценки налога: база 100 000 EUR; альтернатива 80 000 EUR. Это примеры, а не установленные ставки."), text("Assume EUR 25,000 implementation, EUR 5,000 annual maintenance and a 36-month horizon. Eligibility remains unverified.", "Допущения: внедрение 25 000 EUR, сопровождение 5 000 EUR в год, горизонт 36 месяцев. Право на режим не проверено.")],
    evidence: text("Fictional dossier O-01: investment forecast and cost sheet. No authoritative tax source or jurisdiction review is attached.", "Учебные материалы O-01: прогноз инвестиций и затрат. Авторитетный налоговый источник и проверка юрисдикции отсутствуют."),
    decision: text("Calculate the synthetic comparison, then test downside costs and eligibility before recommending implementation.", "Рассчитать учебное сравнение, затем проверить рост затрат и право на режим перед рекомендацией."),
    proceed: text("Conditional recommendation only after source-backed tax review and a fresh economic calculation.", "Условная рекомендация после проверки налоговых источников и нового экономического расчёта."),
    pause: text("Keep the current structure if eligibility fails or verified lifecycle costs exceed the benefit.", "Сохранить текущую структуру, если условия не выполнены или полные затраты превышают выгоду."),
  },
  {
    caseTypeId: "compliance", title: text("Clearpath — vendor-control gaps", "Clearpath — пробелы в контроле поставщиков"),
    question: text("Can Clearpath approve its new supplier before the internal control review is complete?", "Можно ли одобрить нового поставщика до завершения проверки внутренних контролей?"),
    owner: text("Compliance manager; procurement owns due diligence, security owns access review.", "Менеджер комплаенса; закупки отвечают за проверку, безопасность — за доступ."),
    facts: [text("Fictional internal policy requires a named owner and approval evidence for each supplier control.", "Учебная внутренняя политика требует ответственного и доказательства согласования каждого контроля."), text("Three controls were sampled. Two have approval records; the access review has no reviewer sign-off.", "Проверены три контроля. Два согласованы; проверка доступа не подписана рецензентом.")],
    evidence: text("Fictional dossier CP-01: control matrix, sample approvals and access log. A policy checklist alone is not operating evidence.", "Учебные материалы CP-01: матрица контролей, согласования и журнал доступа. Чек-лист политики не доказывает работу контроля."),
    decision: text("Assign the access gap to security and require retest evidence before supplier activation.", "Назначить устранение пробела безопасности и потребовать повторную проверку до активации."),
    proceed: text("Activate only after reviewer sign-off; compliance records the retest and follow-up date.", "Активировать после подписи рецензента; комплаенс фиксирует повторную проверку и дату контроля."),
    pause: text("Hold activation; document the exception, owner and remediation deadline for escalation.", "Приостановить активацию; зафиксировать исключение, ответственного и срок устранения."),
  },
  {
    caseTypeId: "tax_compliance", title: text("Meridian — cross-border reporting readiness", "Meridian — готовность трансграничной отчётности"),
    question: text("Is Meridian's intercompany service arrangement ready for tax review and reporting approval?", "Готова ли внутригрупповая услуга Meridian к налоговой проверке и согласованию отчётности?"),
    owner: text("Group tax manager; local advisers verify obligations and finance reconciles payments.", "Налоговый менеджер группы; местные консультанты проверяют обязанности, финансы сверяют платежи."),
    facts: [text("Fictional entities in two unspecified jurisdictions plan a EUR 120,000 annual service payment.", "Учебные компании в двух неуказанных юрисдикциях планируют платёж за услуги 120 000 EUR в год."), text("Service records exist, but allocation methodology and local reporting dates are not confirmed.", "Записи об услугах есть, но метод распределения и местные сроки отчётности не подтверждены.")],
    evidence: text("Fictional dossier M-01: service agreement, payment ledger and approval checklist. Pricing support and local sources remain missing.", "Учебные материалы M-01: договор услуг, платежи и согласования. Обоснование цены и местные источники отсутствуют."),
    decision: text("Review commercial purpose, pricing support and reporting scope; assign local confirmation before approval.", "Проверить деловую цель, обоснование цены и отчётность; назначить местную проверку до одобрения."),
    proceed: text("Approve only after local obligations, reporting owners and source dates are confirmed; recalculate costs.", "Одобрить после проверки местных обязанностей, ответственных и дат источников; пересчитать затраты."),
    pause: text("Pause implementation; preserve unresolved reporting issues and request a local review.", "Приостановить внедрение; сохранить открытые вопросы отчётности и запросить местную проверку."),
  },
  {
    caseTypeId: "erp_incident", title: text("Atlas — duplicate invoice postings", "Atlas — повторные проводки счетов"),
    question: text("How should Atlas contain duplicate ERP postings and prove that the fix works?", "Как остановить повторные проводки ERP и доказать эффективность исправления?"),
    owner: text("ERP incident lead; finance owns reconciliation and QA owns the regression test.", "Руководитель инцидента ERP; финансы сверяют данные, QA проверяет регрессию."),
    facts: [text("Fictional import batch B-17 posted 12 invoice lines twice after a retry.", "Учебный пакет B-17 дважды провёл 12 строк счетов после повторного запроса."), text("Root-cause hypothesis: the retry bypassed the idempotency key. This has not yet been reproduced.", "Гипотеза: повторный запрос обошёл ключ идемпотентности. Причина ещё не воспроизведена.")],
    evidence: text("Fictional dossier A-01: batch log, duplicate ledger and retry trace. Preserve originals before applying corrections.", "Учебные материалы A-01: журнал пакета, дубли и трассировка. Сохранить оригиналы до исправления."),
    decision: text("Contain the import, reconcile corrections, then test duplicate retries before reopening.", "Остановить импорт, сверить корректировки, затем проверить повторы до возобновления."),
    proceed: text("Reopen after repeatable idempotency tests and finance sign-off; monitor the next batch.", "Возобновить после повторяемых тестов и согласования финансов; контролировать следующий пакет."),
    pause: text("Keep the import paused if reconciliation or retry tests fail; use the reviewed manual fallback.", "Оставить импорт остановленным при ошибках сверки или тестов; использовать согласованный ручной процесс."),
  },
  {
    caseTypeId: "investigation", title: text("Beacon — disputed expense approvals", "Beacon — спорные согласования расходов"),
    question: text("What can Beacon conclude about disputed expense approvals without overstating the evidence?", "Какие выводы допустимы по спорным расходам без преувеличения доказательств?"),
    owner: text("Investigation lead; an independent reviewer checks evidence handling and findings.", "Руководитель расследования; независимый рецензент проверяет доказательства и выводы."),
    facts: [text("Fictional audit sample: five expense claims refer to the same approval screenshot.", "Учебная выборка: пять заявок на расходы ссылаются на один скриншот согласования."), text("The screenshot timestamp conflicts with the export log. This discrepancy does not establish intent or misconduct.", "Время скриншота расходится с журналом выгрузки. Это не доказывает умысел или нарушение.")],
    evidence: text("Fictional dossier B-01: original screenshot, export log and interview note. Verify provenance and maintain a chain-of-custody record.", "Учебные материалы B-01: оригинал скриншота, журнал и интервью. Проверить происхождение и цепочку хранения."),
    decision: text("Separate supported findings from hypotheses; seek the missing original approval record.", "Отделить подтверждённые выводы от гипотез; запросить оригинал согласования."),
    proceed: text("Issue limited findings with contradictions, confidence and review actions explicitly recorded.", "Подготовить ограниченные выводы с противоречиями, уверенностью и действиями проверки."),
    pause: text("Keep the allegation unresolved; preserve evidence and obtain independent review before attribution.", "Оставить утверждение неподтверждённым; сохранить доказательства и провести независимую проверку."),
  },
  {
    caseTypeId: "training_simulation", title: text("Signal — the first incident decision", "Signal — первое решение по инциденту"),
    question: text("A fictional service outage arrives: preserve evidence and verify recovery, or rush a restart?", "Учебный сбой сервиса: сохранить доказательства и проверить восстановление или поспешно перезапустить?"),
    owner: text("Duty lead; a facilitator compares the learner's route with the debrief.", "Дежурный руководитель; ведущий сравнивает выбранный маршрут с разбором."),
    facts: [text("A synthetic alert reports an import outage. The last known good batch is recorded.", "Учебное уведомление сообщает о сбое импорта. Последний исправный пакет зафиксирован."), text("A restart may clear temporary logs. The recovery hypothesis still needs a test.", "Перезапуск может удалить временные журналы. Гипотеза восстановления требует теста.")],
    evidence: text("Fictional dossier S-01: alert, batch checkpoint and recovery checklist. The learner must choose a response before the debrief.", "Учебные материалы S-01: уведомление, контрольная точка и чек-лист. Участник выбирает действие до разбора."),
    decision: text("Preserve and verify, or restart without verification? Use Test → Play to explore both routes.", "Сохранить и проверить или перезапустить без проверки? Используйте «Тест → Играть» для двух маршрутов."),
    proceed: text("Verified recovery: logs preserved, checkpoint restored and repeat import tested. Debrief: explain the evidence supporting restart.", "Проверенное восстановление: журналы сохранены, точка восстановлена, повтор проверен. Разбор: обосновать запуск доказательствами."),
    pause: text("Unverified restart: logs lost and duplicate work unresolved. Debrief: identify the missing safeguards and propose recovery.", "Непроверенный запуск: журналы потеряны, дубли не устранены. Разбор: назвать недостающие контроли и план восстановления."),
  },
];

export type CategoryDemoFilters = { query: string; practice: string; jurisdiction: string; difficulty: string; duration: string; tag: string; format: string };
export function matchingCategoryDemos(filters: CategoryDemoFilters, locale: "en" | "ru") {
  return CATEGORY_DEMOS.filter(demo => {
    const book = caseTypePlaybook(caseTypeReference(demo.caseTypeId));
    const practice = CASE_TYPE_REGISTRY.find(type => type.id === demo.caseTypeId)!.practiceArea;
    const words = [demo.title.en, demo.title.ru, demo.question.en, demo.question.ru, book.label.en, book.label.ru, caseTypePresentation(book, locale).label, practice, "fictional demo учебный пример"].join(" ").toLowerCase();
    return (filters.format === "all" || filters.format === "worked") && (!filters.query.trim() || words.includes(filters.query.trim().toLowerCase()))
      && (filters.practice === "all" || filters.practice === practice)
      && (filters.jurisdiction === "all" || filters.jurisdiction === (locale === "en" ? "Fictional / unspecified" : "Учебная / не указана"))
      && (filters.difficulty === "all" || filters.difficulty === "Intermediate")
      && (filters.duration === "all" || filters.duration === "short")
      && (filters.tag === "all" || filters.tag === "category-demo");
  });
}

/** Each launch is a new local copy; no saved authority, review date or cached result is inherited. */
export function buildCategoryDemo(id: CaseTypeId, locale: "en" | "ru", updatedAt = new Date().toISOString()): StudioDraft {
  const demo = CATEGORY_DEMOS.find(item => item.caseTypeId === id);
  if (!demo) throw new Error("Unknown category demo");
  const en = locale === "en";
  const book = caseTypePlaybook(caseTypeReference(id));
  const node = (nodeId: string, type: StudioNodeType, title: string, detail: string, index: number): StudioNode => ({
    id: nodeId, type, title, detail, x: 30 + Math.floor(index / 3) * 250, y: 30 + index % 3 * 170,
  });
  const entries: Array<[string, StudioNodeType, string, string]> = [
    ["trigger", "trigger", en ? "Decision brief" : "Задача решения", demo.question[locale]],
    ["actor", "actor", en ? "Owner & reviewer" : "Ответственный и рецензент", demo.owner[locale]],
    ["fact-1", "fact", en ? "Scenario record" : "Данные сценария", demo.facts[0][locale]],
    ["fact-2", "fact", en ? "Assumption / unresolved issue" : "Допущение / открытый вопрос", demo.facts[1][locale]],
    ["evidence", "evidence", en ? "Fictional source dossier" : "Учебные материалы", demo.evidence[locale]],
    ["deadline", "deadline", en ? "Review checkpoint" : "Контрольная дата", en ? "Internal teaching checkpoint: day 5. The owner must confirm actual legal or reporting deadlines; none are asserted here." : "Учебная контрольная точка: день 5. Ответственный должен проверить реальные сроки; здесь они не утверждаются."],
  ];
  if (id === "tax_planning" || id === "tax_compliance") entries.push(
    ["entity", "entity", en ? "Fictional entity scope" : "Учебный состав компаний", en ? "The entities and jurisdictions are teaching placeholders; confirm residence, functions and commercial purpose." : "Компании и юрисдикции учебные; проверить резидентство, функции и деловую цель."],
    ["cash-flow", "cash_flow", en ? "Illustrative cash flow" : "Учебный денежный поток", demo.facts[0][locale]],
    ["tax-rule", "tax_rule", en ? "Tax review required" : "Требуется налоговая проверка", en ? "No statutory rate or treaty entitlement is asserted. Attach authoritative sources and confirm applicable periods, eligibility and anti-abuse conditions." : "Ставки и право на договор не утверждаются. Добавить авторитетные источники и проверить периоды, условия и anti-abuse."],
  );
  entries.push(
    ["decision", "decision", en ? "Compare the options" : "Сравнить варианты", demo.decision[locale]],
    ["outcome-proceed", "outcome", en ? "Reviewed route" : "Проверенный маршрут", demo.proceed[locale]],
    ["outcome-pause", "outcome", en ? "Alternative / unresolved route" : "Альтернатива / открытый маршрут", demo.pause[locale]],
  );
  const nodes = entries.map((entry, index) => node(...entry, index));
  nodes.find(item => item.id === "outcome-proceed")!.runtime = { terminalOutcome: "strong" };
  nodes.find(item => item.id === "outcome-pause")!.runtime = { terminalOutcome: "weak" };
  const route = entries.filter(entry => entry[1] !== "outcome").map(entry => entry[0]);
  const links = route.slice(1).map((to, index) => ({ id: `route-${index + 1}`, from: route[index], to }));
  const draft = applyCaseType({
    caseId: `demo_${id}`, version: "1.0.0", parent: null, title: demo.title[locale],
    jurisdiction: en ? "Fictional / unspecified" : "Учебная / не указана", role: book.label[locale],
    premise: `${en ? "Fictional teaching case. Facts and amounts are synthetic; conclusions require professional review." : "Учебный вымышленный кейс. Факты и суммы синтетические; выводы требуют профессиональной проверки."}\n\n${demo.question[locale]}\n\n${en ? "Expected output" : "Ожидаемый результат"}: ${book.primaryOutcome[locale]}`,
    premisePublication: "author-reviewed", nodes,
    links: [...links,
      { id: "option-reviewed", from: "decision", to: "outcome-proceed", rule: { label: en ? "Preserve evidence and verify" : "Сохранить и проверить", minutes: 30 } },
      { id: "option-alternative", from: "decision", to: "outcome-pause", rule: { label: en ? (id === "training_simulation" ? "Restart without verification" : "Pause / choose alternative") : (id === "training_simulation" ? "Запустить без проверки" : "Приостановить / выбрать альтернативу"), minutes: 10 } },
    ], editHistory: [], updatedAt,
  }, id);
  draft.classification = { ...draft.classification!, tags: ["fictional", "category-demo"], difficulty: "Intermediate" };
  if (id === "tax_planning" || id === "tax_compliance") draft.taxEconomics = {
    ...defaultTaxEconomics(), taxInputBasis: "amounts", baselineAnnualTaxCost: 100000,
    optimizedAnnualTaxCost: 80000, implementationCost: 25000, annualMaintenanceCost: 5000,
    assumptions: en ? "Synthetic teaching amounts, not statutory rates. No tax treatment, eligibility or source review is verified. Recalculate after every input change." : "Учебные суммы, не установленные ставки. Режим, условия и источники не проверены. Пересчитать после каждого изменения.",
  };
  return draft;
}
