import canonicalBundle from "./canonical-case-bundle.json";

type ScenarioTime = { day: number; minute_of_day: number };
type CalendarTarget = { day_offset: number; minute_of_day: number };
type RelativeTiming = {
  offset_minutes?: number;
  minimum_turnaround_minutes?: number;
  calendar_target?: CalendarTarget;
  not_before?: ScenarioTime;
  relative_to_deadline?: string;
};
type IntegerOperand = { source: "constant" | "metric" | "resource"; value?: number; metric?: string; resource?: string; offset?: number };
type CanonicalCondition = {
  type?: string;
  stage?: string;
  flag?: string;
  value?: boolean;
  deadline?: string;
  status?: string;
  task?: string;
  result?: string;
  left?: IntegerOperand;
  right?: IntegerOperand;
  operator?: string;
  condition?: CanonicalCondition;
  conditions?: CanonicalCondition[];
};
type CanonicalEffect = {
  type: string;
  stage?: string;
  flag?: string;
  value?: number | boolean;
  metric?: string;
  amount?: number;
  minimum?: number;
  maximum?: number;
  resource?: string;
  fact?: string;
  status?: string;
  evidence?: string;
  task?: string;
  deadline?: string;
  item?: string;
  result?: string;
  decision?: string;
  event?: string;
  outcome?: string;
};
type CanonicalAction = {
  id: string;
  available_when?: CanonicalCondition;
  effects: CanonicalEffect[];
  time_cost_minutes?: number;
  cost_eur?: number;
  billable_minutes?: number;
  completion_timing?: RelativeTiming;
  advance_to_deadlines?: string[];
  completion_deadlines?: string[];
  completion_deadline_offset_minutes?: number;
  repeatability?: { type?: string; max_uses?: number };
};
type CanonicalDeadline = {
  id: string;
  due_at: ScenarioTime;
  completion_at_due_allowed?: boolean;
  relative_due?: RelativeTiming;
  activation_event?: string;
  completion_actions: string[];
  missed_event: string;
};
type CanonicalAsyncTask = {
  id: string;
  completion_event: string;
  duration_minutes: number;
  completion_timing?: RelativeTiming;
  usable_until_event?: string;
  expiry_event?: string;
};
type CanonicalEvent = {
  id: string;
  trigger: { type: string; action?: string; event?: string; at?: ScenarioTime; task?: string; deadline?: string; metric?: string; threshold?: number };
  condition?: CanonicalCondition;
  repeatable?: boolean;
  effects: CanonicalEffect[];
};
type DecisionScoreTerm = { condition?: CanonicalCondition; operand: IntegerOperand; multiplier: number; minimum?: number; maximum?: number };
type DecisionBranch = { id: string; condition?: CanonicalCondition; minimum_roll?: number; maximum_roll?: number; minimum_total?: number; maximum_total?: number; effects: CanonicalEffect[] };
type CanonicalDecision = {
  id: string;
  roll_range?: number;
  roll_offset?: number;
  roll_multiplier?: number;
  score_metric?: string;
  score_terms?: DecisionScoreTerm[];
  score_offset?: number;
  score_divisor?: number;
  branches: DecisionBranch[];
};
type CanonicalScenario = {
  initial_stage: string;
  initial_clock?: ScenarioTime;
  clock?: { mode?: string };
  foreground_metric_rates?: Record<string, number>;
  numeric_metrics?: Record<string, number>;
  initial_resources?: Record<string, number>;
  facts: Array<{ id: string; initial_status?: string }>;
  evidence: Array<{ id: string; initially_available?: boolean }>;
  stages: Array<{ id: string; terminal?: boolean; exit_actions?: string[] }>;
  actions: CanonicalAction[];
  deadlines: CanonicalDeadline[];
  async_tasks: CanonicalAsyncTask[];
  inbox_items: Array<{ id: string; initially_visible?: boolean; created_by_event?: string; expiry_event?: string }>;
  events: CanonicalEvent[];
  deterministic_decisions?: CanonicalDecision[];
  outcomes: Array<{ id: string; title: string; summary: string; terminal_stage: string; condition?: CanonicalCondition }>;
};
type CanonicalCase = {
  case_id: string;
  scenario_fingerprint: string;
  scenario: CanonicalScenario;
  scenario_localizations?: Record<string, { outcomes?: Record<string, { title?: string; summary?: string }> }>;
};

const canonicalCases = (canonicalBundle as unknown as { cases: CanonicalCase[] }).cases;

export type CanonicalRuntimeState = {
  schema: "canonical-runtime-v1";
  caseId: string;
  sourceFingerprint: string;
  seed: number;
  stageId: string;
  clockMinutes: number;
  flags: Record<string, boolean>;
  numericMetrics: Record<string, number>;
  resources: Record<string, number>;
  factStatuses: Record<string, string>;
  availableEvidence: string[];
  deadlineStatuses: Record<string, "open" | "completed" | "missed" | null>;
  deadlineDueMinutes: Record<string, number>;
  taskStatuses: Record<string, "not_started" | "in_progress" | "ready" | "reviewed" | "expired">;
  taskDueMinutes: Record<string, number>;
  visibleInbox: string[];
  resolvedInbox: string[];
  actionUses: Record<string, number>;
  firedEvents: string[];
  decisionResolutions: Record<string, string[]>;
  judicialResult: string | null;
  outcomeId: string | null;
};

