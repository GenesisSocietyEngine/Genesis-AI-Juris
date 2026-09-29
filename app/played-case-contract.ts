export const PLAYED_CASE_SCHEMA_REVISION = 3 as const;

export type SupportedPlayedCaseSchemaRevision = 1 | 2 | typeof PLAYED_CASE_SCHEMA_REVISION;

export function isSupportedPlayedCaseSchemaRevision(value: unknown): value is SupportedPlayedCaseSchemaRevision {
  return value === 1 || value === 2 || value === PLAYED_CASE_SCHEMA_REVISION;
}
