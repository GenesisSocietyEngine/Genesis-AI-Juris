# Site 69 baseline-recovery receipt

This receipt records the baseline-history recovery plus narrowly scoped post-provenance evidence and development-tooling advisory remediation. It does not begin Phase B or Phase C, change runtime source, migrate a tenant, deploy or save a Site version, enable confidential uploads, or mutate production resources or secrets. The immutable provenance merge remains in the ancestry unchanged.

## Provenance

- GitHub base commit: `c088200138332cd212b87e266746ea85b53a2f77`
- GitHub base root commit: `4f42c11b422be41704f8b72e417e83feed1674f3`
- Verified Site 69 source commit: `6019e47346a2bf719a09dc1d874a2fc807f99598`
- Site 69 source root commit: `86111ee6244d2f78d9c552b56cfb3e3e583268f6`
- Site 69 source tree: `e415361e9a39fc823d625f80c883398b18914e6e`
- New two-parent provenance merge: `48227d0af54d7f5c117f3d29311f399602fe1933`
- Ordered provenance parents: GitHub base first, Site 69 source second
- Pre-recovery merge base: none (`git merge-base` exited 1 with no output)
- Site history length: 72 commits
- Site tracked paths: 373
- Canonical LF-delimited path-manifest SHA-256: `b1f800a750639000ddbfab44efe430742f97134343f862f58d747df1384e358c`
- Provenance merge diff against the Site 69 source: empty

The provenance merge was created with `git commit-tree` using the verified Site tree directly. Its tree is therefore byte-identical to the Site 69 source; no merge resolution or application/dependency edit is present in that commit.

## Source artifacts

- Bundle file: `site69-source-history.bundle`
- Bundle SHA-256: `fddb2f07cf2c8220169d758f7490e57695623bf1ca1d16574b2abefa509a657e`
- Bundle size: 51,822,446 bytes
- Bundle advertised ref: `6019e47346a2bf719a09dc1d874a2fc807f99598 refs/heads/main`
- Bundle status: complete history; `git bundle verify` passed
- Historical Site archive receipt supplied by the handoff: SHA-256 `3dcfe92950c2e5e0f99d7f638f0f66633397c5c25e62ac9e065cc8e27255d555`, 320 files, 25,825,280 bytes

The historical Site archive itself was not supplied with this recovery input. Its receipt values are recorded as handed-off evidence and remain independently unverified.

## Migration freeze

Migrations `0011` through `0018`, their matching snapshots, and the journal are frozen to the Git-blob SHA-256 values below. `0016_polite_sentinels.sql` is immutable. Any future tenant migration begins at `0019`.

| Repository path | SHA-256 |
| --- | --- |
| `drizzle/0011_operational_events.sql` | `0b556f390a83eec0dccd6dc76d12340a3083620b79e34ea1fa0cd4e83711e6c7` |
| `drizzle/0012_sleepy_magma_core.sql` | `f7287a42b2afb176de4f892fe476d6242dffb62e6d336484fbae55c077a0fe8c` |
| `drizzle/0013_sleepy_magma_guards_a.sql` | `18332d50e4b12c729187280a3dc397c35ef95e3daacc7a33419bfe327338022e` |
| `drizzle/0014_sleepy_magma_guards_b.sql` | `0eb85af54bea36fc6bd57319e4d0ae9761154fb497ab741dcb5830086da0c37b` |
| `drizzle/0015_sleepy_magma_guards_c.sql` | `82f696cc99ed5fd5b921d064cf7a4fc14b3ce77f06375c1c8b8aa631417429e5` |
| `drizzle/0016_polite_sentinels.sql` | `50a12891dbc6376d0dadf0b8008ad39815f7c5255204f745c3a2687f1e549c83` |
| `drizzle/0017_perfect_marvex.sql` | `0c98f442f7652b859d90b0ad7e070a762b18686357e013e807933d08ab2f4036` |
| `drizzle/0018_low_calypso.sql` | `5e4c6cfed12d3e4e59be200829473630d665e71ad2289fb8a46f572a30653f84` |
| `drizzle/meta/0011_snapshot.json` | `1b8c402a12eaf85bec3ed91b2c0e6f67606c630fcb5400c04e6aad64b25bc096` |
| `drizzle/meta/0012_snapshot.json` | `2b3b06d685ac2b685a5fcc778a89c0ac1b9fc7d6c08a49bd3fc955e1ac850077` |
| `drizzle/meta/0013_snapshot.json` | `1386270c72349407c35eb2f215ad0c05b47a1bf2b949ef4d2de4c1d9243a46ca` |
| `drizzle/meta/0014_snapshot.json` | `7d5eb459839a9cf29fa141bdc4b99b56f250a6c97d8178c05ca27d42a7cee8b4` |
| `drizzle/meta/0015_snapshot.json` | `00b16cd0c60210e458e4781e56446e3b4a2fa81c624cd1087ba91dc6683f0ab5` |
| `drizzle/meta/0016_snapshot.json` | `eab3ea213949697fff163ebcbb5816ecffe92365b3ff43b483a85ff33c1f74de` |
| `drizzle/meta/0017_snapshot.json` | `e7c49630218c2803f166c85decebb2d2e2a27693f88d2d66341ae7b9046d2dd9` |
| `drizzle/meta/0018_snapshot.json` | `2bc294e56636a5fff773c85aaa8c192870d8661f5dd032b14b68a34ea44aeafa` |
| `drizzle/meta/_journal.json` | `02bb7a530efdc3f3da03979d52d5afaa9628fcf22454eb9d6aefbe65515bc680` |

