import type { NavigationController } from "../navigation-controller";
import { readWithTimeout } from "../read-with-timeout";
import { EMPTY_PLAN, parsePracticePlan, type PracticeItem, type PracticePlan } from "../matters/practice-plan";
import { EMPTY_LIBRARY, readWorkflowLibrary, type WorkflowLibrary, type WorkflowTemplate } from "./workflow-templates";

export type FirmCase = { id: string; title: string; canWrite?: boolean; plan: PracticePlan; participants: { id: string; actorId: string | null; name: string; active: boolean }[] };
export type WorkDraft = { caseId: string; id?: string; expectedRevision: number; item: Omit<PracticeItem,"id"|"workflow"|"workflowTitle"|"series">; recurrence?: import("../matters/practice-scheduling").Recurrence | null };
type Draft = { id?: string; expectedRevision: number; template: Pick<WorkflowTemplate, "title" | "archived" | "steps"> };
type State = { firmPlan: PracticePlan; firmMembers: {id:string;name:string}[]; canWriteFirm: boolean; workDraft: WorkDraft|null; workPending: Record<string,unknown>|null; cases: FirmCase[]; library: WorkflowLibrary; loading: boolean; loaded: boolean; canManage: boolean; issue: string; draft: Draft | null; pending: Record<string, unknown> | null; saving: boolean; locked: boolean; notice: string };
const empty = (): State => ({ firmPlan: EMPTY_PLAN, firmMembers: [], canWriteFirm:false, workDraft:null, workPending:null, cases: [], library: EMPTY_LIBRARY, loading: false, loaded: false, canManage: false, issue: "", draft: null, pending: null, saving: false, locked: false, notice: "" });

