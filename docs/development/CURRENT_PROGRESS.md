---
document_type: cumulative_development_handoff
project: "GENESIS: JURIS"
branch: feat/desert-water-case
base_commit: 3cfa3066b64f36b92f3a77a30ec4a070e74860ed
failed_erp_pr: 14
failed_erp_head: 0aa393096f1e9be4458070d3d53d739c1f8483c0
failed_erp_merge_commit: 3cfa3066b64f36b92f3a77a30ec4a070e74860ed
original_desert_head: 44e565b22c52a4c3a3e69b2c137353b7771fcf77
desert_recovery_ref: backup/desert-water-pre-failed-erp
validator_followup: d7a52d836f4f51b9c510af38513bcb2722cbd6a2
android_followup: de7ac065d095a0e268e14961b4b74edd754cf52e
latest_published_release_tag: v0.6.0-alpha.1
app_version: 0.6.0+13
last_updated: 2026-08-05
---

# Current Progress

## Desert Water authoritative budget recovery checkpoint — 2026-08-05

Status: complete in implementation commit
`aae66104b6bf0df8626898d34ff50f21cf80e8dc`. The running player Save was
exported before further gameplay interaction, the first faulty boundary was
demonstrated across Rust, bridge JSON, and Flutter before the production
correction, and the exact 291-command session was replay-migrated, restored,
and verified on Android API 37. No gameplay action was dispatched by the
live-emulator restoration; commands 191 and 192 were dispatched only in
isolated deterministic audit/replay sessions. Owner playtest passed and
publication through a Draft PR, hosted gates, and a green-only merge is
explicitly authorized.

### Preservation and first faulty boundary

- before touching a control, the running Day 2 17:45 / EUR 0 of EUR 0 screen
  was captured as `apps/juris-mobile/build/budget-live-before-preservation.png`.
  The only subsequent live controls used for preservation were Pause and Save;
  foreground time reached Day 2 17:57, but no additional gameplay action was
  dispatched;
- the exact pre-control Day 2 17:45 state was then reconstructed from the first
  279 commands of the byte-preserved 291-command log and the untouched screen
  timestamp. It is stored as
  `.hotfix-backup/caldera-session-recovery/budget-live-before-control-day2-1745.command-log.json`:
  18,883 pretty-printed bytes, SHA-256
  `b023a9efad16a087059e5234b79176f4f2f56b4762b16a36e2e02126a518293c`,
  fingerprint `f93d22cd...`, digest
  `3449e3e42de0610b5ec03ea518064118586f5ac5ffc74b3151aeacd33e06df92`,
  minute 2,025, and only `prepare_expert_evidence` available. This is an exact
  deterministic state/log reconstruction, not a falsely claimed byte-for-byte
  live export from before Pause;
- the active post-action Save was exported byte-exactly to
  `.hotfix-backup/caldera-session-recovery/budget-live-post-action-day2-1757.command-log.json`:
  12,060 bytes, SHA-256
  `6023f3ca49c6f6de08e5f0fdbfcf9b1b2ee0a318d54e15ce59f266f83528781d`;
- it contains seed `20260804`, runtime marker `scenario-runtime-v2`, fingerprint
  `f93d22cd9dfe3ed34c8fbdd3f6d0faa65559e898f635fd42e19193579a5feb83`,
  digest `9829a636e7b78b07972f401f48758a38f088698cf36882f5d9c8d52a39b5c620`,
  and exactly 291 commands. `interview_affected_residents` is command 191,
  `map_wells_and_exposure_periods` is command 192, and commands 193–291 are
  one-minute foreground advances;
- the previously preserved 190-command migrated log was replayed without
  modification. Before command 191, authoritative Rust already projected no
  resources; the bridge JSON omitted `resources`; Flutter consequently mapped
  authority and spend to zero and substituted all 1,728 elapsed clock minutes
  as billable time;
- command 191 advanced the clock exactly `1728 -> 1848`, made only Map
  available, but still had no resources. Command 192 advanced exactly
  `1848 -> 1938`, made only Prepare Expert Evidence available, and still had
  no resources;
- the first faulty boundary was therefore scenario definition -> Rust session
  initialization/replay, before command 191. The definition had no
  `initial_resources`, and all 27 actions omitted `billable_minutes`; Rust
  correctly held no resource map, the bridge correctly serialized that
  absence, and Flutter's zero/clock fallbacks exposed and partly masked it;
- persistence, Interview, Map, stage transition into
  `environmental_investigation`, resource delta/assignment effects, and a
  resource-ID mismatch were ruled out as initiating causes. Neither action has
  a resource effect, `SetStage` changes only the stage ID, and no capacity was
  available to reset;
- reproducible pre-correction evidence is retained under
  `.hotfix-backup/caldera-session-recovery/budget-audit/before-fix-*`. It
  includes the reconstructed fingerprint-`f93d22cd...` definition, raw Rust
  snapshots, raw bridge responses, and the Flutter-model summary before
  command 191 and after commands 191 and 192. The exact preserved 190-command
  save loads against that definition; at every boundary Rust/bridge resources
  are absent, while Flutter maps authority/spend/remaining to zero and maps
  billable minutes to the elapsed clock (`1728`, `1848`, then `1938`).

### Declarative correction and exact regression

- Desert Water now declares initial `authorized_budget_eur = 60000`,
  `spend_eur = 0`, and `billable_minutes = 0`;
- all 27 actions explicitly declare `billable_minutes` equal to their existing
  `time_cost_minutes`. The generic engine applies action costs and billable
  minutes as deltas; no Flutter fallback, post-action restoration, case-ID
  branch, runtime mutation, or Desert-specific bridge behavior was added;
- the permanent engine regression reconstructs the exact 190-command sequence
  as 10 dispatches plus 180 foreground advances totalling 873 minutes, then
  proves save/reload snapshot, command-log, and digest parity at every
  checkpoint:

| State | Clock | Authority | Spend | Remaining | Billable | Only available action |
|---|---:|---:|---:|---:|---:|---|
| before command 191 | 1,728 | EUR 60,000 | EUR 37,050 | EUR 22,950 | 855 min | `interview_affected_residents` (120 min, EUR 2,400) |
| after command 191 | 1,848 | EUR 60,000 | EUR 39,450 | EUR 20,550 | 975 min | `map_wells_and_exposure_periods` (90 min, EUR 2,200) |
| after command 192 | 1,938 | EUR 60,000 | EUR 41,650 | EUR 18,350 | 1,065 min | `prepare_expert_evidence` (180 min, EUR 5,500) |

- a separate JSON bridge regression replays the same sequence, asserts the raw
  serialized resources/actions at all three boundaries, and proves bridge
  save/load parity after each; Flutter tests pin the bundle resource contract
  and the same three mapped `GameSnapshot` values;
- the corrected Desert Water fingerprint is
  `636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af`;
  canonical outcomes and minutes remain `credible_source_and_remedy` at 3,180
  and `compromised_claim_closed` at 3,510. Their runtime-v2 digests are now
  `432df44aa3f9039ea3970298a0c2dbfe111f0ddfbf76713c75c1cc92261e0e2d`
  and `a8ce4971e6898c5e020697733288cae4fc142cdb28f599551c7bfa0405c141ce`;
- the deterministic five-case bundle is 622,325 bytes, SHA-256
  `58d90d7cc50b853c395e4defe43579b1c7b5d7f3ae12cb9cfe5ec2e22751c97a`.

### Save migration, Android restoration, and validation

- the old 291 commands were replayed against the corrected definition; no
  fingerprint or digest field was edited. The resulting active Save is
  `.hotfix-backup/caldera-session-recovery/budget-audit/budget-fixed-live-291.command-log.json`,
  12,060 bytes, SHA-256
  `328d76e392230ac47ecac4ecda6c54af83a48155f4b0d414fe07a2fecabfe019`,
  fingerprint `636e7b78...`, and digest
  `6ce210e4a6b55a2ec2495d3405adcd7c45ff2edee38cfee3f5c981e2a68d647c`;
- all 291 commands and seed are retained. The replayed state is minute 2,037
  (Day 2 at 17:57), `environmental_investigation`, authority EUR 60,000, spend
  EUR 41,650, remaining EUR 18,350, billable 1,065 minutes, with only
  `prepare_expert_evidence` available;
- the original device Save remains beside it as
  `us_environmental_desert_water_001.pre-budget-fix-6023f3ca.json`; the active
  device Save hash is the corrected `328d76...e019` value;
- debug APK versionCode 4015 / versionName 0.6.0 was built at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`: 164,655,323
  bytes, SHA-256
  `2f85aa1a38fd881affd73f5da5ede87cb0596de0456e27810fedf7a69b219561`;
- `adb install -r` succeeded without clearing app data. On the API 37 / Android
  17 x86_64 emulator (`emulator-5554`, 1080x1920), native Load restored the
  exact paused Day 2 17:57 state. Matter displayed EUR 41,650 spend, EUR 18,350
  authority remaining, and 17.8h; the action sheet displayed only Prepare
  Expert Evidence, 3h, EUR 5,500. It was not selected;
- evidence is preserved at
  `apps/juris-mobile/build/budget-fixed-restored-matter.png` and
  `apps/juris-mobile/build/budget-fixed-restored-action.png`. The ordinary app
  remains running on the paused restored matter as recovery evidence; owner
  playtest passed;
- Rust formatting, current workspace check, Clippy across all targets with
  warnings denied, Rust 1.78 locked workspace check, and all 315 Rust tests
  passed with no failure;
- deterministic bundle `--check`, Flutter analysis, and all 134 Flutter tests
  passed with no failure;
- the APK contains `armeabi-v7a`, `arm64-v8a`, and `x86_64` FFI libraries. Each
  dynamically exports exactly `juris_mobile_bridge_abi_version`,
  `juris_mobile_bridge_execute`, and `juris_mobile_bridge_string_free`; C ABI
  version remains 1;
- `git diff --check` passed. The validated resource-model hotfix is commit
  `aae66104b6bf0df8626898d34ff50f21cf80e8dc`; publication is authorized
  without a tag, release, or APK asset, while PR #4 and recovery refs remain
  untouched.

## Historical: Desert Water / Caldera day-two no-action recovery checkpoint — 2026-08-05

This section records the earlier no-action softlock checkpoint. Its statement
that budget did not cause the action softlock remains correct; the separate
resource-authority defect discovered afterward is superseded by the current
checkpoint above.

Status: the reported no-action state has been reproduced and a narrowly scoped
recovery change has been implemented and validated locally. The optimized
x86_64 release APK is installed, and the explicitly migrated save restored the
exact paused Day 2 session with the recovery action available; no gameplay
action was dispatched. The pre-recovery save and migrated copy remain under the
repository's gitignored `.hotfix-backup/` area. Nothing in `.hotfix-backup/` is
part of the repository or this handoff.

### Reported state and root cause

- the active production Desert Water session reached Day 2 at 12:48, scenario
  minute 1,728, in `environmental_investigation` with no available action;
- `prepare_expert_evidence` requires `well_timeline_mapped = true`, but only
  `map_wells_and_exposure_periods` establishes that state;
- `obtain_regulatory_records` could move the session from
  `urgent_preservation` to `environmental_investigation` before the player
  interviewed residents and mapped their wells. Those two actions were
  previously limited to `urgent_preservation`, making the required state
  permanently unreachable after the transition;
- budget presentation was not the cause: the generic engine did not remove the
  actions on resource grounds. Advancing to the next workday would also not
  restore the productive route and would eventually expose only the
  time-barred closure path.

### Recovery change and deterministic contract

- `interview_affected_residents` and `map_wells_and_exposure_periods` are now
  listed among the `environmental_investigation` exit actions;
- each action's stage condition now accepts either `urgent_preservation` or
  `environmental_investigation`; their existing one-time flags and ordering
  constraints remain authoritative, so no duplicate interview or mapping can
  occur;
- the focused regression reproduces the skipped-mapping route at minute 1,646,
  proves that interview then mapping becomes available in order, and proves
  that `prepare_expert_evidence` advances the still-open matter to
  `claim_preparation` at minute 2,036;
- no generic runtime, persistence envelope, bridge, FFI, ABI, catalogue
  identity, action cost, deadline, outcome, or trace command was changed;
- the canonical trace outcomes and final minutes remain unchanged:
  `credible_source_and_remedy` at minute 3,180 and
  `compromised_claim_closed` at minute 3,510;
- the content change intentionally updates the Desert Water fingerprint to
  `f93d22cd9dfe3ed34c8fbdd3f6d0faa65559e898f635fd42e19193579a5feb83`;
- the coordinated digest is now
  `3b4976b349f3a98a59340f8ffc48c2aeb52efb6edcf0d593c7124c1f91879f20`;
  the compromised digest is now
  `25ee383bd277cdcc8c2eacf123a420dc18f074bd41173f80b6bdf4a7f0cc686a`.

### Preserved save and migration proof

- pre-recovery save:
  `.hotfix-backup/caldera-session-recovery/caldera-desert-water-day2-1248-pre-recovery.command-log.json`;
- original file SHA-256:
  `6c1824a31cbece95d0076993d50285e46dc7c14d1ee2cca3acaf0e13bd21f66c`;
- migrated local copy:
  `.hotfix-backup/caldera-session-recovery/caldera-desert-water-day2-1248-migrated.command-log.json`;
- all 190 commands were retained. Replay under the pre-recovery scenario
  produced digest
  `dc0516fc83900fe8126fbffdf997b1a26397fcee935855bf5f6cde71f1206b92`;
  replay under the recovered definition produced digest
  `446630a1557349ff487107c470265b7063d92b42a182c380c31ff7884ae47bdb`;
- migrated file SHA-256:
  `436a9f4bfe31d032d0754631b1f33dcdcbe4d3e88803c19114b03d9234480128`;
- the migration is a one-session recovery artifact, not a generic relaxation
  of scenario-fingerprint validation. The untouched pre-recovery save remains
  the audit source.

### Session consequence and final local validation

- installing the recovered release APK ended the old in-memory process, as
  expected; repository asset changes did not silently mutate that process, and
  the old save remains unloadable unchanged after the fingerprint change;
- the optimized x86_64 release APK built successfully at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-x86_64-release.apk`:
  22,539,755 bytes, SHA-256
  `8f37b844f4c8dc05bd22358baad3050ae2e4641a4b55deb336b280bbf4f28581`;
- this is a release-mode emulator artifact using the repository's current
  debug signing configuration, not a signed production-distribution APK;
- its native entries are restricted to x86_64 and contain exactly
  `libapp.so`, `libdartjni.so`, `libflutter.so`, and
  `libjuris_mobile_ffi.so`; no ARM native entry is packaged in this emulator
  artifact;
- the packaged stripped `libjuris_mobile_ffi.so` was extracted and audited with
  `llvm-nm -D --defined-only`; it exports exactly
  `juris_mobile_bridge_abi_version`, `juris_mobile_bridge_execute`, and
  `juris_mobile_bridge_string_free`. ABI version remains 1, confirmed by the
  accepting native client and the passing Rust C ABI test;
- the APK embeds the regenerated five-case bundle byte-exactly: 621,197 bytes,
  SHA-256
  `3d8a142e951d8cb40ed431574f2ddaa01593afe1718b7e3544990fea41108ce8`;
- `adb install -r` completed with `Success`;
- native `Load` accepted the migrated runtime-v2 save and restored the exact
  paused state: Day 2 at 12:48, seed `20260804`, zero required Inbox items, and
  one available action. The action sheet exposes only
  `Interview affected residents`, duration 2 hours, cost EUR 2,400; no gameplay
  action was dispatched;
- restoration evidence is preserved locally at
  `apps/juris-mobile/build/caldera-release-restored.png` and
  `apps/juris-mobile/build/caldera-release-recovery-action.png`;
