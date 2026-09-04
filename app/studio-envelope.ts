export const STUDIO_CASE_BODY_LIMIT = 1_000_000;

// Leaves room for the request wrapper, a 64k author instruction and small
// publication metadata while keeping every Studio boundary below 1 MB.
export const STUDIO_DRAFT_SERIALIZED_LIMIT = 900_000;

export function studioJsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
