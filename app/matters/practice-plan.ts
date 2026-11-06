import { readTiming, readReminder, readRecurrence, recurrenceDates, shiftReminder, zonedMoment, localAt, type EventTiming, type WorkReminder, type SeriesOccurrence } from "./practice-scheduling";
import type { WorkflowTemplate } from "../work/workflow-templates";
/** Operational work is separate from hypothetical decision-graph consequences. */
export type PracticeItem = {
  id: string; kind: "task" | "event"; title: string; description: string;
  dueDate: string | null; assignee: string | null; priority: "low" | "normal" | "high";
  status: "open" | "completed"; checklist: { title: string; done: boolean }[];
  workflow: string | null; workflowTitle?: string;
  timing?: EventTiming | null; reminder?: WorkReminder | null; series?: SeriesOccurrence;
};
export type PracticePlan = { revision: number; items: PracticeItem[]; schedulingVersion?: 1 };
export const EMPTY_PLAN: PracticePlan = { revision: 0, items: [] };
export function parsePracticePlan(value: unknown): PracticePlan {
  if(!value || typeof value!=="object" || Array.isArray(value))throw new Error("Unsupported work plan.");
  const plan=value as PracticePlan;
  if(Object.keys(plan).some(key=>key!=="revision"&&key!=="items"&&key!=="schedulingVersion") || !Number.isSafeInteger(plan.revision)||plan.revision<0||!Array.isArray(plan.items)||plan.items.length>200)throw new Error("Unsupported work plan.");
  if(plan.schedulingVersion!==undefined && plan.schedulingVersion!==1)throw new Error("Unsupported scheduling version.");
  const ids=new Set<string>();
  for(const item of plan.items){
    if(!item||typeof item.id!=="string"||!item.id||item.id.length>120||ids.has(item.id)||(item.workflow!==null&&(typeof item.workflow!=="string"||item.workflow.length>200)))throw new Error("Unsupported work identity.");
    const {id,workflow,workflowTitle,series,...fields}=item;
    if(series!==undefined){if(!series || typeof series!=="object")throw new Error("Unsupported recurrence identity.");const {id:seriesId,index,anchorDate,...rule}=series;readRecurrence(rule);if(typeof seriesId!=="string"||!seriesId||seriesId.length>120||!Number.isInteger(index)||index<1||index>series.count||!validPracticeDate(anchorDate))throw new Error("Unsupported recurrence identity.");}void workflow; if(workflowTitle!==undefined && (typeof workflowTitle!=="string" || workflowTitle.length>100))throw new Error("Unsupported workflow title.");validatePracticeItem(fields);ids.add(id);
  }
  if(plan.items.some(i=>i.timing||i.reminder||i.series)&&plan.schedulingVersion!==1)throw new Error("Scheduling metadata requires an upgraded work plan.");
  return plan;
}
export function practiceWorkflowLabel(id: string, locale: "en"|"ru" = "en") {
  const template=PRACTICE_WORKFLOWS.find(w=>w.id===id.split(":")[0]);
  return template ? locale==="ru" ? template.id==="intake-v1"?"Приём клиента":"Проверка дела и отчётность" : template.title : id;
}
export const PRACTICE_WORKFLOWS = [
  { id: "intake-v1", title: "Client intake", steps: [
    { title: "Review intake and identify missing information", days: 0, kind: "task" },
    { title: "Confirm scope and responsible team", days: 1, kind: "task" },
    { title: "Kickoff meeting", days: 2, kind: "event" },
    { title: "Prepare initial case plan", days: 3, kind: "task" },
  ] },
  { id: "review-v1", title: "Case review and reporting", steps: [
    { title: "Review documents and outstanding requests", days: 0, kind: "task" },
    { title: "Review AI flow proposals and alternative outcomes", days: 1, kind: "task" },
    { title: "Team review meeting", days: 2, kind: "event" },
    { title: "Prepare outcome report for approval", days: 3, kind: "task" },
  ] },
] as const;
export function validPracticeDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function workflowPreview(templateId: string, anchor: string, configured?: WorkflowTemplate) {
  const template = configured ?? PRACTICE_WORKFLOWS.find(item => item.id === templateId);
  if (!template || !validPracticeDate(anchor)) throw new Error("Choose a workflow and a valid anchor date.");
  return template.steps.map(step => {
    const dueDate = new Date(Date.parse(anchor) + step.days * 86_400_000).toISOString().slice(0, 10);
    if (!validPracticeDate(dueDate)) throw new Error("A step falls outside the supported date range.");
    return { title: step.title, kind: step.kind, dueDate };
  });
}
export function validatePracticeItem(value: unknown): Omit<PracticeItem, "id" | "workflow" | "workflowTitle" | "series"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a task or event.");
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some(key => !["kind", "title", "description", "dueDate", "assignee", "priority", "status", "checklist", "timing", "reminder"].includes(key))) throw new Error("Unsupported work-item field.");
  if (item.kind !== "task" && item.kind !== "event") throw new Error("Choose task or event.");
  if (typeof item.title !== "string" || !item.title.trim() || item.title.length > 240) throw new Error("Enter a title of up to 240 characters.");
  if (typeof item.description !== "string" || item.description.length > 4000) throw new Error("Use up to 4,000 description characters.");
  if (item.dueDate !== null && !validPracticeDate(item.dueDate)) throw new Error("Choose a valid date.");
  if (item.kind === "event" && item.dueDate === null) throw new Error("An all-day event needs a date.");
  if (item.assignee !== null && (typeof item.assignee !== "string" || item.assignee.length > 120)) throw new Error("Choose a case participant.");
  if (!["low", "normal", "high"].includes(String(item.priority)) || !["open", "completed"].includes(String(item.status))) throw new Error("Choose a valid priority and status.");
  if (!Array.isArray(item.checklist) || item.checklist.length > 30 || item.checklist.some(row => !row || typeof row.title !== "string" || !row.title.trim() || row.title.length > 240 || typeof row.done !== "boolean")) throw new Error("Use at most 30 named checklist items.");
  const timing = item.timing == null ? item.timing : readTiming(item.timing);
  const reminder = item.reminder == null ? item.reminder : readReminder(item.reminder);
  if (timing && (item.kind!=="event" || item.dueDate!==timing.start.local.slice(0,10))) throw Error("Timed events need a matching start date; tasks cannot carry event times.");
  return { ...(item.timing!==undefined ? {timing:timing as EventTiming|null} : {}), ...(item.reminder!==undefined ? {reminder:reminder as WorkReminder|null} : {}), kind: item.kind, title: item.title.trim(), description: item.description, dueDate: item.dueDate as string | null, assignee: item.assignee as string | null, priority: item.priority as PracticeItem["priority"], status: item.status as PracticeItem["status"], checklist: item.checklist.map(row => ({title: row.title.trim(), done: row.done})) };
}
export function changePracticePlan(plan: PracticePlan, command: Record<string, unknown>, newId: () => string, configured?: WorkflowTemplate, now = Date.now()): PracticePlan {
  const items = [...plan.items];
  if (command.action === "apply_workflow") {
    if (configured && (configured.archived || configured.id !== command.templateId || configured.version !== command.templateVersion)) throw new Error("Template changed. Refresh and preview it again.");
    const preview = workflowPreview(String(command.templateId), String(command.anchor), configured);
    const workflow = `${command.templateId}${configured ? `@${configured.version}` : ""}:${command.anchor}`;
    if (items.some(item => item.workflow === workflow)) throw new Error("This workflow is already applied for that anchor date.");
    items.push(...preview.map(step => ({ ...step, id: newId(), description: "", assignee: typeof command.assignee === "string" ? command.assignee : null, priority: "normal" as const, status: "open" as const, checklist: [], workflow, ...(configured ? {workflowTitle: configured.title} : {}) })));
  } else if (command.action === "create_series") {
    const item = validatePracticeItem(command.item), rule=readRecurrence(command.recurrence);
    if(item.kind!=="task" || item.status!=="open" || !item.dueDate)throw Error("Recurring tasks must start open with a first due date.");
    const dates=recurrenceDates(item.dueDate,rule), seriesId=newId();
    const generated=dates.map((dueDate,index)=>({...item,id:newId(),dueDate,workflow:null,checklist:item.checklist.map(c=>({...c,done:false})),...(item.reminder?{reminder:shiftReminder(item.reminder,item.dueDate!,dueDate)}:{}),series:{...rule,id:seriesId,index:index+1,anchorDate:item.dueDate!}}));
    items.push(...generated);
  } else if (command.action === "reminder") {
    const index=items.findIndex(item=>item.id===command.id);
    if(index<0 || !items[index].reminder || items[index].status!=="open")throw Error("Choose an open item with a reminder.");
    const previous=items[index].reminder!;
    if(command.reminderAction==="dismiss")items[index]={...items[index],reminder:{...previous,state:"dismissed"}};
    else if(command.reminderAction==="snooze") {
      const at=new Date(Math.ceil(now/60000)*60000+3600000).toISOString(),local=localAt(at,previous.timeZone);
      const earlier=zonedMoment(local,previous.timeZone,"earlier");
      const moment=earlier.at===at?earlier:zonedMoment(local,previous.timeZone,"later");
      items[index]={...items[index],reminder:{...moment,state:"active"}};
    } else throw Error("Choose dismiss or snooze.");
  } else if (command.action === "create") {
    items.push({ ...validatePracticeItem(command.item), id: newId(), workflow: null });
  } else if (command.action === "update") {
    const index = items.findIndex(item => item.id === command.id);
    if (index < 0) throw new Error("This item is not in the current case plan.");
    const validated=validatePracticeItem(command.item);
    if(items[index].series && validated.kind!=="task") throw Error("A recurring task occurrence must remain a task.");
    const input=command.item as Record<string,unknown>;
    for(const field of ["timing","reminder"] as const)if(items[index][field] && !(field in input))throw Error("This item has scheduling details. Use the current editor to preserve or explicitly remove them.");
    items[index] = { ...(items[index].series?{series:items[index].series}:{}), ...validated, id: items[index].id, workflow: items[index].workflow, ...(items[index].workflowTitle ? {workflowTitle:items[index].workflowTitle} : {}) };
  } else throw new Error("Choose a supported work action.");
  if (items.length > 200) throw new Error("This case plan supports up to 200 work items.");
  return { revision: plan.revision + 1, items, ...(plan.schedulingVersion===1 || items.some(i=>i.timing||i.reminder||i.series)?{schedulingVersion:1 as const}:{}) };
}
