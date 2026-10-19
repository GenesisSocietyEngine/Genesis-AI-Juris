import type { SavedStudioCase } from "./studio-case-catalogue";

export type StudioCaseSort = "updated" | "oldest" | "title";

/** Search/sort only the authorized loaded page set. Never mutate server order or data. */
export function selectStudioCases(cases: readonly SavedStudioCase[], search: string, sort: StudioCaseSort, locale: "en" | "ru") {
  const query = search.trim().toLocaleLowerCase(locale);
  const timestamp = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  return cases.filter(item => [item.title, item.caseId, String(item.id), item.ownerDisplayName].some(value => value.toLocaleLowerCase(locale).includes(query))).sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, locale) || a.id - b.id;
    const left = timestamp(a.updatedAt), right = timestamp(b.updatedAt);
    if (left === null || right === null) return left === right ? a.id - b.id : left === null ? 1 : -1;
    return (sort === "oldest" ? left - right : right - left) || b.id - a.id;
  });
}

/** Fixed UTC avoids server/browser timezone drift; the exact stored value stays in <time>. */
export function studioUpdatedLabel(value: string, locale: "en" | "ru") {
  if (!Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hourCycle: "h23" }).format(new Date(value));
}
