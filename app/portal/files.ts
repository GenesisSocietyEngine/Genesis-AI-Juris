import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { assertDossierObjectKeyScope } from "../dossier-security";
import { decideDossierDownload } from "../dossier-download-security";
import {
  checkMutation,
  confirm,
  gate,
  invalid,
  json,
  missing,
  permitted,
  type Client,
  type Who,
} from "./authority";
import { fileLimit, validId } from "./contracts";
import { shareState } from "./store";

const bucket = () => (env as unknown as { DOSSIER_DOCUMENTS: R2Bucket }).DOSSIER_DOCUMENTS;
const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, "0")).join("");
const objectKey = (grant: string, id: string) => "client-portal/v1/" + grant + "/" + id;
const unavailable = () => json({ error: "The file could not be verified. Try again." }, 503);
async function readBytes(r: Request) {
  if (!r.body || Number(r.headers.get("content-length")) > fileLimit) return null;
  const reader = r.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > fileLimit) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) return null;
  const bytes = new Uint8Array(size);
  let i = 0;
  for (const p of parts) {
    bytes.set(p, i);
    i += p.length;
  }
  return bytes;
}
export function validFile(name: string, media: string, b: Uint8Array) {
  if (
    !name ||
    name.length > 150 ||
    /[/\\:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name) ||
    name.startsWith(".")
  )
    return false;
  const ext = name.split(".").pop()?.toLowerCase(),
    starts = (a: number[]) => a.every((v, i) => b[i] === v);
  if (ext === "pdf" && media === "application/pdf")
    return starts([37, 80, 68, 70, 45]) && new TextDecoder().decode(b.slice(-1024)).includes("%%EOF");
  if (ext === "png" && media === "image/png") return starts([137, 80, 78, 71, 13, 10, 26, 10]);
  if ((ext === "jpeg" || ext === "jpg") && media === "image/jpeg")
    return starts([255, 216, 255]) && b[b.length - 2] === 255 && b[b.length - 1] === 217;
  if (ext !== "txt" || media !== "text/plain") return false;
  try {
    const t = new TextDecoder("utf-8", { fatal: true }).decode(b);
    return (
      !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(t) && !/<(?:!doctype\s+html|html|script|svg)\b/i.test(t)
    );
  } catch {
    return false;
  }
}
const verified = (o: R2Object | null, size: number, media: string, digest: string) =>
  o &&
  o.size === size &&
  o.httpMetadata?.contentType === media &&
  o.customMetadata?.contentSha256 === digest &&
  o.checksums.sha256 &&
  "sha256-" + hex(o.checksums.sha256) === digest;
