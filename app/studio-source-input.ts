import { sanitizeReportSourceUrls } from "./report-source-url";

export const parseStudioSources = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

// Suggest HTTPS only for a plain DNS address. Never rewrite an explicit scheme,
// credentials, relative path or prose, and never change stored data on read.
export function suggestStudioHttps(source: string): string | null {
  const value = source.trim();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s\\]*)?$/i.test(value)) return null;
  const result = sanitizeReportSourceUrls([`https://${value}`]);
  return result.rejectedCount === 0 ? result.urls[0] ?? null : null;
}

export function studioSourceFeedback(sources: string[], locale: "en" | "ru") {
  const result = sanitizeReportSourceUrls(sources);
  const en = locale === "en";
  return {
    valid: result.urls.length > 0 && result.rejectedCount === 0,
    message: !sources.length
      ? (en ? "Add at least one HTTPS source, for example https://www.nbb.be/." : "Добавьте хотя бы один HTTPS-источник, например https://www.nbb.be/.")
      : result.rejectedCount
        ? (en ? `${result.rejectedCount} source link(s) need correction. Use complete https:// addresses without embedded credentials; maximum 30 sources, 2,048 characters each.` : `Требуют исправления: ${result.rejectedCount}. Используйте полные адреса https:// без логина и пароля; максимум 30 источников по 2048 символов.`)
        : (en ? "HTTPS source format accepted. Source authority and relevance still require review." : "Формат HTTPS принят. Авторитетность и применимость источников требуют проверки."),
  };
}
