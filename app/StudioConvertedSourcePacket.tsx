"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import type { ConvertedSourcePacket } from "./converted-source-packet";
import { startReportDownload } from "./report-download";
import styles from "./studio-overview.module.css";

export default function StudioConvertedSourcePacket({ draft, locale, onNode, authority }: {
  draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void;
  authority?: {allowed:boolean;verify:()=>Promise<()=>boolean>};
}) {
  const context = useMemo(() => ({draft,locale,authority}), [draft,locale,authority]);
  const committed = useRef<typeof context | null>(null), root = useRef<HTMLElement>(null), pending = useRef(false);
  const [result, setResult] = useState<{context:typeof context;packet:ConvertedSourcePacket|null;failed?:boolean}|null>(null);
  const [notice, setNotice] = useState<{context:typeof context;text:string}|null>(null), [busy,setBusy] = useState(false);
  const t = (en:string,ru:string) => locale === "en" ? en : ru;
  useLayoutEffect(() => { committed.current=context; return () => {committed.current=null;}; }, [context]);
  useEffect(() => {
    if (!draft.classification?.tags.includes("converted-example")) return;
    let cancelled=false;
    void import("./converted-source-packet").then(api=>api.buildConvertedSourcePacket(draft)).then(packet=>{if(!cancelled)setResult({context,packet});}).catch(()=>{if(!cancelled)setResult({context,packet:null,failed:true});});
    return () => {cancelled=true;};
  },[context,draft]);
  const active=result?.context===context?result:null, packet=active?.packet;
  if (!draft.classification?.tags.includes("converted-example")) return null;
  async function download(format:"md"|"json") {
    if (!authority?.allowed || pending.current || committed.current!==context) return;
    pending.current=true;setBusy(true);
    const current=()=>committed.current===context && Boolean(context.authority?.allowed);
    try {
      const verified=await authority.verify(); if(!current()||!verified())return;
      const api=await import("./converted-source-packet");
      const file=await api.prepareConvertedSourcePacketDownload(draft,format,()=>current()&&verified());
      if(!file||!current()||!verified())return;
      startReportDownload(new Blob([file.content],{type:file.mime}),file.filename);
      setNotice({context,text:t("Reference-packet download started. This does not record evidence acceptance.","Скачивание эталонного пакета начато. Принятие доказательств не фиксируется.")});
    } catch {if(current())setNotice({context,text:t("Packet export could not be prepared. Your case is unchanged; try again.","Экспорт не подготовлен. Дело не изменено; повторите попытку.")});}
    finally {pending.current=false;setBusy(false);}
  }
  async function jump(id:string) {
    const api=await import("./converted-source-packet");
    if(committed.current!==context)return;
    if(!root.current||!api.openConvertedMessageFragment(root.current,id))setNotice({context,text:t("The exact message section is unavailable. No substitute was opened.","Точный фрагмент сообщения недоступен. Другой источник не открыт.")});
  }
  return <section ref={root} className={styles.block} aria-labelledby="converted-packet-title">
    <h3 id="converted-packet-title">{t("Converted case reference packet","Эталонный пакет преобразованного дела")}</h3>
    <p>{t("Original fictional messages are distinct from the missing external document bodies. Opening availability in a simulation is not an uploaded file or human acceptance. Later messages remain hypothetical and unreceived.","Исходные вымышленные сообщения отличаются от отсутствующих полных документов. Доступность в симуляции не означает загрузку файла или принятие человеком. Поздние сообщения остаются гипотетическими и не считаются полученными.")}</p>
    {!active ? <p role="status">{t("Preparing exact-version packet…","Подготовка пакета точной версии…")}</p> : !packet ? <p role="status">{active.failed?t("Packet could not be loaded. Reopen Sources to retry; your case is unchanged.","Пакет не загружен. Откройте источники повторно; дело не изменено."):t("No supported packet for this exact template reference. Existing records stay readable; no newer source material has been substituted.","Для точного шаблона нет поддерживаемого пакета. Записи доступны для чтения; новые материалы не подставлены.")}</p> : <>
      <p>{t(`${packet.messages.length} retained fictional messages · ${packet.missingDocuments.length} document bodies not supplied`, `Вымышленных сообщений: ${packet.messages.length} · отсутствует полных документов: ${packet.missingDocuments.length}`)}</p>
      <p className={styles.muted}>{packet.workingContentChanged?t("This working case differs from its declared template; reassess relationships. Matching text is not accepted evidence.","Рабочее дело отличается от шаблона; пересмотрите связи. Совпадение текста не означает принятие доказательства."):t("Reference content matches the declared template. Professional review remains unrecorded.","Эталонное содержание совпадает с шаблоном. Профессиональная проверка не зафиксирована.")}</p>
      {packet.messages.length ? <><details><summary>{t("Message and exact-section index","Указатель сообщений и точных фрагментов")}</summary><ul className={styles.records}>{packet.messages.map(message=><li key={message.id}><button type="button" onClick={()=>void jump(message.fragmentId)}>{message.citation} — {message.title}</button></li>)}</ul></details>{packet.messages.map(message=><details className={styles.source} key={message.id}><summary>{message.title} · {message.status==="fictional_opening_correspondence"?t("Fictional opening message","Вымышленное начальное сообщение"):t("Hypothetical later message — not received","Гипотетическое позднее сообщение — не получено")}</summary><div className={styles.fragment} id={message.fragmentId} tabIndex={-1}><h4>{message.citation}</h4><p>{t("Sender","Отправитель")}: {message.sender??t("Not supplied","Не указан")}</p><p lang="en" className={styles.preserve}>{message.text}</p><p className={styles.muted}>{t("Exact UTF-8 body SHA-256","SHA-256 точного текста UTF-8")}: <code>{message.contentSha256}</code></p><p>{message.workingRecordState==="body_and_reference_present"?t("Body and reference are present in the working record; acceptance is not recorded.","Текст и ссылка есть в рабочей записи; принятие не зафиксировано."):t("Working body/reference changed or record is missing. Reconcile before relying on it.","Текст или ссылка изменены либо запись отсутствует. Сопоставьте перед использованием.")}</p>{draft.nodes.some(node=>node.id===message.recordId)&&<button type="button" onClick={()=>onNode(message.recordId)}>{t("Inspect related working record","Открыть связанную рабочую запись")}</button>}</div></details>)}</>:<p>{t("No original message bodies were supplied for this source package.","Для этого пакета исходные тексты сообщений не предоставлены.")}</p>}
      <details><summary>{t("Missing document bodies and unsupported passages","Отсутствующие документы и неподтверждённые фрагменты")}</summary><ul className={styles.records}>{packet.missingDocuments.map(document=><li key={document.id}><h4>{document.title}</h4><code>{document.id}</code><p>{t("Original document body and exact supporting passage: not supplied. Fictional source-register availability does not change this absence.","Полный исходный документ и точный подтверждающий фрагмент не предоставлены. Доступность в вымышленном реестре этого не меняет.")}</p>{document.recordExists&&<button type="button" onClick={()=>onNode(document.recordId)}>{t("Inspect source-register record","Открыть запись реестра")}</button>}{document.workingPremises.map(premise=><p key={premise.id}>{premise.state === "present" ? <button type="button" onClick={()=>onNode(premise.id)}>{t("Inspect linked authored premise: ","Открыть связанное авторское основание: ")+(draft.nodes.find(node=>node.id===premise.id)?.title??premise.id)}</button> : <span>{t("Original linked premise missing from working copy: ","Исходное связанное основание отсутствует в рабочей копии: ")}{premise.id}</span>}</p>)}</li>)}</ul></details>
      <div className={styles.auditFilters}><button type="button" disabled={!authority?.allowed||busy} onClick={()=>void download("json")}>{t("Download reference packet (JSON)","Скачать эталонный пакет (JSON)")}</button><button type="button" disabled={!authority?.allowed||busy} onClick={()=>void download("md")}>{t("Download reference packet (Markdown)","Скачать эталонный пакет (Markdown)")}</button></div>
      <p className={styles.muted}>{t("Separate reference artifact, not a Studio import, analytical report or accepted evidence packet. Original source text remains in its authored language.","Отдельный эталонный материал, не файл импорта Studio, аналитический отчёт или принятый пакет доказательств. Исходный текст сохранён на языке автора.")}</p>
    </>}
    {notice?.context===context&&<p role="status">{notice.text}</p>}
  </section>;
}
