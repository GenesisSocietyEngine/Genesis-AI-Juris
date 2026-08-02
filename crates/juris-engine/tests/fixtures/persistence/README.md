# Historical persistence golden fixtures

These files are immutable command-log bytes produced during the persistence
compatibility audit. Normal tests consume the committed bytes; they never
regenerate or rewrite them with the current runtime.

Both producer generations used:

- save schema ID `genesis.ai-juris.command-log`;
- envelope schema version `1`;
- runtime marker `scenario-runtime-v1`;
- `rustc 1.78.0 (9b00956e5 2024-04-29)`.

## Pre-lifecycle producer

Producer commit: `06e566afd6b09a6691800cd120bfb546d698583d`.

| Fixture | Scenario | Accepted commands | Historical digest | Expected current result |
| --- | --- | --- | --- | --- |
| `06e566a_before_judgment.json` | `be_commercial_logistics_001` | `audit_claim_file`, `issue_formal_demand` | `8a11800b59477890eb67040600e169e9b168861a70f083be1b0e7c080ff88000` | migrate, then re-save as v2 |
| `06e566a_winning_judgment_open.json` | `be_commercial_logistics_001` | previous + `request_judgment` | `f1d5331a75f0bee21b54a0f70f6171a00d55927e64a44d1404c139f3c4d8e027` | migrate, remain open, re-save as v2 |
| `06e566a_losing_terminal_outcome.json` | `greenfire_first_72_hours` | committed compromised trace | `f048a70b6abe0cfc67682c2ac4968ce03e27dee9f647bcefc19e26b77ec7ab04` | migrate closed outcome, re-save as v2 |
| `06e566a_logistics_terminal_boundary.json` | `be_commercial_logistics_001` | audit, demand, negotiated payment | `b125c2ed1f3c501594b52b52deb8a8cc16f41e8e355b9bf9aec83b4b2ed2fe31` | migrate closed outcome, re-save as v2 |
| `06e566a_fully_enforced_win.json` | `be_commercial_logistics_001` | audit, demand, judgment, enforcement | `c8db4897cfe2a0b76e8f37b290f5dcb9232c5b583a0bb96d5303275d2d03254c` | migrate closed outcome, re-save as v2 |
| `06e566a_corrupted_digest.json` | Logistics before-judgment save | same command log; digest replaced by 64 `f` bytes | intentionally invalid | `IntegrityMismatch` |
| `06e566a_corrupted_json.json` | truncated Logistics envelope | n/a | n/a | `InvalidJson` |
| `06e566a_unsupported_marker.json` | Logistics before-judgment save | same command log; marker replaced | historical digest retained | `RuntimeCompatibility` |
| `06e566a_nonterminal_outcome.json` | exact accompanying `.scenario.json` | audit, demand, negotiated payment | `ada67fcaa52c0f06dd60e65fb156ca168e0b004057a867386af62e711901a715` | reject before replay as `RuntimeCompatibility` |
| `06e566a_terminal_then_nonterminal_outcome.json` | exact accompanying `.scenario.json` | audit, demand, negotiated payment | `f7118812912dfb37fe8cb4d7c2f9060af363138c4d1ece1072c14768b978559e` | reject before replay as `RuntimeCompatibility` |

The counterexample definition is committed verbatim as
`06e566a_nonterminal_outcome.scenario.json`. Its fingerprint is
`71e35b2d636f0009b9c107d71d692f0b4bb02d21c7b4ca35ac22a6cedbebebeb`.
The old validator accepted it and old replay treated its outcome in the
nonterminal `proceedings` stage as terminal. Current lifecycle validation
correctly rejects that semantic shape, so it is not eligible for migration.

The ordered-effect counterexample is a separate historical proof that current
validation alone is not a sufficient migration gate. Its negotiated-payment
action enters `resolved`, resolves the outcome there, and then returns to
nonterminal `proceedings`. Commit `06e566a` accepted the action and treated the
resulting state as terminal because v1 closure also considered the outcome.
The raw stage and outcome fields produce the valid historical digest above,
but lifecycle v2 would otherwise treat that same state as open. Its definition
fingerprint is
`b6bfbdc7abc2594f61046c6169badb0b527fe207b0086b3443471d7204132011`.

