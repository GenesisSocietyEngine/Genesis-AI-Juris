"use client";
import { useEffect, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import styles from "./studio-evidence-workspace.module.css";

export default function StudioDeleteNodeDialog({ draft, nodeId, locale, onCancel, onConfirm }: {
  draft: StudioDraft; nodeId: string; locale: "en" | "ru"; onCancel: () => void; onConfirm: (target: string | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), [target, setTarget] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const node = draft.nodes.find(item => item.id === nodeId), evidence = new Set(draft.nodes.filter(item => item.type === "evidence").map(item => item.id));
  const attached = new Set(draft.links.flatMap(link => link.from === nodeId && evidence.has(link.to) ? [link.to] : link.to === nodeId && evidence.has(link.from) ? [link.from] : []));
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  return <dialog ref={dialog} className={`${styles.surface} ${styles.dialog}`} aria-labelledby="delete-node-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="delete-node-title">{node?.type === "evidence" ? t("Disconnect evidence record?", "Отсоединить запись материала?") : t("Delete this node?", "Удалить узел?")}</h2><p><strong>{node?.title}</strong></p>
    <p>{t("Evidence records keep their text in the materials library. Other connections to this node will be removed. You can undo this change.", "Записи материалов сохранят тексты в библиотеке. Остальные связи узла будут удалены. Изменение можно отменить.")}</p>
    {node?.type !== "evidence" && attached.size > 0 && <label>{t(`Reattach ${attached.size} evidence record(s) together`, `Переприкрепить записей материалов: ${attached.size}`)}<select value={target} onChange={event => setTarget(event.target.value)}><option value="">{t("Keep records in the library", "Оставить записи в библиотеке")}</option>{draft.nodes.map((item, index) => item.id !== nodeId && item.type !== "evidence" ? <option key={item.id} value={item.id}>N{String(index + 1).padStart(2, "0")} · {item.title}</option> : null)}</select></label>}
    <div className={styles.actions}><button className={styles.secondary} type="button" autoFocus onClick={onCancel}>{t("Cancel", "Отмена")}</button><button className={styles.primary} type="button" onClick={() => onConfirm(target || null)}>{node?.type === "evidence" ? t("Disconnect; keep record", "Отсоединить; сохранить запись") : t("Delete node; keep evidence", "Удалить узел; сохранить материалы")}</button></div>
  </dialog>;
}
