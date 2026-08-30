# GENESIS: JURIS — Codex Progress Report

**Milestone:** v52 — Release Gate Recovery with Mandatory Mobile Parity
**Report date:** 2026-08-30 (Europe/Paris)
**Overall status:** **Release commit prepared — push, Site save and deployment pending**

## Executive summary

The web release-gate recovery, behavioral played-case import protection, mobile baseline verification, native evidence collection, and a first complete cross-repository parity lock have been implemented and exercised. The required web, Flutter, Rust, Android, and exact-SHA iOS gates have passed at least once.

The four final audit gaps are resolved. Judicial results are compared at every
checkpoint with nine non-null receipts; dirty or input-contaminated mobile
worktrees fail before evidence is accepted; unchanged numeric zero now commits
manual tax provenance; and all five recorded schema/runtime/ABI values are
bound to executable producers. The strict exact-SHA parity run and final web
gates are green.

The existing public Site has **not** yet been changed. Production remains on
version 51 at <https://studio.falcon-merlin.com> while this exact passing
release commit is pushed and saved as Site version 52.

## Repository and production state

### Web / Studio

- Working repository: current Codex workspace
- Existing Site: `genesis-juris-web`
- Site project ID: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`
- Current production version: 51
- Production URL: <https://studio.falcon-merlin.com>
- v52 source commit: **the commit containing this report; resolved SHA is recorded in the completion handoff**
- v52 Site version/deployment: **not yet created**

### Mobile

- Repository: `https://github.com/GenesisSocietyEngine/Genesis-AI-Juris.git`
- Locked, remotely reproducible commit: `39b856320ed5dc397562068706c4cea7d703899c`
- Flutter app version: `0.6.0+13`
- Rust workspace version: `0.5.0`
- Mobile product source changed for v52: **no**
- Separate mobile release prepared: **no; test evidence is not a mobile release**

The v52 changes are web-only release, import-validation, tax-inference, hook-lifecycle, and verification changes. The shared canonical bundle and the pinned mobile runtime source were not modified, so no mobile version bump is currently required.

## Completed implementation

### Web release-gate recovery

- Corrected `RateOrigin | undefined` modeling without `any`, unsafe casts, `@ts-ignore`, or artificial default origins.
- Established deterministic tax-rate precedence:
  - manual values, including zero;
  - explicitly labelled prompt values;
  - applicable jurisdiction/property defaults;
  - otherwise an explicitly unset origin.
- Prevented unrelated “New England” property facts from activating United Kingdom defaults.
- Stabilized Studio graph fitting with memoized bounds, a current-bounds ref, and a stable callback.
- Removed the Studio derivation dependency pattern that could create render/effect loops.
- Added the mandatory exact typecheck command:

  ```text
  tsc --noEmit --incremental false
  ```

- Made the verified build run strict typechecking and the parity lock before Vinext bundling under fail-fast shell semantics.

### Behavioral revision protection

- Added exact server-session validation before React state setters can run.
- Exact imports now require matching session status, session key, case ID, version, fingerprint, and revision.
- Revision mismatches and fingerprint tampering are rejected before the commit callback.
- Historical lookup remains identity-exact and does not silently substitute the current bundle when a historical revision is unavailable.
- Explicit legacy played-case compatibility remains supported.
- Tests exercise behavior through callbacks/state-mutation sentinels rather than relying only on source-text assertions.

### Mandatory mobile parity

- Added a machine-readable parity lock, deterministic fixtures, a Rust bridge probe, a TypeScript verifier, and a release verification script.
- Covered nine deterministic routes across all five canonical cases.
- Compared initial state and every command checkpoint for stage, clock, available actions, resources, numeric metrics, evidence, deadlines, inbox state, and outcome.
- Exercised web runtime serialization/normalization and Rust save inspection, load, snapshot equality, re-save equality, and final-state digests.
- Confirmed the canonical web/mobile bundles are byte-identical.

## Parity lock receipt

- Canonical bundle size: `684266` bytes
- Canonical bundle SHA-256: `e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a`
- Mobile Git blob: `464d88b02f6cf6101dc86c04abfc3505abcfb0a6`
- Bundle revision: `5`
- Catalog revision: `1`
- Scenario schema: `1.0`
- Runtime adapter: `rust_scenario_v1`
- Web runtime recorded value: `canonical-runtime-v1`
- Played-case schema recorded value: `3`
- Mobile save schema: `genesis.ai-juris.command-log`, revision `1`
- Mobile runtime compatibility: `scenario-runtime-v2`
- Mobile snapshot/projection recorded revisions: `1` / `1`
- Native bridge ABI recorded value: `1`
- Fixture SHA-256: `08e6cc641f9d7f7fb8b569b49015466172e413702bc2071e28889f1c978b5313`
- Final probe SHA-256: `b2151c0be831fbbbd55aba37a3568504d3ee10063472b3ce17dbdbc9d6f99326`
- Non-null judicial-result checkpoints: `9`