/** Memory-only firm view. Publish a complete scan, never partial firm totals. */
export class WorkController {
  private state = empty();
  private listeners = new Set<() => void>();
  private epoch = 0;
  private identity = "";
  private active = true;
  constructor(private navigation: NavigationController, private transport: (path: string, init?: RequestInit) => Promise<Response>) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private context() {
    const s = this.navigation.getSnapshot();
    return s.phase === "ready" && !s.endingSession && !s.busy && s.actorId && s.selected ? { identity: `${s.actorId}:${s.selected.selection}`, scope: `${this.navigation.authorityVersion}:${s.actorId}:${s.selected.selection}`, selection: s.selected.selection } : null;
  }
  private current(epoch: number, scope: string) { return this.active && epoch === this.epoch && scope === this.context()?.scope; }
  private hide(clear: boolean) {
    this.epoch++;
    this.publish({ ...empty(), ...(!clear ? { draft: this.state.draft, pending: this.state.pending, workDraft:this.state.workDraft, workPending:this.state.workPending } : {}) });
  }
  attach() {
    this.active = true;
    const sync = () => {
      const context = this.context();
      if (!context) { this.hide(false); return; }
      if (this.identity && context.identity !== this.identity) this.hide(true);
      this.identity = context.identity;
      if (!this.state.saving) void this.refresh();
    };
    const stop = this.navigation.subscribe(sync);
    const unregister = this.navigation.register(this, { risk: () => this.state.pending || this.state.workPending || this.state.saving ? "pending" : (this.state.draft || this.state.workDraft) ? "dirty" : "clear", suspend: () => this.hide(false), deny: () => this.hide(true), lock: locked => this.publish({ locked }), review: () => this.publish({ notice: this.state.workDraft ? "Review the open work editor and recover its original save." : "Open Workflow templates to review the original save." }) });
    sync();
    return () => { this.active = false; this.epoch++; stop(); unregister(); };
  }
  async refresh() {
    const context = this.context(); if (!context || this.state.saving || this.state.locked) return;
    const epoch = ++this.epoch;
    // Keep the last complete view stable during same-authority focus revalidation.
    this.publish({ loading: true, issue: "" });
    try {
      const headers = { "x-genesis-organization": context.selection };
      const request = async (path: string) => readWithTimeout(async signal => {
        const response = await this.transport(path, { headers, credentials: "same-origin", cache: "no-store", signal });
        if (!response.ok) { if (response.status === 401) this.navigation.invalidate("expired"); if ([403,404].includes(response.status)) this.navigation.invalidate("denied"); throw new Error("Could not load all accessible work. Refresh to retry."); }
        return await response.json() as Record<string, unknown>;
      });
      const [templateData,firmData] = await Promise.all([request("/api/work/templates"),request("/api/work/firm")]);
      if(firmData.scope!==context.selection||!Array.isArray(firmData.members)||firmData.members.some(m=>!m||typeof m.id!=="string"||typeof m.name!=="string"))throw Error("Invalid firm work scope.");
      const firmPlan=parsePracticePlan(firmData.plan);
      const library = readWorkflowLibrary(templateData.library);
      const cases: FirmCase[] = [], ids = new Set<string>(), cursors = new Set<string>();
      let cursor: string | null = null;
      do {
        const page = await request("/api/work" + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
        if (!this.current(epoch, context.scope)) return;
        if (page.scope !== context.selection || !Array.isArray(page.cases) || !(page.nextCursor === null || typeof page.nextCursor === "string")) throw Error("Invalid firm view.");
        for (const item of page.cases as FirmCase[]) {
          if (!item || typeof item.id !== "string" || typeof item.title !== "string" || ids.has(item.id) || !Array.isArray(item.participants) || item.participants.some(p => !p || typeof p.id !== "string" || typeof p.name !== "string" || typeof p.active !== "boolean" || !(p.actorId === null || typeof p.actorId === "string"))) throw Error("Invalid case in firm view.");
          parsePracticePlan(item.plan); ids.add(item.id); cases.push(item);
        }
        cursor = page.nextCursor as string | null;
        if (cursor && (cursors.has(cursor) || cursors.size >= 199)) throw Error("This view is too large or changed during loading. No partial totals are shown.");
        if (cursor) cursors.add(cursor);
      } while (cursor);
      if (this.current(epoch, context.scope)) this.publish({ firmPlan,firmMembers:firmData.members as {id:string;name:string}[],canWriteFirm:firmData.canWrite===true,cases, library, canManage: templateData.canManage === true, loaded: true, loading: false });
    } catch (error) {
      if (this.current(epoch, context.scope)) this.publish({ firmPlan: EMPTY_PLAN, firmMembers: [], canWriteFirm:false, cases: [], loaded: false, loading: false, issue: error instanceof Error ? error.message : "Work unavailable." });
    }
  }
  editWork(kind:"task"|"event",caseId="",item?:PracticeItem) {
    if(!this.context()||!this.state.loaded||this.state.locked||this.state.saving||this.state.workPending||this.state.workDraft||this.state.draft||this.state.pending)return;
    const matter=this.state.cases.find(c=>c.id===caseId);
    if(caseId ? !matter?.canWrite : !this.state.canWriteFirm)return;
    const fields=item?{kind:item.kind,title:item.title,description:item.description,dueDate:item.dueDate,assignee:item.assignee,priority:item.priority,status:item.status,checklist:item.checklist,...(item.timing!==undefined?{timing:item.timing}:{}),...(item.reminder!==undefined?{reminder:item.reminder}:{})}:{kind,title:"",description:"",dueDate:null,assignee:null,priority:"normal" as const,status:"open" as const,checklist:[]};
    this.publish({workDraft:{caseId,...(item?{id:item.id}:{}),expectedRevision:caseId?matter!.plan.revision:this.state.firmPlan.revision,item:fields},issue:""});
  }
  updateWork(draft:WorkDraft) {if(this.state.workDraft&&!this.state.workPending&&!this.state.saving&&!this.state.locked)this.publish({workDraft:draft});}
  discardWork(){if(!this.state.workPending&&!this.state.saving&&!this.state.locked)this.publish({workDraft:null});}
  compareWork(){const d=this.state.workDraft;if(d&&this.state.loaded&&!this.state.workPending&&!this.state.saving&&!this.state.locked)this.publish({workDraft:{...d,expectedRevision:d.caseId?this.state.cases.find(c=>c.id===d.caseId)?.plan.revision??d.expectedRevision:this.state.firmPlan.revision}});}
  async saveWork() {
    const context=this.context(),d=this.state.workDraft;
    if(!context||!d||this.state.saving||this.state.loading||this.state.locked)return false;
    const matter=this.state.cases.find(c=>c.id===d.caseId);
    if(d.caseId?!matter?.canWrite:!this.state.canWriteFirm)return false;
    const command=this.state.workPending??{action:d.id?"update":d.recurrence?"create_series":"create",expectedRevision:d.expectedRevision,operationKey:crypto.randomUUID(),item:d.item,...(d.id?{id:d.id}:d.recurrence?{recurrence:d.recurrence}:{})};
    const epoch=++this.epoch;
    this.publish({workPending:command,saving:true,issue:""});
    try {
      const {response,result}=await readWithTimeout(async signal=>{const response=await this.transport(d.caseId?`/api/dossiers/${encodeURIComponent(d.caseId)}/practice`:"/api/work/firm",{method:"POST",headers:{"Content-Type":"application/json","x-genesis-organization":context.selection},credentials:"same-origin",signal,body:JSON.stringify(command)});return {response,result:await response.json() as Record<string,unknown>};});
      if(!this.current(epoch,context.scope))return false;
      if(!response.ok){if([400,403,404,409].includes(response.status))this.publish({workPending:null});if(response.status===401)this.navigation.invalidate("expired");if([403,404].includes(response.status))this.navigation.invalidate("denied");throw Error(typeof result.error==="string"?result.error:"Save was not confirmed.");}
      if(result.operation!==command.operationKey)throw Error("Save receipt did not match. Recover the original save.");
      parsePracticePlan(result.plan);
      this.publish({workDraft:null,workPending:null,saving:false,notice:"Work saved."});await this.refresh();return true;
    }catch(error){if(this.current(epoch,context.scope))this.publish({issue:error instanceof Error?error.message:"Save not confirmed."});return false;}
    finally{if(this.current(epoch,context.scope))this.publish({saving:false});}
  }
  edit(template?: WorkflowTemplate) {
    if (!this.context() || !this.state.loaded || !this.state.canManage || this.state.draft || this.state.pending || this.state.workDraft || this.state.workPending || this.state.locked) return;
    this.publish({ draft: { ...(template ? { id: template.id } : {}), expectedRevision: this.state.library.revision, template: template ? { title: template.title, archived: template.archived, steps: template.steps.map(s => ({ ...s })) } : { title: "", archived: false, steps: [{ title: "", kind: "task", days: 0 }] } }, notice: "" });
  }
  update(template: Draft["template"]) { if (this.state.draft && !this.state.pending && !this.state.saving && !this.state.locked) this.publish({ draft: { ...this.state.draft, template } }); }
  discard() { if (!this.state.pending && !this.state.saving && !this.state.locked) this.publish({ draft: null }); }
  compare() { if (this.state.draft && this.state.loaded && !this.state.pending && !this.state.locked) this.publish({ draft: { ...this.state.draft, expectedRevision: this.state.library.revision } }); }
  async save() {
    const context = this.context();
    if (!context || this.state.saving || this.state.loading || this.state.locked || !this.state.canManage || !this.state.draft) return false;
    if (!this.state.pending && (!this.state.loaded || this.state.draft.expectedRevision !== this.state.library.revision)) return false;
    const command = this.state.pending ?? { ...this.state.draft, action: this.state.draft.id ? "update" : "create", operationKey: crypto.randomUUID() };
    const epoch = ++this.epoch;
    this.publish({ pending: command, saving: true, issue: "", notice: "" });
    try {
      const {response,result} = await readWithTimeout(async signal => {
        const response = await this.transport("/api/work/templates", { method: "POST", headers: { "Content-Type": "application/json", "x-genesis-organization": context.selection }, credentials: "same-origin", signal, body: JSON.stringify(command) });
        return {response,result:await response.json() as Record<string,unknown>};
      });
      if (!this.current(epoch, context.scope)) return false;
      if (!response.ok) {
        if ([400,403,404,409].includes(response.status)) this.publish({ pending: null });
        if (response.status === 401) this.navigation.invalidate("expired");
        if ([403,404].includes(response.status)) this.navigation.invalidate("denied");
        throw new Error(typeof result.error === "string" ? result.error : "Save not confirmed. Recover the original save.");
      }
      if (result.operation !== command.operationKey) throw Error("Save receipt did not match. Recover the original save.");
      const library = readWorkflowLibrary(result.library);
      this.publish({ library, draft: null, pending: null, saving: false, notice: "Template saved. Existing case work keeps its original version." });
      await this.refresh(); return true;
    } catch (error) {
      if (this.current(epoch, context.scope)) this.publish({ issue: error instanceof Error ? error.message : "Save not confirmed. Recover the original save." });
      return false;
    } finally { if (this.current(epoch, context.scope)) this.publish({ saving: false }); }
  }
}
