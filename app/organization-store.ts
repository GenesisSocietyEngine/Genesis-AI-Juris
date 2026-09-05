import { and, desc, eq, sql } from "drizzle-orm";
import type { DossierDb, DossierServerActor } from "./dossier-server";
import {
  dossierOrganizationBindings, dossierParticipants, dossiers, organizationInvitations,
  organizationLifecycleRequests, organizationMemberships, organizationSecurityEvents,
  organizations, organizationAuthorityChecks, organizationCasGuards,
} from "../db/schema";
import { canonicalJson, isOpaqueId, sha256Hex, transitionOrganizationLifecycle } from "./tenant-foundation";
import type { OrganizationRole } from "./tenant-foundation";

export const ORGANIZATION_COOKIE = "genesis_organization_v1";
export const ORGANIZATION_HEADER = "x-genesis-organization";
export type OrganizationActor = Pick<DossierServerActor, "userId" | "actorId">;
export type OrganizationAuthority = {
  id: string; name: string; kind: string; status: string; revision: number;
  membershipRevision: number; role: OrganizationRole; actorId: string;
};
export class OrganizationError extends Error {
  constructor(readonly code: string, readonly status = 404) { super(code); }
}
const unavailable = () => new OrganizationError("organization_unavailable");
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
export const personalOrganizationId = (actorId: string) => `org_personal_${actorId}`;

/** Only account identity comes from authentication. A cookie/header is a
 * selection hint, always rebound to current durable membership on every call. */
export function organizationSelection(headers: Headers, url?: string): string | null {
  const explicit = headers.get(ORGANIZATION_HEADER) ?? (url ? new URL(url).searchParams.get("organization") : null);
  if (explicit !== null) return explicit;
  const cookies = (headers.get("cookie") ?? "").split(";").map((part) => part.trim());
  const matching = cookies.filter((part) => part.startsWith(ORGANIZATION_COOKIE + "="));
  if (matching.length > 1) throw unavailable();
  return matching[0]?.slice(ORGANIZATION_COOKIE.length + 1) ?? null;
}
export function organizationSelectionToken(authority: OrganizationAuthority) {
  return `${authority.id}.${authority.revision}.${authority.membershipRevision}.${authority.actorId}`;
}

export async function ensurePersonalOrganization(db: DossierDb, actor: OrganizationActor) {
  const organizationId = personalOrganizationId(actor.actorId);
  // Never reactivate or overwrite an existing membership on sign-in.
  await db.batch([
    db.insert(organizations).values({ id: organizationId, name: "Personal workspace", kind: "personal",
      createdByActorId: actor.actorId, createdAt: now() }).onConflictDoNothing(),
    db.insert(organizationMemberships).values({ organizationId, ...actor, role: "org_owner", createdAt: now() }).onConflictDoNothing(),
  ]);
}

export async function listOrganizations(db: DossierDb, actor: OrganizationActor) {
  const rows = await db.select({ organization: organizations, membership: organizationMemberships })
    .from(organizations).innerJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
    .where(and(eq(organizationMemberships.userId, actor.userId), eq(organizationMemberships.actorId, actor.actorId),
      eq(organizationMemberships.status, "active"))).orderBy(organizations.createdAt, organizations.id).limit(100);
  return rows.map(({ organization: o, membership: m }): OrganizationAuthority => ({
    id: o.id, name: o.name, kind: o.kind, status: o.status, revision: o.revision,
    membershipRevision: m.revision, role: m.role as OrganizationRole, actorId: actor.actorId,
  }));
}

