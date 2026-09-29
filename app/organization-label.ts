import type { ClientOrganization } from "./organization-client";

/** Presentation only: use the authorized membership list, never infer authority from a label. */
export function organizationDisplayLabel(organization: ClientOrganization, peers: ClientOrganization[], locale: "en" | "ru") {
  const en = locale === "en";
  const base = (o: ClientOrganization) => {
    const role = ({org_owner: en ? "Owner" : "Владелец", org_admin: en ? "Administrator" : "Администратор", member: en ? "Member" : "Участник", auditor: en ? "Auditor" : "Аудитор"} as Record<string, string>)[o.role] ?? o.role;
    const relationship = o.kind === "personal" ? (o.id === `org_personal_${o.actorId}` ? (en ? "Your workspace" : "Ваше пространство") : (en ? "Shared workspace" : "Общее пространство")) : "";
    return [o.name, relationship, role].filter(Boolean).join(" · ");
  };
  const label = base(organization);
  const duplicates = peers.filter(o => o.id !== organization.id && base(o) === label);
  if (!duplicates.length) return label;
  let length = 6;
  while (length < organization.id.length && duplicates.some(o => o.id.slice(-length) === organization.id.slice(-length))) length++;
  return `${label} · ${organization.id.slice(-length)}`;
}
