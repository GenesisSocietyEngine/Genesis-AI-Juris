# V53 Web/Mobile Parity Matrix

## Locked scope

V53 expands the deterministic cross-runtime matrix from 9 to exactly 18 routes without changing the canonical case bundle.

- Canonical bundle SHA-256: `e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a`
- Fixture schema: `2`
- Fixture SHA-256: `f7e6b4edf2c01bfdb0ba7f0b0e8099d22199d2166c710cb98e80580294a872ad`
- Rust probe SHA-256: `322a2e3b9d4e730a14ef05cdc974c67fcdb9d8a493773c6a9f0c2a57f94c57ec`
- Mobile checkout: `39b856320ed5dc397562068706c4cea7d703899c`
- Matrix: 18 routes, 290 initial/command checkpoints, and 45 non-null judicial-result checkpoints
- Coverage: all 5 canonical cases and all 17 canonical terminal outcomes, plus one explicit-null nonterminal remittal state

Every row requires web normalization, Rust inspection/load, restored-snapshot equality, byte-identical re-save, and a locked final-state digest.

## Exact 18-route matrix

`JR` means the normalized judicial result. `null` is an explicit value, never an omitted field.

| # | New | Route | Canonical case | Class | Distinct command path / branch | Expected final state |
|---:|:---:|---|---|---|---|---|
| 1 | No | `failed-erp-settlement` | `be_commercial_failed_erp_001` | Alternative | Conflict check -> documents -> early settlement | `resolved` @ 570; `settlement_64500`; JR `null` |
| 2 | No | `failed-erp-prepared` | `be_commercial_failed_erp_001` | Success | Fully prepared first instance -> cassation response | `resolved` @ 8640; `judgment_preserved_after_cassation`; JR `won` |
| 3 | No | `logistics-judgment` | `be_commercial_logistics_001` | Success | Audit -> demand -> judgment -> enforcement | `resolved` @ 480; `judgment_recovery`; JR `null` |
| 4 | No | `greenfire-protected` | `greenfire_first_72_hours` | Success | Protected evidence/regulator/expert response -> handoff | `handoff_complete` @ 4440; `protected_crisis_position`; JR `null` |
| 5 | No | `greenfire-compromised` | `greenfire_first_72_hours` | Adverse | Unreviewed release and delay -> compromised handoff | `handoff_complete` @ 4590; `compromised_crisis_position`; JR `null` |
| 6 | No | `goldenshell-coordinated` | `nl_food_safety_goldenshell_001` | Success | Coordinated hold/recall/expert/claim protocol -> handoff | `handoff_complete` @ 4545; `coordinated_claim_position`; JR `null` |
| 7 | No | `goldenshell-fragmented` | `nl_food_safety_goldenshell_001` | Adverse | Recall without samples -> fragmented handoff | `handoff_complete` @ 4710; `fragmented_claim_position`; JR `null` |
| 8 | No | `desert-water-coordinated` | `us_environmental_desert_water_001` | Success | Defensible sampling/source proof -> supported judgment | `resolved` @ 3180; `credible_source_and_remedy`; JR `won` |
| 9 | No | `desert-water-compromised` | `us_environmental_desert_water_001` | Adverse | Unverified samples -> underdeveloped claim -> adverse appeal closure | `resolved` @ 3510; `compromised_claim_closed`; JR `lost` |
| 10 | Yes | `failed-erp-inactivity-termination` | `be_commercial_failed_erp_001` | Boundary | Advance to 179/180, 299/300, and 479/480 minute boundaries | `resolved` @ 480; `client_engagement_terminated`; JR `null` |
| 11 | Yes | `failed-erp-procedural-default` | `be_commercial_failed_erp_001` | Adverse | Litigation delay -> final one-minute deadline crossing | `resolved` @ 4861; `procedural_default_final`; JR `dismissed` |
| 12 | Yes | `failed-erp-first-instance-final` | `be_commercial_failed_erp_001` | Success | Prepared litigation ending before cassation-response work | `resolved` @ 7260; `first_instance_win_final`; JR `won` |
| 13 | Yes | `failed-erp-mixed-accepted` | `be_commercial_failed_erp_001` | Alternative | Mixed first-instance judgment -> accept and close | `resolved` @ 7290; `first_instance_adverse_final`; JR `partially_won` |
| 14 | Yes | `failed-erp-appeal-win` | `be_commercial_failed_erp_001` | Success | First-instance loss -> authorized appeal -> reversal | `resolved` @ 8640; `appeal_win_final`; JR `won` |
| 15 | Yes | `failed-erp-appeal-loss` | `be_commercial_failed_erp_001` | Adverse | First-instance loss -> appeal loss -> accept appellate judgment | `resolved` @ 8670; `appeal_loss_final`; JR `lost` |
| 16 | Yes | `failed-erp-cassation-dismissed` | `be_commercial_failed_erp_001` | Adverse | Appeal loss -> cassation authorization/filing -> dismissal | `resolved` @ 10080; `cassation_dismissed_final`; JR `dismissed` |
| 17 | Yes | `failed-erp-remitted-rehearing` | `be_commercial_failed_erp_001` | Boundary | Limited cassation review -> remittal -> rehearing rest | `post_judgment` @ 10080; outcome `null`; JR `won` |
| 18 | Yes | `logistics-negotiated` | `be_commercial_logistics_001` | Alternative | Audit -> demand -> accept negotiated payment | `resolved` @ 270; `negotiated_recovery`; JR `null` |

The nine additions are genuinely distinct: no new route duplicates an existing `(case_id, command path)` or declared `(case_id, branch)`. Seven add missing ERP terminal outcomes, one exercises the nonterminal limited-review/remittal branch, and one adds the missing Logistics negotiated outcome. Existing GreenFire, GoldenShell, and Desert Water routes already covered both outcomes for each case.

## Executable enforcement

The schema-2 fixture and verifier fail closed when any of these invariants changes:

- route count is fewer or greater than 18;
- route ID, same-case command path, or same-case branch is duplicated;
- a route references an unknown case;
- any canonical case, canonical outcome, or required route class is uncovered;
- expected stage, clock, outcome, judicial result, or checkpoint count is absent or different;
- explicit `null` is replaced by an omitted outcome or judicial-result field;
- web and Rust differ at any projected checkpoint field: actions, resources, numeric metrics, evidence, deadlines, inbox, stage, clock, outcome, or judicial result;
- web normalization, mobile save/load, or mobile re-save is not explicitly required;
- the inspected identity, save identity, restored final snapshot, command count, runtime compatibility, schema revision, re-save equality, route hash, or save digest differs from the lock.

Focused negative tests mutate each of the above contracts, including checkpoint data, judicial results, mobile projections, route hashes, save digests, and authoritative revision values. Save digests are produced only by the clean exact-SHA Rust checkout named above.
