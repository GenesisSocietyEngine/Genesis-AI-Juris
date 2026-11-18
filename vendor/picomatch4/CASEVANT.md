# CV-033 maintenance patch

Upstream: picomatch 4.0.7, MIT, https://github.com/micromatch/picomatch.
Registry tarball SHA-256: 697b463be3cdbd9ffc8f4194fd5019a69ddf95875fb703d78b2b115cc9e740a8.
Advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf.

No fixed upstream version was published when checked on 18 November 2026.
The parser now sends single non-literal repeated extglob branches through its
existing literal fallback before the optional recursion guard can be disabled.
This deliberately restricts repeated extglobs containing wildcard/nested syntax;
ordinary wildcard globs and literal repeated extglobs remain supported.
The package identity records a maintained fork, not an unmodified audit exclusion.
Both installed major lines are preserved. Review removal after a fixed upstream
release. License and upstream source are retained.
Regression coverage: tests/picomatch-security.test.ts.
