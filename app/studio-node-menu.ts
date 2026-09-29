import type { StudioNode } from "./types";

/**
 * A relation row used to render every node twice (source and destination).
 * Keeping this page deliberately small bounds the DOM even at the 200-node
 * Studio envelope; search and paging keep every node reachable.
 */
export const STUDIO_NODE_MENU_PAGE_SIZE = 12;

export type StudioNodeMenuPage = {
  nodes: StudioNode[];
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
};

export function studioNodeMenuPage(nodes: readonly StudioNode[], query: string, requestedPage: number, pageSize = STUDIO_NODE_MENU_PAGE_SIZE): StudioNodeMenuPage {
  const safePageSize = Math.max(1, Math.min(50, Math.trunc(pageSize) || STUDIO_NODE_MENU_PAGE_SIZE));
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? nodes
      .map((node, index) => ({ node, index, score: nodeMatchScore(node, needle) }))
      .filter((entry) => entry.score < 4)
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .map((entry) => entry.node)
    : [...nodes];
  const pageCount = Math.max(1, Math.ceil(matches.length / safePageSize));
  const page = Math.max(0, Math.min(pageCount - 1, Math.trunc(requestedPage) || 0));
  const offset = page * safePageSize;
  const pageNodes = matches.slice(offset, offset + safePageSize);
  return {
    nodes: pageNodes,
    page,
    pageCount,
    total: matches.length,
    start: matches.length ? offset + 1 : 0,
    end: Math.min(matches.length, offset + pageNodes.length),
  };
}

/** Keep a select's current value mounted while its other choices are paged. */
export function studioNodeMenuOptions(pageNodes: readonly StudioNode[], nodesById: ReadonlyMap<string, StudioNode>, pinnedId?: string | null) {
  const pinned = pinnedId ? nodesById.get(pinnedId) : undefined;
  if (!pinned || pageNodes.some((node) => node.id === pinned.id)) return [...pageNodes];
  return [pinned, ...pageNodes];
}

function nodeMatchScore(node: StudioNode, needle: string) {
  const title = node.title.toLocaleLowerCase();
  const id = node.id.toLocaleLowerCase();
  const type = node.type.toLocaleLowerCase().replaceAll("_", " ");
  if (title === needle || id === needle) return 0;
  if (title.startsWith(needle) || id.startsWith(needle) || type === needle) return 1;
  if (title.includes(needle) || id.includes(needle) || type.startsWith(needle)) return 2;
  if (`${type} ${title} ${id}`.includes(needle)) return 3;
  return 4;
}
