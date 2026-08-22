import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  clearSessionCookie,
  createPasswordCredential,
  generateRecoveryCode,
  generateSessionToken,
  hashOpaqueToken,
  PBKDF2_ALGORITHM,
  PBKDF2_ITERATIONS,
  readSessionCookie,
  sessionCookie,
  SESSION_COOKIE_NAME,
  timingSafeEqual,
  timingSafeTokenHashMatch,
  validatePassword,
  verifyPassword,
} from "../app/auth-crypto";
import { authJson, INVALID_LOGIN_MESSAGE, INVALID_RECOVERY_MESSAGE } from "../app/auth-http";
import { isSameOriginCredentialMutation } from "../app/request-security";

const migrations = [
  "0000_worthless_supreme_intelligence.sql",
  "0001_right_talon.sql",
  "0002_greedy_darkstar.sql",
  "0003_unusual_zarda.sql",
  "0004_petite_komodo.sql",
  "0005_dapper_nightcrawler.sql",
  "0006_concerned_korath.sql",
] as const;

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) {
    db.exec(readFileSync(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));
  }
  return db;
}

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("password policy enforces the v12 bounds and required character classes", () => {
  assert.equal(validatePassword("Abcdefg1!x"), null);
  assert.equal(validatePassword(`A1!${"a".repeat(125)}`), null);
  assert.match(validatePassword("Abc1!abcd") ?? "", /10–128/);
  assert.match(validatePassword(`A1!${"a".repeat(126)}`) ?? "", /10–128/);
  assert.match(validatePassword("abcdefg1!x") ?? "", /uppercase/);
  assert.match(validatePassword("Abcdefghi!x") ?? "", /digit/);
  assert.match(validatePassword("Abcdefg12x") ?? "", /special/);
  assert.match(validatePassword("Abcdefg1!\n") ?? "", /control/);
  assert.equal(validatePassword("Žebra9!aaaa"), null, "Unicode uppercase letters remain valid and exact");
});

test("PBKDF2 credentials use 600k iterations, unique salts and exact comparisons", async () => {
  const password = "Žebra9!aaaa";
  const first = await createPasswordCredential(password);
  const second = await createPasswordCredential(password);
  assert.equal(first.algorithm, PBKDF2_ALGORITHM);
  assert.equal(first.iterations, PBKDF2_ITERATIONS);
  assert.match(first.salt, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("Zebra9!aaaa", first), false);
  assert.equal(await verifyPassword(password, { ...first, iterations: PBKDF2_ITERATIONS - 1 }), false);
  assert.equal(await verifyPassword(password, { ...first, iterations: 2_000_001 }), false);
  assert.equal(await verifyPassword(password, { ...first, salt: "not+base64" }), false);
  assert.equal(await verifyPassword(password, { ...first, hash: "AAAA" }), false);
});

test("opaque session and recovery secrets are high entropy, hashed and compared safely", async () => {
  const session = generateSessionToken();
  const recovery = generateRecoveryCode();
  const sessionHash = await hashOpaqueToken(session);
  const recoveryHash = await hashOpaqueToken(recovery);
  assert.match(session, /^[A-Za-z0-9_-]{43}$/);
  assert.match(recovery, /^GJRC-[A-Za-z0-9_-]{43}$/);
  assert.match(sessionHash, /^[A-Za-z0-9_-]{43}$/);
  assert.match(recoveryHash, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(sessionHash, session);
  assert.notEqual(recoveryHash, recovery);
  assert.equal(await timingSafeTokenHashMatch(session, sessionHash), true);
  const replacement = session.endsWith("A") ? "B" : "A";
  assert.equal(await timingSafeTokenHashMatch(`${session.slice(0, -1)}${replacement}`, sessionHash), false);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2])), false);
});

