import type { StudioDraft } from "./types";

export const STUDIO_EVIDENCE_DRAG_TYPE = "application/x-casevant-evidence-link";
export type EvidenceAttachmentPlan = { evidenceIds: string[]; targetNodeId: string };

/** Ephemeral, same-owner gesture. External payloads never name or import evidence. */
export function createStudioEvidenceDrag(draft: StudioDraft, allowed: boolean, context?: object) {
  let gesture: { token: string; ids: string[]; pointer?: { id: number; x: number; y: number } } | null = null;
  function pointerTarget(id: number, x: number, y: number, target: string | null) {
    const pointer = gesture?.pointer;
    return pointer && pointer.id === id && Math.hypot(x - pointer.x, y - pointer.y) >= 6 && target
      && allowed && gesture && !gesture.ids.includes(target) && draft.nodes.some(node => node.id === target) ? target : null;
  }
  return {
    context,
    begin(ids: readonly string[]) {
      const selected = [...new Set(ids)];
      gesture = null;
      if (!allowed || !selected.length || selected.some(id => !draft.nodes.some(node => node.id === id && node.type === "evidence"))) return null;
      gesture = { token: crypto.randomUUID(), ids: selected };
      return gesture.token;
    },
    canDrop(target: string) {
      return Boolean(allowed && gesture && draft.nodes.some(node => node.id === target) && !gesture.ids.includes(target));
    },
    drop(token: string, target: string): EvidenceAttachmentPlan | null {
      const active = gesture; gesture = null;
      if (!allowed || !active || token !== active.token || active.ids.includes(target) || !draft.nodes.some(node => node.id === target)) return null;
      const ids = active.ids.filter(id => !draft.links.some(link => link.from === id && link.to === target || link.to === id && link.from === target));
      return ids.length ? { evidenceIds: ids, targetNodeId: target } : null;
    },
    preview(ids: readonly string[], target = ""): EvidenceAttachmentPlan | null {
      const token = this.begin(ids);
      if (!token) return null;
      if (target) return this.drop(token, target);
      const active = gesture; gesture = null;
      return active ? { evidenceIds: active.ids, targetNodeId: "" } : null;
    },
    startPointer(ids: readonly string[], id: number, x: number, y: number) {
      const token = this.begin(ids);
      if (!token || !gesture) return false;
      gesture.pointer = { id, x, y }; return true;
    },
    pointerTarget,
    endPointer(id: number, x: number, y: number, target: string | null) {
      if (gesture?.pointer?.id !== id) return null;
      const destination = pointerTarget(id,x,y,target), token = gesture.token;
      if (!destination) { gesture = null; return null; }
      return this.drop(token,destination);
    },
    cancelPointer(id: number) { if (gesture?.pointer?.id !== id) return false; gesture = null; return true; },
    active() { return Boolean(gesture); },
    clear() { gesture = null; },
  };
}
