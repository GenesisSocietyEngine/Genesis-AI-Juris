"use client";

export type StudioSaveState = "idle" | "saving" | "saved" | "submitted" | "conflict" | "auth_required" | "error";

/** A receipt confirms case content, never an unsent prompt or unadded working item. */
export default function StudioSaveStatus({ state, locale, hasSavedCase, savedAt, promptPending, itemsPending, onReview }: {
  state: StudioSaveState; locale: "en" | "ru"; hasSavedCase: boolean; savedAt: string | null;
  promptPending: boolean; itemsPending: boolean; onReview: () => void;
}) {
  const en = locale === "en", saved = state === "saved" || state === "submitted", inputPending = promptPending || itemsPending;
  const label = state === "saving" ? (en ? "Saving case…" : "Сохранение кейса…")
    : state === "conflict" ? (en ? "Save conflict — edits remain open" : "Конфликт сохранения — правки открыты")
    : state === "error" ? (en ? "Save not confirmed" : "Сохранение не подтверждено")
    : state === "auth_required" ? (en ? "Sign in to save" : "Войдите для сохранения")
    : saved ? (en ? "Case saved to workspace" : "Кейс сохранён в рабочем пространстве")
    : hasSavedCase ? (en ? "Unsaved case changes" : "Несохранённые изменения кейса")
    : (en ? "Case not saved yet" : "Кейс ещё не сохранён");
  return <div id="studio-save-status" data-state={saved && inputPending ? "partial" : state} className="studio-save-status" role="status">
    <p><strong>{label}</strong>{saved && savedAt && <> · <time dateTime={savedAt}>{new Date(savedAt).toLocaleString(en ? "en-GB" : "ru-RU")}</time></>}
      {state === "submitted" && <span> · {en ? "Submitted for review" : "Отправлено на проверку"}</span>}</p>
    {inputPending ? <p className="studio-unsaved-input"><strong>{promptPending && itemsPending ? (en ? "Prompt and working items are not saved." : "Промпт и рабочие элементы не сохранены.") : promptPending ? (en ? "AI prompt is not saved." : "AI-промпт не сохранён.") : (en ? "Working items are not saved." : "Рабочие элементы не сохранены.")}</strong> {en ? "Save keeps the case content. Unsent prompts and unadded items stay only in this tab." : "Сохранение сохраняет содержимое кейса. Неотправленный промпт и недобавленные элементы остаются только в этой вкладке."} <button type="button" onClick={onReview}>{en ? "Review unsaved input" : "Проверить несохранённый ввод"}</button></p>
      : <p>{saved ? (en ? "Reopen this version from Saved Studio drafts. Further edits need another save." : "Эта версия доступна в сохранённых черновиках Studio. Новые правки нужно сохранить отдельно.") : (en ? "Save keeps this draft in your workspace. Human approval is separate." : "Сохранение оставляет черновик в рабочем пространстве. Утверждение человеком — отдельно.")}</p>}
  </div>;
}