## PR #10 lifecycle producer

Producer commit: `0c8c2cc11f6bab44abb3cdafe9f97dee91ff36fc`.
These saves were produced after lifecycle state existed but before the runtime
marker was corrected to v2. All use the unchanged
`adverse_judgment_with_remedies` definition fingerprint
`c0a4ed252b357942a68f4d7632aaf699079564b9a21ce692be8e136fc46db162`.

| Fixture | Accepted commands after the initial judgment request/adverse judgment | Historical digest | Expected current result |
| --- | --- | --- | --- |
| `0c8c2cc_lost_but_open.json` | none | `6ed63c77b392647860e06fd316e5e8c57a9ab1c2998fcbbdfe67ccdcdfae536a` | migrate, first-instance loss remains open |
| `0c8c2cc_appeal_success_enforced.json` | file appeal, appeal success, begin and complete enforcement | `77a8863ade21a3c79f86967c364c6e6731d9abccef98379d16e46f838b319524` | migrate closed appellate success |
| `0c8c2cc_appeal_cassation_exhausted.json` | file appeal, lose appeal, file cassation, rejection, explicit close | `7efcc35800508d0fe283ffec00d56549ca8624aabc99d7019ea7865213d35918` | migrate closed cassation loss |
| `0c8c2cc_explicitly_closed.json` | waive appeal | `0b852ea37474847a262c4c6f8586ff6435c36d35bec51941fd6fdee9fc759c66` | migrate explicit first-instance closure |

## Reproduction procedure

Generation was performed in detached, disposable worktrees so the active
checkout was never rewritten. The exact throwaway sources are preserved under
`provenance/`; they are not Cargo targets and normal tests do not execute them.

From the repository root, the pre-lifecycle fixtures can be regenerated with:

```powershell
$fixtureScratch = Join-Path (Split-Path -Parent (Get-Location)) 'juris-fixture-06e566a'
$fixtureOutput = Join-Path (Split-Path -Parent (Get-Location)) 'juris-fixtures-output-06e566a'
git worktree add --detach $fixtureScratch 06e566afd6b09a6691800cd120bfb546d698583d
Copy-Item -LiteralPath 'crates/juris-engine/tests/fixtures/persistence/provenance/generate_06e566a.rs' -Destination (Join-Path $fixtureScratch 'crates/juris-engine/examples/runtime_compat_probe.rs')
Push-Location $fixtureScratch
cargo +1.78.0 run --quiet -p juris-engine --example runtime_compat_probe -- $fixtureOutput
Remove-Item -LiteralPath 'crates/juris-engine/examples/runtime_compat_probe.rs'
Pop-Location
git worktree remove $fixtureScratch
```

The PR #10 lifecycle fixtures use the same process and their dedicated source:

```powershell
$fixtureScratch = Join-Path (Split-Path -Parent (Get-Location)) 'juris-fixture-0c8c2cc'
$fixtureOutput = Join-Path (Split-Path -Parent (Get-Location)) 'juris-fixtures-output-0c8c2cc'
git worktree add --detach $fixtureScratch 0c8c2cc11f6bab44abb3cdafe9f97dee91ff36fc
Copy-Item -LiteralPath 'crates/juris-engine/tests/fixtures/persistence/provenance/generate_0c8c2cc.rs' -Destination (Join-Path $fixtureScratch 'crates/juris-engine/examples/runtime_compat_probe.rs')
Push-Location $fixtureScratch
cargo +1.78.0 run --quiet -p juris-engine --example runtime_compat_probe -- $fixtureOutput
Remove-Item -LiteralPath 'crates/juris-engine/examples/runtime_compat_probe.rs'
Pop-Location
git worktree remove $fixtureScratch
```

Each probe constructs `ScenarioSession` with the seed and ordered commands
shown above and writes the direct result of `ScenarioSession::save_json()`.
Corruption fixtures are derived only after preserving the original generated
before-judgment bytes. Compare each generated file byte-for-byte with its
committed counterpart; no current-runtime regeneration is accepted as proof of
historical provenance.
