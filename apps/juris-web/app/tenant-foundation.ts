export const CONFIDENTIAL_UPLOAD_WARNING =
  "Confidential document mode is not active. Do not upload privileged, client-identifying, or live production documents. Use only synthetic or properly de-identified material.";

export const VALIDATION_DATA_RESTRICTION = "synthetic_or_deidentified_only" as const;

export const ORGANIZATION_STATUSES = [
  "provisioning",
  "active",
  "suspended",
  "closed",
] as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export type ConfidentialDocumentMode = "disabled" | "validation" | "approved";
export type ValidationDataClassification =
  | "synthetic"
  | "deidentified"
  | "confidential";

export function isUploadClassificationPermitted(
  mode: ConfidentialDocumentMode,
  classification: ValidationDataClassification,
): boolean {
  // Phase C ingestion is not authorized. Classification validation does not
  // turn the Phase B document-upload action into an enabled capability.
  void mode;
  void classification;
  return false;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function secureRandomBytes(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new TypeError("random byte length must be a positive safe integer");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) {
    throw new TypeError("invalid base64url value");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Bytes(value: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", ownedArrayBuffer(bytes)),
  );
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  return [...(await sha256Bytes(value))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Base64Url(value: string | Uint8Array): Promise<string> {
  return base64UrlEncode(await sha256Bytes(value));
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    const canonicalObject: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    for (const [key, item] of entries) {
      canonicalObject[key] = canonicalize(item);
    }
    return canonicalObject;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

export type OrganizationLifecycleCommand =
  | "activate"
  | "suspend"
  | "resume"
  | "close";

export type OrganizationLifecycleResult =
  | {
      ok: true;
      previousStatus: OrganizationStatus;
      status: OrganizationStatus;
      event: "activated" | "suspended" | "resumed" | "closed";
    }
  | {
      ok: false;
      code: "invalid_transition" | "separation_of_duties_required";
    };

/**
 * A close command is atomic from the contract's perspective. There is deliberately
 * no persisted or externally visible intermediate status outside the frozen schema.
 */
export function transitionOrganizationLifecycle(input: {
  status: OrganizationStatus;
  command: OrganizationLifecycleCommand;
  requestedByActorId: string;
  approvedByActorId?: string;
}): OrganizationLifecycleResult {
  const needsIndependentApproval =
    input.command === "suspend" ||
    input.command === "resume" ||
    input.command === "close";
  if (
    needsIndependentApproval &&
    (!input.approvedByActorId ||
      constantTimeStringEqual(input.requestedByActorId, input.approvedByActorId))
  ) {
    return { ok: false, code: "separation_of_duties_required" };
  }

  const transitionKey = `${input.status}:${input.command}`;
  const transitions: Record<
    string,
    {
      status: OrganizationStatus;
      event: Extract<OrganizationLifecycleResult, { ok: true }>["event"];
    }
  > = {
    "provisioning:activate": { status: "active", event: "activated" },
    "active:suspend": { status: "suspended", event: "suspended" },
    "suspended:resume": { status: "active", event: "resumed" },
    "provisioning:close": { status: "closed", event: "closed" },
    "active:close": { status: "closed", event: "closed" },
    "suspended:close": { status: "closed", event: "closed" },
  };
  const transition = transitions[transitionKey];
  if (!transition) {
    return { ok: false, code: "invalid_transition" };
  }
  return {
    ok: true,
    previousStatus: input.status,
    status: transition.status,
    event: transition.event,
  };
}

export type OrganizationRole = "org_owner" | "org_admin" | "member" | "auditor";
export type DossierRole = "owner" | "contributor" | "reviewer" | "viewer";

const ORGANIZATION_ROLES: readonly OrganizationRole[] = [
  "org_owner",
  "org_admin",
  "member",
  "auditor",
];
const DOSSIER_ROLES: readonly DossierRole[] = [
  "owner",
  "contributor",
  "reviewer",
  "viewer",
];

function isOrganizationRole(value: unknown): value is OrganizationRole {
  return ORGANIZATION_ROLES.some((role) => role === value);
}

function isDossierAssignment(
  value: unknown,
): value is { dossierId: string; role: DossierRole } {
  return Boolean(
    isPlainRecord(value) &&
      hasExactKeys(value, ["dossierId", "role"]) &&
      isOpaqueId(value.dossierId) &&
      DOSSIER_ROLES.some((role) => role === value.role),
  );
}

export const INVITATION_MIN_TTL_SECONDS = 60;
export const INVITATION_MAX_TTL_SECONDS = 86_400;

export function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,128}$/u.test(value);
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function isExactHttpsOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      parsed.origin === value &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

export function isStableOidcIdentityKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const fields = value.split("\u001f");
  if (fields.length !== 3) return false;
  const [issuer, tenantId, subject] = fields;
  try {
    const parsedIssuer = new URL(issuer);
    return Boolean(
      parsedIssuer.protocol === "https:" &&
        !parsedIssuer.username &&
        !parsedIssuer.password &&
        !parsedIssuer.search &&
        !parsedIssuer.hash &&
        /^[A-Za-z0-9._-]{3,128}$/u.test(tenantId) &&
        /^[A-Za-z0-9._-]{3,128}$/u.test(subject),
    );
  } catch {
    return false;
  }
}

export interface InvitationRecord {
  id: string;
  tokenDigest: string;
  organizationId: string;
  intendedIdentityKey: string;
  exactOrigin: string;
  organizationRole: OrganizationRole;
  dossierAssignment?: { dossierId: string; role: DossierRole };
  createdAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
  status: "active" | "accepted" | "revoked";
  acceptedAtEpochSeconds?: number;
}

export interface NewInvitationInput {
  organizationId: string;
  intendedIdentityKey: string;
  exactOrigin: string;
  organizationRole: OrganizationRole;
  dossierAssignment?: { dossierId: string; role: DossierRole };
  nowEpochSeconds: number;
  expiresAtEpochSeconds: number;
}

export async function createDigestOnlyInvitation(
  input: NewInvitationInput,
  randomBytes: (length: number) => Uint8Array = secureRandomBytes,
): Promise<{ secretToken: string; record: InvitationRecord }> {
  const snapshot = structuredClone(input);
  const ttlSeconds =
    snapshot.expiresAtEpochSeconds - snapshot.nowEpochSeconds;
  if (
    !isOpaqueId(snapshot.organizationId) ||
    !isOrganizationRole(snapshot.organizationRole) ||
    (snapshot.dossierAssignment !== undefined &&
      !isDossierAssignment(snapshot.dossierAssignment)) ||
    !isStableOidcIdentityKey(snapshot.intendedIdentityKey) ||
    !isExactHttpsOrigin(snapshot.exactOrigin) ||
    !isPositiveSafeInteger(snapshot.nowEpochSeconds) ||
    !isPositiveSafeInteger(snapshot.expiresAtEpochSeconds) ||
    ttlSeconds < INVITATION_MIN_TTL_SECONDS ||
    ttlSeconds > INVITATION_MAX_TTL_SECONDS
  ) {
    throw new TypeError("invalid bounded invitation context");
  }
  const tokenBytes = randomBytes(32);
  if (tokenBytes.byteLength < 32) {
    throw new TypeError("invitation tokens require at least 256 bits of entropy");
  }
  const idBytes = randomBytes(18);
  if (idBytes.byteLength < 16) {
    throw new TypeError("invitation identifiers require at least 128 bits of entropy");
  }
  const secretToken = base64UrlEncode(tokenBytes);
  const record: InvitationRecord = {
    id: base64UrlEncode(idBytes),
    tokenDigest: await sha256Hex(secretToken),
    organizationId: snapshot.organizationId,
    intendedIdentityKey: snapshot.intendedIdentityKey,
    exactOrigin: snapshot.exactOrigin,
    organizationRole: snapshot.organizationRole,
    ...(snapshot.dossierAssignment
      ? { dossierAssignment: { ...snapshot.dossierAssignment } }
      : {}),
    createdAtEpochSeconds: snapshot.nowEpochSeconds,
    expiresAtEpochSeconds: snapshot.expiresAtEpochSeconds,
    status: "active",
  };
  return { secretToken, record };
}

export type InvitationAcceptanceResult =
  | {
      accepted: true;
      organizationId: string;
      organizationRole: OrganizationRole;
      dossierAssignment?: { dossierId: string; role: DossierRole };
    }
  | { accepted: false; code: "invitation_unavailable" };

/**
 * Local, dependency-free compare-and-set store for unit tests and adapter contracts.
 * A production adapter must provide the same single-row atomic consumption behavior.
 */
export class InMemoryInvitationStore {
  readonly #records = new Map<string, InvitationRecord>();

  insert(record: InvitationRecord): void {
    const ttlSeconds = record.expiresAtEpochSeconds - record.createdAtEpochSeconds;
    if (
      !isOpaqueId(record.id) ||
      !isOpaqueId(record.organizationId) ||
      !isSha256(record.tokenDigest) ||
      !isStableOidcIdentityKey(record.intendedIdentityKey) ||
      !isExactHttpsOrigin(record.exactOrigin) ||
      record.status !== "active" ||
      !isPositiveSafeInteger(record.createdAtEpochSeconds) ||
      !isPositiveSafeInteger(record.expiresAtEpochSeconds) ||
      ttlSeconds < INVITATION_MIN_TTL_SECONDS ||
      ttlSeconds > INVITATION_MAX_TTL_SECONDS ||
      !isOrganizationRole(record.organizationRole) ||
      (record.dossierAssignment !== undefined &&
        !isDossierAssignment(record.dossierAssignment))
    ) {
      throw new TypeError("invalid invitation record");
    }
    if (this.#records.has(record.id)) {
      throw new Error("invitation already exists");
    }
    this.#records.set(record.id, structuredClone(record));
  }

  inspectForTest(id: string): InvitationRecord | undefined {
    const record = this.#records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  revoke(id: string): boolean {
    const record = this.#records.get(id);
    if (!record || record.status !== "active") {
      return false;
    }
    this.#records.set(id, { ...record, status: "revoked" });
    return true;
  }

  async accept(input: {
    invitationId: string;
    secretToken: string;
    authenticatedIdentityKey: string;
    exactOrigin: string;
    nowEpochSeconds: number;
  }): Promise<InvitationAcceptanceResult> {
    if (
      !isOpaqueId(input.invitationId) ||
      !/^[A-Za-z0-9_-]{43,128}$/u.test(input.secretToken) ||
      !isStableOidcIdentityKey(input.authenticatedIdentityKey) ||
      !isExactHttpsOrigin(input.exactOrigin) ||
      !isPositiveSafeInteger(input.nowEpochSeconds)
    ) {
      return { accepted: false, code: "invitation_unavailable" };
    }
    const submittedDigest = await sha256Hex(input.secretToken);
    const record = this.#records.get(input.invitationId);
    if (
      !record ||
      record.status !== "active" ||
      record.expiresAtEpochSeconds <= input.nowEpochSeconds ||
      !constantTimeStringEqual(record.tokenDigest, submittedDigest) ||
      !constantTimeStringEqual(
        record.intendedIdentityKey,
        input.authenticatedIdentityKey,
      ) ||
      !constantTimeStringEqual(record.exactOrigin, input.exactOrigin)
    ) {
      return { accepted: false, code: "invitation_unavailable" };
    }

    // This synchronous update is the local adapter's compare-and-set boundary.
    this.#records.set(record.id, {
      ...record,
      status: "accepted",
      acceptedAtEpochSeconds: input.nowEpochSeconds,
    });
    return {
      accepted: true,
      organizationId: record.organizationId,
      organizationRole: record.organizationRole,
      ...(record.dossierAssignment
        ? { dossierAssignment: { ...record.dossierAssignment } }
        : {}),
    };
  }
}