- Rust 1.78 locked workspace check, current workspace check, formatting, and
  Clippy across all targets with warnings denied passed;
- `cargo test --workspace` passed exactly 313 tests with no failure;
- deterministic five-case mobile-bundle export and `--check` passed: 621,197
  bytes, SHA-256
  `3d8a142e951d8cb40ed431574f2ddaa01593afe1718b7e3544990fea41108ce8`;
- Flutter analysis passed with no issues in 190.6 seconds; the Flutter
  unit/widget suite passed exactly 133 tests with no failure;
- the initial `am start -S -W` returned `Status: timeout` with a 12,875 ms wait,
  but the catalogue rendered and native loading/restoration subsequently
  succeeded. Slow emulator startup remains a performance risk rather than a
  functional failure;
- next step: preserve the restored paused session for owner review. The player
  may resume through `Interview affected residents`; any commit or publication
  still requires a separate explicit decision.

## Historical: Five-case integration local validation checkpoint — 2026-08-04

Status: complete locally and stopped for owner playtesting. Failed ERP was
published through PR #14, merged normally, and validated remotely. Desert Water
was then rebased locally, combined with Failed ERP, and passed the complete
host, Android API 37, APK, and ABI checkpoint. `feat/desert-water-case` remains
unpublished; no Desert PR, tag, release, or APK asset was created.

### Failed ERP publication and hosted gates

- PR: `#14`, title `refactor: migrate Failed ERP to authoritative Rust`;
- exact PR head: `0aa393096f1e9be4458070d3d53d739c1f8483c0`;
- exact merge commit and new Desert base:
  `3cfa3066b64f36b92f3a77a30ec4a070e74860ed`;
- all push runs succeeded on exact PR head: Rust `30914773696`, Flutter
  `30914772361`, iOS native/FFI `30914772343`;
- all pull-request runs succeeded: Rust `30914820927`, Flutter `30914822595`,
  iOS native/FFI `30914821159`;
- all post-merge runs succeeded on exact merge commit: Rust `30917034321`,
  Flutter `30917034285`, iOS native/FFI `30917034226`; the hosted iOS build,
  static-library export audit, simulator boot, and native Logistics lifecycle
  all passed;
- PR #4 remained open and untouched.

### Desert recovery, rebase, and local commits

- recovery ref `backup/desert-water-pre-failed-erp` still points exactly to
  original unpublished Desert HEAD
  `44e565b22c52a4c3a3e69b2c137353b7771fcf77` and was not published;
- old-to-new rebase mapping:
  - `c0ad5a369caf85bcb4aa24a53e6b125d1d6fa25b` ->
    `57caf237a86d39a2c21b3fe37cf33971fb5f2af4`;
  - `18f65ceb52d87b9d3c8fc944c48a308b7643cc67` ->
    `6d510738eced7552469b99cbc462382e395e9179`;
  - `7ca533ca986cb90511114fd11e4ce70afe3a7794` ->
    `14ed61ce6a8a14a9fe2e76a8508b6c10c7740541`;
  - `44e565b22c52a4c3a3e69b2c137353b7771fcf77` ->
    `6a5006e4da0a807f84ea439ef3b716939704e324`;
- conflicts were resolved semantically in the production catalogue, validator
  and diagnostics catalogue tests, Android integration harness, generated
  bundle, engine fingerprint regression, and cumulative documentation. Failed
  ERP remained sort 10/Rust-owned; Desert Water remained sort 50; no runtime,
  persistence, digest, bridge, FFI, ABI, balance, or existing scenario contract
  was changed by the rebase;
- `d7a52d836f4f51b9c510af38513bcb2722cbd6a2` fixes validator provenance for
  the sole terminal event's guard while keeping ambiguous paths conservative;
- `de7ac065d095a0e268e14961b4b74edd754cf52e` makes Android Gradle native tasks
  track transitive Rust workspace sources/manifests and the build script, and
  corrects Desert integration labels to the shared 08:00 UI baseline. It was
  required because the first x86_64 acceptance attempt packaged a stale
  pre-validator-fix library;
- neither follow-up changes production scenario semantics, fingerprints,
  persistence, digests, bridge commands, FFI behavior, or ABI version/shape.

### Final authoritative five-case catalogue

| Sort | Case / scenario identity | Public EN / RU title | Fingerprint | Canonical paths: final minute / digest |
|---:|---|---|---|---|
| 10 | `be_commercial_failed_erp_001` | Failed ERP Implementation / Неудачное внедрение ERP | `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8` | settlement `settlement_64500`: 570 / `fd77a45422e4abd7f141fc7b1db767524ebf48d9674bd25c21354fb7a2b8c029`; prepared `judgment_preserved_after_cassation`: 8640 / `f25604fc0225d7ac5a7e98d192ce3b82114970158a3662aee7575b128430ca0c`; remittal open: 10080 / `268f27867fd1f45a417c0e999819165bd79f76a74f3ab2e65ee075e193cbc34a` |
| 20 | `be_commercial_logistics_001` | Unpaid Logistics Invoices / Неоплаченные логистические счета | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | negotiated: 270 / `139239e001417ae563e270128864a512e88c0ff535a498e15b000731b8ca5bfe`; judgment: 480 / `e25e1eeb36249c1b7da0fe7a947f29ed3363ce7dac0357a110951c49bb738ac3` |
| 30 | `greenfire_first_72_hours` | The First 72 Hours / Первые 72 часа | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` | protected: 4440 / `17f58f95551abacb445ce6d886fc059bcbd7a7660c3f089d9509e7a25f01a216`; compromised: 4590 / `432a3ca4688f2d452a96326872e2058d9a1b2109c4b5f3be24b6b9666cc428ec` |
| 40 | case `nl_food_safety_goldenshell_001`; scenario `goldenshell_recall_at_dawn` | Contaminated Egg Supply Chain / Загрязнение цепочки поставок яиц | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | coordinated: 4545 / `72986eeb4a3a690b775ea86c6ac5c9da02027ef5a0ca03292736b5e805f8c53b`; fragmented: 4710 / `846c96ed8ba240bb392daead67e03bd4b9a7cbe1b23bdd6d412314e582c13503` |
| 50 | case `us_environmental_desert_water_001`; scenario `desert_water_groundwater_claim` | Desert Water / Вода пустыни | `056bfa737932a81005fb8d9a78246593d1c1908308543d4bf9c5811d73201e8d` | coordinated `credible_source_and_remedy`: 3180 / `8d9f9c5e39dcdb0dc6639d42844a3b9e5f8394702231f1d8eb0aede6be244240`; compromised `compromised_claim_closed`: 3510 / `f5a08dc13bb49b879bc0e4929fbbbb08184cc4269c463eaa4ca8b1fad162c895` |

All five use `rust_scenario_v1`. The four pre-existing fingerprints, canonical
traces, outcomes, costs, deadlines, final minutes, save digests, and relative
ordering remain unchanged.

### Combined artifacts and host gates

- deterministic mobile bundle: version 4, exactly five Rust cases, 620,529
  bytes, SHA-256
  `645bcd25b9cfa915ce9d0e3b0558e480325e5a45bfc20d7eb69144aba52cb985`;
- Rust 1.78 locked check, formatting, current workspace check, and Clippy with
  warnings denied passed;
- full Rust workspace: 312 passed, 0 failed, 0 ignored; focused totals passed:
  engine 100, bridge 16, FFI 14, simulator 56, validator 49, diagnostics 28,
  production catalogue integration 14; Failed ERP formula/economic parity
  10/10; lifecycle harness 2/2 over 18 explicit paths;
- Dart format: 49 files, 0 changed; Flutter analysis: no issues; Flutter
  unit/widget suite: 133 passed, 0 failed;
- final ordinary three-ABI debug APK:
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`,
  187,596,640 bytes, SHA-256
  `689b95b0da9f47bbe385bad9312a74b7625ad23860c0ea63113882f1611e3053`;
- C ABI remains version 1. The exact stripped libraries inside the APK match
  Gradle outputs; `armeabi-v7a`, `arm64-v8a`, and `x86_64` each dynamically
  export exactly `juris_mobile_bridge_execute`,
  `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`;
- `git diff --check` passed. The branch is clean after the local documentation
  commit containing this handoff.

### Android API 37 automated and interactive evidence

- explicit target: AVD `Pixel`, device `emulator-5554`, model
  `sdk_gphone64_x86_64`, Android 17 / API 37, `x86_64`, 1080x1920,
  `boot_completed=1`;
- complete native integration suite: 7 passed, 0 failed in 5:42:
  1. GreenFire RU save/actions/foreground time;
  2. GoldenShell RU replay across a deadline boundary;
  3. terminal Logistics save/load;
  4. corrupted platform save atomicity;
  5. Failed ERP RU claimant save/load/corruption;
  6. debug-only lost-but-open lifecycle fixture;
  7. production Desert Water reveal/save/load/appeal/explicit closure;
- Failed ERP closed as `settlement_64500` at minute 570. Desert Water proved
  initial Dossier omission and reveal, lost-but-open first instance at minute
  3180, repeated atomic restore without duplicates, adverse appeal still open
  at minute 3480, explicit `compromised_claim_closed` at minute 3510, and
  immutable rejection of dispatch/time advance after closure;
- ordinary production app verification found all five catalogue cards in sort
  order, confirmed `Asteron Systems NV` as Failed ERP player claimant, opened
  Desert Water at `Community intake` without bridge/asset/mapper error, and
  returned to the catalogue without executing a player action;
- final presentation evidence:
  `apps/juris-mobile/build/five-case-catalog-api37.png` and
  `apps/juris-mobile/build/desert-water-open-api37.png`;
- the emulator and ordinary app remain running for owner playtesting, with the
  catalogue foreground. The last verified app PID was `17672`.

### Known issues and stop boundary

- the API 37 AVD showed slow post-install startup. One launch recovery required
  an ADB server restart and bounded reconnect after a transient `device
  offline`; after repeated native runs Android also displayed one `system` ANR
  dialog. Selecting `Wait` recovered without wiping data or crashing the app;
  emulator performance remains an environmental risk;
- the combined branch has no hosted CI result because Desert publication is
  forbidden at this checkpoint. The hosted records above cover exact Failed
  ERP PR/merge commits, while all combined evidence is local;
- screenshot/APK files under `apps/juris-mobile/build/` are local, ignored
  evidence rather than published release assets;
- Desert Water was not pushed and no PR/tag/release was created; the backup ref
  remains; PR #4 was not modified or closed; later architecture phases were not
  started;
- next step: owner playtesting, followed only by an explicit publication
  decision. Do not push/open a Desert PR, tag/release, delete the backup ref, or
  start a later roadmap checkpoint without authorization.

The two sections immediately below are retained as historical checkpoint
evidence and must not be interpreted as combined-tree results.

## Historical: Failed ERP authoritative Rust migration local checkpoint — 2026-08-04

Historical status: implementation and full local validation were complete. Failed ERP is
now a production `ScenarioDefinition v1` on the generic authoritative Rust
runtime, with Rust-owned metrics/resources, timing, decisions, lifecycle,
Dossier, replay, and persistence. The branch is stopped for local review; it
has not been pushed and no PR, tag, release, or merge was created.

Repository state:

- branch: `refactor/failed-erp-authoritative-rust`;
- exact base and merge base:
  `3c27eb2782a61662d7ceffbd19e5434bce389470`;
- implementation HEAD before the documentation commit:
  `6a27e53549b06911e81fe8c9a61eae3e814fca30`;
- intentional implementation commits:
  - `f898d09232b51aa1d7bdcce0208ed7a93a76462b` — legacy
    characterization;
  - `a26bb58d5d0ca7a5dc0149011206fd261874978f` — generic metrics,
    resources, and deterministic decisions;
  - `8442b9bf42f2ac03c5a4e25f7bc005e543e3ee33` — relative timing and
    completion-deadline constraints;
  - `e61d68a6bf88556f7aeded3239b16a297341ef2c` — authoritative
    production scenario and traces;
  - `33dc65f3ff1c6d042a2787fc54de9045126e7b74` — mobile Rust routing and
    generic snapshot presentation;
  - `6a27e53549b06911e81fe8c9a61eae3e814fca30` — replay, Dossier,
    persistence, FFI, and Android lifecycle coverage;
- `0aa393096f1e9be4458070d3d53d739c1f8483c0` —
  `docs: record Failed ERP Rust migration checkpoint`;
- PR #4 remains untouched;
- Desert Water remains preserved and unpublished on
  `feat/desert-water-case` at
  `44e565b22c52a4c3a3e69b2c137353b7771fcf77`; its four intentional commits
  remain reachable and no remote branch contains that HEAD.

Authority and identity:

- production ID: `be_commercial_failed_erp_001`;
- catalogue position 1 / sort order 10;
- Asteron Systems NV is the claimant/buyer and player client;
- Northbridge Consulting BV remains the defendant/supplier;
- `DemoGameRepository` was the parity authority because it was the executable
  legacy behavior; the old template is migration provenance only;
- settlement remains EUR 64,500;
- the production factory no longer imports or selects the Dart demo adapter;
- the Dart repository remains only as a characterization fixture for the
  historical widget/parity suite;
- no case-ID branch exists in generic Rust, bridge, FFI, or Flutter mapper.

Scenario and deterministic evidence:

- first Failed ERP fingerprint:
  `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8`;
- 21 stages, 39 actions (37 legacy plus 2 minimal lifecycle continuations),
  13 decisions, 9 deadlines, 2 async tasks, 34 Inbox items, 66 events,
  9 outcomes, 12 actors, 8 facts, 5 evidence items, 19 metrics, and
  5 resources;
- settlement trace: seed 20260724, 3 commands / 9 transitions, minute 570,
  `settlement_64500`, spend EUR 2,350, award EUR 64,500;
- prepared-litigation trace: seed 6, 26 commands / 52 transitions, minute
  8640, `judgment_preserved_after_cassation`;
- remittal trace: seed 28, 29 commands / 62 transitions, minute 10080,
  open `post_judgment` state with no terminal outcome;
- an explicit 18-path lifecycle manifest covers all 9 terminal outcomes and
  all meaningful open remedy/remittal states with exact commands, resources,
  minutes, lifecycle, result/instance, digest, deadlines, tasks, and Inbox;
- exact-due completion succeeds only for the opt-in inclusive policy;
  due-plus-one rejection is atomic;
- closed sessions expose no actions or open work and reject dispatch/time
  advancement without mutation.

Compatibility:

- Logistics fingerprint remains
  `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8`
  with canonical minutes/transitions 270/3 and 480/5;
- GreenFire remains
  `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261`
  with 4440/26 and 4590/21;
- GoldenShell remains
  `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4`
  with 4545/29 and 4710/23;
- their definitions, costs, deadlines, traces, outcomes, final minutes,
  digests, and relative catalogue order are unchanged;
- no supported legacy Failed ERP save existed; no importer or second save
  mechanism was added;
- schema ID `genesis.ai-juris.command-log`, envelope schema version 1,
  eight-field shape, `scenario-runtime-v2`, fingerprint validation, and the
  final-state digest contract remain unchanged;
- C ABI remains version 1 with exactly execute, string-free, and ABI-version
  exports.

Quality gates:

- Rust 1.78 locked workspace check passed;
- Rust fmt, locked workspace check, and Clippy `-D warnings` passed;
- full Rust workspace: 293 passed, 0 failed, 0 ignored;
- focused totals: engine 92, bridge 15, FFI 13, simulator 53,
  validator 45, diagnostics 27, and case catalogue 14;
- Failed ERP formula/economic parity: 10/10;
- lifecycle matrix harness: 2/2 over 18 explicit manifest paths;
- deterministic bundle check passed; SHA-256 changed as expected from
  `8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`
  to
  `afe93194de58761fe534a1b818968bc7a2b5bd931eba597ab03a06561733baf1`;
