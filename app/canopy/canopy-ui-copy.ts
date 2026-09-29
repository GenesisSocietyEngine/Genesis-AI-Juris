import { canopyDeclaration, type CanopyScenarioId } from "../canopy-fixture";
import type { InterfaceLocale } from "../use-interface-locale";

// Presentation translations do not change immutable source bytes, compiled
// scenarios, controls, input values or publication fingerprints.
const russian: Record<CanopyScenarioId, { label: string; recommendation: string; changed: string; why: string }> = {
  base: { label: "Базовый", recommendation: "Разрешить только условный переходный пилот на 90 дней. Производство запрещено до принятия всех зафиксированных условий.", changed: "Подписанный спрос — 300 упаковок в неделю; ввод площадки и персонал пока не подтверждены. Выход продукции 92% и экономика — допущения сценария.", why: "Запрет на производство сохраняется до принятия необходимых доказательств. Экономические допущения не закрывают пробелы в готовности." },
  upside: { label: "Благоприятный", recommendation: "Рекомендовать эксплуатацию в пределах 480 упаковок в неделю при принятых условиях допуска и контролях пересмотра/выхода в течение 90 дней.", changed: "D03 v2 подтверждает подписанный спрос 480 упаковок в неделю; D06 v2 — приёмку площадки и успешный допуск; D08 v2 — подтверждение персонала. Выход 95% остаётся проверяемым допущением.", why: "Принятые доказательства и проверенные допущения соответствуют заявленным критериям. Утверждение меморандума не является разрешением на производство." },
  downside: { label: "Неблагоприятный", recommendation: "Пересогласовать условия и отложить решение с учётом проверенных стрессовых допущений. Производство не разрешено.", changed: "Подписанный спрос в источнике остаётся 480 упаковок в неделю. Допущения стресс-теста: спрос 300, выход 85% (на 10 процентных пунктов ниже), энергия +25%, окупаемость 3,43 года. D03 v2 не изменён.", why: "В отдельной стрессовой копии нарушены критерии выхода и окупаемости. Снижение спроса — допущение, а не новый факт о подписанных обязательствах." },
  hard_stop: { label: "Стоп-условие", recommendation: "Отказ: обязательная проверка прослеживаемости не пройдена. Производство запрещено независимо от привлекательности экономики.", changed: "Изменяется только допуск: успешный → не пройден, согласно новому учебному событию D06 v3. Остальные параметры благоприятного сценария сохраняются.", why: "Правило безопасности D01 блокирует эксплуатацию и пилот. Зафиксирована неудачная проверка; это отличается от отсутствующего сертификата." },
  hard_stop_unavailable: { label: "Допуск недоступен", recommendation: "Отказ: обязательный допуск недоступен. Неудачная проверка не утверждается; производство запрещено.", changed: "В отдельной альтернативе D06 v4 меняется только доступность допуска. Все остальные параметры благоприятного сценария сохранены.", why: "Правило D01 отдельно блокирует отсутствие обязательного допуска. Отсутствие документа не означает, что проверка была провалена." },
};

export function canopyScenarioCopy(id: CanopyScenarioId, locale: InterfaceLocale) {
  return locale === "ru" ? russian[id] : canopyDeclaration(id);
}

const states: Record<string, [string, string]> = {
  owner: ["Owner", "Владелец"], contributor: ["Contributor", "Участник с правом редактирования"], reviewer: ["Reviewer", "Проверяющий"], viewer: ["Viewer", "Наблюдатель"],
  draft: ["Draft", "Черновик"], intake_review: ["Intake review", "Проверка поступивших данных"], active: ["Active", "В работе"],
  internal_review: ["Internal review", "Внутренняя проверка"], client_review: ["Client review", "Проверка клиентом"],
  approved: ["Approved", "Утверждено"], archived: ["Archived", "В архиве"], closed: ["Closed", "Закрыто"],
  accepted: ["Accepted", "Принято"], rejected: ["Rejected", "Отклонено"], pending: ["Pending review", "Ожидает проверки"],
  current: ["Current", "Актуально"], stale: ["Stale", "Устарело"], superseded: ["Superseded", "Заменено новой версией"],
  professional_assertion: ["Proposed assertion", "Предложенное утверждение"], assertion: ["Proposed assertion", "Предложенное утверждение"],
  fact: ["Proposed fact", "Предложенный факт"], authority_rule: ["Proposed rule", "Предложенное правило"], assumption: ["Proposed assumption", "Предложенное допущение"],
  contradiction: ["Proposed contradiction", "Предложенное противоречие"], dated_event: ["Proposed dated event", "Предложенное событие с датой"],
  pdf: ["PDF report", "PDF-отчёт"], pdf_report: ["PDF report", "PDF-отчёт"], json_manifest: ["JSON manifest", "JSON-манифест"],
};
export function canopyStateLabel(value: string, locale: InterfaceLocale) {
  return states[value]?.[locale === "ru" ? 1 : 0] ?? value;
}
