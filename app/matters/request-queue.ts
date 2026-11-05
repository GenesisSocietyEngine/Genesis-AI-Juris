import type { RequestItem } from "./matter-view-model";

export type RequestQueueFilters = { query: string; status: string; priority: string; responsible: string };
export const EMPTY_REQUEST_FILTERS: RequestQueueFilters = { query: "", status: "all", priority: "all", responsible: "all" };
export type RequestGroup = "overdue" | "upcoming" | "undated" | "resolved" | "other";
export const REQUEST_GROUPS: RequestGroup[] = ["overdue", "upcoming", "undated", "resolved", "other"];

export function requestResponsibleKey(request: RequestItem): string {
  if (request.requestedFromParticipantId) return "participant:" + request.requestedFromParticipantId;
  return request.requestedFrom ? "label:" + request.requestedFrom : "unassigned";
}
export function requestDueTime(request: RequestItem): number | null {
  const time = request.dueAt ? Date.parse(request.dueAt) : NaN;
  return Number.isFinite(time) ? time : null;
}
export function requestGroup(request: RequestItem, now: number): RequestGroup {
  if (["received", "waived", "cancelled"].includes(request.status)) return "resolved";
  if (request.status !== "open") return "other";
  const due = requestDueTime(request);
  return due === null ? "undated" : due < now ? "overdue" : "upcoming";
}
export function selectRequestQueue(requests: RequestItem[], filters: RequestQueueFilters, now: number): RequestItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return requests.filter(request => {
    if (filters.status !== "all" && (filters.status === "overdue" ? requestGroup(request, now) !== "overdue" : request.status !== filters.status)) return false;
    if (filters.priority !== "all" && request.priority !== filters.priority) return false;
    if (filters.responsible !== "all" && requestResponsibleKey(request) !== filters.responsible) return false;
    return !query || [request.question, request.reason, request.requestedFrom ?? "", request.id].some(value => value.toLocaleLowerCase().includes(query));
  }).sort((a, b) => (requestDueTime(a) ?? Infinity) - (requestDueTime(b) ?? Infinity) || a.id.localeCompare(b.id));
}