- Dart format checked 48 files with 0 changes;
- Flutter analysis found no issues;
- full Flutter unit/widget suite: 130 passed, 0 failed;
- Failed ERP native Android acceptance: 1/1 on Android 17 / API 37;
- unsigned three-ABI debug APK: 97,983,130 bytes, SHA-256
  `501b84a01f96b425d25acb2f7e4174f03a39080b1ba94da851f43a707ed280fd`;
- `llvm-nm` found exactly
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version` in `armeabi-v7a`, `arm64-v8a`, and
  `x86_64`;
- `git diff --check` passed.

Known limitations and next step:

- historical Dart and old `juris-content` prototype fixtures remain in the
  tree but are not production mobile/ScenarioSession authority or save aliases;
- top-level snapshot-array visibility hardening remains a separate checkpoint;
- hosted iOS and remote CI have not run because publication is forbidden at
  this stop point;
- review the seven local commits and the focused contract in
  `docs/development/FAILED_ERP_RUST_MIGRATION_V1.md`;
- only after explicit authorization may this branch be pushed and a Draft PR
  opened; Desert Water may be rebased and revalidated only after the Failed
  ERP checkpoint is separately published and merged.
## Historical: parked Desert Water fifth production case checkpoint — 2026-08-04

Historical status: Desert Water was implemented locally as catalogue position five, and
the Rust workspace, Flutter unit/widget suite, deterministic content gates,
debug APK build, and three-ABI symbol audit pass. The final post-fix Android
native integration rerun is not yet proven: the Flutter host stalled before
launching the app or Dart tests and the run was stopped. This branch is
therefore not ready for external playtesting or publication.

Repository state:

- branch: `feat/desert-water-case`;
- exact release/base commit:
  `3c27eb2782a61662d7ceffbd19e5434bce389470`, published as annotated tag
  `v0.6.0-alpha.1`;
- Dossier PR #12 was merged normally at
  `9d1ad87961cabd61571fa59e1432d5c70c6d450c`; release-preparation PR #13 was
  merged normally at the exact release/base commit above;
- GitHub pre-release:
  `https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/releases/tag/v0.6.0-alpha.1`;
- all Rust, Flutter, and hosted iOS workflows passed both after PR #13 merge
  (runs `30863611634`, `30863611643`, `30863611624`) and on the annotated tag
  (runs `30864783884`, `30864783874`, `30864783869`); no unsigned APK was
  attached to the source pre-release;
- exact implementation HEAD before this uncommitted cumulative handoff edit:
  `7ca533ca986cb90511114fd11e4ce70afe3a7794`;
- intentional local commits:
  - `c0ad5a369caf85bcb4aa24a53e6b125d1d6fa25b` —
    `docs: define Desert Water case contract`;
  - `18f65ceb52d87b9d3c8fc944c48a308b7643cc67` —
    `feat: add Desert Water production scenario`;
  - `7ca533ca986cb90511114fd11e4ce70afe3a7794` —
    `test: cover Desert Water runtime and dossier`;
- `44e565b22c52a4c3a3e69b2c137353b7771fcf77` is the fourth original local
  commit, `docs: record Desert Water validation checkpoint`; its rebased
  equivalent is `6a5006e4da0a807f84ea439ef3b716939704e324`.

Cumulative commit records:

- `c0ad5a369caf85bcb4aa24a53e6b125d1d6fa25b` defined the spec-first
  identity, catalogue baseline, declarative inventory, visibility boundary,
  lifecycle paths, test plan, and explicit exclusions. It changed no runtime
  or production scenario and left content implementation as the next step.
- `18f65ceb52d87b9d3c8fc944c48a308b7643cc67` added the production scenario,
  identity, EN/RU catalogue/localization, both canonical command files, and
  deterministic five-case bundle. Validator, diagnostics, simulator, and
  focused runtime checks passed; complete cross-layer and device evidence was
  the next step.
- `7ca533ca986cb90511114fd11e4ce70afe3a7794` added Rust engine/simulator/
  validator/diagnostics/catalogue, bridge/FFI, Flutter mapper/widget/catalogue,
  and Android native acceptance coverage. Full host gates are green; the
  post-fix Android device rerun remains the known issue and next step.
- `44e565b22c52a4c3a3e69b2c137353b7771fcf77` records the completed gates, exact hashes,
  unchanged compatibility contracts, pending Android evidence, and stop
  boundary. It changes no gameplay or production source.
- no Desert Water commit has been pushed and no PR, tag, or release has been
  created from this branch;
- PR #4 was not modified or closed;
- Dossier follow-on work, Snapshot Visibility Hardening, Pressure &
  Countermove Runtime, Legal Theory, and other later phases were not started.

Authoritative production catalogue after the local addition:

| Position | Stable identity | Public EN / RU title | Canonical fingerprint | Deterministic canonical traces |
|---:|---|---|---|---|
| 1 / sort 10 | case `be_commercial_failed_erp_001`; legacy scenario `failed-erp-implementation`; adapter `demo_failed_erp` | Asteron Systems NV v. Northbridge Consulting BV — Failed ERP Implementation / Asteron Systems NV v. Northbridge Consulting BV — Неудачное внедрение ERP | Not applicable: this is the legacy Dart case, not a Rust `ScenarioDefinition`; no fingerprint was invented | Not applicable: no authoritative Rust outcome or final minute |
| 2 / sort 20 | case and scenario `be_commercial_logistics_001` | Velmont Logistics SA v. Orbis Retail Belgium NV — Unpaid Logistics Invoices / Velmont Logistics SA v. Orbis Retail Belgium NV — Неоплаченные логистические счета | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | `negotiated_recovery` at minute 270; `judgment_recovery` at minute 480 |
| 3 / sort 30 | case and scenario `greenfire_first_72_hours` | Port Haven Environmental Authority v. GreenFire Industrial Solutions B.V. — The First 72 Hours / Port Haven Environmental Authority v. GreenFire Industrial Solutions B.V. — Первые 72 часа | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` | `protected_crisis_position` at minute 4440; `compromised_crisis_position` at minute 4590 |
| 4 / sort 40 | case `nl_food_safety_goldenshell_001`; scenario `goldenshell_recall_at_dawn` | GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F. — Contaminated Egg Supply Chain / GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F. — Загрязнение цепочки поставок яиц | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | `coordinated_claim_position` at minute 4545; `fragmented_claim_position` at minute 4710 |
| 5 / sort 50 | case `us_environmental_desert_water_001`; scenario `desert_water_groundwater_claim` | Sundial Mesa Residents Association v. Caldera Compression & Cooling Inc. — Desert Water / Sundial Mesa Residents Association v. Caldera Compression & Cooling Inc. — Вода пустыни | `056bfa737932a81005fb8d9a78246593d1c1908308543d4bf9c5811d73201e8d` | `credible_source_and_remedy` at minute 3180; `compromised_claim_closed` at minute 3510 |

The four pre-existing catalogue identities and their relative ordering are
unchanged. The three pre-existing Rust fingerprints and canonical
outcome/minute pairs remain pinned exactly; the legacy Failed ERP case remains
truthfully fingerprint-less. No existing case content, balance, costs,
actions, deadlines, outcomes, or traces changed.

Desert Water content and deterministic results:

- identity: fictional resident-side US environmental-litigation matter,
  `us_environmental_desert_water_001` /
  `desert_water_groundwater_claim`, seed `20260804`, foreground clock;
- exact inventory: 9 actors, 8 stages, 10 facts, 13 evidence items, 27 actions,
  5 deadlines, 1 asynchronous task, 10 inbox items, 17 events, and 2
  outcomes;
- every one of the 27 actions has a positive euro cost;
- canonical fingerprint:
  `056bfa737932a81005fb8d9a78246593d1c1908308543d4bf9c5811d73201e8d`;
- coordinated trace: `credible_source_and_remedy`, final minute `3180`, total
  cost EUR `54,150`, final-state digest
  `8d9f9c5e39dcdb0dc6639d42844a3b9e5f8394702231f1d8eb0aede6be244240`;
- compromised trace: `compromised_claim_closed`, final minute `3510`, total
  cost EUR `23,350`, final-state digest
  `f5a08dc13bb49b879bc0e4929fbbbb08184cc4269c463eaa4ca8b1fad162c895`;
- the EN/RU catalogue card and stable-ID presentation overlay cover every
  Desert Water stage, action, deadline, inbox item, fact, evidence item, and
  outcome without changing authoritative IDs or ordering;
- the generated bundle remains schema version 4 and now contains exactly five
  cases. Its SHA-256 intentionally changed from
  `8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`
  to
  `fa3a2556e5baec0303f2fb8b8fe4b8e51fca6419da606cf000810d8643821644`.

Local validation completed:

- `cargo +1.78.0 check --workspace --locked`: passed;
- `cargo fmt --all -- --check`: passed;
- `cargo check --workspace`: passed;
- `cargo clippy --workspace --all-targets -- -D warnings`: passed;
- `cargo test --workspace`: 233 passed, 0 failed;
- validator and diagnostics catalogue/Desert Water gates: passed;
- simulator CLI replayed both canonical command files and reproduced their
  exact outcomes and minutes; focused simulator/engine tests pin transition
  order, command-log equality, and deterministic final-state digests, while
  the frozen action inventory pins the recorded costs;
- deterministic generated mobile-bundle check: passed;
- `flutter analyze`: passed with no issues;
- `flutter test`: 116 passed, 0 failed;
- unsigned three-ABI debug APK: built successfully, 187,596,640 bytes,
  SHA-256
  `633b1ea2a6bba0f25e72de568d01961303fdf182a5b4520644c735a128ac8200`;
- C ABI remains version 1. For each production APK ABI — `armeabi-v7a`,
  `arm64-v8a`, and `x86_64` — the audit found exactly these three exported
  Juris symbols and no additional Juris C ABI symbol:
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`.

Compatibility and implementation boundaries:

- generic Rust runtime, bridge, FFI, schema, persistence, lifecycle, Dossier,
  digest, and compatibility implementation sources are unchanged;
- generic Flutter production sources are unchanged; changes are limited to
  declarative production content/catalogue/localization, the generated mobile
  bundle, focused Rust/Flutter tests, the Android acceptance test, and
  documentation;
- C ABI version and export surface are unchanged;
- existing save digests and `scenario-runtime-v1`/`scenario-runtime-v2`
  persistence compatibility are unchanged;
- Desert Water behavior is expressed through existing generic declarative
  stages, conditions, effects, events, deadlines, async tasks, outcomes,
  lifecycle, persistence, and Dossier contracts; there is no case-specific
  production runtime branch.

Android API 37 acceptance status and known issue:

- the first full native run passed all five pre-existing Android integration
  tests, then the new Desert Water test failed because its test harness looked
  passed the catalogue `CustomScrollView` itself to an API requiring its
  descendant `Scrollable` state widget;
- after that harness selector was corrected, the second run reached Desert
  Water but failed on an offscreen catalogue-card tap;
- commit `7ca533ca986cb90511114fd11e4ce70afe3a7794` contains both narrowly scoped
  harness fixes: selecting the descendant `Scrollable` and scrolling the
  fifth card's Start button into the physical viewport before tapping;
- a subsequent post-fix rerun did not provide acceptance evidence because the
  Flutter host launch stalled before the app or Dart test suite started; it
  was stopped rather than reported as a pass;
- consequently the required complete post-fix Android API 37 lifecycle path —
  catalogue position-five selection, initial Dossier omission, stable-ID
  reveal, save/reset/load, adverse-but-open judgment, remedy/appeal, explicit
  closure, duplicate-free restore, and post-closure rejection — remains
  pending as one terminal full native rerun;
- this pending Android gate is a release blocker for external playtesting.
  No hosted iOS or other remote CI result is claimed for this unpushed branch.

Next step:

- rerun the complete Android API 37 native integration suite from a healthy
  Flutter/emulator host and require all six tests, including Desert Water, to
  reach a successful terminal result;
- capture catalogue, initial Dossier, revealed Dossier, lost-but-open appeal,
  and explicit-closure evidence after that successful run;
- recheck the cumulative diff and local repository state, then stop for local
  review; do not push, open a PR, create a tag/release, or begin a later roadmap
  phase without explicit authorization.

## v0.6.0-alpha.1 release preparation — 2026-08-04

Status: PR #12 was revalidated, marked Ready, and merged by a normal merge
commit. Release metadata is being prepared on an isolated branch before the
annotated source tag and GitHub pre-release are created.

Repository and publication state:

- accepted Dossier HEAD:
  `62111ddef1623f0211149c70617564f2aa622dd4`;
- PR #12 merge commit:
  `9d1ad87961cabd61571fa59e1432d5c70c6d450c`;
- the merge commit preserves all four intentional Dossier commits and has the
  accepted Dossier HEAD as its second parent;
- local `main` was fast-forwarded and exactly matched `origin/main`; the tree
  was clean before this release-preparation branch was created;
- every post-merge workflow passed on the exact merge commit:
  - Rust CI run `30858517251`: quality job `91835046904` and Rust 1.78 MSRV
    job `91835046912` succeeded;
  - Flutter Mobile UI run `30858517042`: analyze-and-test job `91835046189`
    succeeded;
  - iOS Native FFI run `30858517073`: simulator-smoke job `91835046406`
    succeeded;
- hosted iOS checked out exact SHA
  `9d1ad87961cabd61571fa59e1432d5c70c6d450c`, built Runner and the Rust static
  library, found the three required exports, booted an iPhone 16 Pro Simulator,
  and passed `RunnerTests.testNativeLogisticsLifecycle()`;
- release-preparation branch: `agent/release-v0.6.0-alpha.1`;
- reviewed metadata and release-note commit:
  `b223367426d13362cbaeb896303ffc59cc76ea4b`;
- Flutter product version: `0.6.0+13`;
- Cargo workspace version remains `0.5.0` because this is an integrated
  product/source checkpoint, not a Rust-crate publication;
- no existing tag will be moved or overwritten, and the unsigned debug APK
  will not be attached as a production artifact;
- PR #4 remains untouched.

Production catalogue baseline before Desert Water:

- position 1 / `sort_order` 10: legacy Dart case
  `be_commercial_failed_erp_001`, with no authoritative Rust
  `ScenarioDefinition` fingerprint or canonical runtime trace/final minute;
- position 2 / `sort_order` 20: Logistics
  `be_commercial_logistics_001`, fingerprint
  `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8`,
  canonical outcomes/minutes `negotiated_recovery`/270 and
  `judgment_recovery`/480;
- position 3 / `sort_order` 30: GreenFire
  `greenfire_first_72_hours`, fingerprint
  `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261`,
  canonical outcomes/minutes `protected_crisis_position`/4440 and
  `compromised_crisis_position`/4590;
- position 4 / `sort_order` 40: GoldenShell scenario
  `goldenshell_recall_at_dawn` (`case_id`
  `nl_food_safety_goldenshell_001`), fingerprint
  `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4`,
  canonical outcomes/minutes `coordinated_claim_position`/4545 and
  `fragmented_claim_position`/4710;
- full EN/RU public titles and the compatibility meaning of the absent legacy
  fingerprint/trace are recorded in
  `docs/releases/RELEASE_NOTES_v0.6.0-alpha.1.md`;
- the authoritative production catalogue count is exactly four, so Desert
  Water may be authored as the fifth position; the four existing identities,
  relative ordering, behavior, and three available Rust fingerprints/traces
  must remain unchanged.

Release evidence carried forward from the accepted Dossier checkpoint:

- Rust tests: 217 passed, 0 failed;
- Flutter tests: 113 passed, 0 failed; analysis clean;
- Android native integration: 5 passed, 0 failed on Android 17 / API 37;
- C ABI version 1 with exactly
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`;
- deterministic mobile bundle SHA-256:
  `8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`;
