import { sentenceLabel, type ApiIssue, type SourceAnchorItem } from "./matter-view-model";

// Interface copy only. Authored statements, quotations, notes and provider receipts
// must never pass through this dictionary or be rewritten when the locale changes.
export const evidenceRussian: Record<string, string> = {
  "Professional assertions": "Утверждения специалиста",
  " records": " записей",
  "No assertions recorded": "Утверждения ещё не записаны",
  "AI output is not silently promoted into the professional record.": "Результат ИИ становится записью специалиста только после явного утверждения.",
  "AI proposal queue": "Предложения ИИ на проверку",
  " pending": " ожидают проверки",
  "AI-PROPOSED · NOT AUTHORITATIVE": "ПРЕДЛОЖЕНО ИИ · НЕ УТВЕРЖДЕНО СПЕЦИАЛИСТОМ",
  "Confidence is not evidence. Acceptance is explicit, attributable, and unavailable without an inspectable source anchor.": "Уверенность модели не является доказательством. Утверждение требует явного решения проверяющего и доступной точной ссылки на источник.",
  "No AI proposals": "Предложений ИИ пока нет",
  "Manual document and evidence work remains available if AI is unavailable.": "Если ИИ недоступен, работа с документами и доказательствами вручную остаётся доступной.",
  "Client review is bounded to 500 proposal records. Use a refined server query to continue.": "Показано не более 500 предложений. Для продолжения уточните запрос к серверу.",
  "Loading proposals…": "Загрузка предложений…",
  "Load next proposal page": "Загрузить следующие предложения",
  "Open exact citation review →": "Открыть проверку точной ссылки →",
  "Source anchor register": "Реестр точных ссылок на источники",
  " exact citations": " точных ссылок",
  "No source anchors returned": "Ссылки на источники не получены",
  "Evidence cannot be presented as source-grounded without an exact anchor.": "Доказательство нельзя считать основанным на источнике без точной ссылки.",
  "Source citation: ": "Ссылка на источник: ",
  "Generate source-grounded AI proposals": "Подготовить предложения ИИ по источникам",
  "Explicit review only": "Только после проверки специалистом",
  "Selected bounded source ranges may be sent to the configured provider. Uploaded text is treated as untrusted evidence, never as instruction.": "Выбранные ограниченные фрагменты источников могут быть переданы настроенному провайдеру. Загруженный текст рассматривается как непроверенный материал, а не как инструкция.",
  "Your participant role may inspect proposals but cannot start an AI job.": "Ваша роль позволяет просматривать предложения, но не запускать обработку ИИ.",
  "No extraction-ready current source": "Нет текущих версий с извлечённым текстом",
  "Upload a supported text document and wait for its exact current version to reach ready extraction.": "Загрузите поддерживаемый текстовый документ и дождитесь завершения извлечения текста его текущей версии.",
  "Extraction-ready current versions": "Текущие версии с извлечённым текстом",
  " · version ": " · версия ",
  "I confirm these sources are synthetic or de-identified and understand the bounded provider disclosure.": "Подтверждаю, что источники синтетические или обезличены; понимаю, какие ограниченные фрагменты будут переданы провайдеру.",
  "Retry an identical failed job when its bounded retry policy permits.": "Повторить идентичное неудачное задание, если это допускают ограничения повторных попыток.",
  "Human-review boundary": "Обязательная проверка специалистом",
  "Every candidate must retain an inspectable exact source anchor. Zero grounded candidates is a valid terminal result; provider failure never blocks manual work.": "Каждое предложение должно сохранять доступную точную ссылку на источник. Отсутствие обоснованных предложений — допустимый результат; сбой провайдера не блокирует ручную работу.",
  "Analyzing bounded sources…": "Анализ фрагментов источников…",
  "Generate proposals for review": "Подготовить предложения для проверки",
  "Your participant role may inspect evidence but cannot add professional material. Ask the case owner for contributor access to add a replacement source.": "Ваша роль позволяет просматривать доказательства, но не добавлять материалы. Для добавления нового источника запросите права участника у владельца дела.",
  "Manual exact-source evidence": "Добавить доказательство с точной ссылкой",
  "Human authored": "Ввод специалистом",
  "A document version is required": "Требуется версия документа",
  "Upload a source before creating an exact manual anchor.": "Сначала загрузите источник, затем создайте точную ссылку вручную.",
  "Exact immutable source version": "Точная неизменяемая версия источника",
  "Choose a source version": "Выберите версию источника",
  "Paragraph or clause locator": "Абзац или пункт",
  "e.g. clause 12.4 or paragraph 27": "например, пункт 12.4 или абзац 27",
  "Bounded source excerpt (optional)": "Краткая цитата из источника (необязательно)",
  "Recording anchor…": "Сохранение ссылки…",
  "Create source anchor for review": "Добавить ссылку для проверки",
  "Create a professional assertion": "Добавить утверждение специалиста",
  "Accepted source anchor": "Утверждённая ссылка на источник",
  "Assertion type": "Тип утверждения",
  "Fact": "Факт", "Evidence": "Доказательство", "Rule": "Норма", "Assumption": "Предположение", "Date": "Дата", "Contradiction": "Противоречие",
  "Professional statement": "Формулировка специалиста",
  "Recording assertion…": "Сохранение утверждения…",
  "Create assertion for review": "Добавить утверждение для проверки",
  "Link reviewed evidence to a graph": "Связать проверенное доказательство с картой",
  "Exact package entity": "Конкретный элемент пакета",
  "Accepted evidence and a current package are required": "Требуются утверждённое доказательство и актуальный пакет",
  "Review a source anchor and link an exact decision package before creating a graph relationship.": "Проверьте ссылку на источник и подключите точную версию пакета решений перед созданием связи с картой.",
  "Current decision package": "Актуальный пакет решений",
  "Related accepted assertion (optional)": "Связанное утверждённое утверждение (необязательно)",
  "No assertion binding": "Без связи с утверждением",
  "Graph target": "Элемент карты", "Graph node": "Узел карты", "Graph edge": "Связь карты",
  "Exact graph entity ID": "Точный идентификатор элемента карты",
  "Relationship": "Тип связи", "Supports": "Подтверждает", "Contradicts": "Противоречит", "Qualifies": "Уточняет", "Supersedes": "Заменяет", "Source for": "Источник для",
  "Professional meaning": "Обоснование связи специалистом",
  "Linking evidence…": "Создание связи…", "Link evidence to graph entity": "Связать доказательство с элементом карты",
  "PROFESSIONAL RECORD": "ЗАПИСЬ СПЕЦИАЛИСТА",
  "No source anchor recorded": "Ссылка на источник не записана",
  "Open source citation ": "Открыть ссылку на источник ",
  "Source citation unavailable": "Ссылка на источник недоступна",
  "Recording…": "Сохранение…", "Accept assertion": "Утвердить утверждение", "Reject assertion": "Отклонить утверждение",
  "Correct or supersede this assertion": "Исправить или заменить утверждение",
  "Superseding retires this assertion while preserving its history. It does not prove that a contradiction is resolved or create replacement evidence.": "Замена выводит утверждение из текущего использования, сохраняя историю. Это не устраняет противоречие и не создаёт новое доказательство автоматически.",
  "Retire this accepted assertion as superseded? Its evidence and review history will be preserved; create a reviewed replacement separately.": "Отметить утверждение как заменённое? Доказательства и история проверки сохранятся. Новое утверждение необходимо создать и проверить отдельно.",
  "Mark assertion as superseded": "Отметить как заменённое", "Create replacement evidence →": "Добавить новое доказательство →",
  "Assertion ": "Утверждение ", " · reviewed by ": " · проверил ", " at ": " · дата ", "not returned": "не получено",
  "AI proposal: ": "Предложение ИИ: ", "AI-PROPOSED · ": "ПРЕДЛОЖЕНО ИИ · ", "Model confidence: ": "Уверенность модели: ",
  "Inspectable sources": "Источники для проверки",
  "No usable source anchor was returned. Acceptance controls are disabled.": "Доступная ссылка на источник не получена. Утверждение недоступно.",
  "Inspect AI proposal source ": "Проверить источник предложения ИИ ",
  "Destination": "Результирующая запись", "Provenance": "Происхождение", "Review note": "Примечание проверяющего",
  "Proposed destination not yet accepted": "Результирующая запись ещё не утверждена", "Model receipt not returned": "Сведения о модели не получены",
  "Attributable review note (optional)": "Примечание к вашему решению (необязательно)",
  "Edit proposed value before acceptance": "Изменить предложение перед утверждением",
  "Recording review…": "Сохранение решения…", "Accept edited value": "Утвердить изменения", "Accept with sources": "Утвердить с источниками", "Cancel edit": "Отменить редактирование", "Edit and accept": "Изменить и утвердить", "Reject proposal": "Отклонить предложение",
  "Your participant role may inspect this proposal but cannot accept or reject it.": "Ваша роль позволяет просматривать предложение, но не утверждать и не отклонять его.",
  "Proposal ": "Предложение ", " · sources ": " · источники ", "none": "нет",
  "Version ": "Версия ", "Page ": "Страница ", "Document-level anchor": "Ссылка на документ", " · paragraph ": " · абзац ",
  "Review: ": "Проверка: ", "; Retired from current use": "; выведено из текущего использования", "; Older file version": "; предыдущая версия файла",
  "Retired from current use · acceptance history preserved": "Выведено из текущего использования · история утверждения сохранена",
  "A newer source version exists": "Есть новая версия источника",
  "This citation refers to an older source. Review its retirement, then review every dependent assertion against current evidence.": "Эта ссылка относится к предыдущей версии. Рассмотрите её вывод из использования и проверьте каждое связанное утверждение по актуальным доказательствам.",
  "Add a current-source citation →": "Добавить ссылку на актуальный источник →", "Review citation retirement →": "Рассмотреть вывод ссылки из использования →",
  "Accept anchor": "Утвердить ссылку", "Reject anchor": "Отклонить ссылку", "Anchor ID": "Идентификатор ссылки", "Version ID": "Идентификатор версии", "Checksum": "Контрольная сумма",
  "No activity returned": "Записи журнала не получены", "The server has not returned an attributable audit event for this matter.": "Сервер не вернул записи журнала действий по этому делу.",
  "Open reviewed record →": "Открыть проверенную запись →", "Actor: ": "Участник: ", "Role not returned": "Роль не получена", "Event ID": "Идентификатор события", "Object": "Объект", "Digest": "Контрольный хеш", "Bounded detail": "Краткие технические сведения",
  "Client activity is bounded to 500 events. Use a refined server query for older history.": "Показано не более 500 событий. Для более ранних записей уточните запрос к серверу.",
  "Loading history…": "Загрузка истории…", "Load older activity": "Загрузить более ранние события",
  "Read-only for this action": "Доступен только просмотр",
  "Original proposal data": "Исходные данные предложения",
  "AI proposal review recorded. The historical proposal remains attributable.": "Решение по предложению ИИ записано. История предложения и авторство решения сохранены.",
  "Exact manual source anchor recorded for review.": "Точная ссылка на источник записана для проверки.",
  "Source-anchor review decision recorded.": "Решение по ссылке на источник записано.",
  "Professional assertion recorded for review.": "Утверждение специалиста записано для проверки.",
  "Assertion superseded with history preserved. Review or create its replacement before relying on the decision.": "Утверждение отмечено как заменённое; история сохранена. Создайте или проверьте замену, прежде чем использовать решение.",
  "Professional assertion review decision recorded.": "Решение по утверждению специалиста записано.",
  "Reviewed evidence linked to the exact graph entity.": "Проверенное доказательство связано с конкретным элементом карты.",
  "ACCESS STATE": "СОСТОЯНИЕ ДОСТУПА", "STALE REVISION": "ВЕРСИЯ УСТАРЕЛА", "PILOT LIMIT": "ОГРАНИЧЕНИЕ ПИЛОТНОЙ ВЕРСИИ", "REQUEST ERROR": "ОШИБКА ЗАПРОСА",
  "Technical detail": "Технические сведения", "Reload current revision": "Загрузить актуальную версию", "Try again": "Повторить", "Open account access": "Открыть настройки доступа",
  "Sign-in required": "Требуется вход", "Matter unavailable": "Дело недоступно", "No permission for this matter": "Нет доступа к этому делу",
  "Use a trusted account before opening private matter records.": "Войдите в доверенную учётную запись, чтобы открыть конфиденциальные записи дела.",
  "The matter is unavailable to this account or no longer exists. No private metadata was disclosed.": "Дело недоступно этой учётной записи или больше не существует. Конфиденциальные сведения не раскрыты.",
  "Your current participant role does not permit this operation.": "Ваша текущая роль в деле не позволяет выполнить это действие.",
  "This matter changed elsewhere": "Дело изменено в другом сеансе",
  "No write was retried. Reload the current revision, review the differences, and submit the action again.": "Запись не повторялась. Загрузите актуальную версию, проверьте изменения и отправьте действие снова.",
  "Unavailable in the current pilot boundary": "Недоступно в текущей пилотной версии",
  "The record remains usable, but this operation is not supported by the current deployment.": "Запись остаётся доступной, но это действие не поддерживается текущей версией приложения.",
  "The workspace could not complete that request": "Не удалось выполнить запрос",
  "The server returned an unexpected response. No client-side change was treated as saved.": "Сервер вернул неожиданный ответ. Изменения в интерфейсе не считаются сохранёнными.",
  "Change saved. Updating case actions…": "Изменение сохранено. Обновление действий по делу…",
  "Change saved. Update case actions to confirm current readiness.": "Изменение сохранено. Обновите действия по делу, чтобы проверить его текущее состояние.",
};

