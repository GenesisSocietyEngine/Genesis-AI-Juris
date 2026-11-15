"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { caseFingerprint, isRecord, isTaxClassification, normalizeStudioDraft, slugifyCaseId } from "./case-integrity";
import { resolveDecisionTiming, resolveLegacyDecisionTiming } from "./game-engine";
import { legacyScenarios } from "./legacy-scenarios";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
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
type FeedbackTarget = { caseId: string; version: string; title: string; source: "playable" | "studio"; fingerprint?: string; contextType?: "case" | "stage" | "decision" | "node"; contextId?: string };

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
    canonNote: "Web beta. Published cases are versioned; expert-review status and legal as-of dates are shown in the catalogue.",
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
    localNote: "Drafts can be saved locally or submitted to the moderated practitioner workspace. Use only synthetic or de-identified material.",
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
    canonNote: "Веб-бета. Опубликованные кейсы версионируются; статус экспертной проверки и дата актуальности права указаны в каталоге.",
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
    localNote: "Черновики можно хранить локально или отправлять в модерируемое рабочее пространство. Используйте только синтетические или обезличенные материалы.",
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
async function readJsonResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return await response.json() as T;
}
function formatCaseClock(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const day = Math.floor(safe / 1440) + 1;
  const minuteOfDay = safe % 1440;
  return { day, time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}` };
}
function bumpPatchVersion(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : "1.0.1";
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
  const [catalogueScenarios, setCatalogueScenarios] = useState<Scenario[]>(scenarios);
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

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  useEffect(() => {
    fetch("/api/catalog").then((response) => readJsonResponse<{ cases?: unknown[] }>(response)).then(async (payload) => {
      if (!Array.isArray(payload?.cases)) return;
      const remoteRecords = await Promise.all(payload.cases.filter(isRecord).filter((item) => item.reviewLevel !== "bundled_beta").map(async (item) => {
        const response = await fetch(`/api/catalog/${encodeURIComponent(String(item.id))}`);
        return readJsonResponse<unknown>(response);
      }));
      const compiled: Scenario[] = [];
      for (const item of remoteRecords) {
        if (!isRecord(item) || !isRecord(item.payload) || item.payload.kind !== "playable-scenario-v1") continue;
        try {
          const scenario = normalizePlayableScenario(item.payload.scenario);
          if (scenario.caseId !== item.id || scenario.version !== item.currentVersion || scenario.fingerprint !== item.fingerprint || playableFingerprint(scenario) !== scenario.fingerprint) continue;
          compiled.push(scenario);
        } catch { /* Invalid remote manifests never replace the trusted bundled catalogue. */ }
      }
      if (compiled.length) setCatalogueScenarios((current) => {
        const replacements = new Map(compiled.map((item) => [item.caseId, item]));
        const merged = current.map((item) => replacements.get(item.caseId) ?? item);
        for (const item of compiled) if (!merged.some((existing) => existing.caseId === item.caseId)) merged.push(item);
        return merged.sort((left, right) => left.order - right.order);
      });
    }).catch(() => { /* Bundled cases keep the public beta playable during a catalogue outage. */ });
  }, []);

  const featured = catalogueScenarios.find((scenario) => scenario.id === featuredId) ?? catalogueScenarios[2] ?? scenarios[2];
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
    const legacyMode = legacyScenarios.some((item) => item.caseId === activeScenario.caseId && item.version === activeScenario.version && item.fingerprint === activeScenario.fingerprint);
    const timing = legacyMode
      ? resolveLegacyDecisionTiming(activeScenario, caseMinute, selectedOption, completedDeadlineIds, missedDeadlineIds)
      : resolveDecisionTiming(activeScenario, caseMinute, selectedOption, completedDeadlineIds, missedDeadlineIds);
    if (timing.newlyMissedDeadlineIds.length > 0) {
      updated.exposure = clamp(updated.exposure + timing.newlyMissedDeadlineIds.length * 8);
      updated.trust = clamp(updated.trust - timing.newlyMissedDeadlineIds.length * 4);
    }
    const forcedStageId = timing.forcedStageId;
    const dispatchedOption: DecisionOption = forcedStageId ? {
      ...selectedOption,
      nextStageId: timing.nextStageId,
      result: {
        en: `${selectedOption.result.en} A controlling deadline expired and the matter was routed to ${activeScenario.stages.find((item) => item.id === forcedStageId)?.headline.en ?? forcedStageId}.`,
        ru: `${selectedOption.result.ru} Контрольный срок истёк; дело переведено на стадию «${activeScenario.stages.find((item) => item.id === forcedStageId)?.headline.ru ?? forcedStageId}».`,
      },
    } : selectedOption;
    setMetrics(updated);
    setCaseMinute(timing.transitionMinute);
    setCompletedDeadlineIds(timing.completedDeadlineIds);
    setMissedDeadlineIds((current) => Array.from(new Set([...current, ...timing.newlyMissedDeadlineIds])));
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
    if (file.size > 1_000_000) { window.alert(text.invalidPlay); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isRecord(parsed) || parsed.format !== "genesis-juris-played-case" || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)) throw new Error("Unsupported played-case schema");
        if (!isRecord(parsed.scenario) || !isRecord(parsed.playthrough)) throw new Error("Missing played-case sections");
        const scenarioFile = parsed.scenario;
        const playthroughFile = parsed.playthrough;

        let importedScenario = catalogueScenarios.find((scenario) => scenario.id === scenarioFile.id && scenario.caseId === scenarioFile.caseId && scenario.version === scenarioFile.contentVersion && scenario.fingerprint === scenarioFile.fingerprint)
          ?? scenarios.find((scenario) => scenario.id === scenarioFile.id && scenario.caseId === scenarioFile.caseId && scenario.version === scenarioFile.contentVersion && scenario.fingerprint === scenarioFile.fingerprint)
          ?? legacyScenarios.find((scenario) => scenario.id === scenarioFile.id && scenario.caseId === scenarioFile.caseId && scenario.version === scenarioFile.contentVersion && scenario.fingerprint === scenarioFile.fingerprint);
        if (!importedScenario && typeof scenarioFile.caseId === "string" && typeof scenarioFile.contentVersion === "string") {
          const response = await fetch(`/api/catalog/${encodeURIComponent(scenarioFile.caseId)}?version=${encodeURIComponent(scenarioFile.contentVersion)}`);
          const historical = await readJsonResponse<unknown>(response);
          if (isRecord(historical) && isRecord(historical.payload) && historical.payload.kind === "playable-scenario-v1") {
            const candidate = normalizePlayableScenario(historical.payload.scenario);
            if (candidate.id === scenarioFile.id && candidate.caseId === scenarioFile.caseId && candidate.version === scenarioFile.contentVersion && candidate.fingerprint === scenarioFile.fingerprint && historical.fingerprint === candidate.fingerprint && playableFingerprint(candidate) === candidate.fingerprint) importedScenario = candidate;
          }
        }
        if (!importedScenario) {
          throw new Error("Scenario identity or published content version is unavailable");
        }

        const importedDecisions = playthroughFile.decisions;
        const importedStatus = playthroughFile.status;
        const currentStageId = playthroughFile.currentStageId;
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
        const legacyMode = legacyScenarios.some((item) => item.caseId === importedScenario.caseId && item.version === importedScenario.version && item.fingerprint === importedScenario.fingerprint);

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
          const timing = legacyMode
            ? resolveLegacyDecisionTiming(importedScenario, restoredMinute, sourceOption, restoredCompletedDeadlines, restoredMissedDeadlines)
            : resolveDecisionTiming(importedScenario, restoredMinute, sourceOption, restoredCompletedDeadlines, restoredMissedDeadlines);
          restoredMinute = timing.transitionMinute;
          restoredCompletedDeadlines.splice(0, restoredCompletedDeadlines.length, ...timing.completedDeadlineIds);
          restoredMissedDeadlines.push(...timing.newlyMissedDeadlineIds);
          if (timing.newlyMissedDeadlineIds.length > 0) {
            restoredMetrics.exposure = clamp(restoredMetrics.exposure + timing.newlyMissedDeadlineIds.length * 8);
            restoredMetrics.trust = clamp(restoredMetrics.trust - timing.newlyMissedDeadlineIds.length * 4);
          }
          const restoredOption = timing.forcedStageId ? { ...sourceOption, nextStageId: timing.nextStageId } : sourceOption;
          restoredLog.push({ stageId: sourceStage.id, stage: local(sourceStage.headline, locale), option: restoredOption });
          restoredStageId = timing.nextStageId ?? restoredStageId;
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
    const normalized = normalizeStudioDraft(draft);
    const payload: CustomCaseFile = {
      format: "genesis-juris-custom-case",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      case: {
        id: normalized.caseId,
        version: normalized.version,
        fingerprint: caseFingerprint(normalized),
        parent: normalized.parent,
      },
      draft: { ...normalized, updatedAt: new Date().toISOString() },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${normalized.caseId}-v${normalized.version}.juris-case.json`;
    link.click(); URL.revokeObjectURL(url);
  }
  function importDraft(file: File) {
    if (file.size > 1_000_000) { window.alert(locale === "en" ? "Case files are limited to 1 MB." : "Размер файла кейса ограничен 1 МБ."); return; }
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
      classification: { domain: "tax", practiceArea: "International tax planning", difficulty: "Advanced", tags: ["tax", "cross-border", "advisory", "anti-abuse"], taxTopics: ["Treaty access", "Beneficial ownership", "Transfer pricing", "DEMPE", "Substance", "CFC", "PE", "Withholding tax", "DAC6", "Pillar Two"], complianceOnly: true, purpose: "lawful_planning", legalAsOf: "2026-08-21", sourceUrls: ["https://www.oecd.org/en/topics/global-minimum-tax.html", "https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/directive-administrative-cooperation-dac/dac6_en"] },
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: "trigger-1", type: "trigger", title: "Proposed IP and financing restructure", detail: "The group requests a defensible comparison before implementation.", x: 35, y: 220 },
        { id: "actor-1", type: "actor", title: "Group tax director", detail: "Accountable decision-maker coordinating business, legal, finance and external advisers.", x: 225, y: 220 },
        { id: "entity-1", type: "entity", title: "Belgian operating company", detail: "People, functions, risks, assets and effective management.", x: 420, y: 55 },
        { id: "entity-2", type: "entity", title: "NL / UAE entities", detail: "Test residence, substance, beneficial ownership and commercial purpose.", x: 420, y: 360 },
        { id: "cash_flow-1", type: "cash_flow", title: "Royalty and interest flows", detail: "For each payer → payee flow: instrument, amount/currency, WHT, deductibility, treaty basis and beneficial owner.", x: 615, y: 55 },
        { id: "tax_rule-1", type: "tax_rule", title: "Scope, anti-abuse & reporting gates", detail: "Apply jurisdiction/fiscal-year sources. Test PPT/GAAR, CFC, PE, TP, ATAD and DAC6 hallmarks/MBT; test Pillar Two only if the EUR 750m scope threshold is met.", x: 615, y: 360 },
        { id: "evidence-1", type: "evidence", title: "Substance and pricing file", detail: "Residence, ownership, board records, personnel, functions/risks/assets, DEMPE, contracts, forecasts, benchmarking and source confidence.", x: 805, y: 65 },
        { id: "decision-1", type: "decision", title: "Select a compliant design", detail: "Compare status quo, revised structure and no-go outcome with documented assumptions.", x: 805, y: 300 },
        { id: "outcome-1", type: "outcome", title: "Defensible planning position", detail: "Commercial purpose, governance and tax treatment align.", x: 1010, y: 150 },
        { id: "outcome-2", type: "outcome", title: "Redesign or abandon", detail: "Anti-abuse, substance or reporting risks outweigh projected benefit.", x: 1010, y: 390 },
      ],
      links: [
        { from: "trigger-1", to: "actor-1" }, { from: "actor-1", to: "entity-1" }, { from: "actor-1", to: "entity-2" },
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
        <button className="brand" onClick={() => navigate("library")} aria-label="GENESIS: JURIS CODEX — Case Library">
          {/* The SVG is deliberately served directly; it is a tiny UI mark and does not need responsive image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/brand/genesis-juris-codex-mark.svg" alt="" />
          <span><b>GENESIS: JURIS</b><small><strong>CODEX</strong> · LEGAL SCENARIO SYSTEM</small></span>
        </button>
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

      {view === "library" && <LibraryView locale={locale} text={text} cases={catalogueScenarios} featured={featured} setFeaturedId={setFeaturedId} startScenario={startScenario} requestFeedback={setFeedbackTarget} openTaxTemplate={loadTaxTemplate} />}
      {view === "play" && activeScenario && stage && <PlayView locale={locale} text={text} scenario={activeScenario} stage={stage} stageIndex={stageIndex} metrics={metrics} decisionLog={decisionLog} caseMinute={caseMinute} actionUseCounts={actionUseCounts} completedDeadlineIds={completedDeadlineIds} missedDeadlineIds={missedDeadlineIds} dossierRef={dossierRef} setDossierRef={setDossierRef} setSelectedOption={setSelectedOption} outcome={outcome} exportSession={exportPlayedCase} replayCase={() => startScenario(activeScenario)} returnLibrary={() => navigate("library")} requestFeedback={(contextType, contextId) => setFeedbackTarget({ caseId: activeScenario.caseId, version: activeScenario.version, title: activeScenario.title[locale], source: "playable", fingerprint: activeScenario.fingerprint, contextType, contextId })} />}
      {view === "studio" && <StudioView locale={locale} text={text} prompt={prompt} setPrompt={setPrompt} draft={draft} setDraft={setDraft} selectedNode={selectedNode} selectedNodeId={selectedNodeId} selectNode={setSelectedNodeId} checks={checks} generateDraft={generateDraft} saveDraft={saveDraft} savedFlash={savedFlash} exportDraft={exportDraft} importRef={importRef} importDraft={importDraft} createChildVersion={createChildVersion} updateNode={updateNode} addNode={addNode} deleteNode={deleteNode} moveNode={moveNode} resetDraft={() => { setDraft(defaultDraft); setPrompt(defaultPrompt); setSelectedNodeId("decision-1"); }} loadTaxTemplate={loadTaxTemplate} requestFeedback={() => setFeedbackTarget({ caseId: draft.caseId, version: draft.version, title: draft.title, source: "studio", fingerprint: caseFingerprint(draft), contextType: selectedNode ? "node" : "case", contextId: selectedNode?.id })} />}
      {view === "community" && <CommunityView locale={locale} cases={catalogueScenarios} />}
      {view === "help" && <HelpView locale={locale} openCommunity={() => navigate("community")} openStudio={() => navigate("studio")} />}
      {(selectedOption || resultOption) && activeScenario && stage && <DecisionModal locale={locale} text={text} scenario={activeScenario} stageHeadline={local(stage.headline, locale)} option={selectedOption ?? resultOption!} isResult={Boolean(resultOption)} close={() => { setSelectedOption(null); setResultOption(null); }} dispatch={dispatchDecision} advance={advanceStage} finalStage={Boolean(activeScenario.stages.find((item) => item.id === (selectedOption ?? resultOption)?.nextStageId)?.terminal)} />}
      {sessionNotice && <div className="session-toast" role="status"><Icon name="check" />{sessionNotice}</div>}
      {feedbackTarget && <FeedbackDialog locale={locale} target={feedbackTarget} close={() => setFeedbackTarget(null)} submitted={() => { setFeedbackTarget(null); showSessionNotice(locale === "en" ? "Feedback submitted for expert review." : "Отзыв отправлен на экспертную проверку."); }} />}
    </div>
  );
}

type CaseMeta = { practice: string; difficulty: string; duration: number; tags: string[]; version?: string; fingerprint?: string; reviewLevel?: string; updatedAt?: string; authorName?: string; reviewerName?: string; legalAsOf?: string };
const fallbackCaseTaxonomy: Record<string, CaseMeta> = {
  be_commercial_failed_erp_001: { practice: "Commercial disputes", difficulty: "Advanced", duration: 45, tags: ["ERP", "evidence", "litigation"], reviewLevel: "bundled_beta", authorName: "GENESIS: JURIS", reviewerName: "Expert review pending" },
  be_commercial_logistics_001: { practice: "Commercial recovery", difficulty: "Intermediate", duration: 35, tags: ["logistics", "CMR", "insolvency"], reviewLevel: "bundled_beta", authorName: "GENESIS", reviewerName: "Expert review pending" },
  greenfire_first_72_hours: { practice: "Environmental & crisis", difficulty: "Intermediate", duration: 35, tags: ["incident", "regulatory", "72h"], reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending" },
  nl_food_safety_goldenshell_001: { practice: "Food safety & product recall", difficulty: "Advanced", duration: 40, tags: ["recall", "traceability", "claims"], reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending" },
  us_environmental_desert_water_001: { practice: "Environmental mass claims", difficulty: "Expert", duration: 50, tags: ["groundwater", "causation", "mass claims"], reviewLevel: "bundled_beta", authorName: "GENESIS: AI Juris", reviewerName: "Expert review pending" },
};

function LibraryView({ locale, text, cases, featured, setFeaturedId, startScenario, requestFeedback, openTaxTemplate }: { locale: Locale; text: UiText; cases: Scenario[]; featured: Scenario; setFeaturedId: (id: string) => void; startScenario: (scenario: Scenario) => void; requestFeedback: (target: FeedbackTarget) => void; openTaxTemplate: () => void }) {
  const [query, setQuery] = useState("");
  const [practiceFilter, setPracticeFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [catalogueMeta, setCatalogueMeta] = useState<Record<string, CaseMeta>>(fallbackCaseTaxonomy);
  useEffect(() => {
    fetch("/api/catalog").then((response) => readJsonResponse<{ cases?: unknown[] }>(response)).then((payload) => {
      if (!Array.isArray(payload?.cases)) return;
      const remote = Object.fromEntries(payload.cases.filter(isRecord).map((item) => [String(item.id), {
        practice: String(item.practiceArea ?? "General legal"),
        difficulty: String(item.difficulty ?? "Intermediate"),
        duration: Number(item.durationMinutes) || 30,
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
        version: typeof item.currentVersion === "string" ? item.currentVersion : undefined,
        fingerprint: typeof item.fingerprint === "string" ? item.fingerprint : undefined,
        reviewLevel: typeof item.reviewLevel === "string" ? item.reviewLevel : undefined,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
        authorName: typeof item.authorName === "string" ? item.authorName : undefined,
        reviewerName: typeof item.reviewerName === "string" ? item.reviewerName : undefined,
        legalAsOf: typeof item.legalAsOf === "string" ? item.legalAsOf : undefined,
      }]));
      setCatalogueMeta((current) => ({ ...current, ...remote }));
    }).catch(() => { /* The bundled taxonomy keeps the public catalogue available. */ });
  }, []);
  const metadataFor = (scenario: Scenario) => {
    const candidate = catalogueMeta[scenario.caseId];
    if (candidate?.version === scenario.version && candidate.fingerprint === scenario.fingerprint) return candidate;
    return fallbackCaseTaxonomy[scenario.caseId] ?? { practice: "General legal", difficulty: "Intermediate", duration: 30, tags: [], reviewLevel: "community_beta" };
  };
  const practices = Array.from(new Set(cases.map((item) => metadataFor(item).practice)));
  const jurisdictions = Array.from(new Set(cases.map((item) => item.jurisdiction.split(" · ")[0])));
  const difficulties = Array.from(new Set(cases.map((item) => metadataFor(item).difficulty)));
  const tags = Array.from(new Set(cases.flatMap((item) => metadataFor(item).tags))).sort();
  const filteredCases = cases.filter((scenario) => {
    const meta = metadataFor(scenario);
    const haystack = [scenario.title[locale], scenario.subtitle[locale], scenario.jurisdiction, meta?.practice, ...(meta?.tags ?? [])].join(" ").toLowerCase();
    return (!query.trim() || haystack.includes(query.toLowerCase()))
      && (practiceFilter === "all" || meta?.practice === practiceFilter)
      && (jurisdictionFilter === "all" || scenario.jurisdiction.startsWith(jurisdictionFilter))
      && (difficultyFilter === "all" || meta?.difficulty === difficultyFilter)
      && (durationFilter === "all" || (durationFilter === "short" ? (meta?.duration ?? 0) <= 35 : durationFilter === "medium" ? (meta?.duration ?? 0) > 35 && (meta?.duration ?? 0) <= 45 : (meta?.duration ?? 0) > 45))
      && (tagFilter === "all" || meta?.tags.includes(tagFilter));
  });
  const featuredMeta = metadataFor(featured);
  const resetFilters = () => { setQuery(""); setPracticeFilter("all"); setJurisdictionFilter("all"); setDifficultyFilter("all"); setDurationFilter("all"); setTagFilter("all"); };

  return <main className="library-view">
    <section className="library-hero page-width">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot" />{text.catalogue} · {cases.length.toString().padStart(2, "0")} CASES</div><h1>{text.library}</h1><p className="hero-deck">{locale === "en" ? "Enter a living legal crisis. Read the record, preserve provenance and make the decision that changes the institutional position." : "Войдите в живой юридический кризис. Изучайте материалы, сохраняйте происхождение доказательств и принимайте решения, меняющие институциональную позицию."}</p><div className="hero-facts"><span>03 {locale === "en" ? "legal systems" : "правовые системы"}</span><span>{cases.length.toString().padStart(2, "0")} {locale === "en" ? "versioned cases" : "версионных кейсов"}</span><span>EN / RU</span></div></div>
      <div className="hero-index" aria-label="Catalogue index"><span>CASE INDEX</span><b>{String(featured.order / 10).padStart(2, "0")}</b><small>/ {cases.length.toString().padStart(2, "0")}</small></div>
    </section>
    <section className="positioning-band page-width"><div><span>PROFESSIONAL JUDGMENT · SIMULATED</span><h2>{locale === "en" ? "Train the decisions that legal work rarely lets you repeat." : "Тренируйте решения, которые реальная юридическая работа редко позволяет повторить."}</h2></div><p>{locale === "en" ? "GENESIS: JURIS is a platform for building, reviewing and playing branching legal simulations. It develops judgment under uncertainty, evidence discipline and risk-aware action — with versioned cases and practitioner feedback." : "GENESIS: JURIS — платформа для создания, рецензирования и прохождения разветвлённых юридических симуляций. Она развивает профессиональное суждение в условиях неопределённости, дисциплину доказательств и управление рисками."}</p></section>
    <section className="featured-case" style={{ "--case-accent": featured.accent } as React.CSSProperties}>
      <div className="case-visual" aria-hidden="true"><div className="case-grid" /><div className="case-orbit orbit-one"/><div className="case-orbit orbit-two"/><div className="case-signal"><span/>{featured.id === "greenfire_first_72_hours" ? "72H" : `0${featured.order / 10}`}</div><div className="file-stamp">LIVE MATTER<br/><b>{featured.version}</b></div></div>
      <div className="featured-content"><div className="case-kicker"><span>{featured.jurisdiction}</span><span>{featured.sector[locale]}</span></div><h2>{featured.title[locale]}</h2><p className="case-subtitle">{featured.subtitle[locale]}</p><p className="case-brief">{featured.opening[locale]}</p><div className="case-depth"><span>{featured.stages.length} {locale === "en" ? "workflow stages" : "стадий процесса"}</span><span>{featured.stages.reduce((sum, item) => sum + item.options.length, 0)} {locale === "en" ? "actions" : "действий"}</span><span>{featured.deadlines.length} {locale === "en" ? "deadlines" : "дедлайнов"}</span></div><dl className="case-meta"><div><dt>{text.role}</dt><dd>{featured.role[locale]}</dd></div><div><dt>{text.jurisdiction}</dt><dd>{featured.jurisdiction}</dd></div><div><dt>CONTENT</dt><dd>v{featured.version}</dd></div></dl><div className="case-trust"><span>{(featuredMeta.reviewLevel ?? "bundled_beta").replaceAll("_", " ")}</span><span>{locale === "en" ? "Author" : "Автор"}: {featuredMeta.authorName ?? "GENESIS: JURIS"}</span><span>{featuredMeta.legalAsOf ? `${locale === "en" ? "Law as of" : "Право на"} ${featuredMeta.legalAsOf}` : (locale === "en" ? "Legal as-of review pending" : "Проверка актуальности права ожидается")}</span></div><div className="featured-actions"><button className="primary-cta" onClick={() => startScenario(featured)}>{text.launch}<Icon name="arrow"/></button><button className="secondary-cta" onClick={() => requestFeedback({ caseId: featured.caseId, version: featured.version, title: featured.title[locale], source: "playable", fingerprint: featured.fingerprint })}>{text.feedback}</button></div></div>
    </section>
    <section className="catalogue-filters page-width"><label className="filter-search"><span>{locale === "en" ? "Search cases and tags" : "Поиск по кейсам и тегам"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "en" ? "e.g. evidence, recall, CMR" : "например: evidence, recall, CMR"}/></label><label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value)}><option value="all">{locale === "en" ? "All practices" : "Все практики"}</option>{practices.map((practice) => <option key={practice}>{practice}</option>)}</select></label><label><span>{locale === "en" ? "Jurisdiction" : "Юрисдикция"}</span><select value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="all">{locale === "en" ? "All jurisdictions" : "Все юрисдикции"}</option>{jurisdictions.map((jurisdiction) => <option key={jurisdiction}>{jurisdiction}</option>)}</select></label><label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">{locale === "en" ? "All levels" : "Все уровни"}</option>{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label><label><span>{locale === "en" ? "Duration" : "Длительность"}</span><select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}><option value="all">{locale === "en" ? "Any duration" : "Любая"}</option><option value="short">≤ 35 min</option><option value="medium">36–45 min</option><option value="long">45+ min</option></select></label><label><span>{locale === "en" ? "Tag" : "Тег"}</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="all">{locale === "en" ? "All tags" : "Все теги"}</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label><div className="filter-result"><b>{filteredCases.length.toString().padStart(2, "0")} / {cases.length.toString().padStart(2, "0")}</b><button onClick={resetFilters}>{locale === "en" ? "Reset" : "Сбросить"}</button></div></section>
    <section className="case-strip page-width"><div className="section-heading"><div><span>01 — 05</span><h2>{locale === "en" ? "Choose the matter" : "Выберите дело"}</h2></div><p>{locale === "en" ? "Filter the catalogue by practice area, jurisdiction and tags." : "Фильтруйте каталог по области практики, юрисдикции и тегам."}</p></div><div className="case-list">{filteredCases.map((scenario, index) => {
      const meta = metadataFor(scenario);
      return <div key={scenario.id} className="case-row-wrap"><button className={`case-row ${scenario.id === featured.id ? "selected" : ""}`} onClick={() => { setFeaturedId(scenario.id); startScenario(scenario); }} aria-label={`${text.launch}: ${scenario.title[locale]}`}><span className="row-number">{String(index + 1).padStart(2, "0")}</span><span className="row-main"><b>{scenario.title[locale]}</b><small>{scenario.subtitle[locale]}</small><em>{meta.tags.map((tag) => <i key={tag}>{tag}</i>)}</em></span><span className="row-meta"><i>{scenario.jurisdiction}</i><i>{meta.practice}</i><small>{meta.difficulty} · {meta.duration} min · v{scenario.version}</small><small>{(meta.reviewLevel ?? "bundled_beta").replaceAll("_", " ")}</small></span><span className={`urgency ${scenario.urgency}`}>{scenario.urgency}</span><Icon name="arrow"/></button><button className="case-row-feedback" onClick={() => requestFeedback({ caseId: scenario.caseId, version: scenario.version, title: scenario.title[locale], source: "playable", fingerprint: scenario.fingerprint })}>{text.feedback}</button></div>;
    })}{filteredCases.length === 0 && <div className="catalogue-empty"><b>{locale === "en" ? "No cases match these filters." : "Кейсы по этим фильтрам не найдены."}</b><button className="secondary-cta" onClick={resetFilters}>{locale === "en" ? "Reset filters" : "Сбросить фильтры"}</button></div>}</div></section>
    <section className="tax-capability page-width"><div><span>CROSS-BORDER TAX STRUCTURING · OFFSHORE COMPLIANCE</span><h2>{locale === "en" ? "Model lawful cross-border tax planning as a living system." : "Моделируйте законное трансграничное налоговое планирование как живую систему."}</h2><p>{locale === "en" ? "Map entities, jurisdictions, cash flows, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 and Pillar Two — with explicit anti-abuse and documentation gates." : "Связывайте компании, юрисдикции, денежные потоки, treaty access, beneficial ownership, transfer pricing, substance, CFC, PE, withholding tax, DAC6 и Pillar Two — с обязательными anti-abuse и документальными проверками."}</p></div><button className="primary-cta" onClick={openTaxTemplate}>{locale === "en" ? "Open tax-planning template" : "Открыть налоговый шаблон"}<Icon name="arrow"/></button></section>
    <section className="authority-note page-width"><span className="authority-seal">β</span><div><b>{text.adaptation}</b><p>{text.canonNote}</p></div><code>WEB BETA · VERSIONED</code></section>
  </main>;
}
function PlayView({ locale, text, scenario, stage, stageIndex, metrics, decisionLog, caseMinute, actionUseCounts, completedDeadlineIds, missedDeadlineIds, dossierRef, setDossierRef, setSelectedOption, outcome, exportSession, replayCase, returnLibrary, requestFeedback }: { locale: Locale; text: UiText; scenario: Scenario; stage: Scenario["stages"][number]; stageIndex: number; metrics: Record<MetricKey, number>; decisionLog: DecisionRecord[]; caseMinute: number; actionUseCounts: Record<string, number>; completedDeadlineIds: string[]; missedDeadlineIds: string[]; dossierRef: string | null; setDossierRef: (ref: string) => void; setSelectedOption: (option: DecisionOption) => void; outcome: OutcomeClass | null; exportSession: () => void; replayCase: () => void; returnLibrary: () => void; requestFeedback: (contextType: "case" | "stage", contextId?: string) => void }) {
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
      source: locale === "en" ? "Versioned case inbox" : "Версионный Inbox дела",
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
  if (outcome) return <DebriefView locale={locale} text={text} scenario={scenario} metrics={metrics} decisionLog={decisionLog} outcome={outcome} exportSession={exportSession} replayCase={replayCase} returnLibrary={returnLibrary} requestFeedback={() => requestFeedback("case")}/>;
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
          <p>{locale === "en" ? "Every action adapted for the current web-beta stage is shown. Time advances and the quoted cost is recorded only after confirmation." : "Показаны все действия, адаптированные для текущей стадии веб-беты. После подтверждения продвигается время и фиксируется заявленная стоимость."}</p>
        </div>
        <div className="decision-options">
          {stage.options.map((option) => { const uses=actionUseCounts[option.id]??0; const exhausted=(option.repeatability==="once"&&uses>0)||(option.repeatability==="limited"&&uses>=(option.maxUses??1)); return <button key={option.id} disabled={exhausted} onClick={() => setSelectedOption(option)}><span>{option.label[locale]}</span><small>{exhausted ? (locale === "en" ? "COMPLETED" : "ВЫПОЛНЕНО") : `€ ${option.cost.toLocaleString()} · ${option.minutes} MIN${option.repeatability==="limited" ? ` · ${uses}/${option.maxUses}` : ""}`}</small><Icon name={exhausted ? "check" : "arrow"}/></button>;})}
        </div>
      </section>
      <button className="case-feedback-cta secondary-cta" onClick={() => requestFeedback("stage", stage.id)}><Icon name="file"/>{locale === "en" ? "Give feedback on this stage" : "Дать отзыв об этой стадии"}</button>
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

function DebriefView({ locale, text, scenario, metrics, decisionLog, outcome, exportSession, replayCase, returnLibrary, requestFeedback }: { locale: Locale; text: UiText; scenario: Scenario; metrics: Record<MetricKey, number>; decisionLog: DecisionRecord[]; outcome: OutcomeClass; exportSession: () => void; replayCase: () => void; returnLibrary: () => void; requestFeedback: () => void }) {
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
        <button className="secondary-cta" onClick={requestFeedback}><Icon name="file"/>{text.feedback}</button>
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
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isResult) close(); }}><section className={`decision-modal ${isResult ? "result" : ""}`} role="dialog" aria-modal="true" aria-labelledby="decision-title">{!isResult && <button className="modal-close" onClick={close} aria-label={text.cancel}><Icon name="close"/></button>}<div className="modal-register">{isResult ? "DISPATCH RECORD" : "RESPONSE REVIEW"}<span>{scenario.caseId}</span></div><div className="modal-icon"><Icon name={isResult ? "check" : "file"} size={30}/></div><span className="modal-kicker">{isResult ? text.consequence : text.review}</span><h2 id="decision-title">{option.label[locale]}</h2><p className="modal-context">{isResult ? option.result[locale] : option.detail[locale]}</p>{!isResult && <><div className="modal-source"><small>CURRENT SITUATION</small><p>{stageHeadline}</p></div><dl className="decision-cost"><div><dt>{text.cost}</dt><dd>EUR {option.cost.toLocaleString()}</dd></div><div><dt>{text.duration}</dt><dd>{option.minutes} min</dd></div></dl><div className="effect-preview">{(Object.entries(option.effects) as Array<[MetricKey, number]>).map(([key,value]) => <span key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</span>)}</div></>}<div className="modal-actions">{!isResult && <button className="secondary-cta" onClick={close}>{text.cancel}</button>}<button className="primary-cta" onClick={isResult ? advance : dispatch}>{isResult ? (finalStage ? text.debrief : text.continueCase) : text.confirm}<Icon name="arrow"/></button></div></section></div>;
}

