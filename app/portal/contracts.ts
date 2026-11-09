export const portalFormGuard = {};
export const fileLimit = 5 * 1024 * 1024;
export type GrantSummary = {
  id: string;
  label: string;
  status: "invited" | "active" | "revoked" | "expired";
  email?: string;
};
export type Choice = {
  id: string;
  title: string;
  detail: string;
  kind: "document" | "event";
  revision: string;
  published?: number;
};
export type Shared = {
  id: string;
  kind: "document" | "event";
  title: string;
  detail: string;
  state: "shared" | "withdrawn" | "changed" | "replaced";
  stamp: string;
};
export type Upload = { id: string; name: string; size: number; stamp: string };
export type Message = { seq: number; author: "client" | "team"; text: string; stamp: string };
export type Thread = { shared: Shared[]; uploads: Upload[]; messages: Message[]; older: number | null };
export type PortalView = {
  grants: GrantSummary[];
  selected: string | null;
  canInvite: boolean;
  canWrite: boolean;
  choices: Choice[];
  thread: Thread | null;
};
export const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
