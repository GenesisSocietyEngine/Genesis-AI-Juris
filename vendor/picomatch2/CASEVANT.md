# CV-033 maintenance patch

Upstream: picomatch 2.3.2, MIT, https://github.com/micromatch/picomatch.
Registry tarball SHA-256: 4c843ba015bec815ac52116162559ab7b4b4efbd3b86f7fcf38f3d770decace6.
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
