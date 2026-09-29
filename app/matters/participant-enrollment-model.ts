import type { ParticipantItem } from "./matter-view-model";

export type EnrollmentMember = { actorId: string; name: string; active: boolean };
export type EnrollmentRoster = {
  status: "loading" | "unavailable" | "restricted" | "ready";
  members: EnrollmentMember[];
  limited: boolean;
};
export const unavailableEnrollmentRoster = (): EnrollmentRoster => ({ status: "unavailable", members: [], limited: false });
const directoryRoles = new Set(["org_owner", "org_admin", "auditor"]);
const opaqueId = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/u;
const nameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");

/** Use only the existing authorized organization response; never resolve a
 * person by name/email or infer directory rights from case ownership. */
export function enrollmentRoster(payload: unknown): EnrollmentRoster {
  if (!payload || typeof payload !== "object") return unavailableEnrollmentRoster();
  const value = payload as Record<string, unknown>;
  const selected = value.selected as Record<string, unknown> | null;
  if (!selected || selected.status !== "active") return unavailableEnrollmentRoster();
  if (!directoryRoles.has(String(selected.role))) return { status: "restricted", members: [], limited: false };
  if (!Array.isArray(value.members) || value.members.length > 100) return unavailableEnrollmentRoster();
  const members: EnrollmentMember[] = [];
  const ids = new Set<string>();
  for (const item of value.members) {
    if (!item || typeof item !== "object") return unavailableEnrollmentRoster();
    const row = item as Record<string, unknown>;
    if (typeof row.actorId !== "string" || !opaqueId.test(row.actorId) || ids.has(row.actorId)
      || typeof row.name !== "string" || !["active", "suspended", "removed"].includes(String(row.status))) return unavailableEnrollmentRoster();
    ids.add(row.actorId);
    members.push({ actorId: row.actorId, name: row.name.trim(), active: row.status === "active" });
  }
  return { status: "ready", members, limited: value.members.length === 100 };
}

export function enrollmentChoices(roster: EnrollmentRoster, participants: readonly Pick<ParticipantItem, "actorId">[]) {
  if (roster.status !== "ready") return { choices: [] as EnrollmentMember[], ambiguous: false };
  const existing = new Set(participants.map(participant => participant.actorId));
  const counts = new Map<string, number>();
  // Include ineligible namesakes: removing them must not imply unique identity.
  for (const member of roster.members) counts.set(nameKey(member.name), (counts.get(nameKey(member.name)) ?? 0) + 1);
  const eligible = roster.members.filter(member => member.active && !existing.has(member.actorId));
  const safeName = (member: EnrollmentMember) => Boolean(nameKey(member.name)) && counts.get(nameKey(member.name)) === 1;
  return { choices: eligible.filter(safeName), ambiguous: eligible.some(member => !safeName(member)) };
}

export function memberIdIssue(value: string): "email" | "invalid" | null {
  return value.includes("@") ? "email" : opaqueId.test(value.trim()) ? null : "invalid";
}
