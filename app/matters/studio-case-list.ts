import type { SavedStudioCase } from "./studio-case-catalogue";

export type StudioCaseSort = "updated" | "oldest" | "title";

/** SQLite CURRENT_TIMESTAMP is UTC, even when the browser uses another zone. */
export function studioUpdatedTimestamp(value: string): number | null {
  const legacy = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  const parsed = Date.parse(legacy ? `${value.replace(" ", "T")}Z` : value);
  if (!Number.isFinite(parsed)) return null;
  // Do not silently roll an impossible legacy calendar date into another day.
  if (legacy && new Date(parsed).toISOString().slice(0, 19).replace("T", " ") !== value) return null;
  return parsed;
}

/** Search/sort only the authorized loaded page set. Never mutate server order or data. */
export function selectStudioCases(cases: readonly SavedStudioCase[], search: string, sort: StudioCaseSort, locale: "en" | "ru") {
  const query = search.trim().toLocaleLowerCase(locale);
  return cases.filter(item => [item.title, item.caseId, String(item.id), item.ownerDisplayName].some(value => value.toLocaleLowerCase(locale).includes(query))).sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, locale) || a.id - b.id;
    const left = studioUpdatedTimestamp(a.updatedAt), right = studioUpdatedTimestamp(b.updatedAt);
    if (left === null || right === null) return left === right ? a.id - b.id : left === null ? 1 : -1;
    return (sort === "oldest" ? left - right : right - left) || b.id - a.id;
  });
}

/** Fixed UTC avoids server/browser timezone drift; callers retain the raw value in title. */
export function studioUpdatedLabel(value: string, locale: "en" | "ru") {
  const timestamp = studioUpdatedTimestamp(value);
  if (timestamp === null) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hourCycle: "h23" }).format(new Date(timestamp));
}