export const TENANT_RESOURCE_MANIFEST_VERSION = "tenant-resource-manifest.v1" as const;
export const TENANT_RESOURCE_ENVIRONMENTS = [
  "development",
  "validation",
  "production",
] as const;
export const TENANT_RESOURCE_ACTIVATIONS = [
  "disabled",
  "validation",
  "approved",
  "suspended",
] as const;
export const TENANT_RESOURCE_R2_NAMESPACES = [
  "quarantine",
  "clean",
  "extracted_text",
  "exports",
  "backups",
] as const;
export const TENANT_RESOURCE_COMPONENTS = [
  "workers",
  "queues",
  "cron",
  "malware_scanning",
  "extraction",
  "ocr",
  "kms",
  "logging",
  "analytics",
  "backup_restore",
  "support",
  "ai",
] as const;
export const TENANT_RESOURCE_MANIFEST_REQUIRED_FIELDS = [
  "manifest_version",
  "organization_id",
  "environment",
  "hostname",
  "d1",
  "r2",
  "jurisdiction",
  "encryption_key_aliases",
  "processing_components",
  "schema_version",
  "deployment_sha",
  "activation",
  "verification",
] as const;

export type TenantResourceEnvironment =
  (typeof TENANT_RESOURCE_ENVIRONMENTS)[number];
