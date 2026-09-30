import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { caseDrafts, caseVersions, customCases, platformSecrets } from "../db/schema";
import { legacyCaseProtectionCode, normalizeStoredCaseProtection, verifyCaseProtection, type CaseProtectionBinding } from "./case-protection";
import type { CaseProtectionV1 } from "./types";
import { parsePreservedJson } from "./preserved-json";
import { readStudioAggregate } from "./studio-aggregate";

const CASE_PROTECTION_SECRET_ID = "case-lineage-hmac-v1";

type Database = ReturnType<typeof getDb>;

export type StoredCaseArtifact = {
  source: "custom" | "published";
  customCaseId: number | null;
  ownerEmail: string | null;
  caseId: string;
  version: string;
  studioFingerprint: string;
  parentCaseId: string | null;
  parentVersion: string | null;
  parentFingerprint: string | null;
  protection: CaseProtectionV1 | null;
  currentCode: string;
  copyProtected: boolean;
  /** Exact authoritative SQL TEXT, retained through asynchronous guards. */
  payloadText: string;
  taxAnalysis: unknown;
  editable: boolean;
};

export class CaseProtectionIntegrityError extends Error {}

export async function getOrCreateCaseProtectionKey(db: Database) {
  const [existing] = await db.select({ secret: platformSecrets.secret }).from(platformSecrets).where(eq(platformSecrets.id, CASE_PROTECTION_SECRET_ID)).limit(1);
  if (existing) return decodeSecret(existing.secret);

  const generated = new Uint8Array(32);
  crypto.getRandomValues(generated);
  await db.insert(platformSecrets).values({ id: CASE_PROTECTION_SECRET_ID, secret: encodeSecret(generated) }).onConflictDoNothing();
  const [stored] = await db.select({ secret: platformSecrets.secret }).from(platformSecrets).where(eq(platformSecrets.id, CASE_PROTECTION_SECRET_ID)).limit(1);
  if (!stored) throw new CaseProtectionIntegrityError("The case-protection signing key could not be provisioned.");
  return decodeSecret(stored.secret);
}

export async function resolveExactCaseArtifact(
  db: Database,
  input: { caseId: string; version: string; fingerprint: string; preferredCustomCaseId?: number | null },
  key: Uint8Array,
): Promise<StoredCaseArtifact | null> {
  if (input.preferredCustomCaseId) {
    const preferred = await exactCustomArtifact(db, input, input.preferredCustomCaseId);
    return preferred ? verifyArtifact(preferred, key) : null;
  }

  const [published] = await db.select({
    customCaseId: caseVersions.sourceCustomCaseId,
    caseId: caseVersions.caseId,
    version: caseVersions.version,
    playableFingerprint: caseVersions.fingerprint,
    studioFingerprint: caseVersions.studioFingerprint,
    parentCaseId: caseVersions.parentCaseId,
    parentVersion: caseVersions.parentVersion,
    parentFingerprint: caseVersions.parentFingerprint,
    payload: sql<string>`cast(${caseVersions.payload} as text)`,
  }).from(caseVersions).where(and(
    eq(caseVersions.caseId, input.caseId),
    eq(caseVersions.version, input.version),
    or(eq(caseVersions.studioFingerprint, input.fingerprint), eq(caseVersions.fingerprint, input.fingerprint)),
    isNotNull(caseVersions.publishedAt),
  )).limit(1);
  if (published) {
    const authoritativeFingerprint = published.studioFingerprint ?? published.playableFingerprint;
    if (authoritativeFingerprint !== input.fingerprint) throw new CaseProtectionIntegrityError("Published lineage must reference its Studio fingerprint.");
    return verifyArtifact({
      source: "published",
      customCaseId: published.customCaseId,
      ownerEmail: null,
      caseId: published.caseId,
      version: published.version,
      studioFingerprint: authoritativeFingerprint,
      parentCaseId: published.parentCaseId,
      parentVersion: published.parentVersion,
      parentFingerprint: published.parentFingerprint,
      payload: published.payload,
    }, key);
  }

  const custom = await exactCustomArtifact(db, input, null);
  return custom ? verifyArtifact(custom, key) : null;
}

async function exactCustomArtifact(
  db: Database,
  input: { caseId: string; version: string; fingerprint: string },
  customCaseId: number | null,
) {
  const conditions = [
    eq(caseDrafts.caseId, input.caseId),
    eq(caseDrafts.version, input.version),
    eq(caseDrafts.fingerprint, input.fingerprint),
  ];
  if (customCaseId !== null) conditions.push(eq(caseDrafts.customCaseId, customCaseId));
  const records = await db.select({
    customCaseId: caseDrafts.customCaseId,
    ownerEmail: customCases.ownerEmail,
    caseId: caseDrafts.caseId,
    version: caseDrafts.version,
    studioFingerprint: caseDrafts.fingerprint,
    payload: sql<string>`cast(${caseDrafts.payload} as text)`,
  }).from(caseDrafts).leftJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(and(...conditions)).orderBy(desc(caseDrafts.updatedAt)).limit(2);
  if (!records.length) return null;
  if (customCaseId === null && records.length > 1) {
    throw new CaseProtectionIntegrityError("The custom case artifact identity is ambiguous; an exact workspace envelope is required.");
  }
  const record = records[0];
  const parent = draftParent(readStoredCasePayload(record.payload));
  return {
    source: "custom" as const,
    customCaseId: record.customCaseId,
    ownerEmail: record.ownerEmail,
    caseId: record.caseId,
    version: record.version,
    studioFingerprint: record.studioFingerprint,
    parentCaseId: parent?.caseId ?? null,
    parentVersion: parent?.version ?? null,
    parentFingerprint: parent?.fingerprint ?? null,
    payload: record.payload,
  };
}