function StudioView({ locale, text, prompt, setPrompt, draft, setDraft, selectedNode, selectedNodeId, selectNode, checks, generateDraft, saveDraft, savedFlash, exportDraft, importRef, importDraft, createChildVersion, updateNode, addNode, deleteNode, moveNode, resetDraft, loadTaxTemplate, requestFeedback }: { locale: Locale; text: UiText; prompt: string; setPrompt: (value: string) => void; draft: StudioDraft; setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>; selectedNode: StudioNode | null; selectedNodeId: string | null; selectNode: (id: string | null) => void; checks: Array<{ level: "ok" | "warn"; text: string }>; generateDraft: () => void; saveDraft: () => void; savedFlash: boolean; exportDraft: () => void; importRef: React.RefObject<HTMLInputElement | null>; importDraft: (file: File) => void; createChildVersion: () => void; updateNode: (change: Partial<StudioNode>) => void; addNode: (type: StudioNodeType) => void; deleteNode: () => void; moveNode: (event: React.PointerEvent<HTMLButtonElement>, node: StudioNode) => void; resetDraft: () => void; loadTaxTemplate: () => void; requestFeedback: () => void }) {
  const router = useRouter();
  const [previewLive, setPreviewLive] = useState(false);
  const [previewOutcome, setPreviewOutcome] = useState<StudioNode | null>(null);
  const [workspaceState, setWorkspaceState] = useState<"idle" | "saving" | "saved" | "submitted" | "error">("idle");
  const previewDecision = draft.nodes.find((node) => node.type === "decision");
  const previewOutcomes = draft.nodes.filter((node) => node.type === "outcome").slice(0, 2);

  async function shareDraft(action: "save" | "submit") {
    setWorkspaceState("saving");
    const response = await fetch("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, draft }) });
    if (response.status === 401) { router.push("/signin-with-chatgpt?return_to=%2F"); return; }
    if (!response.ok) { setWorkspaceState("error"); return; }
    setWorkspaceState(action === "submit" ? "submitted" : "saved");
  }

  function nudgeNode(event: React.KeyboardEvent<HTMLButtonElement>, node: StudioNode) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    selectNode(node.id);
    setDraft((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, x: Math.max(0, Math.min(5_000, item.x + direction[0] * step)), y: Math.max(0, Math.min(5_000, item.y + direction[1] * step)) } : item) }));
  }

  return <main className="studio-view"><section className="studio-hero page-width"><div><div className="eyebrow"><span className="live-dot"/>AUTHORING LAB · VISUAL + PROMPT</div><h1>{text.author}</h1><p>{text.authorLead}</p></div><div className="studio-actions"><button className="secondary-cta" onClick={resetDraft}><Icon name="reset"/>{text.newDraft}</button><button className="secondary-cta" onClick={loadTaxTemplate}><Icon name="spark"/>{locale === "en" ? "Tax template" : "Налоговый шаблон"}</button><button className="secondary-cta" onClick={requestFeedback}><Icon name="file"/>{text.feedback}</button><button className="secondary-cta" onClick={() => importRef.current?.click()}><Icon name="upload"/>{text.importCustom}</button><button className="secondary-cta" onClick={exportDraft}><Icon name="download"/>{text.exportCustom}</button><button className="secondary-cta" onClick={() => shareDraft("save")} disabled={workspaceState === "saving"}><Icon name="save"/>{locale === "en" ? "Save to workspace" : "Сохранить в workspace"}</button><button className="primary-cta" onClick={() => shareDraft("submit")} disabled={workspaceState === "saving" || checks.some((check) => check.level === "warn")}><Icon name="check"/>{locale === "en" ? "Submit for review" : "Отправить на рецензию"}</button><button className="secondary-cta" onClick={saveDraft}><Icon name="save"/>{text.save}</button><input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file) importDraft(file); event.target.value=""; }}/></div>{savedFlash && <div className="save-toast"><Icon name="check"/>{text.saved}</div>}{workspaceState !== "idle" && workspaceState !== "saving" && <div className={`workspace-toast ${workspaceState}`} role="status">{workspaceState === "saved" ? (locale === "en" ? "Workspace draft saved." : "Черновик сохранён в workspace.") : workspaceState === "submitted" ? (locale === "en" ? "Submitted to the expert review queue." : "Отправлено в очередь экспертной рецензии.") : (locale === "en" ? "Sign in and complete your profile, then try again." : "Войдите и заполните профиль, затем повторите.")}</div>}</section>
    <aside className="confidentiality-notice page-width"><Icon name="alert"/><p>{locale === "en" ? "Confidentiality: do not enter client-identifiable, privileged, personal or secret information. Use synthetic or de-identified facts and public legal sources." : "Конфиденциальность: не вводите сведения, идентифицирующие клиента, адвокатскую тайну, персональные данные или секреты. Используйте синтетические или обезличенные факты и публичные источники права."}</p></aside>
    <section className="prompt-deck page-width"><div className="prompt-label"><span>{text.prompt}</span><code>GENERATOR / STRUCTURE V1</code></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label={text.prompt}/><button className="generate-button" onClick={generateDraft}><Icon name="spark" size={24}/><span>{text.generate}<small>{locale === "en" ? "Extract trigger, actors, evidence, deadline, decision and outcome branches" : "Выделить триггер, акторов, доказательства, срок, решение и ветви исхода"}</small></span><Icon name="arrow"/></button></section>
    <section className="studio-meta page-width"><label><span>{text.title}</span><input value={draft.title} onChange={(event) => setDraft((current) => ({...current,title:event.target.value}))}/></label><label><span>{text.jurisdiction}</span><input value={draft.jurisdiction} onChange={(event) => setDraft((current) => ({...current,jurisdiction:event.target.value}))}/></label><label><span>{text.role}</span><input value={draft.role} onChange={(event) => setDraft((current) => ({...current,role:event.target.value}))}/></label></section>
    <section className="studio-classification page-width">
      <label><span>{locale === "en" ? "Case domain" : "Домен кейса"}</span><select value={draft.classification?.domain ?? (isTaxClassification(draft.classification) ? "tax" : "general")} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), domain: event.target.value === "tax" ? "tax" : "general" } }))}><option value="general">General legal</option><option value="tax">Tax / cross-border structuring</option></select></label>
      <label><span>{locale === "en" ? "Practice area" : "Область практики"}</span><select value={draft.classification?.practiceArea ?? "General legal"} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), practiceArea: event.target.value } }))}><option>General legal</option><option>International tax planning</option><option>Corporate tax</option><option>Transfer pricing</option><option>Commercial disputes</option><option>AI regulation</option><option>Privacy & cybersecurity</option></select></label>
      <label><span>{locale === "en" ? "Difficulty" : "Сложность"}</span><select value={draft.classification?.difficulty ?? "Intermediate"} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", tags: [], taxTopics: [], complianceOnly: true }), difficulty: event.target.value } }))}><option>Foundation</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></label>
      <label><span>{locale === "en" ? "Tax-case purpose" : "Цель налогового кейса"}</span><select value={draft.classification?.purpose ?? "compliance_review"} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), purpose: event.target.value as NonNullable<StudioDraft["classification"]>["purpose"] } }))}><option value="lawful_planning">Lawful planning</option><option value="compliance_review">Compliance review</option><option value="audit_defence">Audit defence</option><option value="evasion_detection">Evasion detection</option></select></label>
      <label><span>{locale === "en" ? "Law / guidance as of" : "Право / guidance на дату"}</span><input type="date" value={draft.classification?.legalAsOf ?? ""} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), legalAsOf: event.target.value } }))}/></label>
      <label className="wide-field"><span>{locale === "en" ? "Tags · comma separated" : "Теги · через запятую"}</span><input value={(draft.classification?.tags ?? []).join(", ")} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", taxTopics: [], complianceOnly: true }), tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}/></label>
      <label className="wide-field"><span>{locale === "en" ? "Tax topics · treaty, CFC, PE, WHT, DAC6…" : "Налоговые темы · treaty, CFC, PE, WHT, DAC6…"}</span><input value={(draft.classification?.taxTopics ?? []).join(", ")} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], complianceOnly: true }), taxTopics: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}/></label>
      <label className="source-field"><span>{locale === "en" ? "HTTPS legal sources · one per line" : "HTTPS-источники права · по одному в строке"}</span><textarea rows={3} value={(draft.classification?.sourceUrls ?? []).join("\n")} onChange={(event) => setDraft((current) => ({ ...current, classification: { ...(current.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), sourceUrls: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) } }))}/></label>
      <div className="compliance-gate"><Icon name="check"/><div><b>{locale === "en" ? "International tax safety & publication gate" : "Контроль безопасности и публикации налогового кейса"}</b><p>{locale === "en" ? "Lawful-planning, compliance, audit-defence and evasion-detection scenarios may model risky facts. Publication requires named reviewer confirmation that the case does not enable concealment, sham substance, false reporting or evasion; HTTPS sources and a legal as-of date are mandatory." : "Кейсы о законном планировании, compliance, налоговом споре и выявлении уклонения могут моделировать рискованные факты. Для публикации именная рецензия должна подтвердить, что кейс не помогает сокрытию, фиктивной substance, ложной отчётности или уклонению; HTTPS-источники и дата актуальности права обязательны."}</p></div></div>
    </section>
    <section className="studio-version page-width">
      <div className="version-heading"><span>{text.customCase}</span><button className="secondary-cta" onClick={createChildVersion}><Icon name="plus"/>{text.childVersion}</button></div>
      <label><span>{text.caseId}</span><input value={draft.caseId} onChange={(event) => setDraft((current) => ({...current,caseId:slugifyCaseId(event.target.value)}))}/></label>
      <label><span>{text.version}</span><input value={draft.version} onChange={(event) => setDraft((current) => ({...current,version:event.target.value}))} aria-invalid={!/^\d+\.\d+\.\d+$/.test(draft.version)}/></label>
      <div className="version-value"><span>{text.fingerprint}</span><code>{caseFingerprint(draft)}</code></div>
      <div className="parent-trace"><span>{text.parentCase}</span>{draft.parent ? <><b>{draft.parent.caseId}</b><code>v{draft.parent.version} · {draft.parent.fingerprint}</code></> : <em>{locale === "en" ? "Root case · no parent" : "Корневой кейс · родителя нет"}</em>}</div>
    </section>
    <section className="studio-workspace"><aside className="node-palette"><div className="pane-heading"><span>{text.addNode}</span><b>{String(Object.keys(typeColors).length).padStart(2,"0")}</b></div>{(Object.keys(typeColors) as StudioNodeType[]).map((type) => <button key={type} onClick={() => addNode(type)}><i style={{background:typeColors[type]}}/><span>{text.nodeTypes[type]}</span><Icon name="plus"/></button>)}<p>{locale === "en" ? "Add a node, then connect meaning through the generated flow. Drag nodes to reshape the map." : "Добавьте узел, затем свяжите смысл через сгенерированный поток. Перетаскивайте узлы по карте."}</p></aside>
      <section className="graph-deck"><div className="graph-heading"><div><span>{text.graph}</span><b>{draft.title}</b></div><div><code>{draft.nodes.length} NODES</code><code>{draft.links.length} LINKS</code></div></div><div className="graph-canvas"><svg className="graph-links" aria-hidden="true">{draft.links.map((link,index) => { const from=draft.nodes.find((node)=>node.id===link.from); const to=draft.nodes.find((node)=>node.id===link.to); if(!from||!to)return null; return <g key={`${link.from}-${link.to}-${index}`}><path d={`M ${from.x+165} ${from.y+38} C ${from.x+205} ${from.y+38}, ${to.x-38} ${to.y+38}, ${to.x} ${to.y+38}`}/><circle cx={to.x} cy={to.y+38} r="3"/></g>; })}</svg>{draft.nodes.map((node) => <button key={node.id} className={`graph-node type-${node.type} ${node.id===selectedNodeId?"selected":""}`} style={{left:node.x,top:node.y,"--node-color":typeColors[node.type]} as React.CSSProperties} onFocus={() => selectNode(node.id)} onKeyDown={(event) => nudgeNode(event, node)} onPointerDown={(event)=>moveNode(event,node)} onPointerMove={(event)=>moveNode(event,node)} onPointerUp={(event)=>moveNode(event,node)} onPointerCancel={(event)=>moveNode(event,node)} aria-label={`${text.nodeTypes[node.type]}: ${node.title}. ${locale === "en" ? "Use arrow keys to reposition." : "Используйте стрелки для перемещения."}`}><span><i/>{text.nodeTypes[node.type]}<code>{node.id.split("-").at(-1)}</code></span><b>{node.title}</b></button>)}</div><div className="graph-legend">{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><span key={type}><i style={{background:typeColors[type]}}/>{text.nodeTypes[type]}</span>)}</div><details className="graph-relations"><summary>{locale === "en" ? "Accessible relationship list" : "Доступный список связей"} · {draft.links.length}</summary><ol>{draft.links.map((link, index) => { const from = draft.nodes.find((node) => node.id === link.from); const to = draft.nodes.find((node) => node.id === link.to); return <li key={`${link.from}-${link.to}-${index}`}><b>{from?.title ?? link.from}</b><span>→</span><b>{to?.title ?? link.to}</b></li>; })}</ol></details></section>
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
type CommunitySubmission = { id: number; caseId: string; version: string; title: string; status: string; reviewerNote: string; updatedAt: string };