export type TenantResourceActivation =
  (typeof TENANT_RESOURCE_ACTIVATIONS)[number];
export type TenantResourceComponentName =
  (typeof TENANT_RESOURCE_COMPONENTS)[number];

export interface TenantResourceComponentEvidence {
  binding_id: string;
  jurisdiction: "eu";
  receipt_sha256: string;
  verified_at: string;
  expires_at: string;
}

export interface TenantResourceNamespace {
  id: string;
  jurisdiction: "eu";
  namespace: (typeof TENANT_RESOURCE_R2_NAMESPACES)[number];
  access_binding_alias: string;
}

export interface TenantResourceManifest {
  manifest_version: typeof TENANT_RESOURCE_MANIFEST_VERSION;
  organization_id: string;
  environment: TenantResourceEnvironment;
  hostname: string;
  d1: { id: string; jurisdiction: "eu" };
  r2: {
    quarantine: TenantResourceNamespace & { namespace: "quarantine" };
    clean: TenantResourceNamespace & { namespace: "clean" };
    extracted_text: TenantResourceNamespace & { namespace: "extracted_text" };
    exports: TenantResourceNamespace & { namespace: "exports" };
    backups: TenantResourceNamespace & { namespace: "backups" };
  };
  jurisdiction: "eu";
  encryption_key_aliases: {
    live_data: string;
    exports: string;
    backups: string;
    restore: string;
  };
  processing_components: Record<
    TenantResourceComponentName,
    TenantResourceComponentEvidence
  >;
  schema_version: string;
  deployment_sha: string;
  activation: TenantResourceActivation;
  activation_validation?: {
    validator_version: "tenant-activation-validator.v1";
    evaluated_at: string;
    valid_until: string;
    covered_receipts: Record<
      TenantResourceComponentName | "manifest_verification",
      string
    >;
    receipt_set_sha256: string;
    validation_receipt_sha256: string;
    status: "current";
  };
  verification: {
    receipt_sha256: string;
    verified_at: string;
    expires_at: string;
  };
}

const verifiedTenantResourceManifestBrand: unique symbol = Symbol(
  "verifiedTenantResourceManifest",
);
const verifiedTenantResourceManifestInstances = new WeakSet<object>();

export interface VerifiedTenantResourceManifest {
  readonly [verifiedTenantResourceManifestBrand]: true;
  verificationVersion: "tenant-resource-manifest-verification.v1";
  schemaId: "https://genesis.invalid/contracts/tenant-resource-manifest.v1.schema.json";
  schemaValidationReceiptSha256: string;
  canonicalManifestSha256: string;
  manifestRevision: number;
  currentManifestRevision: number;
  validUntilEpochSeconds: number;
  productionEvidenceStatus: "unverified_external_dependency";
  manifest: TenantResourceManifest;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isVerifiedTenantResourceManifest(
  value: unknown,
): value is VerifiedTenantResourceManifest {
  return Boolean(
    isPlainRecord(value) &&
      verifiedTenantResourceManifestInstances.has(value) &&
      (value as Record<PropertyKey, unknown>)[
        verifiedTenantResourceManifestBrand
      ] === true,
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function timestampEpochSeconds(value: unknown): number | undefined {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    )
  ) {
    return undefined;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : undefined;
}

function isCurrentEvidence(
  value: unknown,
  nowEpochSeconds: number,
): value is TenantResourceComponentEvidence {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      "binding_id",
      "jurisdiction",
      "receipt_sha256",
      "verified_at",
      "expires_at",
    ]) ||
    !isOpaqueId(value.binding_id) ||
    value.jurisdiction !== "eu" ||
    !isSha256(value.receipt_sha256)
  ) {
    return false;
  }
  const verifiedAt = timestampEpochSeconds(value.verified_at);
  const expiresAt = timestampEpochSeconds(value.expires_at);
  return Boolean(
    verifiedAt !== undefined &&
      expiresAt !== undefined &&
      verifiedAt <= nowEpochSeconds &&
      expiresAt > nowEpochSeconds &&
      expiresAt > verifiedAt,
  );
}

