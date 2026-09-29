"use client";

import { useRef } from "react";
import { readStudioPromptFile, studioPromptFileError } from "./studio-prompt-file";

export default function CaseMarkdownActions({locale,loadDisabled,exportDisabled,loaded,opened,failed}:{locale:"en"|"ru";loadDisabled:boolean;exportDisabled:boolean;loaded:(value:string)=>void;opened:()=>void;failed:(message:string)=>void}){
  const input=useRef<HTMLInputElement|null>(null);
  async function load(file:File){
    try { loaded(await readStudioPromptFile(file)); }
    catch (error) { failed(studioPromptFileError(error, locale)); }
  }
  async function open(button:HTMLButtonElement){
    button.closest("details")?.removeAttribute("open");
    try{await import("./CaseMarkdownDialog");opened();}
    catch{failed(locale==="en"?"Markdown tools failed. Refresh.":"Модуль Markdown не загрузился. Обновите.");}
  }
  return <>
    <button className="secondary-cta" onClick={()=>input.current?.click()} disabled={loadDisabled}>{locale==="en"?"Import case prompt (.md)":"Импорт промпта кейса (.md)"}</button>
    <button className="secondary-cta markdown-export-action" onClick={(event)=>void open(event.currentTarget)} disabled={exportDisabled}>{locale==="en"?"Export Final case prompt (.md)":"Экспорт Final case prompt (.md)"}</button>
    <input ref={input} className="visually-hidden" type="file" accept=".md,text/markdown,text/plain" onChange={(event)=>{const file=event.target.files?.[0];if(file)void load(file);event.target.value="";}}/>
  </>;
}
