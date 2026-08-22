# Local authentication v12

## Identity boundary

GENESIS: JURIS has two authentication sources. A trusted ChatGPT identity header is evaluated first; otherwise the server may resolve the `__Host-genesis_session` cookie against D1. The resolved identity carries an explicit `authSource` value of `chatgpt` or `local`.

Initial local-credential enrollment is not public email signup. It is permitted only inside a trusted ChatGPT session, and the account email is taken exclusively from that server-provided identity. The form cannot choose an email. This one-time identity proof prevents a local registrant from claiming an existing practitioner email and its email-based case ACLs.

A local identity can use ordinary case ACLs for the same canonical email. It can never become a platform administrator: the administrator guard requires `authSource === "chatgpt"` before consulting `GENESIS_ADMIN_EMAILS`. The local email is not described as independently verified.

## Credential and session storage

- Passwords are 10–128 Unicode characters and require an uppercase letter, digit and special character. They are not trimmed, normalized or truncated.
- D1 stores only PBKDF2-HMAC-SHA256 output with 600,000 iterations and a fresh 256-bit salt. Algorithm and work factor are stored with the credential; unsafe or corrupt parameters fail closed.
- Session tokens and recovery/reset tokens are high-entropy opaque values. Only SHA-256 token hashes are stored. Authenticity comparisons use the Workers timing-safe primitive, with a fixed-length full-loop fallback used by the Node test runtime.
- The session cookie is host-only (`__Host-`), `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to `/`, and has no `Domain` attribute. Sessions have a seven-day absolute lifetime, a twelve-hour idle limit and a five-minute touch interval.
- Every credential mutation requires an exact matching `Origin`, `Sec-Fetch-Site: same-origin`, bounded JSON and a non-cacheable response.
- Login and recovery attempts are limited by both canonical email and Cloudflare connection IP. Subjects are HMAC-pseudonymized using the server-only `platform_secrets/auth-subject-hmac-v1` key; raw email and IP values are not written to the auth limiter or auth audit.

## Enrollment, login and recovery

`POST /api/auth/register` enrolls a password only for the current trusted ChatGPT identity, creates a local session, and displays a 256-bit offline recovery code once. D1 stores only the code hash.

`POST /api/auth/login` uses a generic failure response for unknown, disabled and wrong-password accounts. Unknown-account processing performs the same configured PBKDF2 work as a real attempt. Successful insertion is bound to the exact password hash and `passwordChangedAt` generation that was checked, closing the login/reset race.

No transactional mail binding exists, so the application does not claim to send password-reset email. Two recovery proofs are supported:

1. `POST /api/auth/recover` accepts the canonical email, the display-once offline code and a new password.
2. `POST /api/auth/reset` accepts the trusted ChatGPT identity for the exact local account email and a new password.

Both flows atomically consume the active recovery proof, change the password, revoke every earlier session and reset token, create one replacement recovery code, and establish a new local session. The replacement code is returned once. The `password_reset_tokens` table is an expiring, single-use, hash-only contract reserved for future side-channel delivery; no public endpoint currently issues or exposes such a token.

`POST /api/auth/logout` revokes the current local server session and always expires the browser cookie. If D1 revocation is unavailable, the response says so while still clearing the local cookie.

## Deletion and audit

`DELETE /api/me` removes the profile’s local credential, sessions, recovery/reset records, email-keyed rate-limit records and associated auth audit entries, then expires the local cookie. Network-only limiter records are shared pseudonymous abuse-control data and age out after seven days.

Security audit details contain event type, outcome, HMAC-pseudonymized subjects and bounded reason metadata. Passwords, salts, raw session tokens, recovery codes and reset tokens are never logged or stored in audit details. All `/api/auth/*` and `/api/me` identity responses use `Cache-Control: private, no-store`.

## Operational notes

Apply Drizzle migration `0006_concerned_korath.sql` before enabling local enrollment. The migration adds `local_accounts`, `auth_sessions`, `account_recovery_codes`, `password_reset_tokens`, `auth_rate_limit_events`, `auth_audit_events` and `platform_secrets`. `platform_secrets` is server-only storage and must never be exposed by a route or database export intended for users.

The `/account` page is the lifecycle UI for ChatGPT-backed enrollment, local login, local logout, trusted-identity reset and offline-code recovery. The recovery code is held only in transient component state and is not written to browser storage or a URL.
