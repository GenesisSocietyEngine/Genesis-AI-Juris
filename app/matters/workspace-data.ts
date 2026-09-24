import { apiIssueFor, nextPageCursor, normalizeActivity, normalizeAnchors, normalizeAssertions, normalizeDocuments, normalizeMatterDetail, normalizeOutputs, normalizePackages, normalizeProposals, normalizeRequests, normalizeSnapshots, type ActivityItem, type ApiIssue, type DeadlineItem, type DecisionPackageItem, type DocumentItem, type MatterDetail, type OutputItem, type ProposalItem, type RequestItem, type SnapshotItem } from "./matter-view-model";

export type ResourceKey = "documents" | "requests" | "proposals" | "packages" | "snapshots" | "outputs" | "activity" | "anchors" | "assertions";
export type WorkspaceBundle = { matter: MatterDetail; documents: DocumentItem[]; requests: RequestItem[]; deadlines: DeadlineItem[]; proposals: ProposalItem[]; packages: DecisionPackageItem[]; snapshots: SnapshotItem[]; outputs: OutputItem[]; activity: ActivityItem[]; activityCursor: string | null; proposalCursor: string | null; issues: Partial<Record<ResourceKey, ApiIssue>>; complete: boolean };
export class WorkspaceApiError extends Error {
  constructor(readonly status: number, readonly payload: unknown) { super("The workspace request could not be completed."); }
}
export const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const workspaceIssue = (error: unknown) => error instanceof WorkspaceApiError ? apiIssueFor(error.status, error.payload) : apiIssueFor(500, { message: "The case view could not be updated. Your confirmed saves remain recorded." });
type Read = (path: string, init?: RequestInit) => Promise<unknown>;
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(item => [item.id, item])).values()];

/** Fetch case-level pages only. A safety bound is explicit incompleteness, never
 * an invented authoritative total. No initial-page slice drives queue counts. */
async function pages(read: Read, path: string, paged: boolean, key: ResourceKey) {
  const payloads: unknown[] = [], cursors = new Set<string>();
  let next: string | null = null;
  do {
    const payload = await read(path + (next ? (path.includes("?") ? "&" : "?") + "cursor=" + encodeURIComponent(next) : ""));
    const source = object(payload), data = object(source.data), page = object(source.page ?? data.page);
    const fields: Record<ResourceKey, string[]> = { documents: ["documents"], requests: ["requests", "information_requests"], proposals: ["proposals", "ai_proposals"], packages: ["decision_packages", "packages"], snapshots: ["snapshots"], outputs: ["outputs"], activity: ["events", "activity", "audit_events"], anchors: ["source_anchors", "anchors"], assertions: ["assertions", "professional_assertions"] };
    const rows = fields[key].map(field => source[field] ?? data[field]).find(Array.isArray);
    if (!rows || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid " + key + " response envelope");
    const identities: Record<ResourceKey, string[]> = { documents: ["document_id", "id"], requests: ["information_request_id", "request_id", "id"], proposals: ["proposal_id", "id"], packages: ["decision_package_reference_id", "reference_id", "id"], snapshots: ["snapshot_id", "id"], outputs: ["output_id", "id"], activity: ["audit_event_id", "event_id", "id"], anchors: ["source_anchor_id", "id"], assertions: ["assertion_id", "id"] };
    if (rows.some(row => !identities[key].some(field => typeof row[field] === "string" && row[field].length > 0))) throw new Error("Missing " + key + " record identity");
    payloads.push(payload);
    next = paged ? nextPageCursor(payload) : null;
    if (page.has_more === true && !next) throw new Error("Incomplete pagination envelope");
    if (next && cursors.has(next)) throw new Error("Repeated page cursor");
    if (next) cursors.add(next);
    if (object(source.limits).truncated === true) return { payloads, complete: false };
  } while (next && payloads.length < 100);
  return { payloads, complete: !next };
}

export async function loadWorkspaceData(caseId: string, read: Read, initial?: unknown): Promise<WorkspaceBundle> {
  const base = "/api/dossiers/" + encodeURIComponent(caseId);
  const first = initial ?? await read(base);
  const matter = normalizeMatterDetail(first);
  if (!matter || matter.id !== caseId) throw new Error("Unverified case identity");
  const specs: Array<[ResourceKey, string, boolean]> = [
    ["documents", "/documents", false], ["requests", "/requests?limit=50", true],
    ["proposals", "/proposals?limit=100", true], ["packages", "/decision-packages?limit=100", true],
    ["snapshots", "/snapshots", false], ["outputs", "/outputs", false], ["activity", "/activity?limit=100", false],
    ["anchors", "/evidence/anchors?limit=100", true], ["assertions", "/evidence/assertions?limit=100", true],
  ];
  const results = await Promise.all(specs.map(async ([key, path, paged]) => {
    try { return { key, ...await pages(read, base + path, paged, key), error: null }; }
    catch (error) {
      if (error instanceof WorkspaceApiError && error.status === 401 || error instanceof DOMException && error.name === "AbortError") throw error;
      return { key, payloads: [], complete: false, error };
    }
  }));
  const payload = (key: ResourceKey) => results.find(row => row.key === key)!.payloads;
  const issues: WorkspaceBundle["issues"] = {};
  for (const row of results) if (row.error) issues[row.key] = workspaceIssue(row.error);
  const requests = payload("requests").map(normalizeRequests);
  const anchors = unique(payload("anchors").flatMap(normalizeAnchors));
  const assertions = unique(payload("assertions").flatMap(normalizeAssertions));
  const snapshots = unique(payload("snapshots").flatMap(normalizeSnapshots));
  const outputs = unique(payload("outputs").flatMap(normalizeOutputs));
  // Revalidate after all pages; resources from different revisions must not be
  // presented as a current queue. A user can retry this read without any write.
  const latest = normalizeMatterDetail(await read(base));
  if (!latest || latest.id !== caseId || latest.revision !== matter.revision) throw new Error("The case changed while its action pages were loading");
  const activity = payload("activity").map(normalizeActivity);
  return { matter: { ...latest, anchors, assertions },
    documents: unique(payload("documents").flatMap(normalizeDocuments)),
    requests: unique(requests.flatMap(row => row.requests)), deadlines: unique(requests.flatMap(row => row.deadlines)),
    proposals: unique(payload("proposals").flatMap(normalizeProposals)), packages: unique(payload("packages").flatMap(normalizePackages)),
    snapshots, outputs, activity: unique(activity.flatMap(row => row.items)), activityCursor: activity[0]?.nextCursor ?? null, proposalCursor: null,
    issues, complete: results.filter(row => row.key !== "activity").every(row => row.complete) && snapshots.length < 100 && outputs.length < 500,
  };
}
