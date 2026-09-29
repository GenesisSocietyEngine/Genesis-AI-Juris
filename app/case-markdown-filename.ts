import type { CaseMarkdownStatus } from "./case-markdown";
import type { StudioDraft } from "./types";

const two = (value: number) => String(value).padStart(2, "0");

export function caseMarkdownFilename(draft: Pick<StudioDraft, "caseId" | "version">, status: CaseMarkdownStatus, date = new Date()) {
  const stamp = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}_${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
  const base = safeFilenamePart(`${draft.caseId || "case"}-v${draft.version || "0"}-${status}`) || "case-final";
  return `${base}_${stamp}.md`;
}

export function normalizeCaseMarkdownFilename(value: string, fallback: string) {
  const withoutExtension = value.trim().replace(/\.md$/iu, "");
  const safe = safeFilenamePart(withoutExtension) || fallback.replace(/\.md$/iu, "");
  return `${safe.slice(0, 176)}.md`;
}

function safeFilenamePart(value: string) {
  return value.normalize("NFKD").replace(/[\\/:*?"<>|\u0000-\u001f]+/gu, "_").replace(/\s+/gu, "_").replace(/_+/gu, "_").replace(/^\.+|[. _-]+$/gu, "");
}
