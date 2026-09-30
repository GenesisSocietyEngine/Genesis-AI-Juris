import { isRecord } from "./case-integrity";
import { mayPersistStudioDraftOnDevice, mayRestoreLocalStudioDraft } from "./studio-device-storage";
import { normalizeIncompleteStudioDraft } from "./studio-incomplete-draft";
import { parsePreservedJson } from "./preserved-json";
import { readStudioAggregate, type StudioAggregateRead } from "./studio-aggregate";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";
import type { StudioDraft } from "./types";

export const LEGACY_STUDIO_AUTH_CONTINUATION_KEY = "genesis-studio-auth-continuation-v1";
export const STUDIO_AUTH_CONTINUATION_KEY = "genesis-studio-auth-continuation-v2";
const MAX_AGE = 15 * 60 * 1000;
type Continuation = { version: 1 | 2; id: string; createdAt: number; scope: string | null; prompt: string; draft: StudioDraft; selectedNodeId: string | null; action?: 'save' | 'submit' };
export type StudioAuthContinuationRead =
  | { status: "restored"; continuation: Continuation }
  | { status: "empty" }
  | Exclude<StudioAggregateRead, { status: "editable" }>;

/** Temporary, same-tab user work, saved only when the user starts sign-in.
 * Server/private/protected cases are excluded; credentials are never stored. */
export function createStudioAuthContinuation(input: Omit<Continuation, "version" | "createdAt" | "id"> & { customCaseId: number | null; isPrivate: boolean; canDuplicate: boolean }, now = Date.now()): Continuation {
  if (!mayPersistStudioDraftOnDevice(input) || !mayRestoreLocalStudioDraft(input.draft) || studioJsonBytes(input.draft) > STUDIO_DRAFT_SERIALIZED_LIMIT || input.prompt.length > STUDIO_PROMPT_CHARACTER_LIMIT) {
    throw new Error("This protected or oversized case cannot be retained for sign-in. Save it through its authorized workspace first.");
  }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { version: 2, id, createdAt: now, scope: input.scope, prompt: input.prompt, draft: normalizeIncompleteStudioDraft(input.draft), selectedNodeId: input.selectedNodeId, action: input.action };
}

export function readStudioAuthContinuation(value: string | null, id: string, currentScope: string | null, now = Date.now()): Continuation | null {
  const result = readStudioAuthContinuationState(value, id, currentScope, now);
  return result.status === "restored" ? result.continuation : null;
}

export function writeStudioAuthContinuation(storage: Pick<Storage, "getItem" | "setItem">, continuation: Continuation) {
  const raw = storage.getItem(STUDIO_AUTH_CONTINUATION_KEY);
  if (raw !== null) {
    const existing = readStudioAggregate(raw, { kind: "auth-continuation", expectedScope: continuation.scope, normalizeDraft: normalizeIncompleteStudioDraft });
    if (existing.status !== "editable" || !mayRestoreLocalStudioDraft(existing.envelope.draft)) throw new Error("The retained sign-in draft requires recovery before it can be replaced.");
  }
  storage.setItem(STUDIO_AUTH_CONTINUATION_KEY, JSON.stringify(continuation));
}

/** A future/corrupt continuation is retained instead of being consumed as null.
 * ID, lifetime, account and local-copy authority precede every raw recovery. */
export function readStudioAuthContinuationState(value: string | null, id: string, currentScope: string | null, now = Date.now()): StudioAuthContinuationRead {
  if (value === null) return { status: "empty" };
  const denied = (): StudioAuthContinuationRead => ({ status: "denied", reason: "The sign-in draft expired or its account and identity could not be verified." });
  try {
    if (new TextEncoder().encode(value).byteLength > STUDIO_DRAFT_SERIALIZED_LIMIT + 400_000) return denied();
    const candidate = parsePreservedJson(value);
    if (!isRecord(candidate) || candidate.id !== id || typeof candidate.createdAt !== "number" || !Number.isFinite(candidate.createdAt) || now < candidate.createdAt || now - candidate.createdAt > MAX_AGE) return denied();
    if (candidate.scope !== null && candidate.scope !== currentScope) return denied();
    if (!mayRestoreLocalStudioDraft(candidate.draft)) return denied();
    const result = readStudioAggregate(value, { kind: "auth-continuation", expectedScope: candidate.scope as string | null, normalizeDraft: normalizeIncompleteStudioDraft });
    if (result.status !== "editable") return result;
    if (typeof candidate.prompt !== "string" || candidate.prompt.length > STUDIO_PROMPT_CHARACTER_LIMIT || candidate.action !== undefined && candidate.action !== "save" && candidate.action !== "submit") return { status: "corrupt", rawText: value, reason: "The retained sign-in action or prompt is malformed." };
    const draft = result.draft;
    return { status: "restored", continuation: { ...candidate, draft, selectedNodeId: draft.nodes.some(node => node.id === candidate.selectedNodeId) ? candidate.selectedNodeId : null } as Continuation };
  } catch { return denied(); }
}