function isTenantNamespace(
  value: unknown,
  namespace: (typeof TENANT_RESOURCE_R2_NAMESPACES)[number],
): value is TenantResourceNamespace {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "jurisdiction",
      "namespace",
      "access_binding_alias",
    ]) ||
    !isOpaqueId(value.id) ||
    value.jurisdiction !== "eu" ||
    value.namespace !== namespace ||
    typeof value.access_binding_alias !== "string"
  ) {
    return false;
  }
  const patterns: Record<typeof namespace, RegExp> = {
    quarantine: /^quarantine\/[A-Za-z0-9/_-]{3,145}$/u,
    clean: /^clean\/[A-Za-z0-9/_-]{3,150}$/u,
    extracted_text: /^extracted-text\/[A-Za-z0-9/_-]{3,141}$/u,
    exports: /^exports\/[A-Za-z0-9/_-]{3,148}$/u,
    backups: /^backups\/[A-Za-z0-9/_-]{3,148}$/u,
  };
  return patterns[namespace].test(value.access_binding_alias);
}

function validActivationEvidence(
  value: unknown,
  nowEpochSeconds: number,
): value is NonNullable<TenantResourceManifest["activation_validation"]> {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      "validator_version",
      "evaluated_at",
      "valid_until",
      "covered_receipts",
      "receipt_set_sha256",
      "validation_receipt_sha256",
      "status",
    ]) ||
    value.validator_version !== "tenant-activation-validator.v1" ||
    value.status !== "current" ||
    !isSha256(value.receipt_set_sha256) ||
    !isSha256(value.validation_receipt_sha256) ||
    !isPlainRecord(value.covered_receipts)
  ) {
    return false;
  }
  const coveredReceipts = value.covered_receipts as Record<string, unknown>;
  const receiptNames = ["manifest_verification", ...TENANT_RESOURCE_COMPONENTS];
  if (
    !hasExactKeys(coveredReceipts, receiptNames) ||
    !receiptNames.every((name) => isSha256(coveredReceipts[name]))
  ) {
    return false;
  }
  const evaluatedAt = timestampEpochSeconds(value.evaluated_at);
  const validUntil = timestampEpochSeconds(value.valid_until);
  return Boolean(
    evaluatedAt !== undefined &&
      validUntil !== undefined &&
      evaluatedAt <= nowEpochSeconds &&
      validUntil > nowEpochSeconds &&
      validUntil > evaluatedAt,
  );
}

function validTenantResourceManifestShape(
  value: unknown,
  nowEpochSeconds: number,
): value is TenantResourceManifest {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, TENANT_RESOURCE_MANIFEST_REQUIRED_FIELDS, [
      "activation_validation",
    ]) ||
    value.manifest_version !== TENANT_RESOURCE_MANIFEST_VERSION ||
    !isOpaqueId(value.organization_id) ||
    !TENANT_RESOURCE_ENVIRONMENTS.some((item) => item === value.environment) ||
    typeof value.hostname !== "string" ||
    value.hostname.length > 253 ||
    !/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/u.test(
      value.hostname,
    ) ||
    value.jurisdiction !== "eu" ||
    typeof value.schema_version !== "string" ||
    !/^v[0-9]+$/u.test(value.schema_version) ||
    typeof value.deployment_sha !== "string" ||
    !/^[a-f0-9]{40}$/u.test(value.deployment_sha) ||
    !TENANT_RESOURCE_ACTIVATIONS.some((item) => item === value.activation)
  ) {
    return false;
  }
  const r2 = value.r2 as Record<string, unknown>;
  if (
    !isPlainRecord(value.d1) ||
    !hasExactKeys(value.d1, ["id", "jurisdiction"]) ||
    !isOpaqueId(value.d1.id) ||
    value.d1.jurisdiction !== "eu" ||
    !isPlainRecord(value.r2) ||
    !hasExactKeys(value.r2, TENANT_RESOURCE_R2_NAMESPACES) ||
    !TENANT_RESOURCE_R2_NAMESPACES.every((namespace) =>
      isTenantNamespace(r2[namespace], namespace),
    )
  ) {
    return false;
  }
  const processingComponents = value.processing_components as Record<
    string,
    unknown
  >;
  if (
    !isPlainRecord(value.encryption_key_aliases) ||
    !hasExactKeys(value.encryption_key_aliases, [
      "live_data",
      "exports",
      "backups",
      "restore",
    ]) ||
    typeof value.encryption_key_aliases.live_data !== "string" ||
    !/^live\/[A-Za-z0-9/_-]{3,155}$/u.test(
      value.encryption_key_aliases.live_data,
    ) ||
    typeof value.encryption_key_aliases.exports !== "string" ||
    !/^export\/[A-Za-z0-9/_-]{3,153}$/u.test(
      value.encryption_key_aliases.exports,
    ) ||
    typeof value.encryption_key_aliases.backups !== "string" ||
    !/^backup\/[A-Za-z0-9/_-]{3,153}$/u.test(
      value.encryption_key_aliases.backups,
    ) ||
    typeof value.encryption_key_aliases.restore !== "string" ||
    !/^restore\/[A-Za-z0-9/_-]{3,152}$/u.test(
      value.encryption_key_aliases.restore,
    )
  ) {
    return false;
  }
  if (
    !isPlainRecord(value.processing_components) ||
    !hasExactKeys(value.processing_components, TENANT_RESOURCE_COMPONENTS) ||
    !TENANT_RESOURCE_COMPONENTS.every((name) =>
      isCurrentEvidence(processingComponents[name], nowEpochSeconds),
    )
  ) {
    return false;
  }
  if (
    !isPlainRecord(value.verification) ||
    !hasExactKeys(value.verification, [
      "receipt_sha256",
      "verified_at",
      "expires_at",
    ]) ||
    !isSha256(value.verification.receipt_sha256)
  ) {
    return false;
  }
  const verifiedAt = timestampEpochSeconds(value.verification.verified_at);
  const expiresAt = timestampEpochSeconds(value.verification.expires_at);
  if (
    verifiedAt === undefined ||
    expiresAt === undefined ||
    verifiedAt > nowEpochSeconds ||
    expiresAt <= nowEpochSeconds ||
    expiresAt <= verifiedAt
  ) {
    return false;
  }
  if (value.activation === "approved") {
    return (
      value.environment === "production" &&
      validActivationEvidence(value.activation_validation, nowEpochSeconds)
    );
  }
  return value.activation_validation === undefined;
}