export function evidenceText(text: string, locale: "en" | "ru"): string {
  return locale === "ru" ? evidenceRussian[text] ?? text : text;
}

export function evidenceIssue(issue: ApiIssue, locale: "en" | "ru"): ApiIssue {
  if (locale !== "ru") return issue;
  const knownMessage = evidenceRussian[issue.message];
  return {
    ...issue,
    title: evidenceText(issue.title, locale),
    message: knownMessage ?? "Не удалось выполнить действие. Проверьте технические сведения; автоматическая повторная отправка не выполнялась.",
    detail: knownMessage ? issue.detail : [issue.message, issue.detail].filter(Boolean).join("\n\n"),
  };
}

// Resolve controller results on render: switching locale never repeats a write.
export function evidenceNotice(message: string, locale: "en" | "ru"): string {
  if (locale !== "ru") return message;
  if (evidenceRussian[message]) return evidenceRussian[message];
  if (message === "An identical AI proposal job is already processing. Manual evidence work remains available.") return "Идентичное задание ИИ уже выполняется. Ручная работа с доказательствами остаётся доступной.";
  const match = /^(AI analysis completed with no grounded candidates; nothing became authoritative\.|AI analysis created (\d+) grounded proposal\(s\) for explicit review\.)(?: (\d+) bounded source range\(s\), (\d+) characters total, were analyzed\.(?: (\d+) source\(s\) exceeded the disclosed context bound\.)?)?$/.exec(message);
  if (!match) return message;
  return (match[2] ? `Подготовлены предложения ИИ для явной проверки: ${match[2]}.` : "Анализ ИИ завершён без обоснованных предложений; ни одна запись не была утверждена.")
    + (match[3] ? ` Проанализировано фрагментов: ${match[3]}; всего символов: ${match[4]}.` : "")
    + (match[5] ? ` Источников, превысивших указанный предел контекста: ${match[5]}.` : "");
}

