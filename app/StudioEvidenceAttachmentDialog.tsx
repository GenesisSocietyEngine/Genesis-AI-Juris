"use client";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Native focus trap/escape only; applying an attachment remains in the existing materials transaction. */
export default function StudioEvidenceAttachmentDialog({ locale, onCancel, children }: { locale: "en" | "ru"; onCancel: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll:true}); };
  }, []);
  return <dialog ref={dialog} className="evidence-attachment-dialog" aria-labelledby="evidence-attachment-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div className="evidence-attachment-heading"><h2 id="evidence-attachment-title">{locale === "en" ? "Review evidence attachment" : "Проверьте прикрепление материала"}</h2><button type="button" onClick={onCancel}>{locale === "en" ? "Cancel" : "Отмена"}</button></div>
    <p>{locale === "en" ? "Choose Apply change to add these connections. Existing links and material text stay intact. Evidence review is separate." : "Нажмите «Применить изменение», чтобы добавить связи. Существующие связи и тексты сохраняются. Проверка доказательств — отдельно."}</p>
    {children}
  </dialog>;
}