- unsigned debug APK SHA-256:
  `9d402919ca9232ba255edafadbdce5c129bf4d31dc13bf93e49f34d8e5aedbdc`.

Next step:

- validate this metadata-only diff, commit, and publish a narrowly scoped
  release-preparation PR;
- require all Rust, Flutter, and hosted iOS PR workflows to pass, merge that
  PR, then tag its merge commit as annotated `v0.6.0-alpha.1` and create the
  GitHub pre-release with the exact released source SHA;
- only after release publication and a clean final `main`, create
  `feat/desert-water-case` and implement Desert Water as production catalogue
  position five;
- do not begin Snapshot Visibility Hardening, Pressure & Countermove Runtime,
  or Legal Theory, and do not modify or close PR #4.

## Dossier Projection v1 local review checkpoint — 2026-08-03

Status: Dossier Projection v1 is implementation-complete and locally verified.
The authoritative Rust projection, additive bridge payload, Flutter mapping,
Matter entry point, EN/RU presentation, persistence regressions, complete
Android acceptance path, focused contract, and cumulative handoff are ready
for local review. No Dossier commit has been pushed and no pull request, tag,
or release has been created.

Repository state:

- PR #11 was marked Ready and merged by the explicitly authorized merge-commit
  method;
- PR #11 head was
  `eb3260a1b12999924836c2cef5d005ccfe974cfe` and its merge commit is
  `7b9c5e1fd9866b19484deec391c8cf9fe6b4de43`;
- the hosted PR-head Rust quality, Rust 1.78 MSRV, Flutter, iOS static-library
  export, and iOS simulator lifecycle gates were successful before merge;
- branch: `feat/dossier-projection-v1`;
- exact base and merge base:
  `7b9c5e1fd9866b19484deec391c8cf9fe6b4de43`;
- authoritative runtime commit:
  `9a32f32effaf67b4e94aecf1236c21e245a2d971` —
  `feat(runtime): add authoritative dossier projection`;
- mobile implementation commit:
  `61c74f2c7f95e4e542fc3d0ecc183633105de13a` —
  `feat(mobile): present authoritative dossier projection`;
- focused contract and final cumulative handoff:
  `afbb43068cd23474ab674b3c4f3900a43956b91f` —
  `docs(development): record dossier projection checkpoint`;
- the following documentation-only commit pins that exact hash in this
  cumulative file;
- PR #4 was not modified or closed;
- no Dossier branch was pushed and no Draft PR was opened.

Authoritative runtime changes:

- added an additive nested `dossier` projection to the existing version-1
  mobile snapshot; it is recomputed from `ScenarioSession` and is not a second
  state machine;
- procedure exposes authoritative stage, scenario minute, lifecycle, closure,
  judicial result and Rust-owned decision instance;
- dossier matter status is `closed` after explicit closure, `recoverable` for
  an adverse open result with an executable deadline remedy, and `open`
  otherwise;
- facts whose status is `unknown`, unavailable evidence, inactive deadlines,
  future actions, private flags, unfired events, effects, hidden outcomes,
  scoring and validator internals are absent from the nested projection;
- evidence relationships are intersected with visible fact IDs; open deadline
  remedies are intersected with currently available completion actions;
- facts, evidence, relationships, deadlines and remedies use stable-ID/time
  canonical ordering;
- added the test-only `dossier_projection_v1` fixture. It is absent from the
  production catalog and mobile bundle;
- bridge and FFI coverage proves that the dossier is additive JSON through the
  existing execute request and does not add a native function.

Compatibility contracts preserved:

- Scenario Definition remains version `1.0` and mobile snapshot schema remains
  version `1`;
- save ID remains `genesis.ai-juris.command-log`, envelope version remains `1`,
  the envelope remains eight fields, and new saves remain
  `scenario-runtime-v2`;
- no persistence implementation or digest projection changed; the dossier is
  derived after replay and is never serialized;
- Logistics, GreenFire and GoldenShell definitions, catalog/localization,
  balance, production traces and mobile bundle are unchanged;
- C ABI remains version `1` with exactly
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`.

Runtime verification:

- `cargo +1.78.0 check --workspace --locked`: passed;
- `cargo fmt --all -- --check`: passed;
- `cargo check --workspace`: passed;
- `cargo clippy --workspace --all-targets -- -D warnings`: passed;
- `cargo test --workspace`: 217 passed, 0 failed;
- focused totals: engine 63 (14 unit + 6 dossier + 23 persistence + 20
  runtime), bridge 11, FFI 9;
- authoring diagnostics: Logistics, GreenFire, GoldenShell, adverse lifecycle,
  and the dossier fixture passed;
- production fingerprints remain:
  - Logistics:
    `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8`;
  - GreenFire:
    `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261`;
  - GoldenShell:
    `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4`;
- GreenFire protected/compromised remain minute 4440/4590 with 26/21
  transitions; GoldenShell coordinated/fragmented remain minute 4545/4710
  with 29/23 transitions;
- deterministic mobile bundle remains current with SHA-256
  `8d9db2e75c5cac14df95073843cc5a0775df8d17323fb434c688a8854a012835`.

Flutter and Android changes:

- added unknown-safe immutable Dossier models and a mapper that consumes only
  the nested Rust projection; missing legacy dossier data maps safely to no
  projection and malformed projection data cannot mutate the repository;
- added a scrollable, small-screen-safe Dossier screen with Procedure, Facts,
  Evidence, and Deadlines/remedies sections, explicit text/icon status, and
  consistent EN/RU stable-ID localization;
- the Matter screen opens Dossier while the foreground clock is suspended; a
  remedy returns its authoritative action ID to the existing action picker;
- Flutter does not infer lifecycle, closure, remedy availability, judicial
  result, decision instance, visibility, or dossier status;
- mapper/widget/repository tests cover missing and malformed data, unknown
  future enum values, EN/RU identity, hidden-data omission, closed and
  recoverable presentation, small screens, action handoff, and atomic load;
- Dart format checked 46 files with 0 changes, `flutter analyze` found no
  issues, and all 113 Flutter unit/widget tests passed;
- ordinary three-ABI debug APK built successfully after the integration runner,
  192,458,673 bytes, SHA-256
  `9d402919ca9232ba255edafadbdce5c129bf4d31dc13bf93e49f34d8e5aedbdc`;
- Android native integration passed 5/5 on `emulator-5554`,
  `sdk_gphone64_x86_64`, Android 17 / API 37, 1080x1920;
- Dossier acceptance uses debug-only case
  `integration_adverse_judgment_with_remedies`: initial minute 0 exposes only
  fact `claim_was_filed` and evidence `client_instruction_letter`;
  `review_dossier_materials` reaches minute 10 and reveals
  `registry_record_confirms_service` plus `court_registry_extract` exactly
  once;
- `request_judgment` and `adverse_trial_judgment` reach minute 70 with result
  `lost`, instance `first_instance`, lifecycle `post_judgment`, status
  `recoverable`, open deadline `appeal_deadline`, and remedy `file_appeal`;
- save/reset/load restores an equal dossier, repeated incompatible-v1 failures
  preserve the active session, and `file_appeal` reaches minute 130 with the
  deadline completed and no remaining remedy;
- `abandon_appeal` then reaches explicit closure at minute 135 (10:15), exposes
  dossier status `closed` and outcome `final_loss`, and both a subsequent
  dispatch and one-minute clock advance are rejected as `scenario_resolved`
  without changing the dossier;
- all three APK ABIs (`armeabi-v7a`, `arm64-v8a`, `x86_64`) define exactly the
  same three C ABI symbols and ABI version remains `1`.

Known limitation:

- the established top-level version-1 snapshot arrays can enumerate unknown,
  unavailable or inactive definition-backed entities. They are retained for
  compatibility. Only the new nested `dossier` has the disclosure-safe
  contract, and Flutter must never fall back to those legacy arrays for the
  Dossier view. Broader snapshot hardening requires a separate compatibility
  audit.

Next step:

- review the local implementation and documentation commits, exact
  compatibility evidence, Android path, ABI audit, and remaining legacy
  snapshot limitation;
- only after explicit authorization, publish the branch and open a Draft PR;
  do not push, open a PR, merge, tag, release, or start a later roadmap phase
  from this local checkpoint.

## Matter Lifecycle persistence compatibility remediation local checkpoint — 2026-08-02

Status: the runtime-v2 compatibility boundary, narrowly proven v1 migration,
controlled v1 rejection, historical golden fixtures, Rust-owned judicial
decision instance, Flutter atomic-load handling, and lifecycle Android
acceptance are complete locally on
`fix/matter-lifecycle-runtime-v2-compatibility`. Nothing from this checkpoint
has been pushed, no PR was opened or modified, and no merge was attempted.

Repository state:

- verified clean starting point before implementation:
  `main`, `origin/main`, `feat/dossier-projection-v1`, and `HEAD` all matched
  `0c8c2cc11f6bab44abb3cdafe9f97dee91ff36fc`;
- merge base remains
  `0c8c2cc11f6bab44abb3cdafe9f97dee91ff36fc` (PR #10 merge commit);
- PR #9 is present through merge commit
  `06e566afd6b09a6691800cd120bfb546d698583d` and PR #10 through `0c8c2cc`;
- the empty `feat/dossier-projection-v1` branch was not changed or deleted;
- stale PR #4 was not pushed, modified, closed, rebased, or merged;
- no Logistics, GreenFire, GoldenShell, catalog, localization, production
  trace, action, deadline, outcome, or balance file changed;
- intentional local commits:
  - Rust/schema/simulator/bridge/FFI implementation and immutable fixtures:
    `18998c5b77fe470404990cc6803aa913ee5edcf6` —
    `fix(runtime): add lifecycle persistence compatibility v2`;
  - Flutter mapping, atomic load behavior, EN/RU presentation, and Android
    acceptance: `ef0168fb5c7f2469be6a2235c22621ab99b23629` —
    `fix(mobile): preserve lifecycle loads across compatibility errors`;
  - compatibility contracts and this cumulative handoff:
    `1bdeeffabe333a7fe05f8d6b9dbb3b158015ddcc` —
    `docs(development): record lifecycle compatibility remediation`.

Completed runtime and public-contract changes:

- save `schema_id` remains `genesis.ai-juris.command-log`, envelope
  `schema_version` remains `1`, and the eight envelope fields are unchanged;
- every new save and every successfully migrated save now emits
  `runtime_compatibility: scenario-runtime-v2`;
- the marker selects replay and digest semantics; schema ID, schema version,
  and marker are validated before command payload decoding, so a future marker
  with a future command fails as `RuntimeCompatibility`, not `UnknownCommand`;
- v1 digest verification preserves the historical projection exactly:
  `judicial_result` is conditional and
  `judicial_decision_instance` is absent;
- v2 digest verification always includes `judicial_result` and
  `judicial_decision_instance`, including explicit nulls, and remains ordered,
  locale-free, wall-clock-free, and platform-independent;
- the v1 migration preflight is side-effect-free and generic. The current
  validator must pass, every action-owned outcome must finish at its final
  `set_stage` in a terminal/resolved stage, event-owned outcomes are rejected,
  and an outcome action that triggers events is rejected when any event can
  change stage;
- both the direct nonterminal-outcome counterexample and the valid ordered
  `terminal → resolve outcome → nonterminal` counterexample are rejected before
  replay as `RuntimeCompatibility`; neither can first surface as
  `IllegalCommandSequence` or `IntegrityMismatch`;
- registry insertion remains temporary until preflight, replay, and the
  marker-selected digest all pass. Repeated failures across all controlled
  loader categories preserve registry length and the existing session;
- added Rust-owned nullable `judicial_decision_instance` with stable values
  `first_instance`, `appeal`, and `cassation`. It is the instance that produced
  the current/latest authoritative `judicial_result`;
- bridge snapshots carry the field additively. Flutter maps it directly and
  no longer reconstructs it from stage IDs, outcome IDs, or display text;
- Flutter keeps its old session ID and identical mapped snapshot on failed
  load, disposes only a temporary session returned by an incomplete success or
  invalid mapped snapshot, and covers repeated failures for JSON, schema,
  runtime, fingerprint, command, replay, serialization, and integrity errors;
- EN/RU map and present the same result, decision instance, lifecycle,
  closure, stable action IDs, deadlines, and Inbox state. Flutter no longer
  invents a cassation remittal from `won + cassation`;
- snapshot schema remains version `1`; the decision-instance field is
  additive, nullable, unknown-safe, and genuinely optional for older snapshots;
- C ABI remains version `1`; no command, function, or fourth symbol was added.

Historical fixture matrix:

| Producer / fixture | Current result |
|---|---|
| `06e566a_before_judgment.json` | migrates; next save is v2 |
| `06e566a_winning_judgment_open.json` | migrates open; next save is v2 |
| `06e566a_losing_terminal_outcome.json` | migrates closed; next save is v2 |
| `06e566a_logistics_terminal_boundary.json` | migrates closed; next save is v2 |
| `06e566a_fully_enforced_win.json` | migrates closed; next save is v2 |
| `06e566a_corrupted_digest.json` | `IntegrityMismatch` |
| `06e566a_corrupted_json.json` | `InvalidJson` |
| `06e566a_unsupported_marker.json` | `RuntimeCompatibility` before replay |
| `06e566a_nonterminal_outcome.json` | `RuntimeCompatibility` before replay |
| `06e566a_terminal_then_nonterminal_outcome.json` | `RuntimeCompatibility` before replay; exact v1 digest `f7118812912dfb37fe8cb4d7c2f9060af363138c4d1ece1072c14768b978559e` |
| `0c8c2cc_lost_but_open.json` | migrates open with first-instance loss |
| `0c8c2cc_appeal_success_enforced.json` | migrates closed with appellate win |
| `0c8c2cc_appeal_cassation_exhausted.json` | migrates closed with cassation loss |
| `0c8c2cc_explicitly_closed.json` | migrates explicit first-instance closure |

The committed fixture README records producer commits, Rust 1.78, scenario
IDs, command sequences, exact historical digests, expected results, and
disposable-worktree generation commands. Normal tests consume immutable bytes
and do not regenerate them with current code.

Local quality gates:

- `cargo +1.78.0 check --workspace --locked`: passed;
- `cargo fmt --all -- --check`: passed;
- `cargo check --workspace`: passed;
- `cargo clippy --workspace --all-targets -- -D warnings`: passed;
- `cargo test --workspace`: 209 passed, 0 failed;
- focused Rust totals: `juris-engine` 57 (14 unit + 23 persistence + 20
  runtime), bridge 10, FFI 8;
- authoring diagnostics: Logistics, GreenFire, GoldenShell, and the adverse
  lifecycle fixture each passed;
- production deterministic traces remain exact:
  - GreenFire protected: `protected_crisis_position`, minute 4440, 26 steps;
  - GreenFire compromised: `compromised_crisis_position`, minute 4590,
    21 steps;
  - GoldenShell coordinated: `coordinated_claim_position`, minute 4545,
    29 steps;
  - GoldenShell fragmented: `fragmented_claim_position`, minute 4710,
    23 steps;
- lifecycle deterministic traces remain exact:
  - appeal success + enforcement: `appellate_success`, minute 360,
    result `won`, instance `appeal`, 8 steps;
  - express waiver: `final_loss`, minute 65, result `lost`, instance
    `first_instance`, 5 steps;
  - appeal/cassation exhausted: `final_loss`, minute 425, result `lost`,
    instance `cassation`, 9 steps;
- deterministic mobile bundle: passed and current;
- final Dart format gate: 42 files, 0 changes;
- Flutter analyze: `No issues found`;
- Flutter unit/widget tests: 103 passed, 0 failed;
- debug APK: built at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`;
- Android native integration: 5 passed, 0 failed on `emulator-5554`, Android
  17 / API 37;
