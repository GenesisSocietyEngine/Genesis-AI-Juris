import assert from "node:assert/strict";

type JsonRecord = Record<string, unknown>;

export const REPORT_PDF_BASELINE_ARTIFACT_ROOT = ".artifacts/v62-report-qa";

function record(value: unknown, context: string): JsonRecord {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${context} must be an object`);
  return value as JsonRecord;
}

function text(value: unknown, context: string): string {
  assert.ok(typeof value === "string" && value.length > 0, `${context} must be a non-empty string`);
  return value;
}

function portablePath(value: unknown, context: string): string {
  const path = text(value, context);
  assert.ok(!/[\\:\u0000-\u001f]/u.test(path) && path.split("/").every((part) => part && part !== "." && part !== ".."), `${context} must be a portable relative path without traversal`);
  return path;
}

function artifactRoot(value: string): string {
  const root = portablePath(value, "PDF artifact root");
  assert.ok(root.startsWith(".artifacts/"), "PDF artifact root must be a child of .artifacts");
  return root;
}

function entryKey(entry: JsonRecord, context: string): string {
  const cohort = text(entry.cohort, `${context}.cohort`);
  const fixtureId = text(entry.fixtureId, `${context}.fixtureId`);
  const pageRole = text(entry.pageRole, `${context}.pageRole`);
  return pageRole === "graph"
    ? `${cohort}|${fixtureId}|graph|${text(entry.graphPageId, `${context}.graphPageId`)}`
    : `${cohort}|${fixtureId}|${pageRole}`;
}

function entriesByKey(value: unknown, declaredRoot: string | undefined, context: string): Map<string, JsonRecord> {
  assert.ok(Array.isArray(value) && value.length > 0, `${context} must contain selected page hashes`);
  const result = new Map<string, JsonRecord>();
  let root = declaredRoot;
  for (const [index, item] of value.entries()) {
    const label = `${context}[${index}]`;
    const entry = record(item, label);
    const key = entryKey(entry, label);
    assert.ok(!result.has(key), `${context} duplicates ${key}`);
    const path = portablePath(entry.pngPath, `${label}.pngPath`);
    if (root === undefined) root = artifactRoot(path.slice(0, path.lastIndexOf("/png/")));
    assert.ok(path.startsWith(`${root}/`), `${label}.pngPath is outside its declared artifact root`);
    const suffix = path.slice(root.length + 1);
    const page = /^png\/([^/]+)\/page-(\d+)\.png$/u.exec(suffix);
    assert.ok(page && page[1] === entry.fixtureId && Number.isSafeInteger(entry.reportPage) && Number(entry.reportPage) > 0 && Number(page[2]) === entry.reportPage, `${label}.pngPath must identify its exact fixture and report page`);
    // The output directory locates an artifact; the suffix, hash and all governed
    // page metadata remain part of exact visual identity.
    result.set(key, { ...entry, pngPath: suffix });
  }
  return result;
}

export function assertReportPdfVisualBaseline(expectedValue: unknown, currentValue: unknown, currentArtifactRoot: string): number {
  const expected = record(expectedValue, "PDF visual baseline");
  const current = record(currentValue, "Current PDF visual baseline");
  const expectedMetadata = { ...expected };
  const currentMetadata = { ...current };
  delete expectedMetadata.entries;
  delete currentMetadata.entries;
  assert.deepEqual(expectedMetadata, currentMetadata, "PDF visual baseline metadata changed; inspect the final corpus before an intentional update");
  const expectedByKey = entriesByKey(expected.entries, undefined, "PDF visual baseline.entries");
  const currentByKey = entriesByKey(current.entries, artifactRoot(currentArtifactRoot), "Current PDF visual baseline.entries");
  assert.deepEqual([...expectedByKey.keys()].sort(), [...currentByKey.keys()].sort(), "PDF visual baseline page selection changed; inspect before an intentional update");
  for (const [key, entry] of currentByKey) {
    assert.deepEqual(expectedByKey.get(key), entry, `PDF visual regression for ${key}; PNG hash or governed page metadata changed`);
  }
  return currentByKey.size;
}
