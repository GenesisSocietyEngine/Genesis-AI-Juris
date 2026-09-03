type ReportLocale = "en" | "ru";

const LAYOUT_ERROR_CODES = new Set([
  "FONT_METRICS_INVALID",
  "INPUT_INVALID",
  "NODE_EXCEEDS_PRINTABLE_FRAME",
  "REFERENCE_MISMATCH",
]);

type LayoutErrorShape = {
  code: string;
  context: Record<string, unknown>;
};

function localized(locale: ReportLocale, en: string, ru: string) {
  return locale === "en" ? en : ru;
}

function safeLayoutError(value: unknown): LayoutErrorShape | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { name?: unknown; code?: unknown; context?: unknown };
  if (candidate.name !== "ReportGraphLayoutError" || typeof candidate.code !== "string" || !LAYOUT_ERROR_CODES.has(candidate.code)) return null;
  if (!candidate.context || typeof candidate.context !== "object" || Array.isArray(candidate.context)) return { code: candidate.code, context: {} };
  return { code: candidate.code, context: candidate.context as Record<string, unknown> };
}

function safeNodeId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : null;
}

function millimetres(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? (value / 1_000).toFixed(1)
    : null;
}

function safeCodePoint(value: unknown) {
  return typeof value === "string" && /^U\+[0-9A-F]{4,6}$/.test(value) ? value : null;
}

export function reportGenerationErrorMessage(error: unknown, locale: ReportLocale) {
  const layoutError = safeLayoutError(error);
  if (!layoutError) {
    return localized(
      locale,
      "The report could not be created. Review the case data and try again.",
      "Не удалось сформировать отчёт. Проверьте данные кейса и повторите попытку.",
    );
  }

  if (layoutError.code === "REFERENCE_MISMATCH") {
    return localized(
      locale,
      "The case changed while the report was being prepared. Save the current case version, reopen the report dialog, and generate it again.",
      "Кейс изменился во время подготовки отчёта. Сохраните текущую версию кейса, снова откройте окно отчёта и повторите формирование.",
    );
  }
  if (layoutError.code === "FONT_METRICS_INVALID") {
    return localized(
      locale,
      "The required report-font metrics are missing or incompatible. Reload the updated application before generating this report.",
      "Требуемые метрики шрифта отчёта отсутствуют или несовместимы. Перезагрузите обновлённое приложение перед формированием отчёта.",
    );
  }
  if (layoutError.code === "INPUT_INVALID") {
    const codePoint = safeCodePoint(layoutError.context.codePoint);
    if (layoutError.context.reason === "FONT_UNSUPPORTED") {
      const scalar = codePoint ? ` (${codePoint})` : "";
      return localized(
        locale,
        `The report contains a character that the governed PDF font cannot render${scalar}. Replace that character and try again.`,
        `Отчёт содержит символ, который не поддерживается утверждённым PDF-шрифтом${scalar}. Замените этот символ и повторите попытку.`,
      );
    }
    if (layoutError.context.reason === "XML_INVALID") {
      const scalar = codePoint ? ` (${codePoint})` : "";
      return localized(
        locale,
        `The report contains a control or noncharacter forbidden by the PDF renderer${scalar}. Remove it and try again.`,
        `Отчёт содержит управляющий или недопустимый символ, запрещённый PDF-рендерером${scalar}. Удалите его и повторите попытку.`,
      );
    }
    return localized(
      locale,
      "The report graph failed validation. Check its relationships and remove unsupported control characters, then try again.",
      "Граф отчёта не прошёл проверку. Проверьте связи и удалите неподдерживаемые управляющие символы, затем повторите попытку.",
    );
  }

  const nodeId = safeNodeId(layoutError.context.nodeId);
  const requiredHeight = millimetres(layoutError.context.requiredHeight);
  const availableHeight = millimetres(layoutError.context.availableHeight);
  const requiredWidth = millimetres(layoutError.context.requiredWidth);
  const availableWidth = millimetres(layoutError.context.availableWidth);
  const node = nodeId ? localized(locale, ` Node: ${nodeId}.`, ` Узел: ${nodeId}.`) : "";
  const dimensions = requiredHeight && availableHeight
    ? localized(locale, ` Required height: ${requiredHeight} mm; available: ${availableHeight} mm.`, ` Требуемая высота: ${requiredHeight} мм; доступно: ${availableHeight} мм.`)
    : requiredWidth && availableWidth
      ? localized(locale, ` Required width: ${requiredWidth} mm; available: ${availableWidth} mm.`, ` Требуемая ширина: ${requiredWidth} мм; доступно: ${availableWidth} мм.`)
      : "";
  return localized(
    locale,
    `Part of the report graph cannot fit inside the printable A4 frame.${node}${dimensions} Shorten the exceptionally long title, detail, or label and try again.`,
    `Часть графа отчёта не помещается в печатную область A4.${node}${dimensions} Сократите слишком длинный заголовок, описание или метку и повторите попытку.`,
  );
}
