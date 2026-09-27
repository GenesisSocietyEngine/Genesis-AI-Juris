# Focused handler run scope

The first applied-source handler/auth/P1 command used `--test-name-pattern=^(?!Canopy V2: independent reviewed copies, causal walkthrough and exact output governance$)`. Pinned Node 22.23.2 also matches ancestor names; this negative name expression does not exclude the intended parent. An isolated two-top-level-case `node:test` probe confirmed three executed tests, including the parent and child intended for exclusion.

That first focused run was deliberately interrupted through its exact owned tool session 68468 after 25 passing auth/P1 subtests. Tool termination returned exit 1. `actual-handler-auth-p1.log` is retained as the interrupted combined PowerShell capture; it is not a completed test-suite result. No application assertion failure is reported from those completed subtests, and no completion claim is made for the long Canopy parent. No shared ADB, emulator or broad process kill was used.

The corrected command uses `--test-skip-pattern=^Canopy V2: independent reviewed copies, causal walkthrough and exact output governance$`, verified by the same isolated probe. It runs:

```text
node.exe --experimental-sqlite --import tsx --test --test-concurrency=1 --test-skip-pattern="^Canopy V2: independent reviewed copies, causal walkthrough and exact output governance$" tests/working-notes-handler-contract.test.ts tests/auth-security.test.ts tests/p1-organization-erp.test.ts
```

The exclusion is exactly the Canopy parent and its six nested cases: four scenario walkthroughs, the causal walkthrough, and the failed/unavailable runtime controls. Those seven test nodes are **NOT_RUN in this focused command**. Node 22 omits the filtered parent from TAP output and can report `skipped: 0`; that counter does not mean the whole file ran. The final full release gate must run this file without the filter. The negative runtime child alone also cannot be selected as an independent complete scenario because it relies on the Upside session produced earlier in its parent; the parent's final assertions require all four copies.

The corrected command's output is `actual-handler-auth-p1-filtered.log`, session 94513. It completed with exit 0: 26 tests passed, no failures, cancellation or TAP skips, with a Node-reported duration of 261999.684 ms. This is a PASS for that selected scope only; the excluded seven Canopy test nodes remain NOT_RUN in this command. Exact commands, exits, log hashes and timestamp limitations are in `actual-verification.receipt.json`. The exact probe source is `../node-name-filter-probe.test.mjs`, with `node-negative-name-probe.log` and `node-exact-skip-probe.log` preserving both outcomes. These are tool-filter checks, not product acceptance tests.
