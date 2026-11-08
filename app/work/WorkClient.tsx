"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { workspaceDestination } from "../workspace-navigation";
import { WorkspaceIcon } from "../GenesisNavigation";
import { previewTemplate, type WorkflowTemplate } from "./workflow-templates";
import { WorkController } from "./work-controller";
import { calendarDate, calendarDays, scheduleLabel, reminderDue, localAt, validDate } from "../matters/practice-scheduling";
import { useWorkClock } from "../matters/use-work-clock";
import styles from "./work.module.css";
import CalendarMonth from "./CalendarMonth";
import WorkEditor from "./WorkEditor";
import CalendarTimeGrid from "./CalendarTimeGrid";
import HomeDashboard from "./HomeDashboard";
import WorkTabs from "./WorkTabs";
import StatusBadge from "../StatusBadge";
import WorkReadingPane from "./WorkReadingPane";
import { distinctLabels, readableDate, workState, workStateLabel } from "./work-presentation";
import ContactsWorkspace from "../contacts/ContactsWorkspace";
import type { ContactController } from "../contacts/contact-controller";
import FirmWorkflows from "./FirmWorkflows";
import CaseworkHost from "../casework/Host";
import Register from "../casework/Register";
import FirmCases from "./FirmCases";
import { agendaRange, moveAgenda, inAgenda, matchesDue, type AgendaPeriod, type DueScope } from "./work-date-views";

