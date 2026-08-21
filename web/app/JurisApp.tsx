"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initialMetrics, scenarios } from "./scenarios";
import type {
  DecisionOption,
  LocalText,
  MetricKey,
  Scenario,
  StudioDraft,
  StudioLink,
  StudioNode,
  StudioNodeType,
} from "./types";

type Locale = "en" | "ru";
type View = "library" | "play" | "studio" | "community" | "help";
type Theme = "office" | "after-hours";
type OutcomeClass = "strong" | "mixed" | "weak";
type DecisionRecord = { stageId: string; stage: string; option: DecisionOption };
type FeedbackTarget = { caseId: string; version: string; title: string; source: "playable" | "studio"; fingerprint?: string };

type InboxEntry = {
  id: string;
  status: string;
  title: string;
  source: string;
  body: string;
  materialRef?: string;
};

type PlayedCaseFile = {
  format: "genesis-juris-played-case";
  schemaVersion: 2;
  exportedAt: string;
  scenario: {
    id: string;
    caseId: string;
    contentVersion: string;
    fingerprint: string;
  };
  playthrough: {
    status: "in_progress" | "completed";
    currentStageId: string;
    clockMinute: number;
    decisions: Array<{
      sequence: number;
      stageId: string;
      optionId: string;
    }>;
    derivedMetrics: Record<MetricKey, number>;
    outcome: OutcomeClass | null;
  };
};

type CustomCaseFile = {
  format: "genesis-juris-custom-case";
  schemaVersion: 1;
  exportedAt: string;
  case: {
    id: string;
    version: string;
    fingerprint: string;
    parent: StudioDraft["parent"];
  };
  draft: StudioDraft;
};

const ui = {
  en: {
    library: "Case Library", play: "Operations", studio: "Case Studio",
    office: "Office", night: "After hours", catalogue: "Production catalogue",
    openCase: "Open case file", launch: "Launch scenario", continue: "Continue operation",
    role: "Your role", jurisdiction: "Jurisdiction", dossier: "Dossier",
    situation: "Situation", attention: "Inbox attention", decisions: "Available decisions",
    pressure: "Pressure", noPressure: "No active regulatory pressure", visibleMaterial: "Visible material",
    review: "Review decision", cancel: "Cancel", confirm: "Confirm & dispatch",
    consequence: "Operational consequence", continueCase: "Continue case", debrief: "View debrief",
    returnLibrary: "Return to library", position: "Legal position", evidence: "Evidence integrity",
    trust: "Institutional trust", exposure: "Exposure", provenance: "Source provenance",
    actionLog: "Decision record", day: "Day", cost: "Cost", duration: "Time", complete: "Case debrief",
    adaptation: "Interactive web adaptation",
    canonNote: "Catalogue identity and canonical outcome families are preserved. This browser simulation is not the authoritative Rust runtime.",
    author: "Case authoring command deck",
    authorLead: "Describe a legal crisis in plain language, then shape its actors, evidence, deadlines, decisions and outcomes on the visual graph.",
    prompt: "Case prompt", generate: "Generate case graph", save: "Save draft", saved: "Draft saved on this device",
    export: "Export JSON", import: "Import JSON", newDraft: "New draft", graph: "Scenario graph",
    importCustom: "Import custom case", exportCustom: "Export custom case", childVersion: "Create child version",
    customCase: "Custom case", caseId: "Case ID", version: "Version", parentCase: "Parent case", fingerprint: "Content fingerprint",
    exportPlay: "Export play JSON", importPlay: "Import played case", importedPlay: "Played case restored",
    invalidPlay: "This file is not a valid or compatible GENESIS: JURIS played case.",
    inspector: "Node inspector", checks: "Integrity checks", preview: "Playable preview", addNode: "Add node",
    deleteNode: "Delete node", title: "Title", detail: "Detail", nodeType: "Node type",
    noSelection: "Select a node in the graph to edit it.", allClear: "Draft passes structural checks.",
    localNote: "Drafts are saved locally in this browser. Export JSON for source control or Rust authoring handoff.",
    community: "Community", help: "Help", feedback: "Give feedback",
    nodeTypes: { trigger: "Trigger", actor: "Actor", fact: "Fact", evidence: "Evidence", deadline: "Deadline", decision: "Decision", outcome: "Outcome", entity: "Entity / jurisdiction", tax_rule: "Tax rule", cash_flow: "Cash flow" } as Record<StudioNodeType, string>,
  },
  ru: {
    library: "Библиотека дел", play: "Операции", studio: "Студия кейсов",
    office: "Офис", night: "После работы", catalogue: "Производственный каталог",
    openCase: "Открыть дело", launch: "Запустить сценарий", continue: "Продолжить операцию",
    role: "Ваша роль", jurisdiction: "Юрисдикция", dossier: "Досье",
    situation: "Ситуация", attention: "Требуют внимания", decisions: "Доступные решения",
    pressure: "Давление", noPressure: "Активного регуляторного давления нет", visibleMaterial: "Видимые материалы",
    review: "Проверка решения", cancel: "Отмена", confirm: "Подтвердить и отправить",
    consequence: "Операционное последствие", continueCase: "Продолжить дело", debrief: "Открыть разбор",
    returnLibrary: "Вернуться в библиотеку", position: "Правовая позиция", evidence: "Целостность доказательств",
    trust: "Институциональное доверие", exposure: "Экспозиция", provenance: "Происхождение источника",
    actionLog: "Реестр решений", day: "День", cost: "Стоимость", duration: "Время", complete: "Разбор дела",
    adaptation: "Интерактивная веб-адаптация",
    canonNote: "Идентичность каталога и канонические семейства исходов сохранены. Браузерная симуляция не заменяет authoritative Rust runtime.",
    author: "Командная палуба автора",
    authorLead: "Опишите юридический кризис обычным языком, затем соберите акторов, доказательства, сроки, решения и исходы на визуальном графе.",
    prompt: "Промпт кейса", generate: "Построить граф кейса", save: "Сохранить черновик", saved: "Черновик сохранён на этом устройстве",
    export: "Экспорт JSON", import: "Импорт JSON", newDraft: "Новый черновик", graph: "Граф сценария",
    importCustom: "Импорт custom-кейса", exportCustom: "Экспорт custom-кейса", childVersion: "Создать дочернюю версию",
    customCase: "Custom-кейс", caseId: "ID кейса", version: "Версия", parentCase: "Родительский кейс", fingerprint: "Отпечаток содержимого",
    exportPlay: "Экспорт прохождения", importPlay: "Импорт прохождения", importedPlay: "Прохождение восстановлено",
    invalidPlay: "Файл не является корректным или совместимым прохождением GENESIS: JURIS.",
    inspector: "Инспектор узла", checks: "Проверки целостности", preview: "Игровой предпросмотр", addNode: "Добавить узел",
    deleteNode: "Удалить узел", title: "Название", detail: "Описание", nodeType: "Тип узла",
    noSelection: "Выберите узел на графе, чтобы отредактировать его.", allClear: "Черновик прошёл структурные проверки.",
    localNote: "Черновики сохраняются локально в этом браузере. Экспортируйте JSON для репозитория или передачи в Rust authoring.",
    community: "Сообщество", help: "Помощь", feedback: "Дать отзыв",
    nodeTypes: { trigger: "Триггер", actor: "Актор", fact: "Факт", evidence: "Доказательство", deadline: "Срок", decision: "Решение", outcome: "Исход", entity: "Компания / юрисдикция", tax_rule: "Налоговое правило", cash_flow: "Денежный поток" } as Record<StudioNodeType, string>,
  },
};

type UiText = (typeof ui)["en"];

const metricLabels: Record<Locale, Record<MetricKey, string>> = {
  en: { position: "Position", evidence: "Evidence", trust: "Trust", exposure: "Exposure" },
  ru: { position: "Позиция", evidence: "Доказательства", trust: "Доверие", exposure: "Экспозиция" },
};

const typeColors: Record<StudioNodeType, string> = {
  trigger: "#f06b4f", actor: "#5bb8c4", fact: "#d2a85e", evidence: "#8fc2a9",
  deadline: "#e48a68", decision: "#f0c35b", outcome: "#a594d8", entity: "#68a8dc",
  tax_rule: "#d09a66", cash_flow: "#72c6a4",
};

