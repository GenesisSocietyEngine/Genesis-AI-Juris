export const STUDIO_WORKFLOW_STAGE_IDS = [
  "describe",
  "review_ai_draft",
  "facts_assumptions",
  "case_map",
  "run_compare",
  "report_save",
] as const;

export type StudioWorkflowStageId = typeof STUDIO_WORKFLOW_STAGE_IDS[number];
export type StudioWorkflowStep = 1 | 2 | 3 | 4 | 5 | 6;

export type StudioWorkflowState = {
  schemaVersion: 1;
  activeStage: StudioWorkflowStageId;
  completedStages: StudioWorkflowStageId[];
};

export type StudioWorkflowEvent =
  | { type: "open"; stage: StudioWorkflowStageId }
  | { type: "complete"; stage: StudioWorkflowStageId }
  | { type: "invalidate_from"; stage: StudioWorkflowStageId }
  | { type: "reset" };

export const initialStudioWorkflowState: StudioWorkflowState = {
  schemaVersion: 1,
  activeStage: "describe",
  completedStages: [],
};

export function studioWorkflowStep(stage: StudioWorkflowStageId): StudioWorkflowStep {
  return (STUDIO_WORKFLOW_STAGE_IDS.indexOf(stage) + 1) as StudioWorkflowStep;
}

export function studioWorkflowStage(step: number): StudioWorkflowStageId {
  const normalized = Math.max(1, Math.min(6, Math.trunc(step || 1)));
  return STUDIO_WORKFLOW_STAGE_IDS[normalized - 1];
}

export function reduceStudioWorkflow(state: StudioWorkflowState, event: StudioWorkflowEvent): StudioWorkflowState {
  if (event.type === "reset") return initialStudioWorkflowState;
  if (event.type === "open") return { ...state, activeStage: event.stage };
  if (event.type === "complete") {
    const completedStages = STUDIO_WORKFLOW_STAGE_IDS.filter((stage) => state.completedStages.includes(stage) || stage === event.stage);
    const currentIndex = STUDIO_WORKFLOW_STAGE_IDS.indexOf(event.stage);
    return { ...state, activeStage: STUDIO_WORKFLOW_STAGE_IDS[Math.min(5, currentIndex + 1)], completedStages };
  }
  const invalidIndex = STUDIO_WORKFLOW_STAGE_IDS.indexOf(event.stage);
  const completedStages = state.completedStages.filter((stage) => STUDIO_WORKFLOW_STAGE_IDS.indexOf(stage) < invalidIndex);
  return { ...state, activeStage: event.stage, completedStages };
}

export function studioWorkflowStorageKey(caseId: string): string {
  const scope = caseId.trim() || "new_case";
  return `genesis-juris:studio-workflow:v1:${scope}`;
}

export function parseStudioWorkflowStep(value: string | null | undefined): StudioWorkflowStep | null {
  if (!value) return null;
  const byId = STUDIO_WORKFLOW_STAGE_IDS.indexOf(value as StudioWorkflowStageId);
  if (byId >= 0) return (byId + 1) as StudioWorkflowStep;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 6 ? number as StudioWorkflowStep : null;
}

export function serializedStudioWorkflowStep(step: StudioWorkflowStep): StudioWorkflowStageId {
  return studioWorkflowStage(step);
}

/** A genuinely empty untitled draft is a new workflow, never a continuation
 * of a stored or URL-selected finish step from an older draft. */
export function restoredStudioWorkflowStep(
  emptyUntitledDraft: boolean,
  queryStep: StudioWorkflowStep | null,
  storedStep: StudioWorkflowStep | null,
): StudioWorkflowStep {
  return emptyUntitledDraft ? 1 : queryStep ?? storedStep ?? 1;
}
