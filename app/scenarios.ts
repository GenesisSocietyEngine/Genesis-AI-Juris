import canonicalBundle from "./canonical-case-bundle.json";
import { initialMetrics } from "./runtime-constants";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import type { LocalText, Scenario, ScenarioDeadline, ScenarioStage } from "./types";

const t = (ru: string, en: string): LocalText => ({ ru, en });

type BaseScenario = Omit<Scenario, "opening" | "initialStageId" | "initialClockMinute" | "deadlines" | "workflowInbox">;

type CanonicalCase = {
  case_id: string;
  scenario_fingerprint: string;
  scenario: {
    metadata: { title: string; summary: string; content_version: string };
  };
  scenario_localizations?: Record<string, {
    metadata?: { title?: string; summary?: string };
  }>;
};

const baseScenarios: BaseScenario[] = [
  {
    id: "be_commercial_failed_erp_001",
    caseId: "be_commercial_failed_erp_001",
    order: 10,
    title: t("Неудачное внедрение ERP", "Failed ERP Implementation"),
    subtitle: t("Системный сбой стал договорным конфликтом", "A systems failure becomes a contract dispute"),
    jurisdiction: "BE · Commercial",
    role: t("Внешний юрисконсульт", "External counsel"),
    version: "1.1.0",
    sector: t("Технологии / внедрение", "Technology / implementation"),
    urgency: "elevated",
    fingerprint: "ed3e6746…e2fd2f8",
    accent: "#d2a85e",
    actors: [t("Заказчик · Aster NV", "Customer · Aster NV"), t("Интегратор · Novaxis", "Integrator · Novaxis"), t("Технический эксперт", "Technical expert")],
    materials: [
      { ref: "ERP-01", type: t("Договор", "Contract"), title: t("Спецификация внедрения v4", "Implementation specification v4"), source: t("Проектный архив", "Project archive"), date: "04.03.2025" },
      { ref: "ERP-07", type: t("Переписка", "Correspondence"), title: t("Протокол приёмки и перечень дефектов", "Acceptance log and defect list"), source: t("CIO заказчика", "Customer CIO"), date: "18.06.2025" },
      { ref: "ERP-12", type: t("Экспертиза", "Expert report"), title: t("Причинность сбоя миграции данных", "Data migration failure causation"), source: t("Независимый эксперт", "Independent expert"), date: "21.07.2025" },
    ],
    stages: [
      {
        id: "erp-preservation", day: 1, time: "08:40", phase: t("Сохранение позиции", "Position preservation"),
        headline: t("Заказчик требует немедленного расторжения", "Customer demands immediate termination"),
        brief: t("Система остановила отгрузки. Контрагент утверждает, что дефекты фундаментальны, и готовит замену интегратора.", "The system halted dispatch. The counterparty says defects are fundamental and is preparing a replacement integrator."),
        source: t("Письмо совета директоров · 08:31", "Board letter · 08:31"), materialRefs: ["ERP-01", "ERP-07"],
        options: [
          { id: "erp-notice", label: t("Направить уведомление о сохранении доказательств", "Issue evidence-preservation notice"), detail: t("Зафиксировать логи, версии и доступ к среде до вмешательства нового подрядчика.", "Freeze logs, versions and environment access before a replacement contractor intervenes."), result: t("Архив зафиксирован; спор о причинности остаётся открытым.", "The archive is preserved; causation remains disputed."), cost: 1800, minutes: 90, effects: { evidence: 18, position: 8, exposure: -3 } },
          { id: "erp-settlement", label: t("Предложить техническую сессию без признания", "Offer a without-prejudice technical session"), detail: t("Получить 48 часов для совместной диагностики и рамки урегулирования.", "Buy 48 hours for joint diagnosis and a settlement frame."), result: t("Контрагент согласился на короткое окно, но требует финансовый резерв.", "The counterparty accepted a short window but demands a financial reserve."), cost: 950, minutes: 60, effects: { trust: 15, position: 5, exposure: 4 } },
          { id: "erp-deny", label: t("Полностью отклонить претензию", "Reject the claim in full"), detail: t("Сослаться на ошибки данных заказчика и завершённую приёмку.", "Rely on customer data errors and completed acceptance."), result: t("Позиция обозначена жёстко; доступ к системе ограничен.", "The position is firm; system access is restricted."), cost: 600, minutes: 45, effects: { position: 7, trust: -16, exposure: 12 } },
        ],
      },
      {
        id: "erp-expert", day: 3, time: "14:20", phase: t("Причинность", "Causation"),
        headline: t("Эксперт обнаружил смешанную причину сбоя", "Expert finds mixed causation"),
        brief: t("Дефект конвертера интегратора усилился из-за неполных справочников заказчика. Обе стороны контролируют разные фрагменты доказательств.", "An integrator converter defect was amplified by incomplete customer master data. Each side controls different evidence."),
        source: t("Предварительная записка эксперта", "Preliminary expert note"), materialRefs: ["ERP-12"],
        options: [
          { id: "erp-joint", label: t("Согласовать совместный протокол эксперта", "Agree a joint expert protocol"), detail: t("Закрепить бесспорные факты и перечень спорных допущений.", "Lock undisputed facts and list contested assumptions."), result: t("Фактическое поле сузилось; открылась основа для расчёта долей.", "The factual field narrowed; a basis for apportionment emerged."), cost: 2400, minutes: 240, effects: { evidence: 20, trust: 10, exposure: -8 } },
          { id: "erp-private", label: t("Заказать отдельную контрэкспертизу", "Commission a private counter-report"), detail: t("Проверить методику до раскрытия собственной позиции.", "Test the methodology before disclosing your position."), result: t("Контрэкспертиза усилила аргумент о данных, но увеличила задержку.", "The report strengthened the data argument but increased delay."), cost: 5200, minutes: 720, effects: { evidence: 14, position: 15, trust: -5, exposure: 4 } },
        ],
      },
      {
        id: "erp-resolution", day: 8, time: "09:10", phase: t("Разрешение спора", "Resolution"),
        headline: t("Окно урегулирования закрывается сегодня", "Settlement window closes today"),
        brief: t("Коммерческая работа продолжается, но совет заказчика готовит иск. Решение определит, станет ли спор контролируемым или многолетним.", "Commercial work continues, but the customer board is preparing a claim. The decision determines whether the dispute stays controlled."),
        source: t("Медиатор · итоговая рамка", "Mediator · final framework"), materialRefs: ["ERP-01", "ERP-12"],
        options: [
          { id: "erp-close", label: t("Закрыть спор структурированным соглашением", "Close through a structured settlement"), detail: t("Ремедиация, ограниченная компенсация и взаимный отказ от требований.", "Remediation, capped compensation and mutual release."), result: t("Стороны сохранили проект и закрыли основную экспозицию.", "The parties preserved the project and closed the main exposure."), cost: 64500, minutes: 210, effects: { trust: 22, exposure: -24, position: 7 } },
          { id: "erp-litigate", label: t("Передать дело в суд с полной доказательной картой", "Proceed to court with the full evidentiary record"), detail: t("Защитить правовую позицию, приняв длительность и публичность процесса.", "Defend the legal position while accepting duration and publicity."), result: t("Иск принят; позиция сохранена для подготовленного решения.", "The claim proceeds; the position is preserved for judgment."), cost: 18000, minutes: 960, effects: { position: 24, evidence: 8, trust: -12, exposure: 10 } },
        ],
      },
    ],
    outcomes: {
      strong: t("Контролируемое урегулирование: доказательства сохранены, экспозиция ограничена.", "Controlled resolution: evidence preserved and exposure capped."),
      mixed: t("Подготовленная судебная позиция: спор продолжается, но досье выдерживает проверку.", "Prepared litigation position: the dispute continues, but the record holds."),
      weak: t("Ремиттал и открытая экспозиция: причинность и контроль над доказательствами утрачены.", "Remittal and open exposure: causation and evidence control were lost."),
    },
  },
  {
    id: "be_commercial_logistics_001",
    caseId: "be_commercial_logistics_001",
    order: 20,
    title: t("Неоплаченные логистические счета", "Unpaid Logistics Invoices"),
    subtitle: t("Три маршрута, один должник и исчезающий груз", "Three routes, one debtor and disappearing cargo"),
    jurisdiction: "BE · Commercial",
    role: t("Юрист кредитора", "Creditor counsel"), version: "1.1.0",
    sector: t("Логистика", "Logistics"), urgency: "standard", fingerprint: "1c6a26a5…52a8dd8", accent: "#5bb8c4",
    actors: [t("Перевозчик · Northline", "Carrier · Northline"), t("Покупатель · BelgoMart", "Buyer · BelgoMart"), t("Складской оператор", "Warehouse operator")],
    materials: [
      { ref: "LOG-02", type: t("Счета", "Invoices"), title: t("Пакет из 14 неоплаченных счетов", "Bundle of 14 unpaid invoices"), source: t("Northline Finance", "Northline Finance"), date: "12.05.2025" },
      { ref: "LOG-06", type: t("Транспортные документы", "Transport records"), title: t("CMR и отметки доставки", "CMR notes and delivery stamps"), source: t("Операционный архив", "Operations archive"), date: "28.05.2025" },
      { ref: "LOG-09", type: t("Реестр", "Registry"), title: t("Изменения обеспечения должника", "Debtor security changes"), source: t("Коммерческий реестр", "Commercial registry"), date: "02.06.2025" },
    ],
    stages: [
      { id: "log-demand", day: 1, time: "10:05", phase: t("Взыскание", "Recovery"), headline: t("Должник оспаривает весь пакет счетов", "Debtor disputes the entire invoice bundle"), brief: t("Часть оригиналов CMR находится у складского оператора. Финансовый директор должника предлагает обсуждать только три рейса.", "Some original CMR notes are held by the warehouse operator. The debtor CFO offers to discuss only three routes."), source: t("Ответ на претензию", "Response to demand"), materialRefs: ["LOG-02", "LOG-06"], options: [
        { id: "log-reconcile", label: t("Провести сверку по каждому рейсу", "Reconcile route by route"), detail: t("Связать счёт, CMR, окно доставки и возражение.", "Link each invoice, CMR, delivery window and objection."), result: t("Десять счетов признаны, по четырём остаются расхождения.", "Ten invoices are admitted; four remain disputed."), cost: 750, minutes: 180, effects: { evidence: 18, trust: 8, exposure: -4 } },
        { id: "log-summary", label: t("Направить суммарное требование", "Send an aggregate demand"), detail: t("Зафиксировать срок оплаты всего портфеля.", "Set a payment deadline for the full portfolio."), result: t("Срок зафиксирован, но должник усилил формальные возражения.", "The deadline is fixed, but the debtor hardened formal objections."), cost: 300, minutes: 45, effects: { position: 10, trust: -6, exposure: 5 } },
      ] },
      { id: "log-security", day: 2, time: "16:30", phase: t("Обеспечение", "Security"), headline: t("Активы должника перемещаются между компаниями группы", "Debtor assets are moving within the group"), brief: t("Реестр показывает новую залоговую запись. Окно для обеспечительной меры может быть коротким.", "The registry shows a new security filing. The window for interim relief may be short."), source: t("Мониторинг реестра", "Registry monitoring"), pressure: t("Риск утраты обеспечения · 06:00", "Security dissipation risk · 06:00"), materialRefs: ["LOG-09"], options: [
        { id: "log-secure", label: t("Подготовить обеспечительную меру", "Prepare interim security relief"), detail: t("Собрать доказательства срочности и идентифицировать активы.", "Assemble urgency evidence and identify assets."), result: t("Ключевой актив идентифицирован до следующего перемещения.", "A key asset is identified before the next transfer."), cost: 2400, minutes: 300, effects: { position: 20, evidence: 8, exposure: -12 } },
        { id: "log-negotiate", label: t("Запросить банковскую гарантию", "Request a bank guarantee"), detail: t("Обменять паузу в обеспечении на проверяемое обеспечение.", "Exchange a pause in relief for verifiable security."), result: t("Должник предложил частичную гарантию и график.", "The debtor offered a partial guarantee and schedule."), cost: 900, minutes: 90, effects: { trust: 18, position: 8, exposure: -5 } },
      ] },
      { id: "log-close", day: 4, time: "11:45", phase: t("Развязка", "Resolution"), headline: t("Финальный выбор: график или решение суда", "Final choice: schedule or judgment"), brief: t("Признанная сумма может быть выплачена быстро; спорный остаток потребует доказательств по рейсам.", "The admitted amount can be paid quickly; the disputed balance requires route evidence."), source: t("Совет клиента", "Client board"), materialRefs: ["LOG-02", "LOG-06", "LOG-09"], options: [
        { id: "log-deal", label: t("Принять обеспеченный график", "Accept the secured schedule"), detail: t("Поэтапная оплата с гарантией и ускорением при дефолте.", "Staged payment with guarantee and acceleration on default."), result: t("Взыскание согласовано без потери обеспечительной позиции.", "Recovery is negotiated without losing security."), cost: 1200, minutes: 270, effects: { trust: 18, exposure: -18, position: 6 } },
        { id: "log-judgment", label: t("Получить решение по признанной сумме", "Seek judgment on the admitted amount"), detail: t("Отделить бесспорную часть и сохранить остаток.", "Sever the undisputed amount and preserve the balance."), result: t("Решение получено; спорный остаток сохранён.", "Judgment is obtained; the disputed balance remains preserved."), cost: 3200, minutes: 480, effects: { position: 22, evidence: 6, trust: -8 } },
      ] },
    ],
    outcomes: { strong: t("Согласованное взыскание: платёж обеспечен, деловые отношения сохранены.", "Negotiated recovery: payment secured and the relationship preserved."), mixed: t("Судебное взыскание: признанная сумма защищена, остаток остаётся в споре.", "Judgment recovery: the admitted sum is protected; the balance remains disputed."), weak: t("Необеспеченная позиция: активы ушли раньше, чем доказательства были собраны.", "Unsecured position: assets moved before the evidence was assembled.") },
  },
  {
    id: "greenfire_first_72_hours",
    caseId: "greenfire_first_72_hours",
    order: 30,
    title: t("GreenFire — первые 72 часа", "GreenFire — The First 72 Hours"),
    subtitle: t("Пожар, регулятор и конфликт инструкций", "Fire, regulator and conflicting instructions"),
    jurisdiction: "NL · Corporate / Regulatory", role: t("Управляющий директор", "Managing Director"), version: "0.3.0", sector: t("Промышленность / кризис", "Industrial / crisis"), urgency: "critical", fingerprint: "173140f0…bde2438", accent: "#f06b4f",
    actors: [t("GreenFire Industries", "GreenFire Industries"), t("Регулятор среды", "Environmental regulator"), t("Директор площадки", "Site director")],
    materials: [
      { ref: "GF-03", type: t("Инцидент", "Incident log"), title: t("Первичный журнал пожара", "Initial fire log"), source: t("Дежурная смена", "Duty shift"), date: "D1 · 06:18" },
      { ref: "GF-08", type: t("Инструкция", "Instruction"), title: t("Порядок хранения реагентов", "Reagent storage procedure"), source: t("Операционный директор", "COO"), date: "D1 · 07:42" },
      { ref: "GF-14", type: t("Отбор проб", "Sampling record"), title: t("Цепочка сохранности проб", "Sample chain of custody"), source: t("Лаборатория", "Laboratory"), date: "D2 · 04:10" },
    ],
    stages: [
      { id: "gf-intake", day: 1, time: "08:07", phase: t("Экстренный приём", "Emergency intake"), headline: t("Обнаружен конфликт между практикой хранения и инструкциями директора", "Storage practice may conflict with the director’s instructions"), brief: t("Первые показания расходятся. Четыре сообщения требуют внимания, регулятор запрашивает сохранение площадки.", "Early accounts diverge. Four messages need attention, and the regulator requests site preservation."), source: t("Ситуационная сводка · ACTION REQUIRED", "Situation update · ACTION REQUIRED"), materialRefs: ["GF-03", "GF-08"], options: [
        { id: "gf-preserve", label: t("Заморозить документы и доступ к площадке", "Preserve records and site access"), detail: t("Единый legal hold, журнал доступа и независимая фиксация.", "Single legal hold, access log and independent capture."), result: t("Доказательства сохранены до первого интервью регулятора.", "Evidence is preserved before the regulator’s first interview."), cost: 4200, minutes: 150, effects: { evidence: 22, position: 10, exposure: -8 } },
        { id: "gf-contain", label: t("Сначала стабилизировать операционную работу", "Stabilize operations first"), detail: t("Возобновить безопасные процессы, затем собрать материалы.", "Restore safe operations, then assemble the record."), result: t("Риск производства снижен, но часть журналов была перезаписана.", "Operational risk fell, but some logs were overwritten."), cost: 2800, minutes: 120, effects: { trust: 12, evidence: -10, exposure: 7 } },
      ] },
      { id: "gf-pressure", day: 2, time: "04:10", phase: t("Регуляторное давление", "Regulatory pressure"), headline: t("Регулятор требует образцы и объяснение к 06:00", "Regulator demands samples and an account by 06:00"), brief: t("Цепочка сохранности не завершена. Передача сейчас ускорит ответ, но оставит разрыв в происхождении материала.", "Chain of custody is incomplete. Sending now accelerates response but leaves a provenance gap."), source: t("Предписание инспектора", "Inspector request"), pressure: t("Активное давление · срок 06:00", "Active pressure · deadline 06:00"), materialRefs: ["GF-14"], options: [
        { id: "gf-chain", label: t("Завершить цепочку сохранности перед передачей", "Complete chain of custody before transfer"), detail: t("Подтвердить отбор, пломбы, транспорт и лабораторный приём.", "Verify collection, seals, transport and laboratory receipt."), result: t("Передача задержана, но происхождение каждой пробы подтверждено.", "Transfer was delayed, but every sample’s provenance is verified."), cost: 3600, minutes: 110, effects: { evidence: 24, position: 12, trust: 4 } },
        { id: "gf-send", label: t("Передать доступный пакет немедленно", "Send the available package now"), detail: t("Отметить недостающие элементы как последующее дополнение.", "Mark missing elements for later supplementation."), result: t("Срок соблюдён; инспектор отметил разрыв в цепочке.", "The deadline was met; the inspector noted a chain gap."), cost: 1600, minutes: 45, effects: { trust: 14, evidence: -8, exposure: 10 } },
      ] },
      { id: "gf-board", day: 3, time: "07:35", phase: t("Позиция совета", "Board position"), headline: t("Совет должен определить публичную и регуляторную позицию", "Board must set the public and regulatory position"), brief: t("Причина ещё не установлена. Формулировка должна защищать расследование, сотрудников и доверие регулятора.", "Cause is not yet established. The position must protect the inquiry, employees and regulatory trust."), source: t("Закрытое заседание совета", "Closed board session"), materialRefs: ["GF-03", "GF-08", "GF-14"], options: [
        { id: "gf-cooperate", label: t("Принять проверяемую позицию полного сотрудничества", "Adopt a verifiable full-cooperation position"), detail: t("Сообщить подтверждённые факты, пробелы и план сохранения.", "State verified facts, gaps and the preservation plan."), result: t("Кризисная позиция защищена без преждевременного вывода о причине.", "The crisis position is protected without a premature causation finding."), cost: 7800, minutes: 300, effects: { trust: 24, position: 18, exposure: -16 } },
        { id: "gf-defend", label: t("Оспорить объём требований регулятора", "Challenge the scope of the regulator’s demands"), detail: t("Сузить передачу до юридически обязательного минимума.", "Limit disclosure to the legally required minimum."), result: t("Часть запроса сужена, но регулятор усилил процессуальный контроль.", "Part of the request was narrowed, but procedural scrutiny intensified."), cost: 6200, minutes: 360, effects: { position: 20, trust: -14, exposure: 14 } },
      ] },
    ],
    outcomes: { strong: t("Защищённая кризисная позиция: происхождение доказательств и сотрудничество выдержали проверку.", "Protected crisis position: provenance and cooperation held under scrutiny."), mixed: t("Компромиссная кризисная позиция: операционная работа сохранена ценой регуляторного недоверия.", "Compromised crisis position: operations survived at the cost of regulatory trust."), weak: t("Кризисная позиция разрушена: неполная фиксация превратила фактический пробел в процессуальный риск.", "Crisis position lost: incomplete capture turned a factual gap into procedural risk.") },
  },
  {
    id: "goldenshell_recall_at_dawn",
    caseId: "nl_food_safety_goldenshell_001",
    order: 40,
    title: t("GoldenShell — отзыв на рассвете", "GoldenShell — Recall at Dawn"),
    subtitle: t("Загрязнение цепочки поставок яиц", "Contaminated egg supply chain"), jurisdiction: "NL · Food safety", role: t("Координатор претензий", "Claims coordinator"), version: "0.2.0", sector: t("Пищевая безопасность", "Food safety"), urgency: "critical", fingerprint: "7b0d2d7f…d18ba4", accent: "#f0c35b",
    actors: [t("GoldenShell Foods", "GoldenShell Foods"), t("Фермерский кооператив", "Farm cooperative"), t("NVWA", "NVWA")],
    materials: [
      { ref: "GS-02", type: t("Лаборатория", "Laboratory"), title: t("Предварительный результат партии", "Preliminary batch result"), source: t("Контрактная лаборатория", "Contract laboratory"), date: "D1 · 04:45" },
      { ref: "GS-05", type: t("Трассировка", "Traceability"), title: t("Маршруты партии и распределение", "Batch routes and distribution"), source: t("Supply control", "Supply control"), date: "D1 · 05:12" },
      { ref: "GS-11", type: t("Претензии", "Claims"), title: t("Реестр сообщений покупателей", "Retailer notification ledger"), source: t("Claims desk", "Claims desk"), date: "D1 · 07:20" },
    ],
    stages: [
      { id: "gs-signal", day: 1, time: "05:05", phase: t("Сигнал", "Signal"), headline: t("Лаборатория сообщает о вероятном загрязнении", "Laboratory flags probable contamination"), brief: t("Результат предварительный, но часть партии уже распределена в трёх странах.", "The result is preliminary, but part of the batch is already distributed in three countries."), source: t("Ночной звонок лаборатории", "Overnight laboratory call"), pressure: t("Окно трассировки · 01:20", "Trace window · 01:20"), materialRefs: ["GS-02", "GS-05"], options: [
        { id: "gs-hold", label: t("Ввести удержание по всей связанной партии", "Place a hold on the linked batch"), detail: t("Остановить отгрузки по всем найденным маршрутам.", "Stop dispatch across all identified routes."), result: t("Распределение остановлено; объём удержания шире подтверждённого риска.", "Distribution stopped; the hold exceeds the confirmed risk."), cost: 18500, minutes: 75, effects: { trust: 16, evidence: 8, exposure: -18 } },
        { id: "gs-confirm", label: t("Дождаться подтверждающего анализа", "Wait for confirmatory analysis"), detail: t("Сохранить внутреннее наблюдение до второго результата.", "Maintain internal monitoring pending a second result."), result: t("Результат подтверждён; ещё две отгрузки покинули склад.", "The result was confirmed; two more shipments left the warehouse."), cost: 2500, minutes: 95, effects: { evidence: 10, exposure: 18, trust: -10 } },
      ] },
      { id: "gs-recall", day: 1, time: "07:10", phase: t("Отзыв", "Recall"), headline: t("Трассировка неполна по одному посреднику", "Traceability is incomplete for one intermediary"), brief: t("Регулятору нужен единый перечень рынков, но коммерческий отдел предлагает уведомлять поэтапно.", "The regulator needs one market list, but sales proposes staged notifications."), source: t("Кризисная группа", "Crisis team"), materialRefs: ["GS-05", "GS-11"], options: [
        { id: "gs-single", label: t("Создать единый центр координации отзыва", "Create one recall coordination cell"), detail: t("Один реестр, одна карта партий и согласованные уведомления.", "One ledger, one batch map and coordinated notices."), result: t("Три рынка получили согласованные инструкции; пробел посредника отмечен явно.", "Three markets received aligned instructions; the intermediary gap is explicit."), cost: 9600, minutes: 210, effects: { position: 16, trust: 18, evidence: 12 } },
        { id: "gs-local", label: t("Передать уведомления локальным командам", "Delegate notices to local teams"), detail: t("Ускорить первые звонки, приняв различия в формулировках.", "Accelerate first calls while accepting different wording."), result: t("Первые магазины уведомлены быстро, но основания отзыва описаны по-разному.", "First stores were notified quickly, but the recall basis diverged."), cost: 5200, minutes: 120, effects: { trust: 6, exposure: 10, position: -6 } },
      ] },
      { id: "gs-claims", day: 3, time: "09:25", phase: t("Позиция по претензиям", "Claims position"), headline: t("Поставщики и ритейлеры требуют определить ответственность", "Suppliers and retailers demand an allocation of responsibility"), brief: t("Источник подтверждён лишь частично. Раннее признание упростит компенсации, но может разрушить регресс.", "The source is only partly confirmed. Early admission simplifies compensation but may impair recourse."), source: t("Совместная претензионная сессия", "Joint claims session"), materialRefs: ["GS-02", "GS-05", "GS-11"], options: [
        { id: "gs-framework", label: t("Согласовать координированную рамку претензий", "Agree a coordinated claims framework"), detail: t("Разделить помощь потребителям, резервы и окончательное распределение.", "Separate consumer remediation, reserves and final allocation."), result: t("Претензии управляются в одной рамке без преждевременного признания.", "Claims are managed in one framework without premature admission."), cost: 24000, minutes: 420, effects: { trust: 22, position: 16, exposure: -14 } },
        { id: "gs-separate", label: t("Защитить каждую компанию отдельно", "Defend each company separately"), detail: t("Сохранить индивидуальные возражения и право регресса.", "Preserve individual defenses and recourse rights."), result: t("Позиции сохранены, но уведомления и резервы фрагментированы.", "Defenses are preserved, but notices and reserves are fragmented."), cost: 16000, minutes: 510, effects: { position: 14, trust: -15, exposure: 12 } },
      ] },
    ],
    outcomes: { strong: t("Координированная претензионная позиция: отзыв, доказательства и компенсации связаны одной системой.", "Coordinated claims position: recall, evidence and remediation share one system."), mixed: t("Фрагментированная позиция: отдельные защиты сохранены, но доверие и контроль ослаблены.", "Fragmented claims position: individual defenses remain, but trust and control weakened."), weak: t("Неконтролируемый отзыв: разрывы трассировки превратились в несогласованные обязательства.", "Uncontrolled recall: trace gaps became inconsistent liabilities.") },
  },
  {
    id: "desert_water_groundwater_claim",
    caseId: "us_environmental_desert_water_001",
    order: 50,
    title: t("Вода пустыни", "Desert Water"), subtitle: t("Подземные воды, общий источник и цена доказательства", "Groundwater, a shared source and the price of proof"), jurisdiction: "US · Environmental", role: t("Ведущий юрист истцов", "Lead claimant counsel"), version: "0.2.0", sector: t("Экология / массовые требования", "Environmental / mass claims"), urgency: "elevated", fingerprint: "636e7b78…c41a28af", accent: "#58b6a7",
    actors: [t("Жители Arroyo County", "Arroyo County residents"), t("DesertChem", "DesertChem"), t("Гидрогеолог", "Hydrogeologist")],
    materials: [
      { ref: "DW-01", type: t("Пробы", "Sampling"), title: t("Сводная таблица частных скважин", "Private well sample matrix"), source: t("Муниципальная лаборатория", "Municipal laboratory"), date: "14.02.2026" },
      { ref: "DW-08", type: t("Карта", "Map"), title: t("Гидрогеологическая модель потока", "Hydrogeological flow model"), source: t("Эксперт истцов", "Claimant expert"), date: "03.03.2026" },
      { ref: "DW-13", type: t("Медицина", "Medical"), title: t("Анонимизированный реестр экспозиции", "De-identified exposure registry"), source: t("Окружная клиника", "County clinic"), date: "11.03.2026" },
    ],
    stages: [
      { id: "dw-source", day: 1, time: "09:30", phase: t("Общий источник", "Common source"), headline: t("Пробы показывают общий загрязнитель, но не общий путь", "Samples show a common contaminant, not a common pathway"), brief: t("Концентрации различаются. Без модели потока объединение требований может быть преждевременным.", "Concentrations vary. Without a flow model, aggregation may be premature."), source: t("Лабораторный брифинг", "Laboratory briefing"), materialRefs: ["DW-01"], options: [
        { id: "dw-grid", label: t("Расширить сетку отбора проб", "Expand the sampling grid"), detail: t("Добавить контрольные точки выше и ниже по потоку.", "Add upstream and downstream control points."), result: t("Сетка выявила градиент, согласующийся с промышленной зоной.", "The grid revealed a gradient consistent with the industrial zone."), cost: 18000, minutes: 540, effects: { evidence: 24, position: 10, exposure: -4 } },
        { id: "dw-file", label: t("Подать требования на имеющейся матрице", "File on the existing matrix"), detail: t("Зафиксировать сроки и добиваться данных ответчика через раскрытие.", "Preserve limitations and seek defendant data through discovery."), result: t("Срок сохранён, но суд запросил более ясную теорию общего источника.", "Limitations are preserved, but the court asks for a clearer common-source theory."), cost: 9500, minutes: 330, effects: { position: 14, evidence: -6, exposure: 8 } },
      ] },
      { id: "dw-model", day: 12, time: "13:15", phase: t("Причинная модель", "Causation model"), headline: t("Эксперт просит данные ответчика о старых испарительных прудах", "Expert needs defendant data on historic evaporation ponds"), brief: t("Публичные карты неполны. Добровольный обмен ускорит модель, но раскроет стратегию выборки.", "Public maps are incomplete. Voluntary exchange speeds the model but reveals sampling strategy."), source: t("Записка гидрогеолога", "Hydrogeologist memorandum"), materialRefs: ["DW-08"], options: [
        { id: "dw-order", label: t("Добиваться ограниченного раскрытия по источнику", "Seek targeted source discovery"), detail: t("Запросить журналы прудов, мониторинг и геологические разрезы.", "Request pond logs, monitoring and geological sections."), result: t("Получены данные, которые связали исторический пруд с наблюдаемым плюмом.", "Data linked a historic pond to the observed plume."), cost: 28000, minutes: 720, effects: { evidence: 22, position: 16, exposure: -6 } },
        { id: "dw-public", label: t("Завершить модель на публичных данных", "Complete the model on public data"), detail: t("Сохранить методику закрытой и обозначить диапазон неопределённости.", "Keep methodology confidential and state the uncertainty range."), result: t("Модель правдоподобна, но альтернативный источник не исключён.", "The model is credible, but an alternative source remains possible."), cost: 14500, minutes: 480, effects: { evidence: 12, position: 8, exposure: 6 } },
      ] },
      { id: "dw-remedy", day: 37, time: "08:50", phase: t("Средство защиты", "Remedy"), headline: t("Посредник предлагает фонд воды до решения о вине", "Mediator proposes a water fund before liability is resolved"), brief: t("Немедленное снабжение снизит вред. Формула фонда должна не закрыть будущие медицинские требования.", "Immediate supply reduces harm. The fund formula must not extinguish future medical claims."), source: t("Конфиденциальная рамка посредника", "Confidential mediator framework"), materialRefs: ["DW-01", "DW-08", "DW-13"], options: [
        { id: "dw-fund", label: t("Создать фонд с сохранением медицинских требований", "Create a fund preserving medical claims"), detail: t("Финансировать чистую воду сейчас, разделив временную помощь и финальный релиз.", "Fund clean water now while separating interim relief from final release."), result: t("Источник и средство защиты соединены без закрытия будущих требований.", "Source and remedy are connected without closing future claims."), cost: 32000, minutes: 390, effects: { trust: 24, position: 18, exposure: -18 } },
        { id: "dw-global", label: t("Принять глобальное закрытие требований", "Accept a global claims release"), detail: t("Получить быстрый крупный фонд в обмен на окончательный отказ.", "Secure a larger immediate fund in exchange for final release."), result: t("Вода профинансирована, но неопределённые долгосрочные требования закрыты.", "Water is funded, but uncertain long-term claims are extinguished."), cost: 14000, minutes: 300, effects: { trust: 10, exposure: -8, position: -15 } },
      ] },
    ],
    outcomes: { strong: t("Достоверный источник и средство защиты: помощь началась, будущие требования сохранены.", "Credible source and remedy: relief began and future claims remain preserved."), mixed: t("Компромиссное закрытие: немедленная вода обеспечена ценой части долгосрочной позиции.", "Compromised closure: immediate water is secured at the cost of long-term position."), weak: t("Разрозненная причинность: требования закрылись раньше, чем источник был доказан.", "Fragmented causation: claims closed before the source was established.") },
  },
];

