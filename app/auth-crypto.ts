export const PBKDF2_ALGORITHM = "pbkdf2-hmac-sha256" as const;
export const PBKDF2_ITERATIONS = 600_000;
export const SESSION_COOKIE_NAME = "__Host-genesis_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

export type PasswordCredential = {
  algorithm: typeof PBKDF2_ALGORITHM;
  hash: string;
  salt: string;
  iterations: number;
};

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Password must be a string.";
  const characters = [...password];
  if (characters.length < 10 || characters.length > 128) return "Password must contain 10–128 characters.";
  if (/\p{Cc}/u.test(password)) return "Password cannot contain control characters.";
  if (!/\p{Lu}/u.test(password)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a digit.";
  if (!/[^\p{L}\p{N}\s]/u.test(password)) return "Password must contain a special character.";
  return null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /[\u0000-\u001f\u007f\s]/.test(email)) return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || at !== email.indexOf("@") || at > 64 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return null;
  if (domain.length > 253 || !domain.includes(".") || !domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return null;
  return email;
}

export async function createPasswordCredential(password: string): Promise<PasswordCredential> {
  const issue = validatePassword(password);
  if (issue) throw new Error(issue);
  const saltBytes = randomBytes(32);
  const hashBytes = await derivePasswordBytes(password, saltBytes, PBKDF2_ITERATIONS);
  return {
    algorithm: PBKDF2_ALGORITHM,
    hash: base64UrlEncode(hashBytes),
    salt: base64UrlEncode(saltBytes),
    iterations: PBKDF2_ITERATIONS,
  };
}

export async function verifyPassword(password: string, credential: Pick<PasswordCredential, "hash" | "salt" | "iterations">) {
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = base64UrlDecode(credential.salt);
    expected = base64UrlDecode(credential.hash);
  } catch {
    return false;
  }
  if (credential.iterations < PBKDF2_ITERATIONS || credential.iterations > 2_000_000 || salt.byteLength < 16 || expected.byteLength !== 32) return false;
  const actual = await derivePasswordBytes(password, salt, credential.iterations);
  return timingSafeEqual(actual, expected);
}

export async function consumeDummyPasswordWork(password: string) {
  // This fixed non-secret credential keeps unknown-account login timing close
  // to a real PBKDF2 verification without storing or comparing a password.
  const salt = base64UrlDecode("R0VORVNJUy1KVVJJUy1EVU1NWS1TQUxULVYxLTAwMDE");
  const actual = await derivePasswordBytes(password, salt, PBKDF2_ITERATIONS);
  const dummy = base64UrlDecode("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  timingSafeEqual(actual, dummy);
}

export function generateSessionToken() {
  return base64UrlEncode(randomBytes(32));
}

export function generateRecoveryCode() {
  return `GJRC-${base64UrlEncode(randomBytes(32))}`;
}

export async function hashOpaqueToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return base64UrlEncode(new Uint8Array(digest));
}

export function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: ArrayBufferView | ArrayBuffer, b: ArrayBufferView | ArrayBuffer) => boolean;
  };
  if (left.byteLength !== right.byteLength) {
    if (subtle.timingSafeEqual) subtle.timingSafeEqual(left, left);
    return false;
  }
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(left, right);
  // Node's test WebCrypto does not expose the Workers extension. Both inputs
  // have a fixed public length here; the full loop is the test-runtime fallback.
  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

export async function timingSafeTokenHashMatch(token: string, storedHash: string) {
  const actual = base64UrlDecode(await hashOpaqueToken(token));
  let expected: Uint8Array;
  try { expected = base64UrlDecode(storedHash); } catch { expected = new Uint8Array(32); }
  return timingSafeEqual(actual, expected);
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}

export function readSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const token = item.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }
  return null;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derivePasswordBytes(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(salt.byteLength);
  saltBuffer.set(salt);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer.buffer, iterations }, key, 256);
  return new Uint8Array(bits);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url value");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
