# Local authentication v16

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

Three recovery proofs are supported:

1. `POST /api/auth/recover` accepts the canonical email, the display-once offline code and a new password.
2. `POST /api/auth/reset` accepts the trusted ChatGPT identity for the exact local account email and a new password.
3. `POST /api/auth/forgot-password` accepts an email and, when the transactional sender is configured, issues a 15-minute link to the stored account address. `POST /api/auth/email-reset` consumes that single-use proof and a new password.

Every successful recovery atomically consumes the active proof, changes the password, revokes every earlier session and reset token, and creates one replacement recovery code. Trusted-identity and offline-code recovery establish a new local session and display the replacement code once. Email recovery deliberately does neither: the user receives a success page and must sign in with the new password, so possession of a forwarded link cannot silently create a logged-in browser session.

Only a SHA-256 hash of an email-reset token is persisted; the raw token appears only in the HTTPS link sent by the server-side mail adapter. At most one unused token can exist per account, the prior token is consumed on reissue, and token consumption is compare-and-swap protected with a unique per-attempt nonce. Two concurrent reset attempts therefore cannot both satisfy the final atomic proof check, even if they share a timestamp. Forgot-password always returns the same generic response whether the account exists, is disabled, mail is unavailable or delivery fails. The route is subject to email and network rate limits and never returns the token or delivery details.

An authenticated platform administrator can request the same email through `POST /api/admin/users/password-reset`. The target must be an active local account selected from the server-provided user list. This action sends the stored address only; it cannot set a password, reveal a reset token or impersonate the user, and it is recorded in the security audit. Administrator authority requires both `authSource === "chatgpt"` and membership in the `GENESIS_ADMIN_EMAILS` allowlist. A local-password session is never administrative, even when its email matches that list.

`POST /api/auth/logout` revokes the current local server session and always expires the browser cookie. If D1 revocation is unavailable, the response says so while still clearing the local cookie.

## Deletion and audit

`DELETE /api/me` removes the profile’s local credential, sessions, recovery/reset records, subscriptions, private workspace drafts, grants, feedback, email-keyed rate-limit records and associated auth audit entries, then expires the local cookie. Network-only limiter records are shared pseudonymous abuse-control data and age out after seven days. Immutable General Library versions already published after review are a separate public editorial record and are not silently rewritten by account deletion; the UI discloses this before deletion and directs correction or pseudonymisation requests to the operator.

Security audit details contain event type, outcome, HMAC-pseudonymized subjects and bounded reason metadata. Passwords, salts, raw session tokens, recovery codes and reset tokens are never logged or stored in audit details. All `/api/auth/*` and `/api/me` identity responses use `Cache-Control: private, no-store`.

## Operational notes

Apply all Drizzle migrations through `0010_square_scalphunter.sql` before enabling this release. Migration `0006_concerned_korath.sql` adds `local_accounts`, `auth_sessions`, `account_recovery_codes`, `password_reset_tokens`, `auth_rate_limit_events`, `auth_audit_events` and `platform_secrets`; migration `0008_first_hitman.sql` enforces one active email-reset token per account after safely consuming any historical duplicates; `0009_medical_princess_powerful.sql` adds the short-lived AI capacity leases; and `0010_square_scalphunter.sql` adds the workspace pagination indexes. `platform_secrets` is server-only storage and must never be exposed by a route or database export intended for users.

The `/account` page is the lifecycle UI for ChatGPT-backed enrollment, local login, local logout, email-reset request, trusted-identity reset and offline-code recovery. `/account/reset` verifies and consumes emailed reset links. Recovery codes are held only in transient component state and are not written to browser storage or a URL.

Transactional email is feature-gated. Configure `RESEND_API_KEY`, `GENESIS_RESET_FROM_EMAIL` and the exact HTTPS `GENESIS_PUBLIC_ORIGIN` in the server runtime; no value is exposed to client JavaScript. If any required value is absent, the UI keeps email reset disabled and directs users to the trusted-identity or offline-code fallback.
