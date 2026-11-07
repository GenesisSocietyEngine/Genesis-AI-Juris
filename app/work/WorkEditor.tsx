"use client";
import { useEffect, useRef } from "react";
import type { WorkController } from "./work-controller";
import SchedulingFields, { schedulingIssue } from "../matters/SchedulingFields";
import styles from "./work.module.css";

export default function WorkEditor({controller,locale}:{controller:WorkController;locale:"en"|"ru"}) {
  const state=controller.getSnapshot(),draft=state.workDraft;
  const returnFocus=useRef<HTMLElement|null>(null);
  const editing=Boolean(draft);
  const dialog=useRef<HTMLDialogElement>(null),title=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(editing){returnFocus.current=document.activeElement as HTMLElement;dialog.current?.showModal();title.current?.focus();}return()=>{if(editing)returnFocus.current?.focus();};},[editing]);
  const t=(en:string,ru:string)=>locale==="en"?en:ru;
  if(!draft)return null;
  const matter=state.cases.find(c=>c.id===draft.caseId);
  const revision=draft.caseId?matter?.plan.revision:state.firmPlan.revision;
  const stale=revision!==draft.expectedRevision;
  const saved=(draft.caseId?matter?.plan:state.firmPlan)?.items.find(i=>i.id===draft.id);
  const disabled=state.saving||state.locked||Boolean(state.workPending)||!state.loaded;
  const update=(patch:Partial<typeof draft.item>)=>controller.updateWork({...draft,item:{...draft.item,...patch}});
  const people=draft.caseId?matter?.participants.filter(p=>p.active)??[]:state.firmMembers;
  const issue=schedulingIssue(draft.item,draft.recurrence);
  return <dialog ref={dialog} className={styles.quickDialog} onCancel={e=>{e.preventDefault();controller.discardWork();}} aria-labelledby="work-editor-title"><form onSubmit={e=>{e.preventDefault();void controller.saveWork();}}><h2 id="work-editor-title">{draft.id?t("Edit work","Изменить запись"):draft.item.kind==="task"?t("Add task","Добавить задачу"):t("Add event","Добавить событие")}</h2>
    <p>{t("Firm work is visible to active organization members. Case work keeps the case’s access rules.","Работа фирмы доступна активным участникам организации. Работа дела сохраняет права доступа дела.")}</p>
    {state.issue&&<p role="alert">{state.issue}</p>}
    {state.workPending&&<div role="status"><p>{t("Save not confirmed. Recover this exact operation before editing.","Сохранение не подтверждено. Восстановите исходную операцию.")}</p><button type="button" disabled={state.saving||state.locked} onClick={()=>void controller.saveWork()}>{t("Recover original save","Восстановить сохранение")}</button></div>}
    {stale&&!state.workPending&&<div role="alert"><p>{t("Saved work changed. Your draft is retained. Review the current record before applying your changes.","Сохранённая работа изменилась. Черновик сохранён. Проверьте текущую запись.")}</p>{saved&&<dl><dt>{t("Saved title","Сохранённое название")}</dt><dd>{saved.title}</dd><dt>{t("Saved date","Сохранённая дата")}</dt><dd>{saved.dueDate??t("No date","Без даты")}</dd><dt>{t("Saved description","Сохранённое описание")}</dt><dd>{saved.description}</dd></dl>}<button type="button" disabled={disabled} onClick={()=>controller.compareWork()}>{t("Compared; use current revision","Проверено; использовать текущую версию")}</button></div>}
    <fieldset className={styles.editorFields} disabled={disabled}>
    <label>{t("Work belongs to","Принадлежность")}<select value={draft.caseId} disabled={Boolean(draft.id)} onChange={e=>{const c=state.cases.find(c=>c.id===e.target.value);controller.updateWork({...draft,caseId:e.target.value,expectedRevision:c?.plan.revision??state.firmPlan.revision,item:{...draft.item,assignee:null}});}}>{state.canWriteFirm&&<option value="">{t("Firm — no case","Фирма — без дела")}</option>}{state.cases.filter(c=>c.canWrite).map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
    <label>{t("Title","Название")}<input ref={title} required maxLength={240} value={draft.item.title} onChange={e=>update({title:e.target.value})}/></label>
    <label>{t("Assigned to","Исполнитель")}<select value={draft.item.assignee??""} onChange={e=>update({assignee:e.target.value||null})}><option value="">{t("Unassigned","Не назначено")}</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>{draft.item.kind==="task"?t("Due date","Срок выполнения"):t("Event date","Дата события")}<input type="date" required={draft.item.kind==="event"} disabled={Boolean(draft.item.timing)} value={draft.item.dueDate??""} onChange={e=>update({dueDate:e.target.value||null})}/></label>
    <label>{t("Priority","Приоритет")}<select value={draft.item.priority} onChange={e=>update({priority:e.target.value as typeof draft.item.priority})}><option value="low">{t("Low","Низкий")}</option><option value="normal">{t("Normal","Обычный")}</option><option value="high">{t("High","Высокий")}</option></select></label>
    <label>{t("Status","Статус")}<select value={draft.item.status} onChange={e=>update({status:e.target.value as typeof draft.item.status})}><option value="open">{t("Open","Открыто")}</option><option value="completed">{t("Completed","Завершено")}</option></select></label>
    <label>{t("Description","Описание")}<textarea maxLength={4000} value={draft.item.description} onChange={e=>update({description:e.target.value})}/></label>
    <fieldset><legend>{t("Checklist","Контрольный список")}</legend>{draft.item.checklist.map((entry,index)=><div className={styles.actions} key={index}><input aria-label={`${t("Completed item","Готово")} ${index+1}`} type="checkbox" checked={entry.done} onChange={e=>update({checklist:draft.item.checklist.map((c,i)=>i===index?{...c,done:e.target.checked}:c)})}/><input aria-label={`${t("Checklist item","Пункт")} ${index+1}`} required maxLength={240} value={entry.title} onChange={e=>update({checklist:draft.item.checklist.map((c,i)=>i===index?{...c,title:e.target.value}:c)})}/><button type="button" onClick={()=>update({checklist:draft.item.checklist.filter((_,i)=>i!==index)})}>{t("Remove","Удалить")}</button></div>)}<button type="button" disabled={draft.item.checklist.length>=30} onClick={()=>update({checklist:[...draft.item.checklist,{title:"",done:false}]})}>{t("Add checklist item","Добавить пункт")}</button></fieldset>
    <SchedulingFields item={draft.item} update={update} recurrence={draft.recurrence} setRecurrence={recurrence=>controller.updateWork({...draft,recurrence})} creating={!draft.id} locale={locale}/>
    <div className={styles.actions}><button className={styles.primary} disabled={stale||Boolean(issue)}>{t("Save","Сохранить")}</button><button type="button" onClick={()=>controller.discardWork()}>{t("Cancel","Отмена")}</button></div>
    </fieldset>
  </form></dialog>;
}
