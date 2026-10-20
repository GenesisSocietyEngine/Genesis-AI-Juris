/** Metadata-only literal search. No SQL wildcard or document-body semantics. */
export function studioCaseQuery(value: string): string | null {
  if (value.length > 120 || /[\u0000-\u001f\u007f]|[\ud800-\udfff]/u.test(value)) return null;
  return value.trim().toLowerCase();
}

