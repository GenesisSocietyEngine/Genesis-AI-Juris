import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { emailInvitations as invitations, invitationMailboxProofs as proofs, organizationMemberships as memberships, organizationCasGuards, organizationAuthorityChecks, organizationSecurityEvents, users } from "../db/schema";
import type { DossierDb, DossierServerActor } from "./dossier-server";
import { generateSessionToken, normalizeEmail } from "./auth-crypto";
import { sha256Hex } from "./tenant-foundation";
import { assertOrganizationCurrent, OrganizationError, organizationSelectionToken, resolveOrganization, securityEvent, type OrganizationAuthority } from "./organization-store";
import { sendInvitationMail } from "./invitation-mail";

type Actor = DossierServerActor;
type Invitation = typeof invitations.$inferSelect;
const now = () => new Date().toISOString();
const id = () => `email_inv_${crypto.randomUUID().replaceAll("-", "")}`;
const unavailable = () => new OrganizationError("invitation_unavailable", 404);
const cas = (db: DossierDb) => db.insert(organizationCasGuards).values({ changed: sql`changes()` });
const clear = (db: DossierDb) => db.delete(organizationCasGuards);
const validToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const currentAuthority = (i: Invitation) => sql`EXISTS (SELECT 1 FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
  WHERE o.id=${i.organizationId} AND o.status='active' AND o.revision=${i.organizationRevision}
  AND m.actor_id=${i.invitedByActorId} AND m.status='active' AND m.role='org_owner' AND m.revision=${i.inviterRevision})`;
const currentIdentity = (a: Actor) => sql`EXISTS (SELECT 1 FROM users WHERE id=${a.userId} AND actor_id=${a.actorId} AND email=${a.email})`;

export async function emailInvitationRecipient(db: DossierDb, actor: Actor, authority: OrganizationAuthority, invitationId: unknown) {
  await owner(db, actor, authority);
  const [row] = await db.select({ email: invitations.recipientEmail }).from(invitations).where(and(eq(invitations.id, String(invitationId)), eq(invitations.organizationId, authority.id))).limit(1);
  if (!row) throw unavailable();
  return row.email;
}

export async function listEmailInvitations(db: DossierDb, authority: OrganizationAuthority) {
  const rows = await db.select({ id: invitations.id, recipientEmail: invitations.recipientEmail, role: invitations.role, status: invitations.status,
    expiresAt: invitations.expiresAt, delivery: invitations.delivery, createdAt: invitations.createdAt }).from(invitations)
    .where(eq(invitations.organizationId, authority.id)).orderBy(desc(invitations.createdAt)).limit(100);
  return rows.map(i => ({ ...i, status: i.status === "pending" && i.expiresAt <= now() ? "expired" : i.status }));
}

async function owner(db: DossierDb, actor: Actor, authority: OrganizationAuthority) {
  await assertOrganizationCurrent(db, actor, authority);
  if (authority.role !== "org_owner") throw unavailable();
}
async function existingMember(db: DossierDb, organizationId: string, email: string) {
  const [member] = await db.select({ status: memberships.status }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, organizationId), eq(users.email, email))).limit(1);
  if (member) throw new OrganizationError(member.status === "active" ? "invitation_member_exists" : member.status === "suspended" ? "invitation_member_suspended" : "invitation_member_removed", 409);
}

