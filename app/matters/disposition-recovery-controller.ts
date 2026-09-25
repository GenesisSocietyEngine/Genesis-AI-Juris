import { savedOutcomeReceipt, type SavedOutcome } from "./saved-outcome";
import { sameWriteScope, type WriteScope } from "./write-recovery";

export type ReviewRecord = { actor_id: string; kind: "deadline" | "citation"; revision: number; can_review: boolean; readiness_effect: string; unavailable_reason?: string | null; disposition: unknown; record: { id: string; title?: string; dueAt?: string; timezone?: string; excerpt?: string }; dependent_assertions: Array<{ id: string; statement: string; status: string }>; current_output_ids: string[] };
export type ReviewDraft = { reason: string; status: string; support: string };
type Operation = Readonly<{ body: string; key: string; actorId: string }>;
type Purpose = "resource" | "original_operation" | "current_case" | "write";
export type ReviewPhase = "idle" | "editing" | "unknown" | "confirmed" | "updating" | "updated" | "update_failed" | "resource_denied" | "case_denied" | "session_expired" | "validation" | "conflict";
export type ReviewState = { phase: ReviewPhase; busy: boolean; authorityVisible: boolean; requiresSignIn: boolean; resourceBlocked: boolean; record: ReviewRecord | null; draft: ReviewDraft | null; operation: Operation | null; receipt: SavedOutcome | null; message: string; field: string | null; replayEligible: boolean };
type Failure = "case_denied" | "resource_denied" | "session_expired" | "unknown" | "update_failed" | "validation" | "conflict";
const jsonObject = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
function validReadiness(value: Record<string, unknown> | null): boolean {
  if (!value || typeof value.ready !== "boolean" || typeof value.evaluated_at !== "string" || !Number.isFinite(Date.parse(value.evaluated_at)) || !Array.isArray(value.dimensions) || value.dimensions.length === 0) return false;
  const dimensions = value.dimensions.map(jsonObject);
  return dimensions.every(dimension => dimension && typeof dimension.dimension === "string" && ["ready", "blocked", "not_applicable"].includes(String(dimension.state)) && Array.isArray(dimension.reasons) && dimension.reasons.every(reason => { const row = jsonObject(reason); return row && typeof row.code === "string" && typeof row.explanation === "string"; }))
    && value.ready === dimensions.every(dimension => dimension?.state !== "blocked");
}

/** HTTP status is interpreted by purpose: an absent operation is not proof of case revocation. */
export function reviewFailure(purpose: Purpose, status: number | null, confirmed: boolean, code?: string): Failure {
  if (status === 401) return "session_expired";
  if (purpose === "current_case" && (status === 403 || status === 404)) return "case_denied";
  if (purpose === "resource" && (status === 403 || status === 404) || purpose === "original_operation" && status === 403) return "resource_denied";
  if (purpose === "write" && (status === 403 || status === 404)) return "resource_denied";
  if (purpose === "write" && status === 400) return "validation";
  if (purpose === "write" && status === 409 && code === "revision_conflict") return "conflict";
  return confirmed ? "update_failed" : "unknown";
}

