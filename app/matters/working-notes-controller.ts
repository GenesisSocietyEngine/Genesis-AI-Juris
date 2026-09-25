import { readWithTimeout } from "../read-with-timeout";
import { canonicalDossierJson } from "../dossier-contract";

export type NoteType = "blank" | "meeting" | "analysis";
export type NoteDraft = { title: string; body: string; type: NoteType };
export type Note = NoteDraft & { id: string; caseId: string; revision: number; savedAt: string; savedBy: string; savedByName?: string; savedByRole: string };
export type NoteSummary = Omit<Note, "body" | "caseId">;
export type NoteScope = Readonly<{ actorId: string; organizationId: string; caseId: string; generation: number }>;
export type NoteReceipt = { id: string; key: string; action: string; caseId: string; noteId: string; revision: number; actor: string; occurredAt: string; requestDigest: string };
type Submission = Readonly<{ body: string; key: string; digest: string; action: "create" | "save"; expectedRevision: number; noteId?: string; draft: Readonly<NoteDraft>; scope: NoteScope }>;
export type NoteEditor = { key: string; draft: NoteDraft; base: Note | null; phase: "editing" | "submitting" | "unknown" | "conflict" | "confirmed" | "validation"; operation: Submission | null; receipt: NoteReceipt | null; conflict: Note | null; message: string; field: string | null; history: NoteSummary[]; historyCursor: number | null; historical: Note | null };
export type NotebookState = { visible: boolean; notes: NoteSummary[]; nextCursor: string | null; loaded: boolean; loading: boolean; issue: string; selected: string | null; editors: Record<string, NoteEditor>; filter: string };
type Options = { scope: NoteScope; read: (path: string, init?: RequestInit) => Promise<Response>; authorize: () => Promise<boolean>; canWrite: () => boolean; onExpired: () => void; onDenied: () => void; timeoutMs?: number; newKey?: () => string };
class NoteError extends Error { constructor(readonly status: number, readonly data: Record<string, unknown>) { super(typeof data.error === "string" ? data.error : "The note request could not be completed."); } }
const record = (x: unknown): Record<string, unknown> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
const types = ["blank", "meeting", "analysis"];
const opaque = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(id);
export function sameNoteContent(a: NoteDraft, b: NoteDraft) { return a.title.trim() === b.title.trim() && a.body === b.body && a.type === b.type; }
export function noteDirty(editor: NoteEditor) { return !editor.base || !sameNoteContent(editor.draft, editor.base); }
export function noteStatus(editor: NoteEditor) {
  if (editor.phase === "unknown") return "Uncertain · recover the original save before submitting again.";
  if (editor.phase === "submitting") return "Saving · any newer typing remains a separate draft.";
  if (editor.phase === "conflict") return "Conflict · compare with the current saved version before saving.";
  if (editor.phase === "validation") return "Not saved · " + editor.message;
  if (noteDirty(editor)) return editor.receipt ? "Earlier version saved; your current draft has unsaved changes." : "Unsaved changes";
  return `Confirmed · saved revision ${editor.base!.revision}`;
}
function noteValue(value: unknown, caseId: string, id?: string): Note {
  const n = record(value);
  if (!opaque(n.id) || id && n.id !== id || n.caseId !== caseId || !Number.isSafeInteger(n.revision) || Number(n.revision) < 1 || typeof n.title !== "string" || typeof n.body !== "string" || !types.includes(String(n.type)) || typeof n.savedBy !== "string" || typeof n.savedAt !== "string") throw new Error("The exact note could not be verified. Retry loading it.");
  return n as Note;
}
export const NOTE_STARTERS: Array<{ id: string; title: string; description: string; draft: NoteDraft }> = [
  { id: "blank", title: "Blank note", description: "Write freely within this case.", draft: { title: "", type: "blank", body: "" } },
  { id: "meeting", title: "Meeting notes", description: "Capture discussion and follow-ups.", draft: { title: "Meeting notes", type: "meeting", body: "## Purpose\n\n## Attendees\n\n## Discussion\n\n## Follow-ups\n- [ ] " } },
  { id: "analysis", title: "Analysis", description: "Separate known facts from open questions.", draft: { title: "Analysis", type: "analysis", body: "## Question\n\n## Evidence considered\n\n## Provisional reasoning\n\n## Open questions\n" } },
  { id: "rationale", title: "Decision rationale", description: "Explain options and provisional reasoning.", draft: { title: "Decision rationale", type: "analysis", body: "## Question\n\n## Options\n\n## Evidence considered\n\n## Provisional reasoning\n\n## Open questions\n" } },
];

