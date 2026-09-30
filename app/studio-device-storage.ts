import type { StudioDraft } from "./types";
import { isRecord } from "./case-integrity";
import { parsePreservedJson } from "./preserved-json";
import { readStudioAggregate, type StudioAggregateRead } from "./studio-aggregate";
import { normalizeIncompleteStudioDraft } from "./studio-incomplete-draft";

export const LEGACY_STUDIO_DRAFT_KEY = "genesis-juris-studio-draft";
export const LEGACY_STUDIO_PRIVATE_KEY = "genesis-juris-studio-private";
const DEVICE_DRAFT_PREFIX = "genesis-juris-device-draft-v1:";
const DEVICE_DRAFT_V2_PREFIX = "genesis-juris-device-draft-v2:";

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

export function studioDeviceDraftV2Key(scope: string) {
  if (isStudioDeviceScope(scope)) return `${DEVICE_DRAFT_V2_PREFIX}${scope}`;
  throw new Error("Invalid Studio device-draft scope");
}

type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StudioDeviceDraftRead =
  | { status: "empty" }
  | { status: "unavailable"; reason: string }
  | (StudioAggregateRead & { key: string; canExport: boolean });

/** Read the new slot first. Its presence, including empty/corrupt/future text,
 * blocks fallback to v1. A read failure is not an empty slot. */
export function readStudioDeviceDraft(storage: Pick<DeviceStorage, "getItem">, scope: string): StudioDeviceDraftRead {
  try {
    for (const key of [studioDeviceDraftV2Key(scope), studioDeviceDraftKey(scope)]) {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      const result = readStudioAggregate(raw, { kind: "device-draft", expectedScope: scope, normalizeDraft: normalizeIncompleteStudioDraft });
      if (result.status === "editable") {
        if (!mayRestoreLocalStudioDraft(result.envelope.draft)) return { status: "denied", reason: "Protected workspace data cannot be restored from device storage.", key, canExport: false };
        return { ...result, key, canExport: true };
      }
      // Recovery obeys the same local/public/unprotected boundary. Unknown
      // envelope semantics or ambiguous metadata do not grant raw export.
      let canExport = false;
      if (result.status !== "denied") {
        const envelope = parsePreservedJson(raw);
        if (isRecord(envelope) && envelope.format === "genesis-juris-device-draft" && (envelope.schemaVersion === 1 || envelope.schemaVersion === 2) &&
            Object.keys(envelope).every(field => ["format", "schemaVersion", "scope", "draft"].includes(field)) && isRecord(envelope.draft)) {
          canExport = mayRestoreLocalStudioDraft(envelope.draft);
        }
      }
      return { ...result, key, canExport };
    }
    return { status: "empty" };
  } catch { return { status: "unavailable", reason: "Device storage could not be read. The retained draft has not been replaced." }; }
}

/** No migration deletion: the original v1 record stays available. A future,
 * corrupt, inaccessible or unreadable active slot must not be overwritten. */
export function writeStudioDeviceDraft(storage: DeviceStorage, scope: string, value: StudioDraft): StudioDraft {
  if (!mayRestoreLocalStudioDraft(value)) throw new Error("Protected workspace cases cannot be stored on this device.");
  const draft = normalizeIncompleteStudioDraft(value);
  if (!mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: false, draft })) throw new Error("Protected workspace cases cannot be stored on this device.");
  const before = readStudioDeviceDraft(storage, scope);
  if (before.status !== "empty" && before.status !== "editable") throw new Error("The retained device draft requires recovery before saving. It has not been replaced.");
  const serialized = JSON.stringify({ format: "genesis-juris-device-draft", schemaVersion: 2, scope, draft });
  storage.setItem(studioDeviceDraftV2Key(scope), serialized);
  return draft;
}

/** Inspect raw protection before any normalizer can drop an unknown format. */
export function mayRestoreLocalStudioDraft(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const protection = value.protection;
  return protection === undefined || protection === null || isRecord(protection)
    && protection.kind === "case-protection-v1" && protection.copyProtected === false
    && protection.copyPolicy === "fork_allowed" && !protection.currentCode && !protection.seal;
}

/** Existing explicit replacement/privacy cleanup may remove known local drafts,
 * but never silently deletes an unsupported record or its retained original. */
export function removeKnownStudioDeviceDrafts(storage: DeviceStorage, scope: string) {
  for (const key of [studioDeviceDraftV2Key(scope), studioDeviceDraftKey(scope)]) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const result = readStudioAggregate(raw, { kind: "device-draft", expectedScope: scope, normalizeDraft: normalizeIncompleteStudioDraft });
    if (result.status === "editable" && mayRestoreLocalStudioDraft(result.envelope.draft)) storage.removeItem(key);
  }
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