function CommunityView({ locale, cases }: { locale: Locale; cases: Scenario[] }) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [updates, setUpdates] = useState<CommunityUpdate[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState<"loading" | "anonymous" | "ready" | "saving">("loading");
  useEffect(() => {
    fetch("/api/me").then((response) => readJsonResponse<{ profile?: CommunityProfile; isAdmin?: boolean; registered?: boolean }>(response)).then(async (me) => {
      if (!me?.profile) { setStatus("anonymous"); return; }
      setProfile(me.profile); setIsAdmin(me.isAdmin === true); setRegistered(me.registered === true);
      const [feed, workspace] = await Promise.all([
        fetch("/api/updates").then((response) => readJsonResponse<{ updates?: CommunityUpdate[]; subscriptions?: string[] }>(response)),
        fetch("/api/submissions").then((response) => readJsonResponse<{ submissions?: CommunitySubmission[] }>(response)),
      ]);
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? []); setSubmissions(workspace?.submissions ?? []); setStatus("ready");
    }).catch(() => setStatus("anonymous"));
  }, []);
  async function saveProfile() {
    if (!profile) return; setStatus("saving"); setFormError("");
    const response = await fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, locale }) });
    if (response.ok) {
      const saved = await readJsonResponse<{ profile: CommunityProfile }>(response);
      if (saved) setProfile(saved.profile); setRegistered(true);
      const feed = await fetch("/api/updates").then((result) => readJsonResponse<{ updates?: CommunityUpdate[]; subscriptions?: string[] }>(result));
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? subscriptions);
    } else setFormError(locale === "en" ? "Profile could not be saved." : "Не удалось сохранить профиль.");
    setStatus("ready");
  }
  async function toggleSubscription(caseId: string) {
    const subscribed = subscriptions.includes(caseId);
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: subscribed ? "unsubscribe" : "subscribe", caseId }) });
    if (response.ok) {
      setSubscriptions((current) => subscribed ? current.filter((id) => id !== caseId) : [...current, caseId]);
      const feed = await fetch("/api/updates").then((result) => readJsonResponse<{ updates?: CommunityUpdate[] }>(result));
      setUpdates(feed?.updates ?? []);
    }
  }
  async function markRead(updateId: number) {
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read", updateId }) });
    if (response.ok) setUpdates((current) => current.map((item) => item.id === updateId ? { ...item, read: true } : item));
  }
  async function deleteProfile() {
    if (!window.confirm(locale === "en" ? "Delete your profile, subscriptions, drafts and feedback? This cannot be undone." : "Удалить профиль, подписки, черновики и отзывы? Это действие необратимо.")) return;
    const response = await fetch("/api/me", { method: "DELETE" });
    if (response.ok) { setRegistered(false); setUpdates([]); setSubscriptions([]); setSubmissions([]); setFormError(locale === "en" ? "Stored community data deleted." : "Данные сообщества удалены."); }
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
      <p className="privacy-note">{locale === "en" ? "All communications are opt-in and appear in this in-product inbox. Your authenticated email is used for attribution and routing but is not shown publicly. Privacy notice v2026-08-21." : "Все сообщения включаются только по согласию и появляются во внутреннем центре обновлений. Email используется для авторства и маршрутизации, но не показывается публично. Privacy notice v2026-08-21."}</p>
      {formError && <p className="form-error" role="status">{formError}</p>}
      <button className="primary-cta" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : locale === "en" ? "Save profile" : "Сохранить профиль"}<Icon name="check"/></button>
      <div className="profile-data-actions"><a className="secondary-cta" href="/signout-with-chatgpt?return_to=%2F">{locale === "en" ? "Sign out" : "Выйти"}</a>{registered && <button type="button" className="danger-button" onClick={deleteProfile}>{locale === "en" ? "Delete my stored data" : "Удалить мои данные"}</button>}</div>
    </form>
    <section className="update-panel"><div className="panel-title"><span>{locale === "en" ? "Addressed update inbox" : "Адресный центр обновлений"}</span><b>{updates.filter((item) => !item.read).length.toString().padStart(2, "0")}</b></div>{updates.length ? updates.map((item) => <article key={item.id} className={item.read ? "" : "unread"}><span>{item.kind}</span><h3>{item.title}</h3><p>{item.body}</p><footer><small>{item.publishedAt?.slice(0, 10)}</small>{!item.read && <button onClick={() => markRead(item.id)}>{locale === "en" ? "Mark read" : "Прочитано"}</button>}</footer></article>) : <div className="empty-updates"><Icon name="check"/><b>{locale === "en" ? "You are up to date" : "У вас всё актуально"}</b><p>{locale === "en" ? "New releases matching your profile and explicit preferences will appear here." : "Здесь появятся релизы, соответствующие профилю и явным настройкам согласия."}</p></div>}</section>
    </section>
    <section className="subscription-panel"><div className="panel-title"><span>{locale === "en" ? "Follow individual cases" : "Подписки на отдельные кейсы"}</span><b>{subscriptions.length.toString().padStart(2, "0")}</b></div><div>{cases.map((item) => <button key={item.id} className={subscriptions.includes(item.caseId) ? "subscribed" : ""} onClick={() => toggleSubscription(item.caseId)}><span><b>{item.title[locale]}</b><small>{item.jurisdiction} · v{item.version}</small></span><em>{subscriptions.includes(item.caseId) ? (locale === "en" ? "Following" : "Подписка") : (locale === "en" ? "Follow" : "Подписаться")}</em></button>)}</div></section>
    <section className="workspace-panel"><div className="panel-title"><span>{locale === "en" ? "My Studio review workspace" : "Мои кейсы на рецензии"}</span><b>{submissions.length.toString().padStart(2, "0")}</b></div>{submissions.length ? <div className="workspace-list">{submissions.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.caseId} · v{item.version}</small></div><span>{item.status.replaceAll("_", " ")}</span>{item.reviewerNote && <p>{item.reviewerNote}</p>}</article>)}</div> : <p>{locale === "en" ? "Save or submit a Studio draft to start the moderated practitioner workflow." : "Сохраните или отправьте черновик Studio, чтобы начать модерируемый рабочий процесс."}</p>}</section>
    {isAdmin && <AdminDesk locale={locale} cases={cases}/>}
  </main>;
}

