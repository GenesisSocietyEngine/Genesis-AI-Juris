# Amendment: applicable release gates and local availability

**Historical inventory, superseded for execution availability:** the complete unchanged release script subsequently passed on exact web `6ab091d830ccfd9d6b76c0adc177341bca96e081` and mobile `5200b30cc50c77393c6f48b52ce91c0f30e70c64`. [Completed baseline gate and limits](AMENDMENT_AGGREGATE_BASELINE.md). The earlier dirty-document/device/dependency-resolution blockers below describe this inventory's original checkpoint. They are retained as history, not current blockers. A later independent review found a P1 private-read race; passing the existing baseline gate does not close that separate finding or acceptance gaps.

27 September 2026. Reviewed `C:/Users/User/Downloads/RELEASE_DECISION-amended.md`, the complete original UX runbook, repository `AGENTS.md`, current release script/guards/lock, closure ledger and retained release receipts. This report follows the coordinator's bounded local validation assignment; the attachment's statements about its separate offline review session are not evidence that this execution checkout is unavailable.

## Current scope and preserved state

Canonical web checkout is `C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27`, branch `codex/ux-convergence-2026-09-27`, current reviewed HEAD `80b234051c82e12e93da97d0866337420030a99c`; application commit `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`. Git comparison found no changes between these commits in app, DB, migrations, scripts, tests, parity, package/lock or Vite inputs. At first inspection Git status was empty. The later exact web guard correctly failed because the coordinator had created two untracked amendment evidence documents; that is not application drift. A full clean gate needs an isolated exact checkout or a reviewed evidence commit before preflight. No source files or checkouts were cleaned/reset here.

The outer root remains unrelated: `feat/professional-product-ui-redesign-pilot-v2`, `6ca50f24ab3a763ac80e5cd221c15db4a7592fd8`, with modified Cargo/progress files and existing untracked artifacts. It is not the mobile lock target and was preserved.

The usable exact mobile checkout is **`C:/PROJECTS/Genesis-AI-Juris/.worktrees/pr45-mobile-5200`**, HEAD **`5200b30cc50c77393c6f48b52ce91c0f30e70c64`**. Current guard verifies exact HEAD, index/working bytes and absence of relevant untracked inputs. The registered Temp checkout at the same SHA has missing files/probe; the long Roaming checkout has missing long-path goldens. Neither was repaired or substituted. The short clean checkout supplies the real parity probe and cached package resolution.

Read-only metadata/tool availability: pinned Node22.23.2 and Poppler25.07.0; Git Bash; cached Flutter3.44.8/Dart3.12.2 at `C:/Users/User/source/flutter`; installed Rust1.98.0 used explicitly, with offline Cargo dependencies and isolated target output. The default rustup shim tried to refresh another toolchain and hit sandbox temp permissions, so it was not treated as absence of Rust. Dart formatter initially returned exit1 after reporting unchanged files because its telemetry-cache write was denied; the host retry returned exit0. Git trust exceptions were process-scoped only, not global configuration changes.

## Script applicability matrix

`scripts/verify-release.sh` remains an established aggregate gate. Bash syntax PASS. Its10 web,9 mobile and3 native stages are not silently waived. Status below distinguishes current individual checks from a complete script execution; retained web evidence is described by its original source and scope. [Inventory](evidence/amendment-release-gate-inventory.json).

