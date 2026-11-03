"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { casePublicationFingerprint } from "./case-integrity";
import { studioMaterials, studioMaterialsArchive, studioMaterialCitations, materialFilename, type StudioMaterial } from "./studio-materials";
import StudioCitedPassages from "./StudioCitedPassages";
import { rearrangeStudioEvidence } from "./studio-evidence-operations";
import { startReportDownload } from "./report-download";
import type { StudioDraft } from "./types";
import styles from "./studio-evidence-workspace.module.css";
import { indexStudioMaterials, searchStudioMaterials, MATERIAL_SEARCH_LIMITS, type MaterialReadingMemory } from "./studio-material-search";

const EMPTY_MATERIALS: StudioMaterial[] = [];
type EvidenceAction = "attach" | "move" | "detach";
type EvidenceBatch = { scope: object; selected: string[]; target: string; mode: EvidenceAction };
type MaterialOperation = { scope: object; batch: EvidenceBatch };

const DEFAULT_READING = { query: "", filter: "all", history: false, limit: 20 };

export type MaterialsAuthority = { allowed: boolean; epoch: number; verify: () => Promise<() => boolean> };
export default function StudioMaterialsWorkspace({ draft, locale, authority, nodeId, onNode, onApply, readingMemory, onReturnToFinding }: {
  draft: StudioDraft; locale: "en" | "ru"; authority?: MaterialsAuthority; nodeId?: string;
  onNode: (id: string) => void; onApply?: (expected: string, next: StudioDraft) => boolean;
  readingMemory?: MaterialReadingMemory;
  onReturnToFinding?: () => void;
}) {
  const readingScope = useMemo(() => ({ draft, locale, epoch: authority?.epoch, allowed: authority?.allowed }), [draft, locale, authority?.epoch, authority?.allowed]);
  const scope = useMemo(() => ({ ...readingScope, nodeId }), [readingScope, nodeId]);
  const [loaded, setLoaded] = useState<{ scope: object; items: StudioMaterial[]; failure?: string } | null>(null);
  const remembered = readingMemory?.context.draft === draft && readingMemory.context.locale === locale && readingMemory.context.epoch === authority?.epoch && readingMemory.context.allowed === authority?.allowed;
  const initial = remembered ? readingMemory?.read() ?? DEFAULT_READING : DEFAULT_READING;
  const [view, setView] = useState({ scope: readingScope, query: initial.query, filter: initial.filter, history: initial.history, limit: initial.limit });
  const active = view.scope === readingScope ? view : { scope: readingScope, query: initial.query, filter: initial.filter, history: initial.history, limit: initial.limit };
  const { query, filter, history, limit } = active;
  function setReading<K extends keyof typeof DEFAULT_READING>(key: K, value: typeof DEFAULT_READING[K] | ((previous: typeof DEFAULT_READING[K]) => typeof DEFAULT_READING[K])) {
    setView(previous => { const current = previous.scope === readingScope ? previous : active; return { ...current, [key]: typeof value === "function" ? value(current[key]) : value }; });
  }
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => { readingMemory?.write({ query, filter, history, limit, returnTo: remembered ? readingMemory.read()?.returnTo : undefined }); }, [readingMemory, query, filter, history, limit, remembered]);
  const freshBatch: EvidenceBatch = { scope, selected: [], target: "", mode: "attach" };
  const [batch, setBatch] = useState<EvidenceBatch>(freshBatch);
  const activeBatch = batch.scope === scope ? batch : freshBatch;
  const { selected, target, mode } = activeBatch;
  const [feedback, setFeedback] = useState<{ scope: object; text: string } | null>(null);
  const notice = feedback?.scope === scope ? feedback.text : "";
  function setNotice(text: string) { setFeedback({ scope, text }); }
  const [pending, setPending] = useState<MaterialOperation | null>(null);
  const busy = pending?.scope === scope;
  const context = useRef<object | null>(scope), intent = useRef<EvidenceBatch | null>(activeBatch);
  const operation = useRef<MaterialOperation | null>(null);
  useLayoutEffect(() => { context.current = scope; return () => { context.current = null; }; }, [scope]);
  useLayoutEffect(() => { intent.current = activeBatch; return () => { intent.current = null; }; }, [activeBatch]);
  function changeBatch(update: (current: EvidenceBatch) => EvidenceBatch) {
    if (context.current !== scope || intent.current !== activeBatch) return false;
    operation.current = null; setPending(null); setNotice("");
    setBatch(current => update(current.scope === scope ? current : freshBatch));
    return true;
  }
  function clearSelection() {
    if (!changeBatch(() => freshBatch)) return;
    setNotice(t("Selection cleared. No pending change was applied.", "Выбор снят. Ожидавшее изменение не применено."));
    const search = root.current?.querySelector<HTMLInputElement>('input[type="search"]');
    search?.focus({ preventScroll: true }); search?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }
  function beginOperation() {
    if (!scope.allowed || context.current !== scope || intent.current !== activeBatch || operation.current?.scope === scope) return null;
    const ticket = { scope, batch: activeBatch };
    operation.current = ticket; setPending(ticket); setNotice(""); return ticket;
  }
  function currentOperation(ticket: MaterialOperation) {
    return context.current === ticket.scope && intent.current === ticket.batch && operation.current === ticket && Boolean(scope.allowed);
  }
  function finishOperation(ticket: MaterialOperation) {
    if (operation.current !== ticket) return;
    operation.current = null; setPending(current => current === ticket ? null : current);
  }
  useEffect(() => {
    let active = true;
    void studioMaterials(draft, locale).then(items => { if (active) { setLoaded({ scope, items }); setBatch({ scope, selected: [], target: "", mode: "attach" }); setFeedback({ scope, text: "" }); } }).catch(() => { if (active) { setLoaded({ scope, items: [], failure: locale === "en" ? "Materials could not be read. Retry this section." : "Не удалось прочитать материалы. Откройте раздел повторно." }); setFeedback({ scope, text: "" }); } });
    return () => { active = false; };
  }, [draft, locale, nodeId, scope]);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const items = loaded?.scope === scope ? loaded.items : EMPTY_MATERIALS;
  const loading = loaded?.scope !== scope;
  const readFailure = loaded?.scope === scope ? loaded.failure : undefined;
  const citations = useMemo(() => !loading && !readFailure ? studioMaterialCitations(draft, locale, nodeId, items) : [], [draft, locale, nodeId, items, loading, readFailure]);
  const index = useMemo(() => indexStudioMaterials(items.filter(item => (!nodeId || item.nodeIds.includes(nodeId)) && (history || item.selected || item.nodeIds.length > 0)
    && (filter === "unassigned" ? item.kind === "working" && item.nodeIds.length === 1 : filter === "all" || item.kind === filter))), [items, nodeId, history, filter]);
  const filtered = useMemo(() => searchStudioMaterials(index, query), [index, query]);
  useLayoutEffect(() => {
    if (loading || readFailure || !root.current || !remembered) return;
    const target = readingMemory?.takeReturn();
    if (!target) return;
    const button = Array.from(root.current.querySelectorAll<HTMLButtonElement>("[data-material-node]")).find(button => button.dataset.materialNode === target.key);
    if (button) {
      // A compact row must reveal its linked control before restoring focus.
      for (let parent = button.closest("details"); parent; parent = parent.parentElement?.closest("details") ?? null) parent.open = true;
      button.focus({ preventScroll: true });
      const margin = Math.min(96, window.innerHeight / 4);
      const viewportTop = Math.max(margin, Math.min(target.viewportTop ?? margin, Math.max(margin, window.innerHeight - 80)));
      window.scrollTo({ top: Math.max(0, window.scrollY + button.getBoundingClientRect().top - viewportTop), behavior: "instant" });
    }
  }, [readingMemory, loading, readFailure, remembered]);
  function openNode(id: string, key: string, button: HTMLButtonElement) {
    readingMemory?.write({ query, filter, history, limit, returnTo: { key, scrollY: window.scrollY, viewportTop: button.getBoundingClientRect().top } });
    onNode(id);
  }
  const evidenceIds = selected.flatMap(id => { const item = items.find(item => item.id === id); return item?.kind === "working" ? [item.id.slice("working:".length)] : []; });
  async function download(item?: StudioMaterial) {
    if (!authority?.allowed || loaded?.scope !== scope || readFailure) return;
    const ticket = beginOperation(); if (!ticket) return;
    const current = () => currentOperation(ticket);
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
    finally { finishOperation(ticket); }
  }
  async function arrange() {
    if (!authority?.allowed || !onApply || loaded?.scope !== scope || readFailure || !evidenceIds.length || mode !== "detach" && !target || mode !== "attach" && !nodeId) return;
    const ticket = beginOperation(); if (!ticket) return;
    const expected = casePublicationFingerprint(draft);
    try {
      const authorized = await authority.verify();
      if (!currentOperation(ticket) || !authorized()) return;
      const next = rearrangeStudioEvidence(draft, evidenceIds, mode === "attach" ? null : nodeId ?? null, mode === "detach" ? null : target);
      if (!onApply(expected, next)) throw new Error("Changed context");
      intent.current = null; setBatch(freshBatch);
    } catch (error) { if (currentOperation(ticket)) setNotice(error instanceof Error && error.message === "evidence-destination-conflict"
      ? t("That destination already has this evidence connection. Choose another node; no link details were merged or removed.", "У назначения уже есть эта связь с материалом. Выберите другой узел; сведения связей не объединены и не удалены.")
      : t("The case or access changed, or the selection is invalid. Reopen this section and retry. Nothing was applied.", "Кейс или доступ изменился либо выбор некорректен. Откройте раздел повторно. Изменения не применены.")); }
    finally { finishOperation(ticket); }
  }
  const nodeLabel = (id: string) => {
    const index = draft.nodes.findIndex(node => node.id === id);
    return index < 0 ? "" : `N${String(index + 1).padStart(2, "0")} · ${draft.nodes[index].title}`;
  };
  const destination = target && draft.nodes.some(node => node.id === target && node.id !== nodeId && !evidenceIds.includes(node.id)) ? nodeLabel(target) : "";
  const ready = evidenceIds.length > 0 && (mode === "detach" ? Boolean(nodeId) : Boolean(destination));
  const preview = mode === "detach" ? t(`Disconnect ${evidenceIds.length} records from ${nodeLabel(nodeId!)}.`, `Отсоединить ${evidenceIds.length} записей от ${nodeLabel(nodeId!)}.`)
          : destination ? mode === "move" ? t(`Move ${evidenceIds.length} records from ${nodeLabel(nodeId!)} to ${destination}.`, `Перенести ${evidenceIds.length} записей из ${nodeLabel(nodeId!)} в ${destination}.`)
            : t(`Attach ${evidenceIds.length} records to ${destination}; keep existing connections.`, `Прикрепить ${evidenceIds.length} записей к ${destination}; сохранить существующие связи.`)
          : t("Choose a destination to preview the change.", "Выберите назначение для предпросмотра изменения.");
  return <section ref={root} className={`${styles.surface} ${nodeId ? styles.compact : ""}`} aria-label={t("Case materials library", "Библиотека материалов кейса")}>
    {nodeId && <StudioCitedPassages key={nodeId} citations={citations} context={scope} locale={locale} onReturnToFinding={onReturnToFinding}/>}
    <header className={styles.header}><div><h3>{nodeId ? t("Evidence for this node", "Материалы этого узла") : t("Materials library", "Библиотека материалов")}</h3><p>{nodeId ? t("Select working records to move or disconnect them. Their text remains in the library.", "Выберите рабочие записи для переноса или отсоединения. Тексты останутся в библиотеке.") : t("Browse text, inspect linked nodes, or download files. Working records and illustrative references require review; missing originals have no file.", "Просматривайте тексты и узлы или скачивайте файлы. Рабочие записи и учебные источники требуют проверки; отсутствующие оригиналы не имеют файла.")}</p></div>{!nodeId && <button className={styles.primary} type="button" disabled={busy || !authority?.allowed || !items.length} onClick={() => void download()}>{t("Download all (.zip)", "Скачать всё (.zip)")}</button>}</header>
    <div className={styles.toolbar}><label>{t("Find a material", "Найти материал")}<input type="search" value={query} maxLength={MATERIAL_SEARCH_LIMITS.query} placeholder={t("Title, note or loaded text", "Название, примечание или загруженный текст")} onChange={event => { setReading("query", event.target.value); setReading("limit", 20); }} /></label><label>{t("Show materials", "Показать материалы")}<select value={filter} onChange={event => { setReading("filter", event.target.value); setReading("limit", 20); }}><option value="all">{t("All materials", "Все материалы")}</option><option value="working">{t("Working evidence", "Рабочие материалы")}</option><option value="reference">{t("Illustrative references", "Учебные источники")}</option><option value="missing">{t("Missing originals", "Отсутствующие оригиналы")}</option><option value="url">{t("URL references only", "Только URL-ссылки")}</option><option value="unassigned">{t("Unassigned evidence", "Неприкреплённые материалы")}</option></select></label><label><input type="checkbox" checked={history} onChange={event => { setReading("history", event.target.checked); setReading("limit", 20); }} /> {t("Include retained versions", "Включить прежние версии")}</label></div>
    <p className={styles.meta}>{t("Searches loaded titles, notes and text. Missing originals and URL-only sources have no body to search.", "Поиск по загруженным названиям, примечаниям и тексту. Отсутствующие оригиналы и URL — без текста.")}</p>
    {index.limitedMaterials > 0 && <p className={styles.notice}>{t(`Search is limited for ${index.limitedMaterials} materials: at most 1,000 materials, 4,096 title/note characters per material, 200,000 characters per body and 2,000,000 body characters in total. Open or download full text to inspect the rest.`, `Поиск ограничен для ${index.limitedMaterials} материалов: до 1 000 материалов, 4 096 символов названия/примечания на материал, 200 000 символов на текст и 2 000 000 символов текстов всего. Остальное доступно в полном тексте или скачанном файле.`)}</p>}
    <div className={styles.resultsBar}><p role="status" aria-label={t("Material results", "Результаты поиска материалов")}>{loading ? t("Loading materials…", "Загрузка материалов…") : readFailure || t(`${filtered.length} matching materials`, `Материалов найдено: ${filtered.length}`)}</p>
    {(query || filter !== "all" || history) && <button className={styles.secondary} type="button" onClick={() => { setReading("query", ""); setReading("filter", "all"); setReading("history", false); setReading("limit", 20); }}>{t("Reset filters", "Сбросить фильтры")}</button>}</div>
    {!loading && !readFailure && notice && <p role="status" aria-label={t("Material action status", "Статус действия с материалами")}>{notice}</p>}
    {!loading && !readFailure && !filtered.length && <p className={styles.empty}>{t("No matching materials. Try a shorter phrase, change the material type or reset filters.", "Материалы не найдены. Сократите фразу, измените тип материалов или сбросьте фильтры.")}</p>}
    {onApply && !loading && !readFailure && evidenceIds.length > 0 && <fieldset className={`${styles.notice} ${styles.bulk}`} aria-label={t("Arrange selected evidence", "Распорядиться выбранными материалами")}>
      <legend>{t(`${evidenceIds.length} working records selected`, `Выбрано рабочих записей: ${evidenceIds.length}`)}</legend>
      <div className={styles.batchControls}>
        {nodeId && <label>{t("Action", "Действие")}<select aria-label={t("Evidence action", "Действие с материалами")} disabled={busy} value={mode} onChange={event => { const value = event.target.value as EvidenceAction; changeBatch(current => ({ ...current, mode: value })); }}>
          <option value="attach">{t("Attach to another node", "Прикрепить к другому узлу")}</option>
          <option value="move">{t("Move from this node", "Перенести из этого узла")}</option><option value="detach">{t("Disconnect from this node", "Отсоединить от этого узла")}</option>
        </select></label>}
        {mode !== "detach" && <label>{t("Destination node", "Узел назначения")}<select aria-label={t("Destination node", "Узел назначения")} disabled={busy} value={target} onChange={event => { const value = event.target.value; changeBatch(current => ({ ...current, target: value })); }}>
          <option value="">{t("Choose a node", "Выберите узел")}</option>{draft.nodes.map((node, index) => !evidenceIds.includes(node.id) && node.id !== nodeId ? <option key={node.id} value={node.id}>N{String(index + 1).padStart(2, "0")} · {node.title}</option> : null)}
        </select></label>}
      </div>
      <p className={styles.batchPreview} aria-label={t("Evidence change preview", "Предпросмотр изменений материалов")}>{preview}</p>
      <details><summary>{t("Selected records", "Выбранные записи")}</summary><ul>{evidenceIds.map(id => <li key={id}>{nodeLabel(id)}</li>)}</ul></details>
      <p className={styles.meta}>{t("Working draft only; save separately. Text stays in the library. No evidence acceptance or review.", "Изменяется рабочий черновик; сохраните отдельно. Тексты остаются в библиотеке. Это не принятие материалов или проверка.")}</p>
      {busy && <p role="status">{t("Checking access… You can cancel before changes are applied.", "Проверка доступа… Можно отменить до применения изменений.")}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} aria-label={t("Apply change: ", "Применить изменение: ") + preview} disabled={busy || !authority?.allowed || !ready} onClick={() => void arrange()}>{t("Apply change", "Применить изменение")}</button>
        <button type="button" className={styles.secondary} onClick={clearSelection}>{busy ? t("Cancel", "Отмена") : t("Clear selection", "Снять выбор")}</button>
      </div>
    </fieldset>}
    <ul className={`${styles.rows} ${styles.materialList}`}>{filtered.slice(0, limit).map(({item, passage}) => {
      const linked = item.nodeIds.filter(id => id !== nodeId);
      return <li key={item.id} data-material-id={item.id}>
      <div className={styles.materialLayout}>
        {onApply && (item.kind === "working" && item.id !== `working:${nodeId}` ? <label className={styles.materialSelect}><input type="checkbox" disabled={!authority?.allowed || busy} aria-label={t("Select ", "Выбрать ") + item.title} checked={selected.includes(item.id)} onChange={event => { const checked = event.target.checked; changeBatch(current => ({ ...current, selected: checked ? [...current.selected, item.id] : current.selected.filter(id => id !== item.id) })); }} /><span className={styles.selectionLabel}>{t("Select", "Выбрать")}</span></label> : <span className={`${styles.materialSelect} ${styles.selectionSpace}`} aria-hidden="true"/>)}
        <details className={styles.materialDetails} onToggle={event => { if (event.currentTarget.open && passage && !event.currentTarget.querySelector("[data-material-node]:focus")) { const match = event.currentTarget.querySelector<HTMLElement>("mark"); match?.focus({preventScroll:true}); match?.scrollIntoView({block:"center"}); } }}>
          <summary><span className={styles.disclosureMarker} aria-hidden="true">›</span><span className={styles.materialTitle}><strong>{item.title}</strong><span className={styles.meta}>{item.note}</span></span><span className={styles.readLabel}>{item.text === null ? t("Details", "Подробнее") : passage ? t("Read matching passage", "Открыть найденный фрагмент") : t("Read text", "Прочитать текст")}<small>{t(`${linked.length} related ${linked.length === 1 ? "node" : "nodes"}`, `Связанных узлов: ${linked.length}`)}</small></span></summary>
          <div className={styles.materialBody}>
            {item.text !== null && <p className={styles.materialText}>{passage ? <>{item.text.slice(0, passage.from)}<mark tabIndex={-1}>{item.text.slice(passage.from, passage.to)}</mark>{item.text.slice(passage.to)}</> : item.text}</p>}
            <p className={styles.meta}>{t("Related nodes", "Связанные узлы")}</p>
            <div className={styles.actions}>{linked.map(id => <button className={styles.secondary} key={id} type="button" data-material-node={`${item.id}→${id}`} onClick={event => openNode(id, `${item.id}→${id}`, event.currentTarget)}>N{String(draft.nodes.findIndex(node => node.id === id) + 1).padStart(2, "0")} · {draft.nodes.find(node => node.id === id)?.title}</button>)}</div>
            {!linked.length && <p className={styles.meta}>{t("No related nodes recorded.", "Связанные узлы не записаны.")}</p>}
          </div>
        </details>
        {item.text !== null && <button className={`${styles.secondary} ${styles.fileDownload}`} disabled={!authority?.allowed || busy} type="button" onClick={() => void download(item)} aria-label={t("Download text: ", "Скачать текст: ") + item.title}>{t("Download text", "Скачать текст")}</button>}
      </div>
      {passage && <div className={styles.passage}><p className={styles.meta}>{item.id}{passage.section ? ` · § ${passage.section}` : ""} · {t("Text position", "Позиция в тексте")} {passage.from + 1}–{passage.to}</p><p>{passage.leading ? "…" : ""}{passage.before}<mark>{passage.exact}</mark>{passage.after}{passage.trailing ? "…" : ""}</p></div>}
    </li>;})}</ul>
    {filtered.length > limit && <button type="button" className={styles.secondary} onClick={() => setReading("limit", value => value + 20)}>{t("Show 20 more", "Показать ещё 20")}</button>}

  </section>;
}
