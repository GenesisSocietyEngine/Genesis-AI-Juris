import type { DecisionOption, MetricGuard, MetricKey, Scenario, ScenarioStage } from "./types";

export function actionUseKey(option: DecisionOption) { return option.canonicalActionId ?? option.id; }

export function metricGuardSatisfied(guard: MetricGuard, metrics: Record<MetricKey, number>) {
  const actual = metrics[guard.metric];
  if (guard.comparison === "gte") return actual >= guard.value;
  if (guard.comparison === "lte") return actual <= guard.value;
  return actual === guard.value;
}

export function decisionAvailability(option: DecisionOption, metrics: Record<MetricKey, number>, useCount: number) {
  const exhausted = (option.repeatability === "once" && useCount > 0)
    || (option.repeatability === "limited" && useCount >= (option.maxUses ?? 1));
  const blockedGuards = (option.guards ?? []).filter((guard) => !metricGuardSatisfied(guard, metrics));
  return { available: !exhausted && blockedGuards.length === 0, exhausted, blockedGuards };
}

export function actionCompletionMinute(currentMinute: number, option: DecisionOption) {
  const elapsedTarget = currentMinute + option.minutes;
  const currentDay = Math.floor(currentMinute / 1440);
  const calendarTarget = option.completionDayOffset === undefined || option.completionMinuteOfDay === undefined
    ? 0
    : (currentDay + option.completionDayOffset) * 1440 + option.completionMinuteOfDay;
  return Math.max(elapsedTarget, calendarTarget, option.advanceToMinute ?? 0);
}

export function stageClockMinute(stage: Pick<ScenarioStage, "day" | "time">) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(stage.time);
  if (!match || !Number.isInteger(stage.day) || stage.day < 1) throw new Error("Invalid authored stage clock");
  const [hours, minutes] = stage.time.split(":").map(Number);
  return (stage.day - 1) * 1440 + hours * 60 + minutes;
}

export function resolveDecisionTiming(
  scenario: Scenario,
  currentMinute: number,
  option: DecisionOption,
  completedDeadlineIds: Iterable<string>,
  missedDeadlineIds: Iterable<string>,
) {
  const priorCompleted = new Set(completedDeadlineIds);
  const priorMissed = new Set(missedDeadlineIds);
  const actionMinute = actionCompletionMinute(currentMinute, option);
  const completed = new Set(priorCompleted);

  for (const deadline of scenario.deadlines) {
    if (deadline.completionActions.includes(option.id) && actionMinute <= deadline.dueAtMinute) completed.add(deadline.id);
  }

  let nextStageId = option.nextStageId;
  let transitionMinute = Math.max(actionMinute, authoredMinute(scenario, nextStageId));
  let newlyMissed = findNewlyMissed(scenario, transitionMinute, completed, priorMissed);
  const forcedStageId = newlyMissed.find((deadline) => deadline.missedNextStageId)?.missedNextStageId;

  if (forcedStageId) {
    nextStageId = forcedStageId;
    transitionMinute = Math.max(transitionMinute, authoredMinute(scenario, forcedStageId));
    newlyMissed = findNewlyMissed(scenario, transitionMinute, completed, priorMissed);
  }

  return {
    actionMinute,
    transitionMinute,
    nextStageId,
    forcedStageId,
    completedDeadlineIds: [...completed],
    newlyCompletedDeadlineIds: [...completed].filter((id) => !priorCompleted.has(id)),
    newlyMissedDeadlineIds: newlyMissed.map((deadline) => deadline.id),
  };
}

// Preserves replay semantics for exports created before the versioned clock engine.
export function resolveLegacyDecisionTiming(
  scenario: Scenario,
  currentMinute: number,
  option: DecisionOption,
  completedDeadlineIds: Iterable<string>,
  missedDeadlineIds: Iterable<string>,
) {
  const priorCompleted = new Set(completedDeadlineIds);
  const priorMissed = new Set(missedDeadlineIds);
  const transitionMinute = actionCompletionMinute(currentMinute, option);
  const completed = new Set(priorCompleted);
  for (const deadline of scenario.deadlines) if (deadline.completionActions.includes(option.id)) completed.add(deadline.id);
  const newlyMissed = findNewlyMissed(scenario, transitionMinute, completed, priorMissed);
  const forcedStageId = newlyMissed.find((deadline) => deadline.missedNextStageId)?.missedNextStageId;
  return {
    actionMinute: transitionMinute,
    transitionMinute,
    nextStageId: forcedStageId ?? option.nextStageId,
    forcedStageId,
    completedDeadlineIds: [...completed],
    newlyCompletedDeadlineIds: [...completed].filter((id) => !priorCompleted.has(id)),
    newlyMissedDeadlineIds: newlyMissed.map((deadline) => deadline.id),
  };
}

function authoredMinute(scenario: Scenario, stageId: string | undefined) {
  const stage = stageId ? scenario.stages.find((item) => item.id === stageId) : undefined;
  return stage ? stageClockMinute(stage) : 0;
}

function findNewlyMissed(
  scenario: Scenario,
  minute: number,
  completed: ReadonlySet<string>,
  priorMissed: ReadonlySet<string>,
) {
  return scenario.deadlines.filter((deadline) => !completed.has(deadline.id) && !priorMissed.has(deadline.id) && minute > deadline.dueAtMinute);
}
