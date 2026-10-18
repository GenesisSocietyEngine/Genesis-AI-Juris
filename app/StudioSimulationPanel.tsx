"use client";
import { Icon } from "./JurisViewShared";
import type { UiText } from "./JurisApp";
import type { StudioDraft } from "./types";
import type { StudioCheck } from "./studio-validation";
import type { StudioCompileResult } from "./studio-compiler";

export type StudioSimulationPanelProps = {
 locale: "en" | "ru"; text: Pick<UiText, "checks" | "localNote">; draft: StudioDraft; displayMode: "user" | "developer"; trainingWorkflow: boolean;
 checks: StudioCheck[]; visibleChecks: StudioCheck[]; derivationsSettled: boolean; compiledDraft: StudioCompileResult; playDraft: () => void; onFixNode: (id: string) => void;
};

export default function StudioSimulationPanel({locale, text, draft, displayMode, trainingWorkflow, checks, visibleChecks, derivationsSettled, compiledDraft, playDraft, onFixNode}: StudioSimulationPanelProps) {
 const nodeById = new Map(draft.nodes.map(node => [node.id,node]));
  function compilerIssueText(issue: (typeof compiledDraft.issues)[number]) {
    const names = issue.nodeIds.map((id) => nodeById.get(id)?.title).filter((title): title is string => Boolean(title));
    const suffix = names.length ? `: ${names.join(", ")}` : "";
    if (locale === "en") {
      if (issue.code === "missing_start") return "Add a Trigger node to define where the case starts.";
      if (issue.code === "missing_outcome") return "Add at least one Outcome node.";
      if (issue.code === "dead_end") return `Connect every open branch to an Outcome node${suffix}.`;
      if (issue.code === "cycle") return `Remove the loop between these nodes before testing${suffix}.`;
      if (issue.code === "unreachable") return `Connect these nodes to the main case path${suffix}.`;
      return "Complete the case title, jurisdiction, role and graph settings.";
    }
    if (issue.code === "missing_start") return "Добавьте узел «Триггер», с которого начинается кейс.";
    if (issue.code === "missing_outcome") return "Добавьте хотя бы один узел «Исход».";
    if (issue.code === "dead_end") return `Соедините каждую незавершённую ветвь с узлом «Исход»${suffix}.`;
    if (issue.code === "cycle") return `Уберите замкнутый цикл перед тестированием${suffix}.`;
    if (issue.code === "unreachable") return `Подключите эти узлы к основному маршруту кейса${suffix}.`;
    return "Заполните название, юрисдикцию, роль и обязательные настройки графа.";
  }

 return (<details className="studio-simulation-tools page-width" open={trainingWorkflow || displayMode === "developer" ? true : undefined}><summary>{locale === "en" ? "Optional route simulation" : "Дополнительная симуляция маршрута"}</summary><section className="studio-bottom"><div id="studio-checks" className="checks-panel" hidden={displayMode === "user"}><div className="panel-title"><span>{displayMode === "developer" ? text.checks : (locale === "en" ? "Before final review" : "Перед итоговой проверкой")}</span><b>{checks.filter((check)=>check.level==="warn").length.toString().padStart(2,"0")}</b></div>{visibleChecks.length === 0 && displayMode === "user" && <p>{locale === "en" ? "Completeness checks passed. Review the evidence and reasoning before sharing." : "Проверки полноты пройдены. Проверьте доказательства и обоснование перед отправкой."}</p>}{visibleChecks.map((check,index)=><div key={index} className={`check-row ${check.level}`}><Icon name={check.level==="ok"?"check":"alert"}/><span>{check.text}</span></div>)}<p>{text.localNote}</p></div><div className="preview-panel"><div className="panel-title"><span>{locale === "en" ? "Test readiness" : "Готовность к тесту"}</span><b>{draft.nodes.length === 0 ? (locale === "en" ? "START" : "СТАРТ") : !derivationsSettled ? (locale === "en" ? "CHECKING" : "ПРОВЕРКА") : compiledDraft.scenario ? (locale === "en" ? "READY" : "ГОТОВО") : `${compiledDraft.issues.length} ${locale === "en" ? "TO FIX" : "ИСПРАВИТЬ"}`}</b></div><div className="preview-card compiler-card"><div className="preview-index">{trainingWorkflow ? (locale === "en" ? "PLAYABLE CASE PREVIEW" : "ПРЕДПРОСМОТР ИГРАБЕЛЬНОГО КЕЙСА") : (locale === "en" ? "ROUTE SIMULATION PREVIEW" : "ПРЕДПРОСМОТР СИМУЛЯЦИИ МАРШРУТА")}</div><h2>{locale === "en" ? "Test the case you built" : "Проверьте собранный кейс"}</h2>{draft.nodes.length === 0 ? <div className="compiler-empty"><p>{locale === "en" ? "Your new draft is empty. Return to the brief or decision map; validation will start after the first node appears." : "Новый черновик пуст. Вернитесь к описанию или карте решений — проверка начнётся после появления первого узла."}</p></div> : !derivationsSettled ? <div className="compiler-empty" role="status"><p>{locale === "en" ? "Checking the latest edit in the background. Route testing will unlock when this exact graph is ready. Working-draft saving remains available." : "Последняя правка проверяется в фоне. Тест маршрута станет доступен для этой точной версии схемы. Сохранение рабочего черновика остаётся доступным."}</p></div> : <><p>{locale === "en" ? `Case: ${draft.title || "Untitled case"}. Before testing, every route must start clearly and finish at an Outcome.` : `Кейс: ${draft.title || "Без названия"}. Перед тестом каждый маршрут должен иметь понятное начало и завершаться узлом «Исход».`}</p>{compiledDraft.scenario ? <><dl><div><dt>{trainingWorkflow ? (locale === "en" ? "Playable stages" : "Игровых стадий") : (locale === "en" ? "Route steps" : "Шагов маршрута")}</dt><dd>{compiledDraft.scenario.stages.length}</dd></div><div><dt>{trainingWorkflow ? (locale === "en" ? "Player choices" : "Вариантов действий") : (locale === "en" ? "Route options" : "Вариантов маршрута")}</dt><dd>{compiledDraft.scenario.stages.reduce((sum, stage) => sum + stage.options.length, 0)}</dd></div></dl>{compiledDraft.warnings.map((warning) => <p className="compiler-warning" key={warning}>{warning}</p>)}<button className="primary-cta" onClick={playDraft}><Icon name="play"/>{locale === "en" ? "Test this case" : "Протестировать кейс"}</button></> : <div className="compiler-issues">{compiledDraft.issues.map((issue) => <div key={issue.code}><Icon name="alert"/><span>{compilerIssueText(issue)}</span>{issue.nodeIds[0] && <button type="button" onClick={() => { const nodeId=issue.nodeIds[0]; onFixNode(nodeId); }}>{locale === "en" ? "Fix on decision map" : "Исправить на карте"}</button>}</div>)}</div>}</>}</div></div></section></details>);
}
