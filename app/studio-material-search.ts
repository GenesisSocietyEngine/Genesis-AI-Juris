import type { StudioMaterial } from './studio-materials';

export const MATERIAL_SEARCH_LIMITS = { query: 256, materials: 1000, body: 200_000, totalBody: 2_000_000, metadata: 4096 } as const;
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
type IndexedMaterial = { item: StudioMaterial; metadata: string; body: string; original: string };
export type MaterialSearchMatch = { item: StudioMaterial; passage?: { from: number; to: number; section?: string; before: string; exact: string; after: string; leading: boolean; trailing: boolean } };

/** Bounded reading index only; never changes document bytes or evidence state. */
export function indexStudioMaterials(items: StudioMaterial[]) {
  let budget: number = MATERIAL_SEARCH_LIMITS.totalBody, limitedMaterials = Math.max(0, items.length - MATERIAL_SEARCH_LIMITS.materials);
  const entries: IndexedMaterial[] = items.slice(0, MATERIAL_SEARCH_LIMITS.materials).map(item => {
    const metadata = `${item.title} ${item.note}`, body = item.text ?? '';
    let length = Math.min(body.length, MATERIAL_SEARCH_LIMITS.body, budget);
    if (length && /[\uD800-\uDBFF]/.test(body[length - 1])) length--;
    budget -= length;
    if (length < body.length || metadata.length > MATERIAL_SEARCH_LIMITS.metadata) limitedMaterials++;
    return { item, metadata: fold(metadata.slice(0, MATERIAL_SEARCH_LIMITS.metadata)), body: fold(body.slice(0, length)), original: body };
  });
  return { entries, limitedMaterials };
}

function originalRange(text: string, from: number, to: number) {
  let normalized = 0, offset = 0, start = -1;
  for (const point of text) {
    const width = fold(point).length;
    if (start < 0 && width && normalized >= from) start = offset;
    normalized += width; offset += point.length;
    if (normalized >= to) {
      while (offset < text.length && /\p{M}/u.test(text[offset])) offset++;
      return { from: Math.max(0, start), to: offset };
    }
  }
  return { from: Math.max(0, start), to: offset };
}

export function searchStudioMaterials(index: ReturnType<typeof indexStudioMaterials>, query: string): MaterialSearchMatch[] {
  const needle = fold(query.trim());
  if (query.length > MATERIAL_SEARCH_LIMITS.query || query.trim() && !needle) return [];
  return index.entries.flatMap(entry => {
    if (!needle) return [{ item: entry.item }];
    const found = entry.body.indexOf(needle);
    if (found < 0) return entry.metadata.includes(needle) ? [{ item: entry.item }] : [];
    const range = originalRange(entry.original, found, found + needle.length);
    // Section identities are supplied by the retained document, never inferred from a newer source.
    const sourceSection = Object.entries(entry.item.sections ?? {}).find(([name, text]) => {
      const header = `## ${name}\n\n`, headerAt = entry.original.indexOf(header);
      const start = headerAt < 0 ? -1 : headerAt + header.length;
      return start >= 0 && entry.original.slice(start, start + text.length) === text && range.from >= start && range.to <= start + text.length;
    });
    const section = sourceSection?.[0];
    const sectionStart = sourceSection ? entry.original.indexOf(`## ${section}\n\n`) + `## ${section}\n\n`.length : 0;
    const sectionEnd = sourceSection ? sectionStart + sourceSection[1].length : entry.original.length;
    let start = Math.max(sectionStart, range.from - 70), end = Math.min(sectionEnd, range.to + 100);
    if (start && /[\uDC00-\uDFFF]/.test(entry.original[start])) start--;
    if (end < entry.original.length && /[\uD800-\uDBFF]/.test(entry.original[end - 1])) end++;
    return [{ item: entry.item, passage: { ...range, section, before: entry.original.slice(start, range.from), exact: entry.original.slice(range.from, range.to), after: entry.original.slice(range.to, end), leading: start > sectionStart, trailing: end < sectionEnd } }];
  });
}

export type MaterialReadingState = { query: string; filter: string; history: boolean; limit: number; returnTo?: { key: string; scrollY: number; viewportTop?: number } };
/** Owned by the current application context; discarded on draft/locale/authority changes. */
export function createMaterialReadingMemory(context: { draft: object; locale: string; epoch?: number; allowed?: boolean }) {
  let current: MaterialReadingState | null = null;
  return {
    context,
    read: () => current,
    write: (next: MaterialReadingState) => { current = { ...next, returnTo: next.returnTo ? { ...next.returnTo } : undefined }; },
    takeReturn: () => { const target = current?.returnTo; if (current) current = { ...current, returnTo: undefined }; return target; },
  };
}
export type MaterialReadingMemory = ReturnType<typeof createMaterialReadingMemory>;
