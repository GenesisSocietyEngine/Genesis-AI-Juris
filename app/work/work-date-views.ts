import { calendarDate, validDate, type EventTiming } from "../matters/practice-scheduling";
export type AgendaPeriod="day"|"week"|"month";
export type DueScope="all"|"overdue"|"today"|"next7"|"undated";
const dateString=(date:Date)=>date.toISOString().slice(0,10);
export function shiftDate(date:string,days:number){if(!validDate(date))throw Error("Choose a valid date.");return dateString(new Date(Date.parse(date)+days*86400000));}
export function agendaRange(anchor:string,period:AgendaPeriod){
  if(!validDate(anchor))throw Error("Choose a valid date.");
  const date=new Date(anchor+"T00:00:00Z");
  if(period==="day")return {start:anchor,end:anchor};
  if(period==="week"){const start=shiftDate(anchor,-((date.getUTCDay()+6)%7));return {start,end:shiftDate(start,6)};}
  const start=anchor.slice(0,7)+"-01";date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);return {start,end:dateString(date)};
}
export function moveAgenda(anchor:string,period:AgendaPeriod,direction:-1|1){
  if(period!=="month")return shiftDate(anchor,direction*(period==="week"?7:1));
  if(!validDate(anchor))throw Error("Choose a valid date.");
  const date=new Date(anchor+"T00:00:00Z");date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+direction);return dateString(date);
}
export function inAgenda(date:string,range:{start:string;end:string}){return date>=range.start&&date<=range.end;}
export function monthDates(anchor:string){
  const month=agendaRange(anchor,"month");
  const start=agendaRange(month.start,"week").start;
  return Array.from({length:42},(_,index)=>{const date=shiftDate(start,index);return {date,inMonth:inAgenda(date,month)};});
}
export function matchesDue(item:{status:string;dueDate:string|null;timing?:EventTiming|null},scope:DueScope,today:string,zone:string){
  const date=calendarDate(item,zone);
  if(scope==="all")return true;
  if(scope==="undated")return !date;
  if(!date)return false;
  if(scope==="overdue")return item.status!=="completed"&&date<today;
  if(scope==="today")return date===today;
  return date>=today&&date<=shiftDate(today,6);
}
