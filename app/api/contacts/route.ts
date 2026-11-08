import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import {
  firmContacts as contacts,
  firmContactCases as links,
  firmContactOperations as ops,
  dossierParticipants,
  organizationCasGuards,
} from "../../../db/schema";
import { canonicalDossierJson } from "../../dossier-contract";
import {
  canonicalDossierTimestamp,
  dossierJson,
  dossierSha256,
  isResponse,
  newDossierOpaqueId,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../dossier-server";
import { organizationDossierAccess, organizationSelectionToken } from "../../organization-store";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { firmAuthority, firmReply } from "../../firm-authority";
import {
  contactKey,
  contactProfile,
  IMPORT_LIMIT,
  matchesContact,
  type ContactCommand,
  type ContactProfile,
} from "../../contacts/contact-model";

export const dynamic = "force-dynamic";
const operationKey = /^[\w-]{8,120}$/;
const contactId = /^contact_[a-f0-9]{32}$/;
const pageSize = 50;
const problem = (code: string, status: number) => dossierJson({ code }, status);
const own = (c: DossierServerContext) =>
  and(eq(ops.organizationId, c.organization!.id), eq(ops.actorRef, c.actor.actorId));
async function operation(c: DossierServerContext, key: string) {
  return (
    await c.db
      .select()
      .from(ops)
      .where(and(own(c), eq(ops.operationKey, key)))
      .limit(1)
  )[0];
}
function receipt(c: DossierServerContext, row: typeof ops.$inferInsert) {
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    operationKey: row.operationKey,
    ids: JSON.parse(row.contactIds),
  });
}

export async function GET(request: Request) {
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const query = new URL(request.url).searchParams,
    scope = organizationSelectionToken(c.organization!);
  if (query.has("operation")) {
    const key = query.get("operation")!;
    if (!operationKey.test(key)) return problem("invalid", 400);
    const row = await operation(c, key);
    return row ? receipt(c, row) : firmReply(c, { scope, operationKey: key, ids: null });
  }
  const cursor = query.get("after") ?? "";
  if (cursor && !contactId.test(cursor)) return problem("invalid", 400);
  const rows = await c.db
    .select()
    .from(contacts)
    .where(and(eq(contacts.organizationId, c.organization!.id), cursor ? gt(contacts.id, cursor) : undefined))
    .orderBy(asc(contacts.id))
    .limit(pageSize + 1);
  const page = rows.slice(0, pageSize);
  const batches = cursor
    ? []
    : await c.db
        .select({
          key: ops.operationKey,
          count: sql<number>`json_array_length(${ops.contactIds})`,
          at: ops.occurredAt,
        })
        .from(ops)
        .where(
          and(
            own(c),
            eq(ops.action, "import"),
            sql`NOT EXISTS (SELECT 1 FROM firm_contact_operations u WHERE u.organization_id=${ops.organizationId} AND u.actor_ref=${ops.actorRef} AND u.reverses=${ops.operationKey})`,
          ),
        )
        .orderBy(desc(ops.occurredAt), desc(ops.operationKey))
        .limit(10);
  const denied = await firmAuthority(c);
  if (denied) return denied;
  // Last read projects only case links visible to this exact signed-in participant.
  const visible = page.length
    ? await c.db
        .select({ contactId: links.contactId, caseId: links.dossierId })
        .from(links)
        .innerJoin(
          dossierParticipants,
          and(
            eq(dossierParticipants.dossierId, links.dossierId),
            eq(dossierParticipants.actorId, c.actor.actorId),
            eq(dossierParticipants.userId, c.actor.userId),
            eq(dossierParticipants.status, "active"),
          ),
        )
        .where(
          and(
            eq(links.organizationId, c.organization!.id),
            inArray(
              links.contactId,
              page.map((r) => r.id),
            ),
          ),
        )
    : [];
  return firmReply(c, {
    scope,
    canWrite: c.organization!.role !== "auditor",
    contacts: page.map((row) => ({
      ...JSON.parse(row.profile),
      id: row.id,
      revision: row.revision,
      status: row.status,
      caseIds: visible.filter((link) => link.contactId === row.id).map((link) => link.caseId),
    })),
    batches,
    next: rows.length > pageSize ? page[page.length - 1].id : null,
  });
}

