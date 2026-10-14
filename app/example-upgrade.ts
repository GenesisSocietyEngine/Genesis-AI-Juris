import { canonicalFingerprint, caseFingerprint, normalizeStudioDraft } from "./case-integrity";
import { buildExampleProvenance } from "./example-provenance";
import { exampleDescriptor, prepareExample, prepareExampleVersion, type ExampleId } from "./example-registry";
import { createExampleWorkingCopy } from "./example-working-copy";
import type { StudioDraft } from "./types";

export type ExampleChange = { area: "record" | "connection" | "context"; id: string; before: unknown; after: unknown };
export type ExampleUpgrade = { packageId: ExampleId; fromVersion: string; toVersion: string; workingFingerprint: string; targetFingerprint: string; changes: ExampleChange[]; localChanges: ExampleChange[]; language: "en" | "ru" };
const nodeContent = (node: StudioDraft["nodes"][number]) => ({ ...node, x: undefined, y: undefined });
function connectionContent(draft: StudioDraft) {
  const counts = new Map<string, number>();
  return [...draft.links].sort((a, b) => canonicalFingerprint(a.rule ?? null).localeCompare(canonicalFingerprint(b.rule ?? null))).map(({ from, to, rule }) => {
    const key = from + " → " + to, index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return { id: key + (index ? " #" + (index + 1) : ""), from, to, rule };
  });
}

/** Semantic comparison retains tax, classification, source and approval relationships.
 * It does not treat a graph layout or a save timestamp as a template amendment. */
export function compareExampleContent(before: StudioDraft, after: StudioDraft): ExampleChange[] {
  const changes: ExampleChange[] = [];
  const add = (area: ExampleChange["area"], id: string, a: unknown, b: unknown) => {
    if (canonicalFingerprint(a ?? null) !== canonicalFingerprint(b ?? null)) changes.push({ area, id, before: a ?? null, after: b ?? null });
  };
  for (const [area, a, b] of [["record", before.nodes.map(nodeContent), after.nodes.map(nodeContent)], ["connection", connectionContent(before), connectionContent(after)]] as const) {
    const left = new Map(a.map(item => [item.id, item])), right = new Map(b.map(item => [item.id, item]));
    for (const id of new Set([...left.keys(), ...right.keys()])) add(area, id, left.get(id), right.get(id));
  }
  const identity = new Set(["nodes", "links", "caseId", "version", "updatedAt", "parent", "exampleSource", "protection", "editHistory"]);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!identity.has(key)) add("context", key, before[key as keyof StudioDraft], after[key as keyof StudioDraft]);
  }
  return changes;
}

export async function prepareExampleUpgrade(draft: StudioDraft): Promise<ExampleUpgrade | null> {
  const manifest = await buildExampleProvenance(draft);
  if (!manifest || manifest.status.integrityIssues.length) return null;
  const id = manifest.source.packageId as ExampleId, descriptor = exampleDescriptor(id);
  if (manifest.source.version === descriptor.source.version) return null;
  const historic = normalizeStudioDraft((await prepareExampleVersion(id, manifest.source.language, manifest.source.version)).draft);
  const target = normalizeStudioDraft((await prepareExample(id, manifest.source.language)).draft);
  return { packageId: id, fromVersion: historic.version, toVersion: target.version, language: manifest.source.language,
    workingFingerprint: caseFingerprint(draft), targetFingerprint: caseFingerprint(target),
    changes: compareExampleContent(historic, target), localChanges: compareExampleContent(historic, draft) };
}

/** Reverify source, working content and authority on acceptance. No persistence or mutation. */
export async function createReviewedExampleUpgrade(draft: StudioDraft, review: ExampleUpgrade, current: () => boolean): Promise<StudioDraft | null> {
  if (!current() || caseFingerprint(draft) !== review.workingFingerprint) return null;
  const fresh = await prepareExampleUpgrade(draft);
  if (!current() || !fresh || canonicalFingerprint(fresh) !== canonicalFingerprint(review)) return null;
  const { draft: target } = await prepareExample(review.packageId, review.language);
  if (!current() || caseFingerprint(normalizeStudioDraft(target)) !== review.targetFingerprint) return null;
  return createExampleWorkingCopy(target);
}