export async function receive(w: Client, req: Request) {
  const bad = checkMutation(req);
  if (bad) return bad;
  const grant = new URL(req.url).searchParams.get("grant"),
    id = req.headers.get("x-upload-id");
  if (!validId(grant) || !validId(id)) return invalid();
  if (await confirm(w, grant)) return missing();
  if (req.headers.get("x-portal-pilot") !== "confirmed")
    return json({ error: "Confirm that the file is synthetic or de-identified." }, 400);
  const bytes = await readBytes(req);
  if (!bytes) return json({ error: "Choose a nonempty file of 5 MB or less." }, 413);
  let name = "";
  try {
    name = decodeURIComponent(req.headers.get("x-file-name") || "").trim();
  } catch {
    return invalid();
  }
  const media = (req.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!validFile(name, media, bytes))
    return json(
      { error: "Choose a PDF, text, PNG or JPEG file with a matching filename and contents." },
      415,
    );
  const hash = await crypto.subtle.digest("SHA-256", bytes),
    digest = "sha256-" + hex(hash),
    size = bytes.length,
    allowed = permitted(w, grant);
  await w.db.run(
    sql`INSERT OR IGNORE INTO portal_uploads(id,grant_id,name,media,size,digest,state,stamp) SELECT ${id},${grant},${name},${media},${size},${digest},'pending',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE ${allowed} AND (SELECT COUNT(*) FROM portal_uploads WHERE grant_id=${grant})<100 AND (SELECT COALESCE(SUM(size),0) FROM portal_uploads WHERE grant_id=${grant})+${size}<=104857600`,
  );
  const match = sql`id=${id} AND grant_id=${grant} AND name=${name} AND media=${media} AND size=${size} AND digest=${digest} AND ${allowed}`;
  const row = await w.db.get<{ state: string }>(sql`SELECT state FROM portal_uploads WHERE ${match}`);
  if (!row)
    return (
      (await confirm(w, grant)) ||
      json(
        { error: "The upload could not be reserved. Check the portal capacity or choose the file again." },
        409,
      )
    );
  if (row.state !== "received") {
    const storage = bucket(),
      key = objectKey(grant, id);
    const obj =
      (await storage.put(key, bytes, {
        onlyIf: { etagDoesNotMatch: "*" },
        sha256: hash,
        httpMetadata: { contentType: media },
        customMetadata: { contentSha256: digest },
      })) || (await storage.head(key));
    if (!verified(obj, size, media, digest)) return unavailable();
    const stale = await confirm(w, grant);
    if (stale) return stale;
    await w.db.run(sql`UPDATE portal_uploads SET state='received' WHERE ${match} AND state='pending'`);
  }
  if (!(await w.db.get(sql`SELECT 1 FROM portal_uploads WHERE ${match} AND state='received'`)))
    return missing();
  return (await confirm(w, grant)) || json({ saved: true, id }, 201);
}
type FileRow = {
  key: string;
  media: string;
  size: number;
  digest: string;
  name: string;
  intent?: string;
  caseId?: string;
  version?: string;
};
export async function download(w: Who, req: Request) {
  const u = new URL(req.url),
    grant = u.searchParams.get("grant"),
    id = u.searchParams.get("item"),
    kind = u.searchParams.get("kind");
  if (!validId(grant) || !validId(id) || !["document", "upload"].includes(kind || "")) return missing();
  const query =
    kind === "upload"
      ? sql`SELECT '' AS key,u.media,u.size,u.digest,u.name FROM portal_uploads u JOIN portal_grants g ON g.id=u.grant_id WHERE g.id=${grant} AND u.id=${id} AND u.state='received' AND ${gate(w)}`
      : sql`SELECT v.binary_object_reference AS key,v.media_type AS media,v.byte_length AS size,v.content_sha256 AS digest,v.original_filename AS name,v.upload_intent_id AS intent,v.dossier_id AS caseId,v.id AS version FROM portal_entries e JOIN portal_grants g ON g.id=e.grant_id JOIN dossier_document_versions v ON v.dossier_id=g.case_id AND v.document_id=e.target AND v.id=e.detail->>'$.version' JOIN dossier_documents d ON d.dossier_id=v.dossier_id AND d.id=v.document_id AND d.is_provisional=0 WHERE g.id=${grant} AND e.id=${id} AND e.kind='document' AND (${shareState})='shared' AND ${gate(w)}`;
  const row = await w.db.get<FileRow>(query);
  if (!row) return missing();
  if (kind === "document") {
    const rule = decideDossierDownload({
      authenticated: true,
      authorized: true,
      resourceExists: true,
      documentVersionId: row.version,
      mediaType: row.media,
      byteLength: row.size,
      contentSha256: row.digest,
    });
    if (!rule.allowed) return unavailable();
    try {
      assertDossierObjectKeyScope(row.key, row.caseId, row.intent);
    } catch {
      return unavailable();
    }
  }
  const object = await bucket().get(kind === "upload" ? objectKey(grant, id) : row.key);
  if (!object) return unavailable();
  if (!verified(object, row.size, row.media, row.digest)) {
    await object.body.cancel();
    return unavailable();
  }
  const stale = await confirm(w, grant);
  if (stale || !(await w.db.get(query))) {
    await object.body.cancel();
    return stale || missing();
  }
  const name = encodeURIComponent(
    row.name.replace(/[\/\\\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "_"),
  ).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16));
  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "Content-Type": row.media,
      "Content-Length": String(row.size),
      "Content-Disposition": "attachment; filename*=UTF-8''" + name,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
