# Authorized dependency audits — 27 September 2026

**Both audits passed: zero vulnerabilities reported at every severity.** This closes the previously blocked dependency-audit requirement for the recorded lockfile.

The user explicitly authorized both full and production audits against the public npm registry. The earlier automatic approval rejection remains historical evidence; it was not bypassed. These commands ran after that explicit authorization using pinned Node 22.23.2/npm 10.9.8 in the UX worktree.

Acceptance: receive valid npm vulnerability reports from `https://registry.npmjs.org`, preserve raw output and command/exit receipts, distinguish transport errors from findings, and confirm that dependency files remain unchanged.

| Scope | UTC completion | Exit | Info | Low | Moderate | High | Critical | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Full, explicitly including dev/optional/peer | 2026-09-27 17:55:08 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Production, omitting dev | 2026-09-27 17:55:27 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Commands used the pinned npm CLI through its pinned Node executable:

```text
npm audit --json --include=dev --include=optional --include=peer --registry=https://registry.npmjs.org
npm audit --omit=dev --json --registry=https://registry.npmjs.org
```

- Full: [raw JSON](evidence/audit-full-authorized.json), [command/time/exit/hash receipt](evidence/audit-full-authorized.receipt.json).
- Production: [raw JSON](evidence/audit-production-authorized.json), [command/time/exit/hash receipt](evidence/audit-production-authorized.receipt.json), [independent execution review](AUDIT_PRODUCTION_REVIEW.md).
- Both responses are audit report version 2 with an empty `vulnerabilities` map, zero severity totals, no audit error and empty stderr. npm dependency inventory categories overlap and are not added together or presented as separate audited-package counts.
- Package-lock SHA-256 remained `43155d8e1650cf89ded732133384173b260becea9b8b1edcdcfbc02ed628f729` before and after both commands. `git diff --exit-code -- package.json package-lock.json` also passed. No dependency, configuration, application-source or lockfile edit was made; no `audit fix` or install ran.

The results report known npm advisories at execution time. They close this dependency audit gate; they do not replace hosted workflow, accessibility, human-validation or publication requirements. The earlier verified application/build identity remains unchanged.

## Amendment reruns

The authorized **full audit passed again at 21:21:33 UTC**, Node22.23.2/npm10.9.8, explicit public registry, zero vulnerabilities at every severity, exit0. [Exact JSON](evidence/amendment-audit-full-20260927.json), [command/exit/hash receipt](evidence/amendment-audit-full-20260927.receipt.json). `--include=dev --include=optional --include=peer --ignore-scripts` was used; no install or fix ran. Package and lockfile hashes remained unchanged and both exact checkouts remained clean.

The **production audit also passed within the completed baseline release command**, with `npm audit --omit=dev` and the recorded `npm_config_registry=https://registry.npmjs.org/` environment. The complete [raw gate log](evidence/amendment-aggregate-baseline.log) retains its `found 0 vulnerabilities` result and continuation to the successful terminal exit. This is a fresh production audit result, not a replacement JSON receipt. [Aggregate scope](AMENDMENT_AGGREGATE_BASELINE.md). Application authorization findings remain separate from dependency advisories.