| Script stage | Applicable? | Evidence / current result | Remaining action |
| --- | --- | --- | --- |
| Prerequisites | Yes | Mobile exact checkout and executable report-layout probe available; five-scenario dossier E2E file present. Locked full40-character heads required; visual-baseline update flag must be unset. | Bind final clean web checkout. |
| Web1 exact clean checkout | Yes | **BLOCKED in active working tree after new amendment docs**; guard reported only two newly untracked evidence files at invocation. Initial source checkout was clean. | Isolate exact80b or commit reviewed evidence; do not delete work. |
| Web2 strict TypeScript | Yes | Retained **PASS** on application8ee; current app/test input continuity established. No duplicate run in this bounded task. | Full script must record its own nonincremental check. |
| Web3 lint | Yes | Retained full lint **PASS**, two existing warnings recorded in prior log. | Full script invocation still pending. |
| Web4 npm test (includes build) | Yes | Existing860PASS/3explicit SKIP plus scoped101PASS and reconciled older failures; no new single wholly green aggregate command invented. | **NOT_RUN** aggregate on final exact checkout. |
| Web5 five required dossier E2E scenarios | Yes | Executable test exists; preceding scoped/source evidence is narrower. | **NOT_RUN** new exact full gate here. |
| Web6 PDF corpus | Yes | Retained47PDF/758page/55golden PASS; actual browser Base3pages independently inspected; renderer input continuity retained. | Do not regenerate unchanged corpus merely to invent fresh evidence; full script records its own check when run. |
| Web7 production audit | Yes | Retained authorized audit exit0/zero vulnerabilities at17:55UTC; package/lock unchanged. | Full release invocation/current audit as required before release. |
| Web8 patch hygiene | Yes | Prior clean checks retained; documentation changes are current work. | Run after final evidence edits. |
| Web9 verified build | Yes | Exact8ee application build PASS, digest25d6309e…;80b application inputs unchanged. | Final full script/build identity must name chosen release commit. |
| Web10 final web immutability | Yes | **NOT_RUN** as full-script before/after pair. | Compare its own preflight/final receipts. |
| Mobile1 exact SHA/runtime parity | Yes | **PASS fresh** actual Rust bridge/ABI and18routes/everycheckpoint at5200b30; source guard PASS. | Keep exact locked checkout. |
| Mobile2 executable report layout | Yes | **PASS fresh** actual Dart probe7fixtures, current web manifest/font metrics/fixtures. | Retain receipt; no schema/data changes. |
| Mobile3 Dart formatting | Yes | **PASS fresh**117files0changed, exit0 host retry. | None for this scoped check. |
| Mobile4 dependency resolution | Yes | Existing package config/cache usable. Fresh `flutter pub get` **NOT_RUN**; analysis/tests intentionally use `--no-pub`. | Full script must record actual resolution; cached availability is not a resolution pass. |
| Mobile5 Flutter analysis | Yes | **PASS fresh** no issues,115.1seconds using installed SDK and existing dependencies. [Log](evidence/amendment-flutter-analyze.log). | None for scoped analysis. |
| Mobile6 Flutter tests | Yes | **PASS fresh**275 tests, exit0, using existing dependencies with `--no-pub`. [Log](evidence/amendment-flutter-tests.log). | Dependency-resolution step remains distinct. |
| Mobile7 Rust formatting | Yes | **PASS fresh**, `cargo fmt --all -- --check`, exit0. | None. |
| Mobile8 Rust Clippy | Yes | **PASS fresh**, workspace/all-targets/locked/offline, warnings denied. [Log](evidence/amendment-rust-clippy.log). | None. |
| Mobile9 Rust tests | Yes | **PASS fresh**359 passed,0 failed,0 ignored across73 result groups; locked/offline dependencies and isolated target, exit0. [Log](evidence/amendment-rust-tests.log). | None for this scoped run. |
| Native1 Android FFI smoke | Yes | **BLOCKED at current ready-device prerequisite:** SDK/ADB installed and existing ADB server queried; zero attached devices. Existing AVD definitions `Pixel` and `Pixel_10_Pro_XL` are present; their safe execution readiness has not been tested. No emulator launched. | Prepare a supported ready device/emulator while preserving existing AVD data, then actual persistence smoke. This is not a claim that Android tooling or AVD definitions are unavailable. |
| Native2 exact hosted evidence lock | Yes | **PASS structural lock check:** android33536571436, flutter33536571515, ios33536571586, rust33536571536 all success at exact5200b30. Existing records, not new remote CI execution. | Retain lock provenance; do not relabel local tests as iOS. |
| Native3 final mobile immutability | Yes | **PASS fresh** before and after all completed checks: tracked bytes equal5200b30; final Git status empty. | Preserve exact checkout. |
| Local iOS/Xcode execution | Not a separate local step in this script | **N/A on Windows as local execution capability**; no Xcode/Apple simulator claimed. Script's exact hosted iOS evidence requirement remains applicable above. | Use required hosted/macOS evidence, not a waiver. |

**Complete release script: NOT_RUN.** Native Android device absence currently prevents completing it. Individual passes do not establish engineering acceptance, deployment, production GO or pilot GO. No emulator, SDK update, app source edit or hosted mutation was made in this task.

## Natural expiry and FiveFlats

**Elapsed natural expiry is not an additional mandatory gate on current evidence.** The amendment explicitly distinguishes it from the already observed controlled server-side expiry/re-authentication path. No clause requiring multi-day elapsed waiting was found in the current release script, repository review instruction or original runbook. Earlier ledger rows may retain natural-expiry NOT_RUN as historical scope, but should not make that alone a release blocker. A newly identified concrete clock/timing risk or applicable policy would require its own named check.

**FiveFlats is conditional, and the local availability condition is met.** The original runbook says to use it only if available and verify current values from the current source. Local original and revised exports exist. Read-only current normalization verifies their stored canonical fingerprints; no values were invented, imported from memory or changed. [Identity receipt](evidence/amendment-fiveflats-identity.json).

- Original `C:/Users/User/Downloads/five_flats_three_borders-v1.0.0.juris-case.json`:35,126bytes; SHA256 `450bc74894aa73ce9e4b05c0e46694b48718beb6537460343556846bcc41ac6c`; case `five_flats_three_borders`,v1.0.0; normalized/stored fingerprint `sha256-5d6bacb19f64eed5a14e834ade0242b38214f3978b9363600675a44542332f6a`.
- Latest observed revised export `five_flats_three_borders_rent146000_working_20260923-v1.0.0.juris-case (4).json`:37,638bytes; SHA256 `a465553d3c328cd7637b8e7177cbb29d903531d38e853126caf5e50609a1ce29`; exported2026-09-25T15:17:48.649Z. Its distinct working-copy ID/v1.0.0 and normalized fingerprint `sha256-f3cc75e5bf9fe0b5dca8957cd2d2be5788635701e8bc24279ebd9603dae32c39` match the repository `tests/fixtures/fiveflats-rent-146000.studio-draft.json` and four earlier revised exports. File-byte hashes differ because envelopes retain separate export metadata; they are not claimed byte-identical.
- The accompanying historical staging brief describes that revision as a separate working copy and says not to overwrite/promote the original. Those document instructions are context, not new authority to mutate hosted data. Current validation preserves both identities and all original files. Normalization/fingerprint checks do not validate professional conclusions or prove the historical server's HMAC key.

Complete canonical-file/browser exercise remains **NOT_RUN**, not N/A for missing files. Existing numerical/helper/PDF tests cover a narrower scope. Any browser import still needs its ordinary authorized file chooser; the previous source-v2 permission rejection must not be bypassed using another tool. Actual200% zoom, real screen reader, hosted candidate access/review, source-version/dependent-output lifecycle and five real participant sessions remain separate acceptance requirements under the coordinator's ledger.
