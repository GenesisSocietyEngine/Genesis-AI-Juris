# Callable compatibility surface for patched minimatch

This private CaseVant adapter exposes minimatch11.0.1 through the callable CommonJS surface required by existing ESLint consumers, alongside its modern named exports. It delegates every matching operation to the exact registry engine installed as @casevant/minimatch-engine; it does not backport or retain the old3.x matcher. The engine's source, license and integrity remain in its npm distribution and root lockfile.

The root direct dependency and override deduplicate lint consumers onto this adapter. The aliased engine is explicitly pinned11.0.1. Do not downgrade it or remove the callable wrapper without testing both consumer API families. Compatibility means the exercised lint/glob surfaces, not a claim of identical behavior for every historical undocumented API.

The pinned eslint-plugin-import rule consumes only `makeRe(pattern).test(path)`. The adapter provides that test interface using a patched Minimatch instance, without constructing or claiming to return a RegExp. Regex source/serialization/exec APIs are not supported. Do not broaden this adapter to a consumer that requires them without a separate review. The actual no-internal-modules rule is exercised, including allowed/forbidden imports.

Tests cover actual consumer resolution, callable/named/class/static APIs, brace/globstar/negation/dot/Windows options, representative file matching, actual ESLint/plugin use and bounded pattern preprocessing. Complete lint and lock-enforcing CI remain required. This is a tooling dependency change; no case data or saved format is migrated.