function AdminDesk({ locale, cases }: { locale: Locale; cases: Scenario[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("product");
  const [caseId, setCaseId] = useState(cases[0]?.caseId ?? "");
  const [jurisdictions, setJurisdictions] = useState("");
  const [practices, setPractices] = useState("");
  const [roles, setRoles] = useState("");
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [feedbackQueue, setFeedbackQueue] = useState<Array<Record<string, unknown>>>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Record<string, unknown> | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/submissions").then((response) => readJsonResponse<{ submissions?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/feedback").then((response) => readJsonResponse<{ feedback?: Array<Record<string, unknown>> }>(response)),
    ]).then(([submissionsPayload, feedbackPayload]) => {
      setQueue(submissionsPayload?.submissions ?? []);
      setFeedbackQueue(feedbackPayload?.feedback ?? []);
    });
  }, []);
  async function publishRelease(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/releases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, kind, caseId: kind === "case" ? caseId : null, targetJurisdictions: commaList(jurisdictions), targetPracticeAreas: commaList(practices), targetRoles: commaList(roles) }) });
    if (response.ok) { setTitle(""); setBody(""); setMessage(locale === "en" ? "Addressed release published." : "Адресный релиз опубликован."); }
    else setMessage(locale === "en" ? "Release validation failed." : "Релиз не прошёл проверку.");
  }
  async function inspectSubmission(id: number) {
    const detail = await fetch(`/api/admin/submissions?id=${id}`).then((response) => readJsonResponse<{ submission?: Record<string, unknown> }>(response));
    if (detail?.submission) { setSelectedSubmission(detail.submission); setReviewerNote(String(detail.submission.reviewerNote ?? "")); }
  }
  async function reviewSubmission(id: number, status: "accepted" | "changes_requested") {
    const response = await fetch("/api/admin/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, reviewerNote }) });
    if (response.ok) {
      setQueue((current) => current.map((item) => Number(item.id) === id ? { ...item, status } : item));
      setSelectedSubmission(null); setReviewerNote("");
    }
  }
  async function resolveFeedback(id: number) {
    const response = await fetch("/api/admin/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: "resolved", moderatorNote: "Reviewed by the editorial queue." }) });
    if (response.ok) setFeedbackQueue((current) => current.map((item) => Number(item.id) === id ? { ...item, status: "resolved" } : item));
  }
  const selectedDraft = isRecord(selectedSubmission?.payload) ? selectedSubmission.payload : null;
  const selectedClassification = isRecord(selectedDraft?.classification) ? selectedDraft.classification : null;
  const selectedNodes = Array.isArray(selectedDraft?.nodes) ? selectedDraft.nodes : [];
  const selectedLinks = Array.isArray(selectedDraft?.links) ? selectedDraft.links : [];
  return <section className="admin-desk">
    <div className="panel-title"><span>PLATFORM ADMIN · MODERATION & RELEASES</span><b>ADMIN</b></div>
    <div className="admin-grid">
      <form onSubmit={publishRelease}><h2>{locale === "en" ? "Addressed release" : "Адресный релиз"}</h2><label><span>Kind</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="product">Product</option><option value="case">Case</option><option value="research">Research</option></select></label>{kind === "case" && <label><span>Case</span><select value={caseId} onChange={(event) => setCaseId(event.target.value)}>{cases.map((item) => <option value={item.caseId} key={item.caseId}>{item.title[locale]} · v{item.version}</option>)}</select></label>}<label><span>Title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)}/></label><label><span>Message</span><textarea value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)}/></label><label><span>Target jurisdictions · comma separated</span><input value={jurisdictions} onChange={(event) => setJurisdictions(event.target.value)}/></label><label><span>Target practices · comma separated</span><input value={practices} onChange={(event) => setPractices(event.target.value)}/></label><label><span>Target roles · comma separated</span><input value={roles} onChange={(event) => setRoles(event.target.value)}/></label><button className="primary-cta" disabled={title.trim().length < 4 || body.trim().length < 10}>Publish release<Icon name="arrow"/></button>{message && <p role="status">{message}</p>}</form>
      <div className="moderation-queues">
        <section><h2>{locale === "en" ? "Case submissions" : "Кейсы на рецензии"}</h2>{queue.filter((item) => item.status === "submitted").slice(0, 8).map((item) => <article key={String(item.id)}><b>{String(item.title)}</b><small>{String(item.caseId)} · v{String(item.version)}</small><button onClick={() => inspectSubmission(Number(item.id))}>{locale === "en" ? "Inspect draft" : "Открыть черновик"}</button></article>)}</section>
        <section><h2>{locale === "en" ? "Feedback queue" : "Очередь отзывов"}</h2>{feedbackQueue.filter((item) => item.status !== "resolved" && item.status !== "declined").slice(0, 8).map((item) => <article key={String(item.id)}><b>{String(item.caseId)} · {String(item.category)}</b><small>{String(item.severity)} · {String(item.contextType)} {String(item.contextId ?? "")}</small><p>{String(item.comment)}</p><button onClick={() => resolveFeedback(Number(item.id))}>Resolve</button></article>)}</section>
      </div>
    </div>
    {selectedSubmission && selectedDraft && <section className="review-detail"><div><span>REVIEW RECORD</span><button onClick={() => setSelectedSubmission(null)} aria-label={locale === "en" ? "Close review record" : "Закрыть рецензию"}><Icon name="close"/></button></div><h2>{String(selectedSubmission.title)}</h2><dl><div><dt>CASE / VERSION</dt><dd>{String(selectedSubmission.caseId)} · v{String(selectedSubmission.version)}</dd></div><div><dt>FINGERPRINT</dt><dd><code>{String(selectedSubmission.fingerprint)}</code></dd></div><div><dt>DOMAIN / PRACTICE</dt><dd>{String(selectedClassification?.domain ?? "general")} · {String(selectedClassification?.practiceArea ?? "")}</dd></div><div><dt>GRAPH</dt><dd>{selectedNodes.length} nodes · {selectedLinks.length} links</dd></div></dl><p>{String(selectedDraft.premise ?? "")}</p><label><span>{locale === "en" ? "Substantive reviewer note" : "Содержательное замечание рецензента"}</span><textarea value={reviewerNote} minLength={10} maxLength={4000} onChange={(event) => setReviewerNote(event.target.value)}/></label><div><button className="secondary-cta" disabled={reviewerNote.trim().length < 10} onClick={() => reviewSubmission(Number(selectedSubmission.id), "changes_requested")}>{locale === "en" ? "Request changes" : "Запросить изменения"}</button><button className="primary-cta" disabled={reviewerNote.trim().length < 10} onClick={() => reviewSubmission(Number(selectedSubmission.id), "accepted")}>{locale === "en" ? "Accept for compilation" : "Принять для сборки"}<Icon name="check"/></button></div></section>}
    <p className="admin-publication-note">{locale === "en" ? "Accepted drafts remain non-public until an administrator compiles a playable-scenario-v1 manifest and publishes it through the immutable case-version API." : "Принятые черновики остаются непубличными, пока администратор не соберёт playable-scenario-v1 и не опубликует неизменяемую версию через API."}</p>
  </section>;
}

