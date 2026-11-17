import { sql } from "drizzle-orm";
import { answersFit, intakeId, parseIntakeAnswers } from "../intake/intake-model";
import { confirm, conflict, gate, invalid, json, now, staff, type Who } from "./authority";
import { validId, type IntakeReview } from "./contracts";

const latest = sql`NOT EXISTS (SELECT 1 FROM intake_revisions newer WHERE newer.organization_id=i.organization_id AND newer.id=i.id AND newer.revision>i.revision)`;
const source = sql`FROM portal_grants g JOIN intake_revisions i ON i.organization_id=g.organization_id AND i.case_id=g.case_id
 LEFT JOIN portal_intake_requests q ON q.grant_id=g.id AND q.intake_id=i.id AND q.revision=i.revision
 LEFT JOIN portal_intake_receipts r ON r.request_id=q.id`;

export async function intakeReviews(w: Who, grant: string): Promise<IntakeReview[]> {
  type Row = Omit<IntakeReview, "questions" | "answers" | "submitted"> & {
    questions: string;
    answers: string;
    submitted: string | null;
  };
  const rows = await w.db.all<Row>(
    sql`SELECT i.id,i.title,i.revision,i.questions,i.answers,q.id AS request,r.number AS receiptNumber,r.stamp AS received,r.answers AS submitted,
     ${latest} AS current ${source}
     WHERE g.id=${grant} AND ${gate(w)} AND i.status='complete'
     AND ${staff(w) ? sql`(q.id IS NOT NULL OR (g.state='active' AND ${latest}))` : sql`q.id IS NOT NULL AND ${latest}`}
     ORDER BY i.title,i.id,i.revision DESC`,
  );
  return rows.map(row => ({
    ...row,
    questions: JSON.parse(row.questions),
    answers: JSON.parse(row.answers),
    submitted: row.submitted === null ? null : JSON.parse(row.submitted),
  }));
}

export async function intakeAction(w: Who, grant: string, id: string, b: Record<string,unknown>) {
  if (typeof b.target !== "string" || !intakeId.test(b.target) ||
      typeof b.revision !== "number" || !Number.isSafeInteger(b.revision) || b.revision < 1) return invalid();
  const eligible = sql`g.id=${grant} AND g.state='active' AND ${gate(w,true)} AND i.id=${b.target}
    AND i.revision=${b.revision} AND i.status='complete' AND ${latest}`;
  let submitted: string | null = null;
  if (staff(w) && b.action === "requestIntake") {
    await w.db.run(sql`INSERT INTO portal_intake_requests(id,grant_id,organization_id,intake_id,revision,issuer,stamp)
      SELECT ${id},g.id,g.organization_id,i.id,i.revision,${w.actor},${now} ${source} WHERE ${eligible}
      ON CONFLICT DO NOTHING`);
  } else if (!staff(w) && b.action === "ackIntake" && validId(b.request) && b.confirmed === true) {
    const form = await w.db.get<{questions: string}>(sql`SELECT i.questions ${source}
      WHERE ${eligible} AND q.id=${b.request}`);
    if (!form) return conflict();
    let answers: string[];
    try {
      answers = parseIntakeAnswers(b.answers);
    } catch {
      return invalid();
    }
    if (!answersFit(JSON.parse(form.questions), answers, true)) return invalid();
    submitted = JSON.stringify(answers);
    await w.db.run(sql`INSERT INTO portal_intake_receipts(request_id,number,recipient,answers,stamp)
      SELECT q.id,${crypto.randomUUID()},g.email,${submitted},${now} ${source} WHERE ${eligible} AND q.id=${b.request}
      ON CONFLICT(request_id) DO NOTHING`);
  } else return invalid();
  const receipt = await w.db.get(sql`SELECT q.id AS request,g.id AS grant,g.case_id AS caseId,i.id AS intakeId,
    i.revision,q.stamp AS issued,r.number AS number,r.stamp AS received ${source}
    WHERE ${eligible} AND q.id IS NOT NULL ${staff(w) ? sql.empty() : sql`AND q.id=${b.request} AND r.recipient=g.email AND r.answers=${submitted}`}`);
  return (await confirm(w,grant)) || (receipt ? json({saved:true,receipt}) : conflict());
}
