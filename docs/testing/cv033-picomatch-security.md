# CV-033 - 18 November 2026

Acceptance: preserve both full and production dependency audits; block vulnerable
repeated extglobs on both installed major lines; preserve ordinary build matching;
pass exact-head CI before ordered merges and release.

Both maintained packages route single non-literal repeated branches through the
existing literal fallback before the depth opt-out. This intentionally restricts
complex repeated extglobs. Vendor notes preserve tarball hashes and MIT licenses.

Five focused tests pass using node --test tests/picomatch-security.test.ts.
Bounded subprocesses cover plus/star wildcards, nested optional branches, long
near-misses and depth-guard opt-out. Recursive extension globs, literal
alternatives/repetition and negative extglobs retain expected behavior.
Sandbox tsx failed OS user lookup; direct Node passed.
Pinned npm 10.9.8 resolves the isolated dependency lock with zero vulnerabilities.
Full CI and production acceptance remain pending. CV-010 still needs an active
test client.

## Resolution - public v222

The clean npm 10.9.8 install loaded @casevant/picomatch4 at the root and
@casevant/picomatch2 through micromatch. Both full and production audits found
zero vulnerabilities; focused ESLint and TypeScript passed. All 18 exact-head
checks on #315 passed before its ordered merge, followed by all 18 on #316.
Exact-main web/PDF validation also passed before v222 publication.
Both live origins verified the exact merged runtime and all 222 assets.

CV-033 is resolved. Keep the documented complex repeated-extglob restriction
visible in vendor notes and review a future upstream fix before replacing these
maintenance forks. CV-010 live acceptance remains pending an active test client.
