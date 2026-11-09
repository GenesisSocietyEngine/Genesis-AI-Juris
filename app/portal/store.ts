import { sql } from "drizzle-orm";
import { source } from "../calendar/store";
import { confirm, gate, json, missing, now, permitted, staff, type Who, type Staff } from "./authority";
import type { Choice, GrantSummary, Message, Shared, Thread, Upload } from "./contracts";

const eventDetail = sql`json_object('date',i.value->>'$.dueDate','start',i.value->>'$.timing.start.at','end',i.value->>'$.timing.end.at','zone',i.value->>'$.timing.start.timeZone')`;
export const choicesSql = (
  w: Staff,
) => sql`SELECT d.id,d.title,json_object('version',v.id,'ordinal',v.ordinal) AS detail,'document' AS kind,v.id AS revision FROM dossier_documents d JOIN dossier_document_current_versions c ON c.dossier_id=d.dossier_id AND c.document_id=d.id JOIN dossier_document_versions v ON v.dossier_id=d.dossier_id AND v.document_id=d.id AND v.id=c.document_version_id WHERE d.dossier_id=${w.caseId} AND d.is_provisional=0 AND v.upload_intent_id IS NOT NULL
 UNION ALL SELECT i.value->>'$.id', i.value->>'$.title',${eventDetail},'event',CAST(p.revision AS TEXT) FROM (${source(w.org, w.caseId)}) p,json_each(p.plan,'$.items') i WHERE i.value->>'$.kind'='event' AND i.value->>'$.status'='open' AND (i.value->>'$.dueDate' IS NOT NULL OR i.value->>'$.timing.start.at' IS NOT NULL)`;
const currentEvent = sql`EXISTS(SELECT 1 FROM dossier_practice_revisions p,json_each(p.plan,'$.items') i WHERE p.dossier_id=g.case_id AND p.revision=(SELECT MAX(revision) FROM dossier_practice_revisions WHERE dossier_id=g.case_id) AND i.value->>'$.id'=e.target AND i.value->>'$.kind'='event' AND i.value->>'$.status'='open' AND i.value->>'$.title'=e.title AND ${eventDetail}=e.detail)`;
export const shareState = sql`CASE WHEN EXISTS(SELECT 1 FROM portal_entries x WHERE x.grant_id=e.grant_id AND x.kind='withdraw' AND x.target=e.id AND x.actor='schedule') THEN 'changed' WHEN EXISTS(SELECT 1 FROM portal_entries x WHERE x.grant_id=e.grant_id AND x.kind='withdraw' AND x.target=e.id) THEN 'withdrawn' WHEN EXISTS(SELECT 1 FROM portal_entries x WHERE x.grant_id=e.grant_id AND x.kind=e.kind AND x.target=e.target AND x.seq>e.seq) THEN 'replaced' WHEN e.kind='event' AND NOT ${currentEvent} THEN 'changed' ELSE 'shared' END`;
export function visibleDetail(kind: string, detail: string) {
  return kind === "document" ? String(JSON.parse(detail).ordinal) : detail;
}
export async function portalView(w: Who, req: Request) {
  const url = new URL(req.url),
    selected = url.searchParams.get("grant"),
    before = Number(url.searchParams.get("before") || 0);
  if (!Number.isSafeInteger(before) || before < 0) return missing();
  const grants = await w.db.all<GrantSummary>(
    sql`SELECT g.id,g.label,CASE WHEN g.state='invited' AND g.expires_at<=${now} THEN 'expired' ELSE g.state END AS status ${staff(w) ? sql`,g.email` : sql.empty()} FROM portal_grants g WHERE ${gate(w)} ORDER BY g.created_at DESC,g.id`,
  );
  const id = selected || grants[0]?.id || null;
  if (id && !grants.some((g) => g.id === id)) return missing();
  const writable = staff(w) ? w.canWrite : true;
  const choices =
    staff(w) && writable
      ? await w.db.all<Choice>(
          sql`SELECT c.*,EXISTS(SELECT 1 FROM portal_entries e JOIN portal_grants g ON g.id=e.grant_id WHERE g.id=${id} AND e.kind=c.kind AND e.target=c.id AND e.title=c.title AND e.detail=c.detail AND (${shareState})='shared') AS published FROM (${choicesSql(w)}) c ORDER BY c.kind,c.title,c.id`,
        )
      : [];
  let thread: Thread | null = null;
  if (id) {
    const [shared, uploads, rows] = await Promise.all([
      w.db.all<Shared>(
        sql`SELECT * FROM (SELECT e.id,e.kind,e.title,e.detail,e.stamp,${shareState} AS state FROM portal_entries e JOIN portal_grants g ON g.id=e.grant_id WHERE g.id=${id} AND ${gate(w)} AND e.kind IN ('document','event') ORDER BY e.seq DESC) ${staff(w) ? sql.empty() : sql`WHERE state='shared'`}`,
      ),
      w.db.all<Upload>(
        sql`SELECT u.id,u.name,u.size,u.stamp FROM portal_uploads u WHERE u.grant_id=${id} AND u.state='received' AND ${permitted(w, id)} ORDER BY u.stamp DESC,u.id`,
      ),
      w.db.all<Message>(
        sql`SELECT seq,author,title AS text,stamp FROM portal_entries WHERE grant_id=${id} AND kind='message' AND ${permitted(w, id)} ${before ? sql`AND seq<${before}` : sql.empty()} ORDER BY seq DESC LIMIT 51`,
      ),
    ]);
    const messages = rows.slice(0, 50).reverse();
    thread = {
      shared: shared.map((r) => ({ ...r, detail: visibleDetail(r.kind, r.detail) })),
      uploads,
      messages,
      older: rows.length > 50 ? messages[0].seq : null,
    };
  }
  const error = await confirm(w, id);
  if (error) return error;
  return json({
    grants,
    selected: id,
    canInvite: staff(w) && w.owner,
    canWrite: writable,
    choices: choices.map((c) => ({ ...c, detail: visibleDetail(c.kind, c.detail) })),
    thread,
  });
}