All nine route hashes were deliberately regenerated after activating the
judicial-result field. The compiled exact-SHA Rust comparison matched them,
and every existing mobile save digest remained unchanged.

## Test and gate evidence collected

| Gate | Result already obtained | Final rerun required? |
|---|---|---:|
| `npx tsc --noEmit --incremental false` | Passed, zero errors | No |
| `npm run lint` | Passed, zero errors and zero warnings | No |
| `npm test` | 167/167 passed: 139 existing + 28 milestone/audit | No |
| `npm audit --omit=dev` | Passed, 0 vulnerabilities | No |
| `git diff --check` | Passed; only Windows line-ending notices | No |
| `npm run build` | Passed | No |
| Initial `JurisApp` chunk | 300,048 bytes, below 305,000-byte guard | No |
| `flutter pub get` | Passed at locked mobile SHA | No source change; retain receipt |
| `flutter analyze` | Passed, no issues | No source change; retain receipt |
| `flutter test` | 222/222 passed | No source change; retain receipt |
| `cargo test --workspace --locked` | 351/351 passed across 48 non-empty suites | No source change; retain receipt |
| Cross-repository parity | 9/9 routes, every checkpoint and all save digests passed at exact clean SHA | No |
| Android native FFI integration | 12/12 passed on `emulator-5554` at exact SHA | No source change; retain receipt |
| iOS native FFI | Hosted run 31441634496 succeeded at exact SHA | No source change; retain receipt |

Additional exact-SHA hosted evidence:

- iOS Native FFI: <https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/31441634496>
- Flutter Mobile UI: <https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/31441634424>
- Rust CI: <https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/31441634457>

## Files currently changed or added

### Web implementation and verification

- `app/JurisApp.tsx`
- `app/TaxEconomicsPanel.tsx`
- `app/canonical-runtime.ts`
- `app/played-case-contract.ts` (new)
- `app/played-case-loader.ts`
- `app/tax-rate-inference.ts`
- `package.json`
- `scripts/build-verified.sh`
- `scripts/mobile-checkout-guard.ts` (new)
- `scripts/mobile-parity-probe.rs` (new)
- `scripts/parity-contract-assertions.ts` (new)
- `scripts/verify-mobile-parity.ts` (new)
- `scripts/verify-release.sh` (new)
- `parity/mobile-parity.lock.json` (new)
- `parity/mobile-parity-fixtures.json` (new)
- `docs/RELEASE-V52.md` (new)

### Tests

- `tests/release-hotfix.test.ts`
- `tests/studio-performance.test.ts`
- `tests/tax-rate-inference.test.ts`
- `tests/v14-mobile-parity.test.ts`
- `tests/mobile-checkout-guard.test.ts` (new)
- `tests/parity-contract-assertions.test.ts` (new)
- `tests/played-case-import.test.ts` (new)
- `tests/release-gate.test.ts` (new)

### Deliberately excluded from the v52 commit

The canonical bundle and four help-caption files appear modified only because of line-ending normalization and have no content diff. They must not be staged. Generated build output, temporary parity workspaces, mobile build output, credentials, and deployment archives must also remain uncommitted.

## Remaining work before deployment

1. Push this exact passing v52 source commit.
2. Package that exact commit and save one version 52 on the existing Site.
3. Deploy only that version, poll until `succeeded`, confirm the custom domain
   is unchanged, request the live URL, and inspect Worker logs for runtime
   exceptions and 5xx responses.
4. Remove the temporary deployment archive and exact-SHA mobile worktree after
   verification.

## Current release decision

**READY TO PUSH; production remains on v51 until the exact commit is saved.**

All implementation and platform gates are green. The remaining hold protects
source identity: deployment begins only after the reviewed release commit is
pushed and the saved Site version references that exact SHA. The
user's original instruction already authorizes deployment of version 52 after
those checks; no additional publication approval is required.

## Recommended next milestone

Finish and deploy v52 before beginning any historical bundle registry, 18-route fixture expansion, observability dashboard, chunk splitting, or Rust/WASM redesign. After v52 is verified in production, the next focused milestone should add broader parity-route coverage and release observability without changing the runtime architecture in the same release.
