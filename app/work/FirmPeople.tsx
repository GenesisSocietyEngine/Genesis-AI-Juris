"use client";
import {useEffect,useRef,useState} from "react";
import {WorkspaceIcon} from "../CaseVantIcon";
import {workspaceDestination} from "../workspace-navigation";
import type {FirmCase} from "./work-controller";
import {firmPeople,type PersonScope} from "./firm-people";
import styles from "./work.module.css";
import StatusBadge from "../StatusBadge";

export default function FirmPeople({cases,loaded,locale,location}:{cases:FirmCase[];loaded:boolean;locale:"en"|"ru";location:string}){
 const t=(en:string,ru:string)=>locale==="ru"?ru:en;
 const [query,setQuery]=useState(""),[scope,setScope]=useState<PersonScope>("active"),[selected,setSelected]=useState<string|null>(null);
 const pane=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(selected)pane.current?.focus();},[selected]);
 const people=firmPeople(cases,scope).filter(person=>[...person.names,...person.memberships.map(m=>m.caseTitle)].join(" ").toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));
 const current=people.find(person=>person.key===selected);
 if(!loaded)return null;
 return <section aria-label={t("Case people directory","Участники дел")}>
  <h2 ref={heading} tabIndex={-1}>{t("People across your cases","Участники ваших дел")}</h2>
  <p className={styles.hint}>{t("Find recorded participants and their linked cases. Open a case overview to manage its participants.","Найдите участников и связанные дела. Управляйте участниками в обзоре дела.")}</p>
  <div className={styles.filters}><label>{t("Search people or cases","Поиск участника или дела")}<input type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label><label>{t("Participant status","Статус участия")}<select value={scope} onChange={event=>setScope(event.target.value as PersonScope)}><option value="active">{t("Active","Активные")}</option><option value="inactive">{t("Inactive","Неактивные")}</option><option value="all">{t("All","Все")}</option></select></label></div>
  <div className={styles.actions}><button onClick={()=>{setQuery("");setScope("active");setSelected(null);}}><WorkspaceIcon name="clear"/>{t("Clear filters","Сбросить фильтры")}</button></div>
  <p role="status">{t("People","Участники")}: {people.length} · {t("Accessible cases","Доступные дела")}: {cases.length}</p>
  <div className={styles.workPanes}><div className={styles.workResults}><ul className={styles.workList}>{people.map(person=><li key={person.key}><button className={styles.workRow} aria-pressed={person.key===selected} onClick={()=>setSelected(person.key)}><WorkspaceIcon name="people"/><span><strong>{person.names.join(" / ")}</strong><small>{person.memberships[0]?.caseTitle}</small></span><span className={styles.rowDate}>{t("Case memberships","Участие в делах")}: {person.memberships.length}<small>{person.actorId?t("Linked account","Связанный аккаунт"):t("Case-local participant","Участник этого дела")}</small></span></button></li>)}</ul>{!people.length&&<p>{t("No matching people. Try another name, case or participant status.","Нет подходящих участников. Измените имя, дело или статус участия.")}</p>}</div>
  <section ref={pane} tabIndex={-1} className={styles.readingPane} data-empty={!current} aria-label={t("Person details","Сведения об участнике")}>{current?<><div className={styles.actions}><button onClick={()=>{setSelected(null);heading.current?.focus();}}><WorkspaceIcon name="close"/>{t("Close preview","Закрыть просмотр")}</button></div><h2>{current.names.join(" / ")}</h2><p>{t("Names and participation are recorded by each case. Matching names alone are never merged.","Имена и участие указаны в каждом деле. Совпадение имён не объединяет участников.")}</p><ul className={styles.directoryLinks}>{current.memberships.map(m=><li key={JSON.stringify([m.caseId,m.participantId])}><a href={workspaceDestination(`/matters?collection=team&dossier=${encodeURIComponent(m.caseId)}&section=overview`,location)}>{m.caseTitle}</a><small>{m.name} · <StatusBadge tone={m.active?"completed":"neutral"}>{m.active?t("Active participant","Активный участник"):t("Inactive participant","Неактивный участник")}</StatusBadge></small></li>)}</ul></>:<p>{t("Select a person to see their cases.","Выберите участника для просмотра дел.")}</p>}</section></div>
 </section>;
}