The journal entries at indices 11 through 18 must remain ordered as:

1. `0011_operational_events`
2. `0012_sleepy_magma_core`
3. `0013_sleepy_magma_guards_a`
4. `0014_sleepy_magma_guards_b`
5. `0015_sleepy_magma_guards_c`
6. `0016_polite_sentinels`
7. `0017_perfect_marvex`
8. `0018_low_calypso`

## Development-tooling advisory remediation

The remediation is isolated after the provenance merge and the original evidence commit. Commit `51ea26a6e0e399bbd898cbddb57b581ed92c3a95` pins patched `browserslist` and `fast-uri` resolutions and moves the abandoned `@esbuild-kit/core-utils` nested `esbuild` resolution to `0.25.12`; commit `ea00ad7fdf6c5ff788a2e9d762f19aebdb01dd50` pins `fflate` to the first patched in-range release, `0.7.5`. No `npm audit fix`, force flag, ignored advisory, or severity downgrade was used.

The current registry report for the original `940a465fe2849552962408e5a0510f93bb80f583` lock describes eight advisory records represented by seven package findings (two high and five moderate), which is one moderate `fflate` record more than the earlier six-finding handoff summary. The follow-up therefore closes the requested six findings and the additionally surfaced `fflate` finding. `browserslist@4.28.8`, `fast-uri@3.1.6`, and `fflate@0.7.5` satisfy their parent ranges. The nested `esbuild@0.25.12` override is intentionally outside abandoned `@esbuild-kit/core-utils@3.3.2`'s `~0.18.20` declaration because no patched release exists in that range; clean-install, CLI-load, typecheck, lint, build, and complete-test gates are required compatibility evidence.

## Exact-head verification

Run the fail-closed verifier from the repository root and supply the original bundle:

The verifier requires two external anchors: the literal expected `HEAD` and the SHA-256 of a canonical post-provenance manifest. The PR body records both values because a tracked verifier or receipt cannot securely embed its own final blob hash or enclosing commit SHA.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-site69-baseline-recovery.ps1 `
  -BundlePath C:\path\to\site69-source-history.bundle `
  -ExpectedHead <40-character-final-head> `
  -ExpectedPostProvenanceManifestSha256 <64-character-manifest-sha256>
```

The canonical UTF-8/LF manifest is domain-separated as `site69-post-provenance-manifest-v1` and binds the repository name, provenance SHA, expected head SHA, then exactly four final differences from the provenance merge. Each file row binds status, mode, path, Git blob ID, and raw-blob SHA-256:

- `docs/SITE69-BASELINE-RECOVERY-RECEIPT.md`
- `package-lock.json`
- `package.json`
- `scripts/verify-site69-baseline-recovery.ps1`

Every post-provenance commit must form one linear chain beginning with exact commits `940a465fe2849552962408e5a0510f93bb80f583`, `51ea26a6e0e399bbd898cbddb57b581ed92c3a95`, and `ea00ad7fdf6c5ff788a2e9d762f19aebdb01dd50`; every commit-level changed path must be in that same case-sensitive allowlist. Git replacement objects and non-empty legacy grafts are rejected, replacement processing and commit-graph acceleration are disabled, raw commit parent/tree headers are checked, and shallow repositories fail. Any other path, status, mode, hash, history shape, expected-head mismatch, non-ignored dirty/untracked file, or raw working-tree byte mismatch fails closed.

The verifier supplies integrity, not independent authenticity: a caller can choose a matching head and digest. The exact canonical rows and digest must therefore be repeated by the hosted exact-head review, and final human approval must name PR #45, the exact head, and the manifest digest.

Required exact-head evidence includes the provenance verifier, migration freeze, complete web tests, strict typecheck, lint, production build, production and full dependency audits, available Rust/Flutter/native gates, and hosted code/security/migration reviews. Results are not inherited from an earlier head.

### GitHub Actions diagnosis

GitHub Actions is enabled, all actions are allowed, and the four default-branch workflows are active with unrestricted `push` and `pull_request` triggers. PR #45 nevertheless has zero runs, check suites, statuses, and status-rollup entries because both the recovery head and its synthetic merge tree contain no `.github/workflows` directory. The provenance merge deliberately preserves the Site source tree, which also omits the monorepo Rust/mobile inputs those workflows require. None of the four workflows declares `workflow_dispatch`, and no run exists to re-run or re-request. A no-op commit, fabricated status, branch-protection change, or `pull_request_target` workaround would not provide valid exact-head evidence and was not used.

