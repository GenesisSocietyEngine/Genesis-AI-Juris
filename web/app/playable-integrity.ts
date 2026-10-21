import type { DecisionOption, Scenario } from "./types";
import { canonicalFingerprint, isRecord } from "./case-integrity";
import { stageClockMinute } from "./game-engine";

export function playableFingerprint(scenario: Scenario) {
  return canonicalFingerprint(Object.fromEntries(Object.entries(scenario).filter(([key]) => key !== "fingerprint")));
}

export function normalizePlayableScenario(value: unknown): Scenario {
  if (!isRecord(value)) throw new Error("Invalid playable scenario");
  const id = identifier(value.id, "scenario ID");
  const caseId = identifier(value.caseId, "case ID");
  const version = string(value.version, "version", 40);
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid playable version");
  const title = localText(value.title, "title");
  const subtitle = localText(value.subtitle, "subtitle");
  const role = localText(value.role, "role");
  const sector = localText(value.sector, "sector");
  const opening = localText(value.opening, "opening", 8_000);
  if (!Array.isArray(value.stages) || value.stages.length === 0 || value.stages.length > 100) throw new Error("Invalid stages");
  const stages = value.stages.map((stageValue) => {
    if (!isRecord(stageValue) || !Array.isArray(stageValue.options) || stageValue.options.length > 50) throw new Error("Invalid stage");
    const options = stageValue.options.map(normalizeOption);
    return {
      id: identifier(stageValue.id, "stage ID"),
      day: integer(stageValue.day, 1, 10_000),
      time: string(stageValue.time, "stage time", 20),
      phase: localText(stageValue.phase, "stage phase"),
      headline: localText(stageValue.headline, "stage headline"),
      brief: localText(stageValue.brief, "stage brief", 8_000),
      source: localText(stageValue.source, "stage source"),
      pressure: stageValue.pressure === undefined ? undefined : localText(stageValue.pressure, "stage pressure"),
      materialRefs: stringArray(stageValue.materialRefs, 100, 160),
      options,
      terminal: stageValue.terminal === true,
    };
  });
  const stageIds = new Set(stages.map((stage) => stage.id));
  for (const stage of stages) stageClockMinute(stage);
  if (stageIds.size !== stages.length) throw new Error("Duplicate stage IDs");
  const allActionIds = stages.flatMap((stage) => stage.options.map((option) => option.id));
  unique(allActionIds, "action IDs");
  const actionIds = new Set(allActionIds);
  const initialStageId = identifier(value.initialStageId, "initial stage ID");
  if (!stageIds.has(initialStageId)) throw new Error("Initial stage not found");
  if (stages.find((stage) => stage.id === initialStageId)?.terminal) throw new Error("Initial stage cannot be terminal");
  for (const stage of stages) for (const option of stage.options) if (option.nextStageId && !stageIds.has(option.nextStageId)) throw new Error("Decision target not found");
  if (!Array.isArray(value.materials) || value.materials.length === 0 || value.materials.length > 200) throw new Error("Invalid materials");
  const materials = value.materials.map((material) => {
    if (!isRecord(material)) throw new Error("Invalid material");
    return { ref: identifier(material.ref, "material reference"), type: localText(material.type, "material type"), title: localText(material.title, "material title"), source: localText(material.source, "material source"), date: string(material.date, "material date", 80) };
  });
  unique(materials.map((item) => item.ref), "material references");
  const materialRefs = new Set(materials.map((item) => item.ref));
  for (const stage of stages) if (stage.materialRefs.some((ref) => !materialRefs.has(ref))) throw new Error("Stage material not found");
  if (!Array.isArray(value.deadlines) || value.deadlines.length > 200) throw new Error("Invalid deadlines");
  const deadlines = value.deadlines.map((deadline) => {
    if (!isRecord(deadline)) throw new Error("Invalid deadline");
    if (deadline.activationEvent !== undefined && deadline.activationEvent !== null) throw new Error("Activation-event deadlines are not supported by playable-scenario-v1");
    return { id: identifier(deadline.id, "deadline ID"), title: localText(deadline.title, "deadline title"), dueAtMinute: integer(deadline.dueAtMinute, 0, 100_000_000), completionActions: stringArray(deadline.completionActions, 100, 160), activationEvent: optionalString(deadline.activationEvent, 160), missedNextStageId: optionalString(deadline.missedNextStageId, 160) };
  });
  unique(deadlines.map((item) => item.id), "deadline IDs");
  for (const deadline of deadlines) {
    if (deadline.missedNextStageId && !stageIds.has(deadline.missedNextStageId)) throw new Error("Deadline target not found");
    if (deadline.completionActions.some((action) => !actionIds.has(action))) throw new Error("Deadline completion action not found");
  }
  if (!Array.isArray(value.workflowInbox) || value.workflowInbox.length > 200) throw new Error("Invalid inbox");
  const workflowInbox = value.workflowInbox.map((item) => {
    if (!isRecord(item)) throw new Error("Invalid inbox item");
    return { id: identifier(item.id, "inbox ID"), subject: localText(item.subject, "inbox subject"), body: localText(item.body, "inbox body", 8_000), initiallyVisible: item.initiallyVisible === true, actionRequired: item.actionRequired === true, resolutionActions: stringArray(item.resolutionActions, 100, 160) };
  });
  unique(workflowInbox.map((item) => item.id), "inbox IDs");
  for (const item of workflowInbox) if (item.resolutionActions.some((action) => !actionIds.has(action))) throw new Error("Inbox resolution action not found");
  const outcomesValue = value.outcomes;
  if (!isRecord(outcomesValue)) throw new Error("Invalid outcomes");
  const result: Scenario = {
    id, caseId,
    order: integer(value.order, 1, 99_999),
    title, subtitle,
    jurisdiction: string(value.jurisdiction, "jurisdiction", 160),
    role, version, sector,
    urgency: value.urgency === "critical" || value.urgency === "elevated" ? value.urgency : "standard",
    fingerprint: typeof value.fingerprint === "string" ? value.fingerprint.slice(0, 140) : "",
    sourceFingerprint: typeof value.sourceFingerprint === "string" ? value.sourceFingerprint.slice(0, 140) : undefined,
    accent: /^#[0-9a-fA-F]{6}$/.test(String(value.accent)) ? String(value.accent) : "#5bb8c4",
    actors: Array.isArray(value.actors) ? value.actors.slice(0, 100).map((actor) => localText(actor, "actor")) : [],
    materials, stages, opening, initialStageId,
    initialClockMinute: integer(value.initialClockMinute, 0, 100_000_000),
    deadlines, workflowInbox,
    outcomes: { strong: localText(outcomesValue.strong, "strong outcome", 8_000), mixed: localText(outcomesValue.mixed, "mixed outcome", 8_000), weak: localText(outcomesValue.weak, "weak outcome", 8_000) },
  };
  const reachable = new Set<string>();
  const pending = [initialStageId, ...deadlines.flatMap((deadline) => deadline.missedNextStageId ? [deadline.missedNextStageId] : [])];
  while (pending.length) {
    const current = pending.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const currentStage = stages.find((stage) => stage.id === current);
    for (const option of currentStage?.options ?? []) if (option.nextStageId && !reachable.has(option.nextStageId)) pending.push(option.nextStageId);
  }
  const canReachTerminal = new Set(stages.filter((stage) => stage.terminal).map((stage) => stage.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const stage of stages) if (!canReachTerminal.has(stage.id) && stage.options.some((option) => option.nextStageId && canReachTerminal.has(option.nextStageId))) {
      canReachTerminal.add(stage.id); changed = true;
    }
  }
  if (!canReachTerminal.has(initialStageId)) throw new Error("No reachable terminal stage");
  for (const deadline of deadlines) if (deadline.missedNextStageId && !canReachTerminal.has(deadline.missedNextStageId)) throw new Error("A deadline route can strand the player");
  for (const stage of stages.filter((item) => reachable.has(item.id) && !item.terminal)) {
    if (stage.options.length === 0 || stage.options.some((option) => !option.nextStageId || !canReachTerminal.has(option.nextStageId))) throw new Error("A playable branch can strand the player");
  }
  return result;
}

