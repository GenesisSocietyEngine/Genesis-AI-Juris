"use client";
import type { PracticeItem } from "./practice-plan";
import { localAt, readReminder, readTiming, recurrenceDates, shiftReminder, zonedMoment, type ClockChoice, type Recurrence, type ZonedMoment } from "./practice-scheduling";
type Fields = Omit<PracticeItem,"id"|"workflow"|"workflowTitle"|"series">;
export function schedulingIssue(item: Fields, recurrence?: Recurrence | null) {
  try {
    if(item.timing)readTiming(item.timing);
    if(item.reminder)readReminder(item.reminder);
    if(recurrence){const dates=recurrenceDates(item.dueDate??"",recurrence);if(item.reminder)dates.forEach(date=>shiftReminder(item.reminder!,item.dueDate!,date));}
    return "";
  } catch(error){return error instanceof Error?error.message:"Review scheduling details.";}
}
function draftMoment(local:string,timeZone:string,choice:ClockChoice):ZonedMoment {
  try{return zonedMoment(local,timeZone,choice);}catch{return {local,timeZone,choice,at:""};}
}
function fromInstant(at:string,timeZone:string) {
  const local=localAt(at,timeZone), earlier=zonedMoment(local,timeZone,"earlier");
  return earlier.at===at?earlier:zonedMoment(local,timeZone,"later");
}
export default function SchedulingFields({item,update,recurrence,setRecurrence,creating,locale}:{item:Fields;update:(patch:Partial<Fields>)=>void;recurrence?:Recurrence|null;setRecurrence:(value:Recurrence|null)=>void;creating:boolean;locale:"en"|"ru"}) {
  const t=(en:string,ru:string)=>locale==="ru"?ru:en;
  const zone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date=()=>item.dueDate??new Date().toISOString().slice(0,10);
  const momentFields=(moment:ZonedMoment,change:(value:ZonedMoment)=>void,prefix:string)=><>
    <label>{prefix}<input type="datetime-local" required value={moment.local} onChange={e=>change(draftMoment(e.target.value,moment.timeZone,moment.choice))}/></label>
    <label>{t("Repeated clock time","Повторное время на часах")} — {prefix}<select value={moment.choice} onChange={e=>change(draftMoment(moment.local,moment.timeZone,e.target.value as ClockChoice))}><option value="reject">{t("Ask if ambiguous","Требовать выбор при неоднозначности")}</option><option value="earlier">{t("Earlier occurrence","Первое вхождение")}</option><option value="later">{t("Later occurrence","Второе вхождение")}</option></select></label>
  </>;
  let dates:string[]=[];try{if(recurrence)dates=recurrenceDates(item.dueDate??"",recurrence);}catch{/* Error is rendered below. */}
  const issue=schedulingIssue(item,recurrence);
  return <fieldset><legend>{t("Scheduling & reminders","Расписание и напоминания")}</legend>
    {item.kind==="event"&&<><label><span><input type="checkbox" checked={Boolean(item.timing)} onChange={e=>{const timeZone=zone();update({timing:e.target.checked?{start:draftMoment(date()+"T09:00",timeZone,"reject"),end:draftMoment(date()+"T10:00",timeZone,"reject")}:null,dueDate:date()});}}/> {t("Timed event","Событие со временем")}</span></label>
      {item.timing&&<><label>{t("Event timezone","Часовой пояс события")}<input required maxLength={100} list="work-timezones" value={item.timing.start.timeZone} onChange={e=>update({timing:{start:draftMoment(item.timing!.start.local,e.target.value,item.timing!.start.choice),end:draftMoment(item.timing!.end.local,e.target.value,item.timing!.end.choice)}})}/></label>
        {momentFields(item.timing.start,start=>update({timing:{...item.timing!,start},dueDate:start.local.slice(0,10)||null}),t("Event start","Начало события"))}
        {momentFields(item.timing.end,end=>update({timing:{...item.timing!,end}}),t("Event end","Конец события"))}
        {item.timing.start.at&&item.timing.end.at&&<p>{t("UTC preview","Предпросмотр UTC")}: {item.timing.start.at} → {item.timing.end.at}</p>}
      </>}
    </>}
    {creating&&item.kind==="task"&&<><label>{t("Repeat task","Повторять задачу")}<select value={recurrence?.frequency??"none"} onChange={e=>setRecurrence(e.target.value==="none"?null:{frequency:e.target.value as Recurrence["frequency"],interval:1,count:4})}><option value="none">{t("Does not repeat","Не повторяется")}</option><option value="daily">{t("Daily","Ежедневно")}</option><option value="weekly">{t("Weekly","Еженедельно")}</option><option value="monthly">{t("Monthly","Ежемесячно")}</option></select></label>
      {recurrence&&<><label>{t("Repeat every (days / weeks / months)","Повторять каждые (дни / недели / месяцы)")}<input type="number" min={1} max={12} required value={Number.isFinite(recurrence.interval)?recurrence.interval:""} onChange={e=>setRecurrence({...recurrence,interval:e.target.valueAsNumber})}/></label><label>{t("Number of occurrences","Количество повторений")}<input type="number" min={2} max={52} required value={Number.isFinite(recurrence.count)?recurrence.count:""} onChange={e=>setRecurrence({...recurrence,count:e.target.valueAsNumber})}/></label><p>{t("Each occurrence is saved as an independent open task with unchecked checklist items. Monthly dates clamp to the month’s last day; the original day is used again in later months.","Каждое повторение сохраняется отдельной открытой задачей с невыполненным контрольным списком. Если дня нет в месяце, используется последний день; следующие месяцы сохраняют исходное число.")}</p><ol aria-label={t("Recurrence preview","Предпросмотр повторений")}>{dates.map(date=><li key={date}>{date}{item.reminder&&<span> · {(()=>{try{return shiftReminder(item.reminder!,item.dueDate!,date).local.replace("T"," ")+` (${item.reminder!.timeZone})`;}catch{return t("Review reminder time","Проверьте время напоминания");}})()}</span>}</li>)}</ol></>}
    </>}
    <label><span><input type="checkbox" checked={Boolean(item.reminder)} onChange={e=>{const timeZone=item.timing?.start.timeZone??zone();update({reminder:e.target.checked?{...draftMoment(date()+"T09:00",timeZone,"reject"),state:"active"}:null});}}/> {t("Shared in-app reminder","Общее напоминание в приложении")}</span></label>
    {item.reminder&&<><label>{t("Reminder timezone","Часовой пояс напоминания")}<input required maxLength={100} list="work-timezones" value={item.reminder.timeZone} onChange={e=>update({reminder:{...draftMoment(item.reminder!.local,e.target.value,item.reminder!.choice),state:item.reminder!.state}})}/></label>
      {momentFields(item.reminder,m=>update({reminder:{...m,state:item.reminder!.state}}),t("Reminder time","Время напоминания"))}
      <label>{t("Reminder state","Состояние напоминания")}<select value={item.reminder.state} onChange={e=>update({reminder:{...item.reminder!,state:e.target.value as "active"|"dismissed"}})}><option value="active">{t("Active","Активно")}</option><option value="dismissed">{t("Dismissed","Отключено")}</option></select></label>
      {item.timing?.start.at&&<button type="button" onClick={()=>update({reminder:{...fromInstant(new Date(Date.parse(item.timing!.start.at)-15*60000).toISOString(),item.timing!.start.timeZone),state:"active"}})}>{t("Set 15 minutes before event","За 15 минут до события")}</button>}
      <p>{t("Shown in the case and firm reminder inbox while the app is open. No email, push or background delivery. Dismiss and snooze affect the shared case reminder.","Показывается в деле и в напоминаниях организации, пока приложение открыто. Без email, push и фоновой отправки. Отключение и отсрочка меняют общее напоминание дела.")}</p>
    </>}
    <datalist id="work-timezones">{["UTC","Europe/Paris","Europe/London","America/New_York","America/Los_Angeles","Asia/Dubai","Asia/Kolkata","Asia/Tokyo","Australia/Sydney"].map(z=><option key={z} value={z}/>)}</datalist>
    {issue&&<p role="alert">{issue}</p>}
  </fieldset>;
}