### Local gate record

The following results were produced on 2026-09-03. Web gates are bound to the final evidence commit by the externally supplied exact head and closed-manifest digest recorded in the PR body. Mobile/Rust checks are bound to the parity source commit `5200b30cc50c77393c6f48b52ce91c0f30e70c64`.

| Gate | Result |
| --- | --- |
| Provenance, bundle, 373-path, closed-manifest, strict-object, and 17-artifact migration verifier | PASS; exact rows and digest are recorded in the PR body |
| Clean exact-lock npm install and dependency-tree validation | PASS; 530 packages, deliberate overrides resolved as intended |
| Strict TypeScript | PASS |
| ESLint | PASS |
| Vinext production build | PASS; existing large-chunk warning reported |
| Complete web test suite | PASS, 496/496, in an LF-exact checkout |
| Production dependency audit | PASS, 0 vulnerabilities |
| Full dependency-tree audit | PASS, 0 vulnerabilities at every severity |
| Drizzle CLI compatibility | PASS; kit `0.31.10`, ORM `0.45.2`, configuration check reports `Everything's fine` |
| Rust local exact-lock gates | PASS; format, locked Clippy with warnings denied, and 359 locked workspace tests; 13 doc-test crates, 0 failures |
| Cross-repository mobile parity/export | PASS at `5200b30`; 18 routes and authoritative fingerprints |
| Flutter analysis | PASS at `5200b30` with Flutter `3.47.2` / Dart `3.13.2` |
| Dart no-write format check | FAIL at the authoritative hosted SDK resolution: 97 of 117 files would change; no file was formatted |
| Flutter exact-lock dependency resolution | FAIL closed: `pub get --enforce-lockfile` requests five lock changes (`intl`, `matcher`, `meta`, `test_api`, `vector_math`) |
| Flutter local tests | 265/275 PASS; 10 Windows golden comparisons fail under Flutter `3.47.2`; no golden was rewritten |
| Hosted Rust/Flutter/Android/iOS | Fresh raw-`5200b30` push-run attempts are recorded in the PR body; exact-lock limitations are stated there |
| Report-PDF QA | BLOCKED: Poppler page rendering/text tools are unavailable locally and no approved hosted workflow performs this gate |
| PR-head GitHub Actions contexts | BLOCKED by absent workflow definitions/required monorepo inputs; zero PR-head contexts is not treated as success |
| Hosted code, security, provenance, recovery-diff, and migration reviews | Exact-head outcomes are recorded in the PR body and hosted review comments |

No declarative exact Flutter or Dart pin exists in the parity lock or workflow YAML: the workflows use `subosito/flutter-action@v2` with floating `channel: stable`. The exact hosted attempts used action commit `1a449444c387b1966244ae4d4f8c696479add0b2` and resolved Flutter `3.47.2`, framework `d3b14c876900e553bc736ca19295fc09e3853e8e`, engine hash `1cf1c4773fb941c4c74a7f8bb144a8837596c0f4` (engine revision `a804b261645ef8c13eb3d5c44a5c2fb0340c5539`), Dart `3.13.2`, and DevTools `2.60.0`. This is the authoritative observed toolchain, not an immutable repository pin.

The fresh hosted mobile workflows use ordinary `flutter pub get`, which changed five dependency resolutions inside their ephemeral runners and did not assert a clean lockfile. The Linux Flutter job also skips canonical Windows goldens. Their source-SHA/native results are useful but are not represented as Flutter exact-lock or Windows-golden evidence. Earlier PR-merge reruns `33536571536`, `33536571515`, `33536571436`, and `33536571586` checked out a synthetic merge tree and are historical only; they are not substituted for the fresh raw-source runs.

Exact web gates run in a clean `core.autocrlf=false` checkout after `npm ci`. Ignored dependency/build outputs are outside the source-integrity claim; the verifier rejects every non-ignored untracked or modified path and compares the raw bytes of every tracked working file with its exact Git blob.

## Open blockers

- Immutable provider evidence is still required for the Site 69 deployment ID, terminal `succeeded` status, production target, timestamps, saved version ID, and source SHA.
- No approved exact-PR-head workflow can be scheduled from the current tree. A new/restored workflow and its missing monorepo inputs require separate scope approval; no no-op commit, policy weakening, or fabricated context is acceptable.
- Hosted PDF QA with Poppler text extraction and page rendering remains unavailable because no current workflow provides it.
- Flutter/Dart is not immutably pinned, the authoritative resolved SDK still fails the no-write format gate, and current hosted mobile workflows do not enforce `pubspec.lock` unchanged.
- Hosted review comments and the PR body must independently anchor the final exact head and closed-manifest digest; every P0/P1/P2 finding must be resolved with regression evidence and its thread closed.
- Merge requires separate literal user approval naming PR #45, the final exact head SHA, and the closed-manifest SHA-256. Approval does not authorize deployment or Phase B/C.

This recovery does not authorize merge, deployment, Site-version creation, confidential capability changes, production mutation, or Phase B/Phase C work.
