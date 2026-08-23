import type { StudioLink, StudioNode } from "./types";

export const STUDIO_NODE_WIDTH = 165;
export const STUDIO_NODE_HEIGHT = 96;
const COLUMN_PITCH = 250;
const ROW_PITCH = 132;
const PADDING_X = 46;
const PADDING_Y = 54;

export type StudioGraphBounds = { width: number; height: number };

/**
 * Deterministic layered layout for Studio graphs. It uses the graph topology
 * when possible and still gives cyclic or disconnected nodes unique slots.
 */
export function layoutStudioNodes(nodes: StudioNode[], links: StudioLink[]) {
  if (nodes.length < 2) return nodes.map((node) => ({ ...node }));
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const ids = new Set(order.keys());
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const link of links) {
    if (!ids.has(link.from) || !ids.has(link.to) || link.from === link.to) continue;
    outgoing.get(link.from)?.push(link.to);
    incoming.get(link.to)?.push(link.from);
  }
  const byOriginalOrder = (left: string, right: string) => (order.get(left) ?? 0) - (order.get(right) ?? 0);
  for (const values of outgoing.values()) values.sort(byOriginalOrder);
  for (const values of incoming.values()) values.sort(byOriginalOrder);

  const indegree = new Map(nodes.map((node) => [node.id, incoming.get(node.id)?.length ?? 0]));
  const layer = new Map(nodes.map((node) => [node.id, 0]));
  const ready = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id).sort(byOriginalOrder);
  const visited = new Set<string>();
  while (ready.length) {
    const id = ready.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const child of outgoing.get(id) ?? []) {
      layer.set(child, Math.max(layer.get(child) ?? 0, (layer.get(id) ?? 0) + 1));
      const remaining = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, remaining);
      if (remaining === 0) {
        ready.push(child);
        ready.sort(byOriginalOrder);
      }
    }
  }

  // Cycles are invalid for playable cases, but the editor must remain usable
  // while an author is repairing one. Put every remaining node in a unique,
  // deterministic column instead of allowing overlap.
  let fallbackLayer = Math.max(0, ...layer.values()) + 1;
  for (const node of nodes) if (!visited.has(node.id)) layer.set(node.id, fallbackLayer++);

  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const column = layer.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node.id]);
  }
  const positionInColumn = new Map<string, number>();
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const values = columns.get(column) ?? [];
    values.sort((left, right) => {
      const parentPosition = (id: string) => {
        const parents = incoming.get(id) ?? [];
        if (!parents.length) return Number.POSITIVE_INFINITY;
        const positions = parents.map((parent) => positionInColumn.get(parent)).filter((value): value is number => value !== undefined);
        return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : Number.POSITIVE_INFINITY;
      };
      const difference = parentPosition(left) - parentPosition(right);
      return Number.isFinite(difference) && difference !== 0 ? difference : byOriginalOrder(left, right);
    });
    values.forEach((id, index) => positionInColumn.set(id, index));
    columns.set(column, values);
  }

  const tallestColumn = Math.max(1, ...[...columns.values()].map((values) => values.length));
  const contentHeight = (tallestColumn - 1) * ROW_PITCH + STUDIO_NODE_HEIGHT;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [column, values] of columns) {
    const columnHeight = (values.length - 1) * ROW_PITCH + STUDIO_NODE_HEIGHT;
    const offsetY = PADDING_Y + Math.max(0, (contentHeight - columnHeight) / 2);
    values.forEach((id, index) => positions.set(id, { x: PADDING_X + column * COLUMN_PITCH, y: offsetY + index * ROW_PITCH }));
  }
  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? { x: node.x, y: node.y }) }));
}

export function studioGraphBounds(nodes: StudioNode[]): StudioGraphBounds {
  const maxX = nodes.reduce((value, node) => Math.max(value, node.x + STUDIO_NODE_WIDTH), 0);
  const maxY = nodes.reduce((value, node) => Math.max(value, node.y + STUDIO_NODE_HEIGHT), 0);
  return { width: Math.max(1_200, Math.ceil(maxX + PADDING_X)), height: Math.max(570, Math.ceil(maxY + PADDING_Y)) };
}

export function studioNodesOverlap(left: StudioNode, right: StudioNode, gap = 16) {
  return left.x < right.x + STUDIO_NODE_WIDTH + gap
    && left.x + STUDIO_NODE_WIDTH + gap > right.x
    && left.y < right.y + STUDIO_NODE_HEIGHT + gap
    && left.y + STUDIO_NODE_HEIGHT + gap > right.y;
}
