import { and, desc, eq, lte, sql } from "drizzle-orm";
import {
  caseWorkflowMilestones as applications,
  dossierPracticeRevisions as plans,
  workflowTemplateMilestones as templates,
} from "../../db/schema";
import type { DossierServerContext } from "../dossier-server";
import { parsePracticePlan, type PracticePlan } from "../matters/practice-plan";
import { originalSchedule, type WorkflowSchedule } from "./workflow-milestones";
import type { WorkflowLibrary } from "./workflow-templates";

type Db = DossierServerContext["db"];
export async function templateMilestones(db: Db, organization: string, library: WorkflowLibrary) {
  if (!library.templates.length) return {};
  const rows = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.organizationId, organization),
        lte(templates.libraryRevision, library.revision),
        sql`NOT EXISTS (SELECT 1 FROM workflow_template_milestones newer WHERE newer.organization_id=${templates.organizationId} AND newer.template_id=${templates.templateId} AND newer.version>${templates.version} AND newer.library_revision<=${library.revision})`,
      ),
    )
    .limit(100);
  return Object.fromEntries(
    rows
      .filter((row) => library.templates.some((t) => t.id === row.templateId && t.version === row.version))
      .map((row) => [row.templateId, { version: row.version, names: JSON.parse(row.names) as string[] }]),
  );
}
export async function caseSchedule(
  db: Db,
  dossier: string,
  plan: PracticePlan,
  workflow: unknown,
): Promise<WorkflowSchedule | null> {
  if (typeof workflow !== "string" || !workflow || !plan.items.some((i) => i.workflow === workflow))
    return null;
  const [row] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.dossierId, dossier),
        eq(applications.workflow, workflow),
        lte(applications.revision, plan.revision),
      ),
    )
    .orderBy(desc(applications.revision))
    .limit(1);
  if (row) return JSON.parse(row.schedule) as WorkflowSchedule;
  const [first] = await db
    .select({ plan: plans.plan })
    .from(plans)
    .where(
      and(
        eq(plans.dossierId, dossier),
        lte(plans.revision, plan.revision),
        sql`EXISTS (SELECT 1 FROM json_each(${plans.plan}, '$.items') item WHERE json_extract(item.value, '$.workflow')=${workflow})`,
      ),
    )
    .orderBy(plans.revision)
    .limit(1);
  return first ? originalSchedule(workflow, parsePracticePlan(JSON.parse(first.plan))) : null;
}