type Options = { scope: WriteScope; kind: "deadline" | "citation"; read: (url: string, init?: RequestInit) => Promise<Response>; newKey?: () => string; onCaseDenied?: () => void; onResourceDenied?: () => void; onCaseAuthority?: () => unknown; onUpdated?: (payload: unknown, receipt: SavedOutcome) => unknown };
export class DispositionRecoveryController {
  private state: ReviewState = { phase: "idle", busy: false, authorityVisible: false, requiresSignIn: false, resourceBlocked: false, record: null, draft: { reason: "", status: "completed", support: "" }, operation: null, receipt: null, message: "", field: null, replayEligible: false };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private active = true;
  private comparisonRequired = false;
  readonly scope: Readonly<WriteScope>;
  constructor(private options: Options) { this.scope = Object.freeze({ ...options.scope }); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(patch: Partial<ReviewState>) { if (!this.active) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private current(ticket: number) { return this.active && ticket === this.epoch; }
  private begin() { const ticket = ++this.epoch; this.publish({ busy: true, message: "", field: null }); return ticket; }
  private finish(ticket: number) { if (this.current(ticket)) this.publish({ busy: false }); }
  private url(operation = false) {
    const params = new URLSearchParams({ organization: this.scope.organizationId });
    if (operation) { params.set("kind", this.options.kind); params.set("id", this.scope.recordId); }
    return `/api/dossiers/${encodeURIComponent(this.scope.caseId)}${operation ? "/dispositions" : ""}?${params}`;
  }
  private blocked() { return !this.active || this.state.resourceBlocked; }
  dispose() { this.epoch++; this.active = false; this.state = { ...this.state, authorityVisible: false, resourceBlocked: true, record: null, draft: null, operation: null, receipt: null, busy: false }; this.listeners.clear(); }
  /** Expiry elsewhere in the workspace also invalidates this form's old reads.
   * Retain original operation/receipt in memory for same-account recovery. */
  suspendAuthority() { this.epoch++; this.publish({ authorityVisible: false, requiresSignIn: true, busy: false, replayEligible: false, phase: "session_expired", message: "Sign in with the original account. Your proposal is retained while this workspace stays open; a full-page sign-in may discard unsaved input." }); }
  /** Parent calls before publishing a new actor/org/case visit. No late response may restore old private state. */
  invalidate(next: WriteScope) { if (!sameWriteScope(this.scope, next)) this.dispose(); }
  private clearResource(message: string) { this.epoch++; this.publish({ phase: "resource_denied", authorityVisible: false, resourceBlocked: true, record: null, draft: null, operation: null, receipt: null, replayEligible: false, busy: false, field: null, message }); this.options.onResourceDenied?.(); }
  private clearCase() { this.clearResource("You no longer have access to this case."); this.publish({ phase: "case_denied" }); this.options.onCaseDenied?.(); }
  setDraft(draft: ReviewDraft) { if (!this.blocked() && !this.state.busy && ["editing", "validation", "conflict"].includes(this.state.phase)) this.publish({ draft: { ...draft } }); }
  private async failure(purpose: Purpose, response: Response | null, ticket: number, body: unknown = {}) {
    if (!this.current(ticket)) return;
    const payload = jsonObject(body) ?? {};
    const classification = reviewFailure(purpose, response?.status ?? null, Boolean(this.state.receipt), typeof payload.code === "string" ? payload.code : undefined);
    if (classification === "case_denied") { this.clearCase(); return; }
    if (classification === "resource_denied") {
      this.clearResource("This review is unavailable to your account. Checking access to the case…");
      const authorityTicket = ++this.epoch;
      try {
        const authority = await this.options.read(this.url(), { cache: "no-store" });
        if (!this.current(authorityTicket)) return;
        if (authority.status === 403 || authority.status === 404) this.clearCase();
        else if (authority.status === 401) await this.failure("current_case", authority, authorityTicket);
        else {
          const payload = authority.ok ? jsonObject(await authority.json()) : null;
          if (!this.current(authorityTicket)) return;
          this.publish({ message: jsonObject(payload?.dossier)?.dossier_id === this.scope.caseId ? "This review is unavailable. You can return to the case overview." : "This review is unavailable. Case access could not be confirmed; return to your cases." });
          if (jsonObject(payload?.dossier)?.dossier_id === this.scope.caseId) await this.options.onCaseAuthority?.();
        }
      } catch { if (this.current(authorityTicket)) this.publish({ message: "This review is unavailable. Case access could not be confirmed; return to your cases." }); }
      return;
    }
    if (classification === "session_expired") { this.epoch++; this.publish({ phase: classification, authorityVisible: false, requiresSignIn: true, replayEligible: false, busy: false, message: this.state.resourceBlocked ? "This review is unavailable. Sign in to check your remaining case access." : "Sign in with the original account. Your proposal is retained only while this workspace stays open; a full-page sign-in may discard unsaved input." }); return; }
    if (classification === "conflict") this.comparisonRequired = true;
    this.publish({ phase: classification === "unknown" && this.comparisonRequired ? "conflict" : classification, replayEligible: !this.comparisonRequired && purpose === "original_operation" && response?.status === 404,
      field: classification === "validation" && payload.field === "reason" ? "reason" : null,
      message: classification === "update_failed" ? "Review outcome saved. We couldn't update the case view. Retry update."
        : classification === "validation" ? (payload.field === "reason" ? "Check the highlighted reason. Your proposal is retained." : "Check the review details. Your proposal is retained.")
        : classification === "conflict" ? "The case changed. Compare your proposal with the current record before confirming a new submission."
        : this.comparisonRequired ? "We couldn't load the current comparison. Your proposal is retained; retry loading the current record."
        : "We couldn't check whether your review was saved. Check again before submitting another review." });
  }
  private async record(ticket: number) {
    const response = await this.options.read(this.url(true), { cache: "no-store" });
    if (!this.current(ticket)) return null;
    if (!response.ok) { await this.failure("resource", response, ticket); return null; }
    const record = await response.json() as ReviewRecord;
    if (!this.current(ticket)) return null;
    if (record.actor_id !== this.scope.actorId) { this.clearResource("The signed-in account changed. Reopen this review with the intended account."); return null; }
    if (record.kind !== this.options.kind || record.record?.id !== this.scope.recordId || !Number.isSafeInteger(record.revision) || !Array.isArray(record.dependent_assertions) || !Array.isArray(record.current_output_ids)) throw new Error("Unverified record");
    // A 500 or phase change must never lift the session privacy latch.
    this.publish({ authorityVisible: true, requiresSignIn: false });
    return record;
  }
  async open() {
    if (this.blocked()) return;
    const ticket = this.begin();
    try { const record = await this.record(ticket); if (record && this.current(ticket)) this.publish({ record, phase: this.state.receipt ? "confirmed" : this.comparisonRequired ? "conflict" : this.state.operation ? "unknown" : "editing" }); }
    catch { await this.failure("resource", null, ticket); } finally { this.finish(ticket); }
  }
  async save() {
    if (this.blocked() || !this.state.authorityVisible || this.state.busy || !["editing", "validation"].includes(this.state.phase) || !this.state.record?.can_review || this.state.record.disposition || !this.state.draft) return;
    const draft = this.state.draft;
    const key = this.options.newKey?.() ?? crypto.randomUUID();
    const body = JSON.stringify({ kind: this.options.kind, recordId: this.scope.recordId, reason: draft.reason, expectedRevision: this.state.record.revision, idempotencyKey: key, ...(this.options.kind === "deadline" ? { status: draft.status, supportingSourceAnchorId: draft.support || null } : { replacementSourceAnchorId: draft.support || null }) });
    this.publish({ operation: Object.freeze({ key, body, actorId: this.scope.actorId }), phase: "unknown", replayEligible: false });
    await this.writeOriginal();
  }
  private async accept(payload: unknown, ticket: number) {
    const operation = this.state.operation; if (!operation || !this.current(ticket)) return false;
    const fields = JSON.parse(operation.body);
    const receipt = savedOutcomeReceipt(payload, { caseId: this.scope.caseId, recordId: this.scope.recordId, kind: this.options.kind, reason: fields.reason, revision: fields.expectedRevision, status: fields.status ?? "completed", support: fields.supportingSourceAnchorId ?? fields.replacementSourceAnchorId ?? "", operationKey: operation.key });
    if (!receipt || receipt.actorId !== operation.actorId) throw new Error("Unverified original receipt");
    this.publish({ receipt, phase: "confirmed", replayEligible: false, message: "Review outcome saved." });
    return true;
  }
  async checkOriginal() {
    if (this.blocked() || this.state.busy || !this.state.operation) return;
    const ticket = this.begin(); let confirmed = false;
    try {
      const record = await this.record(ticket); if (!record || !this.current(ticket)) return;
      this.publish({ record });
      const response = await this.options.read(this.url(true) + "&operation_key=" + encodeURIComponent(this.state.operation!.key), { cache: "no-store" });
      if (!this.current(ticket)) return;
      if (!response.ok) { await this.failure("original_operation", response, ticket); return; }
      const body = await response.json(); if (this.current(ticket)) confirmed = await this.accept(body, ticket);
    } catch { await this.failure("original_operation", null, ticket); } finally { this.finish(ticket); }
    if (confirmed && this.current(ticket)) await this.refreshCase();
  }
  async replayOriginal() {
    if (this.blocked() || this.state.busy || !this.state.replayEligible || !this.state.operation) return;
    // Explicit action only after an absent original receipt; the immutable bytes/key are reused.
    await this.writeOriginal();
  }
  private async writeOriginal() {
    const operation = this.state.operation; if (!operation) return;
    const ticket = this.begin(); let confirmed = false;
    try {
      const record = await this.record(ticket); if (!record || !this.current(ticket)) return;
      const response = await this.options.read(this.url(true), { method: "POST", headers: { "content-type": "application/json" }, body: operation.body });
      if (!this.current(ticket)) return;
      // An HTML/empty error body must not turn an authoritative 401/403 into
      // a network uncertainty. Parse best-effort, then honor the HTTP status.
      let body: unknown = null;
      try { body = await response.json(); } catch { /* Status remains authoritative. */ }
      if (!this.current(ticket)) return;
      if (!response.ok) { await this.failure("write", response, ticket, body); return; }
      confirmed = await this.accept(body, ticket);
    } catch { await this.failure("write", null, ticket); } finally { this.finish(ticket); }
    if (confirmed && this.current(ticket)) await this.refreshCase();
  }
  async refreshCase() {
    if (this.blocked() || !this.state.receipt || this.state.busy) return;
    const ticket = this.begin(); this.publish({ phase: "updating" });
    try {
      if (!this.state.authorityVisible) {
        const record = await this.record(ticket);
        if (!record || !this.current(ticket)) return;
        this.publish({ record });
      }
      const response = await this.options.read(this.url(), { cache: "no-store" });
      if (!this.current(ticket)) return;
      if (!response.ok) { await this.failure("current_case", response, ticket); return; }
      const payload = jsonObject(await response.json()); if (!this.current(ticket)) return;
      const dossier = jsonObject(payload?.dossier), readiness = jsonObject(dossier?.readiness);
      if (dossier?.dossier_id !== this.scope.caseId || typeof dossier.revision !== "number" || !Number.isSafeInteger(dossier.revision) || dossier.revision < this.state.receipt!.revision || readiness?.dossier_id !== this.scope.caseId || readiness.computed_from_revision !== dossier.revision || !validReadiness(readiness)) throw new Error("Outdated or incomplete readiness");
      await this.options.onUpdated?.(payload, this.state.receipt!);
      if (this.current(ticket)) this.publish({ phase: "updated", message: "Review outcome saved. Case actions updated." });
    } catch { await this.failure("current_case", null, ticket); } finally { this.finish(ticket); }
  }
  async compareConflict() {
    if (this.state.phase !== "conflict" || this.state.busy) return;
    const ticket = this.begin();
    try { const record = await this.record(ticket); if (record && this.current(ticket)) this.publish({ record, message: `Current case revision: ${record.revision}. Your proposal is retained. Confirm that you reviewed both before making a new submission.` }); }
    catch { await this.failure("resource", null, ticket); } finally { this.finish(ticket); }
  }
  confirmComparedRevision(revision: number) { if (this.state.phase === "conflict" && this.state.authorityVisible && !this.state.record?.disposition && this.state.record?.revision === revision && this.state.operation && revision !== JSON.parse(this.state.operation.body).expectedRevision) { this.comparisonRequired = false; this.publish({ phase: "editing", operation: null, message: "Comparison confirmed. Review the proposal, then explicitly save it." }); } }
}