/** Owned by the case workspace, never by a mounted editor. Private input is
 * memory-only; operation bytes and identity are immutable until reconciled. */
export class WorkingNotesController {
  private state: NotebookState = { visible: true, notes: [], nextCursor: null, loaded: false, loading: false, issue: "", selected: null, editors: {}, filter: "" };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private readEpoch = 0;
  private listEpoch = 0;
  private active = true;
  private historyEpoch = new Map<string,number>();
  private historyListEpoch = new Map<string,number>();
  private refreshEpoch = new Map<string,number>();
  constructor(readonly options: Options) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(patch: Partial<NotebookState>) { if (!this.active) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private update(key: string, patch: Partial<NoteEditor>) { const e = this.state.editors[key]; if (e) this.publish({ editors: { ...this.state.editors, [key]: { ...e, ...patch } } }); }
  private current(ticket: number) { return this.active && this.state.visible && ticket === this.epoch; }
  private key() { return this.options.newKey?.() ?? crypto.randomUUID(); }
  private path(query = "") { return `/api/dossiers/${encodeURIComponent(this.options.scope.caseId)}/notes${query}`; }
  private async request(query = "", init?: RequestInit) {
    // Bounding the delivery does not prove cancellation or trigger a replay.
    // A write timeout is always reconciled using its original operation.
    return readWithTimeout(async signal => {
      const response = await this.options.read(this.path(query), { ...init, signal });
      const data = record(await response.json().catch(() => null));
      if (!response.ok) throw new NoteError(response.status, data);
      return data;
    }, { timeoutMs: this.options.timeoutMs });
  }
  suspend() {
    this.epoch++; this.readEpoch++; this.listEpoch++;
    const editors = Object.fromEntries(Object.entries(this.state.editors).map(([key,e]) => [key, { ...e, phase: e.phase === "submitting" ? e.operation ? "unknown" : "editing" : e.phase }]));
    this.publish({ visible: false, loading: false, editors });
  }
  resume() { if (this.active && !this.state.visible) { this.epoch++; this.publish({ visible: true }); } }
  dispose() { this.epoch++; this.state = { visible: false, notes: [], nextCursor: null, loaded: false, loading: false, issue: "", selected: null, editors: {}, filter: "" }; this.active = false; this.listeners.clear(); }
  get pending() { return Object.values(this.state.editors).some(e => ["submitting", "unknown"].includes(e.phase)); }
  get dirty() { return Object.values(this.state.editors).some(noteDirty); }
  setFilter(filter: string) { this.publish({ filter }); }
  returnToList() { this.readEpoch++; this.publish({ selected: null, loading: false }); }
  selectPending() { const e = Object.values(this.state.editors).find(e => ["unknown", "submitting"].includes(e.phase)); if (e) this.publish({ selected: e.key }); }
  private async privacy(error: unknown) {
    if (!(error instanceof NoteError)) return false;
    if (error.status === 401) { this.suspend(); this.options.onExpired(); return true; }
    if ([403,404].includes(error.status)) {
      // The private 404 also represents a missing note or receipt. Verify the
      // case before deciding whether to destroy unrelated drafts.
      const ticket=this.epoch;
      try {
        const authorized=await readWithTimeout(()=>this.options.authorize(),{timeoutMs:this.options.timeoutMs});
        if (!this.current(ticket)) return true;
        if (authorized) return false;
      } catch { /* No positive authority: conceal rather than infer deletion. */ }
      if (this.current(ticket)) {this.suspend();this.options.onExpired();}
      return true;
    }
    return false;
  }
  async list(more = false) {
    if (!this.state.visible || !this.active || more && !this.state.nextCursor) return;
    const ticket = this.epoch, request = ++this.listEpoch;
    this.publish({ loading: true, issue: "" });
    try {
      const data = await this.request(more ? "?cursor=" + encodeURIComponent(this.state.nextCursor!) : "");
      if (!this.current(ticket) || request !== this.listEpoch) return;
      if (data.caseId !== this.options.scope.caseId || !Array.isArray(data.notes)) throw new Error("The note list could not be verified.");
      const page = data.notes as NoteSummary[];
      if (page.some(n => !opaque(n.id) || typeof n.title !== "string" || "body" in n)) throw new Error("The note list could not be verified.");
      this.publish({ notes: [...new Map([...(more ? this.state.notes : []), ...page].map(n => [n.id,n])).values()], nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null, loaded: true });
    } catch (error) { if (this.current(ticket) && request === this.listEpoch && !await this.privacy(error)) this.publish({ issue: error instanceof Error ? error.message : "Notes could not be loaded. Retry." }); }
    finally { if (this.current(ticket) && request === this.listEpoch) this.publish({ loading: false }); }
  }
  start(starterId: string) {
    if (!this.state.visible || !this.active || !this.options.canWrite() || this.pending) return;
    const starter = NOTE_STARTERS.find(s => s.id === starterId); if (!starter) return;
    const key = "new:" + this.key();
    const editor: NoteEditor = { key, draft: { ...starter.draft }, base: null, phase: "editing", operation: null, receipt: null, conflict: null, message: "Unsaved · first Save creates this note", field: null, history: [], historyCursor: null, historical: null };
    this.readEpoch++; this.publish({ selected: key, loading: false, editors: { ...this.state.editors, [key]: editor } });
  }
  async open(id: string) {
    if (!this.state.visible || !this.active) return;
    const retained = Object.values(this.state.editors).find(e => e.key === id || e.base?.id === id);
    if (retained) { this.readEpoch++; this.publish({ selected: retained.key, loading: false }); await this.refresh(retained.key); return; }
    const ticket = this.epoch, request = ++this.readEpoch; this.publish({ loading: true, issue: "" });
    try {
      const data = await this.request("?note_id=" + encodeURIComponent(id));
      if (!this.current(ticket) || request !== this.readEpoch) return;
      const note = noteValue(data.note, this.options.scope.caseId, id);
      this.publish({ selected: id, editors: { ...this.state.editors, [id]: { key: id, draft: { title: note.title, body: note.body, type: note.type }, base: note, phase: "editing", operation: null, receipt: null, conflict: null, message: "Saved content · revision " + note.revision, field: null, history: [], historyCursor: null, historical: null } } });
    } catch (error) { if (this.current(ticket) && request === this.readEpoch && !await this.privacy(error)) this.publish({ issue: error instanceof Error ? error.message : "This note is unavailable." }); }
    finally { if (this.current(ticket) && request === this.readEpoch) this.publish({ loading: false }); }
  }
  edit(key: string, change: Partial<NoteDraft>) { if (!this.state.visible || !this.options.canWrite()) return; const e = this.state.editors[key]; this.historyEpoch.set(key,(this.historyEpoch.get(key)??0)+1); if (e) this.update(key, { draft: { ...e.draft, ...change }, historical: null, ...(e.phase === "validation" && e.field && e.field in change ? {phase:"editing" as const,field:null,message:""}: {}) }); }
  discard(key: string) { const e = this.state.editors[key]; if (!e || ["unknown","submitting"].includes(e.phase)) return; const editors = { ...this.state.editors }; delete editors[key]; this.publish({ editors, selected: null }); }
  async save(key: string) {
    const e = this.state.editors[key]; if (!this.active || !this.state.visible || !e || this.pending || !this.options.canWrite() || ["submitting","unknown","conflict"].includes(e.phase)) return;
    if (!e.draft.title.trim() || e.draft.title.trim().length > 200) { this.update(key,{ phase:"validation",field:"title",message:"Enter a title of 1–200 characters." }); return; }
    if (e.draft.body.length > 100000 || e.draft.body.includes("\0")) { this.update(key,{phase:"validation",field:"body",message:"Use up to 100,000 characters without null characters."}); return; }
    const ticket = this.epoch, draft = { ...e.draft }, operationKey = this.key();
    this.update(key,{ phase:"submitting",field:null,message:"Checking access before saving…",operation:null });
    try {
      if (!await readWithTimeout(() => this.options.authorize(), {timeoutMs:this.options.timeoutMs}) || !this.current(ticket)) { if(this.current(ticket)) this.update(key,{phase:"validation",message:"Access could not be verified. Nothing was submitted."}); return; }
      if (!this.options.canWrite()) { this.update(key,{phase:"validation",message:"Your current case role cannot save notes."}); return; }
      const action = e.base ? "save" : "create", expectedRevision = e.base?.revision ?? 0;
      const payload = { action, ...(e.base ? {noteId:e.base.id}:{}), expectedRevision, idempotencyKey:operationKey, ...draft };
      const digest = "sha256-" + Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonicalDossierJson(payload))))).map(b=>b.toString(16).padStart(2,"0")).join("");
      if (!this.current(ticket)) return;
      const operation: Submission = Object.freeze({ body:JSON.stringify(payload),key:operationKey,digest,action,expectedRevision,noteId:e.base?.id,draft:Object.freeze(draft),scope:Object.freeze({...this.options.scope}) });
      this.update(key,{operation,message:"Saving…"}); await this.send(key,operation,ticket);
    } catch (error) { if (this.current(ticket) && !await this.privacy(error)) this.update(key,{phase:"validation",message:"Access could not be verified. Nothing was submitted."}); }
  }
  private async send(key: string, operation: Submission, ticket: number) {
    try { const data = await this.request("",{method:"POST",headers:{"content-type":"application/json"},body:operation.body}); if(this.current(ticket)) await this.confirm(key,operation,data); }
    catch(error) { if(this.current(ticket)) await this.failed(key,error); }
  }
  private async failed(key: string, error: unknown) {
    if (await this.privacy(error)) return;
    if(error instanceof NoteError && error.status===400) { this.update(key,{phase:"validation",field:typeof error.data.field==="string"?error.data.field:null,message:"Save rejected: "+error.message}); return; }
    if(error instanceof NoteError && error.status===409 && error.data.code==="revision_conflict") {
      try { const e=this.state.editors[key]; const current=noteValue(error.data.current,this.options.scope.caseId,e.base?.id); this.update(key,{phase:"conflict",conflict:current,message:"The note changed. Compare versions before saving again."}); return; } catch { /* Unverified content is not installed. */ }
    }
    this.update(key,{phase:"unknown",message:"Save outcome unknown. Recover the original save before submitting again."});
  }
  private async confirm(key: string, op: Submission, data: Record<string, unknown>) {
    const e=this.state.editors[key]; if(!e || e.operation!==op) return;
    const r=record(data.operation), note=noteValue(data.note,this.options.scope.caseId,op.noteId);
    if(r.key!==op.key || r.action!==op.action || r.requestDigest!==op.digest || r.actor!==op.scope.actorId || r.caseId!==op.scope.caseId || r.noteId!==note.id || r.revision!==op.expectedRevision+1 || note.revision!==r.revision || !opaque(r.id) || note.savedBy!==op.scope.actorId || note.savedAt!==r.occurredAt || !sameNoteContent(note,op.draft)) throw new Error("Unverified save receipt");
    this.update(key,{base:note,receipt:r as NoteReceipt,phase:"confirmed",conflict:null,field:null,message:`Saved · revision ${note.revision} · ${note.savedAt}`});
    const {body:_body,caseId:_caseId,...summary}=note; void _body; void _caseId;
    this.publish({notes:[summary,...this.state.notes.filter(n=>n.id!==note.id)]});
    // Refresh is a separate read. Its failure never converts confirmed persistence into a failed write.
    await this.refresh(key);
  }
  async refresh(key: string) {
    const e=this.state.editors[key]; if(!e?.base || !this.state.visible || !this.active || ["submitting","unknown"].includes(e.phase)) return;
    const ticket=this.epoch, request=(this.refreshEpoch.get(key)??0)+1;
    this.refreshEpoch.set(key,request);
    const current=()=>this.current(ticket) && this.refreshEpoch.get(key)===request && this.state.editors[key]?.operation===e.operation && this.state.editors[key]?.base===e.base && !["submitting","unknown"].includes(this.state.editors[key]?.phase);
    try { const data=await this.request("?note_id="+encodeURIComponent(e.base.id)); if(!current())return;
      const latest=noteValue(data.note,this.options.scope.caseId,e.base.id);
      if(latest.revision<Math.max(e.base.revision,this.state.editors[key]?.conflict?.revision??0))return;
      if(latest.revision>e.base.revision) this.update(key,{conflict:latest,phase:"conflict",message:e.receipt ? "Your original save is confirmed. A newer saved version exists; compare before further edits." : "A newer saved version exists; compare it with your draft before further edits."});
      else if(/^(?:Saved; )?latest view unavailable\./i.test(this.state.editors[key]?.message??""))this.update(key,{message:e.receipt?`Saved · original receipt revision ${e.receipt.revision}`:`Saved content · revision ${latest.revision}`});
    }catch(error){if(current()&&!await this.privacy(error)&&current())this.update(key,{message:e.receipt?"Saved; latest view unavailable. Retry the read, not the save.":"Latest view unavailable. Your draft is retained."});}
  }
  async recover(key: string, replay = false) {
    const e=this.state.editors[key]; if(!e?.operation || e.phase!=="unknown" || !this.state.visible || !this.active) return;
    const ticket=this.epoch,op=e.operation; this.update(key,{phase:"submitting",message:"Checking the original save…"});
    try {
      if(!await readWithTimeout(() => this.options.authorize(), {timeoutMs:this.options.timeoutMs}) || !this.current(ticket)) {if(this.current(ticket))this.update(key,{phase:"unknown",message:"Access could not be verified. Original save retained."});return;}
      if(replay) {await this.send(key,op,ticket);return;}
      const data=await this.request("?operation_key="+encodeURIComponent(op.key)); if(this.current(ticket))await this.confirm(key,op,data);
    }catch(error){
      if(!this.current(ticket) || await this.privacy(error))return;
      // A GET error never establishes that the original mutation failed.
      this.update(key,{phase:"unknown",message:error instanceof NoteError&&error.status===404
        ? "No receipt returned yet. The original save may still commit. Check again or resend the identical original operation."
        : "Receipt lookup failed. Your original save is still unresolved; retry recovery."});
    }
  }

  resolveConflict(key: string, useSaved: boolean) { const e=this.state.editors[key]; if(!e?.conflict||!this.state.visible)return;
    this.update(key,{base:e.conflict,draft:useSaved?{title:e.conflict.title,body:e.conflict.body,type:e.conflict.type}:e.draft,conflict:null,phase:"editing",operation:null,message:useSaved?"Saved version selected; local edits discarded.":"Review and edit your merged draft, then explicitly Save against the compared revision."});
  }
  async history(key: string, more = false) {
    const e=this.state.editors[key];if(!e?.base||!this.state.visible)return;const ticket=this.epoch,request=(this.historyListEpoch.get(key)??0)+1;this.historyListEpoch.set(key,request);
    try{const data=await this.request(`?note_id=${encodeURIComponent(e.base.id)}&history=true${more&&e.historyCursor?"&cursor="+e.historyCursor:""}`);if(!this.current(ticket)||this.historyListEpoch.get(key)!==request)return;
      if(data.caseId!==this.options.scope.caseId||data.noteId!==e.base.id||!Array.isArray(data.history)||data.history.some(n=>{const row=record(n);return row.id!==e.base!.id||!Number.isSafeInteger(row.revision)||"body" in row;}))throw new Error("Invalid history");
      this.update(key,{history:[...new Map([...(more?e.history:[]),...data.history as NoteSummary[]].map(row=>[row.revision,row])).values()],historyCursor:typeof data.nextCursor==="number"?data.nextCursor:null});
    }catch(error){if(this.current(ticket)&&this.historyListEpoch.get(key)===request&&!await this.privacy(error)&&this.current(ticket)&&this.historyListEpoch.get(key)===request)this.update(key,{message:"History unavailable. Your draft and any confirmed save are retained."});}
  }
  async historical(key: string, revision: number | null) {
    const e=this.state.editors[key];if(!e?.base||!this.state.visible)return;const selection=(this.historyEpoch.get(key)??0)+1;this.historyEpoch.set(key,selection);if(revision===null){this.update(key,{historical:null});return;}const ticket=this.epoch;
    try{const data=await this.request(`?note_id=${encodeURIComponent(e.base.id)}&revision=${revision}`);if(this.current(ticket)&&this.historyEpoch.get(key)===selection){const n=noteValue(data.note,this.options.scope.caseId,e.base.id);if(n.revision!==revision)throw new Error();this.update(key,{historical:n});}}
    catch(error){if(this.current(ticket)&&this.historyEpoch.get(key)===selection&&!await this.privacy(error))this.update(key,{message:"The selected revision could not be opened. Retry."});}
  }
}