type EventContext = { processed: number; repeatableIds: Set<string>; effectTimeAnchor: number | null };

export function isCanonicalRuntimeScenario(caseId: string) {
  return canonicalCases.some((item) => item.case_id === caseId);
}

export function normalizeCanonicalRuntimeState(value: unknown, expectedCaseId: string, expectedSourceFingerprint?: string): CanonicalRuntimeState | null {
  const entry = canonicalCases.find((item) => item.case_id === expectedCaseId);
  if (!entry || (expectedSourceFingerprint && entry.scenario_fingerprint !== expectedSourceFingerprint)) return null;
  if (!isObject(value) || value.schema !== "canonical-runtime-v1" || value.caseId !== expectedCaseId
    || value.sourceFingerprint !== entry.scenario_fingerprint
    || typeof value.seed !== "number" || !Number.isSafeInteger(value.seed) || value.seed < 0
    || typeof value.stageId !== "string" || typeof value.clockMinutes !== "number" || !Number.isSafeInteger(value.clockMinutes) || value.clockMinutes < 0
    || !isObject(value.flags) || !isObject(value.numericMetrics) || !isObject(value.resources) || !isObject(value.factStatuses)
    || !Array.isArray(value.availableEvidence) || !isObject(value.deadlineStatuses) || !isObject(value.deadlineDueMinutes)
    || !isObject(value.taskStatuses) || !isObject(value.taskDueMinutes) || !Array.isArray(value.visibleInbox) || !Array.isArray(value.resolvedInbox)
    || !isObject(value.actionUses) || !Array.isArray(value.firedEvents) || !isObject(value.decisionResolutions)
    || (value.judicialResult !== null && typeof value.judicialResult !== "string") || (value.outcomeId !== null && typeof value.outcomeId !== "string")) return null;
  try {
    const state = structuredClone(value) as CanonicalRuntimeState;
    canonicalPresentationState(state);
    return state;
  } catch {
    return null;
  }
}

export function createCanonicalRuntime(caseId: string, seed: number): CanonicalRuntimeState {
  const entry = getCase(caseId);
  const definition = entry.scenario;
  const baseline = calendarBaseline(definition);
  const deadlineDueMinutes: Record<string, number> = {};
  for (const deadline of definition.deadlines) resolveInitialDeadlineDue(definition, deadline.id, baseline, deadlineDueMinutes, new Set());
  const state: CanonicalRuntimeState = {
    schema: "canonical-runtime-v1",
    caseId,
    sourceFingerprint: entry.scenario_fingerprint,
    seed,
    stageId: definition.initial_stage,
    clockMinutes: 0,
    flags: {},
    numericMetrics: { ...(definition.numeric_metrics ?? {}) },
    resources: { ...(definition.initial_resources ?? {}) },
    factStatuses: Object.fromEntries(definition.facts.map((fact) => [fact.id, fact.initial_status ?? "unknown"])),
    availableEvidence: definition.evidence.filter((item) => item.initially_available).map((item) => item.id),
    deadlineStatuses: Object.fromEntries(definition.deadlines.map((deadline) => [deadline.id, deadline.activation_event ? null : "open"])),
    deadlineDueMinutes,
    taskStatuses: Object.fromEntries(definition.async_tasks.map((task) => [task.id, "not_started"])),
    taskDueMinutes: {},
    visibleInbox: definition.inbox_items.filter((item) => item.initially_visible || !item.created_by_event).map((item) => item.id),
    resolvedInbox: [],
    actionUses: {},
    firedEvents: [],
    decisionResolutions: {},
    judicialResult: null,
    outcomeId: null,
  };
  if (Object.keys(definition.initial_resources ?? {}).length > 0) {
    state.resources.spend_eur ??= 0;
    state.resources.billable_minutes ??= 0;
  }
  const initialEvents = definition.events.filter((event) => event.trigger.type === "scenario_start" || (event.trigger.type === "at_time" && elapsedAuthoredTime(event.trigger.at, baseline) === 0)).map((event) => event.id);
  processEventQueue(definition, state, initialEvents, newContext());
  processEventQueue(definition, state, queueDueEvents(definition, state), newContext());
  return state;
}

export function canonicalAvailableActionIds(state: CanonicalRuntimeState) {
  const definition = getCaseForState(state).scenario;
  if (isClosed(definition, state)) return [];
  return definition.actions.filter((action) => actionAvailable(definition, state, action)).map((action) => action.id);
}

export function dispatchCanonicalAction(source: CanonicalRuntimeState, actionId: string) {
  const definition = getCaseForState(source).scenario;
  const state = cloneState(source);
  if (isClosed(definition, state)) throw new Error("Scenario is already resolved");
  const action = definition.actions.find((item) => item.id === actionId);
  if (!action || !actionAvailable(definition, state, action)) throw new Error(`Action is unavailable: ${actionId}`);
  const { target, selectedAdvanceDeadline } = completionTarget(definition, state, action);
  ensureTimely(definition, state, action, target, selectedAdvanceDeadline);
  precompleteActionDeadlines(definition, state, action);
  const context = newContext(target);
  applyEffects(definition, state, action.effects, context);
  if (Object.keys(definition.initial_resources ?? {}).length > 0) {
    state.resources.spend_eur = (state.resources.spend_eur ?? 0) + (action.cost_eur ?? 0);
    state.resources.billable_minutes = (state.resources.billable_minutes ?? 0) + (action.billable_minutes ?? 0);
  }
  state.actionUses[actionId] = (state.actionUses[actionId] ?? 0) + 1;
  const afterAction = definition.events.filter((event) => event.trigger.type === "after_action" && event.trigger.action === actionId).map((event) => event.id);
  advanceClockTo(definition, state, target, afterAction, false, selectedAdvanceDeadline);
  return state;
}

