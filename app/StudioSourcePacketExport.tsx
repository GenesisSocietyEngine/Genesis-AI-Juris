"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import { startReportDownload } from "./report-download";

export default function StudioSourcePacketExport({ draft, locale, allowed, verify }: {
  draft: StudioDraft; locale: "en" | "ru"; allowed: boolean;
  verify: () => Promise<() => boolean>;
}) {
  const context = useMemo(() => ({ draft, locale, allowed, verify }), [draft, locale, allowed, verify]);
  const committed = useRef<typeof context | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ context: typeof context; text: string } | null>(null);
  useLayoutEffect(() => { committed.current = context; return () => { committed.current = null; }; }, [context]);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  async function download(format: "md" | "json") {
    if (!allowed || pending.current || committed.current !== context) return;
    pending.current = true; setBusy(true); setNotice(null);
    try {
      const authorized = await verify();
      const current = () => committed.current === context && context.allowed && authorized();
      if (!current()) return;
      const { prepareStudioSourcePacketDownload } = await import("./studio-source-packet");
      const output = await prepareStudioSourcePacketDownload(draft, locale, format, current);
      if (!output || !current()) return;
      startReportDownload(new Blob([output.content], { type: output.mime }), output.filename);
      if (current()) setNotice({ context, text: t("Reference source packet downloaded. This does not record evidence acceptance.", "Пакет эталонных источников скачан. Принятие доказательств не фиксируется.") });
    } catch {
      if (committed.current === context) setNotice({ context, text: t("The packet could not be exported. Verify current access and source provenance, then try again.", "Не удалось экспортировать пакет. Проверьте текущий доступ и происхождение источников, затем повторите.") });
    } finally {
      pending.current = false;
      if (committed.current) setBusy(false);
    }
  }
  return <div>
    <p>{t("Export all nine fictional documents: the source scenario's selected immutable versions plus retained history. The analytical report's cited-source register remains separate. Source text stays in its authored language.", "Экспортируйте все девять вымышленных документов: выбранные неизменяемые версии исходного сценария и сохранённую историю. Реестр цитируемых источников аналитического отчёта остаётся отдельным. Тексты сохраняют язык оригинала.")}</p>
    <button type="button" disabled={!allowed || busy} onClick={() => void download("md")}>{t("Download complete source packet (.md)", "Скачать полный пакет источников (.md)")}</button>{" "}
    <button type="button" disabled={!allowed || busy} onClick={() => void download("json")}>{t("Download source manifest (.json)", "Скачать манифест источников (.json)")}</button>
    {busy && <p role="status">{t("Preparing source packet…", "Подготовка пакета источников…")}</p>}
    {notice?.context === context && <p role="status">{notice.text}</p>}
  </div>;
}
