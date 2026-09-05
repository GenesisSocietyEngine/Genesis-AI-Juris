import {
  base64UrlEncode,
  constantTimeStringEqual,
  isExactHttpsOrigin,
  isOpaqueId,
  isPositiveSafeInteger,
  isStableOidcIdentityKey,
  secureRandomBytes,
  sha256Base64Url,
  sha256Hex,
} from "./tenant-foundation";

export interface EntraOidcConnection {
  id: string;
  organizationId: string;
  revision: number;
  enabled: boolean;
  issuer: string;
  tenantId: string;
  clientId: string;
  redirectUri: string;
}

export interface OidcAuthorizationTransaction {
  id: string;
  organizationId: string;
  connectionId: string;
  connectionRevision: number;
  issuer: string;
  tenantId: string;
  clientId: string;
  redirectUri: string;
  exactOrigin: string;
  browserBinding: string;
  stateDigest: string;
  nonceDigest: string;
  codeVerifier: string;
  codeChallenge: string;
  createdAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
}

export interface OidcAuthorizationParameters {
  response_type: "code";
  response_mode: "query";
  client_id: string;
  redirect_uri: string;
  scope: "openid profile";
  state: string;
  nonce: string;
  code_challenge: string;
  code_challenge_method: "S256";
}

export async function createOidcAuthorizationTransaction(input: {
  connection: EntraOidcConnection;
  exactOrigin: string;
  browserBinding: string;
  nowEpochSeconds: number;
  lifetimeSeconds?: number;
  randomBytes?: (length: number) => Uint8Array;
}): Promise<{
  transaction: OidcAuthorizationTransaction;
  authorizationParameters: OidcAuthorizationParameters;
}> {
  const connection = structuredClone(input.connection);
  const exactOrigin = input.exactOrigin;
  const browserBinding = input.browserBinding;
  const nowEpochSeconds = input.nowEpochSeconds;
  const requestedLifetimeSeconds = input.lifetimeSeconds;
  const randomBytes = input.randomBytes ?? secureRandomBytes;
  assertValidConnection(connection);
  if (connection.enabled !== true) {
    throw new Error("OIDC connection unavailable");
  }
  if (
    !isExactHttpsOrigin(exactOrigin) ||
    !isOpaqueId(browserBinding) ||
    !isPositiveSafeInteger(nowEpochSeconds)
  ) {
    throw new TypeError("invalid OIDC authorization context");
  }
  const lifetimeSeconds = requestedLifetimeSeconds ?? 300;
  if (
    !Number.isSafeInteger(lifetimeSeconds) ||
    lifetimeSeconds < 60 ||
    lifetimeSeconds > 600 ||
    !Number.isSafeInteger(nowEpochSeconds + lifetimeSeconds)
  ) {
    throw new TypeError("OIDC transaction lifetime must be between 60 and 600 seconds");
  }
  const stateBytes = randomBytes(32);
  const nonceBytes = randomBytes(32);
  const verifierBytes = randomBytes(48);
  const idBytes = randomBytes(18);
  if (
    stateBytes.byteLength < 32 ||
    nonceBytes.byteLength < 32 ||
    verifierBytes.byteLength < 32 ||
    idBytes.byteLength < 16
  ) {
    throw new TypeError("OIDC correlation secrets do not meet entropy requirements");
  }
  const state = base64UrlEncode(stateBytes);
  const nonce = base64UrlEncode(nonceBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new TypeError("PKCE verifier length is outside RFC 7636 bounds");
  }
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const transaction: OidcAuthorizationTransaction = {
    id: base64UrlEncode(idBytes),
    organizationId: connection.organizationId,
    connectionId: connection.id,
    connectionRevision: connection.revision,
    issuer: connection.issuer,
    tenantId: connection.tenantId,
    clientId: connection.clientId,
    redirectUri: connection.redirectUri,
    exactOrigin,
    browserBinding,
    stateDigest: await sha256Hex(state),
    nonceDigest: await sha256Hex(nonce),
    codeVerifier,
    codeChallenge,
    createdAtEpochSeconds: nowEpochSeconds,
    expiresAtEpochSeconds: nowEpochSeconds + lifetimeSeconds,
  };
  return {
    transaction,
    authorizationParameters: {
      response_type: "code",
      response_mode: "query",
      client_id: connection.clientId,
      redirect_uri: connection.redirectUri,
      scope: "openid profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    },
  };
}

function assertExactHttpsUrl(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${name} must be an absolute URL`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.search
  ) {
    throw new TypeError(`${name} must be an exact HTTPS URL without credentials, query, or fragment`);
  }
}

function assertValidConnection(connection: EntraOidcConnection): void {
  assertExactHttpsUrl(connection.issuer, "issuer");
  assertExactHttpsUrl(connection.redirectUri, "redirect URI");
  if (
    typeof connection.enabled !== "boolean" ||
    !connection.id ||
    !connection.organizationId ||
    !connection.tenantId ||
    !connection.clientId ||
    !Number.isSafeInteger(connection.revision) ||
    connection.revision < 1
  ) {
    throw new TypeError("invalid OIDC connection");
  }
}

/**
 * Local replay boundary. A production adapter must atomically claim the persisted
 * transaction before token exchange and retain a bounded replay tombstone.
 */
export class InMemoryOidcTransactionStore {
  readonly #available = new Map<string, OidcAuthorizationTransaction>();
  readonly #consumed = new Set<string>();

  insert(transaction: OidcAuthorizationTransaction): void {
    if (this.#available.has(transaction.id) || this.#consumed.has(transaction.id)) {
      throw new Error("OIDC transaction already exists");
    }
    this.#available.set(transaction.id, structuredClone(transaction));
  }

  claim(transactionId: string): OidcAuthorizationTransaction | undefined {
    const transaction = this.#available.get(transactionId);
    if (!transaction || this.#consumed.has(transactionId)) {
      return undefined;
    }
    this.#available.delete(transactionId);
    this.#consumed.add(transactionId);
    return structuredClone(transaction);
  }

  wasConsumed(transactionId: string): boolean {
    return this.#consumed.has(transactionId);
  }
}

export interface VerifiedOidcClaims {
  iss: string;
  aud: string;
  tid: string;
  oid?: string;
  sub?: string;
  nonce: string;
  iat: number;
  nbf: number;
  exp: number;
}

export interface OidcCodeVerificationInput {
  authorizationCode: string;
  codeVerifier: string;
  redirectUri: string;
  expectedIssuer: string;
  expectedAudience: string;
  expectedTenantId: string;
}

/**
 * The adapter is responsible for code exchange and cryptographic ID-token
 * verification. Tests may inject a fake; this module never claims production
 * discovery, JWKS retrieval, signature validation, or token endpoint integration.
 */
export type OidcCodeVerifier = (
  input: OidcCodeVerificationInput,
) => Promise<VerifiedOidcClaims>;

export type OidcCallbackResult =
  | {
      ok: true;
      organizationId: string;
      connectionId: string;
      stableIdentityKey: string;
      subject: string;
    }
  | { ok: false; code: "identity_unavailable" };

const OIDC_DENIAL: OidcCallbackResult = {
  ok: false,
  code: "identity_unavailable",
};

function denyOidc(): OidcCallbackResult {
  return { ...OIDC_DENIAL };
}

export async function validateOidcCallback(input: {
  store: InMemoryOidcTransactionStore;
  transactionId: string;
  state: string;
  authorizationCode: string;
  connection: EntraOidcConnection;
  exactOrigin: string;
  browserBinding: string;
  nowEpochSeconds: number;
  verifier?: OidcCodeVerifier;
  maximumClockSkewSeconds?: number;
}): Promise<OidcCallbackResult> {
  const store = input.store;
  const transactionId = input.transactionId;
  const state = input.state;
  const authorizationCode = input.authorizationCode;
  const connectionSource = input.connection;
  const exactOrigin = input.exactOrigin;
  const browserBinding = input.browserBinding;
  const nowEpochSeconds = input.nowEpochSeconds;
  const verifier = input.verifier;
  const clockSkew = input.maximumClockSkewSeconds ?? 60;
  // Claim first: every callback attempt is single-use, including malformed attempts.
  const transaction = store.claim(transactionId);
  if (!transaction) {
    return denyOidc();
  }
  let connection: EntraOidcConnection;
  try {
    connection = structuredClone(connectionSource);
  } catch {
    return denyOidc();
  }
  if (
    !Number.isSafeInteger(clockSkew) ||
    clockSkew < 0 ||
    clockSkew > 120 ||
    !verifier ||
    typeof state !== "string" ||
    typeof authorizationCode !== "string" ||
    !authorizationCode ||
    connection.enabled !== true ||
    !isExactHttpsOrigin(exactOrigin) ||
    !isOpaqueId(browserBinding) ||
    !isPositiveSafeInteger(nowEpochSeconds)
  ) {
    return denyOidc();
  }
  try {
    assertValidConnection(connection);
  } catch {
    return denyOidc();
  }

  const [stateDigest, codeChallenge] = await Promise.all([
    sha256Hex(state),
    sha256Base64Url(transaction.codeVerifier),
  ]);

  if (
    transaction.expiresAtEpochSeconds <= nowEpochSeconds ||
    transaction.createdAtEpochSeconds > nowEpochSeconds + clockSkew ||
    !constantTimeStringEqual(transaction.organizationId, connection.organizationId) ||
    !constantTimeStringEqual(transaction.connectionId, connection.id) ||
    transaction.connectionRevision !== connection.revision ||
    !constantTimeStringEqual(transaction.issuer, connection.issuer) ||
    !constantTimeStringEqual(transaction.tenantId, connection.tenantId) ||
    !constantTimeStringEqual(transaction.clientId, connection.clientId) ||
    !constantTimeStringEqual(transaction.redirectUri, connection.redirectUri) ||
    !constantTimeStringEqual(transaction.exactOrigin, exactOrigin) ||
    !constantTimeStringEqual(transaction.browserBinding, browserBinding) ||
    !constantTimeStringEqual(transaction.stateDigest, stateDigest) ||
    !constantTimeStringEqual(transaction.codeChallenge, codeChallenge)
  ) {
    return denyOidc();
  }

  let claims: VerifiedOidcClaims;
  try {
    const verifiedClaims = await verifier({
      authorizationCode,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
      expectedIssuer: transaction.issuer,
      expectedAudience: transaction.clientId,
      expectedTenantId: transaction.tenantId,
    });
    claims = structuredClone(verifiedClaims);
  } catch {
    return denyOidc();
  }

  if (
    typeof claims.iss !== "string" ||
    typeof claims.aud !== "string" ||
    typeof claims.tid !== "string" ||
    typeof claims.nonce !== "string" ||
    (claims.oid !== undefined && typeof claims.oid !== "string") ||
    (claims.sub !== undefined && typeof claims.sub !== "string")
  ) {
    return denyOidc();
  }
  const subject = claims.oid || claims.sub;
  const stableIdentityKey = subject
    ? `${claims.iss}\u001f${claims.tid}\u001f${subject}`
    : "";
  const nonceDigest = await sha256Hex(claims.nonce);
  if (
    !subject ||
    !isStableOidcIdentityKey(stableIdentityKey) ||
    !constantTimeStringEqual(claims.iss, transaction.issuer) ||
    !constantTimeStringEqual(claims.aud, transaction.clientId) ||
    !constantTimeStringEqual(claims.tid, transaction.tenantId) ||
    !constantTimeStringEqual(nonceDigest, transaction.nonceDigest) ||
    !Number.isFinite(claims.iat) ||
    !Number.isFinite(claims.nbf) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= nowEpochSeconds - clockSkew ||
    claims.nbf > nowEpochSeconds + clockSkew ||
    claims.iat > nowEpochSeconds + clockSkew ||
    claims.iat < transaction.createdAtEpochSeconds - clockSkew
  ) {
    return denyOidc();
  }

  return {
    ok: true,
    organizationId: transaction.organizationId,
    connectionId: transaction.connectionId,
    stableIdentityKey,
    subject,
  };
}