export function advanceCanonicalTime(source: CanonicalRuntimeState, minutes: number) {
  const definition = getCaseForState(source).scenario;
  if (definition.clock?.mode !== "foreground") throw new Error("Foreground clock is not enabled");
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1_440) throw new Error("Invalid foreground time advance");
  const state = cloneState(source);
  if (isClosed(definition, state)) throw new Error("Scenario is already resolved");
  advanceClockTo(definition, state, state.clockMinutes + minutes, [], true, null);
  return state;
}

export function canonicalClockBaseline(caseId: string) {
  return calendarBaseline(getCase(caseId).scenario);
}

export function canonicalPresentationState(state: CanonicalRuntimeState) {
  const definition = getCaseForState(state).scenario;
  const baseline = calendarBaseline(definition);
  const completedDeadlineIds = Object.entries(state.deadlineStatuses).filter(([, status]) => status === "completed").map(([id]) => id);
  const missedDeadlineIds = Object.entries(state.deadlineStatuses).filter(([, status]) => status === "missed").map(([id]) => id);
  return {
    currentStageId: state.stageId,
    clockMinute: calendarBaseline(definition) + state.clockMinutes,
    actionUseCounts: { ...state.actionUses },
    completedDeadlineIds,
    missedDeadlineIds,
    availableActionIds: canonicalAvailableActionIds(state),
    visibleInboxIds: [...state.visibleInbox],
    resolvedInboxIds: [...state.resolvedInbox],
    availableEvidenceIds: [...state.availableEvidence],
    activeDeadlineIds: definition.deadlines.filter((deadline) => state.deadlineStatuses[deadline.id] !== null).map((deadline) => deadline.id),
    deadlineDueMinutes: Object.fromEntries(Object.entries(state.deadlineDueMinutes).map(([id, minute]) => [id, baseline + minute])),
    outcomeId: state.outcomeId,
    metrics: presentationMetrics(state),
  };
}

export function canonicalOutcomeClass(outcomeId: string | null): "strong" | "mixed" | "weak" | null {
  if (!outcomeId) return null;
  const classes: Record<string, "strong" | "weak"> = {
    settlement_64500: "strong", first_instance_win_final: "strong", appeal_win_final: "strong", judgment_preserved_after_cassation: "strong",
    negotiated_recovery: "strong", judgment_recovery: "strong", protected_crisis_position: "strong", coordinated_claim_position: "strong", credible_source_and_remedy: "strong",
    client_engagement_terminated: "weak", procedural_default_final: "weak", first_instance_adverse_final: "weak", appeal_loss_final: "weak", cassation_dismissed_final: "weak",
    compromised_crisis_position: "weak", fragmented_claim_position: "weak", compromised_claim_closed: "weak",
  };
  return classes[outcomeId] ?? "mixed";
}

export function canonicalOutcomePresentation(caseId: string, outcomeId: string | null): { id: string; title: { en: string; ru: string }; summary: { en: string; ru: string }; classification: "strong" | "mixed" | "weak" } | undefined {
  if (!outcomeId) return undefined;
  const entry = getCase(caseId);
  const outcome = entry.scenario.outcomes.find((item) => item.id === outcomeId);
  if (!outcome) return undefined;
  const en = entry.scenario_localizations?.en?.outcomes?.[outcomeId];
  const ru = entry.scenario_localizations?.ru?.outcomes?.[outcomeId];
  const manualRu = caseId === "be_commercial_logistics_001" ? logisticsOutcomeRu[outcomeId] : undefined;
  return {
    id: outcomeId,
    title: { en: en?.title ?? outcome.title, ru: ru?.title ?? manualRu?.title ?? en?.title ?? outcome.title },
    summary: { en: en?.summary ?? outcome.summary, ru: ru?.summary ?? manualRu?.summary ?? en?.summary ?? outcome.summary },
    classification: canonicalOutcomeClass(outcomeId) ?? "mixed",
  };
}

const logisticsOutcomeRu: Record<string, { title: string; summary: string }> = {
  negotiated_recovery: {
    title: "Согласованное взыскание",
    summary: "Velmont принимает документированный платёж, закрывающий остаток по счетам, спорные надбавки и заявленный Orbis зачёт.",
  },
  judgment_recovery: {
    title: "Решение получено и исполнено",
    summary: "Velmont получает и исполняет решение по документированному логистическому долгу.",
  },
};

function getCase(caseId: string) {
  const entry = canonicalCases.find((item) => item.case_id === caseId);
  if (!entry) throw new Error(`Canonical case not found: ${caseId}`);
  return entry;
}

function getCaseForState(state: CanonicalRuntimeState) {
  const entry = getCase(state.caseId);
  if (entry.scenario_fingerprint !== state.sourceFingerprint) throw new Error("Canonical runtime fingerprint mismatch");
  return entry;
}

function cloneState(state: CanonicalRuntimeState): CanonicalRuntimeState {
  return structuredClone(state);
}

function newContext(effectTimeAnchor: number | null = null): EventContext {
  return { processed: 0, repeatableIds: new Set(), effectTimeAnchor };
}

