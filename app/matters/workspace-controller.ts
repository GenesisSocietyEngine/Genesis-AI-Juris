import { WorkingNotesController } from "./working-notes-controller";
import { buildMatterActionCollection, enterActionQueue, resolveExactAction, type ActionCollection, type ExactActionFailure, type QueueState } from "./action-collection";
import { DispositionRecoveryController } from "./disposition-recovery-controller";
import type { MatterActionTarget } from "./matter-actions";
import { loadWorkspaceData, object, WorkspaceApiError, workspaceIssue, type WorkspaceBundle } from "./workspace-data";
import { normalizeActivity, normalizeAnchors, normalizeAssertions, normalizeRequests, type ApiIssue, type MatterDestination } from "./matter-view-model";

export type WorkspaceIdentity = { actorId: string; organizationId: string };
export type Visit = WorkspaceIdentity & { caseId: string; generation: number };
type State = { visit: Visit | null; authority: "checking" | "granted" | "session_expired" | "case_denied" | "account_changed"; bundle: WorkspaceBundle | null; loading: boolean; updating: boolean; issue: ApiIssue | null; notice: string; destination: MatterDestination; target: MatterActionTarget | null; targetActive: boolean; targetNotice: string; targetIssue: ExactActionFailure | null; targetLoading: boolean; queue: QueueState | null; collection: ActionCollection; panel: DispositionRecoveryController | null; panelOpen: boolean; mutationKey: string | null; returnFocus: number; notebookOpen: boolean };
type Options = { identity: WorkspaceIdentity; transport: (path: string, init?: RequestInit) => Promise<Response>; newKey?: () => string };
const unavailable = (): ActionCollection => ({ availability: "unavailable", actions: [], total: 0 });
const aborted = () => new DOMException("Obsolete workspace response", "AbortError");

/** The actual workspace owner. UI panels borrow state from this object; they
 * cannot own or replace an unresolved server operation when they unmount. */
