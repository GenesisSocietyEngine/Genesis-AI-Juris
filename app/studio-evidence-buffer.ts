import type { StudioNodeType } from "./types";

export type StudioEvidenceInput = { title: string; detail: string; relatedId: string };
export type StudioEvidenceBuffers = Partial<Record<StudioNodeType, StudioEvidenceInput>>;

export function emptyStudioEvidenceInput(): StudioEvidenceInput {
  return { title: "", detail: "", relatedId: "" };
}

/** Memory-only input, separate from the persisted graph until explicitly added. */
export function hasStudioEvidenceInput(buffers: StudioEvidenceBuffers) {
  return Object.values(buffers).some(value => Boolean(value && (value.title || value.detail || value.relatedId)));
}

export function updateStudioEvidenceInput(buffers: StudioEvidenceBuffers, type: StudioNodeType, patch: Partial<StudioEvidenceInput>): StudioEvidenceBuffers {
  return { ...buffers, [type]: { ...emptyStudioEvidenceInput(), ...buffers[type], ...patch } };
}

export function clearStudioEvidenceInput(buffers: StudioEvidenceBuffers, type: StudioNodeType): StudioEvidenceBuffers {
  const next = { ...buffers };
  delete next[type];
  return next;
}