function parseCommand(body: Record<string, unknown>): ContactCommand {
  const action = body.action;
  const fields = (keys: string[]) => {
    if (Object.keys(body).some((k) => !["action", "operationKey", ...keys].includes(k)))
      throw Error("invalid");
  };
  if (action === "undo") {
    fields(["batchKey"]);
    if (typeof body.batchKey !== "string" || !operationKey.test(body.batchKey)) throw Error("invalid");
    return { action, batchKey: body.batchKey };
  }
  if (action === "import") {
    fields(["profiles"]);
    if (!Array.isArray(body.profiles) || !body.profiles.length || body.profiles.length > IMPORT_LIMIT)
      throw Error("csvRows");
    const profiles = body.profiles.map(contactProfile);
    if (
      profiles.some((p, i) => p.companyId || profiles.slice(0, i).some((other) => matchesContact(p, other)))
    )
      throw Error("duplicate");
    return { action, profiles };
  }
  const id = body.id,
    revision = body.revision;
  if (typeof id !== "string" || typeof revision !== "number" || !Number.isSafeInteger(revision))
    throw Error("invalid");
  if (action === "create" ? id !== "" || revision !== 0 : !contactId.test(id) || revision < 1)
    throw Error("invalid");
  if (action === "create" || action === "edit") {
    fields(["id", "revision", "profile", "reviewed"]);
    const reviewed = body.reviewed;
    if (!Array.isArray(reviewed) || reviewed.some((id) => typeof id !== "string" || !contactId.test(id)))
      throw Error("invalid");
    return { action, id, revision, profile: contactProfile(body.profile), reviewed };
  }
  if (action === "archive" || action === "restore") {
    fields(["id", "revision"]);
    return { action, id, revision };
  }
  if (action === "link" || action === "unlink") {
    fields(["id", "revision", "caseId"]);
    if (typeof body.caseId !== "string" || !/^[\w-]{1,120}$/.test(body.caseId)) throw Error("invalid");
    return { action, id, revision, caseId: body.caseId };
  }
  throw Error("invalid");
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return problem("origin", 403);
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const org = c.organization!;
  if (org.role === "auditor") return problem("readOnly", 403);
  const body = await readJsonObject(request, 131072),
    key = body?.operationKey;
  if (!body || typeof key !== "string" || !operationKey.test(key)) return problem("invalid", 400);
  let cmd: ContactCommand;
  try {
    cmd = parseCommand(body);
  } catch (e) {
    return problem(e instanceof Error ? e.message : "invalid", 400);
  }
  const digest = await dossierSha256(canonicalDossierJson(body));
  const prior = await operation(c, key);
  if ("caseId" in cmd) {
    const access = await organizationDossierAccess(c.db, c.actor, org, cmd.caseId);
    if (!access || !["owner", "contributor"].includes(access.participant.role))
      return problem("caseAccess", 403);
  }
  if (prior) return prior.requestDigest === digest ? receipt(c, prior) : problem("changed", 409);
  const db = c.db;
  const guard = (expression: SQL) =>
    db.insert(organizationCasGuards).values({ changed: sql`CASE WHEN ${expression} THEN 1 ELSE 0 END` });
  const changes: [...Parameters<typeof db.batch>[0]] = [db.delete(organizationCasGuards)];
  const ids: string[] = [];
  const addProfile = (profile: ContactProfile, id: string, reviewed: string[], revision: number) => {
    const name = contactKey(profile.name),
      email = contactKey(profile.email);
    changes.push(
      guard(sql`NOT EXISTS (SELECT 1 FROM firm_contacts WHERE organization_id=${org.id} AND id!=${id}
      AND ((kind=${profile.kind} AND name_key=${name}) OR (${email}!='' AND email_key=${email}))
      AND id NOT IN (SELECT value FROM json_each(${JSON.stringify(reviewed)})))`),
    );
    if (profile.companyId)
      changes.push(
        guard(sql`EXISTS (SELECT 1 FROM firm_contacts WHERE id=${profile.companyId} AND organization_id=${org.id} AND kind='company'
      AND (status='active' OR EXISTS (SELECT 1 FROM firm_contacts p WHERE p.id=${id} AND json_extract(p.profile,'$.companyId')=${profile.companyId})))`),
      );
    const fields = {
      kind: profile.kind,
      nameKey: name,
      emailKey: email,
      profile: JSON.stringify(profile),
      revision: revision + 1,
    };
    if (!revision)
      changes.push(db.insert(contacts).values({ ...fields, id, organizationId: org.id, status: "active" }));
    else {
      changes.push(
        db
          .update(contacts)
          .set({
            ...fields,
            // Older editors never sent a pipeline stage. Preserve the current one in the CAS update.
            profile:
              profile.relationship === "prospect" &&
              body.profile &&
              typeof body.profile === "object" &&
              !Object.hasOwn(body.profile, "leadStage")
                ? sql`json_set(${fields.profile},'$.leadStage',coalesce(json_extract(${contacts.profile},'$.leadStage'),''))`
                : fields.profile,
          })
          .where(
            and(
              eq(contacts.organizationId, org.id),
              eq(contacts.id, id),
              eq(contacts.kind, profile.kind),
              eq(contacts.revision, revision),
              eq(contacts.status, "active"),
            ),
          ),
      );
      changes.push(guard(sql`changes()=1`));
    }
    ids.push(id);
  };
  if (cmd.action === "import") {
    for (const profile of cmd.profiles) addProfile(profile, newDossierOpaqueId("contact"), [], 0);
  } else if (cmd.action === "create" || cmd.action === "edit") {
    addProfile(cmd.profile, cmd.id || newDossierOpaqueId("contact"), cmd.reviewed, cmd.revision);
  } else if (cmd.action === "undo") {
    const batch = await operation(c, cmd.batchKey);
    if (!batch || batch.action !== "import") return problem("batchMissing", 409);
    ids.push(...JSON.parse(batch.contactIds));
    changes.push(
      guard(sql`NOT EXISTS (SELECT 1 FROM firm_contacts p WHERE p.organization_id=${org.id}
      AND p.id NOT IN (SELECT value FROM json_each(${batch.contactIds}))
      AND json_extract(p.profile,'$.companyId') IN (SELECT value FROM json_each(${batch.contactIds})))`),
    );
    changes.push(
      db
        .update(contacts)
        .set({ status: "archived", revision: 2 })
        .where(
          and(
            eq(contacts.organizationId, org.id),
            inArray(contacts.id, ids),
            eq(contacts.status, "active"),
            eq(contacts.revision, 1),
          ),
        ),
    );
    changes.push(guard(sql`changes()=${ids.length}`));
  } else if ("id" in cmd) {
    changes.push(
      db
        .update(contacts)
        .set({ status: cmd.action === "archive" ? "archived" : "active", revision: cmd.revision + 1 })
        .where(
          and(
            eq(contacts.organizationId, org.id),
            eq(contacts.id, cmd.id),
            eq(contacts.revision, cmd.revision),
            eq(contacts.status, cmd.action === "restore" ? "archived" : "active"),
          ),
        ),
    );
    changes.push(guard(sql`changes()=1`));
    if ("caseId" in cmd) {
      changes.push(
        guard(
          sql`EXISTS (SELECT 1 FROM dossier_participants p JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id WHERE b.organization_id=${org.id} AND p.dossier_id=${cmd.caseId} AND p.user_id=${c.actor.userId} AND p.actor_id=${c.actor.actorId} AND p.status='active' AND p.role IN ('owner','contributor'))`,
        ),
      );
      if (cmd.action === "link")
        changes.push(
          db.insert(links).values({ organizationId: org.id, contactId: cmd.id, dossierId: cmd.caseId }),
        );
      else {
        changes.push(
          db
            .delete(links)
            .where(
              and(
                eq(links.organizationId, org.id),
                eq(links.contactId, cmd.id),
                eq(links.dossierId, cmd.caseId),
              ),
            ),
        );
        changes.push(guard(sql`changes()=1`));
      }
    }
    ids.push(cmd.id);
  }
  const row = {
    organizationId: org.id,
    actorRef: c.actor.actorId,
    operationKey: key,
    requestDigest: digest,
    action: cmd.action,
    contactIds: JSON.stringify(ids),
    reverses: cmd.action === "undo" ? cmd.batchKey : null,
    occurredAt: canonicalDossierTimestamp(),
  };
  changes.push(db.insert(ops).values(row), db.delete(organizationCasGuards));
  try {
    await db.batch(changes);
  } catch {
    const saved = await operation(c, key);
    if (saved && saved.requestDigest === digest) return receipt(c, saved);
    return (await firmAuthority(c)) ?? problem(cmd.action === "undo" ? "undoChanged" : "changed", 409);
  }
  return receipt(c, row);
}