export class WorkspaceController {
  private state: State = { visit: null, authority: "checking", bundle: null, loading: false, updating: false, issue: null, notice: "", destination: "overview", target: null, targetActive: false, targetNotice: "", targetIssue: null, targetLoading: false, queue: null, collection: unavailable(), panel: null, panelOpen: false, mutationKey: null, returnFocus: 0, notebookOpen: false };
  private listeners = new Set<() => void>();
  private generation = 0;
  private authorityEpoch = 0;
  private readEpoch = 0;
  private targetEpoch = 0;
  private mutationEpoch = 0;
  private active = true;
  private notebook: WorkingNotesController | null = null;
  private reviews = new Map<string, DispositionRecoveryController>();
  private reviewOrigins = new Map<string, { target: MatterActionTarget; queue: QueueState | null }>();
  private denied = new Set<string>();
  private draftValues = new Map<string, string | boolean>();
  private draftInitial = new Map<string, string | boolean>();
  private attachments = 0;
  private departureLocked = false;
  setDepartureLocked(value:boolean) {this.departureLocked=value;this.publish({});}
  attach() {
    this.active = true; const attachment = ++this.attachments;
    return () => { queueMicrotask(() => { if (this.attachments === attachment) this.dispose(); }); };
  }
  rememberDraft(key: string, value: string | boolean, initial?: string | boolean) {
    if (!this.draftInitial.has(key) && initial !== undefined) this.draftInitial.set(key, initial);
    if (this.draftInitial.has(key) && value === this.draftInitial.get(key)) this.draftValues.delete(key);
    else this.draftValues.set(key, value);
  }
  draft(key: string) { return this.draftValues.get(key); }
  clearDrafts() { this.draftValues.clear(); this.draftInitial.clear(); }
  departureRisk(): "clear" | "dirty" | "pending" {
    const reviews = [...this.reviews.values()].map(review => review.getSnapshot());
    if (this.busy || this.notebook?.pending || reviews.some(s => s.operation && !s.receipt && !["validation", "conflict", "resource_denied", "case_denied"].includes(s.phase))) return "pending";
    return this.notebook?.dirty || this.draftValues.size || reviews.some(s => !s.receipt && s.draft && (s.draft.reason !== "" || s.draft.support !== "" || s.draft.status !== "completed")) ? "dirty" : "clear";
  }
  reviewBeforeLeaving() {
    if (this.notebook?.pending) { this.notebook.selectPending(); this.openNotes(); return; }
    const pending = [...this.reviews.entries()].find(([, review]) => { const s = review.getSnapshot(); return s.operation && !s.receipt; });
    if (pending) void this.openReview(pending[0].startsWith("deadline:") ? "deadline" : "citation", pending[1].scope.recordId);
  }
  revokeAuthority() { this.denyCase(true); }
  retainedReviews() { return [...this.reviews.entries()].filter(([, review]) => Boolean(review.getSnapshot().operation || review.getSnapshot().receipt)); }
  constructor(readonly options: Options) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(patch: Partial<State>) { if (!this.active) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  capture() { return { visit: this.state.visit, authorityEpoch: this.authorityEpoch }; }
  current(ticket: ReturnType<WorkspaceController["capture"]>) { return this.active && ticket.visit === this.state.visit && ticket.authorityEpoch === this.authorityEpoch && !["case_denied", "account_changed"].includes(this.state.authority); }
  private clearNotebook() { this.notebook?.dispose(); this.notebook = null; }
  workingNotes() {
    const visit = this.state.visit;
    if (!visit || this.state.authority !== "granted") return null;
    if (!this.notebook) {
      this.notebook = new WorkingNotesController({ scope: visit, newKey: this.options.newKey,
        read: (path, init) => this.response(path, init),
        authorize: async () => { if (this.state.visit !== visit) return false; await this.load(); return this.state.visit === visit && this.state.authority === "granted" && !this.state.issue; },
        canWrite: () => this.state.visit === visit && this.state.authority === "granted" && !this.departureLocked && Boolean(this.state.bundle?.matter.permissions.canWrite),
        onExpired: () => { if (this.state.visit === visit) this.suspendAuthority(); },
        onDenied: () => { if (this.state.visit === visit) this.denyCase(); },
      });
      this.notebook.subscribe(() => { if (this.state.visit === visit) this.publish({}); });
    }
    return this.notebook;
  }
  private clearReviews() { this.reviews.forEach(review => review.dispose()); this.reviews.clear(); this.reviewOrigins.clear(); }
  dispose() { this.clearNotebook(); this.clearReviews(); this.active = false; this.generation++; this.authorityEpoch++; this.listeners.clear(); }
  enterFromCatalogue(caseId: string) {
    // Check at the actual transition, after asynchronous creation/list delivery.
    if (this.state.visit && this.state.visit.caseId !== caseId && (this.notebook?.dirty || this.notebook?.pending)) {
      this.publish({notice:"The case list is updated. Save, discard or recover your current notes before opening another case."});
      return false;
    }
    this.enter(caseId); return true;
  }
  enter(caseId: string) {
    if (this.state.visit?.caseId === caseId && this.state.authority !== "case_denied") return;
    this.clearNotebook(); this.clearReviews(); this.denied.clear(); this.clearDrafts(); this.authorityEpoch++; this.readEpoch++; this.targetEpoch++; this.mutationEpoch++;
    const visit = { ...this.options.identity, caseId, generation: ++this.generation };
    this.publish({ visit, notebookOpen: false, authority: "checking", bundle: null, queue: { ...enterActionQueue(null, visit.organizationId, caseId), generation: visit.generation }, collection: unavailable(), destination: "overview", target: null, targetActive: false, targetNotice: "", targetIssue: null, targetLoading: false, panel: null, panelOpen: false, mutationKey: null, notice: "", issue: null, loading: true, updating: false });
  }
  private denyCase(account = false) {
    this.authorityEpoch++; this.readEpoch++; this.targetEpoch++; this.mutationEpoch++; this.clearNotebook(); this.clearReviews(); this.clearDrafts(); this.denied.clear();
    this.publish({ authority: account ? "account_changed" : "case_denied", bundle: null, collection: unavailable(), queue: null, target: null, targetActive: false, targetNotice: "", panel: null, panelOpen: false, targetIssue: null, targetLoading: false, mutationKey: null, loading: false, updating: false, notice: "", issue: null });
  }
  suspendAuthority() {
    if (!this.active || this.state.authority === "session_expired") return;
    this.authorityEpoch++; this.readEpoch++; this.targetEpoch++; this.mutationEpoch++;
    this.publish({ authority: "session_expired", loading: false, updating: false, targetLoading: false, targetNotice: "", mutationKey: null, notice: "", issue: null });
    this.notebook?.suspend();
    this.reviews.forEach(review => review.suspendAuthority());
  }
  async response(path: string, init: RequestInit = {}, ticket = this.capture()): Promise<Response> {
    if (!this.current(ticket)) throw aborted();
    const url = new URL(path, "https://workspace.invalid");
    url.searchParams.set("organization", this.options.identity.organizationId);
    const response = await this.options.transport(url.pathname + url.search, { ...init, credentials: "same-origin", cache: "no-store", headers: { ...Object.fromEntries(new Headers(init.headers)), "x-genesis-organization": this.options.identity.organizationId } });
    if (!this.current(ticket)) throw aborted();
    if (response.status === 401) this.suspendAuthority();
    return response;
  }
  async request(path: string, init: RequestInit = {}, ticket = this.capture()): Promise<unknown> {
    const response = await this.response(path, init, ticket);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (["/api/organizations", "/api/dossiers"].includes(path.split("?")[0]) && [403, 404].includes(response.status) && this.current(ticket)) this.denyCase(true);
      if (ticket.visit && path.split("?")[0] === "/api/dossiers/" + encodeURIComponent(ticket.visit.caseId) && [403, 404].includes(response.status) && this.current(ticket)) this.denyCase();
      throw new WorkspaceApiError(response.status, payload);
    }
    if (!this.current(ticket)) throw aborted();
    return payload;
  }
  private async verifyIdentity(ticket = this.capture()) {
    const payload = object(await this.request("/api/organizations", {}, ticket));
    const selected = object(payload.selected);
    if (selected.actorId !== this.options.identity.actorId || selected.selection !== this.options.identity.organizationId || selected.status !== "active") { if (this.current(ticket)) this.denyCase(true); throw aborted(); }
  }
  private install(bundle: WorkspaceBundle) {
    // A broad list response cannot restore an exact record that was denied.
    if (this.denied.size) bundle = { ...bundle, complete: false,
      requests: bundle.requests.filter(r => !this.denied.has("request-" + r.id)),
      deadlines: bundle.deadlines.filter(r => !this.denied.has("deadline-" + r.id)),
      matter: { ...bundle.matter, anchors: bundle.matter.anchors.filter(r => !this.denied.has("source-" + r.id)), assertions: bundle.matter.assertions.filter(r => !this.denied.has("assertion-" + r.id)) },
    };
    let collection = buildMatterActionCollection(bundle.matter, bundle.snapshots, bundle.outputs, bundle.requests, bundle.documents);
    if (this.denied.size) collection = { ...collection, actions: collection.actions.filter(a => !this.denied.has(a.target.requestId ? "request-" + a.target.requestId : a.target.id)) };
    if (!bundle.complete) collection = { ...collection, availability: "unavailable" };
    this.publish({ bundle, collection, authority: "granted", issue: null });
    this.notebook?.resume();
  }
  async load(initial?: unknown, propagate = false) {
    if (!this.state.visit || !this.active || ["case_denied", "account_changed"].includes(this.state.authority)) return;
    const ticket = this.capture(), loadId = ++this.readEpoch;
    this.publish({ loading: !this.state.bundle, updating: Boolean(this.state.bundle), issue: null, collection: { ...this.state.collection, availability: "outdated" } });
    try {
      await this.verifyIdentity(ticket);
      const bundle = await loadWorkspaceData(ticket.visit!.caseId, (path, init) => this.request(path, init, ticket), initial);
      if (!this.current(ticket) || loadId !== this.readEpoch) { if (propagate) throw aborted(); return; }
      this.install(bundle);
      if (propagate && this.state.collection.availability !== "current") throw new Error("The saved review is recorded, but complete current actions could not be loaded");
    } catch (error) {
      if (this.current(ticket) && loadId === this.readEpoch) this.publish({ issue: workspaceIssue(error), collection: { ...this.state.collection, availability: "unavailable" } });
      if (propagate) throw error;
    } finally { if (this.current(ticket) && loadId === this.readEpoch) this.publish({ loading: false, updating: false }); }
  }
  setQueue(patch: Partial<Pick<QueueState, "filter" | "showAll" | "selectedKey" | "scrollAnchor">>) { if (this.state.queue) this.publish({ queue: { ...this.state.queue, ...patch } }); }
  // Keep target-qualified form drafts and origin links across manual section
  // changes; only an active target may drive URL selection, focus or its notice.
  openNotes() { this.targetEpoch++; this.publish({notebookOpen:true,destination:"documents",panelOpen:false,target:null,targetActive:false,targetNotice:"",targetLoading:false,targetIssue:null}); }
  closeNotes() { this.publish({notebookOpen:false}); }
  navigate(destination: MatterDestination) { this.targetEpoch++; this.publish({ destination, targetActive: false, targetNotice: "", panelOpen: false, targetLoading: false, targetIssue: null }); }
  returnToActions() { this.targetEpoch++; this.publish({ destination: "overview", targetActive: false, targetNotice: "", panelOpen: false, targetLoading: false, targetIssue: null, returnFocus: this.state.returnFocus + 1 }); }
  setTargetNotice(target: MatterActionTarget, notice: string) {
    if (this.state.authority !== "granted" || !this.state.targetActive || this.state.target !== target || this.state.destination !== target.destination || this.state.targetNotice === notice) return;
    this.publish({ targetNotice: notice });
  }
  setNotice(notice: string) { this.publish({ notice }); }
  setIssue(issue: ApiIssue | null) { this.publish({ issue }); }
  private resourceDenied(target: MatterActionTarget | null) {
    // Remove all cached private sections while authority is re-established.
    // Other review operations stay memory-only; the denied form clears itself.
    if (target) this.denied.add(target.requestId ? "request-" + target.requestId : target.id);
    this.notebook?.suspend(); this.clearDrafts(); this.authorityEpoch++; this.readEpoch++; this.mutationEpoch++;
    this.publish({ authority: "checking", bundle: null, collection: unavailable(), target: this.state.target, targetNotice: "", targetLoading: false, mutationKey: null, loading: false, updating: false });
  }
  async openReview(kind: "deadline" | "citation", recordId: string) {
    const visit = this.state.visit;
    if (!visit || this.state.authority !== "granted" || this.state.mutationKey) return;
    const key = kind + ":" + recordId;
    let review = this.reviews.get(key);
    if (!review) {
      review = new DispositionRecoveryController({ scope: { ...visit, recordId }, kind, newKey: this.options.newKey,
        read: (url, init) => this.response(url, init),
        onCaseDenied: () => { if (this.state.visit === visit) this.denyCase(); },
        onResourceDenied: () => { if (this.state.visit === visit) this.resourceDenied({ destination: kind === "deadline" ? "requests" : "evidence", id: (kind === "deadline" ? "deadline-" : "source-") + recordId }); },
        onCaseAuthority: async () => { if (this.state.visit === visit) await this.load(); },
        onUpdated: async payload => { if (this.state.visit !== visit) throw aborted(); await this.load(payload, true); },
      });
      this.reviewOrigins.set(key, { target: { ...this.state.target, destination: kind === "deadline" ? "requests" : "evidence", id: (kind === "deadline" ? "deadline-" : "source-") + recordId }, queue: this.state.queue ? { ...this.state.queue } : null });
      this.reviews.set(key, review);
      review.subscribe(() => { if (this.state.visit === visit) this.publish({}); });
    }
    const origin = this.reviewOrigins.get(key)!;
    this.publish({ panel: review, panelOpen: true, targetLoading: false, targetIssue: null, targetNotice: "", target: origin.target, targetActive: true, queue: origin.queue, destination: kind === "deadline" ? "requests" : "evidence" });
    if (review.getSnapshot().phase === "idle") await review.open();
  }
  async open(target: MatterActionTarget) {
    const visit = this.state.visit;
    if (!visit || this.state.authority !== "granted") return;
    const previous = target.originActionKey && target.originActionKey !== this.state.target?.originActionKey ? null : this.state.target;
    const next = { ...target, originActionKey: target.originActionKey ?? previous?.originActionKey, originOutputId: target.originOutputId ?? previous?.originOutputId, originSnapshotId: target.originSnapshotId ?? previous?.originSnapshotId, requestId: target.requestId ?? (target.id === "document-upload" ? previous?.requestId : undefined) };
    if (next.id.startsWith("output-")) { next.originOutputId = next.id.slice(7); next.originSnapshotId = this.state.bundle?.outputs.find(output => output.id === next.originOutputId)?.snapshotId ?? next.originSnapshotId; }
    const ticket = this.capture(), targetId = ++this.targetEpoch;
    this.publish({ target: next, targetActive: true, destination: next.destination, notebookOpen: false, targetNotice: "", targetIssue: null, targetLoading: true, panelOpen: false });
    if (next.originActionKey) this.setQueue({ selectedKey: next.originActionKey });
    if (next.id.startsWith("deadline-") && next.id !== "deadline-register") return this.openReview("deadline", next.id.slice(9));
    if (next.id.startsWith("source-")) {
      const anchor = this.state.bundle?.matter.anchors.find(a => a.id === next.id.slice(7));
      if (!anchor || anchor.reviewState === "accepted" && (anchor.retiredAt || this.state.collection.actions.some(a => a.target.id === next.id && a.reasons.some(r => r.code === "SOURCE_VERSION_STALE")))) return this.openReview("citation", next.id.slice(7));
    }
    const kind: "request" | "assertion" | "anchor" | null = next.requestId ? "request" : next.id.startsWith("assertion-") && next.id !== "assertion-create" ? "assertion" : next.id.startsWith("source-") ? "anchor" : null;
    if (kind) {
      const selection = { ...visit, recordId: kind === "request" ? next.requestId! : next.id.slice(kind === "anchor" ? 7 : 10), kind, originActionKey: next.originActionKey ?? "", originOutputId: next.originOutputId, originSnapshotId: next.originSnapshotId };
      const result = await resolveExactAction(selection, path => this.request(path, {}, ticket), () => this.current(ticket) && targetId === this.targetEpoch);
      if (result.status === "superseded") return;
      if (result.status === "unavailable") {
        this.publish({ targetIssue: result.failure, targetLoading: false });
        if (result.failure.kind === "resource_denied" || result.failure.kind === "not_found") { this.resourceDenied(next); await this.load(); }
        return;
      }
      this.denied.delete(kind === "request" ? "request-" + next.requestId : next.id);
      if (this.state.bundle) {
        const bundle = this.state.bundle;
        if (kind === "request") { const item = normalizeRequests({ requests: [result.record] }).requests[0]; if (item) this.publish({ bundle: { ...bundle, requests: [...bundle.requests.filter(r => r.id !== item.id), item] } }); }
        else if (kind === "anchor") { const item = normalizeAnchors({ source_anchors: [result.record] })[0]; if (item) this.publish({ bundle: { ...bundle, matter: { ...bundle.matter, anchors: [...bundle.matter.anchors.filter(a => a.id !== item.id), item] } } }); }
        else { const item = normalizeAssertions({ assertions: [result.record] })[0]; if (item) this.publish({ bundle: { ...bundle, matter: { ...bundle.matter, assertions: [...bundle.matter.assertions.filter(a => a.id !== item.id), item] } } }); }
      }
    } else if (next.id.startsWith("audit-") && next.id !== "audit-register") {
      try {
        const payload = await this.request(`/api/dossiers/${encodeURIComponent(visit.caseId)}/activity?event_id=${encodeURIComponent(next.id.slice(6))}`, {}, ticket);
        const items = normalizeActivity(payload).items;
        if (!this.current(ticket) || targetId !== this.targetEpoch) return;
        if (items.length !== 1 || items[0].id !== next.id.slice(6)) throw new Error("Unverified audit record");
        if (this.state.bundle) this.publish({ bundle: { ...this.state.bundle, activity: [...this.state.bundle.activity.filter(a => a.id !== items[0].id), items[0]] } });
      } catch (error) { if (this.current(ticket) && targetId === this.targetEpoch) this.publish({ issue: workspaceIssue(error) }); }
    }
    if (this.current(ticket) && targetId === this.targetEpoch) this.publish({ targetLoading: false });
  }
  async createCase(body: Record<string, unknown>) {
    if (this.notebook?.pending || this.notebook?.dirty) { this.openNotes(); this.notebook.selectPending(); this.publish({notice:"Finish recovering, save or discard your working-note draft before creating another case."}); return null; }
    if (this.busy || ["session_expired", "case_denied", "account_changed"].includes(this.state.authority)) return null;
    const ticket = this.capture(), mutation = ++this.mutationEpoch;
    this.publish({ mutationKey: "create", issue: null });
    try { return await this.request("/api/dossiers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, ticket); }
    finally { if (this.current(ticket) && mutation === this.mutationEpoch) this.publish({ mutationKey: null }); }
  }
  async loadMoreActivity() {
    const bundle = this.state.bundle, ticket = this.capture();
    if (!bundle?.activityCursor || this.state.authority !== "granted") return;
    try {
      const payload = await this.request(`/api/dossiers/${encodeURIComponent(bundle.matter.id)}/activity?limit=100&cursor=${encodeURIComponent(bundle.activityCursor)}`, {}, ticket);
      if (!this.current(ticket) || !this.state.bundle) return;
      const page = normalizeActivity(payload);
      this.publish({ bundle: { ...this.state.bundle, activity: [...new Map([...this.state.bundle.activity, ...page.items].map(item => [item.id, item])).values()], activityCursor: page.nextCursor } });
    } catch (error) { if (this.current(ticket)) this.publish({ issue: workspaceIssue(error) }); }
  }
  get busy() { return this.departureLocked || this.state.mutationKey !== null || [...this.reviews.values()].some(r => r.getSnapshot().busy); }
  async mutate(path: string, key: string, init: RequestInit, message: string | ((payload: unknown) => string)) {
    if (this.busy || this.state.authority !== "granted") return false;
    const ticket = this.capture(), mutation = ++this.mutationEpoch, submittedTarget = this.state.target;
    this.publish({ mutationKey: key, issue: null, notice: "" });
    try {
      const payload = await this.request(path, init, ticket);
      if (!this.current(ticket) || mutation !== this.mutationEpoch) return false;
      const confirmedMessage = typeof message === "function" ? message(payload) : message;
      this.clearDrafts(); this.publish({ notice: typeof message === "function" ? confirmedMessage : "Change saved. Updating case actions…" });
      await this.load();
      if (this.current(ticket) && mutation === this.mutationEpoch) this.publish({ notice: this.state.collection.availability === "current" ? confirmedMessage : "Change saved. Update case actions to confirm current readiness." });
      return this.current(ticket) && mutation === this.mutationEpoch;
    } catch (error) {
      if (this.current(ticket) && mutation === this.mutationEpoch) {
        this.publish({ issue: workspaceIssue(error) });
        if (error instanceof WorkspaceApiError && [403, 404].includes(error.status)) { this.resourceDenied(submittedTarget); await this.load(); }
      }
      return false;
    } finally { if (this.current(ticket) && mutation === this.mutationEpoch) this.publish({ mutationKey: null }); }
  }
}
