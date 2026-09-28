import type { ActivityItem, DocumentItem } from "./matter-view-model";

/** A loaded audit record can establish an exact historical acceptance. Its
 * absence (including partial/failed history) never establishes non-review. */
export function recordedDocumentAcceptance(document: DocumentItem, activity: ActivityItem[]) {
  const matches = activity.filter(event => event.objectType === "document" && event.objectId === document.id
    && event.reviewedDocumentVersionId && event.actorId && event.occurredAt)
    .sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0));
  const event = matches.find(item => item.reviewedDocumentVersionId === document.currentVersionId) ?? matches[0];
  if (!event) return null;
  return { event, version: document.versions.find(version => version.id === event.reviewedDocumentVersionId) ?? null,
    current: event.reviewedDocumentVersionId === document.currentVersionId };
}

/** Focus the excerpt container itself. Never target a descendant review action.
 * The caller retains the native hash link for scrolling, history and Back. */
export function focusSourceCitation(event: Pick<MouseEvent, "button" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "defaultPrevented">, anchorId: string, root: Pick<Document, "getElementById"> = document) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const target = root.getElementById("source-" + anchorId);
  if (!target) return false;
  target.focus({ preventScroll: true });
  return true;
}
