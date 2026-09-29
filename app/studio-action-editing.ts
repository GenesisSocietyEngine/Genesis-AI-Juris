import { nextStudioLinkId, nextStudioNodeId, nextStudioNodePosition } from './studio-editing';
import type { StudioDraft, StudioNodeType } from './types';

export type ConnectedItemInput = { type: StudioNodeType; title: string; detail: string; relatedId: string };
export function appendConnectedStudioItem(draft: StudioDraft, value: ConnectedItemInput): { draft: StudioDraft; nodeId: string } | null {
  const related = draft.nodes.find(node => node.id === value.relatedId);
  if (!related || !value.title.trim() || !value.detail.trim() || draft.nodes.length >= 200 || draft.links.length >= 500) return null;
  const nodeId = nextStudioNodeId(draft.nodes, value.type);
  return {
    nodeId,
    draft: {
      ...draft,
      nodes: [...draft.nodes, { id: nodeId, type: value.type, title: value.title.trim(), detail: value.detail.trim(), ...nextStudioNodePosition(draft.nodes, related) }],
      links: [...draft.links, { id: nextStudioLinkId(draft.links), from: value.type === 'trigger' ? nodeId : related.id, to: value.type === 'trigger' ? related.id : nodeId }],
    },
  };
}