function normalizeOption(value: unknown): DecisionOption {
  if (!isRecord(value)) throw new Error("Invalid decision option");
  const effectsValue = isRecord(value.effects) ? value.effects : {};
  const effects = Object.fromEntries(["position", "evidence", "trust", "exposure"].flatMap((key) => typeof effectsValue[key] === "number" && Number.isFinite(effectsValue[key]) ? [[key, effectsValue[key]]] : []));
  const completionDayOffset = optionalInteger(value.completionDayOffset, 0, 10_000);
  const completionMinuteOfDay = optionalInteger(value.completionMinuteOfDay, 0, 1_439);
  if ((completionDayOffset === undefined) !== (completionMinuteOfDay === undefined)) throw new Error("Calendar completion timing must be complete");
  const repeatability = value.repeatability === "once" || value.repeatability === "repeatable" || value.repeatability === "limited" ? value.repeatability : undefined;
  const maxUses = optionalInteger(value.maxUses, 1, 10_000);
  if ((repeatability === "limited") !== (maxUses !== undefined)) throw new Error("Limited actions require an explicit use limit");
  return { id: identifier(value.id, "option ID"), label: localText(value.label, "option label"), detail: localText(value.detail, "option detail", 8_000), result: localText(value.result, "option result", 8_000), cost: integer(value.cost, 0, 1_000_000_000), minutes: integer(value.minutes, 0, 100_000_000), effects, nextStageId: optionalString(value.nextStageId, 160), completionDayOffset, completionMinuteOfDay, repeatability, maxUses };
}
function localText(value: unknown, label: string, max = 2_000) { if (!isRecord(value)) throw new Error(`Invalid ${label}`); return { en: string(value.en, label, max), ru: string(value.ru, label, max) }; }
function string(value: unknown, label: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${label}`); return value.trim(); }
function identifier(value: unknown, label: string) { const result = string(value, label, 160); if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result)) throw new Error(`Invalid ${label}`); return result; }
function integer(value: unknown, min: number, max: number) { if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error("Invalid integer"); return value; }
function optionalInteger(value: unknown, min: number, max: number) { return value === undefined ? undefined : integer(value, min, max); }
function optionalString(value: unknown, max: number) { return value === undefined || value === null ? undefined : string(value, "optional string", max); }
function stringArray(value: unknown, maxItems: number, maxLength: number) { if (!Array.isArray(value) || value.length > maxItems) throw new Error("Invalid string array"); return value.map((item) => string(item, "array item", maxLength)); }
function unique(values: string[], label: string) { if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`); }
