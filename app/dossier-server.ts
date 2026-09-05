import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  dossierAuditEvents,
  dossierParticipants,
  dossierRevisionReceipts,
  dossiers,
  users,
} from "../db/schema";
import {
  DOSSIER_AUDIT_EVENT_TYPES,
  DOSSIER_OBJECT_TYPES,
  canonicalDossierJson,
  type DossierObjectType,
  type DossierRole,
} from "./dossier-contract";
import {
  DOSSIER_TRUSTED_IDENTITY_SOURCE,
  authorizeDossierAction,
  parseDossierOpaqueId,
  type DossierAction,
} from "./dossier-security";
import { getChatGPTUser } from "./chatgpt-auth";
import { isPlatformAdmin } from "./server-authorization";
import { headers } from "next/headers";
import { ensurePersonalOrganization, organizationDossierAccess, organizationSelection, organizationScopedDb, resolveOrganization, OrganizationError,
  type OrganizationAuthority } from "./organization-store";

export type DossierDb = ReturnType<typeof getDb>;

export type DossierServerActor = {
  userId: number;
  actorId: string;
  displayName: string;
  email: string;
  platformAdmin: boolean;
};

export type DossierServerContext = {
  db: DossierDb;
  actor: DossierServerActor;
  organization?: OrganizationAuthority;
};

export type DossierAccess = {
  dossier: typeof dossiers.$inferSelect;
  participant: typeof dossierParticipants.$inferSelect;
  role: DossierRole;
};

export async function resolveDossierServerContext(request?: Request, options: { identityOnly?: boolean } = {}): Promise<DossierServerContext | Response> {
  const identity = await getChatGPTUser();
  if (!identity) return dossierJson({ error: "Sign in is required." }, 401);
  const email = identity.email.toLowerCase();
  const db = getDb();
  const [user] = await db.select({
    id: users.id,
    actorId: users.actorId,
    displayName: users.displayName,
  }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return dossierJson({
      error: "Complete your professional profile before creating or opening a Matter.",
      code: "profile_required",
    }, 403);
  }
  let actorId: string;
  try {
    actorId = parseDossierOpaqueId(user.actorId, "server actor ID");
  } catch {
    return dossierJson({ error: "The governed actor identity is unavailable.", code: "actor_identity_unavailable" }, 503);
  }
  const context: DossierServerContext = {
    db,
    actor: {
      userId: user.id,
      actorId,
      displayName: user.displayName,
      email,
      platformAdmin: isPlatformAdmin(identity),
    },
  };
  if (options.identityOnly) return context;
  try {
    await ensurePersonalOrganization(db, context.actor);
    const requestHeaders = request?.headers ?? new Headers(await headers());
    context.organization = await resolveOrganization(db, context.actor, organizationSelection(requestHeaders, request?.url));
    context.db = organizationScopedDb(db, context.actor, context.organization);
    return context;
  } catch (error) {
    return dossierJson({ error: "Choose an available organization to continue.",
      code: error instanceof OrganizationError ? error.code : "organization_service_unavailable" },
      error instanceof OrganizationError ? error.status : 503);
  }
}

/** Performs one joined participant lookup so unknown and unauthorized dossier
 * identifiers have the same private 404 response and timing shape. */
export async function requireDossierAccess(
  context: DossierServerContext,
  dossierIdValue: unknown,
  action: DossierAction,
): Promise<DossierAccess | Response> {
  let dossierId: string;
  try {
    dossierId = parseDossierOpaqueId(dossierIdValue, "dossier ID");
  } catch {
    return dossierNotFound();
  }
  if (!context.organization) return dossierNotFound();
  let record: Awaited<ReturnType<typeof organizationDossierAccess>>;
  try { record = await organizationDossierAccess(context.db, context.actor, context.organization, dossierId); }
  catch { return dossierNotFound(); }
  if (!record) return dossierNotFound();
  const decision = authorizeDossierAction({
    action,
    identity: {
      authenticated: true,
      source: DOSSIER_TRUSTED_IDENTITY_SOURCE,
      actorId: context.actor.actorId,
    },
    dossier: {
      dossierId: record.dossier.id,
      ownerActorId: record.dossier.ownerActorId,
    },
    participant: {
      dossierId: record.participant.dossierId,
      actorId: record.participant.actorId,
      role: record.participant.role,
      status: record.participant.status,
    },
  });
  if (!decision.allowed || !isDossierRole(decision.effectiveRole)) return dossierNotFound();
  return { ...record, role: decision.effectiveRole };
}

export function dossierNotFound() {
  return dossierJson({ error: "Matter not found." }, 404);
}

export function dossierJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function newDossierOpaqueId(prefix: string): string {
  if (!/^[a-z][a-z0-9_]{1,24}$/u.test(prefix)) throw new Error("Invalid dossier ID prefix.");
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function dossierSha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput.buffer));
  return `sha256-${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function canonicalDossierTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function boundedDossierText(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== "string" || value.includes("\u0000")) throw new Error(`${label} is invalid.`);
  const clean = value.trim();
  if (clean.length < minimum || clean.length > maximum) throw new Error(`${label} is invalid.`);
  return clean;
}

export function optionalDossierText(value: unknown, label: string, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return boundedDossierText(value, label, 1, maximum);
}

export function dossierStringList(value: unknown, label: string, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${label} is invalid.`);
  const items = value.map((item) => boundedDossierText(item, label, 1, maximumLength));
  if (new Set(items).size !== items.length) throw new Error(`${label} contains duplicates.`);
  return items;
}

export function dossierEnum<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) throw new Error(`${label} is invalid.`);
  return value as T[number];
}

