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
type View = "library" | "play" | "studio";
type Theme = "office" | "after-hours";

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
    inspector: "Node inspector", checks: "Integrity checks", preview: "Playable preview", addNode: "Add node",
    deleteNode: "Delete node", title: "Title", detail: "Detail", nodeType: "Node type",
    noSelection: "Select a node in the graph to edit it.", allClear: "Draft passes structural checks.",
    localNote: "Drafts are saved locally in this browser. Export JSON for source control or Rust authoring handoff.",
    nodeTypes: { trigger: "Trigger", actor: "Actor", fact: "Fact", evidence: "Evidence", deadline: "Deadline", decision: "Decision", outcome: "Outcome" } as Record<StudioNodeType, string>,
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
    inspector: "Инспектор узла", checks: "Проверки целостности", preview: "Игровой предпросмотр", addNode: "Добавить узел",
    deleteNode: "Удалить узел", title: "Название", detail: "Описание", nodeType: "Тип узла",
    noSelection: "Выберите узел на графе, чтобы отредактировать его.", allClear: "Черновик прошёл структурные проверки.",
    localNote: "Черновики сохраняются локально в этом браузере. Экспортируйте JSON для репозитория или передачи в Rust authoring.",
    nodeTypes: { trigger: "Триггер", actor: "Актор", fact: "Факт", evidence: "Доказательство", deadline: "Срок", decision: "Решение", outcome: "Исход" } as Record<StudioNodeType, string>,
  },
};

type UiText = (typeof ui)["en"];

const metricLabels: Record<Locale, Record<MetricKey, string>> = {
  en: { position: "Position", evidence: "Evidence", trust: "Trust", exposure: "Exposure" },
  ru: { position: "Позиция", evidence: "Доказательства", trust: "Доверие", exposure: "Экспозиция" },
};