function actionAvailable(definition: CanonicalScenario, state: CanonicalRuntimeState, action: CanonicalAction) {
  const stage = definition.stages.find((item) => item.id === state.stageId);
  if (!stage?.exit_actions?.includes(action.id)) return false;
  const uses = state.actionUses[action.id] ?? 0;
  const repeatability = action.repeatability?.type ?? "once";
  if (repeatability === "once" && uses > 0) return false;
  if (repeatability === "limited" && uses >= (action.repeatability?.max_uses ?? 1)) return false;
  if (!evaluateCondition(state, action.available_when)) return false;
  try {
    const completion = completionTarget(definition, state, action);
    ensureTimely(definition, state, action, completion.target, completion.selectedAdvanceDeadline);
    return true;
  } catch {
    return false;
  }
}

function evaluateCondition(state: CanonicalRuntimeState, condition?: CanonicalCondition): boolean {
  if (!condition || !condition.type || condition.type === "always") return true;
  if (condition.type === "stage_is") return state.stageId === condition.stage;
  if (condition.type === "flag_equals") return (state.flags[condition.flag ?? ""] ?? false) === Boolean(condition.value);
  if (condition.type === "deadline_status_is") return state.deadlineStatuses[condition.deadline ?? ""] === condition.status;
  if (condition.type === "async_task_status_is") return state.taskStatuses[condition.task ?? ""] === condition.status;
  if (condition.type === "judicial_result_is") return state.judicialResult === condition.result;
  if (condition.type === "integer_compare") {
    const left = integerOperand(state, condition.left);
    const right = integerOperand(state, condition.right);
    if (left === null || right === null) return false;
    if (condition.operator === "eq" || condition.operator === "equal") return left === right;
    if (condition.operator === "ne" || condition.operator === "not_equal") return left !== right;
    if (condition.operator === "lt" || condition.operator === "less_than") return left < right;
    if (condition.operator === "lte" || condition.operator === "less_than_or_equal") return left <= right;
    if (condition.operator === "gt" || condition.operator === "greater_than") return left > right;
    if (condition.operator === "gte" || condition.operator === "greater_than_or_equal") return left >= right;
    return false;
  }
  if (condition.type === "all") return (condition.conditions ?? []).every((item) => evaluateCondition(state, item));
  if (condition.type === "any") return (condition.conditions ?? []).some((item) => evaluateCondition(state, item));
  if (condition.type === "not") return !evaluateCondition(state, condition.condition);
  return false;
}

function integerOperand(state: CanonicalRuntimeState, operand?: IntegerOperand): number | null {
  if (!operand) return null;
  if (operand.source === "constant") return operand.value ?? 0;
  if (operand.source === "metric") return operand.metric && state.numericMetrics[operand.metric] !== undefined ? state.numericMetrics[operand.metric] + (operand.offset ?? 0) : null;
  return operand.resource && state.resources[operand.resource] !== undefined ? state.resources[operand.resource] + (operand.offset ?? 0) : null;
}

function completionTarget(definition: CanonicalScenario, state: CanonicalRuntimeState, action: CanonicalAction) {
  let target = state.clockMinutes + (action.time_cost_minutes ?? 0);
  if (action.completion_timing) target = Math.max(target, resolveTiming(definition, state, action.completion_timing, state.clockMinutes));
  let selectedAdvanceDeadline: string | null = null;
  if ((action.advance_to_deadlines ?? []).length > 0) {
    const selected = selectOpenDeadline(state, action.advance_to_deadlines ?? []);
    if (!selected) throw new Error("Advance deadline is inactive");
    selectedAdvanceDeadline = selected.id;
    target = Math.max(target, selected.due);
  }
  return { target, selectedAdvanceDeadline };
}

function ensureTimely(definition: CanonicalScenario, state: CanonicalRuntimeState, action: CanonicalAction, completion: number, selectedAdvanceDeadline: string | null) {
  if (selectedAdvanceDeadline) {
    const deadline = definition.deadlines.find((item) => item.id === selectedAdvanceDeadline)!;
    if (deadline.completion_actions.includes(action.id)) ensureCompletion(deadline, completion, state.deadlineDueMinutes[deadline.id]);
  }
  if ((action.completion_deadlines ?? []).length > 0) {
    const selected = selectOpenDeadline(state, action.completion_deadlines ?? []);
    if (!selected) throw new Error("Completion deadline is inactive");
    const deadline = definition.deadlines.find((item) => item.id === selected.id)!;
    ensureCompletion(deadline, completion, selected.due + (action.completion_deadline_offset_minutes ?? 0));
  }
}

function ensureCompletion(deadline: CanonicalDeadline, completion: number, due: number) {
  const late = deadline.completion_at_due_allowed ? completion > due : completion >= due;
  if (late) throw new Error(`Deadline exceeded: ${deadline.id}`);
}

function selectOpenDeadline(state: CanonicalRuntimeState, ids: string[]) {
  return ids.flatMap((id) => state.deadlineStatuses[id] === "open" && state.deadlineDueMinutes[id] !== undefined ? [{ id, due: state.deadlineDueMinutes[id] }] : []).sort((left, right) => left.due - right.due || left.id.localeCompare(right.id))[0];
}

function precompleteActionDeadlines(definition: CanonicalScenario, state: CanonicalRuntimeState, action: CanonicalAction) {
  if ((action.advance_to_deadlines ?? []).length > 0) return;
  for (const deadline of definition.deadlines) if (state.deadlineStatuses[deadline.id] === "open" && deadline.completion_actions.includes(action.id)) state.deadlineStatuses[deadline.id] = "completed";
}

