"use client";
import { scheduleLabel } from "../matters/practice-scheduling";
import { readableDate } from "./work-presentation";
import { timeGridDays, timeGridSlot, type CalendarEntry } from "./calendar-time-grid";
import styles from "./calendar-time-grid.module.css";

export default function CalendarTimeGrid({anchor,period,zone,locale,items,onSelect}: {
  anchor:string; period:"day"|"week"; zone:string; locale:"en"|"ru"; items:CalendarEntry[]; onSelect:(key:string)=>void;
}) {
  const days=timeGridDays(anchor,period);
  const slots=new Map<string,CalendarEntry[]>();
  for(const item of items)for(const date of days){const hour=timeGridSlot(item,date,zone);if(hour!==null){const key=`${date}:${hour}`;const slot=slots.get(key)??[];slot.push(item);slots.set(key,slot);}}
  const entries=(date:string,hour:number|"all-day")=>(slots.get(`${date}:${hour}`)??[]).map(item=><button type="button" key={`${item.caseId}:${item.id}`} data-kind={item.kind} onClick={()=>onSelect(`${item.caseId}:${item.id}`)}><strong>{item.title}</strong><small>{scheduleLabel(item,zone)}</small><small>{item.caseTitle}</small></button>);
  return <section className={styles.scroll} tabIndex={0} aria-label={locale==="en"?`${period} calendar in ${zone}`:`Календарь: ${zone}`}><table className={styles.grid}><caption>{zone} · {locale==="en"?"Select an item to view details. Events continuing from an earlier day appear at midnight.":"Выберите запись для просмотра. Продолжения событий показаны с полуночи."}</caption><thead><tr><th scope="col">{locale==="en"?"Time":"Время"}</th>{days.map(date=><th scope="col" key={date}>{readableDate(date,locale,{weekday:"short",day:"numeric",month:"short"})}</th>)}</tr></thead><tbody><tr><th scope="row">{locale==="en"?"All day / tasks":"Весь день / задачи"}</th>{days.map(date=><td key={date}>{entries(date,"all-day")}</td>)}</tr>{Array.from({length:24},(_,hour)=><tr key={hour}><th scope="row">{String(hour).padStart(2,"0")}:00</th>{days.map(date=><td key={date}>{entries(date,hour)}</td>)}</tr>)}</tbody></table></section>;
}
