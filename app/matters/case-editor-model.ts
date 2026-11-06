import type { MatterDetail } from "./matter-view-model";

export type CaseFields = { title: string; jurisdictions: string; priority: string; classification: string };
export type CaseEditorState = {
  caseId: string; revision: number; baseline: CaseFields; values: CaseFields;
  phase: "editing" | "saving" | "checking" | "conflict" | "unconfirmed" | "invalid";
  discard: "close" | "latest" | null;
};
export const caseFields = (matter: MatterDetail): CaseFields => ({ title: matter.title, jurisdictions: matter.jurisdictions.join("\n"), priority: matter.priority, classification: matter.classification });
export const newCaseEditor = (matter: MatterDetail): CaseEditorState => {
  const values = caseFields(matter);
  return { caseId: matter.id, revision: matter.revision, baseline: values, values: { ...values }, phase: "editing", discard: null };
};
export const caseEditorDirty = (editor: CaseEditorState | null) => Boolean(editor && Object.keys(editor.values).some(key => editor.values[key as keyof CaseFields] !== editor.baseline[key as keyof CaseFields]));
export const caseEditorPending = (editor: CaseEditorState | null) => Boolean(editor && ["saving", "checking", "unconfirmed"].includes(editor.phase));
const jurisdictions = (text: string) => [...new Set(text.split(/\r?\n/).map(s => s.trim()).filter(Boolean))];
export function caseFieldErrors(values: CaseFields) {
  return {
    title: values.title.trim().length < 2 || values.title.trim().length > 240,
    jurisdictions: jurisdictions(values.jurisdictions).length > 12 || jurisdictions(values.jurisdictions).some(s => s.length > 100),
    priority: !["low", "normal", "high", "urgent"].includes(values.priority),
    classification: !["internal", "confidential", "strictly_confidential"].includes(values.classification),
  };
}
/** Send only edited, supported fields. The edit-start revision never rebases. */
export function caseEditorPatch(editor: CaseEditorState): Record<string, string | string[]> {
  const patch: Record<string, string | string[]> = {};
  for (const key of Object.keys(editor.values) as Array<keyof CaseFields>) {
    const value = key === "jurisdictions" ? jurisdictions(editor.values[key]) : editor.values[key].trim();
    const original = key === "jurisdictions" ? jurisdictions(editor.baseline[key]) : editor.baseline[key].trim();
    if (JSON.stringify(value) !== JSON.stringify(original)) patch[key] = value;
  }
  return patch;
}
export function matchesCasePatch(matter: MatterDetail, patch: Record<string, string | string[]>) {
  return Object.entries(patch).every(([key, value]) => JSON.stringify(matter[key as "title" | "jurisdictions" | "priority" | "classification"]) === JSON.stringify(value));
}
export function refreshCaseEditor(editor: CaseEditorState | null, matter: MatterDetail) {
  if (!editor || editor.caseId !== matter.id || caseEditorPending(editor)) return editor;
  if (!caseEditorDirty(editor)) return newCaseEditor(matter);
  return matter.revision === editor.revision ? editor : { ...editor, phase: "conflict" as const };
}
