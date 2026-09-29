import type { StudioDraft } from "./types";

export const LEGACY_STUDIO_DRAFT_KEY = "genesis-juris-studio-draft";
export const LEGACY_STUDIO_PRIVATE_KEY = "genesis-juris-studio-private";
const DEVICE_DRAFT_PREFIX = "genesis-juris-device-draft-v1:";

export type DeviceDraftEnvelope = {
  format: "genesis-juris-device-draft";
  schemaVersion: 1;
  scope: string;
  draft: StudioDraft;
};

export async function studioDeviceScope(email: unknown) {
  if (typeof email !== "string" || !email.trim()) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`genesis-juris-device-scope-v1:${email.trim().toLowerCase()}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isStudioDeviceScope(scope: unknown): scope is string {
  return typeof scope === "string" && /^[a-f0-9]{64}$/.test(scope);
}

export function studioDeviceDraftKey(scope: string) {
  if (isStudioDeviceScope(scope)) return `${DEVICE_DRAFT_PREFIX}${scope}`;
  throw new Error("Invalid Studio device-draft scope");
}

export function deviceDraftEnvelope(scope: string, draft: StudioDraft): DeviceDraftEnvelope {
  return { format: "genesis-juris-device-draft", schemaVersion: 1, scope, draft };
}

export function unwrapDeviceDraft(value: unknown, scope: string): StudioDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Partial<DeviceDraftEnvelope>;
  if (envelope.format !== "genesis-juris-device-draft" || envelope.schemaVersion !== 1 || envelope.scope !== scope || !envelope.draft) return null;
  return envelope.draft;
}

export function mayPersistStudioDraftOnDevice(input: {
  canDuplicate: boolean;
  customCaseId: number | null;
  isPrivate: boolean;
  draft: Pick<StudioDraft, "protection">;
}) {
  return input.canDuplicate
    && input.customCaseId === null
    && !input.isPrivate
    && !input.draft.protection?.copyProtected
    && !input.draft.protection?.currentCode
    && !input.draft.protection?.seal;
}

export function mayPersistReportReceiptOnDevice(input: {
  scope: string | null;
  canDuplicate: boolean;
  customCaseId: number | null;
  isPrivate: boolean;
  draft: Pick<StudioDraft, "protection">;
}) {
  return isStudioDeviceScope(input.scope)
    && mayPersistStudioDraftOnDevice(input)
    && !input.draft.protection?.parentCode;
}