const iconPaths: Record<string, React.ReactNode> = {
  library: <><path d="M4 5.5h16M6 3v5M18 3v5M5 10h14v10H5z"/><path d="M9 14h6M9 17h4"/></>,
  play: <><path d="M4 19V8l8-4 8 4v11"/><path d="M8 19v-6h8v6M3 19h18"/></>,
  studio: <><path d="M6 5h4v4H6zM14 15h4v4h-4zM16 4v7M8 13v6M10 7h6M8 15h6"/></>,
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  arrow: <path d="M5 12h14M14 7l5 5-5 5"/>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  alert: <><path d="m12 3 9 17H3z"/><path d="M12 9v5M12 17.5v.1"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>, check: <path d="m4 12 5 5L20 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></>,
  save: <><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
  reset: <><path d="M5 8V4M5 4h4"/><path d="M5.5 4.5A8 8 0 1 1 4 14"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  spark: <><path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function local(value: LocalText, locale: Locale) { return value[locale]; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function formatCaseClock(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const day = Math.floor(safe / 1440) + 1;
  const minuteOfDay = safe % 1440;
  return { day, time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}` };
}
function actionCompletionMinute(currentMinute: number, option: DecisionOption) {
  const elapsedTarget = currentMinute + option.minutes;
  if (option.completionDayOffset === undefined || option.completionMinuteOfDay === undefined) return elapsedTarget;
  const currentDay = Math.floor(currentMinute / 1440);
  const calendarTarget = (currentDay + option.completionDayOffset) * 1440 + option.completionMinuteOfDay;
  return Math.max(elapsedTarget, calendarTarget);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function slugifyCaseId(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `custom_case_${Date.now()}`;
}
function caseFingerprint(draft: StudioDraft) {
  const content = JSON.stringify({
    title: draft.title,
    jurisdiction: draft.jurisdiction,
    role: draft.role,
    premise: draft.premise,
    nodes: draft.nodes,
    links: draft.links,
  });
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function bumpPatchVersion(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : "1.0.1";
}
function normalizeStudioDraft(value: unknown): StudioDraft {
  if (!isRecord(value) || typeof value.title !== "string" || !Array.isArray(value.nodes) || !Array.isArray(value.links)) {
    throw new Error("Invalid custom case draft");
  }
  const parent = isRecord(value.parent) && typeof value.parent.caseId === "string" && typeof value.parent.version === "string" && typeof value.parent.fingerprint === "string"
    ? { caseId: value.parent.caseId, version: value.parent.version, fingerprint: value.parent.fingerprint }
    : null;
  return {
    ...(value as unknown as StudioDraft),
    caseId: typeof value.caseId === "string" && value.caseId.trim() ? value.caseId : slugifyCaseId(value.title),
    version: typeof value.version === "string" && value.version.trim() ? value.version : "1.0.0",
    parent,
    jurisdiction: typeof value.jurisdiction === "string" ? value.jurisdiction : "",
    role: typeof value.role === "string" ? value.role : "",
    premise: typeof value.premise === "string" ? value.premise : "",
    classification: isRecord(value.classification) ? {
      practiceArea: typeof value.classification.practiceArea === "string" ? value.classification.practiceArea : "General legal",
      difficulty: typeof value.classification.difficulty === "string" ? value.classification.difficulty : "Intermediate",
      tags: Array.isArray(value.classification.tags) ? value.classification.tags.filter((item): item is string => typeof item === "string") : [],
      taxTopics: Array.isArray(value.classification.taxTopics) ? value.classification.taxTopics.filter((item): item is string => typeof item === "string") : [],
      complianceOnly: value.classification.complianceOnly !== false,
    } : { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true },
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}
function classifyOutcome(metrics: Record<MetricKey, number>): OutcomeClass {
  const resilience = metrics.position + metrics.evidence + metrics.trust - metrics.exposure;
  return resilience >= 150 ? "strong" : resilience >= 112 ? "mixed" : "weak";
}

const defaultPrompt = `A renewable-energy developer discovers that its community consultation map omitted two households before a permit hearing. The planning authority requests a corrected record within 36 hours. Create a case for counsel to preserve evidence, coordinate the developer and mapping contractor, decide whether to seek an adjournment, and reach either a credible corrected process or a compromised permit position.`;

const defaultDraft: StudioDraft = {
  caseId: "the_missing_boundary",
  version: "1.0.0",
  parent: null,
  title: "The Missing Boundary", jurisdiction: "UK · Planning", role: "Project counsel",
  premise: "A consultation map omitted two households before a permit hearing.", updatedAt: new Date(0).toISOString(),
  classification: { practiceArea: "Planning & regulatory", difficulty: "Intermediate", tags: ["evidence", "regulatory", "deadline"], taxTopics: [], complianceOnly: true },
  nodes: [
    { id: "trigger-1", type: "trigger", title: "Omitted households discovered", detail: "The consultation map excluded two addresses.", x: 50, y: 220 },
    { id: "actor-1", type: "actor", title: "Planning authority", detail: "Requests a corrected record within 36 hours.", x: 270, y: 70 },
    { id: "evidence-1", type: "evidence", title: "Map revision history", detail: "GIS exports, contractor instructions and approval log.", x: 270, y: 270 },
    { id: "deadline-1", type: "deadline", title: "36-hour correction window", detail: "Before the permit hearing bundle closes.", x: 490, y: 80 },
    { id: "decision-1", type: "decision", title: "Correct or adjourn", detail: "Choose a corrected filing or seek an adjournment.", x: 510, y: 300 },
    { id: "outcome-1", type: "outcome", title: "Credible corrected process", detail: "The record is repaired and participation restored.", x: 750, y: 180 },
    { id: "outcome-2", type: "outcome", title: "Compromised permit position", detail: "The omission undermines procedural confidence.", x: 750, y: 390 },
  ],
  links: [
    { from: "trigger-1", to: "actor-1" }, { from: "trigger-1", to: "evidence-1" },
    { from: "actor-1", to: "deadline-1" }, { from: "evidence-1", to: "decision-1" },
    { from: "deadline-1", to: "decision-1" }, { from: "decision-1", to: "outcome-1" },
    { from: "decision-1", to: "outcome-2" },
  ],
};

export default function JurisApp() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("after-hours");
  const [view, setView] = useState<View>("library");
  const [featuredId, setFeaturedId] = useState(scenarios[2].id);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [metrics, setMetrics] = useState({ ...initialMetrics });
  const [selectedOption, setSelectedOption] = useState<DecisionOption | null>(null);
  const [resultOption, setResultOption] = useState<DecisionOption | null>(null);
  const [decisionLog, setDecisionLog] = useState<DecisionRecord[]>([]);
  const [outcome, setOutcome] = useState<"strong" | "mixed" | "weak" | null>(null);
  const [dossierRef, setDossierRef] = useState<string | null>(null);
  const [caseMinute, setCaseMinute] = useState(0);
  const [actionUseCounts, setActionUseCounts] = useState<Record<string, number>>({});
  const [completedDeadlineIds, setCompletedDeadlineIds] = useState<string[]>([]);
  const [missedDeadlineIds, setMissedDeadlineIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [draft, setDraft] = useState<StudioDraft>(defaultDraft);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("decision-1");
  const [savedFlash, setSavedFlash] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const playedCaseImportRef = useRef<HTMLInputElement>(null);
  const text = ui[locale];

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const stored = window.localStorage.getItem("genesis-juris-studio-draft");
      if (stored) {
        try {
          setDraft(normalizeStudioDraft(JSON.parse(stored)));
        } catch {
          // Keep the bundled draft when local storage contains invalid data.
        }
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  const featured = scenarios.find((scenario) => scenario.id === featuredId) ?? scenarios[2];
  const stage = activeScenario?.stages[stageIndex] ?? null;
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const checks = useMemo(() => validateDraft(draft, locale), [draft, locale]);

  function navigate(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function startScenario(scenario: Scenario) {
    const initialIndex = Math.max(0, scenario.stages.findIndex((item) => item.id === scenario.initialStageId));
    setActiveScenario(scenario); setStageIndex(initialIndex); setMetrics({ ...initialMetrics }); setDecisionLog([]);
    setCaseMinute(scenario.initialClockMinute); setActionUseCounts({}); setCompletedDeadlineIds([]); setMissedDeadlineIds([]);
    setOutcome(null); setSelectedOption(null); setResultOption(null); setDossierRef(scenario.materials[0]?.ref ?? null); navigate("play");
  }
  function dispatchDecision() {
    if (!selectedOption || !stage || !activeScenario) return;
    const updated = { ...metrics };
    (Object.keys(selectedOption.effects) as MetricKey[]).forEach((key) => { updated[key] = clamp(updated[key] + (selectedOption.effects[key] ?? 0)); });
    const updatedMinute = actionCompletionMinute(caseMinute, selectedOption);
    const newlyCompleted = activeScenario.deadlines.filter((deadline) => deadline.completionActions.includes(selectedOption.id)).map((deadline) => deadline.id);
    const allCompleted = Array.from(new Set([...completedDeadlineIds, ...newlyCompleted]));
    const newlyMissedDeadlines = activeScenario.deadlines.filter((deadline) => !allCompleted.includes(deadline.id) && updatedMinute > deadline.dueAtMinute && !missedDeadlineIds.includes(deadline.id));
    if (newlyMissedDeadlines.length > 0) {
      updated.exposure = clamp(updated.exposure + newlyMissedDeadlines.length * 8);
      updated.trust = clamp(updated.trust - newlyMissedDeadlines.length * 4);
    }
    const forcedStageId = newlyMissedDeadlines.find((deadline) => deadline.missedNextStageId)?.missedNextStageId;
    const dispatchedOption: DecisionOption = forcedStageId ? {
      ...selectedOption,
      nextStageId: forcedStageId,
      result: {
        en: `${selectedOption.result.en} A controlling deadline expired and the matter was routed to ${activeScenario.stages.find((item) => item.id === forcedStageId)?.headline.en ?? forcedStageId}.`,
        ru: `${selectedOption.result.ru} Контрольный срок истёк; дело переведено на стадию «${activeScenario.stages.find((item) => item.id === forcedStageId)?.headline.ru ?? forcedStageId}».`,
      },
    } : selectedOption;
    setMetrics(updated);
    setCaseMinute(updatedMinute);
    setCompletedDeadlineIds(allCompleted);
    setMissedDeadlineIds((current) => Array.from(new Set([...current, ...newlyMissedDeadlines.map((deadline) => deadline.id)])));
    setActionUseCounts((current) => ({ ...current, [selectedOption.id]: (current[selectedOption.id] ?? 0) + 1 }));
    setDecisionLog((current) => [...current, { stageId: stage.id, stage: local(stage.headline, locale), option: dispatchedOption }]);
    setResultOption(dispatchedOption); setSelectedOption(null);
  }
  function advanceStage() {
    if (!activeScenario) return; setResultOption(null);
    const nextStageId = resultOption?.nextStageId;
    if (!nextStageId) return;
    const nextIndex = activeScenario.stages.findIndex((item) => item.id === nextStageId);
    if (nextIndex < 0) return;
    setStageIndex(nextIndex);
    if (activeScenario.stages[nextIndex].terminal) setOutcome(classifyOutcome(metrics));
  }
  function showSessionNotice(message: string) {
    setSessionNotice(message);
    window.setTimeout(() => setSessionNotice(null), 3200);
  }
  function exportPlayedCase() {
    if (!activeScenario) return;
    const decisions = decisionLog.map((entry, index) => {
      const sourceStage = activeScenario.stages.find((item) => item.id === entry.stageId);
      const sourceOption = sourceStage?.options.find((option) => option.id === entry.option.id);
      if (!sourceStage || !sourceOption) throw new Error("The current decision log does not match the scenario catalogue.");
      return { sequence: index + 1, stageId: sourceStage.id, optionId: sourceOption.id };
    });
    const payload: PlayedCaseFile = {
      format: "genesis-juris-played-case",
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      scenario: {
        id: activeScenario.id,
        caseId: activeScenario.caseId,
        contentVersion: activeScenario.version,
        fingerprint: activeScenario.fingerprint,
      },
      playthrough: {
        status: outcome ? "completed" : "in_progress",
        currentStageId: activeScenario.stages[stageIndex].id,
        clockMinute: caseMinute,
        decisions,
        derivedMetrics: metrics,
        outcome,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeScenario.id}-played-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function importPlayedCase(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isRecord(parsed) || parsed.format !== "genesis-juris-played-case" || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)) throw new Error("Unsupported played-case schema");
        if (!isRecord(parsed.scenario) || !isRecord(parsed.playthrough)) throw new Error("Missing played-case sections");

        const importedScenario = scenarios.find((scenario) => scenario.id === parsed.scenario.id);
        if (!importedScenario || parsed.scenario.caseId !== importedScenario.caseId || parsed.scenario.contentVersion !== importedScenario.version || parsed.scenario.fingerprint !== importedScenario.fingerprint) {
          throw new Error("Scenario identity or content version does not match the current catalogue");
        }

        const importedDecisions = parsed.playthrough.decisions;
        const importedStatus = parsed.playthrough.status;
        const currentStageId = parsed.playthrough.currentStageId;
        if (!Array.isArray(importedDecisions) || (importedStatus !== "in_progress" && importedStatus !== "completed") || typeof currentStageId !== "string") {
          throw new Error("Invalid playthrough state");
        }
        const restoredMetrics = { ...initialMetrics };
        const restoredLog: DecisionRecord[] = [];
        const restoredActionUses: Record<string, number> = {};
        const restoredCompletedDeadlines: string[] = [];
        const restoredMissedDeadlines: string[] = [];
        let restoredMinute = importedScenario.initialClockMinute;
        let restoredStageId = importedScenario.initialStageId;

        importedDecisions.forEach((decision, index) => {
          if (!isRecord(decision) || decision.sequence !== index + 1) throw new Error("Invalid decision sequence");
          const sourceStage = importedScenario.stages.find((item) => item.id === restoredStageId);
          if (!sourceStage || decision.stageId !== sourceStage.id || typeof decision.optionId !== "string") throw new Error("Decision stage mismatch");
          const sourceOption = sourceStage.options.find((option) => option.id === decision.optionId);
          if (!sourceOption) throw new Error("Decision option is not in the current catalogue");
          const priorUses = restoredActionUses[sourceOption.id] ?? 0;
          if (sourceOption.repeatability === "once" && priorUses > 0) throw new Error("Single-use action was repeated");
          if (sourceOption.repeatability === "limited" && priorUses >= (sourceOption.maxUses ?? 1)) throw new Error("Action use limit exceeded");
          restoredActionUses[sourceOption.id] = priorUses + 1;
          (Object.keys(sourceOption.effects) as MetricKey[]).forEach((key) => {
            restoredMetrics[key] = clamp(restoredMetrics[key] + (sourceOption.effects[key] ?? 0));
          });
          restoredMinute = actionCompletionMinute(restoredMinute, sourceOption);
          importedScenario.deadlines.forEach((deadline) => {
            if (deadline.completionActions.includes(sourceOption.id) && !restoredCompletedDeadlines.includes(deadline.id)) restoredCompletedDeadlines.push(deadline.id);
          });
          const newlyMissed = importedScenario.deadlines.filter((deadline) => !restoredCompletedDeadlines.includes(deadline.id) && !restoredMissedDeadlines.includes(deadline.id) && restoredMinute > deadline.dueAtMinute);
          newlyMissed.forEach((deadline) => restoredMissedDeadlines.push(deadline.id));
          if (newlyMissed.length > 0) {
            restoredMetrics.exposure = clamp(restoredMetrics.exposure + newlyMissed.length * 8);
            restoredMetrics.trust = clamp(restoredMetrics.trust - newlyMissed.length * 4);
          }
          const forcedStageId = newlyMissed.find((deadline) => deadline.missedNextStageId)?.missedNextStageId;
          const restoredOption = forcedStageId ? { ...sourceOption, nextStageId: forcedStageId } : sourceOption;
          restoredLog.push({ stageId: sourceStage.id, stage: local(sourceStage.headline, locale), option: restoredOption });
          restoredStageId = restoredOption.nextStageId ?? restoredStageId;
        });

        const restoredStageIndex = importedScenario.stages.findIndex((item) => item.id === restoredStageId);
        if (restoredStageIndex < 0) throw new Error("Current stage is not in the scenario");
        const completed = importedStatus === "completed";
        if (currentStageId !== restoredStageId || (completed && !importedScenario.stages[restoredStageIndex].terminal) || (!completed && importedScenario.stages[restoredStageIndex].terminal)) throw new Error("Playthrough progress is inconsistent");

        setActiveScenario(importedScenario);
        setFeaturedId(importedScenario.id);
        setStageIndex(restoredStageIndex);
        setMetrics(restoredMetrics);
        setDecisionLog(restoredLog);
        setCaseMinute(restoredMinute);
        setActionUseCounts(restoredActionUses);
        setCompletedDeadlineIds(restoredCompletedDeadlines);
        setMissedDeadlineIds(restoredMissedDeadlines);
        setOutcome(completed ? classifyOutcome(restoredMetrics) : null);
        setSelectedOption(null);
        setResultOption(null);
        setDossierRef(importedScenario.materials[0]?.ref ?? null);
        navigate("play");
        showSessionNotice(text.importedPlay);
      } catch {
        window.alert(text.invalidPlay);
      }
    };
    reader.readAsText(file);
  }
  function generateDraft() {
    const clean = prompt.trim(); const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    const titleSeed = (sentences[0] ?? "Untitled legal scenario").replace(/[.!?]$/, "");
    const shortTitle = titleSeed.split(" ").slice(0, 6).join(" ");
    const deadlineMatch = clean.match(/(?:within|in|за|через)\s+([\d]+\s*(?:hours?|days?|час(?:а|ов)?|дн(?:я|ей)))/i);
    const actorCandidates = Array.from(clean.matchAll(/(?:the|a|an)\s+([A-Z][a-z-]+(?:\s+[A-Z]?[a-z-]+){0,2})/g)).map((match) => match[1]);
    const nodes: StudioNode[] = [
      { id: "trigger-1", type: "trigger", title: shortTitle, detail: sentences[0] ?? clean, x: 45, y: 235 },
      { id: "actor-1", type: "actor", title: actorCandidates[0] ?? "Client leadership", detail: "Primary institutional actor named in the prompt.", x: 265, y: 65 },
      { id: "actor-2", type: "actor", title: actorCandidates[1] ?? "Regulatory authority", detail: "Counterparty, authority or affected stakeholder.", x: 265, y: 390 },
      { id: "evidence-1", type: "evidence", title: "Preserve the source record", detail: sentences[1] ?? "Identify authoritative documents and physical evidence.", x: 300, y: 235 },
      { id: "deadline-1", type: "deadline", title: deadlineMatch ? `${deadlineMatch[1]} response window` : "Procedural response window", detail: "A visible, source-bound deadline.", x: 515, y: 70 },
      { id: "decision-1", type: "decision", title: "Choose the institutional response", detail: sentences[2] ?? "Create at least two complete, consequential responses.", x: 520, y: 280 },
      { id: "outcome-1", type: "outcome", title: "Position protected", detail: "Evidence and institutional process remain credible.", x: 760, y: 150 },
      { id: "outcome-2", type: "outcome", title: "Position compromised", detail: sentences.at(-1) ?? "The decision creates an open risk.", x: 760, y: 390 },
    ];
    const links: StudioLink[] = [
      { from: "trigger-1", to: "actor-1" }, { from: "trigger-1", to: "actor-2" }, { from: "trigger-1", to: "evidence-1" },
      { from: "actor-1", to: "deadline-1" }, { from: "evidence-1", to: "decision-1" }, { from: "deadline-1", to: "decision-1" },
      { from: "decision-1", to: "outcome-1" }, { from: "decision-1", to: "outcome-2" },
    ];
    setDraft({ caseId: slugifyCaseId(shortTitle), version: "1.0.0", parent: null, title: shortTitle, jurisdiction: "Set jurisdiction", role: "Scenario counsel", premise: clean, classification: { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }, nodes, links, updatedAt: new Date().toISOString() });
    setSelectedNodeId("decision-1");
  }
  function saveDraft() {
    const next = { ...draft, updatedAt: new Date().toISOString() }; setDraft(next);
    window.localStorage.setItem("genesis-juris-studio-draft", JSON.stringify(next)); setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }
  function exportDraft() {
    const payload: CustomCaseFile = {
      format: "genesis-juris-custom-case",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      case: {
        id: draft.caseId,
        version: draft.version,
        fingerprint: caseFingerprint(draft),
        parent: draft.parent,
      },
      draft: { ...draft, updatedAt: new Date().toISOString() },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${draft.caseId}-v${draft.version}.juris-case.json`;
    link.click(); URL.revokeObjectURL(url);
  }
  function importDraft(file: File) {
    const reader = new FileReader(); reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        let imported: StudioDraft;
        if (isRecord(parsed) && parsed.format === "genesis-juris-custom-case" && parsed.schemaVersion === 1 && isRecord(parsed.case)) {
          imported = normalizeStudioDraft(parsed.draft);
          if (parsed.case.id !== imported.caseId || parsed.case.version !== imported.version || parsed.case.fingerprint !== caseFingerprint(imported)) {
            throw new Error("Custom case identity or fingerprint mismatch");
          }
        } else {
          imported = normalizeStudioDraft(parsed);
        }
        const restored = { ...imported, updatedAt: new Date().toISOString() };
        setDraft(restored);
        setPrompt(restored.premise);
        setSelectedNodeId(restored.nodes[0]?.id ?? null);
        navigate("studio");
        showSessionNotice(locale === "en" ? "Custom case loaded in the visual editor" : "Custom-кейс открыт в визуальном редакторе");
      } catch { window.alert(locale === "en" ? "This file is not a valid GENESIS: JURIS case draft." : "Файл не является корректным черновиком GENESIS: JURIS."); }
    }; reader.readAsText(file);
  }
  function createChildVersion() {
    setDraft((current) => ({
      ...current,
      parent: { caseId: current.caseId, version: current.version, fingerprint: caseFingerprint(current) },
      version: bumpPatchVersion(current.version),
      updatedAt: new Date().toISOString(),
    }));
    showSessionNotice(locale === "en" ? "Child version created with parent trace" : "Дочерняя версия создана со ссылкой на родителя");
  }
  function updateNode(change: Partial<StudioNode>) {
    if (!selectedNodeId) return;
    setDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNodeId ? { ...node, ...change } : node) }));
  }
  function addNode(type: StudioNodeType) {
    const id = `${type}-${Date.now()}`;
    setDraft((current) => ({ ...current, nodes: [...current.nodes, { id, type, title: text.nodeTypes[type], detail: "", x: 430, y: 220 }] })); setSelectedNodeId(id);
  }
  function loadTaxTemplate() {
    const taxPrompt = "A Belgian-headed group is considering a cross-border IP and financing structure involving Belgium, the Netherlands and the UAE. Model the cash flows, treaty access, beneficial ownership, transfer pricing, substance, CFC, permanent establishment, withholding tax, DAC6 and Pillar Two implications. Require documented commercial purpose and compare compliant alternatives; exclude concealment, sham arrangements and tax evasion.";
    setPrompt(taxPrompt);
    setDraft({
      caseId: "cross_border_ip_financing_review", version: "1.0.0", parent: null,
      title: "Cross-border IP & Financing Review", jurisdiction: "Belgium · EU · International",
      role: "International tax counsel", premise: taxPrompt,
      classification: { practiceArea: "International tax planning", difficulty: "Advanced", tags: ["tax", "cross-border", "advisory", "anti-abuse"], taxTopics: ["Treaty access", "Beneficial ownership", "Transfer pricing", "Substance", "CFC", "PE", "Withholding tax", "DAC6", "Pillar Two"], complianceOnly: true },
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: "trigger-1", type: "trigger", title: "Proposed IP and financing restructure", detail: "The group requests a defensible comparison before implementation.", x: 35, y: 220 },
        { id: "entity-1", type: "entity", title: "Belgian operating company", detail: "People, functions, risks, assets and effective management.", x: 245, y: 55 },
        { id: "entity-2", type: "entity", title: "NL / UAE entities", detail: "Test residence, substance, beneficial ownership and commercial purpose.", x: 245, y: 360 },
        { id: "cash_flow-1", type: "cash_flow", title: "Royalty and interest flows", detail: "Map gross payments, WHT, tax base and currency by legal relationship.", x: 470, y: 55 },
        { id: "tax_rule-1", type: "tax_rule", title: "Treaty and anti-abuse matrix", detail: "PPT, GAAR, CFC, PE, TP, DAC6 and Pillar Two review.", x: 470, y: 360 },
        { id: "evidence-1", type: "evidence", title: "Substance and pricing file", detail: "Board records, personnel, DEMPE, contracts, forecasts and benchmarking.", x: 690, y: 65 },
        { id: "decision-1", type: "decision", title: "Select a compliant design", detail: "Compare status quo, revised structure and no-go outcome with documented assumptions.", x: 690, y: 300 },
        { id: "outcome-1", type: "outcome", title: "Defensible planning position", detail: "Commercial purpose, governance and tax treatment align.", x: 900, y: 150 },
        { id: "outcome-2", type: "outcome", title: "Redesign or abandon", detail: "Anti-abuse, substance or reporting risks outweigh projected benefit.", x: 900, y: 390 },
      ],
      links: [
        { from: "trigger-1", to: "entity-1" }, { from: "trigger-1", to: "entity-2" },
        { from: "entity-1", to: "cash_flow-1" }, { from: "entity-2", to: "cash_flow-1" },
        { from: "cash_flow-1", to: "tax_rule-1" }, { from: "tax_rule-1", to: "evidence-1" },
        { from: "evidence-1", to: "decision-1" }, { from: "decision-1", to: "outcome-1" }, { from: "decision-1", to: "outcome-2" },
      ],
    });
    setSelectedNodeId("decision-1");
    navigate("studio");
  }
  function deleteNode() {
    if (!selectedNodeId) return;
    setDraft((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selectedNodeId), links: current.links.filter((link) => link.from !== selectedNodeId && link.to !== selectedNodeId) })); setSelectedNodeId(null);
  }
  function moveNode(event: React.PointerEvent<HTMLButtonElement>, node: StudioNode) {
    const canvas = event.currentTarget.parentElement; if (!canvas) return; const rect = canvas.getBoundingClientRect();
    if (event.type === "pointerdown") { event.currentTarget.setPointerCapture(event.pointerId); setDragging({ id: node.id, dx: event.clientX - rect.left - node.x, dy: event.clientY - rect.top - node.y }); setSelectedNodeId(node.id); }
    else if (event.type === "pointermove" && dragging?.id === node.id) {
      const x = Math.max(12, Math.min(rect.width - 178, event.clientX - rect.left - dragging.dx));
      const y = Math.max(12, Math.min(rect.height - 92, event.clientY - rect.top - dragging.dy));
      setDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, x, y } : item) }));
    } else if (event.type === "pointerup" || event.type === "pointercancel") setDragging(null);
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="atmosphere" aria-hidden="true"><span /><span /><span /></div>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("library")} aria-label="GENESIS: JURIS — Case Library"><span className="brand-mark"><i /><i /><i /></span><span><b>GENESIS: JURIS</b><small>LEGAL SCENARIO SYSTEM</small></span></button>
        <nav className="main-nav" aria-label="Primary navigation">
          <button className={view === "library" ? "active" : ""} onClick={() => navigate("library")}><Icon name="library" />{text.library}</button>
          <button className={view === "play" ? "active" : ""} onClick={() => activeScenario ? navigate("play") : startScenario(featured)}><Icon name="play" />{text.play}</button>
          <button className={view === "studio" ? "active" : ""} onClick={() => navigate("studio")}><Icon name="studio" />{text.studio}<span className="nav-new">LAB</span></button>
          <button className={view === "community" ? "active" : ""} onClick={() => navigate("community")}><Icon name="globe" />{text.community}</button>
          <button className={view === "help" ? "active" : ""} onClick={() => navigate("help")}><Icon name="file" />{text.help}</button>
        </nav>
        <div className="top-actions">
          <input
            ref={playedCaseImportRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importPlayedCase(file);
              event.target.value = "";
            }}
          />
          <button className="utility-button" onClick={() => playedCaseImportRef.current?.click()} aria-label={text.importPlay} title={text.importPlay}><Icon name="upload" /><span>{text.importPlay}</span></button>
          {activeScenario && <button className="utility-button" onClick={exportPlayedCase} aria-label={text.exportPlay} title={text.exportPlay}><Icon name="download" /><span>{text.exportPlay}</span></button>}
          <button className="utility-button" onClick={() => setLocale(locale === "en" ? "ru" : "en")} aria-label="Switch language"><Icon name="globe" /><span>{locale.toUpperCase()}</span></button>
          <button className="utility-button" onClick={() => setTheme(theme === "office" ? "after-hours" : "office")} aria-label="Switch atmosphere"><Icon name={theme === "office" ? "sun" : "moon"} /><span>{theme === "office" ? text.office : text.night}</span></button>
        </div>
      </header>

      {view === "library" && <LibraryView locale={locale} text={text} featured={featured} setFeaturedId={setFeaturedId} startScenario={startScenario} requestFeedback={setFeedbackTarget} openTaxTemplate={loadTaxTemplate} />}
      {view === "play" && activeScenario && stage && <PlayView locale={locale} text={text} scenario={activeScenario} stage={stage} stageIndex={stageIndex} metrics={metrics} decisionLog={decisionLog} caseMinute={caseMinute} actionUseCounts={actionUseCounts} completedDeadlineIds={completedDeadlineIds} missedDeadlineIds={missedDeadlineIds} dossierRef={dossierRef} setDossierRef={setDossierRef} setSelectedOption={setSelectedOption} outcome={outcome} exportSession={exportPlayedCase} replayCase={() => startScenario(activeScenario)} returnLibrary={() => navigate("library")} />}
      {view === "studio" && <StudioView locale={locale} text={text} prompt={prompt} setPrompt={setPrompt} draft={draft} setDraft={setDraft} selectedNode={selectedNode} selectedNodeId={selectedNodeId} checks={checks} generateDraft={generateDraft} saveDraft={saveDraft} savedFlash={savedFlash} exportDraft={exportDraft} importRef={importRef} importDraft={importDraft} createChildVersion={createChildVersion} updateNode={updateNode} addNode={addNode} deleteNode={deleteNode} moveNode={moveNode} resetDraft={() => { setDraft(defaultDraft); setPrompt(defaultPrompt); setSelectedNodeId("decision-1"); }} loadTaxTemplate={loadTaxTemplate} requestFeedback={() => setFeedbackTarget({ caseId: draft.caseId, version: draft.version, title: draft.title, source: "studio", fingerprint: caseFingerprint(draft) })} />}
      {view === "community" && <CommunityView locale={locale} cases={scenarios} />}
      {view === "help" && <HelpView locale={locale} openCommunity={() => navigate("community")} openStudio={() => navigate("studio")} />}
      {(selectedOption || resultOption) && activeScenario && stage && <DecisionModal locale={locale} text={text} scenario={activeScenario} stageHeadline={local(stage.headline, locale)} option={selectedOption ?? resultOption!} isResult={Boolean(resultOption)} close={() => { setSelectedOption(null); setResultOption(null); }} dispatch={dispatchDecision} advance={advanceStage} finalStage={Boolean(activeScenario.stages.find((item) => item.id === (selectedOption ?? resultOption)?.nextStageId)?.terminal)} />}
      {sessionNotice && <div className="session-toast" role="status"><Icon name="check" />{sessionNotice}</div>}
      {feedbackTarget && <FeedbackDialog locale={locale} target={feedbackTarget} close={() => setFeedbackTarget(null)} submitted={() => { setFeedbackTarget(null); showSessionNotice(locale === "en" ? "Feedback submitted for expert review." : "Отзыв отправлен на экспертную проверку."); }} />}
    </div>
  );
}

