import { assertDossierObjectKeyScope } from "../app/dossier-security";
import { validId } from "../app/portal/contracts";
import { readJsonObject } from "../app/request-security";

type Bindings = { DB: D1Database; DOSSIER_DOCUMENTS: R2Bucket; PORTAL_RETENTION_TOKEN?: string };
const eligible = `NOT EXISTS (SELECT 1 FROM portal_upload_holds h WHERE h.upload_id=u.id AND h.released_at IS NULL)
  AND ((u.state='pending' AND datetime(u.stamp)<=datetime('now','-24 hours'))
    OR (u.state='received' AND t.verified_at<=datetime('now','-30 days')))`;

async function caseCopy(env: Bindings, id: string, version: string) {
  const row = await env.DB.prepare(`SELECT v.binary_object_reference AS key, v.upload_intent_id AS intent,
    g.case_id AS caseId, u.digest, u.size, u.media
    FROM portal_uploads u JOIN portal_grants g ON g.id=u.grant_id
    JOIN dossier_document_versions v ON v.id=? AND v.dossier_id=g.case_id
    JOIN dossier_documents d ON d.id=v.document_id AND d.dossier_id=g.case_id AND d.is_provisional=0
    WHERE u.id=? AND u.state='received' AND v.content_sha256=u.digest AND v.byte_length=u.size AND v.media_type=u.media`)
    .bind(version,id).first<{key:string; intent:string; caseId:string; digest:string; size:number; media:string}>();
  if (!row) return false;
  assertDossierObjectKeyScope(row.key,row.caseId,row.intent);
  const object = await env.DOSSIER_DOCUMENTS.head(row.key);
  if (!object?.checksums.sha256 || object.size !== row.size || object.httpMetadata?.contentType !== row.media) return false;
  const digest = Array.from(new Uint8Array(object.checksums.sha256), b => b.toString(16).padStart(2,"0")).join("");
  return row.digest === "sha256-" + digest;
}

async function expire(env: Bindings, id: string) {
  const transfer = await env.DB.prepare("SELECT version_id FROM portal_upload_transfers WHERE upload_id=?").bind(id).first<string>("version_id");
  if (transfer && !await caseCopy(env,id,transfer)) {
    const claimed = await env.DB.prepare("SELECT 1 FROM portal_upload_disposals WHERE upload_id=?").bind(id).first();
    if (!claimed) return false;
  }
  // The claim and removal of the upload row are one D1 statement (migration 0038).
  await env.DB.prepare(`INSERT OR IGNORE INTO portal_upload_disposals(upload_id,grant_id)
    SELECT u.id,u.grant_id FROM portal_uploads u LEFT JOIN portal_upload_transfers t ON t.upload_id=u.id
    WHERE u.id=? AND ${eligible} AND (u.state='pending' OR t.version_id=?)`).bind(id,transfer).run();
  const claim = await env.DB.prepare("SELECT grant_id FROM portal_upload_disposals WHERE upload_id=?").bind(id).first<string>("grant_id");
  if (!claim) return false;
  await env.DOSSIER_DOCUMENTS.delete("client-portal/v1/" + claim + "/" + id);
  await env.DB.prepare("UPDATE portal_upload_disposals SET completed_at=CURRENT_TIMESTAMP WHERE upload_id=?").bind(id).run();
  return true;
}

export async function runRetention(env: Bindings) {
  let after = "", examined = 0, removed = 0, failed = 0;
  for (;;) {
    const rows = await env.DB.prepare(`SELECT upload_id AS id FROM portal_upload_disposals
      WHERE upload_id>? AND (completed_at IS NULL OR
        (completed_at < datetime(claimed_at,'+1 day') AND claimed_at <= datetime('now','-1 day')))
      UNION ALL SELECT u.id FROM portal_uploads u LEFT JOIN portal_upload_transfers t ON t.upload_id=u.id
      WHERE u.id>? AND ${eligible} ORDER BY id LIMIT 25`).bind(after,after).all<{id:string}>();
    for (const {id} of rows.results) {
      after = id;
      examined++;
      try {
        if (await expire(env,id)) removed++;
      } catch {
        failed++;
      }
    }
    if (rows.results.length < 25) {
      if (failed) throw Error("Portal retention could not process " + failed + " uploads");
      return { examined, removed };
    }
  }
}

// Deploy only with private operator service bindings (no public routes, preview URL or workers.dev).
export default {
  async scheduled(_event: ScheduledController, env: Bindings) { await runRetention(env); },
  async fetch(req: Request, env: Bindings) {
    if (req.method !== "POST") return new Response(null,{status:405});
    const token = env.PORTAL_RETENTION_TOKEN;
    if (!token || req.headers.get("Authorization") !== "Bearer " + token) return new Response(null,{status:403});
    const body = await readJsonObject(req,4096);
    if (!body || !validId(body.uploadId)) return new Response(null,{status:400});
    const id = body.uploadId;
    let changed = false;
    if (body.action === "hold" && validId(body.holdId) && typeof body.basis === "string" && body.basis.trim()
        && typeof body.owner === "string" && body.owner.trim() && typeof body.reviewOn === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(body.reviewOn) && Number.isFinite(Date.parse(body.reviewOn))
        && new Date(body.reviewOn).toISOString().slice(0,10) === body.reviewOn) {
      const result = await env.DB.prepare(`INSERT OR IGNORE INTO portal_upload_holds(id,upload_id,basis,owner,review_on)
        SELECT ?,id,?,?,? FROM portal_uploads WHERE id=?`).bind(body.holdId,body.basis,body.owner,body.reviewOn,id).run();
      changed = !!result.meta.changes;
    } else if (body.action === "release" && validId(body.holdId)) {
      const result = await env.DB.prepare("UPDATE portal_upload_holds SET released_at=CURRENT_TIMESTAMP WHERE id=? AND upload_id=? AND released_at IS NULL").bind(body.holdId,id).run();
      changed = !!result.meta.changes;
    } else if (body.action === "transfer" && typeof body.version === "string" && await caseCopy(env,id,body.version)) {
      const result = await env.DB.prepare(`INSERT OR IGNORE INTO portal_upload_transfers(upload_id,version_id)
        SELECT id,? FROM portal_uploads WHERE id=? AND state='received'`).bind(body.version,id).run();
      changed = !!result.meta.changes;
    } else if (body.action === "expire") changed = await expire(env,id);
    return new Response(null,{status:changed ? 204 : 409});
  },
};
