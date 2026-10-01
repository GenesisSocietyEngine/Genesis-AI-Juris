import { CATEGORY_DEMOS } from "./category-demos";
import { applyCaseType } from "./case-type-registry";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypeReference } from "./case-type-reference";
import { defaultTaxEconomics } from "./tax-economics";
import type { CaseTypeId, StudioDraft, StudioNode, StudioNodeType } from "./types";

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