/** No global user lookup: unknown and existing nonmember addresses have identical results. */
export async function createEmailInvitation(db: DossierDb, actor: Actor, authority: OrganizationAuthority,
  input: { recipientEmail?: unknown; role?: unknown; replacementId?: unknown }, origin: string) {
  await owner(db, actor, authority);
  let previous: Invitation | undefined;
  if (input.replacementId) {
    [previous] = await db.select().from(invitations).where(and(eq(invitations.id, String(input.replacementId)), eq(invitations.organizationId, authority.id))).limit(1);
    if (!previous || previous.status !== "pending") throw unavailable();
  }
  const email = normalizeEmail(previous?.recipientEmail ?? input.recipientEmail);
  const role = previous?.role ?? input.role;
  if (!email || !["member", "org_admin", "auditor"].includes(String(role))) throw new OrganizationError("invitation_email_invalid", 400);
  await existingMember(db, authority.id, email);
  const [pending] = await db.select().from(invitations).where(and(eq(invitations.organizationId, authority.id), eq(invitations.recipientEmail, email), eq(invitations.status, "pending"))).limit(1);
  if (pending && !previous) throw new OrganizationError("invitation_pending_exists", 409);
  const token = generateSessionToken();
  const row: Invitation = { id: id(), organizationId: authority.id, recipientEmail: email, role: String(role), origin,
    tokenDigest: await sha256Hex(token), invitedByActorId: actor.actorId, inviterRevision: authority.membershipRevision,
    organizationRevision: authority.revision, status: "pending", delivery: "unknown", expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now(),
    acceptedByActorId: null, acceptedByUserId: null, acceptedAt: null };
  const event = await securityEvent(db, actor, authority, previous ? "email_invitation_resent" : "email_invitation_created", row.id);
  try {
    await db.batch([
      db.insert(organizationAuthorityChecks).values({ valid: sql`CASE WHEN ${currentAuthority(row)} AND ${currentIdentity(actor)} THEN 1 ELSE 0 END` }),
      db.delete(organizationAuthorityChecks),
      ...(previous ? [db.update(invitations).set({ status: "superseded" }).where(and(eq(invitations.id, previous.id), eq(invitations.status, "pending"))), cas(db)] : []),
      db.insert(invitations).values(row), db.insert(organizationSecurityEvents).values(event), clear(db),
    ]);
  } catch { throw new OrganizationError("invitation_changed", 409); }
  const delivery = await sendInvitationMail({ to: email, organization: authority.name, role: row.role, token, origin, attemptId: row.id });
  await db.update(invitations).set({ delivery }).where(eq(invitations.id, row.id));
  // Check authority again before revealing the share credential after slow transport.
  await owner(db, actor, authority);
  return { id: row.id, token, expiresAt: row.expiresAt, delivery, status: "pending" as const };
}

export async function revokeEmailInvitation(db: DossierDb, actor: Actor, authority: OrganizationAuthority, invitationId: unknown) {
  await owner(db, actor, authority);
  const [row] = await db.select().from(invitations).where(and(eq(invitations.id, String(invitationId)), eq(invitations.organizationId, authority.id))).limit(1);
  if (!row || !["pending", "revoked"].includes(row.status)) throw unavailable();
  if (row.status === "revoked") return;
  await db.batch([
    db.update(invitations).set({ status: "revoked" }).where(and(eq(invitations.id, row.id), eq(invitations.status, "pending"))), cas(db),
    db.insert(organizationSecurityEvents).values(await securityEvent(db, actor, authority, "email_invitation_revoked", row.id)), clear(db),
  ]);
}

async function recipientInvitation(db: DossierDb, actor: Actor, token: unknown, origin: string) {
  if (!validToken(token)) throw unavailable();
  const [row] = await db.select().from(invitations).where(and(eq(invitations.tokenDigest, await sha256Hex(token)), eq(invitations.recipientEmail, actor.email), eq(invitations.origin, origin))).limit(1);
  if (!row || !["pending", "accepted"].includes(row.status)) throw unavailable();
  if (row.status === "accepted") {
    if (row.acceptedByUserId !== actor.userId || row.acceptedByActorId !== actor.actorId) throw unavailable();
    return { row, authority: await resolveOrganization(db, actor, row.organizationId) };
  }
  if (row.expiresAt <= now()) throw unavailable();
  const [inviter] = await db.select().from(memberships).where(and(eq(memberships.organizationId, row.organizationId), eq(memberships.actorId, row.invitedByActorId))).limit(1);
  if (!inviter || inviter.status !== "active" || inviter.role !== "org_owner" || inviter.revision !== row.inviterRevision) throw unavailable();
  const authority = await resolveOrganization(db, { userId: inviter.userId, actorId: inviter.actorId }, row.organizationId);
  if (authority.revision !== row.organizationRevision) throw unavailable();
  return { row, authority };
}

export async function previewEmailInvitation(db: DossierDb, actor: Actor, token: unknown, origin: string) {
  const { row, authority } = await recipientInvitation(db, actor, token, origin);
  return { organizationId: row.organizationId, organizationName: authority.name, role: row.status === "accepted" ? authority.role : row.role, recipientEmail: row.recipientEmail, expiresAt: row.expiresAt, status: row.status,
    ...(row.status === "accepted" ? { selection: organizationSelectionToken(authority) } : {}) };
}

