export const DEFAULT_CATALOGUE_LIMIT = 24;
export const MAX_CATALOGUE_LIMIT = 50;

const MAX_CURSOR_LENGTH = 4_096;
const MAX_QUERY_LENGTH = 120;
const MAX_CLASSIFICATION_LENGTH = 100;
const MAX_TAG_LENGTH = 48;
const MAX_TAGS = 10;
const MAX_CASE_ID_LENGTH = 128;
const CASE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export interface CatalogueFilters {
  q?: string;
  jurisdiction?: string;
  practiceArea?: string;
  difficulty?: string;
  tags: string[];
}

export interface CatalogueCursor {
  id: string;
}

export interface CatalogueQuery {
  limit: number;
  cursor: CatalogueCursor | null;
  filters: CatalogueFilters;
}

export type CatalogueQueryResult =
  | { ok: true; value: CatalogueQuery }
  | { ok: false; error: string };

interface EncodedCursor {
  v: 1;
  id: string;
  filters: string;
}

function normalizedText(value: string | null, maxLength: number, label: string): { value?: string; error?: string } {
  if (value === null) return {};
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "all") return {};
  if (normalized.length > maxLength) return { error: `${label} is too long.` };
  if (/\p{Cc}/u.test(normalized)) return { error: `${label} contains control characters.` };
  return { value: normalized };
}

function singleParameter(searchParams: URLSearchParams, name: string): { value: string | null; error?: string } {
  const values = searchParams.getAll(name);
  if (values.length > 1) return { value: null, error: `${name} must be provided at most once.` };
  return { value: values[0] ?? null };
}

function canonicalFilterKey(filters: CatalogueFilters): string {
  return JSON.stringify({
    q: filters.q?.toLowerCase() ?? "",
    jurisdiction: filters.jurisdiction ?? "",
    practiceArea: filters.practiceArea ?? "",
    difficulty: filters.difficulty ?? "",
    tags: filters.tags.map((tag) => tag.toLowerCase()).sort(),
  });
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid base64url input.");
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function encodeCatalogueCursor(cursor: CatalogueCursor, filters: CatalogueFilters): string {
  if (cursor.id.length > MAX_CASE_ID_LENGTH || !CASE_ID_PATTERN.test(cursor.id)) throw new Error("A catalogue cursor requires a valid case ID.");
  const payload: EncodedCursor = { v: 1, id: cursor.id, filters: canonicalFilterKey(filters) };
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeCatalogueCursor(value: string, filters: CatalogueFilters): CatalogueCursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH) return null;
  try {
    const candidate = JSON.parse(decodeBase64Url(value)) as Partial<EncodedCursor>;
    if (candidate.v !== 1 || typeof candidate.id !== "string" || candidate.id.length > MAX_CASE_ID_LENGTH || !CASE_ID_PATTERN.test(candidate.id)) return null;
    if (candidate.filters !== canonicalFilterKey(filters)) return null;
    return { id: candidate.id };
  } catch {
    return null;
  }
}

export function parseCatalogueQuery(searchParams: URLSearchParams): CatalogueQueryResult {
  const limitParameter = singleParameter(searchParams, "limit");
  if (limitParameter.error) return { ok: false, error: limitParameter.error };
  let limit = DEFAULT_CATALOGUE_LIMIT;
  if (limitParameter.value !== null) {
    if (!/^[1-9]\d{0,5}$/u.test(limitParameter.value)) return { ok: false, error: "limit must be a positive integer." };
    limit = Math.min(Number(limitParameter.value), MAX_CATALOGUE_LIMIT);
  }

  const qParameter = singleParameter(searchParams, "q");
  const jurisdictionParameter = singleParameter(searchParams, "jurisdiction");
  const practiceAreaParameter = singleParameter(searchParams, "practiceArea");
  const difficultyParameter = singleParameter(searchParams, "difficulty");
  const cursorParameter = singleParameter(searchParams, "cursor");
  for (const parameter of [qParameter, jurisdictionParameter, practiceAreaParameter, difficultyParameter, cursorParameter]) {
    if (parameter.error) return { ok: false, error: parameter.error };
  }

  const q = normalizedText(qParameter.value, MAX_QUERY_LENGTH, "q");
  const jurisdiction = normalizedText(jurisdictionParameter.value, MAX_CLASSIFICATION_LENGTH, "jurisdiction");
  const practiceArea = normalizedText(practiceAreaParameter.value, MAX_CLASSIFICATION_LENGTH, "practiceArea");
  const difficulty = normalizedText(difficultyParameter.value, MAX_CLASSIFICATION_LENGTH, "difficulty");
  for (const parameter of [q, jurisdiction, practiceArea, difficulty]) {
    if (parameter.error) return { ok: false, error: parameter.error };
  }

  const tagValues = [...searchParams.getAll("tag"), ...searchParams.getAll("tags")]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value && value.toLowerCase() !== "all");
  if (tagValues.length > MAX_TAGS) return { ok: false, error: `At most ${MAX_TAGS} tags may be filtered.` };
  if (tagValues.some((tag) => tag.length > MAX_TAG_LENGTH || /\p{Cc}/u.test(tag))) {
    return { ok: false, error: `Each tag must contain at most ${MAX_TAG_LENGTH} characters and no control characters.` };
  }
  const seenTags = new Set<string>();
  const tags = tagValues.filter((tag) => {
    const key = tag.toLowerCase();
    if (seenTags.has(key)) return false;
    seenTags.add(key);
    return true;
  });
  const filters: CatalogueFilters = {
    ...(q.value ? { q: q.value } : {}),
    ...(jurisdiction.value ? { jurisdiction: jurisdiction.value } : {}),
    ...(practiceArea.value ? { practiceArea: practiceArea.value } : {}),
    ...(difficulty.value ? { difficulty: difficulty.value } : {}),
    tags,
  };

  let cursor: CatalogueCursor | null = null;
  if (cursorParameter.value !== null) {
    cursor = decodeCatalogueCursor(cursorParameter.value, filters);
    if (!cursor) return { ok: false, error: "cursor is invalid or belongs to different filters." };
  }
  return { ok: true, value: { limit, cursor, filters } };
}

export function fingerprintEtag(fingerprint: string): string {
  if (!/^(?:sha256-)?[a-f0-9]{64}$/u.test(fingerprint)) throw new Error("Published case fingerprint is invalid.");
  return `"${fingerprint}"`;
}

export function ifNoneMatchMatches(headerValue: string | null, etag: string): boolean {
  if (!headerValue) return false;
  const normalizedTarget = etag.replace(/^W\//u, "");
  return headerValue.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized.replace(/^W\//u, "") === normalizedTarget;
  });
}

export function manifestCacheControl(versionPinned: boolean): string {
  return versionPinned
    ? "public, max-age=31536000, immutable"
    : "public, max-age=60, stale-while-revalidate=300";
}
