# Site 69 baseline-recovery receipt

This receipt records a history-only baseline recovery. It does not begin Phase B or Phase C, change application or dependency files, migrate a tenant, deploy a Site version, enable confidential uploads, or mutate production resources or secrets.

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

## Exact-head verification

Run the fail-closed verifier from the repository root and supply the original bundle:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-site69-baseline-recovery.ps1 -BundlePath C:\path\to\site69-source-history.bundle
```

The verifier resolves and emits the literal current `HEAD`, checks that its sole parent is the immutable provenance merge, and ensures that this follow-up changes only this receipt and the verifier. This runtime binding avoids the impossible self-reference of embedding a commit's own SHA in its contents. The draft PR body is the authoritative record of the literal recovery-head SHA and the exact-head test and audit results.

Required exact-head evidence includes the provenance verifier, migration freeze, complete web tests, strict typecheck, lint, production build, production and full dependency audits, available Rust/Flutter/native gates, and hosted code/security/migration reviews. Results are not inherited from an earlier head.

### Local gate record

The following results were produced on 2026-09-03. Web gates are bound to this evidence commit by the verifier's runtime `exactRecoveryHead`; the PR body records its literal SHA. Mobile/Rust gates are bound to the parity lock's exact mobile commit `5200b30cc50c77393c6f48b52ce91c0f30e70c64`.

| Gate | Result |
| --- | --- |
| Provenance, bundle, 373-path, strict object, and 17-artifact migration verifier | PASS |
| Strict TypeScript | PASS |
| ESLint | PASS |
| Vinext production build | PASS; existing large-chunk warning reported |
| Complete web test suite | PASS, 496/496, using an LF-exact checkout |
| Production dependency audit | PASS, 0 vulnerabilities |
| Full dependency-tree audit | BLOCKED, 6 development/tooling advisories: 2 high and 4 moderate (`browserslist`, `fast-uri`, and transitive `esbuild`) |
| Rust format, Clippy with warnings denied, workspace tests and doc-tests | PASS at locked mobile commit |
| Flutter analysis | PASS at locked mobile commit |
| Flutter tests | PASS, 275 tests at locked mobile commit |
| Cross-repository mobile parity | PASS, 18 routes and every checkpoint |
| Flutter report-layout parity | PASS, 7 fixtures |
| Dart format check | BLOCKED: installed Flutter 3.44.8 / Dart 3.12.2 would reformat 100 of 117 checked files |
| Report-PDF QA | UNAVAILABLE locally: required Poppler executables are absent |
| Android native/FFI smoke | UNAVAILABLE locally: ADB reports no attached device |
| iOS native/FFI smoke | UNAVAILABLE on Windows |
| Hosted code, security, and migration reviews | PENDING on the exact recovery PR head |

The Windows Node runtime required an ignored test-only `os.userInfo()` fallback because the sandbox returned `ERR_SYSTEM_ERROR/ENOMEM`; no tracked file or dependency was changed. The parity lock separately records successful hosted Rust, Flutter, Android, and iOS runs `33536571536`, `33536571515`, `33536571436`, and `33536571586` at the exact locked mobile commit.

## Open blockers

- Immutable provider evidence is still required for the Site 69 deployment ID, terminal `succeeded` status, production target, timestamps, saved version ID, and source SHA.
- Historical dependency evidence reported six development/tooling advisories (two high and four moderate); current exact-head audits must be reported without hiding or force-fixing findings.
- Hosted code, security, and migration reviews must be green on the exact recovery head.
- Every P0/P1/P2 finding requires reviewed remediation and regression evidence.
- Merge requires separate literal user approval naming the recovery PR number and exact head SHA.

This recovery does not authorize merge, deployment, Site-version creation, confidential capability changes, production mutation, or Phase B/Phase C work.