const caseTaxonomy: Record<string, { practice: string; difficulty: string; duration: number; tags: string[] }> = {
  be_commercial_failed_erp_001: { practice: "Commercial disputes", difficulty: "Advanced", duration: 45, tags: ["ERP", "evidence", "litigation"] },
  eu_ai_act_high_risk_001: { practice: "AI regulation", difficulty: "Advanced", duration: 40, tags: ["AI Act", "compliance", "governance"] },
  greenfire_first_72_hours: { practice: "Environmental & crisis", difficulty: "Intermediate", duration: 35, tags: ["incident", "regulatory", "72h"] },
  uk_employment_whistleblower_001: { practice: "Employment", difficulty: "Intermediate", duration: 30, tags: ["whistleblowing", "HR", "investigation"] },
  us_privacy_breach_001: { practice: "Privacy & cybersecurity", difficulty: "Advanced", duration: 40, tags: ["breach", "notification", "privacy"] },
};

function LibraryView({ locale, text, featured, setFeaturedId, startScenario, requestFeedback, openTaxTemplate }: { locale: Locale; text: UiText; featured: Scenario; setFeaturedId: (id: string) => void; startScenario: (scenario: Scenario) => void; requestFeedback: (target: FeedbackTarget) => void; openTaxTemplate: () => void }) {
  const [query, setQuery] = useState("");
  const [practiceFilter, setPracticeFilter] = useState("all");
  const practices = Array.from(new Set(Object.values(caseTaxonomy).map((item) => item.practice)));
  const filteredCases = scenarios.filter((scenario) => {
    const meta = caseTaxonomy[scenario.id];
    const haystack = [scenario.title[locale], scenario.subtitle[locale], scenario.jurisdiction, meta?.practice, ...(meta?.tags ?? [])].join(" ").toLowerCase();
    return (!query.trim() || haystack.includes(query.toLowerCase())) && (practiceFilter === "all" || meta?.practice === practiceFilter);
  });

  return <main className="library-view">
    <section className="library-hero page-width">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot" />{text.catalogue} · 05 CASES</div><h1>{text.library}</h1><p className="hero-deck">{locale === "en" ? "Enter a living legal crisis. Read the record, preserve provenance and make the decision that changes the institutional position." : "Войдите в живой юридический кризис. Изучайте материалы, сохраняйте происхождение доказательств и принимайте решения, меняющие институциональную позицию."}</p><div className="hero-facts"><span>05 {locale === "en" ? "jurisdictions" : "юрисдикций"}</span><span>11 {locale === "en" ? "canonical paths" : "канонических путей"}</span><span>EN / RU</span></div></div>
      <div className="hero-index" aria-label="Catalogue index"><span>CASE INDEX</span><b>{String(featured.order / 10).padStart(2, "0")}</b><small>/ 05</small></div>
    </section>
    <section className="positioning-band page-width"><div><span>PROFESSIONAL JUDGMENT · SIMULATED</span><h2>{locale === "en" ? "Train the decisions that legal work rarely lets you repeat." : "Тренируйте решения, которые реальная юридическая работа редко позволяет повторить."}</h2></div><p>{locale === "en" ? "GENESIS: JURIS is a platform for building, reviewing and playing branching legal simulations. It develops judgment under uncertainty, evidence discipline and risk-aware action — with versioned cases and practitioner feedback." : "GENESIS: JURIS — платформа для создания, рецензирования и прохождения разветвлённых юридических симуляций. Она развивает профессиональное суждение в условиях неопределённости, дисциплину доказательств и управление рисками."}</p></section>
    <section className="featured-case" style={{ "--case-accent": featured.accent } as React.CSSProperties}>
      <div className="case-visual" aria-hidden="true"><div className="case-grid" /><div className="case-orbit orbit-one"/><div className="case-orbit orbit-two"/><div className="case-signal"><span/>{featured.id === "greenfire_first_72_hours" ? "72H" : `0${featured.order / 10}`}</div><div className="file-stamp">LIVE MATTER<br/><b>{featured.version}</b></div></div>
      <div className="featured-content"><div className="case-kicker"><span>{featured.jurisdiction}</span><span>{featured.sector[locale]}</span></div><h2>{featured.title[locale]}</h2><p className="case-subtitle">{featured.subtitle[locale]}</p><p className="case-brief">{featured.opening[locale]}</p><div className="case-depth"><span>{featured.stages.length} {locale === "en" ? "workflow stages" : "стадий процесса"}</span><span>{featured.stages.reduce((sum, item) => sum + item.options.length, 0)} {locale === "en" ? "actions" : "действий"}</span><span>{featured.deadlines.length} {locale === "en" ? "deadlines" : "дедлайнов"}</span></div><dl className="case-meta"><div><dt>{text.role}</dt><dd>{featured.role[locale]}</dd></div><div><dt>{text.jurisdiction}</dt><dd>{featured.jurisdiction}</dd></div><div><dt>CONTENT</dt><dd>v{featured.version}</dd></div></dl><div className="featured-actions"><button className="primary-cta" onClick={() => startScenario(featured)}>{text.launch}<Icon name="arrow"/></button><button className="secondary-cta" onClick={() => requestFeedback({ caseId: featured.caseId, version: featured.version, title: featured.title[locale], source: "playable", fingerprint: featured.fingerprint })}>{text.feedback}</button></div></div>
    </section>
    <section className="catalogue-filters page-width"><label><span>{locale === "en" ? "Search cases and tags" : "Поиск по кейсам и тегам"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "e.g. evidence, privacy, AI Act" : "например: evidence, privacy, AI Act"}/></label><label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value)}><option value="all">{locale === "en" ? "All practice areas" : "Все области"}</option>{practices.map((practice) => <option key={practice}>{practice}</option>)}</select></label><b>{filteredCases.length.toString().padStart(2, "0")} / {scenarios.length.toString().padStart(2, "0")}</b></section>
    <section className="case-strip page-width"><div className="section-heading"><div><span>01 — 05</span><h2>{locale === "en" ? "Choose the matter" : "Выберите дело"}</h2></div><p>{locale === "en" ? "Filter the catalogue by practice area, jurisdiction and tags." : "Фильтруйте каталог по области практики, юрисдикции и тегам."}</p></div><div className="case-list">{filteredCases.map((scenario, index) => {
      const meta = caseTaxonomy[scenario.id];
      return <button key={scenario.id} className={`case-row ${scenario.id === featured.id ? "selected" : ""}`} onClick={() => { setFeaturedId(scenario.id); startScenario(scenario); }} aria-label={`${text.launch}: ${scenario.title[locale]}`}><span className="row-number">{String(index + 1).padStart(2, "0")}</span><span className="row-main"><b>{scenario.title[locale]}</b><small>{scenario.subtitle[locale]}</small><em>{meta.tags.map((tag) => <i key={tag}>{tag}</i>)}</em></span><span className="row-meta"><i>{scenario.jurisdiction}</i><i>{meta.practice}</i><small>{meta.difficulty} · {meta.duration} min</small></span><span className={`urgency ${scenario.urgency}`}>{scenario.urgency}</span><Icon name="arrow"/></button>;
    })}</div></section>
    <section className="tax-capability page-width"><div><span>TAX & OFFSHORE ENGINEERING</span><h2>{locale === "en" ? "Model lawful cross-border tax planning as a living system." : "Моделируйте законное трансграничное налоговое планирование как живую систему."}</h2><p>{locale === "en" ? "Map entities, jurisdictions, cash flows, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 and Pillar Two — with explicit anti-abuse and documentation gates." : "Связывайте компании, юрисдикции, денежные потоки, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 и Pillar Two — с обязательными anti-abuse и документальными проверками."}</p></div><button className="primary-cta" onClick={openTaxTemplate}>{locale === "en" ? "Open tax-planning template" : "Открыть налоговый шаблон"}<Icon name="arrow"/></button></section>
    <section className="authority-note page-width"><span className="authority-seal">A</span><div><b>{text.adaptation}</b><p>{text.canonNote}</p></div><code>CATALOGUE / BUNDLE V5</code></section>
  </main>;
}
function PlayView({ locale, text, scenario, stage, stageIndex, metrics, decisionLog, caseMinute, actionUseCounts, completedDeadlineIds, missedDeadlineIds, dossierRef, setDossierRef, setSelectedOption, outcome, exportSession, replayCase, returnLibrary }: { locale: Locale; text: UiText; scenario: Scenario; stage: Scenario["stages"][number]; stageIndex: number; metrics: Record<MetricKey, number>; decisionLog: DecisionRecord[]; caseMinute: number; actionUseCounts: Record<string, number>; completedDeadlineIds: string[]; missedDeadlineIds: string[]; dossierRef: string | null; setDossierRef: (ref: string) => void; setSelectedOption: (option: DecisionOption) => void; outcome: OutcomeClass | null; exportSession: () => void; replayCase: () => void; returnLibrary: () => void }) {
  const activeMaterial = scenario.materials.find((material) => material.ref === dossierRef) ?? scenario.materials[0];
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedInboxIndex, setSelectedInboxIndex] = useState(0);
  const decisionRef = useRef<HTMLElement>(null);
  const clock = formatCaseClock(caseMinute);
  const activeActionIds = new Set(stage.options.map((option) => option.id));
  const visitedStageIds = new Set(decisionLog.map((entry) => entry.stageId));
  const workflowInbox = scenario.workflowInbox.filter((item) => item.initiallyVisible || item.resolutionActions.some((action) => activeActionIds.has(action)));
  const unresolvedWorkflowInbox = workflowInbox.filter((item) => !item.resolutionActions.some((action) => (actionUseCounts[action] ?? 0) > 0));
  const inboxEntries: InboxEntry[] = [
    {
      id: `${stage.id}-situation`,
      status: locale === "en" ? "ACTION REQUIRED" : "ТРЕБУЕТСЯ ДЕЙСТВИЕ",
      title: stage.headline[locale],
      source: stage.source[locale],
      body: stage.brief[locale],
    },
    ...unresolvedWorkflowInbox.map((item) => ({
      id: item.id,
      status: item.actionRequired ? (locale === "en" ? "ACTION REQUIRED" : "ТРЕБУЕТСЯ ДЕЙСТВИЕ") : (locale === "en" ? "CASE UPDATE" : "ОБНОВЛЕНИЕ ДЕЛА"),
      title: item.subject[locale],
      source: locale === "en" ? "Canonical case inbox" : "Канонический Inbox дела",
      body: item.body[locale],
    })),
  ];
  const deadlineRows = scenario.deadlines.map((deadline) => {
    const completed = completedDeadlineIds.includes(deadline.id);
    const missed = missedDeadlineIds.includes(deadline.id);
    const remaining = deadline.dueAtMinute - caseMinute;
    return { deadline, completed, missed, remaining };
  }).sort((left, right) => left.deadline.dueAtMinute - right.deadline.dueAtMinute);
  const nextDeadline = deadlineRows.find((row) => !row.completed && !row.missed);
  const availableCount = stage.options.filter((option) => {
    const uses = actionUseCounts[option.id] ?? 0;
    return !(option.repeatability === "once" && uses > 0) && !(option.repeatability === "limited" && uses >= (option.maxUses ?? 1));
  }).length;

  function remainingLabel(minutes: number) {
    const absolute = Math.abs(minutes);
    const days = Math.floor(absolute / 1440);
    const hours = Math.floor((absolute % 1440) / 60);
    const mins = absolute % 60;
    const value = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${mins}m`].filter(Boolean).join(" ");
    return minutes < 0 ? (locale === "en" ? `${value} overdue` : `просрочено на ${value}`) : (locale === "en" ? `${value} remaining` : `осталось ${value}`);
  }

  function revealDecisions() {
    decisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      decisionRef.current?.querySelector<HTMLButtonElement>(".decision-options button")?.focus();
    }, 380);
  }
  if (outcome) return <DebriefView locale={locale} text={text} scenario={scenario} metrics={metrics} decisionLog={decisionLog} outcome={outcome} exportSession={exportSession} replayCase={replayCase} returnLibrary={returnLibrary}/>;
  return <main className="operations-view"><aside className="case-rail"><button className="rail-back" onClick={returnLibrary}><span>←</span>{text.library}</button><div className="rail-case"><small>ACTIVE MATTER</small><b>{scenario.title[locale]}</b><span>{scenario.jurisdiction}</span></div><div className="workflow-depth"><span>{scenario.stages.length} STAGES</span><span>{scenario.stages.reduce((sum, item) => sum + item.options.length, 0)} ACTIONS</span></div><ol className="stage-list">{scenario.stages.map((item, index) => <li key={item.id} className={index === stageIndex ? "active" : visitedStageIds.has(item.id) ? "done" : ""}><span>{visitedStageIds.has(item.id) && index !== stageIndex ? "✓" : index + 1}</span><div><b>{item.phase[locale]}</b><small>{item.terminal ? "TERMINAL" : item.id.replaceAll("_", " ")}</small></div></li>)}</ol><div className="rail-version">CONTENT v{scenario.version}<br/><code>{scenario.fingerprint}</code></div></aside>
    <section className="command-center">
      <div className="command-header">
        <div>
          <div className="eyebrow"><span className="live-dot"/>LIVE OPERATION · {text.day.toUpperCase()} {clock.day}</div>
          <h1>{scenario.title[locale]}</h1>
          <p>{stage.phase[locale]} <span>·</span> {clock.time}</p>
        </div>
        <div className="command-clock"><span>{clock.time}</span><small>{text.day} {clock.day} · FOREGROUND</small></div>
      </div>
      <MetricPanel locale={locale} metrics={metrics} compact/>
      <article className="engagement-brief">
        <div><span>{locale === "en" ? "INITIAL SITUATION / MANDATE" : "НАЧАЛЬНАЯ СИТУАЦИЯ / ПОРУЧЕНИЕ"}</span><code>{scenario.caseId}</code></div>
        <p>{scenario.opening[locale]}</p>
      </article>
      <div className="ops-ledger">
        <button
          className="ledger-control ledger-inbox"
          onClick={() => { setSelectedInboxIndex(0); setInboxOpen(true); }}
          aria-haspopup="dialog"
          aria-label={`${text.attention}: ${inboxEntries.length}`}
        >
          <span>{text.attention}</span>
          <b>{inboxEntries.length}</b>
          <small>ACTION REQUIRED</small>
          <Icon name="arrow"/>
        </button>
        <button
          className="ledger-control ledger-decisions"
          onClick={revealDecisions}
          aria-label={`${text.decisions}: ${availableCount}`}
        >
          <span>{text.decisions}</span>
          <b>{availableCount}</b>
          <small>RESPONSE WINDOW OPEN</small>
          <Icon name="arrow"/>
        </button>
      </div>
      <section className="deadline-ledger" aria-label={locale === "en" ? "Case deadlines" : "Дедлайны дела"}>
        <div className="deadline-heading"><div><span>{locale === "en" ? "DEADLINE CONTROL" : "КОНТРОЛЬ СРОКОВ"}</span><h2>{locale === "en" ? "Time changes the case" : "Время изменяет дело"}</h2></div><code>{scenario.deadlines.length.toString().padStart(2,"0")} DEADLINES</code></div>
        {deadlineRows.length === 0 ? <p className="no-deadlines">{locale === "en" ? "No authored deadline is active in this introductory matter." : "В этом вводном деле нет настроенных дедлайнов."}</p> : <div className="deadline-list">{deadlineRows.map(({deadline,completed,missed,remaining}) => <div key={deadline.id} className={`deadline-row ${completed ? "complete" : missed ? "missed" : remaining <= 180 ? "urgent" : ""}`}><span className="deadline-state">{completed ? "✓" : missed ? "!" : "◷"}</span><div><b>{deadline.title[locale]}</b><small>{completed ? (locale === "en" ? "Completed" : "Выполнено") : missed ? remainingLabel(remaining) : remainingLabel(remaining)}</small></div><time>D{Math.floor(deadline.dueAtMinute/1440)+1} · {formatCaseClock(deadline.dueAtMinute).time}</time></div>)}</div>}
      </section>
      <article className="situation-panel">
        <div className="situation-top"><span>{text.situation}</span><code>{stage.source[locale]}</code></div>
        <h2>{stage.headline[locale]}</h2>
        <p>{stage.brief[locale]}</p>
        <div className={`pressure-band ${nextDeadline && nextDeadline.remaining <= 180 ? "active" : ""}`}>
          <Icon name={nextDeadline && nextDeadline.remaining <= 180 ? "alert" : "check"}/>
          <div><small>{text.pressure}</small><b>{nextDeadline ? `${nextDeadline.deadline.title[locale]} · ${remainingLabel(nextDeadline.remaining)}` : text.noPressure}</b></div>
        </div>
      </article>
      <section className="decision-entry" ref={decisionRef} tabIndex={-1}>
        <div>
          <span>STAGE {String(stageIndex+1).padStart(2,"0")} / {String(scenario.stages.length).padStart(2,"0")}</span>
          <h2>{locale === "en" ? "Analysis, engagement and available work" : "Анализ, принятие поручения и доступная работа"}</h2>
          <p>{locale === "en" ? "Every authored action for the current canonical stage is shown. Time and cost are applied only after confirmation." : "Показаны все действия текущей канонической стадии. Время и стоимость учитываются только после подтверждения."}</p>
        </div>
        <div className="decision-options">
          {stage.options.map((option) => { const uses=actionUseCounts[option.id]??0; const exhausted=(option.repeatability==="once"&&uses>0)||(option.repeatability==="limited"&&uses>=(option.maxUses??1)); return <button key={option.id} disabled={exhausted} onClick={() => setSelectedOption(option)}><span>{option.label[locale]}</span><small>{exhausted ? (locale === "en" ? "COMPLETED" : "ВЫПОЛНЕНО") : `€ ${option.cost.toLocaleString()} · ${option.minutes} MIN${option.repeatability==="limited" ? ` · ${uses}/${option.maxUses}` : ""}`}</small><Icon name={exhausted ? "check" : "arrow"}/></button>;})}
        </div>
      </section>
      {inboxOpen && (
        <InboxPanel
          locale={locale}
          entries={inboxEntries}
          selectedIndex={selectedInboxIndex}
          selectEntry={setSelectedInboxIndex}
          close={() => setInboxOpen(false)}
          openMaterial={(ref) => {
            setDossierRef(ref);
            setInboxOpen(false);
            window.setTimeout(() => document.querySelector(".dossier-pane")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          }}
        />
      )}
    </section>
    <aside className="dossier-pane"><div className="pane-heading"><span>{text.dossier}</span><b>{scenario.materials.length}</b></div><p className="pane-intro">{text.visibleMaterial} · {text.provenance}</p><div className="material-tabs">{scenario.materials.map((material) => <button key={material.ref} className={material.ref === activeMaterial.ref ? "active" : ""} onClick={() => setDossierRef(material.ref)}><code>{material.ref}</code><span>{material.title[locale]}</span></button>)}</div><article className="material-sheet"><div className="sheet-punch"/><div className="sheet-reg">{activeMaterial.ref}</div><span className="document-type">{activeMaterial.type[locale]}</span><h3>{activeMaterial.title[locale]}</h3><dl><div><dt>SOURCE</dt><dd>{activeMaterial.source[locale]}</dd></div><div><dt>DATE / TIME</dt><dd>{activeMaterial.date}</dd></div><div><dt>CASE</dt><dd>{scenario.caseId}</dd></div></dl><p>{locale === "en" ? "Visible case material. Source identity remains attached; opening this record does not recommend a decision." : "Видимый материал дела. Идентичность источника сохранена; открытие записи не рекомендует решение."}</p><div className="sheet-status"><Icon name="check"/> PROVENANCE ATTACHED</div></article>{decisionLog.length > 0 && <section className="mini-log"><h3>{text.actionLog}</h3>{decisionLog.map((entry,index) => <div key={`${entry.option.id}-${index}`}><span>{String(index+1).padStart(2,"0")}</span><p>{entry.option.label[locale]}</p></div>)}</section>}</aside></main>;
}

function DebriefView({ locale, text, scenario, metrics, decisionLog, outcome, exportSession, replayCase, returnLibrary }: { locale: Locale; text: UiText; scenario: Scenario; metrics: Record<MetricKey, number>; decisionLog: DecisionRecord[]; outcome: OutcomeClass; exportSession: () => void; replayCase: () => void; returnLibrary: () => void }) {
  const presentation = {
    strong: {
      classLabel: locale === "en" ? "FAVORABLE OUTCOME" : "БЛАГОПРИЯТНЫЙ ИСХОД",
      posture: locale === "en" ? "Position protected" : "Позиция защищена",
      explanation: locale === "en"
        ? "Evidence integrity, institutional trust and the legal position outweighed the remaining exposure."
        : "Целостность доказательств, институциональное доверие и правовая позиция перевесили оставшуюся экспозицию.",
      icon: "check",
    },
    mixed: {
      classLabel: locale === "en" ? "MIXED OUTCOME" : "СМЕШАННЫЙ ИСХОД",
      posture: locale === "en" ? "Position remains contested" : "Позиция остаётся спорной",
      explanation: locale === "en"
        ? "Material strengths were offset by unresolved exposure. The matter remains defensible, but not fully controlled."
        : "Сильные стороны были уравновешены нерешённой экспозицией. Дело остаётся защищаемым, но не полностью контролируемым.",
      icon: "file",
    },
    weak: {
      classLabel: locale === "en" ? "ADVERSE OUTCOME" : "НЕБЛАГОПРИЯТНЫЙ ИСХОД",
      posture: locale === "en" ? "Position compromised" : "Позиция ослаблена",
      explanation: locale === "en"
        ? "Accumulated exposure and institutional weaknesses outweighed the position preserved by individual decisions."
        : "Накопленная экспозиция и институциональные слабости перевесили позицию, сохранённую отдельными решениями.",
      icon: "alert",
    },
  }[outcome];

  return (
    <main className="debrief-view page-width">
      <div className="debrief-mark"><span>CASE CLOSED</span><b>{String(scenario.order / 10).padStart(2, "0")}</b></div>
      <div className="eyebrow"><span className="live-dot"/>{text.complete}</div>
      <h1>{scenario.title[locale]}</h1>

      <section className={`outcome-verdict outcome-${outcome}`}>
        <div className="verdict-classification">
          <span className="verdict-icon"><Icon name={presentation.icon} size={27}/></span>
          <small>{presentation.classLabel}</small>
          <b>{presentation.posture}</b>
        </div>
        <div className="verdict-narrative">
          <span>{locale === "en" ? "FINAL CASE OUTCOME" : "ИТОГОВЫЙ РЕЗУЛЬТАТ ДЕЛА"}</span>
          <h2>{scenario.outcomes[outcome][locale]}</h2>
          <p>{presentation.explanation}</p>
        </div>
      </section>

      <section className="final-posture">
        <div className="final-posture-heading">
          <span>{locale === "en" ? "Final institutional posture" : "Итоговая институциональная позиция"}</span>
          <small>{locale === "en" ? "Values after all three decisions" : "Значения после всех трёх решений"}</small>
        </div>
        <MetricPanel locale={locale} metrics={metrics} compact/>
      </section>

      <div className="debrief-grid">
        <section>
          <h2>{text.actionLog}</h2>
          {decisionLog.map((entry, index) => (
            <article key={`${entry.option.id}-${index}`} className="log-entry">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{entry.stage}</small>
                <b>{entry.option.label[locale]}</b>
                <p>{entry.option.result[locale]}</p>
                <div className="log-effects">
                  {(Object.entries(entry.option.effects) as Array<[MetricKey, number]>).map(([key, value]) => (
                    <i key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</i>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
        <aside className="outcome-reasons">
          <h2>{locale === "en" ? "Why this outcome" : "Почему получен этот исход"}</h2>
          <p>{locale === "en" ? "Each confirmed response changed the final posture. These were the decisive consequences:" : "Каждый подтверждённый ответ изменял итоговую позицию. Определяющими стали следующие последствия:"}</p>
          <ol>
            {decisionLog.map((entry, index) => <li key={entry.option.id}><span>{String(index + 1).padStart(2, "0")}</span><p>{entry.option.result[locale]}</p></li>)}
          </ol>
          <div className="canonical-note"><Icon name="file"/><p>{text.canonNote}</p></div>
        </aside>
      </div>

      <div className="debrief-actions">
        <button className="secondary-cta" onClick={returnLibrary}>{text.returnLibrary}</button>
        <button className="secondary-cta" onClick={exportSession}><Icon name="download"/>{text.exportPlay}</button>
        <button className="primary-cta" onClick={replayCase}><Icon name="reset"/>{locale === "en" ? "Replay this case" : "Пройти кейс заново"}</button>
      </div>
    </main>
  );
}

function InboxPanel({ locale, entries, selectedIndex, selectEntry, close, openMaterial }: { locale: Locale; entries: InboxEntry[]; selectedIndex: number; selectEntry: (index: number) => void; close: () => void; openMaterial: (ref: string) => void }) {
  const entry = entries[selectedIndex] ?? entries[0];
  return (
    <div className="inbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="inbox-panel" role="dialog" aria-modal="true" aria-labelledby="inbox-panel-title">
        <header>
          <div>
            <span>OPERATIONAL INBOX</span>
            <h2 id="inbox-panel-title">{locale === "en" ? "Attention required" : "Требуют внимания"}</h2>
          </div>
          <b>{entries.length.toString().padStart(2, "0")}</b>
          <button onClick={close} aria-label={locale === "en" ? "Close inbox" : "Закрыть входящие"}><Icon name="close"/></button>
        </header>
        <div className="inbox-panel-body">
          <nav aria-label={locale === "en" ? "Attention messages" : "Сообщения, требующие внимания"}>
            {entries.map((item, index) => (
              <button key={item.id} className={index === selectedIndex ? "active" : ""} onClick={() => selectEntry(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{item.status}</small><b>{item.title}</b><code>{item.source}</code></div>
                <Icon name="arrow"/>
              </button>
            ))}
          </nav>
          <article className="inbox-message">
            <div className="message-register"><span>{entry.status}</span><code>{entry.id}</code></div>
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
            <dl>
              <div><dt>SOURCE / TIME</dt><dd>{entry.source}</dd></div>
              <div><dt>STATUS</dt><dd>{locale === "en" ? "Unread · visible record" : "Не прочитано · видимая запись"}</dd></div>
            </dl>
            <div className="message-actions">
              <button className="secondary-cta" onClick={close}>{locale === "en" ? "Return to operation" : "Вернуться к операции"}</button>
              {entry.materialRef && <button className="primary-cta" onClick={() => openMaterial(entry.materialRef!)}>{locale === "en" ? "Open linked material" : "Открыть связанный материал"}<Icon name="arrow"/></button>}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function MetricPanel({ locale, metrics, compact = false }: { locale: Locale; metrics: Record<MetricKey, number>; compact?: boolean }) {
  return <div className={`metric-panel ${compact ? "compact" : ""}`}>{(Object.keys(metrics) as MetricKey[]).map((key) => <div key={key} className={`metric metric-${key}`}><div><span>{metricLabels[locale][key]}</span><b>{metrics[key]}</b></div><i><em style={{ width: `${metrics[key]}%` }}/></i></div>)}</div>;
}

function DecisionModal({ locale, text, scenario, stageHeadline, option, isResult, close, dispatch, advance, finalStage }: { locale: Locale; text: UiText; scenario: Scenario; stageHeadline: string; option: DecisionOption; isResult: boolean; close: () => void; dispatch: () => void; advance: () => void; finalStage: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isResult) close(); }}><section className={`decision-modal ${isResult ? "result" : ""}`} role="dialog" aria-modal="true" aria-labelledby="decision-title"><button className="modal-close" onClick={close} aria-label={text.cancel}><Icon name="close"/></button><div className="modal-register">{isResult ? "DISPATCH RECORD" : "RESPONSE REVIEW"}<span>{scenario.caseId}</span></div><div className="modal-icon"><Icon name={isResult ? "check" : "file"} size={30}/></div><span className="modal-kicker">{isResult ? text.consequence : text.review}</span><h2 id="decision-title">{option.label[locale]}</h2><p className="modal-context">{isResult ? option.result[locale] : option.detail[locale]}</p>{!isResult && <><div className="modal-source"><small>CURRENT SITUATION</small><p>{stageHeadline}</p></div><dl className="decision-cost"><div><dt>{text.cost}</dt><dd>EUR {option.cost.toLocaleString()}</dd></div><div><dt>{text.duration}</dt><dd>{option.minutes} min</dd></div></dl><div className="effect-preview">{(Object.entries(option.effects) as Array<[MetricKey, number]>).map(([key,value]) => <span key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</span>)}</div></>}<div className="modal-actions">{!isResult && <button className="secondary-cta" onClick={close}>{text.cancel}</button>}<button className="primary-cta" onClick={isResult ? advance : dispatch}>{isResult ? (finalStage ? text.debrief : text.continueCase) : text.confirm}<Icon name="arrow"/></button></div></section></div>;
}

function StudioView({ locale, text, prompt, setPrompt, draft, setDraft, selectedNode, selectedNodeId, checks, generateDraft, saveDraft, savedFlash, exportDraft, importRef, importDraft, createChildVersion, updateNode, addNode, deleteNode, moveNode, resetDraft, loadTaxTemplate, requestFeedback }: { locale: Locale; text: UiText; prompt: string; setPrompt: (value: string) => void; draft: StudioDraft; setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>; selectedNode: StudioNode | null; selectedNodeId: string | null; checks: Array<{ level: "ok" | "warn"; text: string }>; generateDraft: () => void; saveDraft: () => void; savedFlash: boolean; exportDraft: () => void; importRef: React.RefObject<HTMLInputElement | null>; importDraft: (file: File) => void; createChildVersion: () => void; updateNode: (change: Partial<StudioNode>) => void; addNode: (type: StudioNodeType) => void; deleteNode: () => void; moveNode: (event: React.PointerEvent<HTMLButtonElement>, node: StudioNode) => void; resetDraft: () => void; loadTaxTemplate: () => void; requestFeedback: () => void }) {
  const [previewLive, setPreviewLive] = useState(false);
  const [previewOutcome, setPreviewOutcome] = useState<StudioNode | null>(null);
  const previewDecision = draft.nodes.find((node) => node.type === "decision");
  const previewOutcomes = draft.nodes.filter((node) => node.type === "outcome").slice(0, 2);

  return <main className="studio-view"><section className="studio-hero page-width"><div><div className="eyebrow"><span className="live-dot"/>AUTHORING LAB · VISUAL + PROMPT</div><h1>{text.author}</h1><p>{text.authorLead}</p></div><div className="studio-actions"><button className="secondary-cta" onClick={resetDraft}><Icon name="reset"/>{text.newDraft}</button><button className="secondary-cta" onClick={loadTaxTemplate}><Icon name="spark"/>{locale === "en" ? "Tax template" : "Налоговый шаблон"}</button><button className="secondary-cta" onClick={requestFeedback}><Icon name="file"/>{text.feedback}</button><button className="secondary-cta" onClick={() => importRef.current?.click()}><Icon name="upload"/>{text.importCustom}</button><button className="secondary-cta" onClick={exportDraft}><Icon name="download"/>{text.exportCustom}</button><button className="primary-cta" onClick={saveDraft}><Icon name="save"/>{text.save}</button><input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file) importDraft(file); event.target.value=""; }}/></div>{savedFlash && <div className="save-toast"><Icon name="check"/>{text.saved}</div>}</section>
    <section className="prompt-deck page-width"><div className="prompt-label"><span>{text.prompt}</span><code>GENERATOR / STRUCTURE V1</code></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label={text.prompt}/><button className="generate-button" onClick={generateDraft}><Icon name="spark" size={24}/><span>{text.generate}<small>{locale === "en" ? "Extract trigger, actors, evidence, deadline, decision and outcome branches" : "Выделить триггер, акторов, доказательства, срок, решение и ветви исхода"}</small></span><Icon name="arrow"/></button></section>
    <section className="studio-meta page-width"><label><span>{text.title}</span><input value={draft.title} onChange={(event) => setDraft((current) => ({...current,title:event.target.value}))}/></label><label><span>{text.jurisdiction}</span><input value={draft.jurisdiction} onChange={(event) => setDraft((current) => ({...current,jurisdiction:event.target.value}))}/></label><label><span>{text.role}</span><input value={draft.role} onChange={(event) => setDraft((current) => ({...current,role:event.target.value}))}/></label></section>
    <section className="studio-classification page-width"><label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={draft.classification?.practiceArea ?? "General legal"} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), practiceArea: event.target.value } }))}><option>General legal</option><option>International tax planning</option><option>Corporate tax</option><option>Transfer pricing</option><option>Commercial disputes</option><option>AI regulation</option><option>Privacy & cybersecurity</option></select></label><label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={draft.classification?.difficulty ?? "Intermediate"} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", tags: [], taxTopics: [], complianceOnly: true }), difficulty: event.target.value } }))}><option>Foundation</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></label><label className="wide-field"><span>{locale === "en" ? "Tags · comma separated" : "Теги · через запятую"}</span><input value={(draft.classification?.tags ?? []).join(", ")} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", taxTopics: [], complianceOnly: true }), tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}/></label><label className="wide-field"><span>{locale === "en" ? "Tax topics · treaty, CFC, PE, WHT, DAC6…" : "Налоговые темы · treaty, CFC, PE, WHT, DAC6…"}</span><input value={(draft.classification?.taxTopics ?? []).join(", ")} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], complianceOnly: true }), taxTopics: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}/></label><div className="compliance-gate"><Icon name="check"/><div><b>{locale === "en" ? "Lawful planning & compliance gate" : "Контроль законности и compliance"}</b><p>{locale === "en" ? "Tax scenarios must test commercial purpose, substance, reporting and anti-abuse rules. Concealment and evasion patterns are rejected." : "Налоговые сценарии обязаны проверять деловую цель, substance, отчётность и anti-abuse. Схемы сокрытия и уклонения не допускаются."}</p></div></div></section>
    <section className="studio-version page-width">
      <div className="version-heading"><span>{text.customCase}</span><button className="secondary-cta" onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></div>
      <label><span>{text.caseId}</span><input value={draft.caseId} onChange={(event) => setDraft((current) => ({...current,caseId:slugifyCaseId(event.target.value)}))}/></label>
      <label><span>{text.version}</span><input value={draft.version} onChange={(event) => setDraft((current) => ({...current,version:event.target.value}))} aria-invalid={!/^\d+\.\d+\.\d+$/.test(draft.version)}/></label>
      <div className="version-value"><span>{text.fingerprint}</span><code>{caseFingerprint(draft)}</code></div>
      <div className="parent-trace"><span>{text.parentCase}</span>{draft.parent ? <><b>{draft.parent.caseId}</b><code>v{draft.parent.version} · {draft.parent.fingerprint}</code></> : <em>{locale === "en" ? "Root case · no parent" : "Корневой кейс · родителя нет"}</em>}</div>
    </section>
    <section className="studio-workspace"><aside className="node-palette"><div className="pane-heading"><span>{text.addNode}</span><b>07</b></div>{(Object.keys(typeColors) as StudioNodeType[]).map((type) => <button key={type} onClick={() => addNode(type)}><i style={{background:typeColors[type]}}/><span>{text.nodeTypes[type]}</span><Icon name="plus"/></button>)}<p>{locale === "en" ? "Add a node, then connect meaning through the generated flow. Drag nodes to reshape the map." : "Добавьте узел, затем свяжите смысл через сгенерированный поток. Перетаскивайте узлы по карте."}</p></aside>
      <section className="graph-deck"><div className="graph-heading"><div><span>{text.graph}</span><b>{draft.title}</b></div><div><code>{draft.nodes.length} NODES</code><code>{draft.links.length} LINKS</code></div></div><div className="graph-canvas"><svg className="graph-links" aria-hidden="true">{draft.links.map((link,index) => { const from=draft.nodes.find((node)=>node.id===link.from); const to=draft.nodes.find((node)=>node.id===link.to); if(!from||!to)return null; return <g key={`${link.from}-${link.to}-${index}`}><path d={`M ${from.x+165} ${from.y+38} C ${from.x+205} ${from.y+38}, ${to.x-38} ${to.y+38}, ${to.x} ${to.y+38}`}/><circle cx={to.x} cy={to.y+38} r="3"/></g>; })}</svg>{draft.nodes.map((node) => <button key={node.id} className={`graph-node type-${node.type} ${node.id===selectedNodeId?"selected":""}`} style={{left:node.x,top:node.y,"--node-color":typeColors[node.type]} as React.CSSProperties} onPointerDown={(event)=>moveNode(event,node)} onPointerMove={(event)=>moveNode(event,node)} onPointerUp={(event)=>moveNode(event,node)} onPointerCancel={(event)=>moveNode(event,node)}><span><i/>{text.nodeTypes[node.type]}<code>{node.id.split("-").at(-1)}</code></span><b>{node.title}</b></button>)}</div><div className="graph-legend">{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><span key={type}><i style={{background:typeColors[type]}}/>{text.nodeTypes[type]}</span>)}</div></section>
      <aside className="node-inspector"><div className="pane-heading"><span>{text.inspector}</span><b>{selectedNode?"01":"00"}</b></div>{selectedNode?<div className="inspector-form"><div className="selected-type"><i style={{background:typeColors[selectedNode.type]}}/><span>{text.nodeTypes[selectedNode.type]}</span><code>{selectedNode.id}</code></div><label><span>{text.nodeType}</span><select value={selectedNode.type} onChange={(event)=>updateNode({type:event.target.value as StudioNodeType})}>{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><option key={type} value={type}>{text.nodeTypes[type]}</option>)}</select></label><label><span>{text.title}</span><input value={selectedNode.title} onChange={(event)=>updateNode({title:event.target.value})}/></label><label><span>{text.detail}</span><textarea value={selectedNode.detail} onChange={(event)=>updateNode({detail:event.target.value})}/></label><label><span>{locale === "en" ? "Connect selected node to" : "Связать выбранный узел с"}</span><select value="" onChange={(event) => { const target=event.target.value; if(!target)return; setDraft((current)=>current.links.some((link)=>link.from===selectedNode.id&&link.to===target)?current:{...current,links:[...current.links,{from:selectedNode.id,to:target}]}); }}><option value="">{locale === "en" ? "Choose destination…" : "Выберите узел…"}</option>{draft.nodes.filter((node)=>node.id!==selectedNode.id).map((node)=><option key={node.id} value={node.id}>{text.nodeTypes[node.type]} · {node.title}</option>)}</select></label><button className="danger-button" onClick={deleteNode}><Icon name="trash"/>{text.deleteNode}</button></div>:<p className="empty-inspector">{text.noSelection}</p>}</aside></section>
    <section className="studio-bottom page-width"><div className="checks-panel"><div className="panel-title"><span>{text.checks}</span><b>{checks.filter((check)=>check.level==="warn").length.toString().padStart(2,"0")}</b></div>{checks.map((check,index)=><div key={index} className={`check-row ${check.level}`}><Icon name={check.level==="ok"?"check":"alert"}/><span>{check.text}</span></div>)}<p>{text.localNote}</p></div><div className="preview-panel"><div className="panel-title"><span>{text.preview}</span><b>{previewLive ? "RUNNING" : "LIVE"}</b></div><div className="preview-card"><div className="preview-index">DRAFT / {draft.nodes.length}</div><h2>{draft.title||"Untitled matter"}</h2>{previewLive ? <div className="draft-playback">{previewOutcome ? <><span>{locale === "en" ? "Prototype consequence" : "Последствие прототипа"}</span><h3>{previewOutcome.title}</h3><p>{previewOutcome.detail}</p><button className="secondary-cta" onClick={()=>setPreviewOutcome(null)}>{locale === "en" ? "Try another path" : "Проверить другой путь"}</button></> : <><span>{locale === "en" ? "Decision review" : "Проверка решения"}</span><h3>{previewDecision?.title}</h3><p>{previewDecision?.detail}</p><div>{previewOutcomes.map((item)=><button key={item.id} onClick={()=>setPreviewOutcome(item)}>{item.title}<Icon name="arrow"/></button>)}</div></>}</div> : <><p>{draft.premise}</p><dl><div><dt>{text.jurisdiction}</dt><dd>{draft.jurisdiction}</dd></div><div><dt>{text.role}</dt><dd>{draft.role}</dd></div></dl><button className="primary-cta" disabled={checks.some((check)=>check.level==="warn")} onClick={()=>setPreviewLive(true)}><Icon name="play"/>{locale === "en" ? "Compile playable prototype" : "Собрать игровой прототип"}</button></>}</div></div></section>
  </main>;
}

type CommunityProfile = {
  displayName: string; professionalRole: string; organisation: string; jurisdiction: string;
  practiceAreas: string[]; experienceLevel: string; locale: Locale;
  productUpdates: boolean; caseUpdates: boolean; researchInvites: boolean; verifiedPractitioner: boolean;
};
type CommunityUpdate = { id: number; title: string; body: string; kind: string; caseId: string | null; publishedAt: string | null; read: boolean };

function CommunityView({ locale, cases }: { locale: Locale; cases: Scenario[] }) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [updates, setUpdates] = useState<CommunityUpdate[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "anonymous" | "ready" | "saving">("loading");
  useEffect(() => {
    Promise.all([fetch("/api/me").then((response) => response.ok ? response.json() : null), fetch("/api/updates").then((response) => response.ok ? response.json() : null)])
      .then(([me, feed]) => {
        if (!me?.profile) { setStatus("anonymous"); return; }
        setProfile(me.profile); setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? []); setStatus("ready");
      }).catch(() => setStatus("anonymous"));
  }, []);
  async function saveProfile() {
    if (!profile) return; setStatus("saving");
    const response = await fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, locale }) });
    if (response.ok) setProfile((await response.json()).profile);
    setStatus("ready");
  }
  async function toggleSubscription(caseId: string) {
    const subscribed = subscriptions.includes(caseId);
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: subscribed ? "unsubscribe" : "subscribe", caseId }) });
    if (response.ok) setSubscriptions((current) => subscribed ? current.filter((id) => id !== caseId) : [...current, caseId]);
  }
  if (status === "loading") return <main className="community-view page-width"><div className="community-loading">Loading professional workspace…</div></main>;
  if (status === "anonymous") return <main className="community-view page-width"><section className="community-hero"><span>PRACTITIONER COMMUNITY</span><h1>{locale === "en" ? "Register your professional profile" : "Зарегистрируйте профессиональный профиль"}</h1><p>{locale === "en" ? "Sign in to submit attributed case feedback, follow selected cases and receive updates matched to your jurisdiction, practice area and role." : "Войдите, чтобы отправлять авторизованные отзывы, подписываться на кейсы и получать обновления с учётом юрисдикции, практики и роли."}</p><a className="primary-cta" href="/signin-with-chatgpt?return_to=%2F">{locale === "en" ? "Sign in with ChatGPT" : "Войти через ChatGPT"}<Icon name="arrow"/></a></section></main>;
  if (!profile) return null;
  return <main className="community-view page-width">
    <section className="community-hero"><div><span>PRACTITIONER COMMUNITY</span><h1>{locale === "en" ? "Professional profile & update centre" : "Профессиональный профиль и центр обновлений"}</h1><p>{locale === "en" ? "Your profile controls attribution, relevant invitations and addressed case releases." : "Профиль определяет авторство, релевантные приглашения и адресные обновления кейсов."}</p></div>{profile.verifiedPractitioner && <b className="verified-badge"><Icon name="check"/>VERIFIED PRACTITIONER</b>}</section>
    <section className="community-grid"><form className="profile-panel" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}><div className="panel-title"><span>{locale === "en" ? "Registration profile" : "Регистрационный профиль"}</span><b>01</b></div>
      <label><span>{locale === "en" ? "Display name" : "Имя"}</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}/></label>
      <label><span>{locale === "en" ? "Professional role" : "Профессиональная роль"}</span><select value={profile.professionalRole} onChange={(event) => setProfile({ ...profile, professionalRole: event.target.value })}><option value="practitioner">Practising lawyer / tax adviser</option><option value="in_house">In-house counsel</option><option value="academic">Academic / educator</option><option value="student">Student / trainee</option><option value="product">LegalTech professional</option></select></label>
      <label><span>{locale === "en" ? "Organisation" : "Организация"}</span><input value={profile.organisation} onChange={(event) => setProfile({ ...profile, organisation: event.target.value })}/></label>
      <label><span>{locale === "en" ? "Primary jurisdiction" : "Основная юрисдикция"}</span><input value={profile.jurisdiction} onChange={(event) => setProfile({ ...profile, jurisdiction: event.target.value })} placeholder="Belgium / EU"/></label>
      <label><span>{locale === "en" ? "Practice areas · comma separated" : "Области практики · через запятую"}</span><input value={profile.practiceAreas.join(", ")} onChange={(event) => setProfile({ ...profile, practiceAreas: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="International tax, Commercial, AI regulation"/></label>
      <label><span>{locale === "en" ? "Experience" : "Опыт"}</span><select value={profile.experienceLevel} onChange={(event) => setProfile({ ...profile, experienceLevel: event.target.value })}><option value="early">0–3 years</option><option value="mid">4–9 years</option><option value="senior">10+ years</option></select></label>
      <fieldset><legend>{locale === "en" ? "Addressed communications" : "Адресные сообщения"}</legend><label><input type="checkbox" checked={profile.productUpdates} onChange={(event) => setProfile({ ...profile, productUpdates: event.target.checked })}/><span>{locale === "en" ? "Product releases" : "Обновления продукта"}</span></label><label><input type="checkbox" checked={profile.caseUpdates} onChange={(event) => setProfile({ ...profile, caseUpdates: event.target.checked })}/><span>{locale === "en" ? "Followed case updates" : "Обновления отслеживаемых кейсов"}</span></label><label><input type="checkbox" checked={profile.researchInvites} onChange={(event) => setProfile({ ...profile, researchInvites: event.target.checked })}/><span>{locale === "en" ? "Research and pilot invitations" : "Приглашения к исследованиям и пилотам"}</span></label></fieldset>
      <button className="primary-cta" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : locale === "en" ? "Save profile" : "Сохранить профиль"}<Icon name="check"/></button>
    </form>
    <section className="update-panel"><div className="panel-title"><span>{locale === "en" ? "Addressed update inbox" : "Адресный центр обновлений"}</span><b>{updates.filter((item) => !item.read).length.toString().padStart(2, "0")}</b></div>{updates.length ? updates.map((item) => <article key={item.id} className={item.read ? "" : "unread"}><span>{item.kind}</span><h3>{item.title}</h3><p>{item.body}</p><small>{item.publishedAt?.slice(0, 10)}</small></article>) : <div className="empty-updates"><Icon name="check"/><b>{locale === "en" ? "You are up to date" : "У вас всё актуально"}</b><p>{locale === "en" ? "New releases matching your profile will appear here." : "Здесь появятся релизы, соответствующие вашему профилю."}</p></div>}</section>
    </section>
    <section className="subscription-panel"><div className="panel-title"><span>{locale === "en" ? "Follow individual cases" : "Подписки на отдельные кейсы"}</span><b>{subscriptions.length.toString().padStart(2, "0")}</b></div><div>{cases.map((item) => <button key={item.id} className={subscriptions.includes(item.caseId) ? "subscribed" : ""} onClick={() => toggleSubscription(item.caseId)}><span><b>{item.title[locale]}</b><small>{item.jurisdiction} · v{item.version}</small></span><em>{subscriptions.includes(item.caseId) ? (locale === "en" ? "Following" : "Подписка") : (locale === "en" ? "Follow" : "Подписаться")}</em></button>)}</div></section>
  </main>;
}

function HelpView({ locale, openCommunity, openStudio }: { locale: Locale; openCommunity: () => void; openStudio: () => void }) {
  const steps = locale === "en" ? [
    ["Choose a case", "Use search, practice filters, tags, difficulty and duration to select a relevant matter."],
    ["Work the record", "Review the opening situation, inbox, evidence provenance, deadlines and available decisions."],
    ["Inspect consequences", "Every confirmed action advances time and changes the legal, evidential and institutional position."],
    ["Improve the library", "Give case-specific feedback or open Studio to create a versioned custom scenario."],
  ] : [
    ["Выберите кейс", "Используйте поиск, фильтры практики, теги, сложность и длительность."],
    ["Работайте с материалами", "Изучите ситуацию, Inbox, доказательства, сроки и доступные решения."],
    ["Разберите последствия", "Каждое действие продвигает время и меняет правовую и институциональную позицию."],
    ["Улучшайте библиотеку", "Оставьте отзыв или откройте Studio для создания версионного custom-кейса."],
  ];
  return <main className="help-view page-width"><section className="help-hero"><span>QUICK HELP</span><h1>{locale === "en" ? "How GENESIS: JURIS works" : "Как работает GENESIS: JURIS"}</h1><p>{locale === "en" ? "A practical legal-simulation system: read the evolving matter, make consequential decisions, learn from the debrief and help practitioners improve the next version." : "Практическая система юридических симуляций: изучайте развивающееся дело, принимайте значимые решения, анализируйте результат и помогайте улучшать следующую версию."}</p></section><section className="help-steps">{steps.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{body}</p></article>)}</section><section className="help-faq"><h2>{locale === "en" ? "Short answers" : "Короткие ответы"}</h2><details open><summary>{locale === "en" ? "Do I need an account?" : "Нужна ли регистрация?"}</summary><p>{locale === "en" ? "No for public cases. Sign in to submit attributed feedback, maintain a profile, follow cases and receive targeted updates." : "Нет для публичных кейсов. Вход нужен для отзывов, профиля, подписок и адресных обновлений."}</p></details><details><summary>{locale === "en" ? "Can I create tax-planning cases?" : "Можно ли создавать налоговые кейсы?"}</summary><p>{locale === "en" ? "Yes. Studio includes entities, jurisdictions, cash flows and tax-rule nodes plus a compliance-first international tax template." : "Да. Studio поддерживает компании, юрисдикции, денежные потоки, налоговые правила и compliance-first шаблон международного планирования."}</p></details><details><summary>{locale === "en" ? "Is this legal or tax advice?" : "Это юридическая или налоговая консультация?"}</summary><p>{locale === "en" ? "No. Cases are simulations for training and structured professional discussion. Verify current law and facts before real-world use." : "Нет. Это симуляции для обучения и структурированного профессионального обсуждения. Для реальной ситуации проверяйте актуальное право и факты."}</p></details></section><div className="help-actions"><button className="secondary-cta" onClick={openCommunity}>{locale === "en" ? "Register or update profile" : "Регистрация и профиль"}</button><button className="primary-cta" onClick={openStudio}>{locale === "en" ? "Open Case Studio" : "Открыть Case Studio"}<Icon name="arrow"/></button></div></main>;
}

function FeedbackDialog({ locale, target, close, submitted }: { locale: Locale; target: FeedbackTarget; close: () => void; submitted: () => void }) {
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("legal_accuracy");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setError("");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: target.caseId, caseVersion: target.version, source: target.source, studioFingerprint: target.fingerprint, rating, category, comment }) });
    if (response.status === 401) { window.location.href = "/signin-with-chatgpt?return_to=%2F"; return; }
    if (!response.ok) { setError(locale === "en" ? "Please complete the rating and comment." : "Заполните оценку и комментарий."); setSending(false); return; }
    submitted();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="feedback-dialog" onSubmit={submit}><button type="button" className="modal-close" onClick={close}><Icon name="close"/></button><span>CASE-SPECIFIC FEEDBACK · {target.source.toUpperCase()}</span><h2>{locale === "en" ? "Help improve this case" : "Помогите улучшить кейс"}</h2><p><b>{target.title}</b><br/><code>{target.caseId} · v{target.version}</code></p><label><span>{locale === "en" ? "Feedback category" : "Категория отзыва"}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="legal_accuracy">Legal / tax accuracy</option><option value="realism">Professional realism</option><option value="learning_value">Learning value</option><option value="usability">Usability</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><fieldset><legend>{locale === "en" ? "Overall rating" : "Общая оценка"}</legend><div className="rating-row">{[1,2,3,4,5].map((value) => <button type="button" key={value} className={value <= rating ? "active" : ""} onClick={() => setRating(value)} aria-label={`${value} / 5`}>★</button>)}</div></fieldset><label><span>{locale === "en" ? "What should be corrected or improved?" : "Что следует исправить или улучшить?"}</span><textarea required minLength={10} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={locale === "en" ? "Be specific about the fact, rule, decision branch or user experience…" : "Укажите конкретный факт, правило, ветвь решения или проблему интерфейса…"}/></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-cta" onClick={close}>{locale === "en" ? "Cancel" : "Отмена"}</button><button className="primary-cta" disabled={sending || comment.trim().length < 10}>{sending ? "Sending…" : locale === "en" ? "Submit feedback" : "Отправить отзыв"}<Icon name="arrow"/></button></div></form></div>;
}

function validateDraft(draft: StudioDraft, locale: Locale) {
  const count=(type:StudioNodeType)=>draft.nodes.filter((node)=>node.type===type).length;
  const outgoing=new Set(draft.links.map((link)=>link.from)); const incoming=new Set(draft.links.map((link)=>link.to));
  const warnings:Array<{level:"ok"|"warn";text:string}>=[]; const label=(en:string,ru:string)=>locale==="en"?en:ru;
  warnings.push(/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(draft.caseId)?{level:"ok",text:label("Stable custom case ID is defined","Стабильный ID custom-кейса определён")}:{level:"warn",text:label("Use a lowercase snake_case case ID","Используйте ID кейса в формате snake_case")});
  warnings.push(/^\d+\.\d+\.\d+$/.test(draft.version)?{level:"ok",text:label(`Semantic version ${draft.version} is valid`,`Семантическая версия ${draft.version} корректна`)}:{level:"warn",text:label("Use a semantic version such as 1.0.0","Укажите семантическую версию, например 1.0.0")});
  warnings.push(count("actor")>=1?{level:"ok",text:label(`${count("actor")} institutional actor(s) defined`,`Определено акторов: ${count("actor")}`)}:{level:"warn",text:label("Add at least one institutional actor","Добавьте хотя бы одного институционального актора")});
  warnings.push(count("evidence")>=1?{level:"ok",text:label("Evidence provenance node is present","Узел происхождения доказательств присутствует")}:{level:"warn",text:label("Add evidence with source provenance","Добавьте доказательство с источником происхождения")});
  warnings.push(count("decision")>=1?{level:"ok",text:label("A deliberate decision point is defined","Определена осознанная точка решения")}:{level:"warn",text:label("Add at least one decision point","Добавьте хотя бы одну точку решения")});
  warnings.push(count("outcome")>=2?{level:"ok",text:label("Multiple outcome paths preserve uncertainty","Несколько исходов сохраняют неопределённость")}:{level:"warn",text:label("Add at least two non-recommending outcomes","Добавьте хотя бы два исхода без рекомендации")});
  const orphaned=draft.nodes.filter((node)=>node.type!=="trigger"&&!incoming.has(node.id)&&!outgoing.has(node.id));
  warnings.push(orphaned.length===0?{level:"ok",text:label("No orphaned nodes","Изолированных узлов нет")}:{level:"warn",text:label(`${orphaned.length} orphaned node(s) need a relationship`,`Изолированных узлов: ${orphaned.length}`)});
  warnings.push(draft.jurisdiction&&draft.role?{level:"ok",text:label("Jurisdiction and player role are explicit","Юрисдикция и роль игрока определены")}:{level:"warn",text:label("Set jurisdiction and player role","Укажите юрисдикцию и роль игрока")});
  if ((draft.classification?.taxTopics.length ?? 0) > 0 || /tax|налог/i.test(draft.classification?.practiceArea ?? "")) {
    const hasEntity = count("entity") >= 1;
    const hasTaxRule = count("tax_rule") >= 1;
    const hasFlow = count("cash_flow") >= 1;
    warnings.push(hasEntity && hasTaxRule && hasFlow
      ? {level:"ok",text:label("Tax structure maps entities, cash flows and governing rules","Налоговая структура связывает компании, денежные потоки и применимые правила")}
      : {level:"warn",text:label("Tax cases require entity, cash-flow and tax-rule nodes","Налоговые кейсы требуют узлы компании, денежного потока и налогового правила")});
    warnings.push(draft.classification?.complianceOnly
      ? {level:"ok",text:label("Lawful-planning and anti-abuse gate is enabled","Контроль законности и anti-abuse включён")}
      : {level:"warn",text:label("Enable the lawful-planning compliance gate","Включите контроль законности налогового планирования")});
  }
  return warnings;
}