/**
 * Frozen-schema adapter. Raw manifests never enter the PDP; callers must supply
 * a canonical digest and an independent schema-validation receipt. Production
 * evidence remains explicitly unverified in this Phase B implementation.
 */
export async function verifyTenantResourceManifest(input: {
  manifest: unknown;
  expectedOrganizationId: string;
  expectedDeploymentSha: string;
  expectedCanonicalManifestSha256: string;
  schemaValidationReceiptSha256: string;
  manifestRevision: number;
  currentManifestRevision: number;
  nowEpochSeconds: number;
}): Promise<VerifiedTenantResourceManifest | undefined> {
  let manifest: unknown;
  try {
    manifest = structuredClone(input.manifest);
  } catch {
    return undefined;
  }
  if (
    !isOpaqueId(input.expectedOrganizationId) ||
    !/^[a-f0-9]{40}$/u.test(input.expectedDeploymentSha) ||
    !isSha256(input.expectedCanonicalManifestSha256) ||
    !isSha256(input.schemaValidationReceiptSha256) ||
    !isPositiveSafeInteger(input.manifestRevision) ||
    input.manifestRevision !== input.currentManifestRevision ||
    !isPositiveSafeInteger(input.nowEpochSeconds) ||
    !validTenantResourceManifestShape(manifest, input.nowEpochSeconds)
  ) {
    return undefined;
  }
  if (
    manifest.organization_id !== input.expectedOrganizationId ||
    manifest.deployment_sha !== input.expectedDeploymentSha
  ) {
    return undefined;
  }
  const digest = await sha256Hex(canonicalJson(manifest));
  if (!constantTimeStringEqual(digest, input.expectedCanonicalManifestSha256)) {
    return undefined;
  }
  const expiries = [
    timestampEpochSeconds(manifest.verification.expires_at)!,
    ...TENANT_RESOURCE_COMPONENTS.map(
      (name) =>
        timestampEpochSeconds(manifest.processing_components[name].expires_at)!,
    ),
    ...(manifest.activation_validation
      ? [timestampEpochSeconds(manifest.activation_validation.valid_until)!]
      : []),
  ];
  const verified = {
    verificationVersion: "tenant-resource-manifest-verification.v1",
    schemaId:
      "https://genesis.invalid/contracts/tenant-resource-manifest.v1.schema.json",
    schemaValidationReceiptSha256: input.schemaValidationReceiptSha256,
    canonicalManifestSha256: digest,
    manifestRevision: input.manifestRevision,
    currentManifestRevision: input.currentManifestRevision,
    validUntilEpochSeconds: Math.min(...expiries),
    productionEvidenceStatus: "unverified_external_dependency",
    manifest,
  } as VerifiedTenantResourceManifest;
  Object.defineProperty(verified, verifiedTenantResourceManifestBrand, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedTenantResourceManifestInstances.add(verified);
  return deepFreeze(verified);
}

export interface EnvelopeAssociatedData {
  organizationId: string;
  objectType: string;
  objectId: string;
  purpose: string;
  schemaVersion: number;
}

export interface EncryptedEnvelope {
  algorithm: "A256GCM";
  keyAlias: string;
  keyVersion: number;
  iv: string;
  ciphertext: string;
  aadSha256: string;
}

export interface EnvelopeEncryptionBoundary {
  seal(input: {
    keyAlias: string;
    keyVersion: number;
    plaintext: Uint8Array;
    associatedData: EnvelopeAssociatedData;
  }): Promise<EncryptedEnvelope>;
  open(input: {
    envelope: EncryptedEnvelope;
    expectedKeyAlias: string;
    expectedAssociatedData: EnvelopeAssociatedData;
  }): Promise<Uint8Array>;
}

function localKeyId(alias: string, version: number): string {
  return `${alias}#${version}`;
}

function assertKeyAlias(alias: string): void {
  if (!/^[a-z0-9][a-z0-9/_-]{7,127}$/u.test(alias)) {
    throw new TypeError("invalid key alias");
  }
}

/**
 * Explicitly local test fake. It performs real WebCrypto AEAD but has no cloud KMS,
 * key-policy, audit, durability, or production secret integration.
 */
export class LocalTestEnvelopeKms implements EnvelopeEncryptionBoundary {
  readonly #keys = new Map<string, CryptoKey>();

  constructor(marker: "LOCAL_TEST_ONLY") {
    if (marker !== "LOCAL_TEST_ONLY") {
      throw new Error("local envelope KMS is test-only");
    }
  }

  async addRandomKey(keyAlias: string, keyVersion: number): Promise<void> {
    assertKeyAlias(keyAlias);
    if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
      throw new TypeError("invalid key version");
    }
    const key = await crypto.subtle.importKey(
      "raw",
      ownedArrayBuffer(secureRandomBytes(32)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    this.#keys.set(localKeyId(keyAlias, keyVersion), key);
  }

  async seal(input: {
    keyAlias: string;
    keyVersion: number;
    plaintext: Uint8Array;
    associatedData: EnvelopeAssociatedData;
  }): Promise<EncryptedEnvelope> {
    assertKeyAlias(input.keyAlias);
    const key = this.#keys.get(localKeyId(input.keyAlias, input.keyVersion));
    if (!key) {
      throw new Error("envelope key unavailable");
    }
    const aad = encoder.encode(canonicalJson(input.associatedData));
    const iv = secureRandomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ownedArrayBuffer(iv),
        additionalData: ownedArrayBuffer(aad),
        tagLength: 128,
      },
      key,
      ownedArrayBuffer(input.plaintext),
    );
    return {
      algorithm: "A256GCM",
      keyAlias: input.keyAlias,
      keyVersion: input.keyVersion,
      iv: base64UrlEncode(iv),
      ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
      aadSha256: await sha256Hex(aad),
    };
  }

  async open(input: {
    envelope: EncryptedEnvelope;
    expectedKeyAlias: string;
    expectedAssociatedData: EnvelopeAssociatedData;
  }): Promise<Uint8Array> {
    assertKeyAlias(input.expectedKeyAlias);
    const aad = encoder.encode(canonicalJson(input.expectedAssociatedData));
    const expectedDigest = await sha256Hex(aad);
    if (
      input.envelope.algorithm !== "A256GCM" ||
      !constantTimeStringEqual(input.envelope.keyAlias, input.expectedKeyAlias) ||
      !constantTimeStringEqual(input.envelope.aadSha256, expectedDigest)
    ) {
      throw new Error("envelope unavailable");
    }
    const key = this.#keys.get(
      localKeyId(input.envelope.keyAlias, input.envelope.keyVersion),
    );
    if (!key) {
      throw new Error("envelope unavailable");
    }
    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ownedArrayBuffer(base64UrlDecode(input.envelope.iv)),
          additionalData: ownedArrayBuffer(aad),
          tagLength: 128,
        },
        key,
        ownedArrayBuffer(base64UrlDecode(input.envelope.ciphertext)),
      );
      return new Uint8Array(plaintext);
    } catch {
      throw new Error("envelope unavailable");
    }
  }
}