function applyEffects(definition: CanonicalScenario, state: CanonicalRuntimeState, effects: CanonicalEffect[], context: EventContext) {
  const events: string[] = [];
  for (const effect of effects) {
    const id = effect.type;
    if (id === "set_stage" && effect.stage) state.stageId = effect.stage;
    else if (id === "set_flag" && effect.flag) state.flags[effect.flag] = Boolean(effect.value);
    else if (id === "set_metric" && effect.metric && typeof effect.value === "number") setInteger(state.numericMetrics, effect.metric, effect.value);
    else if (id === "add_metric" && effect.metric) addInteger(state.numericMetrics, effect.metric, effect.amount ?? 0);
    else if (id === "subtract_metric" && effect.metric) addInteger(state.numericMetrics, effect.metric, -(effect.amount ?? 0));
    else if (id === "clamp_metric" && effect.metric) setInteger(state.numericMetrics, effect.metric, Math.max(effect.minimum ?? Number.MIN_SAFE_INTEGER, Math.min(effect.maximum ?? Number.MAX_SAFE_INTEGER, requireInteger(state.numericMetrics, effect.metric))));
    else if (id === "set_resource" && effect.resource && typeof effect.value === "number") setInteger(state.resources, effect.resource, effect.value);
    else if (id === "add_resource" && effect.resource) addInteger(state.resources, effect.resource, effect.amount ?? 0);
    else if (id === "subtract_resource" && effect.resource) addInteger(state.resources, effect.resource, -(effect.amount ?? 0));
    else if (id === "set_fact_status" && effect.fact && effect.status) state.factStatuses[effect.fact] = effect.status;
    else if (id === "make_evidence_available" && effect.evidence) addToList(state.availableEvidence, effect.evidence);
    else if (id === "start_async_task" && effect.task) startAsyncTask(definition, state, effect.task, context);
    else if (id === "mark_async_task_ready" && effect.task) { state.taskStatuses[effect.task] = "ready"; delete state.taskDueMinutes[effect.task]; }
    else if (id === "review_async_task" && effect.task) { state.taskStatuses[effect.task] = "reviewed"; delete state.taskDueMinutes[effect.task]; }
    else if (id === "expire_async_task" && effect.task) { state.taskStatuses[effect.task] = "expired"; delete state.taskDueMinutes[effect.task]; }
    else if (id === "complete_deadline" && effect.deadline) state.deadlineStatuses[effect.deadline] = "completed";
    else if (id === "miss_deadline" && effect.deadline) state.deadlineStatuses[effect.deadline] = "missed";
    else if (id === "create_inbox_item" && effect.item) { addToList(state.visibleInbox, effect.item); removeFromList(state.resolvedInbox, effect.item); }
    else if (id === "resolve_inbox_item" && effect.item) addToList(state.resolvedInbox, effect.item);
    else if (id === "set_judicial_result" && effect.result) state.judicialResult = effect.result;
    else if (id === "resolve_deterministic_decision" && effect.decision) resolveDecision(definition, state, effect.decision, context);
    else if (id === "trigger_event" && effect.event) events.push(effect.event);
    else if (id === "resolve_outcome" && effect.outcome) resolveOutcome(definition, state, effect.outcome);
  }
  processEventQueue(definition, state, events, context);
}

