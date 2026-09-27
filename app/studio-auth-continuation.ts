import { isRecord, normalizeStudioDraft } from "./case-integrity";
import { mayPersistStudioDraftOnDevice } from "./studio-device-storage";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";
import type { StudioDraft } from "./types";

export const STUDIO_AUTH_CONTINUATION_KEY = "genesis-studio-auth-continuation-v1";
const MAX_AGE = 15 * 60 * 1000;
type Continuation = { version: 1; id: string; createdAt: number; scope: string | null; prompt: string; draft: StudioDraft; selectedNodeId: string | null; action?: 'save' | 'submit' };

/** A same-tab authoring continuation can precede a title or the first node.
 * Keep the persisted/imported case validator strict. Temporary validation
 * placeholders are removed before return and never become case content. */
function normalizeContinuationDraft(value: unknown): StudioDraft {
  if (!isRecord(value)) throw new Error("Invalid continuation draft");
  const emptyTitle = typeof value.title === "string" && value.title.trim() === "";
  const emptyGraph = Array.isArray(value.nodes) && value.nodes.length === 0;
  if (!emptyTitle && !emptyGraph) return normalizeStudioDraft(value);
  if (emptyTitle && (value.title as string).length > 200) throw new Error("Invalid continuation title");
  if (emptyGraph && (!Array.isArray(value.links) || value.links.length !== 0)) throw new Error("An empty continuation graph cannot have links");
  const normalized = normalizeStudioDraft({
    ...value,
    title: emptyTitle ? "Untitled case" : value.title,
    nodes: emptyGraph ? [{ id: "continuation-validation", type: "trigger", title: "Validation only", detail: "", x: 0, y: 0 }] : value.nodes,
  });
  return {
    ...normalized,
    title: emptyTitle ? value.title as string : normalized.title,
    nodes: emptyGraph ? [] : normalized.nodes,
  };
}

/** Temporary, same-tab user work, saved only when the user starts sign-in.
 * Server/private/protected cases are excluded; credentials are never stored. */
export function createStudioAuthContinuation(input: Omit<Continuation, "version" | "createdAt" | "id"> & { customCaseId: number | null; isPrivate: boolean; canDuplicate: boolean }, now = Date.now()): Continuation {
  if (!mayPersistStudioDraftOnDevice(input) || studioJsonBytes(input.draft) > STUDIO_DRAFT_SERIALIZED_LIMIT || input.prompt.length > STUDIO_PROMPT_CHARACTER_LIMIT) {
    throw new Error("This protected or oversized case cannot be retained for sign-in. Save it through its authorized workspace first.");
  }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { version: 1, id, createdAt: now, scope: input.scope, prompt: input.prompt, draft: input.draft, selectedNodeId: input.selectedNodeId, action: input.action };
}

export function readStudioAuthContinuation(value: string | null, id: string, currentScope: string | null, now = Date.now()): Continuation | null {
  try {
    if (!value || value.length > STUDIO_DRAFT_SERIALIZED_LIMIT + 400_000) return null;
    const candidate = JSON.parse(value) as Continuation;
    if (candidate.version !== 1 || candidate.id !== id || !Number.isFinite(candidate.createdAt) || now < candidate.createdAt || now - candidate.createdAt > MAX_AGE) return null;
    if (candidate.scope !== null && candidate.scope !== currentScope) return null;
    if (typeof candidate.prompt !== "string" || candidate.prompt.length > STUDIO_PROMPT_CHARACTER_LIMIT) return null;
    if (candidate.action !== undefined && candidate.action !== 'save' && candidate.action !== 'submit') return null;
    const draft = normalizeContinuationDraft(candidate.draft);
    if (!mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: false, draft }) || studioJsonBytes(draft) > STUDIO_DRAFT_SERIALIZED_LIMIT) return null;
    return { ...candidate, draft, selectedNodeId: draft.nodes.some(node => node.id === candidate.selectedNodeId) ? candidate.selectedNodeId : null };
  } catch { return null; }
}
