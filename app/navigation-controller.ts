import type { ClientOrganization } from "./organization-client";
import { validOrganizationReceipt } from "./organizations/organization-admin-model";
import type { WorkspaceController } from "./matters/workspace-controller";
import { readWithTimeout } from "./read-with-timeout";
import { pendingSignOutMessage, publishSessionBoundary, type SessionBoundary } from "./session-boundary";

export type DepartureRisk = "clear" | "dirty" | "pending";
export type NavigationIdentity = { displayName: string; email: string; authSource: "chatgpt" | "local" };
export type NavigationState = { phase: "checking" | "ready" | "anonymous" | "expired" | "denied" | "error" | "leaving"; identity: NavigationIdentity | null; actorId: string | null; organizations: ClientOrganization[]; selected: ClientOrganization | null; profileRequired: boolean; issue: string; busy: boolean; endingSession: boolean; signOutPending: boolean };
type Guard = { risk: () => DepartureRisk; suspend: () => void; deny: () => void; review?: () => void; lock?: (value:boolean) => void };
type Options = { transport: (path: string, init?: RequestInit) => Promise<Response>; leave: (url: string) => void; clear: (email?: string) => Promise<void> | void };
export type DeparturePlan = { current: () => boolean; commit: () => boolean; cancel?: () => void; target?: string; navigate?: () => void };
type DepartureIntent = (kind:"organization"|"signout"|"link", id:string, plan?:DeparturePlan) => void;
type SessionPayload = { authenticated?:boolean; identity?:NavigationIdentity; actorId?:string|null; organizations?:unknown[]; selected?:ClientOrganization|null; profileRequired?:boolean;selectionIssue?:string|null };
const empty = (): NavigationState => ({ phase: "checking", identity: null, actorId: null, organizations: [], selected: null, profileRequired: false, issue: "", busy: false, endingSession: false, signOutPending: false });