export type KeyRotationState =
  | {
      phase: "stable";
      currentVersion: number;
      writeVersion: number;
      readVersions: readonly [number];
    }
  | {
      phase: "preparing" | "rewrapping" | "verifying";
      fromVersion: number;
      toVersion: number;
      newVersionWriteCount: number;
      writeVersion: number;
      readVersions: readonly number[];
    }
  | {
      phase: "rollback_rewrapping";
      fromVersion: number;
      toVersion: number;
      totalNewVersionWrites: number;
      rewrappedNewVersionWrites: number;
      pendingNewVersionWrites: number;
      writeVersion: number;
      readVersions: readonly [number, number];
    }
  | {
      phase: "rollback_verifying";
      fromVersion: number;
      toVersion: number;
      totalNewVersionWrites: number;
      rewrappedNewVersionWrites: number;
      pendingNewVersionWrites: 0;
      rollbackVerificationReceiptSha256: string;
      writeVersion: number;
      readVersions: readonly [number, number];
    }
  | {
      phase: "completed";
      currentVersion: number;
      writeVersion: number;
      readVersions: readonly [number];
    }
  | {
      phase: "rolled_back";
      currentVersion: number;
      attemptedVersion: number;
      rollbackVerificationReceiptSha256?: string;
      writeVersion: number;
      readVersions: readonly [number];
    };

export type KeyRotationCommand =
  | { type: "begin"; toVersion: number }
  | { type: "activate_new_writes" }
  | { type: "record_new_version_write" }
  | { type: "rewrap_complete" }
  | { type: "verification_complete" }
  | { type: "rollback" }
  | { type: "record_rollback_rewrap_progress"; completedWrites: number }
  | { type: "verify_rollback_rewrap"; verificationReceiptSha256: string }
  | {
      type: "rollback_verification_complete";
      verificationReceiptSha256: string;
    };

export type KeyRotationTransition =
  | { ok: true; state: KeyRotationState }
  | { ok: false; code: "invalid_rotation_transition" };

export function stableKeyRotationState(currentVersion: number): KeyRotationState {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 1) {
    throw new TypeError("invalid current key version");
  }
  return {
    phase: "stable",
    currentVersion,
    writeVersion: currentVersion,
    readVersions: [currentVersion],
  };
}

