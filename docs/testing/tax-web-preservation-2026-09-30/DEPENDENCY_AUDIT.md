# Dependency audit correction

The exact preservation candidate `00b1e390d768edbd0721f23de79c8d435aa1fed5`
failed both web jobs at the unchanged complete-tree dependency audit:
push run `36745293443` / job `109989823088`, and PR run `36745326960` /
job `109989936871`. This was not a passing unified web suite. The latter log
reported Next.js `16.3.4` affected by `GHSA-vcvr-r3jv-pc5j`.

The [maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
identifies the Node `next/og` ImageResponse path and fixes beginning with
`16.3.6`. The reviewed correction pins Next.js and its matching ESLint config
to the published patch release `16.3.8`, with only their resolved package
family and platform metadata updated in the lock. No audit threshold,
dependency exclusion or application acceptance gate changes.

Local installation with scripts disabled completed. The complete-tree
`npm audit --audit-level=low --json` returned exit 0 and zero findings across
all severities. This establishes the dependency correction; fresh build,
runtime packaging and hosted checks belong to the corrected source and must
complete before merge. Earlier `00b1e39` build/runtime/browser receipts remain
labelled with that source, not relabelled as patched-head results.

This patch does not establish product deployment, tax-v2 editor/PDF activation
or physical-device acceptance.
