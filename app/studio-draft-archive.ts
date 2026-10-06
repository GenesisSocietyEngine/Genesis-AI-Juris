import { isRecord } from "./case-integrity";
import { parsePreservedJson } from "./preserved-json";
import { readStudioAggregate } from "./studio-aggregate";
import { normalizeIncompleteStudioDraft } from "./studio-incomplete-draft";
import { isStudioDeviceScope, mayRestoreLocalStudioDraft, studioDeviceDraftKey, studioDeviceDraftV2Key } from "./studio-device-storage";
import type { StudioDraft } from "./types";

export const STUDIO_ARCHIVE_LIMIT = 10;
export const STUDIO_ARCHIVE_BYTES = 2_000_000;
type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export type ArchivedStudioDraft = { id: string; title: string; createdAt: string; draft: StudioDraft; prompt: string; original?: string };
type Archive = { format: "genesis-juris-draft-archive"; schemaVersion: 1; scope: string; entries: ArchivedStudioDraft[] };
const refused = () => new Error("archive-recovery");
export function studioArchiveKey(scope: string) {
  if (!isStudioDeviceScope(scope)) throw refused();
  return `genesis-juris-draft-archive-v1:${scope}`;
}
function editable(value: unknown) {
  // Inspect the original protection before a normalizer can omit unknown metadata.
  if (!mayRestoreLocalStudioDraft(value)) throw refused();
  const read = readStudioAggregate(JSON.stringify(value), { kind: "draft", normalizeDraft: normalizeIncompleteStudioDraft });
  if (read.status !== "editable") throw refused();
  return read.draft;
}
function archiveKeys(storage: Pick<DeviceStorage, "key" | "length">, scope: string) {
  const prefix = `${studioArchiveKey(scope)}:entry:`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys.sort();
}
function readArchiveValue(raw: string, scope: string): ArchivedStudioDraft[] {
  if (new TextEncoder().encode(raw).length > STUDIO_ARCHIVE_BYTES) throw refused();
  const value = parsePreservedJson(raw);
  if (!isRecord(value) || value.format !== "genesis-juris-draft-archive" || value.schemaVersion !== 1 || value.scope !== scope
    || Object.keys(value).some(key => !["format", "schemaVersion", "scope", "entries"].includes(key))
    || !Array.isArray(value.entries) || value.entries.length > STUDIO_ARCHIVE_LIMIT) throw refused();
  const ids = new Set<string>();
  return value.entries.map(entry => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || ids.has(entry.id)
      || typeof entry.title !== "string" || typeof entry.createdAt !== "string" || !Number.isFinite(Date.parse(entry.createdAt))
      || typeof entry.prompt !== "string" || entry.prompt.length > 200_000
      || Object.keys(entry).some(key => !["id", "title", "createdAt", "draft", "prompt", "original"].includes(key))) throw refused();
    ids.add(entry.id);
    if (entry.original !== undefined) {
      if (typeof entry.original !== "string") throw refused();
      const original = readStudioAggregate(entry.original, { kind: "device-draft", expectedScope: scope, normalizeDraft: normalizeIncompleteStudioDraft });
      if (original.status !== "editable" || !mayRestoreLocalStudioDraft(original.envelope.draft)) throw refused();
    }
    return { id: entry.id, title: entry.title, createdAt: entry.createdAt, draft: editable(entry.draft), prompt: entry.prompt,
      ...(typeof entry.original === "string" ? { original: entry.original } : {}) };
  });
}
export function readStudioArchive(storage: Pick<DeviceStorage, "getItem" | "key" | "length">, scope: string): ArchivedStudioDraft[] {
  const legacy = storage.getItem(studioArchiveKey(scope));
  const entries = legacy === null ? [] : readArchiveValue(legacy, scope);
  for (const key of archiveKeys(storage, scope)) {
    const raw = storage.getItem(key);
    if (raw === null) continue; // An explicitly deleted entry is absent.
    const batch = readArchiveValue(raw, scope);
    if (batch.length !== 1 || key !== `${studioArchiveKey(scope)}:entry:${batch[0].id}`) throw refused();
    entries.push(batch[0]);
  }
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw refused();
  // Keep over-capacity recovery readable if a failed rollback left redundant copies.
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
function checkCapacity(scope: string, entries: ArchivedStudioDraft[]) {
  if (entries.length > STUDIO_ARCHIVE_LIMIT) throw new Error("archive-full");
  const archive: Archive = { format: "genesis-juris-draft-archive", schemaVersion: 1, scope, entries };
  const raw = JSON.stringify(archive);
  if (new TextEncoder().encode(raw).length > STUDIO_ARCHIVE_BYTES) throw new Error("archive-full");
}

/** Append independent immutable records before ALL editor mutation and active-slot deletion.
 * Retain original device bytes, and the current unsaved local graph/prompt separately.
 * Never rewrite another tab's records. Roll back only this attempt on quota/capacity
 * failure; original active/editor data remains intact even if rollback fails. */
export function retainStudioReplacement(storage: DeviceStorage, scope: string, current: { draft: StudioDraft; prompt: string } | null,
  options = { id: () => crypto.randomUUID() as string, now: () => new Date().toISOString() }) {
  const existing = readStudioArchive(storage, scope);
  const retained: ArchivedStudioDraft[] = [];
  const add = (draft: StudioDraft, prompt: string, original?: string) => {
    const normalized = editable(draft);
    retained.push({ id: options.id(), title: normalized.title, createdAt: options.now(), draft: normalized, prompt, ...(original === undefined ? {} : { original }) });
  };
  for (const key of [studioDeviceDraftV2Key(scope), studioDeviceDraftKey(scope)]) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const read = readStudioAggregate(raw, { kind: "device-draft", expectedScope: scope, normalizeDraft: normalizeIncompleteStudioDraft });
    if (read.status !== "editable" || !mayRestoreLocalStudioDraft(read.envelope.draft)) throw refused();
    add(read.draft, "", raw);
  }
  if (current && (current.draft.title.trim() || current.draft.nodes.length || current.draft.links.length || current.prompt.trim())) {
    // A saved slot is sufficient only when its graph AND the unapplied prompt agree.
    const normalized = editable(current.draft);
    const identical = retained.find(entry => JSON.stringify(entry.draft) === JSON.stringify(normalized));
    if (identical) identical.prompt = current.prompt;
    else add(current.draft, current.prompt);
  }
  if (retained.length) {
    checkCapacity(scope, [...existing, ...retained]);
    const written: string[] = [];
    try {
      for (const entry of retained) {
        const key = `${studioArchiveKey(scope)}:entry:${entry.id}`;
        if (storage.getItem(key) !== null) throw refused();
        const archive: Archive = { format: "genesis-juris-draft-archive", schemaVersion: 1, scope, entries: [entry] };
        storage.setItem(key, JSON.stringify(archive));
        written.push(key);
      }
      // Include another tab's concurrent append before permitting replacement.
      checkCapacity(scope, readStudioArchive(storage, scope));
    } catch (error) {
      for (const key of written) { try { storage.removeItem(key); } catch { /* Redundant recovery data is safer than removing other work. */ } }
      throw error;
    }
  }
  return retained;
}
export function deleteArchivedStudioDraft(storage: DeviceStorage, scope: string, id: string) {
  const entries = readStudioArchive(storage, scope);
  if (!entries.some(entry => entry.id === id)) return;
  const key = `${studioArchiveKey(scope)}:entry:${id}`;
  // Legacy array recovery stays readable/exportable; never rewrite a shared array.
  if (storage.getItem(key) === null) throw refused();
  storage.removeItem(key);
}
/** Only known, eligible records can be removed by existing privacy cleanup. */
export function purgeKnownStudioArchive(storage: DeviceStorage, scope: string) {
  readStudioArchive(storage, scope);
  for (const key of archiveKeys(storage, scope)) storage.removeItem(key);
  storage.removeItem(studioArchiveKey(scope));
}
/** Explicit server-confirmed sign-out owns privacy cleanup, including future bytes. */
export function purgeStudioArchiveForSignOut(storage: DeviceStorage, scope: string) {
  for (const key of archiveKeys(storage, scope)) storage.removeItem(key);
  storage.removeItem(studioArchiveKey(scope));
}
export function readStudioArchiveBackup(raw: string, scope: string): ArchivedStudioDraft {
  if (new TextEncoder().encode(raw).length > STUDIO_ARCHIVE_BYTES) throw refused();
  const value = parsePreservedJson(raw);
  if (!isRecord(value) || value.format !== "genesis-juris-archive-backup" || value.schemaVersion !== 1
    || Object.keys(value).some(key => !["format", "schemaVersion", "entry"].includes(key))) throw refused();
  const entries = readArchiveValue(JSON.stringify({ format: "genesis-juris-draft-archive", schemaVersion: 1, scope, entries: [value.entry] }), scope);
  return entries[0];
}
export function restoreArchivedStudioDraft(entry: ArchivedStudioDraft): StudioDraft {
  const draft = structuredClone(editable(entry.draft));
  delete draft.protection;
  draft.parent = null;
  // Recovery creates a fresh local copy, never authority to overwrite a saved case.
  draft.caseId = `restored_${entry.id}`;
  draft.updatedAt = new Date().toISOString();
  return draft;
}