- fresh `armeabi-v7a`, `arm64-v8a`, and `x86_64` libraries each define exactly
  `juris_mobile_bridge_execute`, `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`;
- `git diff --check`: passed.

Android lifecycle acceptance evidence:

- uses an integration/debug-only injected case, absent from the production
  catalog and mobile bundle;
- executes `request_judgment` then `adverse_trial_judgment`: minute 60
  (09:00 presentation), `lost`, `first_instance`, `post_judgment`, open, no
  terminal outcome, appeal deadline open, action-required Inbox visible, and
  `file_appeal` / `waive_appeal` available;
- saves, resets to another live session, loads, and restores exact lifecycle,
  decision instance, deadline, Inbox, actions, stage, and time;
- verifies embedded historical scenario/save bytes at runtime: 8306 bytes /
  SHA-256 `639c8da2913e3473928c43f31d2aa7b96741c9da1e8b5292899cae8ba402258a`
  and 535 bytes / SHA-256
  `e42efef295db5ca7493ee57f4cea8b28807432da4c2e3bd6660d2f919f3d8c7e`;
- routes two real native incompatible-v1 attempts through
  `RustScenarioRepository.loadGame`; both return `incompatible_runtime` while
  preserving the same Flutter snapshot and native session;
- dispatches `file_appeal` through that retained session, reaches minute 120
  (10:00), lifecycle `appeal`, completed appeal deadline, resolved Inbox, open
  matter, and no outcome;
- the other four Android tests cover GreenFire RU save/time, GoldenShell RU
  around a deadline, terminal Logistics save/load, and corrupted-save
  failure atomicity.

Known limitations and consequences:

- semantically compatible custom v1 definitions with event-owned outcomes, or
  outcome actions whose event queue may change stage, are rejected
  conservatively. Those users must begin a new session unless a future narrow
  historical interpreter proves migration safety;
- the two known incompatible v1 semantic shapes are deliberately not migrated;
  the old save remains untouched, the active session remains playable, and the
  loader returns a controlled compatibility error;
- compatible pre-PR #10 and PR #10 v1-labelled saves covered by committed
  goldens migrate and are thereafter written as v2;
- external snapshot consumers must tolerate the additive nullable
  `judicial_decision_instance` field;
- local iOS/static-library execution is unavailable on Windows, so no
  branch-head iOS result is claimed before publication and hosted CI;
- no physical-device, release-signing, App Store, Play Store, or remote CI
  result is claimed for this unpublished branch;
- a stale local Flutter startup lock from old validation runners was removed;
  all reported Flutter/Android gates were then rerun in fresh processes.

Next step:

- review the local three-commit remediation checkpoint and this compatibility
  report;
- only after explicit approval, push the branch, open a Draft PR, and observe
  Rust quality/MSRV, Flutter, and iOS workflows to terminal state;
- do not merge or begin Dossier Projection v1 without separate authorization.

## Matter Lifecycle v1 / Lost != Closed local review checkpoint — 2026-07-31

Status: implementation, documentation, and all available local quality gates
are complete on `feat/matter-lifecycle-v1`. This is the required local review
checkpoint. The branch has not been pushed, no new PR has been opened, and no
merge is authorized or attempted.

Repository state:

- PR #9 was merged by explicit authorization; clean local `main` and
  `origin/main` matched merge commit
  `06e566afd6b09a6691800cd120bfb546d698583d` before this branch was created;
- the post-merge Rust `quality`, Rust 1.78 `msrv`, Flutter
  `analyze-and-test`, and iOS `simulator-smoke` gates for PR #9 were green;
- branch: `feat/matter-lifecycle-v1`;
- base: `main@06e566afd6b09a6691800cd120bfb546d698583d`;
- authoritative lifecycle commit:
  `2d7747a feat(lifecycle): separate judicial result from matter closure`;
- mobile presentation commit:
  `a8c73d2 feat(mobile): present judicial result separately from closure`;
- this contract/progress update is isolated in the following documentation
  commit;
- stale conflicting PR #4 and its branch were audited but not modified,
  rebased, pushed, closed, or merged.

Completed:

- added authoritative `JudicialResult` values `won`, `lost`,
  `partially_won`, and `dismissed`, plus declarative
  `set_judicial_result` effects and `judicial_result_is` conditions;
- added `appeal`, `cassation`, and `enforcement` stage kinds;
- derives `MatterLifecycleStatus` from the current stage instead of maintaining
  a second mutable lifecycle state machine;
- post-judgment, appeal, cassation, and enforcement remain open; only a
  resolved/terminal stage closes the matter;
- validator and authoring diagnostics reject terminal remedy stages, exposed
  actions after closure, incomplete closure, outcome resolution before a
  terminal transition, and outcomes targeting nonterminal stages;
- added the focused test-only
  `adverse_judgment_with_remedies` fixture with appeal, waiver, cassation, and
  enforcement paths;
- snapshot schema version 1 now additively exposes `judicial_result`,
  `matter_lifecycle`, `is_closed`, and `resolved_outcome`; `terminal` remains
  the backward-compatible closure alias;
- preserved command-log mutation atomicity and deterministic replay;
  `judicial_result` participates in the final-state digest only when present,
  preserving the previous digest projection when it is absent;
- added persistence regressions for lost-but-open save/load, continuation into
  appeal, repeated-load equality, and non-duplication of generated events and
  command-log entries;
- JSON bridge and FFI tests prove that an adverse decision remains open and
  remedy actions remain executable;
- Flutter now uses authoritative `is_closed` for repository/report lifecycle,
  presents the judicial decision separately from procedural status, hides the
  terminal report while remedies remain, and preserves stable-ID scenario
  localization, action costs, deadline/action links, foreground clock, and
  save/load behavior;
- new lifecycle labels are localized in EN/RU, and appellate/enforcement
  decisions are no longer presented as first-instance results;
- added `docs/development/MATTER_LIFECYCLE_V1.md` and updated the Save v1
  digest contract.

Compatibility and content consequences:

- Scenario Definition remains version `1.0`;
- snapshot schema remains version `1`;
- Save schema remains `genesis.ai-juris.command-log` version `1` with runtime
  marker `scenario-runtime-v1`;
- C ABI remains version `1` with exactly the existing execute, string-free,
  and ABI-version symbols;
- Logistics, GreenFire, GoldenShell, catalog records, localized overlays, and
  the deterministic mobile bundle are byte-unchanged by this branch, so their
  scenario fingerprints are unchanged;
- only a test fixture was added; no new public catalog case is claimed.

Local quality gates:

- `cargo +1.78.0 check --workspace --locked`: passed;
- `cargo fmt --all -- --check`: passed;
- `cargo check --workspace --locked`: passed;
- `cargo clippy --workspace --all-targets -- -D warnings`: passed;
- `cargo test --workspace`: 200 passed, 0 failed;
- authoring diagnostics: Logistics, GreenFire, GoldenShell, and the lifecycle
  fixture each passed;
- production deterministic traces remain exact:
  - GreenFire protected: `protected_crisis_position` at minute 4440;
  - GreenFire compromised: `compromised_crisis_position` at minute 4590;
  - GoldenShell coordinated: `coordinated_claim_position` at minute 4545;
  - GoldenShell fragmented: `fragmented_claim_position` at minute 4710;
- lifecycle deterministic traces:
  - appeal success and enforcement: `appellate_success` at minute 360;
  - express waiver: `final_loss` at minute 65;
  - appeal and cassation exhausted: `final_loss` at minute 425;
- deterministic mobile bundle check: passed;
- Dart format: 38 files checked, 0 changed;
- Flutter analyze: `No issues found`;
- Flutter unit/widget tests: 85 passed, 0 failed;
- debug APK built at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`;
- Android API 37 native persistence/FFI smoke on `emulator-5554`: 4 passed,
  covering GreenFire RU, GoldenShell RU around a deadline, terminal Logistics,
  and corrupted-save failure atomicity;
- fresh `arm64-v8a`, `armeabi-v7a`, and `x86_64` Android libraries each export
  exactly `juris_mobile_bridge_execute`,
  `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`;
- `git diff --check`: passed.

Known limitations and risks:

- the lifecycle fixture is intentionally test-only, so no public catalog case
  yet demonstrates appeal/cassation/enforcement end to end;
- external consumers that incorrectly reject additive snapshot fields must be
  updated, although the supported Flutter mapper accepts both old and new
  snapshots;
- custom v1 content that previously resolved an outcome without a true
  terminal stage is now rejected as malformed;
- existing production fingerprints and legacy final-state digests are
  preserved structurally, but no literal golden hash is committed;
- local iOS execution is unavailable on Windows; hosted iOS branch-head
  verification is required after publication;
- no physical-device, release-signing, App Store, or Play Store result is
  claimed.

Next step:

- review the three-commit local checkpoint and its compatibility report;
- only after explicit approval, publish with `github:yeet`, open a Draft PR,
  and observe the four remote Rust/Flutter/iOS checks to terminal state without
  automatic merge;
- do not begin Dossier Projection v1 until Matter Lifecycle v1 has been
  explicitly reviewed and merged.

## Persistent Command-Log Save/Load v1 remote gate and merge preparation — 2026-07-31

Status: the implementation and contract are published in Draft PR
[#9](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/9).
The initial push and pull-request checks completed successfully, the PR has no
comments or review threads, and explicit authorization to merge PR #9 was
received. This entry is the final documentation-only update before the fresh
checks triggered by its push and the authorized merge.

Repository state:

- branch: `feat/persistent-command-log-v1`;
- base: `main@e68007b2e6357ca4964c12bb856386b3c7b5f80e`;
- implementation commit:
  `ca24c08ddc77dff3611b55d294ba596296c712c8`;
- persistence-contract documentation commit:
  `18cd9692a0a3840cee0d889afd4076b64a0bd5ac`;
- PR #9 targets `main`, remains Draft at the time of this entry, and reports
  `mergeStateStatus: CLEAN`;
- GitHub reports no PR comments, reviews, or unresolved inline review threads;
- open PR #4 (`Lost != Closed`) remains isolated and was not modified.

Remote quality gates on initial PR head `18cd969`:

- Rust CI pull-request run
  [30589753688](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30589753688):
  success;
  - `quality`: success;
  - Rust 1.78 `msrv`: success;
- Flutter Mobile UI pull-request run
  [30589753691](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30589753691):
  `analyze-and-test` success;
- iOS Native FFI pull-request run
  [30589753680](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30589753680):
  `simulator-smoke` success, including Runner/Rust static-library build,
  verification of all three C ABI exports, iPhone Simulator boot, and the
  native Logistics lifecycle.

Duplicate push-triggered quality gates:

- Rust CI run
  [30589723427](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30589723427):
  `quality` and `msrv` success;
- Flutter Mobile UI run
  [30589723431](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30589723431):
  `analyze-and-test` success;
- iOS Native FFI run
  [30589723430](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30589723430):
  `simulator-smoke` success in 25m24s.

Known limitations and observations:

- GitHub emitted a non-blocking deprecation annotation because
  `actions/checkout@v4` targets Node.js 20 and the hosted runner forces it onto
  Node.js 24; this did not affect any check result;
- no physical-device, release-signing, App Store, or Play Store result is
  claimed;
- the Save v1 product limitations documented below remain unchanged.

Next step:

- commit and push this documentation-only update;
- observe the newly triggered Rust `quality`, Rust `msrv`, Flutter
  `analyze-and-test`, and iOS `simulator-smoke` checks to terminal success;
- mark PR #9 Ready for review and merge it using a merge commit under the
  explicit authorization received on 2026-07-31;
- fast-forward local `main` to the resulting remote merge.

## Persistent Command-Log Save/Load v1 publication checkpoint — 2026-07-31

Status: review is approved, implementation and local validation are complete on
`feat/persistent-command-log-v1`, based on clean merged
`main@e68007b2e6357ca4964c12bb856386b3c7b5f80e`. The implementation is isolated
in commit `ca24c08` (`feat(runtime): add persistent command-log save/load`);
this cumulative handoff and the persistence contract are isolated in the
following documentation commit. Remote PR and CI observations happen after
these commits are pushed, so no remote result is claimed by this entry.

Repository state:

- PR #8 was marked Ready for review with no comments or unresolved threads;
- all eight Rust, Flutter, and iOS checks for PR #8 passed;
- PR #8 was merged by explicit authorization using merge commit `e68007b`;
- local `main` was updated strictly by fast-forward and matched `origin/main`;
- this branch was created from that exact merge;
- the approved implementation was committed separately as `ca24c08`;
- documentation remains isolated from the implementation diff;
- open PR #4 (`Lost != Closed`) remains isolated and is not copied into this
  persistence checkpoint.

Completed:

- added public Save v1 envelope
  `genesis.ai-juris.command-log` / schema version `1`;
- records deterministic seed plus ordered `dispatch` and `advance_time`
  commands, never generated events;
- records commands on a cloned candidate before their generated effects and
  publishes the candidate only after complete command success;
- added canonical SHA-256 scenario fingerprint and authoritative final-state
  digest independent of locale, formatting, platform, map iteration order, and
  wall-clock time;
- added fresh-session replay with explicit rejection of malformed JSON,
  unknown schema/runtime/scenario/command/action, fingerprint mismatch, invalid
  time, illegal command sequence, event-budget failure, and digest mismatch;
- registry load is failure-atomic and does not replace or remove existing
  sessions on failure;
- extended the existing JSON bridge with `save_session` and `load_session`;
- preserved C ABI version 1 and exactly the existing execute, string-free, and
  ABI-version symbols;
- added Flutter opaque save storage under Application Support using a
  verified temporary file and recoverable backup;
- added repository save/load mapping with old-session preservation until the
  new Rust session and Flutter snapshot both validate;
- added EN/RU Save/Load controls, load confirmation/cancellation, controlled
  not-found/compatibility/corruption errors, and foreground-clock suspension;
- added a reproducible native Android persistence integration smoke covering
  GreenFire RU, GoldenShell RU around a deadline, terminal Logistics, and a
  corrupted platform save;
- added `docs/development/PERSISTENT_COMMAND_LOG_V1.md`.

Local quality gates:

- `cargo +1.78.0 check --workspace --locked`: passed;
- `cargo fmt --all -- --check`: passed;
- `cargo check --workspace`: passed;
- `cargo clippy --workspace --all-targets -- -D warnings`: passed;
- `cargo test --workspace`: 179 passed, 0 failed;
- focused persistence: 15 passed;
- mobile bridge: 9 passed;
- mobile FFI: 7 passed, including save/load through ABI version 1;
- diagnostics: Logistics, GreenFire, and GoldenShell each returned no
  diagnostics;
- mixed simulator traces remain exact:
  - GreenFire protected: `protected_crisis_position` at 4440;
  - GreenFire compromised: `compromised_crisis_position` at 4590;
  - GoldenShell coordinated: `coordinated_claim_position` at 4545;
  - GoldenShell fragmented: `fragmented_claim_position` at 4710;
- Dart format: 38 files checked, 0 changed;
- deterministic mobile bundle check: passed;
- Flutter analyze: `No issues found`;
- Flutter unit/widget tests: 76 passed, 0 failed;
- Android native persistence integration tests: 4 passed, 0 failed;
- Flutter debug APK: built successfully;
- `git diff --check`: passed.

Android emulator acceptance:

- device: `emulator-5554`, Android API 37, 1080x1920;
- ordinary debug app launched and used with the real native bridge;
- Logistics was saved after advancing from 08:00 to 10:00, the app was
  closed/restarted, a fresh 08:00 session was opened, and Load restored 10:00;
- the reproducible device suite verified GreenFire RU action/time save/load,
  GoldenShell RU open/missed deadline replay around minute 360, terminal
  Logistics save/load, and corrupted-save failure atomicity;
- production UI evidence:
  - `apps/juris-mobile/build/persistent-logistics-loaded.png`;
  - `apps/juris-mobile/build/persistent-greenfire-ru-restored.png`
    (localized gameplay plus controlled save-not-found message);
  - `apps/juris-mobile/build/persistent-goldenshell-ru-cost.png`
    (localized action sheet with `30м` and `EUR 750`);
- no physical-device result is claimed.

Known limitations:

- Save v1 has one manual local slot per case, without autosave, cloud sync,
  accounts, or background/offline time catch-up;
- saves are integrity-checked but not encrypted or authenticated against a
  malicious player;
- full-content scenario fingerprints intentionally invalidate saves after any
  canonical scenario text/content change;
- the legacy Dart Failed ERP demo does not use this Rust persistence contract;
- local iOS execution is unavailable on Windows; both hosted iOS Native FFI
  workflows must be observed after publication;
- no physical-device, release-signing, App Store, or Play Store result is
  claimed.

Next step:

- push the two intentional commits on `feat/persistent-command-log-v1`, open a
  Draft PR, and observe Rust CI, Flutter Mobile UI, and both iOS Native FFI jobs
  to terminal state without automatic merge.

## GoldenShell/GreenFire playability and RU gameplay checkpoint — 2026-07-30

Status: implementation checkpoint on
`fix/goldenshell-playability-localization`; local Rust, Flutter, deterministic
bundle, and Android APK gates pass. The exact commit hash is assigned by Git to
the commit containing this entry; remote PR and CI observations belong in the
next cumulative update.

Repository state:

- base: `main@2f00b94` (merge of authoritative foreground clock PR #7);
- branch: `fix/goldenshell-playability-localization`;
- PR #4 lifecycle work remains isolated and is not mixed into this branch;
- generated mobile bundle schema version increased additively from 3 to 4.

Completed:

- added backward-compatible `cost_eur` to declarative scenario actions;
- propagated action cost through the Rust mobile snapshot, JSON/FFI bridge,
  Flutter mapper, action cards, and confirmation dialogs;
- assigned non-zero EUR costs to all 17 GoldenShell actions;
- added `completion_action_ids` to deadline snapshots so Calendar can open the
  currently available action that completes a deadline;
- corrected scenario deadline display to use the mobile civil-time origin at
  08:00; for example GreenFire `legal_hold_deadline` at elapsed minute 180 now
  displays `Day 1 · 11:00`, not `Day 1 · 03:00`;
- added a shared `Rest until next workday · 08:00` Calendar control;
- the control submits normal authoritative `advance_time` commands for Rust
  scenarios and uses the existing deterministic rest transition in the legacy
  demo adapter;
- automatic foreground ticking is suspended while Inbox, action, deadline,
  report, and reset modal UI is open, then resumes only if the player had not
  paused it;
- preserved foreground-clock authority in Rust: Flutter does not mutate
  scenario time or effects locally;
- carried the selected catalog locale through case launch, runtime factory,
  repository, mapper, and gameplay shell;
- added complete Russian stable-ID overlays for GreenFire and GoldenShell:
  metadata, stages, actions, deadlines, Inbox items, facts, evidence, and
  terminal outcomes;
- added Russian gameplay-shell labels for navigation, Inbox, Matter, Calendar,
  AI, Career, status badges, action review, response dialogs, workload, and
  deadline controls;
- exporter now loads scenario localization files, rejects unsupported locales,
  verifies scenario identity, and requires exact stable-ID coverage for every
  translated scenario section;
- regenerated the deterministic four-case mobile bundle.

Tests and checks:

```powershell
cargo check --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
dart format lib test tool
dart run tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris --check
flutter analyze
flutter test
flutter build apk --debug
git diff --check
```

Observed results:

- Rust workspace check, formatting, Clippy with warnings denied, all unit,
  integration, scenario, bridge, FFI, simulator, validator, and doc tests:
  passed;
- deterministic bundle validation and generated-file check: passed;
- Flutter analyze: `No issues found`;
- Flutter tests: 67 passed, including:
  - GoldenShell action-cost projection;
  - GoldenShell and GreenFire Russian runtime mapping;
  - GreenFire civil-time deadline and related-action mapping;
  - next-workday rest;
  - modal foreground-clock suspension;
  - Russian GoldenShell shell/action-sheet rendering;
- Android debug APK built successfully at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`.

