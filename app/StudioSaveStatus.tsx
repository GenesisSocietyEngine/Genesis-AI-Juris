"use client";

export type StudioSaveState = "idle" | "saving" | "saved" | "submitted" | "conflict" | "auth_required" | "error";

/** A receipt confirms draft content, never an unsent prompt or unadded working item. */
export default function StudioSaveStatus({ state, locale, hasSavedCase, savedAt, promptPending, itemsPending, onReview, hasDeviceCopy = false, restoring = false, readOnly = false, requirement = "" }: {
  state: StudioSaveState; locale: "en" | "ru"; hasSavedCase: boolean; savedAt: string | null;
  promptPending: boolean; itemsPending: boolean; onReview: () => void; hasDeviceCopy?: boolean; restoring?: boolean; readOnly?: boolean; requirement?: string;
}) {
  const en = locale === "en", saved = !restoring && (state === "saved" || state === "submitted"), inputPending = promptPending || itemsPending;
  const label = restoring ? (en ? "Opening Studio draft…" : "Открывается черновик Студии…")
    : state === "saving" ? (en ? "Saving draft…" : "Сохранение черновика…")
    : state === "conflict" ? (en ? "Save conflict — edits remain open" : "Конфликт сохранения — правки открыты")
    : state === "error" ? (en ? "Save not confirmed" : "Сохранение не подтверждено")
    : state === "auth_required" ? (en ? "Sign in to save" : "Войдите для сохранения")
    : readOnly ? (en ? "Read-only Studio draft" : "Черновик Студии только для просмотра")
    : saved ? (en ? "Studio draft saved" : "Черновик Студии сохранён")
    : hasSavedCase ? (en ? "Unsaved draft changes" : "Несохранённые изменения черновика")
    : hasDeviceCopy ? (en ? "Device copy only · not saved to workspace" : "Копия на устройстве · в рабочем пространстве не сохранено")
    : (en ? "Studio draft not saved yet" : "Черновик Студии ещё не сохранён");
  return <div id="studio-save-status" data-state={saved && inputPending ? "partial" : state} className="studio-save-status" role="status">
    <p><strong>{label}</strong>{saved && savedAt && <> · <time dateTime={savedAt}>{new Date(savedAt).toLocaleString(en ? "en-GB" : "ru-RU")}</time></>}
      {state === "submitted" && <span> · {en ? "Submitted for review" : "Отправлено на проверку"}</span>}</p>
    <p>{en ? "Workspace save location: " : "Сохранение в рабочем пространстве: "}<a href={"/matters?collection=personal&lang=" + locale} target="_blank" rel="noopener noreferrer">{en ? "Cases → Personal · Saved Studio drafts" : "Дела → Личные · Сохранённые черновики Студии"}<span className="visually-hidden">{en ? " (opens in a new tab)" : " (откроется в новой вкладке)"}</span></a></p>
    {!restoring && !readOnly && requirement && <p>{requirement}</p>}
    {inputPending && <p className="studio-unsaved-input"><strong>{promptPending && itemsPending ? (en ? "Prompt and working items are not saved." : "Промпт и рабочие элементы не сохранены.") : promptPending ? (en ? "AI prompt is not saved." : "AI-промпт не сохранён.") : (en ? "Working items are not saved." : "Рабочие элементы не сохранены.")}</strong> {en ? "Unsent prompts and unadded items stay only in this tab." : "Неотправленный промпт и недобавленные элементы остаются только в этой вкладке."} <button type="button" onClick={onReview}>{en ? "Review unsaved input" : "Проверить несохранённый ввод"}</button></p>}
  </div>;
}
