"use client";

import { useRef } from "react";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";

export default function CaseMarkdownActions({locale,loadDisabled,exportDisabled,loaded,opened,failed}:{locale:"en"|"ru";loadDisabled:boolean;exportDisabled:boolean;loaded:(value:string)=>void;opened:()=>void;failed:(message:string)=>void}){
  const input=useRef<HTMLInputElement|null>(null);
  async function load(file:File){
    if(file.size>STUDIO_PROMPT_CHARACTER_LIMIT*2){failed(locale==="en"?"The Markdown file is too large for one Studio prompt.":"Markdown-файл слишком велик для одного промпта Studio.");return;}
    const value=await file.text();
    if(value.length>STUDIO_PROMPT_CHARACTER_LIMIT){failed(locale==="en"?"The Markdown text exceeds the 64,000-character Studio limit.":"Текст Markdown превышает лимит Studio 64 000 символов.");return;}
    loaded(value);
  }
  async function open(button:HTMLButtonElement){
    button.closest("details")?.removeAttribute("open");
    try{await import("./CaseMarkdownDialog");opened();}
    catch{failed(locale==="en"?"Markdown tools failed. Refresh.":"Модуль Markdown не загрузился. Обновите.");}
  }
  return <>
    <button className="secondary-cta" onClick={()=>input.current?.click()} disabled={loadDisabled}>{locale==="en"?"Import canonical case (.md)":"Импорт канонического кейса (.md)"}</button>
    <button className="secondary-cta markdown-export-action" onClick={(event)=>void open(event.currentTarget)} disabled={exportDisabled}>{locale==="en"?"Export Final case prompt (.md)":"Экспорт Final case prompt (.md)"}</button>
    <input ref={input} className="visually-hidden" type="file" accept=".md,text/markdown,text/plain" onChange={(event)=>{const file=event.target.files?.[0];if(file)void load(file);event.target.value="";}}/>
  </>;
}
