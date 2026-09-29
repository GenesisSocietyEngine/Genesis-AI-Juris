import canonicalBundle from "./canonical-case-bundle.json";
import { scenarios as currentScenarios } from "./scenarios";
import type { DecisionOption, LocalText, MetricKey, Scenario, ScenarioDeadline, ScenarioInboxItem, ScenarioStage } from "./types";

type CanonicalEffect = { type: string; metric?: string; amount?: number; stage?: string; event?: string; decision?: string };
type CanonicalAction = { id: string; title: string; description: string; effects: CanonicalEffect[]; time_cost_minutes?: number; cost_eur?: number; completion_timing?: { calendar_target?: { day_offset: number; minute_of_day: number } }; repeatability?: { type?: string; max_uses?: number } };
type CanonicalStage = { id: string; title: string; kind: string; exit_actions?: string[]; terminal?: boolean };
type CanonicalEvent = { id: string; trigger?: { type?: string; action?: string }; effects?: CanonicalEffect[] };
type CanonicalDecision = { id: string; branches?: Array<{ effects?: CanonicalEffect[] }> };
type CanonicalDeadline = { id: string; title: string; due_at: { day: number; minute_of_day: number }; completion_actions: string[]; activation_event?: string; missed_event?: string };
type CanonicalInbox = { id: string; subject: string; body: string; initially_visible?: boolean; action_required?: boolean; resolution_actions?: string[] };
type CanonicalCase = {
  case_id: string;
  scenario_fingerprint: string;
  scenario: {
    metadata: { summary: string; content_version: string };
    initial_stage: string;
    initial_clock?: { day: number; minute_of_day: number };
    stages: CanonicalStage[];
    actions: CanonicalAction[];
    events?: CanonicalEvent[];
    deterministic_decisions?: CanonicalDecision[];
    deadlines: CanonicalDeadline[];
    inbox_items: CanonicalInbox[];
  };
  scenario_localizations?: Record<string, {
    metadata?: { summary?: string };
    stages?: Record<string, { title?: string }>;
    actions?: Record<string, { title?: string; description?: string }>;
    deadlines?: Record<string, { title?: string }>;
    inbox_items?: Record<string, { subject?: string; body?: string }>;
  }>;
};

function localizedText(canonicalCase: CanonicalCase, section: "stages" | "actions" | "deadlines" | "inbox_items", id: string, field: "title" | "description" | "subject" | "body", fallback: string): LocalText {
  const localized = canonicalCase.scenario_localizations ?? {};
  const read = (locale: "en" | "ru") => {
    const entry = localized[locale]?.[section]?.[id] as Record<string, string | undefined> | undefined;
    return entry?.[field] ?? fallback;
  };
  return { en: read("en"), ru: read("ru") };
}

function metricEffects(effects: CanonicalEffect[]): Partial<Record<MetricKey, number>> {
  const result: Partial<Record<MetricKey, number>> = {};
  const metricMap: Record<string, MetricKey | undefined> = { merits: "position", procedure: "position", case_strength: "position", leverage: "position", evidence: "evidence", client_trust: "trust", ethics: "trust", fatigue: "exposure", cumulative_strain: "exposure" };
  for (const effect of effects) {
    const key = effect.metric ? metricMap[effect.metric] : undefined;
    if (!key || typeof effect.amount !== "number") continue;
    const direction = effect.type === "subtract_metric" ? -1 : effect.type === "add_metric" ? 1 : 0;
    if (direction) result[key] = (result[key] ?? 0) + Math.max(-24, Math.min(24, effect.amount * direction));
  }
  return result;
}

