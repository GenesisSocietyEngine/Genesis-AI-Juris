import type { StudioLink, StudioNode } from "./types";

export const STUDIO_NODE_WIDTH = 165;
export const STUDIO_NODE_HEIGHT = 96;
const COLUMN_PITCH = 285;
const ROW_GAP = 42;
const PADDING_X = 46;
const PADDING_Y = 70;

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
  const columnOrder = [...columns.keys()].sort((a, b) => a - b);
  const rank = new Map<string, number>();
  const refreshRanks = () => {
    for (const column of columnOrder) (columns.get(column) ?? []).forEach((id, index) => rank.set(id, index));
  };
  const neighbourRank = (id: string, neighbours: Map<string, string[]>) => {
    const positions = (neighbours.get(id) ?? []).map((neighbour) => rank.get(neighbour)).filter((value): value is number => value !== undefined);
    return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : Number.POSITIVE_INFINITY;
  };
  refreshRanks();
  // Repeated forward/backward barycentric sweeps keep related branches close
  // while remaining deterministic. This materially reduces relation tangles
  // on wide AI-authored graphs without sacrificing the topology layers.
  for (let pass = 0; pass < 4; pass += 1) {
    for (const column of columnOrder.slice(1)) {
      const values = columns.get(column) ?? [];
      values.sort((left, right) => neighbourRank(left, incoming) - neighbourRank(right, incoming) || byOriginalOrder(left, right));
      refreshRanks();
    }
    for (const column of columnOrder.slice(0, -1).reverse()) {
      const values = columns.get(column) ?? [];
      values.sort((left, right) => neighbourRank(left, outgoing) - neighbourRank(right, outgoing) || byOriginalOrder(left, right));
      refreshRanks();
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const columnHeight = (values: string[]) => values.reduce((sum, id) => sum + studioNodeEstimatedHeight(nodeById.get(id)), 0) + Math.max(0, values.length - 1) * ROW_GAP;
  const contentHeight = Math.max(STUDIO_NODE_HEIGHT, ...[...columns.values()].map(columnHeight));
  const positions = new Map<string, { x: number; y: number }>();
  for (const [column, values] of columns) {
    let y = PADDING_Y + Math.max(0, (contentHeight - columnHeight(values)) / 2);
    for (const id of values) {
      positions.set(id, { x: PADDING_X + column * COLUMN_PITCH, y });
      y += studioNodeEstimatedHeight(nodeById.get(id)) + ROW_GAP;
    }
  }
  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? { x: node.x, y: node.y }) }));
}

/** Conservative card-height estimate used before the browser has rendered a
 * node. Long titles and runtime summaries otherwise make a visually taller
 * card than a fixed-slot layout reserves. */
export function studioNodeEstimatedHeight(node: StudioNode | undefined) {
  if (!node) return STUDIO_NODE_HEIGHT;
  const titleLines = Math.max(1, Math.ceil(node.title.trim().length / 18));
  const hasRuntimeSummary = node.runtime?.budgetCostEur !== undefined || node.runtime?.durationMinutes !== undefined;
  return Math.max(STUDIO_NODE_HEIGHT, 40 + titleLines * 17 + (hasRuntimeSummary ? 22 : 0));
}

export function studioGraphBounds(nodes: StudioNode[]): StudioGraphBounds {
  const maxX = nodes.reduce((value, node) => Math.max(value, node.x + STUDIO_NODE_WIDTH), 0);
  const maxY = nodes.reduce((value, node) => Math.max(value, node.y + studioNodeEstimatedHeight(node)), 0);
  return { width: Math.max(1_200, Math.ceil(maxX + PADDING_X)), height: Math.max(570, Math.ceil(maxY + PADDING_Y)) };
}

export function studioNodesOverlap(left: StudioNode, right: StudioNode, gap = 16) {
  const leftHeight = studioNodeEstimatedHeight(left);
  const rightHeight = studioNodeEstimatedHeight(right);
  return left.x < right.x + STUDIO_NODE_WIDTH + gap
    && left.x + STUDIO_NODE_WIDTH + gap > right.x
    && left.y < right.y + rightHeight + gap
    && left.y + leftHeight + gap > right.y;
}