export function transitionKeyRotation(
  state: KeyRotationState,
  command: KeyRotationCommand,
): KeyRotationTransition {
  if (
    command.type === "begin" &&
    (state.phase === "stable" || state.phase === "completed") &&
    command.toVersion === state.currentVersion + 1
  ) {
    return {
      ok: true,
      state: {
        phase: "preparing",
        fromVersion: state.currentVersion,
        toVersion: command.toVersion,
        newVersionWriteCount: 0,
        writeVersion: state.currentVersion,
        readVersions: [state.currentVersion],
      },
    };
  }
  if (state.phase === "preparing" && command.type === "activate_new_writes") {
    return {
      ok: true,
      state: {
        ...state,
        phase: "rewrapping",
        writeVersion: state.toVersion,
        readVersions: [state.fromVersion, state.toVersion],
      },
    };
  }
  if (state.phase === "rewrapping" && command.type === "rewrap_complete") {
    return { ok: true, state: { ...state, phase: "verifying" } };
  }
  if (
    (state.phase === "rewrapping" || state.phase === "verifying") &&
    command.type === "record_new_version_write"
  ) {
    return {
      ok: true,
      state: {
        ...state,
        newVersionWriteCount: state.newVersionWriteCount + 1,
      },
    };
  }
  if (state.phase === "verifying" && command.type === "verification_complete") {
    return {
      ok: true,
      state: {
        phase: "completed",
        currentVersion: state.toVersion,
        writeVersion: state.toVersion,
        readVersions: [state.toVersion],
      },
    };
  }
  if (
    (state.phase === "rewrapping" || state.phase === "verifying") &&
    state.newVersionWriteCount > 0 &&
    command.type === "rollback"
  ) {
    return {
      ok: true,
      state: {
        phase: "rollback_rewrapping",
        fromVersion: state.fromVersion,
        toVersion: state.toVersion,
        totalNewVersionWrites: state.newVersionWriteCount,
        rewrappedNewVersionWrites: 0,
        pendingNewVersionWrites: state.newVersionWriteCount,
        writeVersion: state.fromVersion,
        readVersions: [state.fromVersion, state.toVersion],
      },
    };
  }
  if (
    (state.phase === "preparing" ||
      ((state.phase === "rewrapping" || state.phase === "verifying") &&
        state.newVersionWriteCount === 0)) &&
    command.type === "rollback"
  ) {
    return {
      ok: true,
      state: {
        phase: "rolled_back",
        currentVersion: state.fromVersion,
        attemptedVersion: state.toVersion,
        writeVersion: state.fromVersion,
        readVersions: [state.fromVersion],
      },
    };
  }
  if (
    state.phase === "rollback_rewrapping" &&
    command.type === "record_rollback_rewrap_progress" &&
    Number.isSafeInteger(command.completedWrites) &&
    command.completedWrites >= state.rewrappedNewVersionWrites &&
    command.completedWrites <= state.totalNewVersionWrites
  ) {
    return {
      ok: true,
      state: {
        ...state,
        rewrappedNewVersionWrites: command.completedWrites,
        pendingNewVersionWrites:
          state.totalNewVersionWrites - command.completedWrites,
      },
    };
  }
  if (
    state.phase === "rollback_rewrapping" &&
    state.pendingNewVersionWrites === 0 &&
    command.type === "verify_rollback_rewrap" &&
    isSha256(command.verificationReceiptSha256)
  ) {
    return {
      ok: true,
      state: {
        phase: "rollback_verifying",
        fromVersion: state.fromVersion,
        toVersion: state.toVersion,
        totalNewVersionWrites: state.totalNewVersionWrites,
        rewrappedNewVersionWrites: state.rewrappedNewVersionWrites,
        pendingNewVersionWrites: 0,
        rollbackVerificationReceiptSha256:
          command.verificationReceiptSha256,
        writeVersion: state.writeVersion,
        readVersions: state.readVersions,
      },
    };
  }
  if (
    state.phase === "rollback_verifying" &&
    command.type === "rollback_verification_complete" &&
    constantTimeStringEqual(
      command.verificationReceiptSha256,
      state.rollbackVerificationReceiptSha256,
    )
  ) {
    return {
      ok: true,
      state: {
        phase: "rolled_back",
        currentVersion: state.fromVersion,
        attemptedVersion: state.toVersion,
        rollbackVerificationReceiptSha256:
          state.rollbackVerificationReceiptSha256,
        writeVersion: state.fromVersion,
        readVersions: [state.fromVersion],
      },
    };
  }
  return { ok: false, code: "invalid_rotation_transition" };
}

export type SecurityReceiptReason =
  | "authorized"
  | "policy_denied"
  | "tenant_boundary_denied"
  | "stale_authority_denied"
  | "replay_denied"
  | "malformed_context_denied"
  | "stale_resource_denied"
  | "manifest_denied"
  | "security_transition";

export interface SecurityReceiptInput {
  schemaVersion: "security-receipt.v1";
  eventType:
    | "authorization_decision"
    | "invitation_event"
    | "key_rotation_event"
    | "security_transition";
  organizationId: string;
  actorId: string;
  sessionId?: string;
  authenticationMethod:
    | "entra_oidc"
    | "session_cookie"
    | "invitation_token"
    | "local_test";
  dossierId?: string;
  action: string;
  policyVersion: string;
  authorizationVersion: number;
  resourceRevision: number;
  requestCorrelationSha256: string;
  outcome: "allowed" | "denied";
  reasonCode: SecurityReceiptReason;
  resourceDigest?: string;
  occurredAtEpochSeconds: number;
  deploymentSha: string;
  environment: TenantResourceEnvironment;
  reviewerActorId?: string;
}

