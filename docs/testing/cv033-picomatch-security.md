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
