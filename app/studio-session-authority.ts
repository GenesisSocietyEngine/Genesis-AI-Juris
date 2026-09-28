import { studioDeviceScope } from "./studio-device-storage";
import type { SessionBoundary } from "./session-boundary";

type Transport = (path: string, init?: RequestInit) => Promise<Response>;
type Identity = { scope: string; registered: boolean; studioAI: boolean };
type Snapshot = {
  phase: "checking" | "ready" | "anonymous" | "unavailable" | "suspended" | "revoked";
  scope: string | null; epoch: number; discardVersion: number; discardLocal: boolean; registered: boolean; studioAI: boolean;
  caseId: number | null; caseCanDuplicate: boolean | null; signOutPending: boolean;
};
export type StudioReportAuthority = { epoch: number; visible: boolean; allowed: boolean; verify: () => Promise<() => boolean> };
const unavailable = () => new Error("Report access could not be verified. Sign in, then refresh access and try again.");
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function shouldDiscardStudioDraft(discardLocal: boolean, customCaseId: number | null, isPrivate: boolean) {
  return discardLocal || customCaseId !== null || isPrivate;
}

/** Memory-only authority. Neither focus events nor a cached permission grant output. */
export class StudioSessionAuthority {
  private state: Snapshot = { phase: "checking", scope: null, epoch: 0, discardVersion: 0, discardLocal: false, registered: false, studioAI: false, caseId: null, caseCanDuplicate: null, signOutPending: false };
  private listeners = new Set<() => void>();
  private request = 0;
  private knownScope: string | null = null;
  private termination: "none" | "pending" | "ended" = "none";
  constructor(private transport: Transport = (path, init) => fetch(path, init)) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<Snapshot>) { this.state = { ...this.state, ...patch, signOutPending: this.termination === "pending" }; this.listeners.forEach(listener => listener()); }
  invalidate = (phase: SessionBoundary, accountChanged = false) => {
    this.request++;
    this.publish({ phase: phase === "revoke" ? "revoked" : "suspended", scope: null, epoch: this.state.epoch + 1,
      discardVersion: this.state.discardVersion + (phase === "revoke" ? 1 : 0), discardLocal: phase === "revoke" && accountChanged,
      registered: false, studioAI: false, caseId: null, caseCanDuplicate: null });
  };
  sessionBoundary = (phase: SessionBoundary) => {
    this.termination = phase === "suspend" ? "pending" : "ended";
    this.invalidate(phase);
  };
  private async json(path: string) {
    const response = await this.transport(path, { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (response.redirected || response.type === "opaqueredirect") throw unavailable();
    if (!response.ok) return { status: response.status, data: null };
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw unavailable();
    const data: unknown = await response.json();
    if (!record(data)) throw unavailable();
    return { status: response.status, data };
  }
  private async identity(): Promise<Identity | null> {
    const { status, data } = await this.json("/api/me");
    if (status === 401) return null;
    if (status !== 200 || !data || data.authenticated !== true || !record(data.profile)
      || typeof data.profile.email !== "string" || !data.profile.email.trim()
      || typeof data.registered !== "boolean" || !record(data.capabilities) || typeof data.capabilities.studioAI !== "boolean") throw unavailable();
    const scope = await studioDeviceScope(data.profile.email);
    if (!scope) throw unavailable();
    return { scope, registered: data.registered, studioAI: data.capabilities.studioAI };
  }
  private async caseAccess(customCaseId: number) {
    const { status, data } = await this.json(`/api/custom-cases?id=${customCaseId}`);
    if (status === 403 || status === 404) throw Object.assign(unavailable(), { caseRevoked: true });
    const permission = data?.customCase;
    if (status !== 200 || !record(permission) || permission.id !== customCaseId
      || typeof permission.copyProtected !== "boolean" || typeof permission.isPrivate !== "boolean"
      || !["owner", "admin", "shared"].includes(String(permission.access))) throw unavailable();
    return permission.access === "owner" || permission.access === "shared" && permission.copyProtected === false;
  }
  async refresh(explicit = false, customCaseId: number | null = null) {
    // Failed logout stays suspended until the originating tab successfully retries.
    // Completed logout needs an explicit check or a new page after normal sign-in.
    if (this.termination === "pending" || this.termination === "ended" && !explicit) return;
    if (explicit) this.termination = "none";
    const request = ++this.request, epoch = this.state.epoch;
    try {
      const identity = await this.identity();
      if (request !== this.request || epoch !== this.state.epoch) return;
      if (!identity) { this.invalidate("suspend"); this.publish({ phase: "anonymous" }); return; }
      const changed = this.knownScope !== null && identity.scope !== this.knownScope;
      if (changed) {
        this.invalidate("revoke", true); this.knownScope = identity.scope;
        this.publish({ phase: "ready", ...identity }); return;
      }
      const caseCanDuplicate = customCaseId === null ? null : await this.caseAccess(customCaseId);
      if (request !== this.request || epoch !== this.state.epoch) return;
      this.knownScope = identity.scope;
      this.publish({ phase: "ready", ...identity, caseId: customCaseId, caseCanDuplicate });
    } catch (error) {
      if (request !== this.request || epoch !== this.state.epoch) return;
      if (record(error) && error.caseRevoked === true) this.invalidate("revoke");
      else { this.invalidate("suspend"); this.publish({ phase: "unavailable" }); }
    }
  }
  /** Recheck existing server policies without replacing or saving the user's draft. */
  async verifyReport(scope: string | null, customCaseId: number | null): Promise<() => boolean> {
    const epoch = this.state.epoch;
    const current = () => this.state.epoch === epoch && this.state.phase === "ready" && this.state.scope === scope;
    if (!scope || !current()) throw unavailable();
    try {
      const identity = await this.identity();
      if (!current()) throw unavailable();
      if (!identity || identity.scope !== scope) {
        this.invalidate(identity ? "revoke" : "suspend", Boolean(identity));
        throw unavailable();
      }
      if (customCaseId !== null) {
        const canDuplicate = await this.caseAccess(customCaseId);
        if (!current()) throw unavailable();
        // Exactly the existing Studio permission rule: admin inspection is not export authority.
        if (!canDuplicate) {
          this.invalidate("suspend"); throw unavailable();
        }
      }
      if (!current()) throw unavailable();
      return current;
    } catch (error) {
      if (this.state.epoch === epoch) this.invalidate(record(error) && error.caseRevoked === true ? "revoke" : "suspend");
      throw error;
    }
  }
  reportAuthority(required: boolean, scope: string | null, customCaseId: number | null): StudioReportAuthority {
    const epoch = this.state.epoch;
    const visible = !required || this.state.phase === "ready" && this.state.scope === scope && scope !== null
      && (customCaseId === null || this.state.caseId === customCaseId);
    return { epoch, visible, allowed: visible && (!required || customCaseId === null || this.state.caseCanDuplicate === true),
      verify: required ? async () => {
        if (this.state.epoch !== epoch) throw unavailable();
        const current = await this.verifyReport(scope, customCaseId);
        if (this.state.epoch !== epoch) throw unavailable();
        return current;
      } : async () => {
        const current = () => this.state.epoch === epoch;
        if (!current()) throw unavailable();
        return current;
      } };
  }
}
