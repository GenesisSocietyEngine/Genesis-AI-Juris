"use client";
import {useRef,useState,type KeyboardEvent} from "react";
import {calendarDays,type EventTiming} from "../matters/practice-scheduling";
import {monthDates} from "./work-date-views";
import styles from "./work.module.css";

type Entry={id:string;caseId:string;title:string;caseTitle:string;dueDate:string|null;timing?:EventTiming|null};
export default function CalendarMonth({anchor,today,zone,locale,items,onDay}:{anchor:string;today:string;zone:string;locale:"en"|"ru";items:Entry[];onDay:(date:string)=>void}){
 const days=monthDates(anchor),first=days.findIndex(day=>day.inMonth),last=days.findLastIndex(day=>day.inMonth);
 const [focused,setFocused]=useState(()=>days.findIndex(day=>day.date===anchor));
 const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const byDay=new Map<string,Entry[]>();
 for(const item of items)for(const date of calendarDays(item,zone)){const group=byDay.get(date)??[];group.push(item);byDay.set(date,group);}
 const labels=Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,10,2+index))));
 const move=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  const target=event.key==="ArrowLeft"?index-1:event.key==="ArrowRight"?index+1:event.key==="ArrowUp"?index-7:event.key==="ArrowDown"?index+7:event.key==="Home"?index-index%7:event.key==="End"?index+6-index%7:null;
  if(target===null)return;event.preventDefault();const next=Math.max(first,Math.min(last,target));setFocused(next);buttons.current[next]?.focus();
 };
 return <section className={styles.month} aria-label={locale==="ru"?"Календарь месяца":"Month calendar"}>
  <p className={styles.hint}>{locale==="ru"?"Выберите день для просмотра записей. Стрелки перемещают фокус; Enter открывает повестку дня.":"Choose a day to see its work. Arrow keys move focus; Enter opens the day's agenda."}</p>
  <div className={styles.monthWeekdays} aria-hidden="true">{labels.map((label,index)=><span key={index}>{label}</span>)}</div>
  <div className={styles.monthDays}>{days.map(({date,inMonth},index)=>{const entries=byDay.get(date)??[],countLabel=locale==="ru"?`Записей: ${entries.length}`:`${entries.length} ${entries.length===1?"item":"items"}`;return <button key={date} ref={element=>{buttons.current[index]=element;}} type="button" disabled={!inMonth} tabIndex={index===focused?0:-1} className={styles.monthDay} aria-current={date===today?"date":undefined} aria-label={`${date}, ${countLabel}`} onFocus={()=>setFocused(index)} onKeyDown={event=>move(event,index)} onClick={()=>onDay(date)}>
   <span className={styles.dayNumber}>{Number(date.slice(-2))}</span>{inMonth&&<><small>{countLabel}</small>{entries.slice(0,2).map(item=><span className={styles.dayEntry} key={`${item.caseId}:${item.id}`} title={`${item.title} · ${item.caseTitle}`}>{item.title}</span>)}{entries.length>2&&<small>+{entries.length-2}</small>}</>}
  </button>;})}</div>
 </section>;
}