async function verifyArtifact(
  artifact: {
    source: "custom" | "published";
    customCaseId: number | null;
    ownerEmail: string | null;
    caseId: string;
    version: string;
    studioFingerprint: string;
    parentCaseId: string | null;
    parentVersion: string | null;
    parentFingerprint: string | null;
    payload: string;
  },
  key: Uint8Array,
): Promise<StoredCaseArtifact> {
  const payload = readStoredCasePayload(artifact.payload);
  const studioPayload = isRecord(payload.studioDraft) ? payload.studioDraft : payload;
  const aggregate = readStudioAggregate(artifact.source === "custom" ? artifact.payload : JSON.stringify(studioPayload), { kind: "draft" });
  const verifiedIdentity = {
    source: artifact.source,
    customCaseId: artifact.customCaseId,
    ownerEmail: artifact.ownerEmail,
    caseId: artifact.caseId,
    version: artifact.version,
    studioFingerprint: artifact.studioFingerprint,
    parentCaseId: artifact.parentCaseId,
    parentVersion: artifact.parentVersion,
    parentFingerprint: artifact.parentFingerprint,
    payloadText: artifact.payload,
    taxAnalysis: studioPayload.taxAnalysis,
    // Legacy playable-only records retain their existing lineage behavior.
    // A tax-bearing aggregate must be fully understood before any mutation.
    editable: artifact.source === "published" && !Object.hasOwn(payload, "studioDraft") && !Object.hasOwn(payload, "taxAnalysis") || aggregate.status === "editable",
  };
  const protection = artifactProtection(payload);
  if (!protection) {
    return {
      ...verifiedIdentity,
      protection: null,
      currentCode: await legacyCaseProtectionCode(artifact.caseId, artifact.version, artifact.studioFingerprint),
      copyProtected: false,
    };
  }
  const binding: CaseProtectionBinding = {
    caseId: artifact.caseId,
    version: artifact.version,
    studioFingerprint: artifact.studioFingerprint,
    parentCaseId: artifact.parentCaseId,
    parentVersion: artifact.parentVersion,
    parentFingerprint: artifact.parentFingerprint,
    parentCode: protection.parentCode,
    copyPolicy: protection.copyPolicy,
  };
  if (!await verifyCaseProtection(protection, binding, key)) throw new CaseProtectionIntegrityError("Stored case-protection seal is invalid.");
  return { ...verifiedIdentity, protection, currentCode: protection.currentCode, copyProtected: protection.copyProtected };
}

/** SQL TEXT must reach this boundary before Drizzle's JSON-mode decoder. The
 * original text stays on StoredCaseArtifact; this parsed view is never recovery
 * output. Published payloads include both Studio and compiled scenario data. */
export function readStoredCasePayload(rawText: string): Record<string, unknown> {
  if (typeof rawText !== "string" || new TextEncoder().encode(rawText).byteLength > 4_000_000) throw new CaseProtectionIntegrityError("Stored case payload is unavailable for safe interpretation.");
  let value: unknown;
  try { value = parsePreservedJson(rawText); } catch { throw new CaseProtectionIntegrityError("Stored case payload requires read-only recovery."); }
  if (!isRecord(value)) throw new CaseProtectionIntegrityError("Stored case payload requires read-only recovery.");
  return value;
}

function artifactProtection(payload: unknown) {
  if (!isRecord(payload)) return null;
  const candidates = [
    payload.protection,
    isRecord(payload.artifactBinding) ? payload.artifactBinding.caseProtection : undefined,
    isRecord(payload.studioDraft) ? payload.studioDraft.protection : undefined,
  ].filter((value) => value !== undefined && value !== null);
  if (!candidates.length) return null;
  const normalized = candidates.map(normalizeStoredCaseProtection);
  const first = normalized[0];
  if (!first || normalized.some((item) => JSON.stringify(item) !== JSON.stringify(first))) {
    throw new CaseProtectionIntegrityError("Stored case-protection lineage is internally inconsistent.");
  }
  return first;
}

function draftParent(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.parent)) return null;
  if (typeof payload.parent.caseId !== "string" || typeof payload.parent.version !== "string" || typeof payload.parent.fingerprint !== "string") return null;
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(payload.parent.caseId) || !/^\d+\.\d+\.\d+$/u.test(payload.parent.version) || !/^sha256-[a-f0-9]{64}$/u.test(payload.parent.fingerprint)) return null;
  return { caseId: payload.parent.caseId, version: payload.parent.version, fingerprint: payload.parent.fingerprint };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encodeSecret(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeSecret(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new CaseProtectionIntegrityError("The stored case-protection key is invalid.");
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== 32) throw new CaseProtectionIntegrityError("The stored case-protection key is invalid.");
  return bytes;
}
