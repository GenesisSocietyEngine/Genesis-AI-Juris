import { sql } from "drizzle-orm";

export const filters = [
  "all",
  "invoice",
  "event",
  "document",
  "task",
  "deleted",
  "fund_request",
  "time",
  "expense",
] as const;
export type Filter = (typeof filters)[number];
export type Entry = {
  id: string;
  stamp: string;
  actor: string | null;
  action: string;
  category: string;
  subject: string;
  docId: string | null;
  caseId: string | null;
  caseTitle: string | null;
};

// Work plans retain whole revisions. Compare records by stable ID, including
// the previous side of the comparison so removed work remains in history.
export function feedQuery(
  org: string,
  user: number,
  actor: string,
  filter: Filter,
  before: string,
  beforeId: string,
  limit: number,
) {
  return sql`WITH allowed AS (
    SELECT d.id,d.title,p.role FROM dossiers d
    JOIN dossier_organization_bindings b ON b.dossier_id=d.id AND b.organization_id=${org}
    JOIN dossier_participants p ON p.dossier_id=d.id AND p.user_id=${user}
      AND p.actor_id=${actor} AND p.status='active' AND p.role IN ('owner','contributor','reviewer','viewer')
  ), plans(scope,revision,actor,stamp,plan) AS (
    SELECT r.dossier_id,r.revision,r.actor_ref,r.occurred_at,r.plan FROM dossier_practice_revisions r JOIN allowed a ON a.id=r.dossier_id
      WHERE ${filter} IN ('all','task','event','deleted')
    UNION ALL SELECT '',revision,actor_ref,occurred_at,plan FROM organization_work_revisions WHERE organization_id=${org}
      AND ${filter} IN ('all','task','event','deleted')
  ), items AS (
    SELECT p.scope,p.revision,j.value AS item,json_extract(j.value,'$.id') AS id FROM plans p,json_each(p.plan,'$.items') j
  ), work AS (
    SELECT p.*,i.item,CASE WHEN old.id IS NULL THEN 'added' ELSE 'updated' END AS change
    FROM plans p JOIN items i USING(scope,revision)
    LEFT JOIN items old ON old.scope=p.scope AND old.revision=p.revision-1 AND old.id=i.id
    WHERE old.id IS NULL OR old.item<>i.item
    UNION ALL SELECT p.*,old.item,'deleted' FROM plans p JOIN items old ON old.scope=p.scope AND old.revision=p.revision-1
    WHERE NOT EXISTS(SELECT 1 FROM items i WHERE i.scope=p.scope AND i.revision=p.revision AND i.id=old.id)
  ), stream(id,stamp,who,action,category,subject,caseId,docId) AS (
    SELECT 'work:'||scope||':'||revision||':'||json_extract(item,'$.id'),stamp,actor,change||'_'||json_extract(item,'$.kind'),
      CASE WHEN change='deleted' THEN 'deleted' ELSE json_extract(item,'$.kind') END,json_extract(item,'$.title'),nullif(scope,''),NULL FROM work
    UNION ALL SELECT 'audit:'||e.id,e.occurred_at,e.actor_ref,e.event_type,
      CASE WHEN e.object_ref_type IN ('document','document_version') THEN 'document' ELSE 'case' END,coalesce(doc.title,''),e.dossier_id,doc.id
      FROM dossier_audit_events e JOIN allowed a ON a.id=e.dossier_id
      LEFT JOIN dossier_document_versions v ON e.object_ref_type='document_version' AND v.id=e.object_ref_id AND v.dossier_id=a.id
      LEFT JOIN dossier_documents doc ON doc.dossier_id=a.id AND doc.is_provisional=0 AND doc.id=CASE WHEN e.object_ref_type='document' THEN e.object_ref_id ELSE v.document_id END
    UNION ALL SELECT 'note:'||n.id,n.occurred_at,n.actor_ref,'note_'||n.action,'note',n.title,n.dossier_id,NULL
      FROM dossier_working_note_versions n JOIN allowed a ON a.id=n.dossier_id
    UNION ALL SELECT 'bill:'||b.case_id||':'||b.sequence,b.created_at,b.actor_ref,json_extract(b.event,'$.kind'),
      json_extract(b.event,'$.kind'),json_extract(b.event,'$.description'),b.case_id,NULL FROM billing_events b
      JOIN allowed a ON a.id=b.case_id AND a.role IN ('owner','contributor') WHERE b.organization_id=${org}
    UNION ALL SELECT 'firm:'||document_id||':'||version,occurred_at,actor_ref,
      CASE WHEN version=1 THEN 'document_created' ELSE 'document_version_created' END,'document',title,NULL,NULL
      FROM firm_document_versions WHERE organization_id=${org}
  )
  SELECT s.id,s.stamp,u.display_name AS actor,s.action,s.category,s.subject,s.docId,s.caseId,a.title AS caseTitle
  FROM stream s LEFT JOIN users u ON u.actor_id=s.who LEFT JOIN allowed a ON a.id=s.caseId
  WHERE (${filter}='all' OR s.category=${filter}) AND (${before}='' OR (s.stamp,s.id)<(${before},${beforeId}))
  ORDER BY s.stamp DESC,s.id DESC LIMIT ${limit}`;
}