const typeColors: Record<StudioNodeType, string> = {
  trigger: "#f06b4f", actor: "#5bb8c4", fact: "#d2a85e", evidence: "#8fc2a9",
  deadline: "#e48a68", decision: "#f0c35b", outcome: "#a594d8",
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

const defaultPrompt = `A renewable-energy developer discovers that its community consultation map omitted two households before a permit hearing. The planning authority requests a corrected record within 36 hours. Create a case for counsel to preserve evidence, coordinate the developer and mapping contractor, decide whether to seek an adjournment, and reach either a credible corrected process or a compromised permit position.`;

const defaultDraft: StudioDraft = {
  title: "The Missing Boundary", jurisdiction: "UK · Planning", role: "Project counsel",
  premise: "A consultation map omitted two households before a permit hearing.", updatedAt: new Date(0).toISOString(),
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
  const [decisionLog, setDecisionLog] = useState<Array<{ stage: string; option: DecisionOption }>>([]);
  const [outcome, setOutcome] = useState<"strong" | "mixed" | "weak" | null>(null);
  const [dossierRef, setDossierRef] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [draft, setDraft] = useState<StudioDraft>(defaultDraft);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("decision-1");
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const text = ui[locale];

  useEffect(() => {
    const stored = window.localStorage.getItem("genesis-juris-studio-draft");
    if (stored) try { setDraft(JSON.parse(stored) as StudioDraft); } catch { /* keep bundled draft */ }
  }, []);

  const featured = scenarios.find((scenario) => scenario.id === featuredId) ?? scenarios[2];
  const stage = activeScenario?.stages[stageIndex] ?? null;
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const checks = useMemo(() => validateDraft(draft, locale), [draft, locale]);

  function navigate(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function startScenario(scenario: Scenario) {
    setActiveScenario(scenario); setStageIndex(0); setMetrics({ ...initialMetrics }); setDecisionLog([]);
    setOutcome(null); setSelectedOption(null); setResultOption(null); setDossierRef(scenario.materials[0]?.ref ?? null); navigate("play");
  }
  function dispatchDecision() {
    if (!selectedOption || !stage || !activeScenario) return;
    const updated = { ...metrics };
    (Object.keys(selectedOption.effects) as MetricKey[]).forEach((key) => { updated[key] = clamp(updated[key] + (selectedOption.effects[key] ?? 0)); });
    setMetrics(updated); setDecisionLog((current) => [...current, { stage: local(stage.headline, locale), option: selectedOption }]);
    setResultOption(selectedOption); setSelectedOption(null);
  }
  function advanceStage() {
    if (!activeScenario) return; setResultOption(null);
    if (stageIndex < activeScenario.stages.length - 1) { setStageIndex((current) => current + 1); return; }
    const resilience = metrics.position + metrics.evidence + metrics.trust - metrics.exposure;
    setOutcome(resilience >= 150 ? "strong" : resilience >= 112 ? "mixed" : "weak");
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
    setDraft({ title: shortTitle, jurisdiction: "Set jurisdiction", role: "Scenario counsel", premise: clean, nodes, links, updatedAt: new Date().toISOString() });
    setSelectedNodeId("decision-1");
  }
  function saveDraft() {
    const next = { ...draft, updatedAt: new Date().toISOString() }; setDraft(next);
    window.localStorage.setItem("genesis-juris-studio-draft", JSON.stringify(next)); setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }
  function exportDraft() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "juris-case"}.json`;
    link.click(); URL.revokeObjectURL(url);
  }
  function importDraft(file: File) {
    const reader = new FileReader(); reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StudioDraft;
        if (!parsed.title || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.links)) throw new Error("Invalid draft");
        setDraft({ ...parsed, updatedAt: new Date().toISOString() }); setSelectedNodeId(parsed.nodes[0]?.id ?? null);
      } catch { window.alert(locale === "en" ? "This file is not a valid GENESIS: JURIS case draft." : "Файл не является корректным черновиком GENESIS: JURIS."); }
    }; reader.readAsText(file);
  }
  function updateNode(change: Partial<StudioNode>) {
    if (!selectedNodeId) return;
    setDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNodeId ? { ...node, ...change } : node) }));
  }
  function addNode(type: StudioNodeType) {
    const id = `${type}-${Date.now()}`;
    setDraft((current) => ({ ...current, nodes: [...current.nodes, { id, type, title: text.nodeTypes[type], detail: "", x: 430, y: 220 }] })); setSelectedNodeId(id);
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
        </nav>
        <div className="top-actions">
          <button className="utility-button" onClick={() => setLocale(locale === "en" ? "ru" : "en")} aria-label="Switch language"><Icon name="globe" /><span>{locale.toUpperCase()}</span></button>
          <button className="utility-button" onClick={() => setTheme(theme === "office" ? "after-hours" : "office")} aria-label="Switch atmosphere"><Icon name={theme === "office" ? "sun" : "moon"} /><span>{theme === "office" ? text.office : text.night}</span></button>
        </div>
      </header>

      {view === "library" && <LibraryView locale={locale} text={text} featured={featured} setFeaturedId={setFeaturedId} startScenario={startScenario} />}
      {view === "play" && activeScenario && stage && <PlayView locale={locale} text={text} scenario={activeScenario} stage={stage} stageIndex={stageIndex} metrics={metrics} decisionLog={decisionLog} dossierRef={dossierRef} setDossierRef={setDossierRef} setSelectedOption={setSelectedOption} outcome={outcome} returnLibrary={() => navigate("library")} />}
      {view === "studio" && <StudioView locale={locale} text={text} prompt={prompt} setPrompt={setPrompt} draft={draft} setDraft={setDraft} selectedNode={selectedNode} selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} checks={checks} generateDraft={generateDraft} saveDraft={saveDraft} savedFlash={savedFlash} exportDraft={exportDraft} importRef={importRef} importDraft={importDraft} updateNode={updateNode} addNode={addNode} deleteNode={deleteNode} moveNode={moveNode} resetDraft={() => { setDraft(defaultDraft); setPrompt(defaultPrompt); setSelectedNodeId("decision-1"); }} />}
      {(selectedOption || resultOption) && activeScenario && stage && <DecisionModal locale={locale} text={text} scenario={activeScenario} stageHeadline={local(stage.headline, locale)} option={selectedOption ?? resultOption!} isResult={Boolean(resultOption)} close={() => { setSelectedOption(null); setResultOption(null); }} dispatch={dispatchDecision} advance={advanceStage} finalStage={stageIndex === activeScenario.stages.length - 1} />}
    </div>
  );
}

function LibraryView({ locale, text, featured, setFeaturedId, startScenario }: { locale: Locale; text: UiText; featured: Scenario; setFeaturedId: (id: string) => void; startScenario: (scenario: Scenario) => void }) {
  return <main className="library-view">
    <section className="library-hero page-width"><div className="hero-copy"><div className="eyebrow"><span className="live-dot" />{text.catalogue} · 05 CASES</div><h1>{text.library}</h1><p className="hero-deck">{locale === "en" ? "Enter a living legal crisis. Read the record, preserve provenance and make the decision that changes the institutional position." : "Войдите в живой юридический кризис. Изучайте материалы, сохраняйте происхождение доказательств и принимайте решения, меняющие институциональную позицию."}</p><div className="hero-facts"><span>05 {locale === "en" ? "jurisdictions" : "юрисдикций"}</span><span>11 {locale === "en" ? "canonical paths" : "канонических путей"}</span><span>EN / RU</span></div></div><div className="hero-index" aria-label="Catalogue index"><span>CASE INDEX</span><b>{String(featured.order / 10).padStart(2, "0")}</b><small>/ 05</small></div></section>
    <section className="featured-case" style={{ "--case-accent": featured.accent } as React.CSSProperties}><div className="case-visual" aria-hidden="true"><div className="case-grid" /><div className="case-orbit orbit-one"/><div className="case-orbit orbit-two"/><div className="case-signal"><span/>{featured.id === "greenfire_first_72_hours" ? "72H" : `0${featured.order / 10}`}</div><div className="file-stamp">LIVE MATTER<br/><b>{featured.version}</b></div></div><div className="featured-content"><div className="case-kicker"><span>{featured.jurisdiction}</span><span>{featured.sector[locale]}</span></div><h2>{featured.title[locale]}</h2><p className="case-subtitle">{featured.subtitle[locale]}</p><p className="case-brief">{locale === "en" ? "A bounded institutional scenario with three decision moments, visible evidence provenance and multiple canonical outcome families." : "Ограниченный институциональный сценарий с тремя моментами решений, видимым происхождением доказательств и несколькими каноническими семействами исходов."}</p><dl className="case-meta"><div><dt>{text.role}</dt><dd>{featured.role[locale]}</dd></div><div><dt>{text.jurisdiction}</dt><dd>{featured.jurisdiction}</dd></div><div><dt>CONTENT</dt><dd>v{featured.version}</dd></div></dl><button className="primary-cta" onClick={() => startScenario(featured)}>{text.launch}<Icon name="arrow"/></button></div></section>
    <section className="case-strip page-width"><div className="section-heading"><div><span>01 — 05</span><h2>{locale === "en" ? "Choose the matter" : "Выберите дело"}</h2></div><p>{locale === "en" ? "Five current catalogue definitions. One deliberate entry point." : "Пять актуальных определений каталога. Одна осознанная точка входа."}</p></div><div className="case-list">{scenarios.map((scenario, index) => <button key={scenario.id} className={`case-row ${scenario.id === featured.id ? "selected" : ""}`} onClick={() => setFeaturedId(scenario.id)}><span className="row-number">{String(index + 1).padStart(2, "0")}</span><span className="row-main"><b>{scenario.title[locale]}</b><small>{scenario.subtitle[locale]}</small></span><span className="row-meta"><i>{scenario.jurisdiction}</i><i>{scenario.role[locale]}</i></span><span className={`urgency ${scenario.urgency}`}>{scenario.urgency}</span><Icon name="arrow"/></button>)}</div></section>
    <section className="authority-note page-width"><span className="authority-seal">A</span><div><b>{text.adaptation}</b><p>{text.canonNote}</p></div><code>CATALOGUE / BUNDLE V5</code></section>
  </main>;
}

function PlayView({ locale, text, scenario, stage, stageIndex, metrics, decisionLog, dossierRef, setDossierRef, setSelectedOption, outcome, returnLibrary }: { locale: Locale; text: UiText; scenario: Scenario; stage: Scenario["stages"][number]; stageIndex: number; metrics: Record<MetricKey, number>; decisionLog: Array<{ stage: string; option: DecisionOption }>; dossierRef: string | null; setDossierRef: (ref: string) => void; setSelectedOption: (option: DecisionOption) => void; outcome: "strong" | "mixed" | "weak" | null; returnLibrary: () => void }) {
  const activeMaterial = scenario.materials.find((material) => material.ref === dossierRef) ?? scenario.materials[0];
  if (outcome) return <main className="debrief-view page-width"><div className="debrief-mark"><span>CASE CLOSED</span><b>{String(scenario.order / 10).padStart(2, "0")}</b></div><div className="eyebrow"><span className="live-dot"/>{text.complete}</div><h1>{scenario.title[locale]}</h1><p className={`outcome-label outcome-${outcome}`}>{scenario.outcomes[outcome][locale]}</p><div className="debrief-grid"><section><h2>{text.actionLog}</h2>{decisionLog.map((entry, index) => <article key={`${entry.option.id}-${index}`} className="log-entry"><span>{String(index + 1).padStart(2, "0")}</span><div><small>{entry.stage}</small><b>{entry.option.label[locale]}</b><p>{entry.option.result[locale]}</p></div></article>)}</section><aside><h2>{locale === "en" ? "Final posture" : "Итоговая позиция"}</h2><MetricPanel locale={locale} metrics={metrics}/><div className="canonical-note"><Icon name="file"/><p>{text.canonNote}</p></div></aside></div><button className="primary-cta" onClick={returnLibrary}>{text.returnLibrary}<Icon name="arrow"/></button></main>;
  return <main className="operations-view"><aside className="case-rail"><button className="rail-back" onClick={returnLibrary}><span>←</span>{text.library}</button><div className="rail-case"><small>ACTIVE MATTER</small><b>{scenario.title[locale]}</b><span>{scenario.jurisdiction}</span></div><ol className="stage-list">{scenario.stages.map((item, index) => <li key={item.id} className={index === stageIndex ? "active" : index < stageIndex ? "done" : ""}><span>{index < stageIndex ? "✓" : index + 1}</span><div><b>{item.phase[locale]}</b><small>{text.day} {item.day} · {item.time}</small></div></li>)}</ol><div className="rail-version">CONTENT v{scenario.version}<br/><code>{scenario.fingerprint}</code></div></aside>
    <section className="command-center"><div className="command-header"><div><div className="eyebrow"><span className="live-dot"/>LIVE OPERATION · {text.day.toUpperCase()} {stage.day}</div><h1>{scenario.title[locale]}</h1><p>{stage.phase[locale]} <span>·</span> {stage.time}</p></div><div className="command-clock"><span>{stage.time}</span><small>{text.day} {stage.day} / 03</small></div></div><MetricPanel locale={locale} metrics={metrics} compact/><div className="ops-ledger"><button><span>{text.attention}</span><b>{Math.max(1, 4-stageIndex)}</b><small>ACTION REQUIRED</small></button><button><span>{text.decisions}</span><b>{stage.options.length}</b><small>RESPONSE WINDOW OPEN</small></button></div><article className="situation-panel"><div className="situation-top"><span>{text.situation}</span><code>{stage.source[locale]}</code></div><h2>{stage.headline[locale]}</h2><p>{stage.brief[locale]}</p><div className={`pressure-band ${stage.pressure ? "active" : ""}`}><Icon name={stage.pressure ? "alert" : "check"}/><div><small>{text.pressure}</small><b>{stage.pressure?.[locale] ?? text.noPressure}</b></div></div></article><section className="decision-entry"><div><span>DECISION {String(stageIndex+1).padStart(2,"0")}</span><h2>{locale === "en" ? "What is the institutional response?" : "Каков институциональный ответ?"}</h2><p>{locale === "en" ? "Review every response before dispatch. Consequences remain hidden until confirmation." : "Проверьте каждый ответ перед отправкой. Последствия скрыты до подтверждения."}</p></div><div className="decision-options">{stage.options.map((option) => <button key={option.id} onClick={() => setSelectedOption(option)}><span>{option.label[locale]}</span><small>€ {option.cost.toLocaleString()} · {option.minutes} MIN</small><Icon name="arrow"/></button>)}</div></section></section>
    <aside className="dossier-pane"><div className="pane-heading"><span>{text.dossier}</span><b>{scenario.materials.length}</b></div><p className="pane-intro">{text.visibleMaterial} · {text.provenance}</p><div className="material-tabs">{scenario.materials.map((material) => <button key={material.ref} className={material.ref === activeMaterial.ref ? "active" : ""} onClick={() => setDossierRef(material.ref)}><code>{material.ref}</code><span>{material.title[locale]}</span></button>)}</div><article className="material-sheet"><div className="sheet-punch"/><div className="sheet-reg">{activeMaterial.ref}</div><span className="document-type">{activeMaterial.type[locale]}</span><h3>{activeMaterial.title[locale]}</h3><dl><div><dt>SOURCE</dt><dd>{activeMaterial.source[locale]}</dd></div><div><dt>DATE / TIME</dt><dd>{activeMaterial.date}</dd></div><div><dt>CASE</dt><dd>{scenario.caseId}</dd></div></dl><p>{locale === "en" ? "Visible case material. Source identity remains attached; opening this record does not recommend a decision." : "Видимый материал дела. Идентичность источника сохранена; открытие записи не рекомендует решение."}</p><div className="sheet-status"><Icon name="check"/> PROVENANCE ATTACHED</div></article>{decisionLog.length > 0 && <section className="mini-log"><h3>{text.actionLog}</h3>{decisionLog.map((entry,index) => <div key={entry.option.id}><span>0{index+1}</span><p>{entry.option.label[locale]}</p></div>)}</section>}</aside></main>;
}

function MetricPanel({ locale, metrics, compact = false }: { locale: Locale; metrics: Record<MetricKey, number>; compact?: boolean }) {
  return <div className={`metric-panel ${compact ? "compact" : ""}`}>{(Object.keys(metrics) as MetricKey[]).map((key) => <div key={key} className={`metric metric-${key}`}><div><span>{metricLabels[locale][key]}</span><b>{metrics[key]}</b></div><i><em style={{ width: `${metrics[key]}%` }}/></i></div>)}</div>;
}

function DecisionModal({ locale, text, scenario, stageHeadline, option, isResult, close, dispatch, advance, finalStage }: { locale: Locale; text: UiText; scenario: Scenario; stageHeadline: string; option: DecisionOption; isResult: boolean; close: () => void; dispatch: () => void; advance: () => void; finalStage: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isResult) close(); }}><section className={`decision-modal ${isResult ? "result" : ""}`} role="dialog" aria-modal="true" aria-labelledby="decision-title"><button className="modal-close" onClick={close} aria-label={text.cancel}><Icon name="close"/></button><div className="modal-register">{isResult ? "DISPATCH RECORD" : "RESPONSE REVIEW"}<span>{scenario.caseId}</span></div><div className="modal-icon"><Icon name={isResult ? "check" : "file"} size={30}/></div><span className="modal-kicker">{isResult ? text.consequence : text.review}</span><h2 id="decision-title">{option.label[locale]}</h2><p className="modal-context">{isResult ? option.result[locale] : option.detail[locale]}</p>{!isResult && <><div className="modal-source"><small>CURRENT SITUATION</small><p>{stageHeadline}</p></div><dl className="decision-cost"><div><dt>{text.cost}</dt><dd>EUR {option.cost.toLocaleString()}</dd></div><div><dt>{text.duration}</dt><dd>{option.minutes} min</dd></div></dl><div className="effect-preview">{(Object.entries(option.effects) as Array<[MetricKey, number]>).map(([key,value]) => <span key={key} className={value >= 0 ? "positive" : "negative"}>{metricLabels[locale][key]} {value >= 0 ? "+" : ""}{value}</span>)}</div></>}<div className="modal-actions">{!isResult && <button className="secondary-cta" onClick={close}>{text.cancel}</button>}<button className="primary-cta" onClick={isResult ? advance : dispatch}>{isResult ? (finalStage ? text.debrief : text.continueCase) : text.confirm}<Icon name="arrow"/></button></div></section></div>;
}

function StudioView({ locale, text, prompt, setPrompt, draft, setDraft, selectedNode, selectedNodeId, setSelectedNodeId, checks, generateDraft, saveDraft, savedFlash, exportDraft, importRef, importDraft, updateNode, addNode, deleteNode, moveNode, resetDraft }: { locale: Locale; text: UiText; prompt: string; setPrompt: (value: string) => void; draft: StudioDraft; setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>; selectedNode: StudioNode | null; selectedNodeId: string | null; setSelectedNodeId: (id: string) => void; checks: Array<{ level: "ok" | "warn"; text: string }>; generateDraft: () => void; saveDraft: () => void; savedFlash: boolean; exportDraft: () => void; importRef: React.RefObject<HTMLInputElement | null>; importDraft: (file: File) => void; updateNode: (change: Partial<StudioNode>) => void; addNode: (type: StudioNodeType) => void; deleteNode: () => void; moveNode: (event: React.PointerEvent<HTMLButtonElement>, node: StudioNode) => void; resetDraft: () => void }) {
  return <main className="studio-view"><section className="studio-hero page-width"><div><div className="eyebrow"><span className="live-dot"/>AUTHORING LAB · VISUAL + PROMPT</div><h1>{text.author}</h1><p>{text.authorLead}</p></div><div className="studio-actions"><button className="secondary-cta" onClick={resetDraft}><Icon name="reset"/>{text.newDraft}</button><button className="secondary-cta" onClick={() => importRef.current?.click()}><Icon name="upload"/>{text.import}</button><button className="secondary-cta" onClick={exportDraft}><Icon name="download"/>{text.export}</button><button className="primary-cta" onClick={saveDraft}><Icon name="save"/>{text.save}</button><input ref={importRef} className="visually-hidden" type="file" accept="application/json" onChange={(event) => { const file=event.target.files?.[0]; if(file) importDraft(file); }}/></div>{savedFlash && <div className="save-toast"><Icon name="check"/>{text.saved}</div>}</section>
    <section className="prompt-deck page-width"><div className="prompt-label"><span>{text.prompt}</span><code>GENERATOR / STRUCTURE V1</code></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label={text.prompt}/><button className="generate-button" onClick={generateDraft}><Icon name="spark" size={24}/><span>{text.generate}<small>{locale === "en" ? "Extract trigger, actors, evidence, deadline, decision and outcome branches" : "Выделить триггер, акторов, доказательства, срок, решение и ветви исхода"}</small></span><Icon name="arrow"/></button></section>
    <section className="studio-meta page-width"><label><span>{text.title}</span><input value={draft.title} onChange={(event) => setDraft((current) => ({...current,title:event.target.value}))}/></label><label><span>{text.jurisdiction}</span><input value={draft.jurisdiction} onChange={(event) => setDraft((current) => ({...current,jurisdiction:event.target.value}))}/></label><label><span>{text.role}</span><input value={draft.role} onChange={(event) => setDraft((current) => ({...current,role:event.target.value}))}/></label></section>
    <section className="studio-workspace"><aside className="node-palette"><div className="pane-heading"><span>{text.addNode}</span><b>07</b></div>{(Object.keys(typeColors) as StudioNodeType[]).map((type) => <button key={type} onClick={() => addNode(type)}><i style={{background:typeColors[type]}}/><span>{text.nodeTypes[type]}</span><Icon name="plus"/></button>)}<p>{locale === "en" ? "Add a node, then connect meaning through the generated flow. Drag nodes to reshape the map." : "Добавьте узел, затем свяжите смысл через сгенерированный поток. Перетаскивайте узлы по карте."}</p></aside>
      <section className="graph-deck"><div className="graph-heading"><div><span>{text.graph}</span><b>{draft.title}</b></div><div><code>{draft.nodes.length} NODES</code><code>{draft.links.length} LINKS</code></div></div><div className="graph-canvas"><svg className="graph-links" aria-hidden="true">{draft.links.map((link,index) => { const from=draft.nodes.find((node)=>node.id===link.from); const to=draft.nodes.find((node)=>node.id===link.to); if(!from||!to)return null; return <g key={`${link.from}-${link.to}-${index}`}><path d={`M ${from.x+165} ${from.y+38} C ${from.x+205} ${from.y+38}, ${to.x-38} ${to.y+38}, ${to.x} ${to.y+38}`}/><circle cx={to.x} cy={to.y+38} r="3"/></g>; })}</svg>{draft.nodes.map((node) => <button key={node.id} className={`graph-node type-${node.type} ${node.id===selectedNodeId?"selected":""}`} style={{left:node.x,top:node.y,"--node-color":typeColors[node.type]} as React.CSSProperties} onPointerDown={(event)=>moveNode(event,node)} onPointerMove={(event)=>moveNode(event,node)} onPointerUp={(event)=>moveNode(event,node)} onPointerCancel={(event)=>moveNode(event,node)}><span><i/>{text.nodeTypes[node.type]}<code>{node.id.split("-").at(-1)}</code></span><b>{node.title}</b></button>)}</div><div className="graph-legend">{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><span key={type}><i style={{background:typeColors[type]}}/>{text.nodeTypes[type]}</span>)}</div></section>
      <aside className="node-inspector"><div className="pane-heading"><span>{text.inspector}</span><b>{selectedNode?"01":"00"}</b></div>{selectedNode?<div className="inspector-form"><div className="selected-type"><i style={{background:typeColors[selectedNode.type]}}/><span>{text.nodeTypes[selectedNode.type]}</span><code>{selectedNode.id}</code></div><label><span>{text.nodeType}</span><select value={selectedNode.type} onChange={(event)=>updateNode({type:event.target.value as StudioNodeType})}>{(Object.keys(typeColors) as StudioNodeType[]).map((type)=><option key={type} value={type}>{text.nodeTypes[type]}</option>)}</select></label><label><span>{text.title}</span><input value={selectedNode.title} onChange={(event)=>updateNode({title:event.target.value})}/></label><label><span>{text.detail}</span><textarea value={selectedNode.detail} onChange={(event)=>updateNode({detail:event.target.value})}/></label><button className="danger-button" onClick={deleteNode}><Icon name="trash"/>{text.deleteNode}</button></div>:<p className="empty-inspector">{text.noSelection}</p>}</aside></section>
    <section className="studio-bottom page-width"><div className="checks-panel"><div className="panel-title"><span>{text.checks}</span><b>{checks.filter((check)=>check.level==="warn").length.toString().padStart(2,"0")}</b></div>{checks.map((check,index)=><div key={index} className={`check-row ${check.level}`}><Icon name={check.level==="ok"?"check":"alert"}/><span>{check.text}</span></div>)}<p>{text.localNote}</p></div><div className="preview-panel"><div className="panel-title"><span>{text.preview}</span><b>LIVE</b></div><div className="preview-card"><div className="preview-index">DRAFT / {draft.nodes.length}</div><h2>{draft.title||"Untitled matter"}</h2><p>{draft.premise}</p><dl><div><dt>{text.jurisdiction}</dt><dd>{draft.jurisdiction}</dd></div><div><dt>{text.role}</dt><dd>{draft.role}</dd></div></dl><button className="primary-cta" disabled={checks.some((check)=>check.level==="warn")}><Icon name="play"/>{locale === "en" ? "Compile playable prototype" : "Собрать игровой прототип"}</button></div></div></section>
  </main>;
}

function validateDraft(draft: StudioDraft, locale: Locale) {
  const count=(type:StudioNodeType)=>draft.nodes.filter((node)=>node.type===type).length;
  const outgoing=new Set(draft.links.map((link)=>link.from)); const incoming=new Set(draft.links.map((link)=>link.to));
  const warnings:Array<{level:"ok"|"warn";text:string}>=[]; const label=(en:string,ru:string)=>locale==="en"?en:ru;
  warnings.push(count("actor")>=1?{level:"ok",text:label(`${count("actor")} institutional actor(s) defined`,`Определено акторов: ${count("actor")}`)}:{level:"warn",text:label("Add at least one institutional actor","Добавьте хотя бы одного институционального актора")});
  warnings.push(count("evidence")>=1?{level:"ok",text:label("Evidence provenance node is present","Узел происхождения доказательств присутствует")}:{level:"warn",text:label("Add evidence with source provenance","Добавьте доказательство с источником происхождения")});
  warnings.push(count("decision")>=1?{level:"ok",text:label("A deliberate decision point is defined","Определена осознанная точка решения")}:{level:"warn",text:label("Add at least one decision point","Добавьте хотя бы одну точку решения")});
  warnings.push(count("outcome")>=2?{level:"ok",text:label("Multiple outcome paths preserve uncertainty","Несколько исходов сохраняют неопределённость")}:{level:"warn",text:label("Add at least two non-recommending outcomes","Добавьте хотя бы два исхода без рекомендации")});
  const orphaned=draft.nodes.filter((node)=>node.type!=="trigger"&&!incoming.has(node.id)&&!outgoing.has(node.id));
  warnings.push(orphaned.length===0?{level:"ok",text:label("No orphaned nodes","Изолированных узлов нет")}:{level:"warn",text:label(`${orphaned.length} orphaned node(s) need a relationship`,`Изолированных узлов: ${orphaned.length}`)});
  warnings.push(draft.jurisdiction&&draft.role?{level:"ok",text:label("Jurisdiction and player role are explicit","Юрисдикция и роль игрока определены")}:{level:"warn",text:label("Set jurisdiction and player role","Укажите юрисдикцию и роль игрока")});
  return warnings;
}
