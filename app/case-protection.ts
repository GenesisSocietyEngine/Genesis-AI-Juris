import type { CaseCopyPolicy, CaseProtectionV1 } from "./types";

export const CASE_PROTECTION_KIND = "case-protection-v1" as const;
export const CASE_PROTECTION_SEAL_PREFIX = "hmac-sha256-" as const;

const FINGERPRINT_PATTERN = /^sha256-[a-f0-9]{64}$/u;
const CODE_PATTERN = /^sha256-[a-f0-9]{64}$/u;
const SEAL_PATTERN = /^hmac-sha256-[a-f0-9]{64}$/u;
const CASE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

export type CaseProtectionBinding = {
  caseId: string;
  version: string;
  studioFingerprint: string;
  parentCaseId: string | null;
  parentVersion: string | null;
  parentFingerprint: string | null;
  parentCode: string | null;
  copyPolicy: CaseCopyPolicy;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copyPolicy(value: Record<string, unknown>): CaseCopyPolicy {
  return value.copyProtected === true || value.copyPolicy === "lineage_locked" ? "lineage_locked" : "fork_allowed";
}

/**
 * Normalizes client JSON without trusting its codes. Submissions use only the
 * requested policy and replace parentCode/currentCode/seal on the server.
 */
export function normalizeUntrustedCaseProtection(value: unknown): CaseProtectionV1 | undefined {
  if (!isRecord(value) || value.kind !== CASE_PROTECTION_KIND) return undefined;
  const policy = copyPolicy(value);
  return {
    kind: CASE_PROTECTION_KIND,
    copyProtected: policy === "lineage_locked",
    copyPolicy: policy,
    parentCode: typeof value.parentCode === "string" && CODE_PATTERN.test(value.parentCode) ? value.parentCode : null,
    currentCode: typeof value.currentCode === "string" && CODE_PATTERN.test(value.currentCode) ? value.currentCode : "",
    seal: typeof value.seal === "string" && SEAL_PATTERN.test(value.seal) ? value.seal : "",
  };
}

/** Strict parser for metadata already persisted by the server. */
export function normalizeStoredCaseProtection(value: unknown): CaseProtectionV1 | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)
    || value.kind !== CASE_PROTECTION_KIND
    || typeof value.copyProtected !== "boolean"
    || (value.copyPolicy !== "fork_allowed" && value.copyPolicy !== "lineage_locked")
    || value.copyProtected !== (value.copyPolicy === "lineage_locked")
    || (value.parentCode !== null && (typeof value.parentCode !== "string" || !CODE_PATTERN.test(value.parentCode)))
    || typeof value.currentCode !== "string" || !CODE_PATTERN.test(value.currentCode)
    || typeof value.seal !== "string" || !SEAL_PATTERN.test(value.seal)) {
    throw new Error("Stored case protection metadata is invalid.");
  }
  return {
    kind: CASE_PROTECTION_KIND,
    copyProtected: value.copyProtected,
    copyPolicy: value.copyPolicy,
    parentCode: value.parentCode,
    currentCode: value.currentCode,
    seal: value.seal,
  };
}

export function requestedCopyProtection(value: unknown) {
  return isRecord(value) && value.kind === CASE_PROTECTION_KIND && copyPolicy(value) === "lineage_locked";
}

export function canonicalCaseProtectionBinding(binding: CaseProtectionBinding) {
  validateBinding(binding);
  return JSON.stringify({
    kind: CASE_PROTECTION_KIND,
    caseId: binding.caseId,
    version: binding.version,
    studioFingerprint: binding.studioFingerprint,
    parentCaseId: binding.parentCaseId,
    parentVersion: binding.parentVersion,
    parentFingerprint: binding.parentFingerprint,
    parentCode: binding.parentCode,
    copyPolicy: binding.copyPolicy,
  });
}