export async function resolveOrganization(db: DossierDb, actor: OrganizationActor, selection: string | null,
  allowInactive = false): Promise<OrganizationAuthority> {
  const parts = (selection ?? personalOrganizationId(actor.actorId)).split(".");
  if ((parts.length !== 1 && parts.length !== 4) || !isOpaqueId(parts[0])) throw unavailable();
  const [row] = await db.select({ organization: organizations, membership: organizationMemberships })
    .from(organizations).innerJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
    .where(and(eq(organizations.id, parts[0]), eq(organizationMemberships.userId, actor.userId),
      eq(organizationMemberships.actorId, actor.actorId), eq(organizationMemberships.status, "active"))).limit(1);
  if (!row || (!allowInactive && row.organization.status !== "active") || row.organization.status === "closed") throw unavailable();
  const { organization: o, membership: m } = row;
  if (parts.length === 4 && (parts[1] !== String(o.revision) || parts[2] !== String(m.revision) || parts[3] !== actor.actorId)) {
    throw new OrganizationError("organization_context_changed", 409);
  }
  return { id: o.id, name: o.name, kind: o.kind, status: o.status, revision: o.revision,
    membershipRevision: m.revision, role: m.role as OrganizationRole, actorId: actor.actorId };
}

export async function assertOrganizationCurrent(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority) {
  return resolveOrganization(db, actor, organizationSelectionToken(authority));
}

/** Fence every authoritative dossier batch inside its transaction, after any
 * slow object-store or AI work. Revocation/resumption cannot resurrect a captured
 * request. The proxy preserves the original result ordering for existing code. */
