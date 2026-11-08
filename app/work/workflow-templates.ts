import { milestoneName, previewSteps } from "./workflow-milestones";

export type WorkflowStep = { title: string; days: number; milestone?: string; kind: "task" | "event" };
export type WorkflowTemplate = { id: string; version: number; title: string; archived: boolean; steps: WorkflowStep[] };
export type WorkflowLibrary = { revision: number; templates: WorkflowTemplate[] };
export const EMPTY_LIBRARY: WorkflowLibrary = { revision: 0, templates: [] };

export function templateFields(value: unknown): Pick<WorkflowTemplate, "title" | "archived" | "steps"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a workflow template.");
  const item = value as WorkflowTemplate;
  if (Object.keys(item).some(k => !["title", "archived", "steps"].includes(k)) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 100 || typeof item.archived !== "boolean") throw new Error("Use a template title of 1–100 characters.");
  if (!Array.isArray(item.steps) || !item.steps.length || item.steps.length > 30) throw new Error("Use 1–30 workflow steps.");
  const steps = item.steps.map(step => {
    if (!step || typeof step !== "object" || Object.keys(step).some(k => !["title", "days", "kind", "milestone"].includes(k)) || typeof step.title !== "string" || !step.title.trim() || step.title.length > 240 || !Number.isInteger(step.days) || Math.abs(step.days) > 3650 || !["task", "event"].includes(step.kind)) throw new Error("Each step needs a title, type and a whole-day offset between −3650 and 3650.");
    const name = milestoneName(step.milestone);
    return { title: step.title.trim(), days: step.days, kind: step.kind, ...(name ? { milestone: name } : {}) };
  });
  return { title: item.title.trim(), archived: item.archived, steps };
}

export function readWorkflowLibrary(value: unknown, metadata?: unknown): WorkflowLibrary {
  const library = value as WorkflowLibrary;
  if (!library || !Number.isSafeInteger(library.revision) || library.revision < 0 || !Array.isArray(library.templates) || library.templates.length > 100) throw new Error("Unsupported workflow library.");
  const ids = new Set<string>();
  for (const template of library.templates) {
    if (!template || !/^wf_[a-zA-Z0-9_-]{1,100}$/.test(template.id) || ids.has(template.id) || !Number.isSafeInteger(template.version) || template.version < 1) throw new Error("Unsupported template identity.");
    const { id, version, ...fields } = template; void version;
    templateFields(fields); ids.add(id);
  }
  if (!metadata) return library;
  if (typeof metadata !== "object" || Array.isArray(metadata)) throw Error("Unsupported template milestones.");
  const versions = metadata as Record<string, { version: number; names: string[] }>;
  return { ...library, templates: library.templates.map(template => {
    const record = versions[template.id];
    if (!record || record.version !== template.version) return template;
    if (record.names.length !== template.steps.length) throw Error("Unsupported template milestones.");
    return { ...template, steps: template.steps.map((step, i) => {
      const name = milestoneName(record.names[i]);
      return name ? { ...step, milestone: name } : step;
    }) };
  }) };
}

export function changeWorkflowLibrary(library: WorkflowLibrary, command: Record<string, unknown>, newId: () => string): WorkflowLibrary {
  const templates = [...library.templates];
  const fields = templateFields(command.template);
  if (command.action === "create") {
    if (templates.length >= 100) throw new Error("This organization supports up to 100 templates, including archived templates.");
    templates.push({ ...fields, id: newId(), version: 1 });
  } else if (command.action === "update") {
    const index = templates.findIndex(t => t.id === command.id);
    if (index < 0) throw new Error("Template unavailable in this organization.");
    templates[index] = { ...fields, id: templates[index].id, version: templates[index].version + 1 };
  } else throw new Error("Choose create or update.");
  return { revision: library.revision + 1, templates };
}

export function previewTemplate(template: Pick<WorkflowTemplate, "steps">, dates: unknown) {
  return previewSteps(template.steps, dates);
}
