"use client";

import { useEffect, useRef } from "react";

export type StudioRecovery = { scope: string | null; reason: string; rawText?: string; canExport: boolean; filename: string };

export default function StudioRecoveryView({ recovery, locale, onReturn }: { recovery: StudioRecovery; locale: "en" | "ru"; onReturn: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const en = locale === "en";
  function download() {
    if (!recovery.canExport || recovery.rawText === undefined) return;
    const url = URL.createObjectURL(new Blob([recovery.rawText], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = recovery.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="studio-entry page-width" aria-labelledby="studio-recovery-title">
    <header className="workspace-page-header">
    <h1 ref={heading} id="studio-recovery-title" tabIndex={-1}>{en ? "Document retained for recovery" : "Документ сохранён для восстановления"}</h1>
    <p role="status">{recovery.reason}</p>
    <p>{en ? "Studio cannot open this document for editing. The original has not been replaced, and your current case is unchanged." : "Studio не может открыть этот документ для редактирования. Исходный документ не заменён, текущий кейс не изменён."}</p>
    </header>
    <div className="entry-create-actions">
    {recovery.canExport && recovery.rawText !== undefined ? <button type="button" className="primary-cta" onClick={download}>{en ? "Download the original document" : "Скачать исходный документ"}</button> : <p>{en ? "Downloading is unavailable until access to the original can be verified." : "Скачивание недоступно, пока не подтверждён доступ к исходному документу."}</p>}
    <button type="button" className="secondary-cta" onClick={onReturn}>{en ? "Keep original and return to current case" : "Сохранить оригинал и вернуться к текущему кейсу"}</button>
    </div>
  </main>;
}
