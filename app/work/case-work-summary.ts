import {calendarDate,localAt} from "../matters/practice-scheduling";
import type {PracticeItem} from "../matters/practice-plan";
import type {FirmCase} from "./work-controller";
export function caseWorkSummary(cases:FirmCase[],now:number,zone:string){
 const today=localAt(now,zone).slice(0,10);
 const order=(a:PracticeItem,b:PracticeItem)=>(calendarDate(a,zone)??"9999").localeCompare(calendarDate(b,zone)??"9999")||(a.timing?.start.at??"").localeCompare(b.timing?.start.at??"")||a.id.localeCompare(b.id);
 return cases.map(matter=>{
  const open=matter.plan.items.filter(item=>item.status==="open");
  const overdue=open.filter(item=>item.kind==="task"&&item.dueDate&&item.dueDate<today).length;
  const unassigned=open.filter(item=>!item.assignee).length,undated=open.filter(item=>!calendarDate(item,zone)).length;
  const nextTask=open.filter(item=>item.kind==="task"&&item.dueDate&&item.dueDate>=today).sort(order)[0]??null;
  const nextEvent=open.filter(item=>item.kind==="event"&&(item.timing?Date.parse(item.timing.end.at)>now:Boolean(item.dueDate&&item.dueDate>=today))).sort(order)[0]??null;
  return {id:matter.id,title:matter.title,open:open.length,completed:matter.plan.items.length-open.length,overdue,unassigned,undated,nextTask,nextEvent,needsAttention:overdue+unassigned+undated>0};
 }).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