export async function requestInvitationMailboxProof(db: DossierDb, actor: Actor, token: unknown, origin: string) {
  const { row, authority } = await recipientInvitation(db, actor, token, origin);
  if (row.status !== "pending") throw unavailable();
  const proof = generateSessionToken();
  const proofId = id();
  await db.batch([
    db.insert(organizationAuthorityChecks).values({ valid: sql`CASE WHEN ${currentAuthority(row)} AND ${currentIdentity(actor)} AND EXISTS (SELECT 1 FROM email_invitations WHERE id=${row.id} AND status='pending' AND expires_at>${now()}) THEN 1 ELSE 0 END` }),
    db.delete(organizationAuthorityChecks),
    db.delete(proofs).where(and(eq(proofs.invitationId, row.id), eq(proofs.userId, actor.userId))),
    db.insert(proofs).values({ id: proofId, invitationId: row.id, userId: actor.userId, actorId: actor.actorId, email: actor.email,
      tokenDigest: await sha256Hex(proof), expiresAt: new Date(Date.now() + 900_000).toISOString() }),
  ]);
  const delivery = await sendInvitationMail({ to: row.recipientEmail, organization: authority.name, role: row.role, token: token as string, proof, origin, attemptId: proofId });
  // Proof never returns to either inviter or requesting browser: mailbox only.
  return { delivery };
}

export async function acceptEmailInvitation(db: DossierDb, actor: Actor, token: unknown, proof: unknown, organizationId: unknown, origin: string) {
  const { row, authority } = await recipientInvitation(db, actor, token, origin);
  if (organizationId !== row.organizationId || !validToken(proof)) throw unavailable();
  const proofHash = await sha256Hex(proof);
  const [mailbox] = await db.select().from(proofs).where(and(eq(proofs.invitationId, row.id), eq(proofs.tokenDigest, proofHash),
    eq(proofs.userId, actor.userId), eq(proofs.actorId, actor.actorId), eq(proofs.email, actor.email))).limit(1);
  if (!mailbox) throw new OrganizationError("invitation_verification_required", 403);
  async function acceptedReceipt() {
    const [current] = await db.select().from(invitations).where(eq(invitations.id, row.id)).limit(1);
    if (current?.status !== "accepted" || current.acceptedByActorId !== actor.actorId || current.acceptedByUserId !== actor.userId) throw unavailable();
    return resolveOrganization(db, actor, row.organizationId);
  }
  if (row.status === "accepted") return acceptedReceipt();
  if (mailbox.usedAt) return acceptedReceipt();
  if (mailbox.expiresAt <= now()) throw new OrganizationError("invitation_verification_required", 403);
  try { await existingMember(db, row.organizationId, actor.email); }
  catch (error) { try { return await acceptedReceipt(); } catch { throw error; } }
  const acceptedAt = now();
  const event = await securityEvent(db, actor, { ...authority, actorId: actor.actorId, membershipRevision: 1, role: row.role as OrganizationAuthority["role"] }, "email_invitation_accepted", row.id);
  try {
    await db.batch([
      db.update(proofs).set({ usedAt: acceptedAt }).where(and(eq(proofs.id, mailbox.id), isNull(proofs.usedAt), sql`${proofs.expiresAt}>strftime('%Y-%m-%dT%H:%M:%fZ','now')`)), cas(db),
      db.update(invitations).set({ status: "accepted", acceptedByActorId: actor.actorId, acceptedByUserId: actor.userId, acceptedAt }).where(and(
        eq(invitations.id, row.id), eq(invitations.status, "pending"), sql`${invitations.expiresAt}>${acceptedAt}`, currentAuthority(row), currentIdentity(actor))), cas(db),
      db.insert(memberships).values({ organizationId: row.organizationId, userId: actor.userId, actorId: actor.actorId, role: row.role, createdAt: acceptedAt }),
      db.insert(organizationSecurityEvents).values(event), clear(db),
    ]);
  } catch { return acceptedReceipt(); }
  return acceptedReceipt();
}