export interface SecurityReceipt extends SecurityReceiptInput {
  sequence: number;
  previousDigest: string;
  digest: string;
}

const SECURITY_RECEIPT_INPUT_KEYS = new Set<string>([
  "schemaVersion",
  "eventType",
  "organizationId",
  "actorId",
  "sessionId",
  "authenticationMethod",
  "dossierId",
  "action",
  "policyVersion",
  "authorizationVersion",
  "resourceRevision",
  "requestCorrelationSha256",
  "outcome",
  "reasonCode",
  "resourceDigest",
  "occurredAtEpochSeconds",
  "deploymentSha",
  "environment",
  "reviewerActorId",
]);

const SECURITY_RECEIPT_KEYS = new Set<string>([
  ...SECURITY_RECEIPT_INPUT_KEYS,
  "sequence",
  "previousDigest",
  "digest",
]);

function hasOnlyReceiptKeys(
  value: object,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && allowedKeys.has(key),
  );
}

function receiptDigestPayload(receipt: Omit<SecurityReceipt, "digest">): string {
  return canonicalJson(receipt);
}

export async function verifySecurityReceiptChain(
  receipts: readonly SecurityReceipt[],
): Promise<boolean> {
  let previousDigest = "0".repeat(64);
  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index];
    if (
      !hasOnlyReceiptKeys(receipt, SECURITY_RECEIPT_KEYS) ||
      receipt.sequence !== index + 1 ||
      !constantTimeStringEqual(receipt.previousDigest, previousDigest)
    ) {
      return false;
    }
    const { digest, ...payload } = receipt;
    const expectedDigest = await sha256Hex(receiptDigestPayload(payload));
    if (!constantTimeStringEqual(digest, expectedDigest)) {
      return false;
    }
    previousDigest = digest;
  }
  return true;
}

/** Append-only in-memory reference implementation for adapter and chain tests. */
export class InMemorySecurityReceiptChain {
  readonly #receipts: SecurityReceipt[] = [];
  #appendTail: Promise<void> = Promise.resolve();

  append(input: SecurityReceiptInput): Promise<SecurityReceipt> {
    const capturedInput = deepFreeze(structuredClone(input));
    const operation = this.#appendTail.then(() =>
      this.#appendSerialized(capturedInput),
    );
    this.#appendTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async #appendSerialized(input: SecurityReceiptInput): Promise<SecurityReceipt> {
    if (
      !hasOnlyReceiptKeys(input, SECURITY_RECEIPT_INPUT_KEYS) ||
      input.schemaVersion !== "security-receipt.v1" ||
      ![
        "authorization_decision",
        "invitation_event",
        "key_rotation_event",
        "security_transition",
      ].includes(input.eventType) ||
      ![
        "entra_oidc",
        "session_cookie",
        "invitation_token",
        "local_test",
      ].includes(input.authenticationMethod) ||
      ![
        "authorized",
        "policy_denied",
        "tenant_boundary_denied",
        "stale_authority_denied",
        "replay_denied",
        "malformed_context_denied",
        "stale_resource_denied",
        "manifest_denied",
        "security_transition",
      ].includes(input.reasonCode) ||
      (input.outcome !== "allowed" && input.outcome !== "denied") ||
      !isOpaqueId(input.organizationId) ||
      !isOpaqueId(input.actorId) ||
      (input.sessionId !== undefined && !isOpaqueId(input.sessionId)) ||
      (input.dossierId !== undefined && !isOpaqueId(input.dossierId)) ||
      (input.reviewerActorId !== undefined &&
        !isOpaqueId(input.reviewerActorId)) ||
      !/^[A-Za-z0-9._:-]{1,128}$/u.test(input.action) ||
      !/^[A-Za-z0-9._-]{1,64}$/u.test(input.policyVersion) ||
      !isPositiveSafeInteger(input.authorizationVersion) ||
      !isPositiveSafeInteger(input.resourceRevision) ||
      !isSha256(input.requestCorrelationSha256) ||
      (input.resourceDigest !== undefined && !isSha256(input.resourceDigest)) ||
      !isPositiveSafeInteger(input.occurredAtEpochSeconds) ||
      !/^[a-f0-9]{40}$/u.test(input.deploymentSha) ||
      !TENANT_RESOURCE_ENVIRONMENTS.some(
        (environment) => environment === input.environment,
      )
    ) {
      throw new TypeError("invalid privacy-safe security receipt input");
    }
    const payload: Omit<SecurityReceipt, "digest"> = {
      ...structuredClone(input),
      sequence: this.#receipts.length + 1,
      previousDigest:
        this.#receipts[this.#receipts.length - 1]?.digest ?? "0".repeat(64),
    };
    const receipt: SecurityReceipt = {
      ...payload,
      digest: await sha256Hex(receiptDigestPayload(payload)),
    };
    this.#receipts.push(Object.freeze(receipt));
    return structuredClone(receipt);
  }

  entries(): readonly SecurityReceipt[] {
    return this.#receipts.map((receipt) => structuredClone(receipt));
  }

  async verify(): Promise<boolean> {
    await this.#appendTail;
    return verifySecurityReceiptChain(this.#receipts);
  }
}

export function decodeUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}