Known limitations:

- action costs are displayed authoritatively per action but cumulative scenario
  spend and a scenario-specific budget ceiling are not yet modeled;
- Russian scenario overlays are complete for GreenFire and GoldenShell;
  Logistics still falls back to its canonical English scenario prose;
- local iOS build is unavailable on Windows and still requires the hosted iOS
  Native FFI workflow after push;
- no physical-device, release-signing, App Store, or Play Store result is
  claimed;
- persistent saves and command-log replay are not part of this checkpoint.

Next step:

- review the isolated diff, commit it with this cumulative handoff, push the
  branch, open a PR, and observe Rust, Flutter, and iOS CI;
- after merge, continue with persistent command-log save/load, then dossier
  evolution. The stable-ID translation-overlay foundation planned in the
  roadmap is now implemented for GreenFire and GoldenShell.

## Authoritative foreground clock checkpoint `06c6f82` / `e3d9752` — 2026-07-30

Status: two isolated implementation commits are complete on
`feat/authoritative-foreground-clock`. Local quality gates pass. Push, pull
request, and remote CI are not claimed in this entry until they are observed.

Repository state:

- base: `main@0d0a3ccec076dc493d2ff72af60deecb64f38341`;
- runtime commit:
  `06c6f82 feat(runtime): add authoritative foreground clock`;
- scenario migration commit:
  `e3d9752 refactor(scenarios): remove operational-period clock actions`;
- `CURRENT_PROGRESS.md` was clean at branch creation, so no documentation stash
  was required;
- the older `feat/foreground-clock-control` branch was inspected but not
  rebased or cherry-picked because it also contained unrelated lifecycle work.

Completed in `06c6f82`:

- added additive `ScenarioClockDefinition` / `ScenarioClockMode`;
- preserved missing `clock` as backward-compatible `action_driven`;
- exposed snapshot `clock_mode` without changing snapshot or C ABI versions;
- added authoritative `advance_time` to session, registry, JSON bridge, FFI
  regression coverage, Dart bridge builder, and `RustScenarioRepository`;
- rejects terminal, action-driven, zero, over-1440-minute, unknown-session, and
  overflow cases with controlled errors;
- refactored action costs and foreground commands onto one temporal-boundary
  processor;
- same-minute priority is `AtTime`, async completion, then deadline miss, with
  scenario-definition order inside a category;
- a terminal consequence stops a larger advance at its exact boundary;
- added simulator mixed `dispatch` / `advance_time` commands and
  `--commands-file`, while retaining action-only `--actions`;
- connected the existing Flutter pause/speed/lifecycle controls to Rust
  snapshots only when `clock_mode == foreground`;
- clock failures preserve the last snapshot, pause repeated ticking, and show
  one controlled user-visible error;
- preserved the three native symbols and ABI version 1.

Completed in `e3d9752`:

- removed the temporary operational-period action from GreenFire and
  GoldenShell canonical content, stage exits, generated bundle, tests, and
  authoring documentation;
- GreenFire actions changed from 14 to 13;
- GoldenShell actions changed from 18 to 17;
- added four executable mixed command traces under `content/traces`;
- preserved all deterministic terminal results:
  - GreenFire protected: `protected_crisis_position` at 4440;
  - GreenFire compromised: `compromised_crisis_position` at 4590;
  - GoldenShell coordinated: `coordinated_claim_position` at 4545;
  - GoldenShell fragmented: `fragmented_claim_position` at 4710;
- Logistics remains action-driven with its existing negotiated and judgment
  clocks unchanged;
- added `AUTHORITATIVE_FOREGROUND_CLOCK_V1.md` and updated scenario/simulator
  authoring guides;
- regenerated the deterministic four-case mobile bundle.

Commands actually executed after the final migration:

```powershell
cargo +1.78.0 check --workspace --locked
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo run -q -p juris-scenario-diagnostics -- validate `
  content/cases/greenfire_first_72_hours.scenario.json
cargo run -q -p juris-scenario-diagnostics -- validate `
  content/cases/goldenshell_recall_at_dawn.scenario.json
cargo run -q -p juris-scenario-simulator -- run `
  <scenario.json> --commands-file <trace.commands.json> --require-outcome
dart run tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris --check
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --debug --no-pub
git diff --check
```

Observed results:

- Rust MSRV, fmt, workspace check, Clippy, all workspace tests, and doc tests:
  passed;
- GreenFire and GoldenShell authoring diagnostics: passed;
- all four mixed simulator traces: completed at the exact clocks and outcomes
  listed above;
- deterministic mobile bundle check: passed with four cases;
- Flutter analyze: the first run found one import-order info; it was fixed and
  the repeated run reported `No issues found`;
- Flutter tests: 61 passed;
- debug APK:
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`;
- source/FFI audit shows exactly the existing execute, string-free, and
  ABI-version C symbols;
- project line count requested during the checkpoint: 44,463 lines across 249
  text files, excluding `.git`, `target`, Flutter `build`, `.dart_tool`, and
  binaries.

Known limitations:

- no physical Android/iPhone device, release signing, App Store, or Play Store
  result is claimed;
- local iOS build is unavailable on Windows; the hosted iOS Native FFI workflow
  must provide the remote gate;
- foreground time advances only through explicit commands while active; there
  is intentionally no background or offline catch-up;
- mixed command files are authoring/replay fixtures, not persistent saves;
- historical sections below retain the old temporary-action notes because this
  file is cumulative; this checkpoint supersedes them.

Next step:

- push this branch and open a PR to current `main`, then observe Rust CI,
  Flutter Mobile UI, and iOS Native FFI to terminal status;
- after merge, implement `Lost != Closed` by separating judicial result from
  matter closure;
- then proceed with the stable-ID translation overlay, persistent command-log
  save/load, and dossier evolution.

## GoldenShell merge and iOS gate `084f43a` — 2026-07-29