export function organizationScopedDb(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority): DossierDb {
  return new Proxy(db, {
    get(target, property) {
      if (property === "batch") return async (queries: Parameters<DossierDb["batch"]>[0]) => {
        const guard = db.insert(organizationAuthorityChecks).values({ valid: sql`
          CASE WHEN EXISTS (SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
          WHERE o.id=${authority.id} AND o.status='active' AND o.revision=${authority.revision}
          AND m.user_id=${actor.userId} AND m.actor_id=${actor.actorId} AND m.status='active' AND m.revision=${authority.membershipRevision})
          THEN 1 ELSE 0 END` });
        const result = await target.batch([guard, db.delete(organizationAuthorityChecks), ...queries]);
        return result.slice(2);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** The immutable dossier binding plus existing composite descendant FKs is the
 * validation-plane boundary. Org owners/admins never acquire dossier access. */
export async function organizationDossierAccess(db: DossierDb, actor: OrganizationActor,
  authority: OrganizationAuthority, dossierId: string) {
  await assertOrganizationCurrent(db, actor, authority);
  const [row] = await db.select({ dossier: dossiers, participant: dossierParticipants })
    .from(dossiers).innerJoin(dossierOrganizationBindings, and(
      eq(dossierOrganizationBindings.dossierId, dossiers.id), eq(dossierOrganizationBindings.organizationId, authority.id)))
    .innerJoin(dossierParticipants, and(eq(dossierParticipants.dossierId, dossiers.id),
      eq(dossierParticipants.userId, actor.userId), eq(dossierParticipants.actorId, actor.actorId),
      eq(dossierParticipants.status, "active"))).where(eq(dossiers.id, dossierId)).limit(1);
  return row ?? null;
}

export async function organizationMemberActive(db: DossierDb, organizationId: string, actorId: string) {
  const [row] = await db.select().from(organizationMemberships).where(and(
    eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.actorId, actorId),
    eq(organizationMemberships.status, "active"))).limit(1);
  return row ?? null;
}

async function securityEvent(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority,
  action: string, targetId: string) {
  const [last] = await db.select().from(organizationSecurityEvents)
    .where(eq(organizationSecurityEvents.organizationId, authority.id)).orderBy(desc(organizationSecurityEvents.sequence)).limit(1);
  const value = { id: id("org_event"), organizationId: authority.id, sequence: (last?.sequence ?? 0) + 1,
    actorId: actor.actorId, action, targetId, organizationRevision: authority.revision,
    membershipRevision: authority.membershipRevision, previousDigest: last?.digest ?? null, occurredAt: now() };
  return { ...value, digest: await sha256Hex(canonicalJson(value)) };
}

// A CHECK guard immediately after a conditional write makes a stale CAS abort
// the whole D1 batch. No success receipt or membership survives a lost race.
const casGuard = (db: DossierDb) => db.insert(organizationCasGuards).values({ changed: sql`changes()` });
const clearGuard = (db: DossierDb) => db.delete(organizationCasGuards);

export async function createOrganization(db: DossierDb, actor: OrganizationActor, name: unknown) {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120 || /[\u0000-\u001f]/u.test(name)) {
    throw new OrganizationError("organization_name_invalid", 400);
  }
  const owned = await db.select({ id: organizations.id }).from(organizations)
    .where(eq(organizations.createdByActorId, actor.actorId)).limit(21);
  if (owned.length >= 20) throw new OrganizationError("organization_limit", 409);
  const organizationId = id("org");
  const authority: OrganizationAuthority = { id: organizationId, name: name.trim(), kind: "team", status: "active", revision: 1,
    membershipRevision: 1, role: "org_owner", actorId: actor.actorId };
  const receipt = await securityEvent(db, actor, authority, "organization_created", organizationId);
  await db.batch([
    db.insert(organizations).values({ id: organizationId, name: name.trim(), createdByActorId: actor.actorId, createdAt: now() }),
    db.insert(organizationMemberships).values({ organizationId, ...actor, role: "org_owner", createdAt: now() }),
    db.insert(organizationSecurityEvents).values(receipt),
  ]);
  return authority;
}

export async function inviteOrganizationMember(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority,
  target: unknown, role: unknown) {
  await assertOrganizationCurrent(db, actor, authority);
  // Admin invitations require a separately recorded delegation in the frozen
  // policy. No ambient delegation is fabricated in this bounded pilot slice.
  if (authority.role !== "org_owner") throw unavailable();
  if (!isOpaqueId(target) || !["member", "org_admin", "auditor"].includes(String(role)) || target === actor.actorId) {
    throw new OrganizationError("invitation_fields_invalid", 400);
  }
  if (await organizationMemberActive(db, authority.id, target)) throw new OrganizationError("invitation_unavailable", 409);
  const token = `${id("invite")}${id("secret")}`;
  const invitation = { id: id("org_invite"), organizationId: authority.id, tokenDigest: await sha256Hex(token),
    recipientActorId: target, role: String(role), invitedByActorId: actor.actorId,
    inviterRevision: authority.membershipRevision, organizationRevision: authority.revision,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now() };
  await db.batch([db.insert(organizationInvitations).values(invitation),
    db.insert(organizationSecurityEvents).values(await securityEvent(db, actor, authority, "member_invited", invitation.id))]);
  // Raw token is returned once to the owner; it is never logged or persisted.
  return { id: invitation.id, token, expiresAt: invitation.expiresAt };
}

export async function acceptOrganizationInvitation(db: DossierDb, actor: OrganizationActor, token: unknown) {
  if (typeof token !== "string" || token.length < 40 || token.length > 200) throw unavailable();
  const [invitation] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.tokenDigest, await sha256Hex(token))).limit(1);
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= now() || invitation.recipientActorId !== actor.actorId) throw unavailable();
  const inviter = await organizationMemberActive(db, invitation.organizationId, invitation.invitedByActorId);
  if (!inviter || inviter.role !== "org_owner" || inviter.revision !== invitation.inviterRevision) throw unavailable();
  const authority = await resolveOrganization(db, { userId: inviter.userId, actorId: inviter.actorId }, invitation.organizationId);
  if (authority.revision !== invitation.organizationRevision) throw unavailable();
  const event = await securityEvent(db, actor, { ...authority, actorId: actor.actorId, membershipRevision: 1,
    role: invitation.role as OrganizationRole }, "invitation_accepted", invitation.id);
  try {
    await db.batch([
      db.update(organizationInvitations).set({ status: "accepted" }).where(and(eq(organizationInvitations.id, invitation.id),
        eq(organizationInvitations.status, "pending"), sql`${organizationInvitations.expiresAt} > ${now()}`)),
      casGuard(db),
      db.insert(organizationMemberships).values({ organizationId: authority.id, ...actor, role: invitation.role, createdAt: now() }),
      db.insert(organizationSecurityEvents).values(event), clearGuard(db),
    ]);
  } catch { throw unavailable(); }
  return resolveOrganization(db, actor, authority.id);
}

