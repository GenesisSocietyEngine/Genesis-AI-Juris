import type { CanonicalReportModel } from "./report-model";
import type { StudioDraft, StudioNode } from "./types";

type Language = "en" | "ru";
const tr = (language: Language, en: string, ru: string) => language === "en" ? en : ru;

/** A labelled extract is an index into the full records, never a new finding. */
function excerpt(value: string, limit: number, language: Language) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit);
  const boundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, boundary > limit / 2 ? boundary : limit)}... ${tr(language, "[extract]", "[фрагмент]")}`;
}

function records(nodes: StudioNode[], maximum: number, language: Language, details = false) {
  const selected = nodes.slice(0, maximum).map((node) => `${excerpt(node.title, 100, language)}${details && node.detail.trim() ? `: ${excerpt(node.detail, 150, language)}` : ""}`);
  if (nodes.length > maximum) selected.push(tr(language, `+ ${nodes.length - maximum} more in the appendix.`, `Ещё ${nodes.length - maximum} в приложении.`));
  return selected.join("\n");
}

/** Receives the already-redacted draft. It cannot select a winning branch or
 * infer verified facts, a simulation result, or a workflow approval. */
export function caseReportBriefRows(draft: StudioDraft, model: CanonicalReportModel, language: Language): Array<[string, string]> {
  const purpose = draft.premisePublication === "author-reviewed"
    ? draft.premise
    : draft.nodes.find((node) => node.type === "trigger")?.detail;
  const inputs = draft.nodes.filter((node) => ["fact", "evidence", "cash_flow"].includes(node.type));
  const decisions = draft.nodes.filter((node) => node.type === "decision");
  const outcomes = draft.nodes.filter((node) => node.type === "outcome");
  const assumptions = [...(draft.dealEconomics?.assumptions ?? []), ...(draft.taxEconomics?.assumptions ? [draft.taxEconomics.assumptions] : [])];
  return [
    [tr(language, "Objective", "Цель"), purpose?.trim()
      ? excerpt(purpose, 300, language)
      : tr(language, "Record an author-reviewed objective or a structured opening step.", "Добавьте проверенную автором цель или начальный шаг схемы.")],
    [tr(language, "Recorded inputs", "Исходные данные"), records(inputs, 2, language, true)
      || tr(language, "No separate fact or evidence record is present. Check the source references in the detailed records.", "Отдельные записи фактов и доказательств отсутствуют. Проверьте ссылки на источники в подробных записях.")],
    [tr(language, "Decision criteria", "Критерии решения"), records(decisions, 9, language)
      || tr(language, "Decision criteria have not been recorded.", "Критерии решения не записаны.")],
    [tr(language, "Possible outcomes", "Возможные решения"), records(outcomes, 6, language)
      || tr(language, "No outcome has been modelled.", "Возможные решения ещё не заданы.")],
    [tr(language, "Conclusion and basis", "Вывод и обоснование"), tr(language,
      "This PDF describes the case model. It does not establish a selected outcome or prove that a run was completed. Check each branch's full conditions in the appendix before recommending an outcome.",
      "PDF описывает модель кейса. Он не устанавливает выбранное решение и не подтверждает завершённый запуск. Перед рекомендацией проверьте полные условия соответствующей ветви в приложении.")],
    [tr(language, "Assumptions", "Допущения"), assumptions.length
      ? assumptions.slice(0, 2).map((item) => excerpt(item, 160, language)).join("\n") + (assumptions.length > 2 ? tr(language, "\nFurther assumptions are in the economics appendix.", "\nОстальные допущения - в экономическом приложении.") : "")
      : tr(language, "Assumptions are not recorded separately. Review conditions and uncertainties in the detailed records.", "Допущения не выделены в отдельный реестр. Проверьте условия и неопределённости в подробных записях.")],
    [tr(language, "Sources and limits", "Источники и ограничения"), tr(language,
      `${model.governance.citations.length} public HTTPS source(s); ${model.governance.evidencePack.documents.length} evidence record(s). Individual fact-verification status is not recorded in this Studio model. Source references within records also require checking.`,
      `Публичных HTTPS-источников: ${model.governance.citations.length}; записей доказательств: ${model.governance.evidencePack.documents.length}. Статус проверки отдельных фактов в модели Studio не записан. Ссылки внутри записей тоже требуют проверки.`)],
    [tr(language, "Next actions", "Следующие действия"), tr(language,
      "Verify inputs and assumptions against sources; run the relevant scenarios; document the chosen outcome and its conditions; obtain independent approval through the case workflow.",
      "Сверьте данные и допущения с источниками; выполните нужные сценарии; зафиксируйте выбранное решение и его условия; получите независимое утверждение в рабочем процессе дела.")],
  ];
}
