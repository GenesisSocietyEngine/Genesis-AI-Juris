"use client";

import {useEffect, useState} from "react";
import {workspaceDestination} from "../workspace-navigation";
import {readWithTimeout} from "../read-with-timeout";
import WorkTabs from "./WorkTabs";
import {distinctLabels} from "./work-presentation";
import type {FirmCase} from "./work-controller";
import styles from "./work.module.css";

type Thread = {id:string;caseId:string;caseTitle:string;recipient:string;stamp:string};
type Page = {threads:Thread[];before:number|null};
type Props = {selection:string;auditor:boolean;cases:FirmCase[];locale:"en"|"ru";location:string;onView:(view:string)=>void};

export default function StaffMessages({selection,auditor,cases,locale,location,onView}:Props) {
  const t=(en:string,ru:string)=>locale==="ru"?ru:en;
  const [caseId,chooseCase]=useState("");
  const [pages,setPages]=useState([0]), [revision,refresh]=useState(0);
  const before=pages.at(-1)!;
  const key=JSON.stringify([selection,caseId,before,revision]);
  const [result,setResult]=useState<{key:string;page:Page|null}|null>(null);
  useEffect(()=>{
    if(auditor) return;
    let generation=0;
    async function load() {
      const current=++generation;
      setResult(null);
      if(document.hidden) return;
      const params=new URLSearchParams();
      if(caseId) params.set("case",caseId);
      if(before) params.set("before",String(before));
      try {
        const page=await readWithTimeout(async signal=>{
          const response=await fetch("/api/work/messages?"+params,{signal,credentials:"same-origin",cache:"no-store",headers:{"x-genesis-organization":selection}});
          if(!response.ok) throw Error();
          return await response.json() as Page;
        });
        if(current===generation) setResult({key,page});
      } catch {
        if(current===generation) setResult({key,page:null});
      }
    }
    const reload=()=>{void load();};
    reload();
    window.addEventListener("focus",reload);
    document.addEventListener("visibilitychange",reload);
    return ()=>{generation++;window.removeEventListener("focus",reload);document.removeEventListener("visibilitychange",reload);};
  },[selection,auditor,before,caseId,key]);
  const available=cases.filter(c=>c.canWrite);
  const names=distinctLabels(available.map(c=>({id:c.id,name:c.title})));
  const page=result?.key===key?result.page:undefined;
  return <main className={styles.workspace}>
    <header className={styles.heading}><h1>{t("Messages","Сообщения")}</h1></header>
    <WorkTabs active="messages" locale={locale} location={location} onView={onView}/>
    {auditor?<p>{t("Portal conversations are available to case owners and contributors.","Переписка в портале доступна владельцам дел и участникам с правом редактирования.")}</p>:<>
      <div className={styles.filters}><label>{t("Case","Дело")}<select value={caseId} onChange={e=>{chooseCase(e.target.value);setPages([0]);}}>
        <option value="">{t("All accessible cases","Все доступные дела")}</option>
        {available.map(c=><option value={c.id} key={c.id}>{names.get(c.id)}</option>)}
      </select></label><button onClick={()=>refresh(n=>n+1)}>{t("Refresh","Обновить")}</button></div>
      {page===undefined?<p role="status">{t("Loading conversations…","Загрузка переписки…")}</p>:page===null?<p role="alert">{t("Could not load conversations. Refresh to retry.","Не удалось загрузить переписку. Обновите список.")}</p>:<>
        {page.threads.length===0?<p>{t("No conversations with messages in this view.","В выбранных делах пока нет переписки с сообщениями.")}</p>:
          <ul className={styles.workList}>{page.threads.map(thread=><li key={thread.id}>
            <a className={styles.workRow} href={workspaceDestination("/matters?"+new URLSearchParams({collection:"team",dossier:thread.caseId,section:"portal",conversation:thread.id}),location)}>
              <span><strong>{thread.recipient}</strong><small>{names.get(thread.caseId)??thread.caseTitle}</small></span>
              <time dateTime={thread.stamp}>{new Date(thread.stamp).toLocaleString(locale)}</time>
            </a>
          </li>)}</ul>}
      </>}
      <div className={styles.actions}>
        {pages.length>1&&<button onClick={()=>setPages(p=>p.slice(0,-1))}>{t("Previous page","Предыдущая страница")}</button>}
        {page?.before&&<button onClick={()=>setPages(p=>[...p,page.before!])}>{t("Next page","Следующая страница")}</button>}
      </div>
    </>}
  </main>;
}
