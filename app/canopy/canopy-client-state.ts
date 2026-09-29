import { CANOPY_SCENARIOS, CANOPY_UNAVAILABLE, CANOPY_TITLE, type CanopyScenarioId, type buildCanopyPackage } from "../canopy-fixture";
import type { CanopyTransport, Session } from "../canopy-workflow";
import { safeWorkspaceReturn } from "../workspace-navigation";

/** URL values select a view only; the existing server still authorizes the dossier. */
export function readCanopyLocation(current: string) {
  const url = new URL(safeWorkspaceReturn(current), "https://workspace.invalid");
  const id = url.searchParams.get("dossier");
  if (url.pathname !== "/canopy" || !id || id.length > 240 || /[\s/\\]/u.test(id)) return null;
  const scenario = url.searchParams.get("scenario");
  return { id, scenario: [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE].some(item => item.id === scenario) ? scenario as CanopyScenarioId : "base" as const };
}

export function canopyWorkingCopyPath(current: string, id: string, scenario: CanopyScenarioId, run?: string) {
  const url = new URL(safeWorkspaceReturn(current, "/canopy"), "https://workspace.invalid");
  url.pathname = "/canopy";
  url.searchParams.set("dossier", id);
  url.searchParams.set("scenario", scenario);
  if (run) url.searchParams.set("run", run); else url.searchParams.delete("run");
  // Moving to another copy must not retain an anchor or an unrelated return target.
  url.hash = "";
  url.searchParams.delete("return_to");
  return url.pathname + url.search;
}

export type CanopyListItem = { dossier_id: string; title: string; updated_at: string };

export async function loadCanopyCopies(api: CanopyTransport, signal?: AbortSignal) {
  const response = await api("/api/dossiers?q=" + encodeURIComponent(CANOPY_TITLE) + "&limit=25", { signal });
  if (!response.ok) throw new Error("Canopy list request failed: " + response.status);
  const data = await response.json() as { dossiers?: CanopyListItem[] };
  if (!Array.isArray(data.dossiers)) throw new Error("Canopy list response is invalid");
  return data.dossiers.filter(item => typeof item.dossier_id === "string" && typeof item.title === "string" && item.title.startsWith(CANOPY_TITLE));
}

/** Presentation only. Server authorization, evidence and publication gates still apply. */
export function canopyRunStatus(session: Session | null, prepared: ReturnType<typeof buildCanopyPackage>) {
  if (!session) return "none";
  if (session.caseId !== prepared.scenario.caseId || session.version !== prepared.scenario.version || session.fingerprint !== prepared.scenario.fingerprint) return "mismatch";
  const stage = prepared.scenario.stages.find(item => item.id === session.state.currentStageId);
  if (!stage) return "mismatch";
  if (session.status === "active" && !stage.terminal) return "active";
  if (session.status !== "completed" || !stage.terminal || !session.completedAt || !Number.isFinite(Date.parse(session.completedAt))) return "mismatch";
  return stage.id === "studio-" + prepared.declaration.terminal ? "completed" : "unexpected";
}