function startAsyncTask(definition: CanonicalScenario, state: CanonicalRuntimeState, taskId: string, context: EventContext) {
  const task = definition.async_tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Unknown async task: ${taskId}`);
  state.taskStatuses[taskId] = "in_progress";
  const anchor = task.completion_timing ? context.effectTimeAnchor ?? state.clockMinutes : state.clockMinutes;
  let due = anchor + task.duration_minutes;
  if (task.completion_timing) due = Math.max(due, resolveTiming(definition, state, task.completion_timing, anchor));
  state.taskDueMinutes[taskId] = due;
}

function resolveDecision(definition: CanonicalScenario, state: CanonicalRuntimeState, id: string, context: EventContext) {
  const decision = definition.deterministic_decisions?.find((item) => item.id === id);
  if (!decision) throw new Error(`Unknown deterministic decision: ${id}`);
  const occurrence = state.decisionResolutions[id]?.length ?? 0;
  const rollRange = decision.roll_range ?? 100;
  const raw = deterministicRoll(state.seed, state.sourceFingerprint, id, occurrence) % BigInt(rollRange);
  const roll = Number(raw) + (decision.roll_offset ?? 0);
  let scoreSum = decision.score_metric ? requireInteger(state.numericMetrics, decision.score_metric) : 0;
  for (const term of decision.score_terms ?? []) {
    if (!evaluateCondition(state, term.condition)) continue;
    const rawValue = integerOperand(state, term.operand);
    if (rawValue === null) throw new Error(`Missing score state: ${id}`);
    const value = Math.max(term.minimum ?? Number.MIN_SAFE_INTEGER, Math.min(term.maximum ?? Number.MAX_SAFE_INTEGER, rawValue));
    scoreSum += value * term.multiplier;
  }
  const score = Math.trunc((scoreSum + (decision.score_offset ?? 0)) / (decision.score_divisor ?? 1));
  const total = roll * (decision.roll_multiplier ?? 1) + score;
  const branch = decision.branches.find((item) => evaluateCondition(state, item.condition)
    && (item.minimum_roll === undefined || roll >= item.minimum_roll)
    && (item.maximum_roll === undefined || roll <= item.maximum_roll)
    && (item.minimum_total === undefined || total >= item.minimum_total)
    && (item.maximum_total === undefined || total <= item.maximum_total));
  if (!branch) throw new Error(`No eligible decision branch: ${id}`);
  state.decisionResolutions[id] = [...(state.decisionResolutions[id] ?? []), branch.id];
  applyEffects(definition, state, branch.effects, context);
}

function resolveOutcome(definition: CanonicalScenario, state: CanonicalRuntimeState, outcomeId: string) {
  if (state.outcomeId === outcomeId) return;
  if (state.outcomeId) throw new Error("Conflicting outcome");
  const outcome = definition.outcomes.find((item) => item.id === outcomeId);
  if (!outcome || outcome.terminal_stage !== state.stageId || !evaluateCondition(state, outcome.condition)) throw new Error(`Invalid outcome: ${outcomeId}`);
  state.outcomeId = outcomeId;
}

function processEventQueue(definition: CanonicalScenario, state: CanonicalRuntimeState, initial: string[], context: EventContext) {
  const events = [...initial];
  while (events.length > 0) {
    const eventId = events.shift()!;
    const event = definition.events.find((item) => item.id === eventId);
    if (!event) throw new Error(`Unknown event: ${eventId}`);
    if (event.repeatable) {
      if (context.repeatableIds.has(eventId)) continue;
      context.repeatableIds.add(eventId);
    } else if (state.firedEvents.includes(eventId)) continue;
    context.processed += 1;
    if (context.processed > 256) throw new Error("Canonical event limit exceeded");
    if (!evaluateCondition(state, event.condition)) continue;
    if (!event.repeatable) addToList(state.firedEvents, eventId);
    events.push(...activateEventOwnedState(definition, state, event, context));
    applyEffects(definition, state, event.effects, context);
    for (const dependent of definition.events) if (dependent.trigger.type === "after_event" && dependent.trigger.event === eventId) events.push(dependent.id);
    events.push(...queueDueEvents(definition, state));
  }
}

function activateEventOwnedState(definition: CanonicalScenario, state: CanonicalRuntimeState, event: CanonicalEvent, context: EventContext) {
  const events: string[] = [];
  for (const deadline of definition.deadlines) if (deadline.activation_event === event.id) activateDeadline(definition, state, deadline, context.effectTimeAnchor ?? state.clockMinutes);
  for (const item of definition.inbox_items) {
    if (item.created_by_event === event.id) addToList(state.visibleInbox, item.id);
    if (item.expiry_event === event.id) addToList(state.resolvedInbox, item.id);
  }
  for (const task of definition.async_tasks) {
    if (task.usable_until_event !== event.id) continue;
    const status = state.taskStatuses[task.id] ?? "not_started";
    if ((status === "not_started" || status === "in_progress" || status === "ready") && task.expiry_event) events.push(task.expiry_event);
  }
  return events;
}

function activateDeadline(definition: CanonicalScenario, state: CanonicalRuntimeState, deadline: CanonicalDeadline, anchor: number) {
  state.deadlineDueMinutes[deadline.id] = deadline.relative_due ? resolveTiming(definition, state, deadline.relative_due, anchor) : elapsedAuthoredTime(deadline.due_at, calendarBaseline(definition)) ?? 0;
  state.deadlineStatuses[deadline.id] = "open";
}

function advanceClockTo(definition: CanonicalScenario, state: CanonicalRuntimeState, target: number, finalEvents: string[], applyForegroundRates: boolean, completionDeadline: string | null) {
  if (target < state.clockMinutes) throw new Error("Clock cannot move backwards");
  if (isClosed(definition, state)) { state.clockMinutes = target; return; }
  while (true) {
    const boundary = nextTemporalBoundary(definition, state, target, applyForegroundRates);
    if (boundary === null) break;
    const previous = { ...state.numericMetrics };
    if (applyForegroundRates) incrementForegroundMetrics(definition, state, boundary - state.clockMinutes);
    state.clockMinutes = boundary;
    processEventQueue(definition, state, queueDueEvents(definition, state), newContext());
    if (isClosed(definition, state)) return;
    if (applyForegroundRates) processEventQueue(definition, state, crossedMetricEvents(definition, state, previous), newContext());
    if (isClosed(definition, state)) return;
  }
  const previous = { ...state.numericMetrics };
  if (applyForegroundRates) incrementForegroundMetrics(definition, state, target - state.clockMinutes);
  state.clockMinutes = target;
  if (completionDeadline && state.deadlineStatuses[completionDeadline] === "open") state.deadlineStatuses[completionDeadline] = "completed";
  processEventQueue(definition, state, [...finalEvents, ...queueDueEvents(definition, state)], newContext());
  if (!isClosed(definition, state) && applyForegroundRates) processEventQueue(definition, state, crossedMetricEvents(definition, state, previous), newContext());
}

function nextTemporalBoundary(definition: CanonicalScenario, state: CanonicalRuntimeState, target: number, includeMetricThresholds: boolean) {
  const boundaries: number[] = [];
  const baseline = calendarBaseline(definition);
  for (const event of definition.events) if (!state.firedEvents.includes(event.id) && event.trigger.type === "at_time") {
    const at = elapsedAuthoredTime(event.trigger.at, baseline);
    if (at !== null) boundaries.push(at);
  }
  for (const [taskId, due] of Object.entries(state.taskDueMinutes)) if (state.taskStatuses[taskId] === "in_progress") boundaries.push(due);
  for (const deadline of definition.deadlines) if (state.deadlineStatuses[deadline.id] === "open") boundaries.push(deadlineMissBoundary(deadline, state.deadlineDueMinutes[deadline.id]));
  if (includeMetricThresholds) for (const event of definition.events) {
    if ((state.firedEvents.includes(event.id) && !event.repeatable) || event.trigger.type !== "metric_threshold_reached" || !event.trigger.metric || event.trigger.threshold === undefined) continue;
    const rate = definition.foreground_metric_rates?.[event.trigger.metric];
    const current = state.numericMetrics[event.trigger.metric];
    if (rate === undefined || rate <= 0 || current === undefined || current >= event.trigger.threshold) continue;
    boundaries.push(state.clockMinutes + Math.floor((event.trigger.threshold - current - 1) / rate) + 1);
  }
  const candidates = boundaries.filter((value) => value > state.clockMinutes && value < target);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function queueDueEvents(definition: CanonicalScenario, state: CanonicalRuntimeState) {
  const events: string[] = [];
  const baseline = calendarBaseline(definition);
  for (const event of definition.events) if (!state.firedEvents.includes(event.id) && event.trigger.type === "at_time" && (elapsedAuthoredTime(event.trigger.at, baseline) ?? Number.MAX_SAFE_INTEGER) <= state.clockMinutes) events.push(event.id);
  for (const [taskId, due] of Object.entries(state.taskDueMinutes).sort((left, right) => left[0].localeCompare(right[0]))) if (due <= state.clockMinutes) {
    state.taskStatuses[taskId] = "ready";
    delete state.taskDueMinutes[taskId];
    const task = definition.async_tasks.find((item) => item.id === taskId);
    if (task) {
      events.push(task.completion_event);
      for (const event of definition.events) if (event.trigger.type === "async_task_completed" && event.trigger.task === taskId) events.push(event.id);
    }
  }
  for (const deadline of definition.deadlines) if (state.deadlineStatuses[deadline.id] === "open" && deadlineMissBoundary(deadline, state.deadlineDueMinutes[deadline.id]) <= state.clockMinutes) {
    state.deadlineStatuses[deadline.id] = "missed";
    events.push(deadline.missed_event);
    for (const event of definition.events) if (event.trigger.type === "deadline_missed" && event.trigger.deadline === deadline.id) events.push(event.id);
  }
  return events;
}

function crossedMetricEvents(definition: CanonicalScenario, state: CanonicalRuntimeState, previous: Record<string, number>) {
  return definition.events.filter((event) => event.trigger.type === "metric_threshold_reached" && event.trigger.metric && event.trigger.threshold !== undefined
    && !(state.firedEvents.includes(event.id) && !event.repeatable)
    && previous[event.trigger.metric] !== undefined && state.numericMetrics[event.trigger.metric] !== undefined
    && previous[event.trigger.metric] < event.trigger.threshold && state.numericMetrics[event.trigger.metric] >= event.trigger.threshold).map((event) => event.id);
}

function incrementForegroundMetrics(definition: CanonicalScenario, state: CanonicalRuntimeState, elapsed: number) {
  for (const [metric, rate] of Object.entries(definition.foreground_metric_rates ?? {})) addInteger(state.numericMetrics, metric, rate * elapsed);
}

function resolveTiming(definition: CanonicalScenario, state: CanonicalRuntimeState, timing: RelativeTiming, defaultAnchor: number) {
  const anchor = timing.relative_to_deadline ? state.deadlineDueMinutes[timing.relative_to_deadline] : defaultAnchor;
  if (anchor === undefined) throw new Error("Relative deadline is inactive");
  let target = Math.max(state.clockMinutes, anchor + (timing.offset_minutes ?? 0), state.clockMinutes + (timing.minimum_turnaround_minutes ?? 0));
  if (timing.calendar_target) {
    const anchorCivil = calendarBaseline(definition) + anchor;
    const targetCivil = (Math.floor(anchorCivil / 1440) + timing.calendar_target.day_offset) * 1440 + timing.calendar_target.minute_of_day;
    target = Math.max(target, Math.max(0, targetCivil - calendarBaseline(definition)));
  }
  if (timing.not_before) target = Math.max(target, Math.max(0, authoredMinutes(timing.not_before) - calendarBaseline(definition)));
  return target;
}

function resolveInitialDeadlineDue(definition: CanonicalScenario, id: string, baseline: number, due: Record<string, number>, visiting: Set<string>): number {
  if (due[id] !== undefined) return due[id];
  if (visiting.has(id)) throw new Error("Relative deadline cycle");
  visiting.add(id);
  const deadline = definition.deadlines.find((item) => item.id === id)!;
  if (!deadline.relative_due) due[id] = Math.max(0, authoredMinutes(deadline.due_at) - baseline);
  else {
    const anchor = deadline.relative_due.relative_to_deadline ? resolveInitialDeadlineDue(definition, deadline.relative_due.relative_to_deadline, baseline, due, visiting) : 0;
    const empty = createTimingState(definition, due);
    due[id] = resolveTiming(definition, empty, deadline.relative_due, anchor);
  }
  visiting.delete(id);
  return due[id];
}

function createTimingState(definition: CanonicalScenario, due: Record<string, number>): CanonicalRuntimeState {
  return { schema: "canonical-runtime-v1", caseId: "", sourceFingerprint: "", seed: 0, stageId: definition.initial_stage, clockMinutes: 0, flags: {}, numericMetrics: {}, resources: {}, factStatuses: {}, availableEvidence: [], deadlineStatuses: {}, deadlineDueMinutes: due, taskStatuses: {}, taskDueMinutes: {}, visibleInbox: [], resolvedInbox: [], actionUses: {}, firedEvents: [], decisionResolutions: {}, judicialResult: null, outcomeId: null };
}

function presentationMetrics(state: CanonicalRuntimeState) {
  const metric = (ids: string[], fallback: number) => ids.map((id) => state.numericMetrics[id]).find((value) => value !== undefined) ?? fallback;
  return {
    position: clamp100(metric(["case_strength", "merits", "leverage"], 50)),
    evidence: clamp100(metric(["evidence"], 50)),
    trust: clamp100(metric(["client_trust", "ethics"], 50)),
    exposure: clamp100(metric(["fatigue", "cumulative_strain"], 0)),
  };
}

function deterministicRoll(seed: number, fingerprint: string, decisionId: string, occurrence: number) {
  const encoder = new TextEncoder();
  const fingerprintBytes = encoder.encode(fingerprint);
  const decisionBytes = encoder.encode(decisionId);
  const bytes = new Uint8Array(8 + 8 + fingerprintBytes.length + 8 + decisionBytes.length + 8);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  view.setBigUint64(offset, BigInt(seed)); offset += 8;
  view.setBigUint64(offset, BigInt(fingerprintBytes.length)); offset += 8; bytes.set(fingerprintBytes, offset); offset += fingerprintBytes.length;
  view.setBigUint64(offset, BigInt(decisionBytes.length)); offset += 8; bytes.set(decisionBytes, offset); offset += decisionBytes.length;
  view.setBigUint64(offset, BigInt(occurrence));
  const digest = sha256Bytes(bytes);
  return new DataView(digest.buffer, digest.byteOffset, digest.byteLength).getBigUint64(0);
}

function sha256Bytes(input: Uint8Array) {
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = [...input];
  const bitLength = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000), low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 255);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 255);
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const words = new Array<number>(64); const rotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  for (let start = 0; start < bytes.length; start += 64) {
    for (let index = 0; index < 16; index += 1) { const p = start + index * 4; words[index] = ((bytes[p] << 24) | (bytes[p+1] << 16) | (bytes[p+2] << 8) | bytes[p+3]) | 0; }
    for (let index = 16; index < 64; index += 1) { const s0=rotate(words[index-15],7)^rotate(words[index-15],18)^(words[index-15]>>>3); const s1=rotate(words[index-2],17)^rotate(words[index-2],19)^(words[index-2]>>>10); words[index]=(words[index-16]+s0+words[index-7]+s1)|0; }
    let [a,b,c,d,e,f,g,h]=hash;
    for (let index=0;index<64;index+=1){const s1=rotate(e,6)^rotate(e,11)^rotate(e,25);const choice=(e&f)^(~e&g);const t1=(h+s1+choice+constants[index]+words[index])|0;const s0=rotate(a,2)^rotate(a,13)^rotate(a,22);const majority=(a&b)^(a&c)^(b&c);const t2=(s0+majority)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    hash[0]=(hash[0]+a)|0;hash[1]=(hash[1]+b)|0;hash[2]=(hash[2]+c)|0;hash[3]=(hash[3]+d)|0;hash[4]=(hash[4]+e)|0;hash[5]=(hash[5]+f)|0;hash[6]=(hash[6]+g)|0;hash[7]=(hash[7]+h)|0;
  }
  const output=new Uint8Array(32);const view=new DataView(output.buffer);hash.forEach((value,index)=>view.setUint32(index*4,value>>>0));return output;
}

function setInteger(target: Record<string, number>, id: string, value: number) { if (target[id] === undefined) throw new Error(`Unknown integer state: ${id}`); target[id] = value; }
function addInteger(target: Record<string, number>, id: string, amount: number) { target[id] = requireInteger(target, id) + amount; }
function requireInteger(target: Record<string, number>, id: string) { const value = target[id]; if (value === undefined) throw new Error(`Unknown integer state: ${id}`); return value; }
function addToList(items: string[], value: string) { if (!items.includes(value)) items.push(value); }
function removeFromList(items: string[], value: string) { const index = items.indexOf(value); if (index >= 0) items.splice(index, 1); }
function authoredMinutes(time: ScenarioTime) { return time.day * 1440 + time.minute_of_day; }
function elapsedAuthoredTime(time: ScenarioTime | undefined, baseline: number) { return time ? Math.max(0, authoredMinutes(time) - baseline) : null; }
function calendarBaseline(definition: CanonicalScenario) { return definition.initial_clock ? authoredMinutes(definition.initial_clock) : 0; }
function deadlineMissBoundary(deadline: CanonicalDeadline, due: number) { return due + (deadline.completion_at_due_allowed ? 1 : 0); }
function isClosed(definition: CanonicalScenario, state: CanonicalRuntimeState) { return Boolean(definition.stages.find((stage) => stage.id === state.stageId)?.terminal); }
function clamp100(value: number) { return Math.max(0, Math.min(100, value)); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