const canonicalCases = (canonicalBundle.cases as unknown as CanonicalCase[]);

export const scenarios: Scenario[] = baseScenarios.map((base) => {
  const canonicalCase = canonicalCases.find((item) => item.case_id === base.caseId);
  if (!canonicalCase) throw new Error(`Canonical case missing: ${base.caseId}`);
  const raw = canonicalCase.scenario;
  const metadata = raw.metadata;
  const terminalId = `${base.caseId}_web_debrief`;
  const webStages: ScenarioStage[] = base.stages.map((stage, index) => ({
    ...stage,
    options: stage.options.map((option) => ({ ...option, nextStageId: base.stages[index + 1]?.id ?? terminalId })),
  }));
  const finalAuthoredStage = base.stages.at(-1)!;
  webStages.push({
    id: terminalId,
    day: finalAuthoredStage.day + 1,
    time: finalAuthoredStage.time,
    phase: t("Разбор", "Debrief"),
    headline: t("Дело готово к разбору", "The matter is ready for debrief"),
    brief: t("Версионная веб-адаптация завершена.", "The versioned web adaptation is complete."),
    source: t("GENESIS: JURIS · web beta", "GENESIS: JURIS · web beta"),
    materialRefs: [],
    options: [],
    terminal: true,
  });
  const webDeadlines: ScenarioDeadline[] = base.stages.flatMap((stage) => stage.pressure ? [{
    id: `${stage.id}_response_window`,
    title: stage.pressure,
    dueAtMinute: stageMinute(stage.day, stage.time) + 360,
    completionActions: stage.options.map((option) => option.id),
  }] : []);
  const scenario: Scenario = {
    ...base,
    version: base.version,
    fingerprint: "",
    sourceFingerprint: canonicalCase.scenario_fingerprint,
    opening: {
      en: canonicalCase.scenario_localizations?.en?.metadata?.summary ?? metadata.summary,
      ru: canonicalCase.scenario_localizations?.ru?.metadata?.summary ?? metadata.summary,
    },
    initialStageId: webStages[0].id,
    initialClockMinute: stageMinute(webStages[0].day, webStages[0].time),
    stages: webStages,
    deadlines: webDeadlines,
    workflowInbox: [],
  };
  const normalizedScenario = normalizePlayableScenario(scenario);
  return { ...normalizedScenario, fingerprint: playableFingerprint(normalizedScenario) };
});

export { initialMetrics };

function stageMinute(day: number, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return Math.max(0, day - 1) * 1440 + (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