function commaList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

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
  return <main className="help-view page-width"><section className="help-hero"><span>QUICK HELP</span><h1>{locale === "en" ? "How GENESIS: JURIS works" : "Как работает GENESIS: JURIS"}</h1><p>{locale === "en" ? "A practical legal-simulation system: read the evolving matter, make consequential decisions, learn from the debrief and help practitioners improve the next version." : "Практическая система юридических симуляций: изучайте развивающееся дело, принимайте значимые решения, анализируйте результат и помогайте улучшать следующую версию."}</p></section><section className="help-steps">{steps.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{body}</p></article>)}</section><section className="help-faq"><h2>{locale === "en" ? "Short answers" : "Короткие ответы"}</h2><details open><summary>{locale === "en" ? "Do I need an account?" : "Нужна ли регистрация?"}</summary><p>{locale === "en" ? "No for public cases. Sign in to submit attributed feedback, maintain a profile, follow cases and receive targeted updates." : "Нет для публичных кейсов. Вход нужен для отзывов, профиля, подписок и адресных обновлений."}</p></details><details><summary>{locale === "en" ? "How does a practitioner draft reach the library?" : "Как черновик юриста попадает в библиотеку?"}</summary><p>{locale === "en" ? "Save it to the private workspace, submit it to moderation, address reviewer notes, then let an administrator compile and publish a new immutable playable version. Followers receive the release only under their explicit preferences." : "Сохраните кейс в личном workspace, отправьте на модерацию, учтите замечания рецензента; затем администратор собирает и публикует новую неизменяемую игровую версию. Подписчики получают релиз только по явно выбранным настройкам."}</p></details><details><summary>{locale === "en" ? "Can I create tax-planning cases?" : "Можно ли создавать налоговые кейсы?"}</summary><p>{locale === "en" ? "Yes. Studio includes entities, jurisdictions, cash flows and tax-rule nodes plus a compliance-first international tax template." : "Да. Studio поддерживает компании, юрисдикции, денежные потоки, налоговые правила и compliance-first шаблон международного планирования."}</p></details><details><summary>{locale === "en" ? "What data is stored?" : "Какие данные сохраняются?"}</summary><p>{locale === "en" ? "Your profile, explicit inbox preferences, subscriptions, attributed feedback and submitted drafts. Communications default off, and the profile centre provides sign-out and deletion controls. Never submit privileged or client-identifying facts." : "Профиль, явные настройки внутренних сообщений, подписки, авторизованные отзывы и отправленные черновики. Сообщения по умолчанию выключены; в профиле доступны выход и удаление данных. Не отправляйте адвокатскую тайну или идентифицирующие клиента факты."}</p></details><details><summary>{locale === "en" ? "Is this legal or tax advice?" : "Это юридическая или налоговая консультация?"}</summary><p>{locale === "en" ? "No. Cases are simulations for training and structured professional discussion. Verify current law and facts before real-world use." : "Нет. Это симуляции для обучения и структурированного профессионального обсуждения. Для реальной ситуации проверяйте актуальное право и факты."}</p></details></section><div className="help-actions"><button className="secondary-cta" onClick={openCommunity}>{locale === "en" ? "Register or update profile" : "Регистрация и профиль"}</button><button className="primary-cta" onClick={openStudio}>{locale === "en" ? "Open Case Studio" : "Открыть Case Studio"}<Icon name="arrow"/></button></div></main>;
}