const labels: Record<string, string> = {
  professional_assertion_created: "Утверждение специалиста создано", professional_assertion_accepted: "Утверждение специалиста утверждено", professional_assertion_rejected: "Утверждение специалиста отклонено", professional_assertion_superseded: "Утверждение специалиста заменено",
  dossier_status_transitioned: "Статус дела изменён", decision_package_linked: "Пакет решений подключён", decision_package_superseded: "Пакет решений заменён", graph_proposal_diff_accepted: "Изменения карты утверждены", output_marked_stale: "Результат отмечен как устаревший", ai_proposal_sources_updated: "Источники предложения ИИ обновлены", evidence_link_changed: "Связь доказательства изменена", information_request_created: "Запрос сведений создан", information_request_status_changed: "Статус запроса сведений изменён", information_request_changed: "Запрос сведений изменён", dossier_ai_proposal_generation: "Подготовка предложений ИИ",
  accepted: "Утверждено", rejected: "Отклонено", pending: "Ожидает проверки", needs_review: "Требуется проверка", superseded: "Заменено", retired: "Выведено из использования",
  fact: "Факт", evidence: "Доказательство", rule: "Норма", assumption: "Предположение", date: "Дата", contradiction: "Противоречие", deadline: "Срок", assertion: "Утверждение", professional_assertion: "Утверждение специалиста",
  high: "Высокая", medium: "Средняя", low: "Низкая", owner: "Владелец", contributor: "Участник", reviewer: "Проверяющий", viewer: "Наблюдатель", client: "Клиент", admin: "Администратор",
  proposal_reviewed: "Проверка предложения", source_anchor_reviewed: "Проверка ссылки на источник", proposal_generation_completed: "Подготовка предложений завершена",
  ai_proposal_accepted: "Предложение ИИ утверждено", ai_proposal_rejected: "Предложение ИИ отклонено", ai_proposal_edited_and_accepted: "Предложение ИИ изменено и утверждено", ai_proposal_created: "Предложение ИИ создано", ai_proposal_generation_ready: "Предложения ИИ готовы", ai_proposal_generation_failed: "Не удалось подготовить предложения ИИ", ai_proposal_generation_started: "Подготовка предложений ИИ начата",
  source_anchor_created: "Ссылка на источник создана", source_anchor_accepted: "Ссылка на источник утверждена", source_anchor_rejected: "Ссылка на источник отклонена", source_anchor_retired: "Ссылка выведена из использования",
  document_created: "Документ создан", document_version_created: "Версия документа создана", document_accepted_source: "Документ утверждён как источник", document_rejected: "Документ отклонён", dossier_created: "Дело создано", dossier_updated: "Дело обновлено",
  assertion_created: "Утверждение создано", assertion_accepted: "Утверждение утверждено", assertion_rejected: "Утверждение отклонено", assertion_superseded: "Утверждение заменено", assertion_reviewed: "Проверка утверждения", evidence_link_created: "Связь доказательства создана", historical_deadline_disposed: "Решение по прежнему сроку записано",
};