type Props={controller?:WorkController;contacts?:ContactController};
export default function WorkClient(props:Props){return <CaseworkHost><WorkBody {...props}/></CaseworkHost>;}
function WorkBody({ controller: supplied, contacts }: { controller?: WorkController; contacts?: ContactController }) {
  const navigation = useNavigationController(), session = useNavigationSession();
  const [controller] = useState(() => supplied ?? new WorkController(navigation, (path, init) => fetch(path, init)));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [locale] = useInterfaceLocale(), location = useWorkspaceLocation();
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const selectedView = new URL(location, "https://workspace.invalid").searchParams.get("view");
  const mode = selectedView === "progress" || selectedView === "home" || selectedView === "cases" || selectedView === "workflows" || selectedView === "people" || selectedView === "calendar" || selectedView === "templates" || selectedView === "reminders" ? selectedView : selectedView === "tasks" ? "tasks" : "home";
  const [query, setQuery] = useState(""), [status, setStatus] = useState("open"), [caseId, setCaseId] = useState(""), [person, setPerson] = useState("");
  const [calendarLayout,setCalendarLayout]=useState<"agenda"|"month"|"day"|"week">("month");
  const [agendaDate,setAgendaDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [agendaPeriod,setAgendaPeriod]=useState<AgendaPeriod>("month"),[dueScope,setDueScope]=useState<DueScope>("all"),[sort,setSort]=useState("date");
  const now=useWorkClock();
  const [zoneOverride,setDisplayZone]=useState<string|null>(null),[reminderView,setReminderView]=useState("due");
  const displayZone=zoneOverride??(now===null?"UTC":Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [anchor, setAnchor] = useState("");
  const [selectedWork, setSelectedWork] = useState<string|null>(null);
  const titleInput = useRef<HTMLInputElement>(null), heading = useRef<HTMLHeadingElement>(null), wasEditing = useRef(false);
  const previewPane = useRef<HTMLElement>(null);
  useEffect(()=>{if(selectedWork) previewPane.current?.focus();},[selectedWork]);
  const editorOpen = Boolean(state.draft);
  useEffect(() => controller.attach(), [controller]);
  useEffect(() => { if (editorOpen) titleInput.current?.focus(); else if (wasEditing.current) heading.current?.focus(); wasEditing.current = editorOpen; }, [editorOpen]);
  if (mode === "people") return <ContactsWorkspace supplied={contacts} work={controller} workState={state} />;
  if (session.phase !== "ready" || session.endingSession || session.busy) return null;
  if(mode==="progress") return <Register key={session.selected?.selection} locale={locale} location={location}/>;
  const changeMode = (view: string) => { const url = new URL(window.location.href); url.searchParams.set("view", view); window.history.replaceState(window.history.state, "", url); window.dispatchEvent(new Event("genesis-interface-change")); };
  const period=calendarLayout==="agenda"?agendaPeriod:calendarLayout;
  const today=(now===null?agendaDate:localAt(now,displayZone).slice(0,10)), range=agendaRange(agendaDate,period);
  const resetFilters=()=>{setQuery("");setStatus("open");setCaseId("");setPerson("");setDueScope("all");setSort("date");setSelectedWork(null);};
  const caseItems = state.cases.flatMap(c => c.plan.items.map(item => ({ ...item, caseId: c.id, caseTitle: c.title, participant: c.participants.find(p => p.id === item.assignee) })));
  const all=[...caseItems,...state.firmPlan.items.map(item=>({...item,caseId:"",caseTitle:t("Firm work","Работа фирмы"),participant:state.firmMembers.find(p=>p.id===item.assignee) as typeof caseItems[number]["participant"]}))];
  const people = new Map<string, string>();
  for (const item of all) if (item.participant) people.set(item.participant.actorId ?? item.participant.id, item.participant.name);
  const visible = all.filter(item => (mode!=="tasks"||(item.kind==="task"&&matchesDue(item,dueScope,today,displayZone))) && (status === "all" || item.status === status) && (!caseId || (caseId==="firm"?item.caseId==="":item.caseId===caseId)) && (!person || (person === "unassigned" ? !item.assignee : (item.participant?.actorId ?? item.participant?.id) === person)) && `${item.title} ${item.caseTitle} ${item.description}`.toLowerCase().includes(query.toLowerCase()) && (mode !== "calendar" || calendarDays(item,displayZone).some(date=>inAgenda(date,range))) && (mode !== "reminders" || (item.status==="open"&&item.reminder?.state==="active"&&now!==null&&(reminderView==="due"?reminderDue(item,now):!reminderDue(item,now))))).sort((a,b) => (mode==="tasks"&&sort==="priority"?({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority]):0) || (mode==="reminders"?a.reminder?.at??"":calendarDate(a,displayZone)??"9999").localeCompare(mode==="reminders"?b.reminder?.at??"":calendarDate(b,displayZone)??"9999") || (a.timing?.start.at??"").localeCompare(b.timing?.start.at??"") || a.title.localeCompare(b.title));
  const caseNames = distinctLabels(state.cases.map(c => ({id:c.id,name:c.title})));
  const personNames = distinctLabels([...people].map(([id,name])=>({id,name})));
  const draft = state.draft, disabled = state.saving || state.locked || Boolean(state.pending);
  const currentTemplate = draft?.id ? state.library.templates.find(item => item.id === draft.id) : null;
  const stale = draft && state.loaded && draft.expectedRevision !== state.library.revision;
  let preview: ReturnType<typeof previewTemplate> = [], previewIssue = "";
  try { if (draft && anchor) preview = previewTemplate(draft.template, anchor); } catch (error) { previewIssue = error instanceof Error ? error.message : "Invalid preview."; }
  const selectedItem=visible.find(item=>`${item.caseId}:${item.id}`===selectedWork);
  const caseLink=(item:typeof visible[number])=>workspaceDestination(`/matters?collection=team&dossier=${encodeURIComponent(item.caseId)}&section=${item.kind==="event"?"calendar":"tasks"}`,location);
  const rows = (items: typeof visible) => <ul className={styles.workList}>{items.map(item => {
    const state = workState(item,today,displayZone);
    return <li key={`${item.caseId}:${item.id}`}><button className={styles.workRow} aria-pressed={selectedWork===`${item.caseId}:${item.id}`} onClick={()=>setSelectedWork(`${item.caseId}:${item.id}`)}><span className={styles.itemGlyph} data-kind={item.kind}><WorkspaceIcon name={item.kind==="event"?"calendar":"tasks"}/></span><span><strong>{item.title}</strong><small>{item.caseTitle}</small><span className="cv-badges"><StatusBadge tone={state}>{workStateLabel(state,locale)}</StatusBadge>{item.priority==="high"&&<StatusBadge tone="overdue">{t("High priority","Высокий приоритет")}</StatusBadge>}</span></span><span className={styles.rowDate}>{scheduleLabel(item,displayZone)||t("No date","Без даты")}<small>{item.participant?.name??(item.assignee?t("Former participant","Бывший участник"):t("Unassigned","Не назначено"))}</small></span></button></li>;
  })}</ul>;
  const readingPane=<WorkReadingPane item={selectedItem} paneRef={previewPane} locale={locale} today={today} zone={displayZone} href={selectedItem?.caseId?caseLink(selectedItem):undefined} onClose={()=>{setSelectedWork(null);heading.current?.focus();}}/>;
  const viewTitle = mode==="home"?t("Home","Главная"):mode==="calendar"?t("Calendar","Календарь"):mode==="tasks"?t("Tasks","Задачи"):mode==="cases"?t("Case overview","Обзор дел"):mode==="workflows"?t("Workflows","Процессы"):mode==="reminders"?t("Reminders","Напоминания"):t("Workflow templates","Шаблоны процессов");


  return <main className={styles.workspace}>
    <WorkEditor controller={controller} locale={locale}/>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{session.selected?.name}</p><h1 ref={heading} tabIndex={-1}>{viewTitle}</h1></div><button disabled={state.loading || state.saving || state.locked} onClick={()=>void controller.refresh()}><WorkspaceIcon name="refresh"/>{t("Refresh", "Обновить")}</button></header>
    <div className={styles.actions}>{(mode==="tasks"||mode==="calendar")&&<button disabled={!state.loaded||state.locked||state.saving||Boolean(state.workDraft)||(!state.canWriteFirm&&!state.cases.some(c=>c.canWrite))} onClick={()=>controller.editWork(mode==="calendar"?"event":"task",state.canWriteFirm?"":state.cases.find(c=>c.canWrite)?.id??"")}><WorkspaceIcon name="plus"/>{mode==="calendar"?t("Add event","Добавить событие"):t("Add task","Добавить задачу")}</button>}{selectedItem&&<button disabled={state.locked||state.saving||Boolean(state.workDraft)||(selectedItem.caseId?!state.cases.find(c=>c.id===selectedItem.caseId)?.canWrite:!state.canWriteFirm)} onClick={()=>controller.editWork(selectedItem.kind,selectedItem.caseId,selectedItem)}>{t("Edit selected work","Изменить выбранную запись")}</button>}</div>
    <WorkTabs locale={locale} active={mode} location={location} onView={changeMode}/>
    {state.loading&&<p role="status">{state.loaded?t("Refreshing; showing the last complete view…", "Обновление; показаны последние загруженные данные…"):t("Loading all accessible cases…", "Загрузка всех доступных дел…")}</p>}
    {state.issue&&<p role="alert" className={styles.issue}>{state.issue}</p>}
    {state.notice&&<p role="status">{state.notice}</p>}
    {state.pending&&<div className={styles.issue}><p>{t("A template save is unconfirmed. Recover the original operation before editing again.", "Сохранение шаблона не подтверждено. Восстановите исходную операцию перед редактированием.")}</p><button disabled={state.saving||state.loading||state.locked} onClick={()=>void controller.save()}>{t("Recover original save", "Восстановить сохранение")}</button></div>}
    {mode==="home"?<HomeDashboard firmItems={state.firmPlan.items} onAdd={kind=>controller.editWork(kind,state.canWriteFirm?"":state.cases.find(c=>c.canWrite)?.id??"")} key={session.selected?.selection} cases={state.cases} loaded={state.loaded} loadFailed={Boolean(state.issue)&&!state.loading} now={now} zone={displayZone} locale={locale} location={location} name={session.identity?.displayName??""} onView={(view,due)=>{if(due){resetFilters();setDueScope(due);}changeMode(view);heading.current?.focus();}}/>:mode==="cases"?<FirmCases key={session.selected?.selection} cases={state.cases} loaded={state.loaded} locale={locale} location={location} zone={displayZone} now={now}/>:mode==="workflows"?<FirmWorkflows key={session.selected?.selection} cases={state.cases} loaded={state.loaded} locale={locale} location={location} zone={displayZone}/>:mode!=="templates"?<>{mode==="reminders"&&<><p>{t("Select a task or event to change or dismiss its reminder.","Выберите задачу или событие, чтобы изменить или отключить напоминание.")}</p><label>{t("Reminder inbox","Входящие напоминания")}<select value={reminderView} onChange={e=>setReminderView(e.target.value)}><option value="due">{t("Due now","Наступившие")}</option><option value="upcoming">{t("Upcoming","Предстоящие")}</option></select></label></>}
      <div className={styles.filters}><label>{t("Search work or case", "Поиск задачи или дела")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t("Case", "Дело")}<select value={caseId} onChange={e=>setCaseId(e.target.value)}><option value="">{t("All case and firm work", "Все дела и работа фирмы")}</option><option value="firm">{t("Firm — no case","Фирма — без дела")}</option>{state.cases.map(c=><option key={c.id} value={c.id}>{caseNames.get(c.id)}</option>)}</select></label><label>{t("Assignee", "Исполнитель")}<select value={person} onChange={e=>setPerson(e.target.value)}><option value="">{t("Everyone", "Все")}</option><option value="unassigned">{t("Unassigned", "Не назначено")}</option>{[...people].map(([id])=><option key={id} value={id}>{personNames.get(id)}</option>)}</select></label><label>{t("Status", "Статус")}<select value={status} onChange={e=>setStatus(e.target.value)}><option value="open">{t("Open", "Открыто")}</option><option value="completed">{t("Completed", "Завершено")}</option><option value="all">{t("All", "Все")}</option></select></label>{mode==="tasks"&&<><label>{t("Due date","Срок")}<select value={dueScope} onChange={e=>setDueScope(e.target.value as DueScope)}><option value="all">{t("All dates","Все даты")}</option><option value="overdue">{t("Overdue","Просрочено")}</option><option value="today">{t("Today","Сегодня")}</option><option value="next7">{t("Next 7 days","Ближайшие 7 дней")}</option><option value="undated">{t("No date","Без даты")}</option></select></label><label>{t("Sort by","Сортировка")}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="date">{t("Due date","Срок")}</option><option value="priority">{t("Priority, then date","Приоритет, затем дата")}</option></select></label></>}{mode!=="reminders"&&<><label>{t("Display timezone","Часовой пояс отображения")}<select value={displayZone} onChange={e=>setDisplayZone(e.target.value)}>{[...new Set([displayZone,"UTC","Europe/Paris","Europe/London","America/New_York","Asia/Tokyo",...all.flatMap(i=>i.timing?[i.timing.start.timeZone]:[])])].map(z=><option key={z} value={z}>{z}</option>)}</select></label></>}</div>
      <div className={styles.actions}>
        <button onClick={resetFilters}><WorkspaceIcon name="clear"/>{t("Clear filters","Сбросить фильтры")}</button>
        {mode==="calendar"&&<>
          <div className={styles.actions} role="group" aria-label={t("Calendar navigation","Навигация календаря")}>
            <button aria-label={t("Previous period","Предыдущий период")} onClick={()=>setAgendaDate(moveAgenda(agendaDate,period,-1))}><WorkspaceIcon name="previous"/></button>
            <button onClick={()=>setAgendaDate(today)}><WorkspaceIcon name="today"/>{t("Today","Сегодня")}</button>
            <button aria-label={t("Next period","Следующий период")} onClick={()=>setAgendaDate(moveAgenda(agendaDate,period,1))}><WorkspaceIcon name="next"/></button>
          </div>
          <label>{t("Go to date","Перейти к дате")}<input type="date" value={agendaDate} onChange={e=>{if(validDate(e.target.value))setAgendaDate(e.target.value);}}/></label>
          <strong className={styles.calendarTitle}>{period==="month"?readableDate(agendaDate,locale,{month:"long",year:"numeric"}):period==="day"?readableDate(range.start,locale):`${readableDate(range.start,locale)} — ${readableDate(range.end,locale)}`}</strong>
          <div className={styles.actions} role="group" aria-label={t("Calendar layout","Вид календаря")}>
            <button aria-pressed={calendarLayout==="day"} onClick={()=>setCalendarLayout("day")}>{t("Day","День")}</button>
            <button aria-pressed={calendarLayout==="week"} onClick={()=>setCalendarLayout("week")}>{t("Week","Неделя")}</button>
            <button aria-pressed={calendarLayout==="month"} onClick={()=>setCalendarLayout("month")}><WorkspaceIcon name="grid"/>{t("Month","Месяц")}</button>
            <button aria-pressed={calendarLayout==="agenda"} onClick={()=>setCalendarLayout("agenda")}><WorkspaceIcon name="list"/>{t("Agenda","Повестка")}</button>
          </div>
          {calendarLayout==="agenda"&&<label>{t("Agenda range","Период повестки")}<select value={agendaPeriod} onChange={e=>setAgendaPeriod(e.target.value as AgendaPeriod)}>
            <option value="day">{t("Day","День")}</option><option value="week">{t("Week","Неделя")}</option><option value="month">{t("Month","Месяц")}</option>
          </select></label>}
        </>}
      </div>
      {state.loaded&&<><p className={styles.resultsCount} role="status">{visible.length} {t("matching items", "найдено записей")} · {state.cases.length} {t("accessible cases loaded", "доступных дел загружено")}</p>{mode==="calendar"&&(calendarLayout==="day"||calendarLayout==="week")?<><CalendarTimeGrid anchor={agendaDate} period={calendarLayout} zone={displayZone} locale={locale} items={visible} onSelect={setSelectedWork}/>{selectedItem&&readingPane}</>:mode==="calendar"&&calendarLayout==="month"?<CalendarMonth key={range.start} anchor={agendaDate} today={today} zone={displayZone} locale={locale} items={visible} onDay={date=>{setAgendaDate(date);setCalendarLayout("day");setSelectedWork(null);heading.current?.focus();}}/>:<div className={styles.workPanes}><div className={styles.workResults}>{mode==="calendar"?<><p>{t("Timed events use the display timezone and appear on each day they span. All-day dates stay fixed; undated work remains in Tasks.", "События со временем показаны в выбранном часовом поясе на каждом затронутом дне. Даты задач на весь день фиксированы; задачи без даты остаются в разделе «Задачи».")}</p>{[...new Set(visible.flatMap(i=>calendarDays(i,displayZone).filter(date=>inAgenda(date,range))))].sort().map(date=><section key={date}><h2 className={styles.date}>{readableDate(date,locale,{weekday:"long",day:"numeric",month:"long"})}</h2>{rows(visible.filter(i=>calendarDays(i,displayZone).includes(date)))}</section>)}</>:rows(visible)}{!visible.length&&<p>{t("No matching work. Add work or clear the filters.", "Нет подходящих записей. Откройте дело, чтобы добавить задачи или применить процесс.")}</p>}</div>{readingPane}</div>}</>}
      <p className={styles.hint}>{t("Includes accessible case work and organization-wide firm work. Select an item to edit; refresh for recent changes.", "Показаны только доступные вам дела. Откройте запись для редактирования в деле. Обновите список для получения последних изменений.")}</p>
    </>:<>
      <div className={styles.heading}><p>{t("Reusable steps with calendar-day offsets. Apply a saved version from a case’s Workflows section.", "Повторяемые шаги со смещениями в календарных днях. Примените сохранённую версию в разделе «Процессы» дела.")}</p>{state.canManage&&<button disabled={!state.loaded||disabled||Boolean(draft)} onClick={()=>controller.edit()}><WorkspaceIcon name="plus"/>{t("New template", "Новый шаблон")}</button>}</div>
      {state.loaded&&!state.canManage&&<p>{t("Organization owners and administrators manage templates. Case contributors can apply them.", "Шаблонами управляют владельцы и администраторы организации. Участники с правом изменения дела могут применять их.")}</p>}
      {draft&&<form className={styles.editor} onSubmit={e=>{e.preventDefault();void controller.save();}}><h2>{draft.id?t("Edit template", "Изменить шаблон"):t("New template", "Новый шаблон")}</h2>
        {stale&&<section className={styles.issue}><h3>{t("Templates changed while you were editing", "Шаблоны изменились во время редактирования")}</h3><p>{t("Your draft is retained below. Compare the saved version before continuing.", "Ваш черновик сохранён ниже. Сравните сохранённую версию перед продолжением.")}</p>{currentTemplate&&<><strong>{currentTemplate.title} · v{currentTemplate.version}{currentTemplate.archived?` · ${t("Archived", "В архиве")}`:""}</strong><ol>{currentTemplate.steps.map((s,i)=><li key={i}>{s.title} · {s.kind} · {s.days}</li>)}</ol></>}<button type="button" disabled={disabled} onClick={()=>controller.compare()}>{t("I compared; keep my draft", "Проверено; оставить мой черновик")}</button></section>}
        <fieldset disabled={disabled}><label>{t("Template title", "Название шаблона")}<input ref={titleInput} required maxLength={100} value={draft.template.title} onChange={e=>controller.update({...draft.template,title:e.target.value})}/></label><label className={styles.check}><input type="checkbox" checked={draft.template.archived} onChange={e=>controller.update({...draft.template,archived:e.target.checked})}/>{t("Archive — prevent new applications", "Архив — запретить новые применения")}</label>
          <ol className={styles.steps}>{draft.template.steps.map((step,index)=><li key={index}><label>{t("Step title", "Название шага")} {index+1}<input required maxLength={240} value={step.title} onChange={e=>controller.update({...draft.template,steps:draft.template.steps.map((s,i)=>i===index?{...s,title:e.target.value}:s)})}/></label><label>{t("Type", "Тип")}<select value={step.kind} onChange={e=>controller.update({...draft.template,steps:draft.template.steps.map((s,i)=>i===index?{...s,kind:e.target.value as "task"|"event"}:s)})}><option value="task">{t("Task", "Задача")}</option><option value="event">{t("All-day event", "На весь день")}</option></select></label><label>{t("Days from anchor", "Дней от опорной даты")}<input type="number" min={-3650} max={3650} step={1} required value={Number.isFinite(step.days)?step.days:""} onChange={e=>controller.update({...draft.template,steps:draft.template.steps.map((s,i)=>i===index?{...s,days:e.target.valueAsNumber}:s)})}/></label><div className={styles.actions}><button type="button" aria-label={`${t("Move up", "Вверх")} ${index+1}`} disabled={index===0} onClick={()=>{const steps=[...draft.template.steps];[steps[index-1],steps[index]]=[steps[index],steps[index-1]];controller.update({...draft.template,steps});}}>↑</button><button type="button" disabled={draft.template.steps.length===1} aria-label={`${t("Remove step", "Удалить шаг")} ${index+1}`} onClick={()=>controller.update({...draft.template,steps:draft.template.steps.filter((_,i)=>i!==index)})}>{t("Remove", "Удалить")}</button></div></li>)}</ol>
          <button type="button" disabled={draft.template.steps.length>=30} onClick={()=>controller.update({...draft.template,steps:[...draft.template.steps,{title:"",kind:"task",days:0}]})}>{t("Add step", "Добавить шаг")}</button>
          <label>{t("Preview anchor date", "Опорная дата для предпросмотра")}<input type="date" value={anchor} onChange={e=>setAnchor(e.target.value)}/></label>{previewIssue&&<p role="alert">{previewIssue}</p>}{preview.length>0&&<ol>{preview.map((step,i)=><li key={i}>{step.dueDate} · {step.title}</li>)}</ol>}
          <p className={styles.hint}>{t("Negative offsets schedule before the anchor. These are planning dates, not calculated legal deadlines. Saving a template creates no case work and does not change AI flows or outcome reports.", "Отрицательное смещение — до опорной даты. Это плановые даты, а не расчёт юридических сроков. Сохранение шаблона не создаёт задачи и не меняет ИИ-процессы или отчёты об исходах.")}</p>
          <div className={styles.actions}><button className={styles.primary} disabled={!state.loaded||Boolean(stale)}>{t("Save template version", "Сохранить версию")}</button><button type="button" onClick={()=>controller.discard()}>{t("Discard draft", "Отменить черновик")}</button></div>
        </fieldset></form>}
      {state.loaded&&<ul className={styles.templates}>{state.library.templates.map((template: WorkflowTemplate)=><li key={template.id}><div><strong>{template.title}</strong><div className="cv-badges"><StatusBadge tone={template.archived?"neutral":"completed"}>{template.archived?t("Archived", "В архиве"):t("Available", "Доступен")}</StatusBadge><small>{template.steps.length} {t("steps", "шагов")}</small></div><details><summary>{t("View steps", "Показать шаги")}</summary><ol>{template.steps.map((step,index)=><li key={index}>{step.title} · {step.days>=0?"+":""}{step.days} {t("days", "дней")}</li>)}</ol></details></div>{state.canManage&&<button disabled={disabled||Boolean(draft)} onClick={()=>controller.edit(template)}><WorkspaceIcon name="edit"/>{t("Edit", "Изменить")}</button>}</li>)}</ul>}{state.loaded&&!state.library.templates.length&&<p>{t("No custom templates yet. Built-in workflows remain available in each case.", "Пользовательских шаблонов пока нет. Встроенные процессы доступны в каждом деле.")}</p>}
    </>}
  </main>;
}