Status: pull request
[#6](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/6) is merged
into `main`. The documented release checkpoint is tagged
`v0.5.1-alpha.1`.

Repository state:

- branch: `main`;
- PR head before merge:
  `90477396500e5ee228bef608c956f84475d6d058`;
- merge commit:
  `084f43a0464a632ceb1fe8cd982fbab68cab4307`;
- release tag: `v0.5.1-alpha.1`;
- tag meaning: first `0.5.1` alpha checkpoint containing the playable
  GoldenShell recall-at-dawn scenario and its stable iOS native FFI gate.

Completed:

- merged the isolated GoldenShell scenario, mobile catalog integration,
  deterministic bundle, runtime coverage, and authoring documentation;
- preserved the implementation commit `51cb1ee`, progress commit `5d8eca7`,
  and iOS CI stabilization commit `9047739` in merge history;
- diagnosed iOS Native FFI run `30491693874`:
  - Runner and Rust static library build passed;
  - all three C ABI exports passed `nm` verification;
  - the iPhone Simulator booted;
  - `flutter test` then waited 34 minutes after `Xcode build done` without
    connecting to the application and the 45-minute job timeout cancelled it;
  - a retry on a new runner reproduced the launch/VM-service handshake stall;
- replaced the flaky CI transport with a hosted XCTest that runs inside the
  real iOS Runner process and calls the same three exported C ABI symbols;
- the XCTest loads the canonical bundled Logistics scenario and verifies
  `create_session -> dispatch -> snapshot -> dispose_session`, repeated
  disposal, and an invalid session handle;
- limited the native lifecycle step to 15 minutes so a future launch stall
  cannot consume the complete 45-minute job without a precise step result.

Remote quality gates on `9047739`:

- Rust CI run
  [30496143812](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30496143812):
  success;
- Flutter Mobile UI run
  [30496143759](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30496143759):
  success;
- iOS Native FFI run
  [30496143709](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/30496143709):
  success;
- the successful iOS run includes Runner/Rust build, ABI symbol verification,
  Simulator boot, hosted XCTest lifecycle, and post-job cleanup.

Known limitations:

- the Dart `DynamicLibrary.process()` integration test remains available for
  targeted/manual runs, but GitHub's release gate now uses hosted XCTest to
  avoid the observed Flutter VM-service handshake deadlock;
- no physical iPhone, release signing, App Store, Play Store, dossier schema,
  or persistent save/load result is claimed;
- `coordinate_operational_period` remains temporary until the authoritative
  foreground-clock work is rebased onto this `main`.

Next step:

- rebase the foreground-clock branch onto merge `084f43a`;
- expose authoritative foreground clock control through the existing bridge
  and mapper;
- remove temporary `coordinate_operational_period` actions from GreenFire and
  GoldenShell while preserving their stable scenario/action IDs and
  deterministic terminal paths.

## GoldenShell recall-at-dawn checkpoint `51cb1ee` — 2026-07-29

Status: implementation is committed and pushed; pull request
[#6](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/6) is open
against `main`. No merge has been performed.

Repository state:

- branch: `feat/goldenshell-recall-at-dawn`;
- base: `753496e064083925a532322ed0cf923d0f072cdb`;
- implementation commit:
  `51cb1eee5e7985833e480403c2129431f4e454ee`;
- implementation commit subject:
  `feat(scenarios): add GoldenShell recall at dawn`;
- the implementation commit contains 16 files and is isolated from
  `Lost != Closed`, foreground-clock, persistence, and dossier-schema work.

Completed:

- added fictional playable case `nl_food_safety_goldenshell_001` and canonical
  scenario `goldenshell_recall_at_dawn` through the existing
  `ScenarioDefinition v1` / `rust_scenario_v1` production path;
- added 4 stages, 18 stable actions, 4 deadlines, 1 asynchronous residue
  assessment, 10 Inbox items, 12 events, and 2 terminal outcomes;
- populated 9 actors, 8 facts, and 13 evidence records using current schema
  types;
- added deterministic coordinated and fragmented paths:
  - coordinated: `coordinated_claim_position`, clock 4545, no missed deadlines
    or asynchronous-task expiry;
  - fragmented: `fragmented_claim_position`, clock 4710, typed insurer,
    contractor, and retailer deadline misses plus residue-assessment expiry;
- added EN/RU case-catalog content and regenerated mobile bundle v3 from
  3 cases to 4 cases;
- corrected the shared exporter so engine-backed cases use canonical
  `scenario.metadata.id` instead of assuming that case ID equals scenario ID;
- added catalog, validator, diagnostics, simulator, engine, bridge, FFI, and
  Flutter catalog/repository regression coverage;
- documented fictionalization, stable IDs, proof layers, lifecycle, terminal
  paths, and future dossier hooks in
  `docs/authoring/GOLDENSHELL_RECALL_AT_DAWN.md`;
- preserved the existing three-symbol mobile C ABI; no GoldenShell-specific
  native API or Dart production repository was introduced.

Commands actually executed:

```powershell
cargo run -q -p juris-scenario-diagnostics -- validate `
  content/cases/goldenshell_recall_at_dawn.scenario.json --json
cargo run -q -p juris-scenario-simulator -- run `
  content/cases/goldenshell_recall_at_dawn.scenario.json `
  --actions <coordinated-actions> --require-outcome
cargo run -q -p juris-scenario-simulator -- run `
  content/cases/goldenshell_recall_at_dawn.scenario.json `
  --actions <fragmented-actions> --require-outcome
cargo fmt --all -- --check
cargo +1.78.0 check --workspace --locked
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
dart format lib test tool
dart run tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris --check
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --debug --no-pub
git diff --check
```

Results:

- diagnostics CLI reports `{"diagnostics":[]}`;
- both simulator CLI traces reach the expected deterministic terminal outcome
  and clock;
- Rust 1.78 MSRV check, formatting, current-toolchain workspace check, Clippy
  with warnings denied, and the full Rust workspace test suite pass;
- deterministic mobile bundle export check passes with 4 catalog cases and
  18 GoldenShell actions;
- Flutter analyze reports no issues;
- all 59 Flutter tests pass;
- Android debug APK builds successfully at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`;
- repository whitespace validation passes.

Known limitations:

- `coordinate_operational_period` remains a temporary content-level
  clock-advance action. It must be removed only after the separate authoritative
  foreground-clock change is merged and this branch is rebased;
- this checkpoint does not add dossier schema, persistent save/load,
  `Lost != Closed`, or foreground-clock runtime semantics;
- no new physical-device, release-signing, App Store, Play Store, or iOS
  Simulator result is claimed;
- GitHub Actions for PR #6 are remote gates and are not yet recorded as green
  in this checkpoint.

Next step:

- let PR #6 run Rust, Flutter, and native iOS CI; resolve only failures caused
  by this branch;
- after review and green CI, merge PR #6 into `main`;
- then rebase the separate foreground-clock work onto the new `main` and remove
  `coordinate_operational_period` from GoldenShell through the authoritative
  clock control rather than adding case-specific behavior.

## GreenFire vertical slice — 2026-07-29

Status: implementation and all local quality gates are complete; the isolated
commit is ready to create.

Completed:

- added playable case `greenfire_first_72_hours` using the existing
  `ScenarioDefinition v1`, `rust_scenario_v1` adapter, bridge, FFI, mapper, and
  Flutter case library;
- added 4 stages, 14 stable actions, 3 deadlines, 1 asynchronous expert task,
  7 Inbox items, 10 events, 2 outcomes, 8 actors, 5 facts, and 7 evidence
  records;
- added EN/RU catalog content and regenerated the deterministic mobile bundle;
- added protected and compromised deterministic traces:
  - protected: `protected_crisis_position`, 4440 minutes;
  - compromised: `compromised_crisis_position`, 4590 minutes;
- expanded the shared authoring simulator to execute every condition, effect,
  and event trigger already declared by ScenarioDefinition v1;
- implemented the shared authoritative runtime rule
  `usable_until_event -> expiry_event` for unreviewed asynchronous work;
- added validator, diagnostics, simulator, engine, bridge, catalog, Flutter
  catalog, and Flutter Rust-repository coverage;
- documented the vertical-slice boundary in
  `docs/authoring/GREENFIRE_FIRST_72_HOURS.md`.

Commands actually executed:

```powershell
cargo run -q -p juris-scenario-diagnostics -- validate `
  content/cases/greenfire_first_72_hours.scenario.json --json
cargo run -q -p juris-scenario-simulator -- run `
  content/cases/greenfire_first_72_hours.scenario.json `
  --actions <protected-actions> --require-outcome
cargo run -q -p juris-scenario-simulator -- run `
  content/cases/greenfire_first_72_hours.scenario.json `
  --actions <compromised-actions> --require-outcome
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
dart.exe --disable-dart-dev tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris --check
dart.exe flutter_tools.snapshot analyze --no-pub
dart.exe flutter_tools.snapshot test --no-pub
dart.exe flutter_tools.snapshot build apk --debug --no-pub
git diff --check
```

Results:

- core validation and authoring diagnostics report no errors;
- protected and compromised simulator CLI traces reach their expected outcome
  and clock;
- Rust formatting, workspace check, Clippy with warnings denied, and the full
  workspace test suite pass;
- the mobile case bundle is deterministic and current with 3 cases;
- Flutter analyze reports no issues;
- all 57 Flutter tests pass;
- Android debug APK builds successfully at
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`;
- repository whitespace validation passes.

Known limitations:

- `coordinate_operational_period` remains a temporary six-hour foreground
  clock action pending the formal clock-control architecture;
- GreenFire covers the first 72 hours only; dossier, save/load, scoring, and
  later criminal/environmental/civil branches remain out of scope;
- no new physical-device, signing, or App Store result is claimed.

Next step:

- run remote CI for this commit, including the native iOS Simulator gate;
- then implement the planned terminal-outcome separation (`Lost != Closed`)
  without changing GreenFire stable IDs.

## iOS native checkpoint `c29f7e6` — 2026-07-29

Status: committed, pushed, and fully green in remote GitHub Actions.

Completed:

- verified remote GitHub Actions for `8842698`:
  - Rust CI run `30470625729`: success;
  - Flutter Mobile UI run `30470625878`: success;
- verified the unchanged gates for `45cce64`:
  - Rust CI run `30471349312`: success;
  - Flutter Mobile UI run `30471340803`: success;
- verified the unchanged gates for `b133222`:
  - Rust CI run `30472472294`: success;
  - Flutter Mobile UI run `30472472141`: success;
- added a dedicated `iOS Native FFI` workflow on `macos-15-intel`;
- configured the workflow to install both supported Rust simulator targets,
  build Flutter Runner through Xcode, and verify the generated static library
  exports all three C ABI symbols;
- added an iOS Simulator integration smoke that resolves the Rust symbols via
  `DynamicLibrary.process()` and executes:
  `create_session -> dispatch -> snapshot -> dispose_session`;
- the integration smoke also verifies a repeated dispose and an invalid
  session handle return controlled versioned JSON responses.

Commands actually executed locally:

```powershell
flutter pub get
dart format integration_test/native_ios_ffi_smoke_test.dart
flutter analyze --no-pub
flutter test --no-pub
C:\Program Files\Git\bin\bash.exe -n `
  apps/juris-mobile/tool/build_rust_ios.sh
git diff --check
gh run list --repo GenesisSocietyEngine/Genesis-AI-Juris `
  --commit 88426988d6206c2c8744d9199a146a2bab5ea1e2
gh run list --repo GenesisSocietyEngine/Genesis-AI-Juris `
  --branch feat/scenario-authoring-toolkit-v1 --limit 8
gh run view 30472472329 `
  --repo GenesisSocietyEngine/Genesis-AI-Juris `
  --json status,conclusion,jobs,startedAt,updatedAt
```

Results:

- Flutter dependency resolution completed;
- Flutter analyze reports no issues, including the new integration test;
- all 56 existing Flutter tests pass;
- the corrected build script passes a local syntax check with Git Bash 5.3;
- repository diff whitespace validation passes;
- both existing remote workflows for `8842698` are green;
- Rust CI and Flutter Mobile UI for `45cce64` and `b133222` are green.

First macOS execution:

- iOS Native FFI run `30471349440`, job `90642090060`;
- Flutter dependencies resolved and Xcode started the Runner build;
- Xcode invoked `build_rust_ios.sh`;
- the build stopped before Cargo because macOS system Bash 3.2 treats expansion
  of an empty array as an unbound variable under `set -u`;
- no staticlib, symbol, or Simulator success is claimed from this failed run;
- the script now uses explicit Debug and Release Cargo invocations and no
  longer expands an empty array.

Second macOS execution:

- iOS Native FFI run `30472472329`, job `90645880459`;
- the Xcode Runner build and Rust static-library build passed;
- `nm` confirmed all three required C ABI exports;
- an available iPhone Simulator booted successfully;
- the native Logistics lifecycle integration test passed through
  `DynamicLibrary.process()`, including create, dispatch, snapshot, repeated
  dispose, and invalid-handle behavior;
- the job was cancelled only in `Post Run subosito/flutter-action@v2` after
  exceeding the configured 30-minute total timeout;
- the workflow timeout is now 45 minutes so cache cleanup has a separate
  completion margin.

Final macOS execution:

- iOS Native FFI run `30475911046`, job `90657430970`;
- completed successfully in 22 minutes 51 seconds;
- Xcode/Rust static-library build, ABI symbol verification, iPhone Simulator
  boot, native Logistics lifecycle, cache cleanup, and checkout cleanup all
  passed.

Known limitations:

- no physical iPhone, signing, or App Store packaging result is claimed.

Next step:

- implement and validate the isolated GreenFire content vertical slice.

## FFI checkpoint `8842698` — 2026-07-29

Status: committed, pushed, and green in remote Rust and Flutter CI.

Completed:

- restored the agreed narrow scope: no schema, runtime-semantics, or Flutter UI
  migration is included in this checkpoint;
- replaced the post-MSRV `#[unsafe(no_mangle)]` syntax with the Rust
  1.78-compatible `#[no_mangle]` on all three exported C ABI functions;
- added an FFI-level Logistics lifecycle regression covering
  `create_session -> dispatch -> snapshot -> dispose_session`;
- added controlled coverage for an invalid session handle and a repeated
  `dispose_session` (`disposed: false`, valid JSON, no panic).

Commands actually executed:

```powershell
cargo +1.78.0 check --workspace --locked
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo test -p juris-mobile-ffi
dart.exe tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris `
  --check
dart.exe flutter_tools.snapshot analyze --no-pub
dart.exe flutter_tools.snapshot test --no-pub
```

Results:

- the exact GitHub Actions MSRV command passes on Rust 1.78.0;
- Rust formatting, workspace check, Clippy with warnings denied, and the full
  workspace test suite pass;
- `juris-mobile-ffi`: 3 passed, 0 failed;
- the native lifecycle test confirms stage `intake -> pre_action` and clock
  `0 -> 120`;
- the deterministic mobile bundle check passes;
- Flutter analyze reports no issues;
- all 56 Flutter tests pass;
- the standard Windows `dart.bat` / `flutter.bat` wrappers hung in their
  bootstrap script before starting Dart; the recorded successful gates used
  the same installed SDK's `dart.exe` and `flutter_tools.snapshot` directly.

Known limitations:

- this Windows host cannot build an Apple static library, link Xcode Runner,
  or launch an iOS Simulator;
- the existing macOS/Xcode build phase is therefore still unverified;
- the original GitHub Actions MSRV failure is resolved.

Next step:

- run `build_rust_ios.sh`, Xcode linking, and the same lifecycle smoke on a
  macOS/iOS Simulator host;
- after the iOS gate, implement `Lost != Closed`, then formalize the
  deterministic foreground clock before persistence, capabilities, or
  localization.

Этот файл — накопительный источник контекста для продолжения разработки и
архитектурного руководства. Он фиксирует состояние проекта после каждого
коммита: выполненные изменения, тестовое подтверждение, известные ограничения
и следующий шаг.

## Правила использования

1. После каждого нового коммита обновить front matter и раздел
   **Текущее состояние**.
2. Добавить новый раздел в начало **Журнала коммитов**.
3. Не писать, что тест был запущен, если в handoff-контексте нет результата
   команды. В этом случае указывать только добавленное тестовое покрытие.
4. Известные проблемы описывать как наблюдаемые ограничения, а не как
   предположения.
5. Следующий шаг должен быть конкретным и проверяемым.
6. Этот документ не заменяет release notes, ADR или спецификации. Он связывает
   их в актуальную последовательность для следующей рабочей сессии.

## Текущее состояние

### Репозиторий

- Ветка: `feat/scenario-authoring-toolkit-v1`.
- HEAD: `14a6db6 feat(mobile): run scenarios through native Rust FFI`.
- Ветка локально опережает
  `origin/feat/scenario-authoring-toolkit-v1` на три коммита.
- Рабочее дерево после `14a6db6` было чистым.
- Три локальных непереданных коммита:
  `aaae41a`, `266c890`, `14a6db6`.

### Доступный продуктовый срез

- Failed ERP запускается через временный Dart runtime
  `DemoGameRepository`.
- Unpaid Logistics Invoices запускается через общий адаптер
  `rust_scenario_v1`.
- Logistics имеет два терминальных пути:
  `negotiated_recovery` и `judgment_recovery`.
- Mobile Case Library и bundle полностью data-driven.
- Bundle v3 содержит локализованную карточку дела и канонический
  `ScenarioDefinition` для engine-backed сценария.
- Версия Flutter-приложения: `0.5.1+12`.

### Текущая архитектура authority boundary

```text
Case Library / bundled ScenarioDefinition
  -> RustScenarioRepository
  -> NativeScenarioBridgeClient
  -> Dart FFI
  -> juris-mobile-ffi C ABI
  -> juris-mobile-bridge JSON protocol
  -> ScenarioSessionRegistry
  -> juris-engine::ScenarioSession
  -> immutable MobileScenarioSnapshot
  -> ScenarioSnapshotMapper
  -> Flutter GameSnapshot / screens
```

Flutter отправляет только стабильные action ID. Условия, effects, события,
время и outcomes интерпретируются исключительно Rust engine.

### Подтверждённые quality gates на HEAD

В рабочей сессии для `14a6db6` выполнены:

```powershell
cargo fmt --all -- --check
cargo check --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

dart run tool/export_mobile_case_bundle.dart `
  --repo-root C:\PROJECTS\Genesis-AI-Juris `
  --check
flutter analyze
flutter test
flutter build apk --debug --no-pub
```

Результаты:

- полный Rust workspace прошёл без ошибок;
- Flutter analyze прошёл без ошибок;
- все 56 Flutter-тестов прошли;
- deterministic mobile bundle check прошёл;
- Android x64 APK был установлен и запущен на `emulator-5554`;
- native `create_session` и `dispatch` изменили Logistics stage и clock;
- Android smoke path дошёл до terminal `judgment_recovery`;
- fat debug APK успешно собран;
- APK содержит `libjuris_mobile_ffi.so` для `arm64-v8a`,
  `armeabi-v7a` и `x86_64`.

### Известные ограничения на HEAD

1. iOS Runner, static-library build phase и FFI linking настроены, но iOS
   сборка ещё не выполнялась на macOS/Xcode.
2. Failed ERP остаётся отдельным Dart demo runtime и ещё не переведён в
   канонический `ScenarioDefinition`.
3. Native sessions process-local. Persistent save/load и восстановление после
   перезапуска приложения отсутствуют.
4. Generic snapshot не содержит финансовые и карьерные показатели старого
   ERP UI. Mapper использует нейтральные presentation defaults для полей,
   которых нет в scenario schema.
5. Карточки дел локализованы, но display strings внутри
   `ScenarioDefinition` пока не имеют отдельного translation overlay.
6. FFI API синхронный. Для текущих небольших JSON snapshots это приемлемо, но
   большие сценарии могут потребовать isolate/async transport.
7. Release signing, App Store/Play Store packaging и физический iPhone
   checkpoint не выполнены.

### Следующий шаг

Обязательная проверка: собрать и запустить iOS target на macOS/Xcode, выполнить
`create_session -> dispatch -> dispose_session` на iOS simulator и записать
результат в этот файл.

Следующий продуктовый этап после iOS gate: добавить localization overlay,
привязанный к стабильным scenario/entity ID, чтобы переводить факты, evidence,
actions, stages, inbox и outcomes без изменения канонической игровой логики.

## Журнал коммитов

Исторические записи ниже основаны на Git diff, именах тестов и документации.
Git не хранит stdout прошлых тестовых запусков, поэтому для старых коммитов
указано тестовое покрытие, но не заявлен неподтверждённый факт запуска.

### `14a6db6` — feat(mobile): run scenarios through native Rust FFI

Дата: 2026-07-29.

Выполнено:

- добавлен versioned C ABI crate `juris-mobile-ffi`;
- добавлена Android сборка Rust `cdylib` для armv7, arm64 и x64;
- добавлен iOS Runner и Xcode build phase для Rust `staticlib`;
- добавлен общий Dart FFI client;
- добавлены `RustScenarioRepository` и `ScenarioSnapshotMapper`;
- mobile bundle обновлён до v3 и содержит Logistics scenario JSON;
- Logistics переведён в `playable` через `rust_scenario_v1`;
- native session создаётся, принимает action ID, возвращает snapshot и
  освобождается при выходе/reset;
- версия приложения повышена до `0.5.1+12`.

Тесты и проверки:

- реально выполнены полные Rust gates;
- реально выполнены Flutter analyze и 56 тестов;
- добавлены два repository-теста обоих Logistics paths;
- реально выполнен Android emulator smoke test;
- реально собран fat APK с тремя ABI.

Известные проблемы:

- iOS wiring не проверен на macOS;
- Failed ERP ещё использует Dart runtime;
- нет persistent saves;
- generic mapper временно заполняет отсутствующие legacy UI metrics.

Следующий шаг:

- подтвердить iOS build/smoke, затем реализовать stable-ID localization
  overlays для scenario content.

### `266c890` — feat(runtime): add generic mobile scenario bridge

Дата: 2026-07-29.

Выполнено:

- добавлен authoritative `ScenarioSession` в `juris-engine`;
- реализованы schema v1 conditions/effects, repeatability, clock, events,
  deadlines, async tasks, inbox и terminal outcomes;
- добавлен `ScenarioSessionRegistry` с изолированными session ID;
- добавлен безопасный transport-neutral `juris-mobile-bridge`;
- Flutter переведён на общий `GameRuntimeRepository`;
- добавлен JSON contract `ScenarioBridgeClient`;
- readiness начала отдельно отражать наличие engine runtime.

Тесты и проверки:

- реально выполнены Rust format/check/clippy/workspace tests;
- добавлены 5 engine runtime tests и 3 bridge protocol tests;
- реально выполнены Flutter analyze и 54 теста;
- выполнен Android catalog smoke test без native dispatch.

Известные проблемы:

- production native transport отсутствовал;
- Logistics был engine-ready, но ещё не launchable;
- snapshot mapper ещё не существовал.

Следующий шаг:

- подключить bridge к Flutter через Android/iOS native transport и mapper.

### `aaae41a` — feat(scenarios): add mobile case library and logistics scenario

Дата: 2026-07-29.

Выполнено:

- добавлена data-driven Mobile Case Library;
- добавлены стабильные `case_id`/`scenario_id`, локализации EN/RU и readiness;
- добавлен deterministic bundle exporter;
- добавлен канонический Logistics `ScenarioDefinition`;
- добавлены negotiated и judgment/enforcement paths;
- добавлен catalog launch guard, исключающий подмену Logistics ERP demo.

Тесты и проверки:

- добавлены Flutter catalog tests;
- добавлены production-scenario tests в validator, diagnostics и simulator;
- deterministic exporter получил check mode;
- Mobile Test Checkpoint 1 задокументирован.

Известные проблемы:

- Logistics был catalog outline и не запускался в Flutter;
- gameplay UI продолжал работать только с Failed ERP demo;
- engine runtime для общего scenario schema ещё отсутствовал.

Следующий шаг:

- реализовать общий authoritative runtime и mobile bridge.

### `168ef95` — feat(authoring): add deterministic scenario path simulator

Дата: 2026-07-29.

Выполнено:

- добавлен `juris-scenario-simulator`;
- реализована детерминированная интерпретация actions, conditions, effects,
  events, time и outcomes;
- добавлены replay traces и CLI path runner;
- добавлена valid authoring fixture.

Тестовое покрытие:

- добавлены 17 simulator tests, включая determinism, invalid actions,
  automatic events и terminal outcome requirements.

Известные проблемы:

- simulator был authoring-инструментом, а не production mobile runtime;
- session lifecycle и mobile snapshot contract отсутствовали.

Следующий шаг:

- применить pipeline к production catalog scenario и mobile library.

### `a52dd90` — feat(validation): add temporal and outcome diagnostics

Дата: 2026-07-29.

Выполнено:

- добавлен `juris-scenario-diagnostics`;
- реализованы temporal, outcome и remedy diagnostics;
- добавлен CLI и machine-readable diagnostics;
- добавлена valid temporal/outcome fixture.

Тестовое покрытие:

- добавлены 17 diagnostics tests для временных противоречий, ambiguous
  outcomes, terminal stages и post-judgment remedies.

Известные проблемы:

- diagnostics доказывали authoring integrity, но не исполняемость полного
  action path.

Следующий шаг:

- добавить deterministic path simulator.

### `02d2246` — feat(authoring): add scenario builder CLI

Дата: 2026-07-29.

Выполнено:

- добавлен `juris-scenario-builder`;
- добавлен versioned commercial-litigation template;
- реализованы генерация, validation-before-write, overwrite protection и CLI;
- stable IDs отделены от display names.

Тестовое покрытие:

- добавлены 17 builder tests для CLI, determinism, UTF-8, validation,
  cloning и безопасной записи.

Известные проблемы:

- builder создавал структурно валидный стартовый контент, но ещё не проверял
  temporal/outcome quality и complete gameplay path.

Следующий шаг:

- добавить authoring diagnostics.

### `833089c` — feat(authoring): add case catalog and matter identity schema

Дата: 2026-07-29.

Выполнено:

- добавлен `juris-case-catalog`;
- добавлены matter identity, fictional parties, procedural roles и stable IDs;
- добавлены Failed ERP и Logistics identity records;
- введена проверка caption и player-client references.

Тестовое покрытие:

- добавлены catalog/identity validation и round-trip tests.

Известные проблемы:

- identity и scenario content ещё не имели общего authoring workflow;
- mobile library отсутствовала.

Следующий шаг:

- добавить CLI, создающий новые case identities из шаблона.

### `42af671` — Merge pull request #1: Scenario Definition v1

Дата: 2026-07-29.

Выполнено:

- объединена ветка schema v1 с mobile/gameplay линией;
- merge не содержит самостоятельной предметной реализации сверх родителей.

Тестовое подтверждение:

- отдельный execution log merge-коммита в Git отсутствует;
- покрытие определяется parent commits `9239679` и `ed087e9`.

Известные проблемы:

- после merge schema ещё не имела catalog, builder, diagnostics и simulator.

Следующий шаг:

- добавить case catalog и matter identity schema.

### `ed087e9` — feat(schema): add scenario schema crate and fixtures

Дата: 2026-07-28.

Выполнено:

- добавлен typed `juris-scenario-schema`;
- определены actors, facts, evidence, stages, actions, conditions, effects,
  events, deadlines, async tasks, inbox и outcomes;
- добавлены typed stable IDs и YAML fixture.

Тестовое покрытие:

- добавлены schema round-trip tests и plain-scalar ID checks.

Известные проблемы:

- schema описывала данные, но не обеспечивала structural/reference,
  lifecycle, reachability и terminal validation.

Следующий шаг:

- объединить schema v1 и расширенный gameplay, затем построить authoring tools.

### `14d2e97` — fix(mobile): add dependency required by gameplay hotfix

Дата: 2026-07-28.

Выполнено:

- mobile build number повышен с `0.5.0+9` до `0.5.0+10`.

Тестовое подтверждение:

- код и тесты не изменялись;
- отдельный execution log отсутствует.

Известные проблемы:

- название коммита упоминает dependency, но Git diff содержит только version
  bump; это важно не интерпретировать как добавление пакета.

Следующий шаг:

- продолжить Scenario Definition v1 и authoring pipeline.

### `3dc127b` — feat(gameplay): add loss paths, remedies, and variable clock

Дата: 2026-07-28.

Выполнено:

- расширены проигрыш, appeal/cassation и post-judgment branches;
- добавлен variable foreground clock;
- добавлены terminal validation rules;
- расширены outcome summaries и case reports.

Тестовое покрытие:

- добавлены `loss_clock_test`, `post_judgment_clock_test`;
- добавлены terminal validator tests;
- расширены Flutter widget tests.

Известные проблемы:

- gameplay оставался крупным case-specific Dart repository;
- generic scenario schema/runtime ещё не управляли Flutter.

Следующий шаг:

- стабилизировать mobile package/version и добавить Scenario Definition v1.

### `292cab2` — feat(validation): add scenario reachability rules

Дата: 2026-07-28.

Выполнено:

- добавлен graph-based reachability validator;
- выявляются unreachable stages, missing exits, orphan by-effect events и
  недостижимые outcomes;
- lifecycle tests расширены взаимными правилами.

Тестовое покрытие:

- добавлены 6 focused reachability tests;
- расширены lifecycle validation tests.

Известные проблемы:

- terminal-stage completeness и post-judgment outcome constraints ещё не
  покрывались отдельным модулем.

Следующий шаг:

- добавить terminal validation и loss/remedy paths.

### `5a7c154` — feat(validation): enforce scenario lifecycle invariants

Дата: 2026-07-28.

Выполнено:

- добавлены lifecycle rules для deadlines, hearings, async tasks и required
  inbox items;
- валидатор требует completion/missed/expiry/resolution paths.

Тестовое покрытие:

- добавлены 9 focused lifecycle tests.

Известные проблемы:

- валидная ссылка ещё могла вести к логически недостижимому stage/event.

Следующий шаг:

- добавить reachability analysis.

### `2381142` — feat(validation): add structural and reference rules

Дата: 2026-07-28.

Выполнено:

- создан `juris-scenario-validator`;
- добавлены diagnostics с кодами и путями;
- реализованы structural checks, duplicate detection и reference resolution.

Тестовое покрытие:

- добавлены базовые validation tests для schema version, duplicates и
  неизвестных action/stage references.

Известные проблемы:

- structural/reference validity не гарантировала завершимость lifecycle.

Следующий шаг:

- добавить lifecycle invariants.

### `9239679` — fix(mobile): finalize inbox and case closure lifecycle

Дата: 2026-07-28.

Выполнено:

- завершены inbox statuses и terminal closure presentation;
- добавлены case outcome summary и report sheet;
- расширены demo transitions до явного закрытия дела.

Тестовое покрытие:

- расширены widget tests для terminal state, inbox ordering и case report.

Известные проблемы:

- Flutter repository оставался case-specific и authoritative только в рамках
  demo;
- scenario validation crates ещё отсутствовали.

Следующий шаг:

- добавить typed Scenario Definition validator.

### `0c5a717` — docs: organize release and patch documentation

Дата: 2026-07-28.

Выполнено:

- добавлены release notes `v0.5.0-alpha.1`.

Тестовое подтверждение:

- documentation-only commit; execution log отсутствует.

Известные проблемы:

- документация не устраняла незавершённые inbox/case closure transitions.

Следующий шаг:

- финализировать inbox и case closure lifecycle.

### `7731a03` — fix(mobile): stabilize legal case lifecycle

Дата: 2026-07-28.

Выполнено:

- нормализованы пути setup/upgrade/UI patch документации;
- обновлены ignore rules и README references.

Тестовое подтверждение:

- предметный gameplay-код не изменялся;
- execution log отсутствует.

Известные проблемы:

- patch/release documents ещё не полностью отражали alpha lifecycle.

Следующий шаг:

- оформить alpha release notes и завершить closure UI.

### `cd39744` — Stabilize mobile legal case vertical slice

Дата: 2026-07-28.

Выполнено:

- существенно расширен `DemoGameRepository`;
- стабилизированы procedural transitions, deadlines, async work и actions;
- расширены snapshot statuses и mobile widget coverage;
- добавлены patch notes до `v0.5.0+9.2.1`.

Тестовое покрытие:

- значительно расширен `widget_test.dart`;
- точный historical execution log отсутствует.

Известные проблемы:

- repository оставался монолитным и привязанным к Failed ERP;
- documentation paths ещё требовали нормализации.

Следующий шаг:

- стабилизировать lifecycle/document structure и terminal closure.

### `58b7021` — Organize release and patch documentation

Дата: 2026-07-28.

Выполнено:

- release notes перенесены в `docs/releases`;
- patch notes перенесены в `apps/juris-mobile/docs/patches`;
- distribution zip перенесён в `dist`.

Тестовое подтверждение:

- commit содержит только перемещения файлов;
- execution log отсутствует.

Известные проблемы:

- mobile vertical slice ещё нуждался в gameplay stabilization.

Следующий шаг:

- стабилизировать mobile legal case vertical slice.

### `4fc407f` — Complete hearing scheduling and rescheduling workflow

Дата: 2026-07-28.

Выполнено:

- добавлен Flutter mobile shell и Android scaffold;
- добавлены Inbox, Matter, Calendar, AI и Career screens;
- добавлен deterministic Failed ERP demo repository;
- реализованы hearing scheduling/rescheduling и action review;
- добавлены mobile CI, bootstrap/build/run scripts и UI documentation.

Тестовое покрытие:

- добавлен большой Flutter widget test suite;
- mobile CI workflow добавлен;
- точный historical execution log отсутствует.

Известные проблемы:

- mobile runtime был Dart-only demo;
- generic multi-case library и canonical scenario bridge отсутствовали;
- iOS scaffold отсутствовал.

Следующий шаг:

- упорядочить release/patch docs и стабилизировать полный case lifecycle.

### `7b81c15` — Update AI boundary tests for structured evidence output

Дата: 2026-07-25.

Выполнено:

- AI boundary переведён на structured evidence-aware output;
- расширены domain/engine/CLI модели;
- обновлены v0.4.1/v0.4.2 release и upgrade notes;
- расширен CI.

Тестовое покрытие:

- обновлены AI boundary tests для явно разрешённого evidence context;
- точный historical execution log отсутствует.

Известные проблемы:

- продукт оставался terminal-first;
- mobile shell ещё отсутствовал.

Следующий шаг:

- построить smartphone-first Flutter vertical slice.

### `34e7416` — Fix inbox reply test for asynchronous message delivery

Дата: 2026-07-25.

Выполнено:

- расширен event-driven Rust prototype до v0.4.0;
- добавлены async delivery, richer domain/engine/CLI behavior;
- inbox reply test адаптирован к доставке событий по времени;
- добавлены vision, roadmap и development journal.

Тестовое покрытие:

- обновлены Rust tests и CI;
- точный historical execution log отсутствует.

Известные проблемы:

- AI output ещё не был строго структурирован по evidence authorization.

Следующий шаг:

- укрепить AI authority boundary и structured evidence output.

### `36d5903` — Apply Rust formatting and normalize line endings

Дата: 2026-07-25.

Выполнено:

- отформатированы Rust CLI/core/domain/engine;
- нормализована структура строк и переносов.

Тестовое подтверждение:

- тестовый код не добавлялся;
- execution log отсутствует.

Известные проблемы:

- initial prototype ещё требовал async inbox и v0.4 domain expansion.

Следующий шаг:

- расширить event-driven engine и исправить async inbox reply behavior.

### `4f42c11` — Initial event-driven prototype v0.3.1

Дата: 2026-07-25.

Выполнено:

- создан Rust workspace и event-driven prototype;
- добавлены core, domain, content, AI, engine, simulation и CLI crates;
- добавлен первый Failed ERP JSON case;
- добавлены deterministic clock/RNG/scheduler, CI, VS Code tasks и setup docs.

Тестовое покрытие:

- initial crates содержали unit tests;
- GitHub Actions CI был добавлен;
- точный historical execution log отсутствует.

Известные проблемы:

- architecture была terminal-first;
- mobile app, typed scenario schema и authoring pipeline отсутствовали;
- line endings/formatting требовали отдельной нормализации.

Следующий шаг:

- нормализовать форматирование, затем расширить async event/inbox model.

## Шаблон для следующего коммита

Скопировать этот блок в начало журнала:

```markdown
### `<hash>` — <subject>

Дата: YYYY-MM-DD.

Выполнено:

- ...

Тесты и проверки:

- команда: результат;
- добавленное покрытие: ...

Известные проблемы:

- ...

Следующий шаг:

- один конкретный проверяемый шаг.
```
