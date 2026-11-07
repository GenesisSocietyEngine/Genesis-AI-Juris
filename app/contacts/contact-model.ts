export type ContactKind = "person" | "company";
export type ContactStatus = "active" | "archived";
export const relationships = ["prospect", "client", "former_client", "professional"] as const;
export type Relationship = (typeof relationships)[number];
export type ContactProfile = {
  relationship: Relationship | "";
  kind: ContactKind;
  name: string;
  email: string;
  phone: string;
  group: string;
  companyId: string;
  website: string;
  address: string;
};
export type Contact = ContactProfile & {
  id: string;
  status: ContactStatus;
  revision: number;
  caseIds: string[];
};
export type ImportBatch = { key: string; count: number; at: string };
export const IMPORT_LIMIT = 25;
export const limits = {
  name: 160,
  email: 254,
  phone: 60,
  group: 80,
  companyId: 100,
  website: 500,
  address: 500,
};
export const blankContact = (kind: ContactKind): ContactProfile => ({
  kind,
  relationship: "",
  name: "",
  email: "",
  phone: "",
  group: "",
  companyId: "",
  website: "",
  address: "",
});
export const contactKey = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
export function contactProfile(raw: unknown): ContactProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("invalid");
  const input = raw as Record<string, unknown>;
  if (input.kind !== "person" && input.kind !== "company") throw Error("kind");
  const result = blankContact(input.kind);
  if (Object.keys(input).some((key) => !Object.hasOwn(result, key))) throw Error("invalid");
  for (const field of Object.keys(limits) as (keyof typeof limits)[]) {
    const value = input[field] ?? "";
    if (
      typeof value !== "string" ||
      value.trim().length > limits[field] ||
      /[\u0000-\u001f\u007f]/u.test(value)
    )
      throw Error("invalid");
    result[field] = value.trim();
  }
  const relationship = input.relationship ?? "";
  if (relationship !== "" && !relationships.includes(relationship as Relationship))
    throw Error("relationship");
  result.relationship = relationship as ContactProfile["relationship"];
  if (!result.name) throw Error("name");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(result.email)) throw Error("email");
  if (result.website) {
    try {
      const url = new URL(result.website);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error();
    } catch {
      throw Error("website");
    }
  }
  if (result.companyId && (result.kind !== "person" || !/^contact_[\w-]+$/.test(result.companyId)))
    throw Error("company");
  return result;
}
export const matchesContact = (a: ContactProfile, b: ContactProfile) =>
  (a.kind === b.kind && contactKey(a.name) === contactKey(b.name)) ||
  Boolean(a.email && b.email && contactKey(a.email) === contactKey(b.email));

export type ContactCommand =
  | { action: "create" | "edit"; profile: ContactProfile; id: string; revision: number; reviewed: string[] }
  | { action: "archive" | "restore"; id: string; revision: number }
  | { action: "link" | "unlink"; id: string; revision: number; caseId: string }
  | { action: "import"; profiles: ContactProfile[] }
  | { action: "undo"; batchKey: string };
