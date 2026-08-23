"use client";

import { useEffect, useState } from "react";
import { buildCaseMarkdown, type CaseMarkdownLanguage, type CaseMarkdownStatus } from "./case-markdown";
import type { StudioDraft } from "./types";

export default function CaseMarkdownDialog({locale,draft,close,completed}:{locale:"en"|"ru";draft:StudioDraft;close:()=>void;completed:()=>void}){
  const [status,setStatus]=useState<CaseMarkdownStatus>("final");
  const [language,setLanguage]=useState<CaseMarkdownLanguage>(locale);
  const [markdown,setMarkdown]=useState("");
  const [fingerprint,setFingerprint]=useState("");
  const [error,setError]=useState("");
  const [copyState,setCopyState]=useState("");

  useEffect(()=>{
    let cancelled=false;
    void buildCaseMarkdown(draft,{status,language}).then((result)=>{
      if(!cancelled){setMarkdown(result.markdown);setFingerprint(result.fingerprint);setError("");}
    }).catch(()=>{if(!cancelled)setError(locale==="en"?"The canonical Markdown could not be generated.":"Не удалось создать канонический Markdown.");});
    return()=>{cancelled=true;};
  },[draft,language,locale,status]);

  async function copyMarkdown(){
    try{await navigator.clipboard.writeText(markdown);setCopyState(locale==="en"?"Copied.":"Скопировано.");}
    catch{setCopyState(locale==="en"?"Copy failed; download the file instead.":"Не удалось скопировать; скачайте файл.");}
  }
  function downloadMarkdown(){
    const url=URL.createObjectURL(new Blob([markdown],{type:"text/markdown;charset=utf-8"}));
    const link=document.createElement("a");
    link.href=url;
    link.download=`${draft.caseId||"case"}-v${draft.version||"0"}-${status}.md`;
    link.click();
    URL.revokeObjectURL(url);
    completed();
  }

  return <div className="case-report-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)close();}}>
    <section className="case-report-dialog case-markdown-dialog" role="dialog" aria-modal="true" aria-labelledby="case-markdown-title">
      <header><div><span>{locale==="en"?"PORTABLE CASE SPECIFICATION · MD":"ПЕРЕНОСИМАЯ СПЕЦИФИКАЦИЯ КЕЙСА · MD"}</span><h2 id="case-markdown-title">{locale==="en"?"Polished case description":"Структурированное описание кейса"}</h2></div><button type="button" onClick={close} aria-label={locale==="en"?"Close Markdown export":"Закрыть экспорт Markdown"}>×</button></header>
      <p>{locale==="en"?"A professional, human-readable brief plus a compressed canonical manifest. Re-entering the complete file in Studio reconstructs the same graph and fingerprint without AI reinterpretation.":"Профессиональное описание для чтения и сжатый канонический манифест. Повторный ввод полного файла в Studio восстанавливает ту же схему и отпечаток без повторной AI-интерпретации."}</p>
      <div className="case-report-grid">
        <label><span>{locale==="en"?"Document status":"Статус документа"}</span><select value={status} onChange={(event)=>setStatus(event.target.value as CaseMarkdownStatus)}><option value="amended">{locale==="en"?"Amended":"Уточнённый"}</option><option value="final">{locale==="en"?"Final reviewed":"Финальный проверенный"}</option></select></label>
        <label><span>{locale==="en"?"Output language":"Язык документа"}</span><select value={language} onChange={(event)=>setLanguage(event.target.value as CaseMarkdownLanguage)}><option value="en">English</option><option value="ru">Русский</option></select></label>
      </div>
      <div className="case-markdown-meta"><span>{markdown.length.toLocaleString()} {locale==="en"?"characters":"символов"}</span><code>{fingerprint||"…"}</code></div>
      {error?<p className="case-report-error" role="alert">{error}</p>:<textarea className="case-markdown-preview" readOnly value={markdown} aria-label={locale==="en"?"Generated Markdown case description":"Созданное Markdown-описание кейса"}/>}
      <aside className="case-report-status"><b>{locale==="en"?"Deterministic hand-off":"Детерминированная передача"}</b><span>{locale==="en"?"Narrative edits outside Studio do not alter the embedded case. For canonical amendments, import, edit in Studio and regenerate.":"Правки текста вне Studio не меняют встроенный кейс. Для канонических изменений импортируйте файл, отредактируйте кейс в Studio и создайте файл заново."}</span></aside>
      <footer>
        <button className="secondary-cta" type="button" onClick={close}>{locale==="en"?"Cancel":"Отмена"}</button>
        <button className="secondary-cta" type="button" disabled={!markdown} onClick={()=>void copyMarkdown()}>{locale==="en"?"Copy Markdown":"Копировать Markdown"}</button>
        <button className="primary-cta" type="button" disabled={!markdown} onClick={downloadMarkdown}>{locale==="en"?"Download .md":"Скачать .md"}</button>
      </footer>
      {copyState&&<p className="case-markdown-copy" role="status">{copyState}</p>}
    </section>
  </div>;
}
