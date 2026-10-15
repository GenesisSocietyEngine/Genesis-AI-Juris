import { CASE_REVIEW_QUESTION_IDS } from "./case-review-questions";

type Text = readonly [string, string];
type Question = readonly [Text, Text];
const briefs: Record<string, readonly Question[]> = {
  be_commercial_failed_erp_001: [
    [["Which recovery route should be compared?", "Какие способы урегулирования сравнить?"], ["Compare settlement with a claim against the client's objectives. Keep the preferred route unresolved until its conditions are reviewed.", "Сравните урегулирование и иск с целями клиента. Не выбирайте маршрут до проверки его условий."]],
    [["What supports breach and causation?", "Чем подтверждаются нарушение и причинная связь?"], ["Review scope changes, conditional acceptance, correspondence and technical material. Identify missing originals and disputed loss causation.", "Проверьте изменения объёма, условную приёмку, переписку и технические материалы. Отметьте отсутствующие оригиналы и спорную причинную связь убытков."]],
    [["What authority is needed for the next step?", "Какие полномочия нужны для следующего шага?"], ["Confirm the proposed owner, budget and client authority before a filing, settlement or appeal. Planning does not record an instruction.", "До подачи документов, соглашения или обжалования подтвердите ответственного, бюджет и поручение клиента. План не фиксирует поручение."]],
  ],
  be_commercial_logistics_001: [
    [["Which amounts and recovery routes are in scope?", "Какие суммы и способы взыскания рассматриваются?"], ["Separate supported invoice amounts from disputed service charges, then compare negotiated recovery with a claim.", "Отделите подтверждённые суммы счетов от спорной стоимости услуг; затем сравните переговоры и иск."]],
    [["Which delivery evidence is still missing?", "Каких подтверждений доставки не хватает?"], ["Reconcile invoices, performance and objections against original delivery records. A source-register title does not establish the amount due.", "Сверьте счета, исполнение и возражения с оригиналами документов доставки. Название в реестре не подтверждает сумму долга."]],
    [["What must be confirmed before recovery action?", "Что подтвердить до начала взыскания?"], ["Record the proposed owner, authority, costs and timing for each route. Verify actual dates and conditions before commitment.", "Зафиксируйте предлагаемых ответственных, полномочия, расходы и сроки каждого варианта. Проверьте даты и условия до принятия обязательств."]],
  ],
  greenfire_first_72_hours: [
    [["Whose mandate and instructions apply?", "Чей мандат и какие поручения применимы?"], ["Clarify the company mandate, directors' interests and any need for separate advice. Keep conflicting instructions visible for review.", "Уточните мандат компании, интересы директоров и необходимость отдельной консультации. Сохраните противоречивые поручения для проверки."]],
    [["What evidence needs preservation and checking?", "Какие материалы сохранить и проверить?"], ["Review fire, runoff, permit, insurance and operational records. Separate hypotheses from supported statements and missing originals.", "Проверьте материалы пожара, стоков, разрешений, страхования и операций. Отделите гипотезы от подтверждённых утверждений и отсутствующих оригиналов."]],
    [["What is needed for a defensible handoff?", "Что нужно для обоснованной передачи дела?"], ["Compare preservation, notification and response options. Verify owners, dates, authority and handoff conditions before acting.", "Сравните сохранение материалов, уведомления и варианты реагирования. До действий проверьте ответственных, даты, полномочия и условия передачи."]],
  ],
  nl_food_safety_goldenshell_001: [
    [["Which containment and recall options need review?", "Какие варианты локализации и отзыва проверить?"], ["Compare containment and recall options against the recorded concerns. Keep the chosen response unresolved pending evidence and authority.", "Сравните локализацию и отзыв с зафиксированными опасениями. Не считайте ответ выбранным до проверки материалов и полномочий."]],
    [["Can affected products be traced to source records?", "Можно ли проследить затронутую продукцию до источников?"], ["Inspect traceability, affected-product and safety records. Record missing originals and contradictions before relying on coverage.", "Проверьте прослеживаемость, затронутую продукцию и записи безопасности. Отметьте отсутствующие оригиналы и противоречия до выводов о полноте."]],
    [["What conditions govern the proposed next step?", "Какие условия определяют следующий шаг?"], ["Propose owners, retest evidence and release conditions. A remediation plan does not record completed controls or approval.", "Предложите ответственных, материалы повторной проверки и условия выпуска. План не фиксирует выполненные меры или утверждение."]],
  ],
  us_environmental_desert_water_001: [
    [["Which investigation and resolution routes fit the mandate?", "Какие варианты расследования и разрешения отвечают мандату?"], ["Compare investigation, negotiated resolution and litigation without assuming contamination caused the alleged harm.", "Сравните расследование, переговорное урегулирование и спор, не предполагая причинную связь загрязнения с заявленным вредом."]],
    [["What supports exposure and causation?", "Чем подтверждаются воздействие и причинная связь?"], ["Review sampling, exposure and expert-evidence gaps. Keep suspected contamination distinct from proven causation.", "Проверьте отбор проб, воздействие и пробелы экспертных материалов. Отделите подозрение на загрязнение от доказанной причинной связи."]],
    [["What must be verified before the next commitment?", "Что проверить до следующего обязательства?"], ["Identify preservation steps, proposed owners and procedural questions. Verify jurisdiction, actual dates and authority before acting.", "Определите сохранение материалов, предлагаемых ответственных и процессуальные вопросы. До действий проверьте юрисдикцию, даты и полномочия."]],
  ],
};

/** Explicit fictional editorial scaffold. It adds no external evidence or legal conclusion. */
export function convertedProfessionalBrief(caseId: string, locale: "en" | "ru") {
  const rows = briefs[caseId];
  if (!rows || rows.length !== CASE_REVIEW_QUESTION_IDS.length) throw new Error("Unsupported professional case brief");
  const language = locale === "en" ? 0 : 1;
  return rows.map(([title, detail], index) => ({
    id: CASE_REVIEW_QUESTION_IDS[index], title: title[language],
    detail: detail[language] + (locale === "en" ? "\nFictional review scaffold; no finding, instruction or approval is recorded." : "\nВымышленная структура проверки; вывод, поручение или утверждение не зафиксированы."),
  }));
}
