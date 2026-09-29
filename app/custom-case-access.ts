export type LicenseTier = "community" | "professional" | "enterprise";

export type CustomCaseAccessInput = {
  viewerEmail: string;
  ownerEmail: string;
  isPrivate: boolean;
  isAdmin: boolean;
  hasGrant: boolean;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeLicenseTier(value: unknown): LicenseTier {
  return value === "professional" || value === "enterprise" ? value : "community";
}

export function canViewCustomCase(input: CustomCaseAccessInput) {
  const viewer = normalizeEmail(input.viewerEmail);
  const owner = normalizeEmail(input.ownerEmail);
  if (viewer === owner) return true;
  if (input.isPrivate) return false;
  return input.isAdmin || input.hasGrant;
}

export function canShareCustomCase(input: CustomCaseAccessInput & { licenseTier: unknown; grantCanReshare: boolean }) {
  if (!canViewCustomCase(input) || input.isPrivate) return false;
  if (input.isAdmin) return true;
  const licensed = normalizeLicenseTier(input.licenseTier) !== "community";
  if (!licensed) return false;
  return normalizeEmail(input.viewerEmail) === normalizeEmail(input.ownerEmail) || (input.hasGrant && input.grantCanReshare);
}

export function customFeedbackAudience(input: CustomCaseAccessInput) {
  if (!canViewCustomCase(input)) return null;
  return input.isPrivate ? "owner_private" as const : "custom_case" as const;
}