export function evidenceLabel(code: string, locale: "en" | "ru"): string {
  return locale === "ru" ? labels[code.toLowerCase()] ?? sentenceLabel(code) : sentenceLabel(code);
}

export function evidenceCount(kind: "records" | "pending" | "citations", count: number, locale: "en" | "ru"): string {
  if (locale === "en") return count + " " + ({ records: "records", pending: "pending", citations: "exact citations" }[kind]);
  const plural = new Intl.PluralRules("ru").select(count);
  const words = kind === "records" ? ["запись", "записи", "записей"] : kind === "pending" ? ["ожидает проверки", "ожидают проверки", "ожидают проверки"] : ["точная ссылка", "точные ссылки", "точных ссылок"];
  return count + " " + words[plural === "one" ? 0 : plural === "few" ? 1 : 2];
}

export function evidenceCitationLabel(anchor: SourceAnchorItem | undefined, fallbackId: string, locale: "en" | "ru" = "en"): string {
  if (!anchor) return (locale === "ru" ? "Ссылка на источник " : "Source anchor ") + fallbackId;
  const ru = locale === "ru";
  const location = anchor.pageNumber ? (ru ? "страница " : "page ") + anchor.pageNumber : anchor.heading ?? anchor.section ?? (ru ? "ссылка на документ" : "document anchor");
  return anchor.documentTitle + ", " + (anchor.versionOrdinal ? (ru ? "версия " : "version ") + anchor.versionOrdinal : ru ? "версия не получена" : "version not returned") + ", " + location + (anchor.paragraph ? (ru ? ", абзац " : ", paragraph ") + anchor.paragraph : "");
}

/** Readable presentation only; never used to construct review payloads. */
export function proposalStatement(raw: string): string | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if ((record.schema_version === undefined || record.schema_version === 1) && typeof record.statement === "string" && record.statement.trim()) return record.statement;
    }
    return null;
  } catch { return null; }
}