export async function changeOrganizationMember(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority,
  targetId: unknown, status: unknown, role: unknown, expectedRevision: unknown) {
  await assertOrganizationCurrent(db, actor, authority);
  if (authority.role !== "org_owner" || !isOpaqueId(targetId) || targetId === actor.actorId) throw unavailable();
  if (!["active", "suspended", "removed"].includes(String(status)) || !["member", "org_admin", "auditor"].includes(String(role)) || !Number.isSafeInteger(expectedRevision)) {
    throw new OrganizationError("membership_fields_invalid", 400);
  }
  const [member] = await db.select().from(organizationMemberships).where(and(
    eq(organizationMemberships.organizationId, authority.id), eq(organizationMemberships.actorId, targetId))).limit(1);
  if (!member || member.role === "org_owner" || member.status === "removed") throw unavailable();
  if (member.revision !== expectedRevision) throw new OrganizationError("membership_changed", 409);
  try {
    await db.batch([
      db.update(organizationMemberships).set({ status: String(status), role: String(role), revision: member.revision + 1 })
        .where(and(eq(organizationMemberships.organizationId, authority.id), eq(organizationMemberships.actorId, targetId), eq(organizationMemberships.revision, member.revision))),
      casGuard(db), db.insert(organizationSecurityEvents).values(await securityEvent(db, actor, authority, "membership_changed", targetId)), clearGuard(db),
    ]);
  } catch { throw new OrganizationError("membership_changed", 409); }
}

export async function requestOrganizationLifecycle(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority, command: unknown) {
  await resolveOrganization(db, actor, organizationSelectionToken(authority), true);
  if (authority.role !== "org_owner" || !["suspend", "resume", "close"].includes(String(command)) || authority.kind === "personal") throw unavailable();
  const request = { id: id("org_request"), organizationId: authority.id, command: String(command),
    requestedByActorId: actor.actorId, requesterRevision: authority.membershipRevision, organizationRevision: authority.revision,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now() };
  await db.batch([db.insert(organizationLifecycleRequests).values(request),
    db.insert(organizationSecurityEvents).values(await securityEvent(db, actor, authority, "lifecycle_requested", request.id))]);
  return { id: request.id };
}

export async function approveOrganizationLifecycle(db: DossierDb, actor: OrganizationActor, authority: OrganizationAuthority, requestId: unknown) {
  await resolveOrganization(db, actor, organizationSelectionToken(authority), true);
  if (!["org_owner", "org_admin"].includes(authority.role) || !isOpaqueId(requestId)) throw unavailable();
  const [request] = await db.select().from(organizationLifecycleRequests).where(and(eq(organizationLifecycleRequests.id, requestId),
    eq(organizationLifecycleRequests.organizationId, authority.id))).limit(1);
  if (!request || request.status !== "pending" || request.expiresAt <= now() || request.organizationRevision !== authority.revision) throw unavailable();
  const requester = await organizationMemberActive(db, authority.id, request.requestedByActorId);
  if (!requester || requester.role !== "org_owner" || requester.revision !== request.requesterRevision) throw unavailable();
  const transition = transitionOrganizationLifecycle({ status: authority.status as "active", command: request.command as "suspend",
    requestedByActorId: request.requestedByActorId, approvedByActorId: actor.actorId });
  if (!transition.ok) throw new OrganizationError(transition.code, 409);
  const receipt = await securityEvent(db, actor, authority, "lifecycle_approved", request.id);
  try {
    await db.batch([
      // The receipt validates the pre-transition authority, within the same transaction.
      db.insert(organizationSecurityEvents).values(receipt),
      db.update(organizationLifecycleRequests).set({ status: "approved", approvedByActorId: actor.actorId })
        .where(and(eq(organizationLifecycleRequests.id, request.id), eq(organizationLifecycleRequests.status, "pending"))),
      casGuard(db),
      db.update(organizations).set({ status: transition.status, revision: authority.revision + 1 })
        .where(and(eq(organizations.id, authority.id), eq(organizations.revision, authority.revision))),
      casGuard(db), clearGuard(db),
    ]);
  } catch { throw new OrganizationError("organization_context_changed", 409); }
}