function FeedbackDialog({ locale, target, close, submitted }: { locale: Locale; target: FeedbackTarget; close: () => void; submitted: () => void }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("legal_accuracy");
  const [severity, setSeverity] = useState("suggestion");
  const [comment, setComment] = useState("");
  const [suggestedCorrection, setSuggestedCorrection] = useState("");
  const [citationUrl, setCitationUrl] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>(".modal-close")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]),select,textarea,input,a[href]"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); prior?.focus(); };
  }, [close]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setError("");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: target.caseId, caseVersion: target.version, source: target.source, studioFingerprint: target.fingerprint, contextType: target.contextType ?? "case", contextId: target.contextId, rating, category, severity, comment, suggestedCorrection, citationUrl }) });
    if (response.status === 401) { router.push("/signin-with-chatgpt?return_to=%2F"); return; }
    if (!response.ok) { setError(locale === "en" ? "Please complete the rating and comment." : "Заполните оценку и комментарий."); setSending(false); return; }
    submitted();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form ref={dialogRef} className="feedback-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="feedback-title"><button type="button" className="modal-close" onClick={close} aria-label={locale === "en" ? "Close feedback dialog" : "Закрыть форму отзыва"}><Icon name="close"/></button><span>CASE-SPECIFIC FEEDBACK · {target.source.toUpperCase()}</span><h2 id="feedback-title">{locale === "en" ? "Help improve this case" : "Помогите улучшить кейс"}</h2><p><b>{target.title}</b><br/><code>{target.caseId} · v{target.version}{target.contextId ? ` · ${target.contextType}:${target.contextId}` : ""}</code></p><aside className="feedback-privacy"><Icon name="alert"/>{locale === "en" ? "Do not include client-identifiable, privileged, personal or confidential information." : "Не включайте идентифицирующие клиента, привилегированные, персональные или конфиденциальные сведения."}</aside><div className="feedback-fields"><label><span>{locale === "en" ? "Feedback category" : "Категория отзыва"}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="legal_accuracy">Legal / tax accuracy</option><option value="realism">Professional realism</option><option value="learning_value">Learning value</option><option value="usability">Usability</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label><span>{locale === "en" ? "Severity" : "Существенность"}</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="suggestion">Suggestion</option><option value="material">Material correction</option><option value="critical">Critical legal/safety issue</option></select></label></div><fieldset><legend>{locale === "en" ? "Overall rating" : "Общая оценка"}</legend><div className="rating-row">{[1,2,3,4,5].map((value) => <button type="button" key={value} className={value <= rating ? "active" : ""} onClick={() => setRating(value)} aria-label={`${value} / 5`}>★</button>)}</div></fieldset><label><span>{locale === "en" ? "What should be corrected or improved?" : "Что следует исправить или улучшить?"}</span><textarea required minLength={10} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={locale === "en" ? "Identify the fact, rule, stage, node or decision branch…" : "Укажите факт, правило, стадию, узел или ветвь решения…"}/></label><label><span>{locale === "en" ? "Suggested correction" : "Предлагаемое исправление"}</span><textarea value={suggestedCorrection} onChange={(event) => setSuggestedCorrection(event.target.value)} placeholder={locale === "en" ? "Optional replacement wording or branch logic" : "Необязательная новая формулировка или логика ветви"}/></label><label><span>{locale === "en" ? "Supporting HTTPS source" : "Подтверждающий HTTPS-источник"}</span><input type="url" value={citationUrl} onChange={(event) => setCitationUrl(event.target.value)} placeholder="https://…"/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-cta" onClick={close}>{locale === "en" ? "Cancel" : "Отмена"}</button><button className="primary-cta" disabled={sending || comment.trim().length < 10}>{sending ? "Sending…" : locale === "en" ? "Submit feedback" : "Отправить отзыв"}<Icon name="arrow"/></button></div></form></div>;
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
  if (isTaxClassification(draft.classification)) {
    const hasEntity = count("entity") >= 1;
    const hasTaxRule = count("tax_rule") >= 1;
    const hasFlow = count("cash_flow") >= 1;
    warnings.push(hasEntity && hasTaxRule && hasFlow
      ? {level:"ok",text:label("Tax structure maps entities, cash flows and governing rules","Налоговая структура связывает компании, денежные потоки и применимые правила")}
      : {level:"warn",text:label("Tax cases require entity, cash-flow and tax-rule nodes","Налоговые кейсы требуют узлы компании, денежного потока и налогового правила")});
    warnings.push(draft.classification?.complianceOnly
      ? {level:"ok",text:label("Lawful-planning and anti-abuse gate is enabled","Контроль законности и anti-abuse включён")}
      : {level:"warn",text:label("Enable the lawful-planning compliance gate","Включите контроль законности налогового планирования")});
    warnings.push(draft.classification?.purpose
      ? {level:"ok",text:label(`Tax-case purpose: ${draft.classification.purpose.replaceAll("_", " ")}`,`Цель налогового кейса: ${draft.classification.purpose.replaceAll("_", " ")}`)}
      : {level:"warn",text:label("Select a tax-case purpose","Выберите цель налогового кейса")});
    warnings.push(/^\d{4}-\d{2}-\d{2}$/.test(draft.classification?.legalAsOf ?? "")
      ? {level:"ok",text:label(`Legal sources reviewed as of ${draft.classification?.legalAsOf}`,`Источники права проверены на ${draft.classification?.legalAsOf}`)}
      : {level:"warn",text:label("Set the legal as-of date","Укажите дату актуальности права")});
    warnings.push((draft.classification?.sourceUrls ?? []).length > 0 && (draft.classification?.sourceUrls ?? []).every((item) => item.startsWith("https://"))
      ? {level:"ok",text:label("HTTPS legal sources are attached","HTTPS-источники права приложены")}
      : {level:"warn",text:label("Attach at least one HTTPS legal source","Добавьте хотя бы один HTTPS-источник права")});
  }
  return warnings;
}