function effectsNextStage(raw: CanonicalCase["scenario"], effects: CanonicalEffect[], visited: Set<string>): string | undefined {
  const direct = effects.find((effect) => effect.type === "set_stage")?.stage;
  if (direct) return direct;
  for (const effect of effects) {
    if (effect.type === "trigger_event" && effect.event) {
      const nested = eventNextStage(raw, effect.event, visited);
      if (nested) return nested;
    }
    if (effect.type === "resolve_deterministic_decision" && effect.decision) {
      const token = `decision:${effect.decision}`;
      if (visited.has(token)) continue;
      visited.add(token);
      const decision = raw.deterministic_decisions?.find((item) => item.id === effect.decision);
      for (const branch of decision?.branches ?? []) {
        const nested = effectsNextStage(raw, branch.effects ?? [], visited);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

function eventNextStage(raw: CanonicalCase["scenario"], eventId: string, visited = new Set<string>()): string | undefined {
  const token = `event:${eventId}`;
  if (visited.has(token)) return undefined;
  visited.add(token);
  const event = raw.events?.find((item) => item.id === eventId);
  return event ? effectsNextStage(raw, event.effects ?? [], visited) : undefined;
}

function actionNextStage(raw: CanonicalCase["scenario"], action: CanonicalAction) {
  const direct = effectsNextStage(raw, action.effects, new Set<string>());
  if (direct) return direct;
  for (const event of raw.events ?? []) {
    if (event.trigger?.type === "after_action" && event.trigger.action === action.id) {
      const next = eventNextStage(raw, event.id);
      if (next) return next;
    }
  }
  return undefined;
}

function adaptStage(canonicalCase: CanonicalCase, rawStage: CanonicalStage): ScenarioStage {
  const raw = canonicalCase.scenario;
  const actionById = new Map(raw.actions.map((action) => [action.id, action]));
  const options = (rawStage.exit_actions ?? []).flatMap((id): DecisionOption[] => {
    const action = actionById.get(id);
    if (!action) return [];
    const calendarTarget = action.completion_timing?.calendar_target;
    return [{
      id: action.id,
      label: localizedText(canonicalCase, "actions", action.id, "title", action.title),
      detail: localizedText(canonicalCase, "actions", action.id, "description", action.description),
      result: { en: "Action recorded in the legacy beta matter.", ru: "Действие зарегистрировано в исторической бета-версии дела." },
      cost: action.cost_eur ?? 0,
      minutes: action.time_cost_minutes ?? 0,
      effects: metricEffects(action.effects),
      nextStageId: actionNextStage(raw, action),
      completionDayOffset: calendarTarget?.day_offset,
      completionMinuteOfDay: calendarTarget?.minute_of_day,
      repeatability: action.repeatability?.type === "once" ? "once" : action.repeatability?.type === "limited" ? "limited" : "repeatable",
      maxUses: action.repeatability?.max_uses,
    }];
  });
  const title = localizedText(canonicalCase, "stages", rawStage.id, "title", rawStage.title);
  return { id: rawStage.id, day: 1, time: "00:00", phase: title, headline: title, brief: { en: rawStage.id === raw.initial_stage ? raw.metadata.summary : `Legacy beta workflow · ${rawStage.kind}`, ru: rawStage.id === raw.initial_stage ? (canonicalCase.scenario_localizations?.ru?.metadata?.summary ?? raw.metadata.summary) : `Исторический бета-процесс · ${rawStage.kind}` }, source: { en: `Legacy beta · ${rawStage.kind}`, ru: `Историческая бета · ${rawStage.kind}` }, materialRefs: [], options, terminal: rawStage.terminal ?? false };
}

function adaptDeadlines(canonicalCase: CanonicalCase): ScenarioDeadline[] {
  const raw = canonicalCase.scenario;
  return raw.deadlines.map((deadline) => ({ id: deadline.id, title: localizedText(canonicalCase, "deadlines", deadline.id, "title", deadline.title), dueAtMinute: deadline.due_at.day * 1440 + deadline.due_at.minute_of_day, completionActions: deadline.completion_actions, activationEvent: deadline.activation_event, missedNextStageId: deadline.missed_event ? eventNextStage(raw, deadline.missed_event) : undefined }));
}

function adaptInbox(canonicalCase: CanonicalCase): ScenarioInboxItem[] {
  return canonicalCase.scenario.inbox_items.map((item) => ({ id: item.id, subject: localizedText(canonicalCase, "inbox_items", item.id, "subject", item.subject), body: localizedText(canonicalCase, "inbox_items", item.id, "body", item.body), initiallyVisible: item.initially_visible ?? false, actionRequired: item.action_required ?? false, resolutionActions: item.resolution_actions ?? [] }));
}

export const legacyScenarios: Scenario[] = (canonicalBundle.cases as unknown as CanonicalCase[]).flatMap((canonicalCase) => {
  const presentation = currentScenarios.find((item) => item.caseId === canonicalCase.case_id);
  if (!presentation) return [];
  const raw = canonicalCase.scenario;
  return [{ ...presentation, version: raw.metadata.content_version, fingerprint: canonicalCase.scenario_fingerprint, sourceFingerprint: undefined, opening: { en: canonicalCase.scenario_localizations?.en?.metadata?.summary ?? raw.metadata.summary, ru: canonicalCase.scenario_localizations?.ru?.metadata?.summary ?? raw.metadata.summary }, initialStageId: raw.initial_stage, initialClockMinute: (raw.initial_clock?.day ?? 0) * 1440 + (raw.initial_clock?.minute_of_day ?? 0), stages: raw.stages.map((stage) => adaptStage(canonicalCase, stage)), deadlines: adaptDeadlines(canonicalCase), workflowInbox: adaptInbox(canonicalCase) }];
});
