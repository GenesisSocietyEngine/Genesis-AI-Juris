# v52 Release Gate Recovery and Mobile Parity Record

## Release decision

Deployment is fail-closed. The existing `genesis-juris-web` Site and
`https://studio.falcon-merlin.com` may advance from production version 51 to
version 52 only after every command in this record passes. A failed or missing
mobile/native proof is a no-deploy result.

The authoritative web source is the Git commit containing this record. Its
resolved SHA is recorded in the completion handoff because a commit cannot
contain its own identifier.

## Web recovery scope

- Tax-rate inference models each field's origin as
  `"prompt" | "jurisdiction_default" | "manual" | undefined`, without a broad
  cast. Manual values (including zero) win, an explicit prompt rate precedes a
  jurisdiction default, defaults require a relevant legal/property context,
  and an unspecified field remains unset.
- The Studio graph derives bounds without a state-setting render loop. The fit
  callback is stable and reads the current committed bounds through a ref.
- Every verified build runs the exact command
  `tsc --noEmit --incremental false` before the parity lock and Vinext. Shell
  fail-fast semantics make the bundler unreachable after either failure.
- Canonical server-session imports validate response/session status, exact
  session key, case ID, content version, fingerprint, and exported revision
  before the commit callback can perform any React state update.
- A zero entered at the Studio tax-rate boundary produces a provenance update
  even when the numeric value was already zero. Both fields retain the manual
  origin through JSON save/load, prompt/default reevaluation, auto-sync and
  unrelated edits.
- Historical resolution remains identity-exact. A missing historical bundle is
  not replaced with the current bundle; intentional legacy compatibility is
  explicit and status-aware.

## Mobile impact assessment

No shared canonical content or Rust/mobile runtime code changed for v52. The
web changes are confined to Studio tax inference, graph-hook lifecycle,
played-case import validation, and release verification. Therefore no mobile
product version bump or equivalent mobile source patch is required.

The parity baseline is the remotely reproducible mobile commit
`39b856320ed5dc397562068706c4cea7d703899c`, app version `0.6.0+13`, Rust
workspace version `0.5.0`. The web and mobile canonical bundles are exactly
684,266 bytes and byte-equal:

- SHA-256: `e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a`
- mobile Git blob: `464d88b02f6cf6101dc86c04abfc3505abcfb0a6`
- bundle revision 5; catalog revision 1; scenario schema 1.0
- web runtime `canonical-runtime-v1`; mobile adapter `rust_scenario_v1`
- played-case schema 3; mobile save schema
  `genesis.ai-juris.command-log` revision 1, runtime `scenario-runtime-v2`
- snapshot/projection revision 1; native bridge ABI 1

The shared raw identity tuple is `caseId + version + fingerprint + schema
revision`. The web presentation adapter can have its own derived playable
version/fingerprint, but its `sourceVersion` and `sourceFingerprint` remain the
following mobile identities:

| caseId | version | fingerprint | schema |
|---|---:|---|---:|
| `be_commercial_failed_erp_001` | 1.0.0 | `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8` | 1.0 |
| `be_commercial_logistics_001` | 1.0.0 | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | 1.0 |
| `greenfire_first_72_hours` | 0.2.0 | `173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438` | 1.0 |
| `nl_food_safety_goldenshell_001` | 0.1.0 | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | 1.0 |
| `us_environmental_desert_water_001` | 0.1.0 | `636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af` | 1.0 |

## Cross-runtime fixtures

`parity/mobile-parity.lock.json` pins the repository SHA, versions, bundle
bytes, contract revisions, identities, fixture/probe hashes, every normalized
route hash, and each Rust final-state save digest. The verifier executes nine
routes across all five cases. At the initial state and after every command it
requires equality for:

- stage, elapsed clock, and available action IDs;
- resources, spend, billable time, numeric metrics, fatigue/stamina inputs;
- evidence, active deadlines and due minutes, visible/resolved inbox items;
- judicial result, outcome/verdict ID and the economics carried in
  authoritative resources.

