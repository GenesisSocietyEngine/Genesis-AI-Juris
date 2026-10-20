"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { casePublicationFingerprint } from "./case-integrity";
import { studioMaterials, studioMaterialsArchive, materialFilename, type StudioMaterial } from "./studio-materials";
import { rearrangeStudioEvidence } from "./studio-evidence-operations";
import { startReportDownload } from "./report-download";
import type { StudioDraft } from "./types";
import styles from "./studio-evidence-workspace.module.css";

export type MaterialsAuthority = { allowed: boolean; epoch: number; verify: () => Promise<() => boolean> };
export default function StudioMaterialsWorkspace({ draft, locale, authority, nodeId, onNode, onApply }: {
  draft: StudioDraft; locale: "en" | "ru"; authority?: MaterialsAuthority; nodeId?: string;
  onNode: (id: string) => void; onApply?: (expected: string, next: StudioDraft) => boolean;
}) {
  const [loaded, setLoaded] = useState<{ draft: StudioDraft; items: StudioMaterial[] } | null>(null);
  const [query, setQuery] = useState(""), [history, setHistory] = useState(false), [limit, setLimit] = useState(20);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]), [target, setTarget] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const context = useRef({ draft, epoch: authority?.epoch, allowed: authority?.allowed });
  useLayoutEffect(() => { context.current = { draft, epoch: authority?.epoch, allowed: authority?.allowed }; return () => { context.current = { draft, epoch: undefined, allowed: false }; }; }, [draft, authority?.epoch, authority?.allowed]);
  useEffect(() => {
    let active = true;
    void studioMaterials(draft, locale).then(items => { if (active) { setLoaded({ draft, items }); setSelected([]); setTarget(""); setNotice(""); setLimit(20); } }).catch(() => { if (active) { setLoaded(null); setNotice(locale === "en" ? "Materials could not be read. Retry this section." : "Не удалось прочитать материалы. Откройте раздел повторно."); } });
    return () => { active = false; };
  }, [draft, locale, nodeId, authority?.epoch]);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const items = loaded?.draft === draft ? loaded.items : [];
  const loading = loaded?.draft !== draft && !notice;
  const attached = items.filter(item => !nodeId || item.nodeIds.includes(nodeId));
  const filtered = attached.filter(item => (history || item.selected || item.nodeIds.length > 0)
    && (filter === "all" || filter === "unassigned" ? filter === "all" || item.kind === "working" && item.nodeIds.length === 1 : item.kind === filter)
    && `${item.title} ${item.note}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const evidenceIds = selected.flatMap(id => { const item = items.find(item => item.id === id); return item?.kind === "working" ? [item.id.slice("working:".length)] : []; });
  async function download(item?: StudioMaterial) {
    if (busy || !authority?.allowed || loaded?.draft !== draft) return;
    const snapshot = context.current;
    const current = () => context.current === snapshot && Boolean(snapshot.allowed);
    setBusy(true); setNotice("");
    try {
      const authorized = await authority.verify();
      if (!current() || !authorized()) return;
      const valid = () => current() && authorized();
      if (item && item.text !== null) {
        if (valid()) startReportDownload(new Blob([item.text], { type: "text/plain;charset=utf-8" }), materialFilename(item, items.indexOf(item)));
      } else {
        const bytes = await studioMaterialsArchive(draft, items, valid);
        if (bytes && valid()) startReportDownload(new Blob([new Uint8Array(bytes)], { type: "application/zip" }), `${draft.caseId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)}-materials.zip`);
      }
      if (valid()) setNotice(t("Download prepared. Reference files and working records still require review.", "Скачивание подготовлено. Источники и рабочие записи требуют проверки."));
    } catch { if (current()) setNotice(t("Download could not be prepared. Your case is unchanged.", "Не удалось подготовить скачивание. Кейс не изменён.")); }
    finally { setBusy(false); }
  }
  async function arrange(mode: "attach" | "move" | "detach") {
    if (!authority?.allowed || !onApply || busy || !evidenceIds.length || mode !== "detach" && !target) return;
    const snapshot = context.current, expected = casePublicationFingerprint(draft);
    setBusy(true); setNotice("");
    try {
      const authorized = await authority.verify();
      if (context.current !== snapshot || !authorized()) return;
      const next = rearrangeStudioEvidence(draft, evidenceIds, mode === "attach" ? null : nodeId ?? null, mode === "detach" ? null : target);
      if (!onApply(expected, next)) throw new Error("Changed context");
      setSelected([]);
    } catch (error) { if (context.current === snapshot) setNotice(error instanceof Error && error.message === "evidence-destination-conflict"
      ? t("That destination already has this evidence connection. Choose another node; no link details were merged or removed.", "У назначения уже есть эта связь с материалом. Выберите другой узел; сведения связей не объединены и не удалены.")
      : t("The case or access changed, or the selection is invalid. Reopen this section and retry. Nothing was applied.", "Кейс или доступ изменился либо выбор некорректен. Откройте раздел повторно. Изменения не применены.")); }
    finally { setBusy(false); }
  }
  return <section className={`${styles.surface} ${nodeId ? styles.compact : ""}`} aria-label={t("Case materials library", "Библиотека материалов кейса")}>
    <header className={styles.header}><div><h3>{nodeId ? t("Evidence for this node", "Материалы этого узла") : t("Materials library", "Библиотека материалов")}</h3><p>{nodeId ? t("Select working records to move or disconnect them. Their text remains in the library.", "Выберите рабочие записи для переноса или отсоединения. Тексты останутся в библиотеке.") : t("Browse text, inspect linked nodes, or download files. Working records and illustrative references require review; missing originals have no file.", "Просматривайте тексты и узлы или скачивайте файлы. Рабочие записи и учебные источники требуют проверки; отсутствующие оригиналы не имеют файла.")}</p></div>{!nodeId && <button className={styles.primary} type="button" disabled={busy || !authority?.allowed || !items.length} onClick={() => void download()}>{t("Download all (.zip)", "Скачать всё (.zip)")}</button>}</header>
    <div className={styles.toolbar}><label>{t("Find a material", "Найти материал")}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} /></label><label>{t("Show materials", "Показать материалы")}<select value={filter} onChange={event => { setFilter(event.target.value); setLimit(20); }}><option value="all">{t("All materials", "Все материалы")}</option><option value="working">{t("Working evidence", "Рабочие материалы")}</option><option value="reference">{t("Illustrative references", "Учебные источники")}</option><option value="missing">{t("Missing originals", "Отсутствующие оригиналы")}</option><option value="unassigned">{t("Unassigned evidence", "Неприкреплённые материалы")}</option></select></label><label><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)} /> {t("Include retained versions", "Включить прежние версии")}</label></div>
    <p role="status">{notice || (loading ? t("Loading materials…", "Загрузка материалов…") : t(`${filtered.length} matching materials`, `Материалов найдено: ${filtered.length}`))}</p>
    {!loading && !filtered.length && <p className={styles.empty}>{t("No matching materials. Add a connected evidence record in Sources & evidence, or change the search.", "Материалы не найдены. Добавьте связанную запись в разделе источников или измените поиск.")}</p>}
    {onApply && evidenceIds.length > 0 && <fieldset className={`${styles.notice} ${styles.bulk}`}><legend>{t(`${evidenceIds.length} working records selected`, `Выбрано рабочих записей: ${evidenceIds.length}`)}</legend><label>{t("Destination node", "Узел назначения")}<select value={target} onChange={event => setTarget(event.target.value)}><option value="">{t("Choose a node", "Выберите узел")}</option>{draft.nodes.map((node, index) => !evidenceIds.includes(node.id) && node.id !== nodeId ? <option key={node.id} value={node.id}>N{String(index + 1).padStart(2, "0")} · {node.title}</option> : null)}</select></label><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy || !target} onClick={() => void arrange("attach")}>{t("Attach selected", "Прикрепить выбранные")}</button>{nodeId && <><button type="button" className={styles.secondary} disabled={busy || !target} onClick={() => void arrange("move")}>{t("Move to node", "Перенести к узлу")}</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => void arrange("detach")}>{t("Disconnect here", "Отсоединить здесь")}</button></>}</div></fieldset>}
    <ul className={styles.rows}>{filtered.slice(0, limit).map(item => <li key={item.id}>
      <div className={styles.rowHeading}>{item.kind === "working" && item.id !== `working:${nodeId}` && onApply && <input type="checkbox" disabled={!authority?.allowed || busy} aria-label={t("Select ", "Выбрать ") + item.title} checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />}<strong>{item.title}</strong></div>
      <p className={styles.meta}>{item.note}</p>
      {item.text !== null && <details><summary>{t("Read text", "Прочитать текст")}</summary><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.text}</p></details>}
      <div className={styles.actions}>{item.text !== null && <button className={styles.secondary} disabled={!authority?.allowed || busy} type="button" onClick={() => void download(item)}>{t("Download text", "Скачать текст")}</button>}{item.nodeIds.filter(id => id !== nodeId).map(id => <button className={styles.secondary} key={id} type="button" onClick={() => onNode(id)}>N{String(draft.nodes.findIndex(node => node.id === id) + 1).padStart(2, "0")} · {draft.nodes.find(node => node.id === id)?.title}</button>)}</div>
    </li>)}</ul>
    {filtered.length > limit && <button type="button" className={styles.secondary} onClick={() => setLimit(value => value + 20)}>{t("Show 20 more", "Показать ещё 20")}</button>}

  </section>;
}
