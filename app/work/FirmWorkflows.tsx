"use client";
import {useEffect,useRef,useState} from "react";
import {WorkspaceIcon} from "../CaseVantIcon";
import {workspaceDestination} from "../workspace-navigation";
import {scheduleLabel} from "../matters/practice-scheduling";
import type {FirmCase} from "./work-controller";
import {firmWorkflows} from "./firm-workflows";
import styles from "./work.module.css";

export default function FirmWorkflows({cases,loaded,locale,location,zone}:{cases:FirmCase[];loaded:boolean;locale:"en"|"ru";location:string;zone:string}){
 const t=(en:string,ru:string)=>locale==="ru"?ru:en;
 const [query,setQuery]=useState(""),[scope,setScope]=useState("open"),[selected,setSelected]=useState<string|null>(null);
 const pane=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(selected)pane.current?.focus();},[selected]);
 const rows=firmWorkflows(cases,locale).filter(row=>(scope==="all"||(row.completed===row.items.length)===(scope==="completed"))&&[row.title,row.caseTitle,...row.items.map(item=>item.title)].join(" ").toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));
 const current=rows.find(row=>row.key===selected);
 const link=(id:string,section:string)=>workspaceDestination(`/matters?collection=team&dossier=${encodeURIComponent(id)}&section=${section}`,location);
 if(!loaded)return null;
 return <section aria-label={t("Applied workflows","Применённые процессы")}>
  <h2 ref={heading} tabIndex={-1}>{t("Applied workflows","Применённые процессы")}</h2>
  <p className={styles.hint}>{t("Recorded work across accessible cases. Completion reflects saved tasks and events, not predicted case outcomes. Open a case to update work.","Записанная работа в доступных делах. Выполнение отражает сохранённые задачи и события, а не прогноз исхода дела. Откройте дело для изменения работы.")}</p>
  <div className={styles.filters}><label>{t("Search workflow, case or work","Поиск процесса, дела или работы")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t("Workflow status","Статус процесса")}<select value={scope} onChange={e=>setScope(e.target.value)}><option value="open">{t("In progress","В работе")}</option><option value="completed">{t("Completed","Завершены")}</option><option value="all">{t("All","Все")}</option></select></label></div>
  <div className={styles.actions}><button onClick={()=>{setQuery("");setScope("open");setSelected(null);}}><WorkspaceIcon name="clear"/>{t("Clear filters","Сбросить фильтры")}</button></div>
  <p role="status">{t("Workflows","Процессы")}: {rows.length}</p>
  <div className={styles.workPanes}><div className={styles.workResults}><ul className={styles.workList}>{rows.map(row=><li key={row.key}><button className={styles.workRow} aria-pressed={row.key===selected} onClick={()=>setSelected(row.key)}><WorkspaceIcon name="flow"/><span><strong>{row.title}</strong><small>{row.caseTitle}</small></span><span className={styles.rowDate}>{row.completed}/{row.items.length}<small>{t("Completed","Завершено")}</small></span></button></li>)}</ul>{!rows.length&&<p>{t("No matching applied workflows. Apply a reviewed template from a case’s Workflows section.","Нет подходящих процессов. Примените проверенный шаблон в разделе «Процессы» дела.")}</p>}</div>
  <section ref={pane} tabIndex={-1} className={styles.readingPane} data-empty={!current} aria-label={t("Workflow details","Сведения о процессе")}>{current?<><div className={styles.actions}><button onClick={()=>{setSelected(null);heading.current?.focus();}}><WorkspaceIcon name="close"/>{t("Close preview","Закрыть просмотр")}</button></div><h2>{current.title}</h2><a href={link(current.caseId,"workflows")}>{current.caseTitle} · {t("Open workflow","Открыть процесс")}</a><p>{t("Source version","Версия источника")}: {current.version??t("Not recorded","Не указана")} · {t("Anchor date","Опорная дата")}: {current.anchor??t("Not recorded","Не указана")}</p><p>{current.completed}/{current.items.length} {t("completed","завершено")}</p><progress aria-label={t("Recorded completion","Записанное выполнение")} max={current.items.length} value={current.completed}/><ul className={styles.directoryLinks}>{current.items.map(item=><li key={item.id}><a href={link(current.caseId,item.kind==="event"?"calendar":"tasks")}>{item.title}</a><small>{item.status==="completed"?t("Completed","Завершено"):t("Open","Открыто")} · {scheduleLabel(item,zone)||t("No date","Без даты")}</small><small>{cases.find(c=>c.id===current.caseId)?.participants.find(p=>p.id===item.assignee)?.name??(item.assignee?t("Former participant","Бывший участник"):t("Unassigned","Не назначено"))}{item.checklist.length?` · ${item.checklist.filter(c=>c.done).length}/${item.checklist.length} ${t("checklist","пунктов")}`:""}</small></li>)}</ul></>:<p>{t("Select a workflow to inspect generated work.","Выберите процесс для просмотра созданной работы.")}</p>}</section></div>
 </section>;
}