/** One memory-only authority epoch for the rail and the active workspace. */
export class NavigationController {
  private state = empty();
  private epoch = 0;
  authorityVersion = 0;
  private intentVersion = 0;
  beginIntent() { return ++this.intentVersion; }
  intentCurrent(intent: number) { return intent === this.intentVersion; }
  private listeners = new Set<() => void>();
  private guards = new Map<object, Guard>();
  private workspaces = new Set<WorkspaceController>();
  private knownActor: string | null = null;
  private logoutIdentity: NavigationIdentity | null = null;
  private logoutAttempt = false;
  private terminationRequested = false;
  private boundarySuspended = false;
  private pageDepartureApproved = false;
  approvePageDeparture() { this.pageDepartureApproved = true; }
  cancelPageDeparture() { this.pageDepartureApproved = false; }
  warnBeforeUnload() { return !this.terminationRequested && !this.pageDepartureApproved && this.state.phase !== "leaving" && this.risk() !== "clear"; }
  private departureIntent: DepartureIntent | null = null;
  constructor(private options: Options) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(patch: Partial<NavigationState>) { this.state = { ...this.state, ...patch, signOutPending: this.boundarySuspended,
    ...(this.boundarySuspended ? { issue: pendingSignOutMessage("en") } : {}) }; this.listeners.forEach(fn => fn()); }
  capture() { return this.epoch; }
  current(ticket: number) { return ticket === this.epoch; }
  /** A broadcast can only withdraw authority, never establish an identity. */
  sessionBoundary = (phase: SessionBoundary) => {
    if (this.terminationRequested) return;
    const email = this.state.identity?.email ?? this.logoutIdentity?.email;
    this.boundarySuspended = phase === "suspend";
    const deniedPhase = phase === "revoke" ? "denied" : "expired";
    if (this.state.phase === deniedPhase) { this.epoch++; this.authorityVersion++; this.publish({ issue: phase === "revoke" ? "Access changed. Refresh access or reopen your authorized workspace." : pendingSignOutMessage("en") }); }
    else this.invalidate(deniedPhase);
    if (phase === "revoke") void Promise.resolve().then(() => this.options.clear(email)).catch(() => {});
  };
  invalidate(phase: "expired" | "denied") {
    if (this.terminationRequested) return;
    if (this.state.phase === phase) return;
    this.epoch++;
    this.authorityVersion++;
    this.beginIntent();
    this.publish({ ...empty(), phase, issue: phase === "expired" ? "Your session needs verification. Sign in, then refresh access here." : "Access changed. Refresh access or reopen your authorized workspace." });
    this.guards.forEach(g => g.lock?.(false));
    this.guards.forEach(g => phase === "expired" ? g.suspend() : g.deny());
  }
  registerDeparture(handler:DepartureIntent) {this.departureIntent=handler;return()=>{if(this.departureIntent===handler)this.departureIntent=null;};}
  requestDeparture(kind:Parameters<DepartureIntent>[0],id:string,plan?:DeparturePlan) {
    const intent=plan?null:this.beginIntent(), authority=this.authorityVersion;
    const staged=plan??{current:()=>this.intentCurrent(intent!)&&authority===this.authorityVersion,commit:()=>true};
    if(!staged.current()||!this.departureIntent){staged.cancel?.();return;}
    this.departureIntent(kind,id,staged);
  }
  register(key: object, guard: Guard) { this.guards.set(key, guard); return () => { if (this.guards.get(key) === guard) this.guards.delete(key); }; }
  registerWorkspace(owner: WorkspaceController) {
    this.workspaces.add(owner);
    const remove = this.register(owner, { risk: () => owner.departureRisk(), suspend: () => owner.suspendAuthority(), deny: () => owner.revokeAuthority(), review: () => owner.reviewBeforeLeaving(), lock: value=>owner.setDepartureLocked(value) });
    const sync = () => { if(this.state.phase==="leaving")return;const authority = owner.getSnapshot().authority; if (authority === "session_expired") this.invalidate("expired"); else if (authority === "account_changed") this.invalidate("denied"); };
    const stop = owner.subscribe(sync); sync();
    return () => { stop(); remove();this.workspaces.delete(owner); };
  }
  risk(): DepartureRisk { const risks = [...this.guards.values()].map(g => g.risk()); return risks.includes("pending") ? "pending" : risks.includes("dirty") ? "dirty" : "clear"; }
  reviewPending() { this.guards.forEach(g => { if (g.risk() === "pending") g.review?.(); }); }
  async refresh(selection?: string) {
    if (this.terminationRequested || this.boundarySuspended || this.state.busy || this.state.phase === "leaving") return;
    const ticket = ++this.epoch;
    try {
      const { response, data } = await readWithTimeout(async signal => {
        const response = await this.options.transport("/api/workspace-session" + (selection ? "?organization=" + encodeURIComponent(selection) : ""), { credentials: "same-origin", cache: "no-store", signal });
        const data = response.ok ? await response.json() as SessionPayload : null;
        return { response, data };
      });
      if (!this.current(ticket)) return;
      if (response.status === 401) { const returning=Boolean(this.knownActor||this.state.identity);this.invalidate("expired"); if (!returning) this.publish({phase:"anonymous",issue:""}); return; }
      if ([403,404].includes(response.status)) { this.invalidate("denied"); return; }
      if (!response.ok) throw new Error("Session could not be checked. Retry.");
      if (!data || data.authenticated !== true || typeof data.identity?.displayName !== "string" || typeof data.identity?.email !== "string" || !["chatgpt", "local"].includes(data.identity.authSource) || !Array.isArray(data.organizations)) throw new Error("Session could not be checked. Retry.");
      if(data.profileRequired ? data.actorId!==null || data.organizations.length!==0 || data.selected!==null : typeof data.actorId!=="string" || !/^[A-Za-z0-9_-]{20,128}$/.test(data.actorId)) throw new Error("Invalid session identity");
      if (this.knownActor && data.actorId !== this.knownActor) { this.invalidate("denied"); return; }
      const organizations = data.organizations.filter((o):o is ClientOrganization => validOrganizationReceipt(o, data.actorId??""));
      if (organizations.length !== data.organizations.length || data.selected && !validOrganizationReceipt(data.selected, data.actorId??"")) throw new Error("Organization access could not be verified. Retry.");
      const selected = data.selected && organizations.find(o => o.selection === data.selected?.selection) || null;
      if (this.state.selected && !selected) {this.invalidate("denied");return;}
      if (this.state.selected && selected && this.state.selected.selection !== selected.selection) {
        this.invalidate("denied");return;
      }
      if ([...this.workspaces].some(owner=>owner.options.identity.actorId!==data.actorId||owner.options.identity.organizationId!==selected?.selection)) {this.invalidate("denied");return;}
      this.knownActor = data.actorId??null;
      this.logoutIdentity = data.identity;
      this.publish({ phase: "ready", identity: data.identity, actorId: data.actorId??null, organizations, selected, profileRequired: data.profileRequired === true, busy: false,
        issue: data.selectionIssue ? "Choose an available organization to continue." : "" });
    } catch {
      if (!this.current(ticket)) return;
      this.authorityVersion++;
      this.publish({ phase: ["expired", "denied"].includes(this.state.phase) ? this.state.phase : "error", identity: null, organizations: [], selected: null, issue: "Access could not be checked. Retry.", busy: false });
      this.guards.forEach(g => g.suspend());
    }
  }
  async select(id: string, locale: string, discard = false): Promise<DepartureRisk> {
    this.beginIntent();
    if (this.state.busy || this.state.phase !== "ready" || !this.state.actorId) return "clear";
    const target = this.state.organizations.find(o => o.id === id);
    if (!target || target.selection === this.state.selected?.selection) return "clear";
    const risk = this.risk(); if (risk === "pending" || risk === "dirty" && !discard) return risk;
    const actor = this.state.actorId, ticket = ++this.epoch;
    this.guards.forEach(g=>g.lock?.(true));
    this.publish({busy:true,issue:""});
    try {
      const response = await this.options.transport("/api/organizations", {method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({action:"select",organizationId:id})});
      if (!this.current(ticket)) return "clear";
      if (response.status === 401) {this.invalidate("expired");return "clear";}
      const data = await response.json().catch(() => null) as {organization?:unknown}|null;
      if (!this.current(ticket)) return "clear";
      if (!response.ok || !validOrganizationReceipt(data?.organization, actor, id)) throw new Error("Switch could not be confirmed. Your current workspace is unchanged. Retry or refresh organizations.");
      this.publish({...empty(),phase:"leaving",busy:true});
      this.guards.forEach(g=>g.deny());
      await Promise.resolve().then(()=>this.options.clear()).catch(()=>{});
      if(!this.current(ticket))return "clear";
      this.options.leave("/matters?organization="+encodeURIComponent(data.organization.selection)+"&lang="+encodeURIComponent(locale));
    } catch { if (this.current(ticket)) this.publish({busy:false,issue:"Switch could not be confirmed. Your current workspace is unchanged. Retry or refresh organizations."}); }
    finally { if(this.current(ticket))this.guards.forEach(g=>g.lock?.(false)); }
    return "clear";
  }
  /** Termination is independent from departure guards, including an in-flight switch. */
  async signOut(locale: string): Promise<void> {
    if (this.logoutAttempt) return;
    this.logoutAttempt = true;
    this.terminationRequested = true;
    this.beginIntent();
    const identity = this.state.identity ?? this.logoutIdentity;
    this.logoutIdentity = identity;
    const ticket = ++this.epoch;
    this.authorityVersion++;
    this.publish({ ...empty(), phase:"expired", busy:true, endingSession:true });
    publishSessionBoundary("suspend");
    this.guards.forEach(g=>{try{g.lock?.(false);g.suspend();}catch{/* A failing local form must not block session termination. */}});
    try {
      const response = await this.options.transport("/api/auth/logout",{method:"POST",credentials:"same-origin",signal:AbortSignal.timeout(15000)});
      if (!this.current(ticket)) return;
      if (!response.ok) throw new Error("Logout unconfirmed");
      publishSessionBoundary("revoke");
      await Promise.resolve().then(()=>this.options.clear(identity?.email)).catch(()=>{});
      if(!this.current(ticket))return;
      this.publish({...empty(),phase:"leaving",busy:true,endingSession:true});
      this.guards.forEach(g=>{try{g.deny();}catch{/* Private subtree is already hidden. */}});
      const destination="/studio?lang="+encodeURIComponent(locale);
      this.options.leave(identity?.authSource === "local" ? destination : "/signout-with-chatgpt?return_to="+encodeURIComponent(destination));
    } catch {
      if(this.current(ticket))this.publish({phase:"expired",busy:false,endingSession:true,issue:"Sign-out could not be confirmed. Retry."});
    } finally { this.logoutAttempt = false; }
  }
  get canRetrySignOut() { return this.terminationRequested && !this.logoutAttempt && this.state.phase !== "leaving"; }
  get canSignOut() { return Boolean(this.state.identity || this.logoutIdentity || this.terminationRequested); }
}
