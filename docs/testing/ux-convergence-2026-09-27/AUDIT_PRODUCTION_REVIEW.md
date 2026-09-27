# Authorized production dependency audit

**PASS: npm reported zero production dependency vulnerabilities.** This was a new user-authorized audit against the public npm registry, not an inference from an earlier blocked attempt.

Acceptance: run the production-only audit using the pinned Node/npm toolchain, capture the original UTF-8 JSON and separate stderr, distinguish a vulnerability response from an audit/network error, and verify the lockfile remains unchanged. No dependency remediation or configuration changes were authorized in this check.

Command arguments: `audit --omit=dev --json --registry=https://registry.npmjs.org`. Executed by Node **v22.23.2** and npm **10.9.8** from the pinned toolchain; the receipt contains the exact executable, CLI path, argument array, command and working directory.

| Result | Evidence |
| --- | --- |
| Started / completed UTC | `2026-09-27T17:55:25.557Z` / `2026-09-27T17:55:27.755Z` |
| npm exit code | **0** |
| Response | Valid npm vulnerability report; no `error` object, parse error or execution error |
| Vulnerabilities | **0 total**: critical 0, high 0, moderate 0, low 0, informational 0 |
| Finding nodes / advisories | Empty vulnerability map; no direct/transitive finding nodes or advisory URLs returned |
| npm inventory metadata | `prod: 74`; other dependency counts in the raw metadata do not broaden this `--omit=dev` audit's scope |
| Original response | [UTF-8 JSON](evidence/audit-production-authorized.json), 366 bytes, without BOM |
| stderr | [Separate stderr log](evidence/audit-production-authorized.stderr.log), 0 bytes |
| Execution record | [Exact command and lock-preservation receipt](evidence/audit-production-authorized.receipt.json) |

The package-lock SHA-256 was identical before and after the command: `43155d8e1650cf89ded732133384173b260becea9b8b1edcdcfbc02ed628f729`.

No `audit fix`, install, configuration change, package edit or lockfile edit was performed. This result covers advisories npm returned for production dependencies at the recorded time; the separate full-dependency audit is owned by the coordinating agent.
