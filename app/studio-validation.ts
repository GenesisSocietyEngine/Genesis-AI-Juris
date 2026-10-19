import { studioInspectorPresentation } from "./studio-inspector-presentation";
import { studioStructuralIssues } from "./case-integrity";
import { caseTypePlaybook, evaluateCaseTypeDraft } from "./case-type-playbooks";
import { caseTypeReference } from "./case-type-reference";
import type { StudioDraft } from "./types";
import { studioGraphAttention } from "./studio-graph-attention";

type Locale = "en" | "ru";
export type StudioCheck = { id?: string; level: "ok" | "warn"; text: string; nodeIds?: string[]; missingStart?: boolean };

export function validateStudioDraft(draft: StudioDraft, locale: Locale): {
  checks: StudioCheck[];
  requiresPlayableRoute: boolean;
} {
  const outgoing = new Set(draft.links.map((link) => link.from));
  const incoming = new Set(draft.links.map((link) => link.to));
  const checks: StudioCheck[] = [];
  const addCheck = (id: string, check: StudioCheck) => checks.push({ ...check, id });
  const label = (en: string, ru: string) => locale === "en" ? en : ru;
  const caseType = draft.caseType ?? caseTypeReference("general_advisory");
  const playbook = caseTypePlaybook(caseType);
  const attention = studioGraphAttention(draft, playbook.test.requiresPlayableRoute);
  addCheck("case-type", { level: "ok", text: label(`Case type ${caseType.id} is pinned to ${caseType.version}`, `Тип кейса «${caseType.id}» зафиксирован на версии ${caseType.version}`) });
  addCheck("identity", /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(draft.caseId)
    ? { level: "ok", text: label("Stable custom case ID is defined", "Стабильный ID custom-кейса определён") }
    : { level: "warn", text: label("Use a lowercase snake_case case ID", "Используйте ID кейса в формате snake_case") });
  addCheck("version", /^\d+\.\d+\.\d+$/.test(draft.version)
    ? { level: "ok", text: label(`Semantic version ${draft.version} is valid`, `Семантическая версия ${draft.version} корректна`) }
    : { level: "warn", text: label("Use a semantic version such as 1.0.0", "Укажите семантическую версию, например 1.0.0") });
  addCheck("brief", draft.title.trim() && draft.premise.trim()
    ? { level: "ok", text: label("Title and professional brief are explicit", "Название и профессиональное описание определены") }
    : { level: "warn", text: label("Add a title and a concise professional brief", "Добавьте название и краткое профессиональное описание") });
  addCheck("context", draft.premisePublication === "author-reviewed"
    ? { level: "ok", text: label("Publishable case context was deliberately reviewed", "Публикуемый контекст кейса проверен автором") }
    : { level: "warn", text: label("Review and edit the publishable case context before submission", "Проверьте и отредактируйте публикуемый контекст кейса перед отправкой") });
  const orphaned = draft.nodes.filter((node) => node.type !== "trigger" && !incoming.has(node.id) && !outgoing.has(node.id));
  addCheck("orphan", orphaned.length === 0
    ? { level: "ok", text: label("No orphaned nodes", "Изолированных узлов нет") }
    : { level: "warn", nodeIds: attention.orphanIds, text: label(`${orphaned.length} orphaned node(s) need a relationship`, `Изолированных узлов: ${orphaned.length}`) });
  const structuralCodes = playbook.test.requiresPlayableRoute
    ? ["invalid_relationship", "disconnected_graph", "outcome_not_reachable_from_decision", "decision_branch_required"]
    : ["invalid_relationship", "disconnected_graph"];
  const serverGraphIssues = studioStructuralIssues(draft).filter((issue) => structuralCodes.includes(issue));
  addCheck("route", serverGraphIssues.length === 0
    ? { level: "ok", text: playbook.test.requiresPlayableRoute ? label("Every playable branch is connected and terminates", "Каждая игровая ветвь связана и завершается") : label("The professional case model is connected", "Профессиональная модель кейса связана") }
    : { level: "warn", nodeIds: attention.routeIds, missingStart: attention.missingStart, text: attention.missingStart
      ? label("Add a Trigger to identify where the route starts, then connect it to the existing model. Existing connections are retained.", "Добавьте триггер начала маршрута и свяжите его с существующей моделью. Текущие связи сохраняются.")
      : label("Some records cannot be reached from a Trigger in the direction of the arrows, or have an invalid branch. Inspect the highlighted nodes and connection directions.", "Часть записей недоступна от триггера по направлению стрелок либо содержит некорректную ветвь. Проверьте выделенные узлы и направления связей.") });
  addCheck("participants", draft.jurisdiction && draft.role
    ? { level: "ok", text: studioInspectorPresentation(draft.caseType, locale).participantsReady }
    : { level: "warn", text: label("Set jurisdiction and responsible role", "Укажите юрисдикцию и ответственную роль") });
  checks.push(...evaluateCaseTypeDraft(draft, locale));
  return { checks, requiresPlayableRoute: playbook.test.requiresPlayableRoute };
}