export function expectedDossierRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error("A positive expected dossier revision is required.");
  return value as number;
}

export type DossierAuditEventInput = {
  actorRole: DossierRole | "platform_admin" | "system" | "import";
  eventType: (typeof DOSSIER_AUDIT_EVENT_TYPES)[number];
  objectRefType: DossierObjectType;
  objectRefId: string;
  summaryCode: string;
  detail?: unknown;
  occurredAt?: string;
};

export type DossierRevisionAuditBatch = {
  revisionReceipt: typeof dossierRevisionReceipts.$inferInsert;
  auditEvents: Array<typeof dossierAuditEvents.$inferInsert>;
};

/** Prepares the one immutable CAS receipt required by a revision-changing
 * transaction together with every chained audit event for that revision.
 * Callers must order their D1 batch as: guarded dossier revision update,
 * domain writes and output-staleness/status-transition consequences, audit
 * inserts, then the receipt insert last. Status transitions are inserted before
 * the guarded dossier status update so the database can bind the exact edge. */
export async function prepareDossierRevisionAuditBatch(
  context: DossierServerContext,
  dossierId: string,
  resultingRevision: number,
  inputs: readonly DossierAuditEventInput[],
): Promise<DossierRevisionAuditBatch> {
  const auditEvents = await prepareDossierAuditEvents(
    context,
    dossierId,
    resultingRevision,
    inputs,
  );
  return {
    revisionReceipt: {
      dossierId: parseDossierOpaqueId(dossierId, "revision-receipt dossier ID"),
      resultingRevision,
      createdByActorRef: context.actor.actorId,
      createdAt: canonicalDossierTimestamp(),
    },
    auditEvents,
  };
}

export async function prepareDossierAuditEvent(
  context: DossierServerContext,
  input: DossierAuditEventInput & { dossierId: string; dossierRevision: number },
): Promise<typeof dossierAuditEvents.$inferInsert> {
  const [event] = await prepareDossierAuditEvents(
    context,
    input.dossierId,
    input.dossierRevision,
    [input],
  );
  if (!event) throw new Error("A dossier audit event is required.");
  return event;
}

export async function prepareDossierAuditEvents(
  context: DossierServerContext,
  dossierIdValue: string,
  dossierRevisionValue: number,
  inputs: readonly DossierAuditEventInput[],
): Promise<Array<typeof dossierAuditEvents.$inferInsert>> {
  const dossierId = parseDossierOpaqueId(dossierIdValue, "audit dossier ID");
  if (!Number.isSafeInteger(dossierRevisionValue) || dossierRevisionValue < 1) {
    throw new Error("The dossier audit revision is invalid.");
  }
  const dossierRevision = dossierRevisionValue;
  if (inputs.length === 0 || inputs.length > 1_000) throw new Error("The dossier audit batch is invalid.");
  let [previous] = await context.db.select({
    id: dossierAuditEvents.id,
    sequence: dossierAuditEvents.sequence,
    eventDigest: dossierAuditEvents.eventDigest,
  }).from(dossierAuditEvents).where(eq(dossierAuditEvents.dossierId, dossierId))
    .orderBy(desc(dossierAuditEvents.sequence)).limit(1);
  const events: Array<typeof dossierAuditEvents.$inferInsert> = [];
  for (const input of inputs) {
    const objectRefId = parseDossierOpaqueId(input.objectRefId, "audit object ID");
    if (!DOSSIER_AUDIT_EVENT_TYPES.includes(input.eventType)) throw new Error("Unknown dossier audit event type.");
    if (!DOSSIER_OBJECT_TYPES.includes(input.objectRefType)) throw new Error("Unknown dossier audit object type.");
    const summaryCode = boundedDossierText(input.summaryCode, "audit summary code", 1, 120);
    if (!/^[A-Z][A-Z0-9_]{0,119}$/u.test(summaryCode)) throw new Error("Audit summary code is invalid.");
    const occurredAt = input.occurredAt ?? canonicalDossierTimestamp();
    if (new Date(occurredAt).toISOString() !== occurredAt) throw new Error("Audit timestamp is invalid.");
    const id = newDossierOpaqueId("audit");
    const detail = JSON.parse(canonicalDossierJson(input.detail ?? {})) as unknown;
    const sequence = (previous?.sequence ?? 0) + 1;
    const eventDigest = await dossierSha256(canonicalDossierJson({
      schema_version: 1,
      dossier_id: dossierId,
      dossier_revision: dossierRevision,
      sequence,
      event_type: input.eventType,
      object_ref_type: input.objectRefType,
      object_ref_id: objectRefId,
      actor_id: context.actor.actorId,
      actor_role: input.actorRole,
      occurred_at: occurredAt,
      summary_code: summaryCode,
      detail,
      previous_event_id: previous?.id ?? null,
      previous_event_digest: previous?.eventDigest ?? null,
    }));
    const event = {
      id,
      dossierId,
      dossierRevision,
      sequence,
      eventType: input.eventType,
      objectRefType: input.objectRefType,
      objectRefId,
      actorUserId: context.actor.userId,
      actorRef: context.actor.actorId,
      actorRole: input.actorRole,
      occurredAt,
      summaryCode,
      detail,
      previousEventId: previous?.id ?? null,
      eventDigest,
    } satisfies typeof dossierAuditEvents.$inferInsert;
    events.push(event);
    previous = { id, sequence, eventDigest };
  }
  return events;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function isDossierRole(value: unknown): value is DossierRole {
  return value === "owner" || value === "contributor" || value === "reviewer" || value === "viewer";
}
