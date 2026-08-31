import { studioStructuralIssues } from "./case-integrity";
import { caseTypePlaybook, evaluateCaseTypeDraft } from "./case-type-playbooks";
import { caseTypeReference } from "./case-type-reference";
import type { StudioDraft } from "./types";

type Locale = "en" | "ru";
type StudioCheck = { level: "ok" | "warn"; text: string };

export function validateStudioDraft(draft: StudioDraft, locale: Locale): {
  checks: StudioCheck[];
  requiresPlayableRoute: boolean;
} {
  const outgoing = new Set(draft.links.map((link) => link.from));
  const incoming = new Set(draft.links.map((link) => link.to));
  const checks: StudioCheck[] = [];
  const label = (en: string, ru: string) => locale === "en" ? en : ru;
  const caseType = draft.caseType ?? caseTypeReference("general_advisory");
  const playbook = caseTypePlaybook(caseType);
  checks.push({ level: "ok", text: label(`Case type ${caseType.id} is pinned to ${caseType.version}`, `Тип кейса «${caseType.id}» зафиксирован на версии ${caseType.version}`) });
  checks.push(/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(draft.caseId)
    ? { level: "ok", text: label("Stable custom case ID is defined", "Стабильный ID custom-кейса определён") }
    : { level: "warn", text: label("Use a lowercase snake_case case ID", "Используйте ID кейса в формате snake_case") });
  checks.push(/^\d+\.\d+\.\d+$/.test(draft.version)
    ? { level: "ok", text: label(`Semantic version ${draft.version} is valid`, `Семантическая версия ${draft.version} корректна`) }
    : { level: "warn", text: label("Use a semantic version such as 1.0.0", "Укажите семантическую версию, например 1.0.0") });
  checks.push(draft.title.trim() && draft.premise.trim()
    ? { level: "ok", text: label("Title and professional brief are explicit", "Название и профессиональное описание определены") }
    : { level: "warn", text: label("Add a title and a concise professional brief", "Добавьте название и краткое профессиональное описание") });
  const orphaned = draft.nodes.filter((node) => node.type !== "trigger" && !incoming.has(node.id) && !outgoing.has(node.id));
  checks.push(orphaned.length === 0
    ? { level: "ok", text: label("No orphaned nodes", "Изолированных узлов нет") }
    : { level: "warn", text: label(`${orphaned.length} orphaned node(s) need a relationship`, `Изолированных узлов: ${orphaned.length}`) });
  const structuralCodes = playbook.test.requiresPlayableRoute
    ? ["invalid_relationship", "disconnected_graph", "outcome_not_reachable_from_decision", "decision_branch_required"]
    : ["invalid_relationship", "disconnected_graph"];
  const serverGraphIssues = studioStructuralIssues(draft).filter((issue) => structuralCodes.includes(issue));
  checks.push(serverGraphIssues.length === 0
    ? { level: "ok", text: playbook.test.requiresPlayableRoute ? label("Every playable branch is connected and terminates", "Каждая игровая ветвь связана и завершается") : label("The professional case model is connected", "Профессиональная модель кейса связана") }
    : { level: "warn", text: playbook.test.requiresPlayableRoute ? label("Reconnect every playable branch and outcome", "Перепривяжите каждую игровую ветвь и исход") : label("Reconnect the case model so its record and decisions are reviewable", "Перепривяжите модель кейса, чтобы материалы и решения можно было проверить") });
  checks.push(draft.jurisdiction && draft.role
    ? { level: "ok", text: label("Jurisdiction and player role are explicit", "Юрисдикция и роль игрока определены") }
    : { level: "warn", text: label("Set jurisdiction and player role", "Укажите юрисдикцию и роль игрока") });
  checks.push(...evaluateCaseTypeDraft(draft, locale));
  return { checks, requiresPlayableRoute: playbook.test.requiresPlayableRoute };
}