export async function buildCaseProtection(binding: CaseProtectionBinding, key: Uint8Array): Promise<CaseProtectionV1> {
  validateKey(key);
  const canonicalBinding = canonicalCaseProtectionBinding(binding);
  const currentCode = `sha256-${await sha256Hex(canonicalBinding)}`;
  const signedPayload = JSON.stringify({ binding: JSON.parse(canonicalBinding), currentCode });
  const seal = `${CASE_PROTECTION_SEAL_PREFIX}${await hmacHex(key, signedPayload)}`;
  return {
    kind: CASE_PROTECTION_KIND,
    copyProtected: binding.copyPolicy === "lineage_locked",
    copyPolicy: binding.copyPolicy,
    parentCode: binding.parentCode,
    currentCode,
    seal,
  };
}

export async function verifyCaseProtection(value: unknown, binding: CaseProtectionBinding, key: Uint8Array): Promise<boolean> {
  validateKey(key);
  let protection: CaseProtectionV1 | null;
  try { protection = normalizeStoredCaseProtection(value); } catch { return false; }
  if (!protection || protection.copyPolicy !== binding.copyPolicy || protection.parentCode !== binding.parentCode) return false;
  const canonicalBinding = canonicalCaseProtectionBinding(binding);
  const currentCode = `sha256-${await sha256Hex(canonicalBinding)}`;
  if (protection.currentCode !== currentCode) return false;
  const signedPayload = JSON.stringify({ binding: JSON.parse(canonicalBinding), currentCode });
  const signature = hexBytes(protection.seal.slice(CASE_PROTECTION_SEAL_PREFIX.length));
  const cryptoKey = await crypto.subtle.importKey("raw", arrayBuffer(key), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", cryptoKey, arrayBuffer(signature), arrayBuffer(new TextEncoder().encode(signedPayload)));
}

export async function legacyCaseProtectionCode(caseId: string, version: string, studioFingerprint: string) {
  validateIdentity(caseId, version, studioFingerprint);
  const canonical = JSON.stringify({ kind: "case-protection-legacy-parent-v1", caseId, version, studioFingerprint });
  return `sha256-${await sha256Hex(canonical)}`;
}

function validateBinding(binding: CaseProtectionBinding) {
  validateIdentity(binding.caseId, binding.version, binding.studioFingerprint);
  if (binding.parentCaseId !== null && (!CASE_ID_PATTERN.test(binding.parentCaseId) || binding.parentCaseId.length > 140)) throw new Error("Invalid protection parent case ID.");
  if (binding.parentVersion !== null && !VERSION_PATTERN.test(binding.parentVersion)) throw new Error("Invalid protection parent version.");
  if (binding.parentFingerprint !== null && !FINGERPRINT_PATTERN.test(binding.parentFingerprint)) throw new Error("Invalid protection parent fingerprint.");
  if (binding.parentCode !== null && !CODE_PATTERN.test(binding.parentCode)) throw new Error("Invalid protection parent code.");
  const parentParts = [binding.parentCaseId, binding.parentVersion, binding.parentFingerprint, binding.parentCode];
  if (parentParts.some((item) => item === null) && parentParts.some((item) => item !== null)) throw new Error("Protection parent identity, fingerprint and code must be paired.");
  if (binding.copyPolicy !== "fork_allowed" && binding.copyPolicy !== "lineage_locked") throw new Error("Invalid case copy policy.");
}

function validateIdentity(caseId: string, version: string, studioFingerprint: string) {
  if (!CASE_ID_PATTERN.test(caseId) || caseId.length > 140) throw new Error("Invalid protection case ID.");
  if (!VERSION_PATTERN.test(version) || !FINGERPRINT_PATTERN.test(studioFingerprint)) throw new Error("Invalid protected case identity.");
}

function validateKey(key: Uint8Array) {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) throw new Error("Case protection requires a 32-byte server key.");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer(new TextEncoder().encode(value)));
  return bytesHex(new Uint8Array(digest));
}

async function hmacHex(key: Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", arrayBuffer(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, arrayBuffer(new TextEncoder().encode(value)));
  return bytesHex(new Uint8Array(signature));
}

function bytesHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexBytes(value: string) {
  if (!/^[a-f0-9]{64}$/u.test(value)) return new Uint8Array();
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], (byte) => Number.parseInt(byte, 16));
}

function arrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
