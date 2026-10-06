"use client";

import { useEffect, useRef, useState } from "react";
import { deleteArchivedStudioDraft, readStudioArchive, readStudioArchiveBackup, type ArchivedStudioDraft, STUDIO_ARCHIVE_LIMIT, STUDIO_ARCHIVE_BYTES } from "./studio-draft-archive";

export default function StudioDraftArchive({ scope, locale, context, restore }: {
  scope: string; locale: "en" | "ru"; context: string; restore: (entry: ArchivedStudioDraft) => void;
}) {
  const en = locale === "en";
  const [result, setResult] = useState(() => read());
  const importAttempt = useRef(0);
  const liveContext = useRef(context); liveContext.current = context;
  const [importError, setImportError] = useState(false);
  useEffect(() => () => { importAttempt.current++; }, [scope, context]);
  function read(): { entries: ArchivedStudioDraft[]; error: boolean } {
    try { return { entries: readStudioArchive(window.localStorage, scope), error: false }; }
    catch { return { entries: [], error: true }; }
  }
  function exportEntry(entry: ArchivedStudioDraft) {
    const raw = JSON.stringify({ format: "genesis-juris-archive-backup", schemaVersion: 1, entry });
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `studio-recovery-${entry.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="learning-note" aria-labelledby="studio-archive-title">
    <h2 id="studio-archive-title">{en ? "Earlier device drafts" : "Предыдущие черновики устройства"}</h2>
    <p>{en ? `This browser keeps up to ${STUDIO_ARCHIVE_LIMIT} earlier local drafts (2 MB total) for your account. Nothing is automatically evicted. Restore creates an unsaved copy; add working form items before switching. Undo history is not archived. Signing out clears these device copies. Device storage is not a workspace backup. Export recovery data keeps the draft, prompt and original bytes for recovery; it is not a sealed case export.` : `Браузер хранит до ${STUDIO_ARCHIVE_LIMIT} предыдущих локальных черновиков (всего 2 МБ) для вашего аккаунта. Автоматического удаления нет. Восстановление создаёт несохранённую копию; добавьте элементы формы перед переключением. История отмены не архивируется. При выходе из аккаунта эти копии удаляются. Локальное хранилище не заменяет сохранение в workspace. Экспорт данных восстановления сохраняет черновик, промпт и исходные данные; это не экспорт кейса с серверной печатью.`}</p>
    {result.error ? <p role="alert">{en ? "The archive could not be read. Its original data is unchanged. Retry or recover browser storage before replacing work." : "Не удалось прочитать архив. Исходные данные не изменены. Повторите попытку или восстановите хранилище до замены работы."}</p> : <>
      <p role="status">{result.entries.length} / {STUDIO_ARCHIVE_LIMIT}</p>
      <ul>{result.entries.map(entry => <li key={entry.id}>
        <h3>{entry.title || (en ? "Untitled draft" : "Без названия")}</h3><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(en ? "en-GB" : "ru-RU")}</time>
        <div className="template-actions"><button type="button" className="secondary-cta" onClick={() => restore(entry)}>{en ? "Restore copy" : "Восстановить копию"}<span className="visually-hidden"> — {entry.title}</span></button>
          <button type="button" className="secondary-cta" onClick={() => exportEntry(entry)}>{en ? "Export recovery data" : "Экспорт данных восстановления"}<span className="visually-hidden"> — {entry.title}</span></button>
          <button type="button" className="secondary-cta" onClick={() => {
            if (!window.confirm(en ? `Permanently delete the earlier draft “${entry.title}”? Export recovery data first if this is your only copy.` : `Удалить предыдущий черновик «${entry.title}» навсегда? Сначала экспортируйте данные, если это единственная копия.`)) return;
            try { deleteArchivedStudioDraft(window.localStorage, scope, entry.id); setResult(read()); } catch { setResult({ ...result, error: true }); }
          }}>{en ? "Delete earlier draft" : "Удалить предыдущий черновик"}<span className="visually-hidden"> — {entry.title}</span></button></div>
      </li>)}</ul>
    </>}
    <button type="button" className="secondary-cta" onClick={() => setResult(read())}>{en ? "Refresh earlier drafts" : "Обновить список"}</button>
    <label className="studio-field"><span>{en ? "Import recovery data as an unsaved copy" : "Импорт данных восстановления как несохранённой копии"}</span><input type="file" accept="application/json,.json" onChange={async event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
      const attempt = ++importAttempt.current, before = context; setImportError(false);
      if (!file) return;
      try {
        if (file.size > STUDIO_ARCHIVE_BYTES) throw new Error("archive-recovery");
        const entry = readStudioArchiveBackup(await file.text(), scope);
        if (attempt === importAttempt.current && before === liveContext.current) restore(entry);
      } catch { if (attempt === importAttempt.current && before === liveContext.current) setImportError(true); }
    }}/></label>
    {importError && <p role="alert">{en ? "Recovery data is unsupported, damaged or belongs to another account. Your open case is unchanged." : "Данные восстановления не поддерживаются, повреждены или принадлежат другому аккаунту. Открытый кейс не изменён."}</p>}
  </section>;
}