Nine checkpoints carry a non-null judicial result; the compromised Desert
Water route first records 'lost' after
'receive_adverse_first_instance_judgment'. Missing and explicit-null judicial
results are different contract states.

Both sides consume the same command fixture. Web state is serialized,
fingerprint-normalized, and reloaded; Rust saves are inspected, loaded, and
re-saved. A change in any checkpoint, identity, fixture byte, save digest, or
contract revision exits nonzero. The verified build runs the web/lock half;
`npm run parity:mobile` runs the exact-SHA Rust half.

The final fixture SHA-256 is
'08e6cc641f9d7f7fb8b569b49015466172e413702bc2071e28889f1c978b5313';
the compiled probe source SHA-256 is
'b2151c0be831fbbbd55aba37a3568504d3ee10063472b3ce17dbdbc9d6f99326'.
Every Rust save digest remained unchanged after judicial-result projection was
added.

Before any mobile bundle or receipt is read, Git plumbing verifies a full
exact SHA, the requested worktree root, byte-identical HEAD/index/tracked
working-tree content (including raw line endings), safe index flags, and
absence of untracked source, fixture, asset, tool, native, Flutter or Rust
inputs. The final receipt used a fresh linked detached worktree. The guard
never fetches, checks out, resets, cleans, stashes or updates the index.

Authoritative contract sources are executable:

| Lock value | Authoritative source |
|---|---|
| web runtime 'canonical-runtime-v1' | 'CANONICAL_RUNTIME_REVISION' used by web state creation and normalization |
| played-case schema 3 | 'PLAYED_CASE_SCHEMA_REVISION' used by export and import |
| mobile snapshot schema 1 | every compiled 'MobileBridge' snapshot |
| mobile projection schema 1 | every compiled snapshot's dossier projection |
| native bridge ABI 1 | compiled 'juris_mobile_bridge_abi_version()' |

## Native evidence

The exact locked mobile SHA has successful hosted evidence:

- iOS Native FFI run
  [31441634496](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/31441634496),
  simulator job 93627379328: exact checkout, 19/19 verifier cases, 3/3
  universal fixtures, exact arm64/x86_64 exports, and
  `RunnerTests.testNativeLogisticsLifecycle` with `TEST SUCCEEDED`.
- Flutter Mobile UI run
  [31441634424](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/31441634424):
  clean analysis; 210 passed and 12 skipped in that hosted baseline.
- Rust CI run
  [31441634457](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/31441634457):
  MSRV and quality jobs succeeded.

That commit has no Android-native hosted workflow. The local exact-SHA Android
FFI persistence smoke is therefore mandatory before deployment:

```text
flutter test --no-pub integration_test/native_android_persistence_smoke_test.dart -d emulator-5554
```

## Required command receipt

Record final counts and outcomes here after the complete run:

| Gate | Result |
|---|---|
| `npx tsc --noEmit --incremental false` | passed, zero errors |
| `npm run lint` (zero warnings) | passed, zero errors and zero warnings |
| `npm test` | 167/167 passed (139 existing + 28 milestone/audit) |
| `npm audit --omit=dev` | passed, 0 vulnerabilities |
| `git diff --check` | passed |
| `npm run build` | passed; initial JurisApp chunk 300,048 bytes (<305,000) |
| `flutter pub get` | passed at locked SHA |
| `flutter analyze` | passed, no issues |
| `flutter test` | 222/222 passed |
| `cargo test --workspace --locked` | 351/351 passed across 48 non-empty suites |
| `npm run parity:mobile` | 9/9 routes and every checkpoint/save digest passed |
| Android native FFI smoke | 12/12 passed on `emulator-5554` |
| exact-SHA iOS native FFI | run 31441634496 succeeded |

No deployment command belongs in the verifier. After all rows are green, save
and deploy one version to the existing Site, preserve the custom domain, poll
the deployment to `succeeded`, and inspect the returned Worker logs.
