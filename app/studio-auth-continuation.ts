import { normalizeStudioDraft } from "./case-integrity";
import { mayPersistStudioDraftOnDevice } from "./studio-device-storage";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";
import type { StudioDraft } from "./types";

export const STUDIO_AUTH_CONTINUATION_KEY = "genesis-studio-auth-continuation-v1";
const MAX_AGE = 15 * 60 * 1000;
type Continuation = { version: 1; id: string; createdAt: number; scope: string | null; prompt: string; draft: StudioDraft; selectedNodeId: string | null };

/** Temporary, same-tab user work, saved only when the user starts sign-in.
 * Server/private/protected cases are excluded; credentials are never stored. */
export function createStudioAuthContinuation(input: Omit<Continuation, "version" | "createdAt" | "id"> & { customCaseId: number | null; isPrivate: boolean; canDuplicate: boolean }, now = Date.now()): Continuation {
  if (!mayPersistStudioDraftOnDevice(input) || studioJsonBytes(input.draft) > STUDIO_DRAFT_SERIALIZED_LIMIT || input.prompt.length > STUDIO_PROMPT_CHARACTER_LIMIT) {
    throw new Error("This protected or oversized case cannot be retained for sign-in. Save it through its authorized workspace first.");
  }
  return { version: 1, id: crypto.randomUUID(), createdAt: now, scope: input.scope, prompt: input.prompt, draft: input.draft, selectedNodeId: input.selectedNodeId };
}

export function readStudioAuthContinuation(value: string | null, id: string, currentScope: string | null, now = Date.now()): Continuation | null {
  try {
    if (!value || value.length > STUDIO_DRAFT_SERIALIZED_LIMIT + 400_000) return null;
    const candidate = JSON.parse(value) as Continuation;
    if (candidate.version !== 1 || candidate.id !== id || !Number.isFinite(candidate.createdAt) || now < candidate.createdAt || now - candidate.createdAt > MAX_AGE) return null;
    if (candidate.scope !== null && candidate.scope !== currentScope) return null;
    if (typeof candidate.prompt !== "string" || candidate.prompt.length > STUDIO_PROMPT_CHARACTER_LIMIT) return null;
    const draft = normalizeStudioDraft(candidate.draft);
    if (!mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: false, draft }) || studioJsonBytes(draft) > STUDIO_DRAFT_SERIALIZED_LIMIT) return null;
    return { ...candidate, draft, selectedNodeId: draft.nodes.some(node => node.id === candidate.selectedNodeId) ? candidate.selectedNodeId : null };
  } catch { return null; }
}