test("local session cookie is host-only, secure, HttpOnly and SameSite=Lax", () => {
  const token = "A".repeat(43);
  const serialized = sessionCookie(token);
  assert.match(serialized, new RegExp(`^${SESSION_COOKIE_NAME}=${token};`));
  assert.match(serialized, /; Path=\//);
  assert.match(serialized, /; Max-Age=604800/);
  assert.match(serialized, /; HttpOnly/);
  assert.match(serialized, /; Secure/);
  assert.match(serialized, /; SameSite=Lax/);
  assert.doesNotMatch(serialized, /Domain=/i);
  assert.equal(readSessionCookie(`theme=dark; ${serialized.split(";")[0]}`), token);
  assert.equal(readSessionCookie(`${SESSION_COOKIE_NAME}=short`), null);
  assert.match(clearSessionCookie(), /Max-Age=0/);
  assert.match(clearSessionCookie(), /Expires=Thu, 01 Jan 1970/);
});

test("credential mutations require exact origin and same-origin Fetch Metadata", () => {
  const exact = new Request("https://juris.example/api/auth/login", {
    method: "POST",
    headers: { origin: "https://juris.example", "sec-fetch-site": "same-origin" },
  });
  assert.equal(isSameOriginCredentialMutation(exact), true);
  const rejectedHeaders: HeadersInit[] = [
    { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    { origin: "https://juris.example", "sec-fetch-site": "same-site" },
    { origin: "https://juris.example" },
    { "sec-fetch-site": "same-origin" },
    { origin: "https://juris.example.evil", "sec-fetch-site": "same-origin" },
  ];
  for (const headers of rejectedHeaders) {
    assert.equal(isSameOriginCredentialMutation(new Request("https://juris.example/api/auth/login", { method: "POST", headers })), false);
  }
});

test("auth JSON is never cacheable and generic errors do not enumerate accounts", () => {
  const response = authJson({ ok: true }, 200, sessionCookie("A".repeat(43)));
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.equal(INVALID_LOGIN_MESSAGE, "Invalid email or password.");
  assert.equal(INVALID_RECOVERY_MESSAGE, "The recovery credentials are invalid or expired.");
});

test("migration 0006 creates constrained auth storage and permits no plaintext token columns", () => {
  const db = migratedDatabase();
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  const expectedTables = [
    "local_accounts",
    "auth_sessions",
    "account_recovery_codes",
    "password_reset_tokens",
    "auth_rate_limit_events",
    "auth_audit_events",
    "platform_secrets",
  ];
  const actualTables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name));
  for (const table of expectedTables) assert.ok(actualTables.has(table), `${table} must exist`);

  const sessionColumns = (db.prepare("PRAGMA table_info(auth_sessions)").all() as Array<{ name: string }>).map((row) => row.name);
  const recoveryColumns = (db.prepare("PRAGMA table_info(account_recovery_codes)").all() as Array<{ name: string }>).map((row) => row.name);
  const resetColumns = (db.prepare("PRAGMA table_info(password_reset_tokens)").all() as Array<{ name: string }>).map((row) => row.name);
  assert.ok(sessionColumns.includes("token_hash"));
  assert.ok(recoveryColumns.includes("code_hash"));
  assert.ok(resetColumns.includes("token_hash"));
  assert.ok(!sessionColumns.includes("token"));
  assert.ok(!recoveryColumns.includes("code"));
  assert.ok(!resetColumns.includes("token"));

  db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run("lawyer@example.com", "Lawyer");
  const account = db.prepare(`
    INSERT INTO local_accounts (user_email, password_hash, password_salt, password_iterations)
    VALUES (?, ?, ?, ?)
  `).run("lawyer@example.com", "hash", "salt", PBKDF2_ITERATIONS);
  const accountId = Number(account.lastInsertRowid);
  assert.throws(() => db.prepare(`
    INSERT INTO local_accounts (user_email, password_hash, password_salt, password_iterations)
    VALUES (?, ?, ?, ?)
  `).run("lawyer@example.com", "other", "other", PBKDF2_ITERATIONS), /UNIQUE/);
  db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run("weak@example.com", "Weak");
  assert.throws(() => db.prepare(`
    INSERT INTO local_accounts (user_email, password_hash, password_salt, password_iterations)
    VALUES (?, ?, ?, ?)
  `).run("weak@example.com", "hash", "salt", PBKDF2_ITERATIONS - 1), /CHECK/);

  db.prepare("INSERT INTO auth_sessions (account_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(accountId, "session-hash", "2099-01-01T00:00:00.000Z");
  db.prepare("INSERT INTO account_recovery_codes (account_id, code_hash) VALUES (?, ?)").run(accountId, "recovery-hash-1");
  assert.throws(() => db.prepare("INSERT INTO account_recovery_codes (account_id, code_hash) VALUES (?, ?)").run(accountId, "recovery-hash-2"), /UNIQUE/);
  db.prepare("UPDATE account_recovery_codes SET used_at = ? WHERE account_id = ?").run("2026-08-22T00:00:00.000Z", accountId);
  db.prepare("INSERT INTO account_recovery_codes (account_id, code_hash) VALUES (?, ?)").run(accountId, "recovery-hash-2");
  db.prepare("INSERT INTO password_reset_tokens (account_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(accountId, "reset-hash", "2099-01-01T00:00:00.000Z");
  db.prepare("INSERT INTO auth_audit_events (account_id, event_type, subject_hash) VALUES (?, ?, ?)")
    .run(accountId, "local_login", "subject-hmac");
  db.prepare("INSERT INTO platform_secrets (id, secret) VALUES (?, ?)").run("auth-subject-hmac-v1", "server-only-secret");

  db.prepare("DELETE FROM users WHERE email = ?").run("lawyer@example.com");
  assert.equal(db.prepare("SELECT count(*) AS count FROM local_accounts WHERE id = ?").get(accountId)?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM auth_sessions WHERE account_id = ?").get(accountId)?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM account_recovery_codes WHERE account_id = ?").get(accountId)?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM password_reset_tokens WHERE account_id = ?").get(accountId)?.count, 0);
  assert.equal(db.prepare("SELECT account_id FROM auth_audit_events WHERE event_type = 'local_login'").get()?.account_id, null);
});

test("source contracts keep ChatGPT first, local admins impossible and recovery atomic", () => {
  const identity = source("app/chatgpt-auth.ts");
  assert.ok(identity.indexOf("if (email)") < identity.indexOf("return await getLocalSessionUser"), "trusted header must win over a local cookie");
  assert.match(identity, /authSource:\s*"chatgpt"/);
  assert.match(identity, /return await getLocalSessionUser/);

  const authorization = source("app/server-authorization.ts");
  assert.match(authorization, /identity\.authSource !== "chatgpt"/);
  assert.ok(authorization.indexOf("identity.authSource") < authorization.indexOf("GENESIS_ADMIN_EMAILS"));
  for (const route of ["cases", "feedback", "releases", "submissions", "users"]) {
    assert.match(source(`app/api/admin/${route}/route.ts`), /isPlatformAdmin\(identity\)/);
  }
  assert.match(source("app/api/me/route.ts"), /isAdmin:\s*isPlatformAdmin\(identity\)/);

  const register = source("app/api/auth/register/route.ts");
  assert.match(register, /identity\.authSource !== "chatgpt"/);
  assert.match(register, /enrollmentProof:\s*"trusted_chatgpt_identity"/);
  assert.match(register, /tokenHash:\s*session\.tokenHash/);
  assert.match(register, /codeHash:\s*recoveryCodeHash/);
  assert.match(register, /createdAt:\s*now/);
  assert.doesNotMatch(register, /payload\.email/);

  const login = source("app/api/auth/login/route.ts");
  assert.match(login, /consumeDummyPasswordWork/);
  assert.ok(login.includes("AND ${localAccounts.passwordChangedAt} = ${account.passwordChangedAt}"));
  assert.match(login, /tokenHash:\s*session\.tokenHash/);

  for (const route of ["register", "login", "logout", "recover", "reset"]) {
    const routeSource = source(`app/api/auth/${route}/route.ts`);
    assert.match(routeSource, /isSameOriginCredentialMutation/);
    assert.match(routeSource, /authJson/);
    assert.doesNotMatch(routeSource, /console\.(?:log|info|debug)/);
  }

  for (const route of ["recover", "reset"]) {
    const routeSource = source(`app/api/auth/${route}/route.ts`);
    assert.match(routeSource, /isNull\(accountRecoveryCodes\.usedAt\)/);
    assert.match(routeSource, /passwordChangedAt:\s*now/);
    assert.match(routeSource, /authSessions\)\.set\(\{ revokedAt:\s*now \}\)/);
    assert.match(routeSource, /nextRecoveryHash/);
    assert.match(routeSource, /db\.batch\(/);
  }

  const localSession = source("app/local-auth.ts");
  assert.match(localSession, /isNull\(authSessions\.revokedAt\)/);
  assert.match(localSession, /gt\(authSessions\.expiresAt, now\)/);
  assert.match(localSession, /gt\(authSessions\.lastSeenAt, idleCutoff\)/);
  assert.match(localSession, /sessionCreatedAt < record\.passwordChangedAt/);
  assert.match(localSession, /timingSafeTokenHashMatch/);
  assert.match(localSession, /crypto\.subtle\.sign\("HMAC"/);
  assert.match(localSession, /cf-connecting-ip/);
  assert.doesNotMatch(localSession, /x-forwarded-for/i);
});

test("profile deletion clears local auth data and all identity responses are no-store", () => {
  const me = source("app/api/me/route.ts");
  assert.match(me, /db\.delete\(authAuditEvents\)/);
  assert.match(me, /db\.delete\(authRateLimitEvents\)/);
  assert.match(me, /db\.delete\(users\)/);
  assert.match(me, /clearSessionCookie\(\)/);
  assert.doesNotMatch(me, /return Response\.json/);
  assert.ok((me.match(/return authJson/g) ?? []).length >= 8);

  const ui = source("app/account/AccountClient.tsx");
  assert.match(ui, /No email provider is configured/);
  assert.match(ui, /offline recovery code/);
  assert.match(ui, /trusted ChatGPT identity/);
  assert.match(ui, /never grants platform-administrator rights/);
  assert.match(ui, /localStorage\.removeItem/);
  assert.doesNotMatch(ui, /localStorage\.(?:getItem|setItem)|sessionStorage/);
  assert.doesNotMatch(`${ui}\n${source("app/api/auth/register/route.ts")}`, /email verified|verified email/i);
});
