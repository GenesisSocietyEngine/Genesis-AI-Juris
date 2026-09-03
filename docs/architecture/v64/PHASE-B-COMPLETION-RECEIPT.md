# v64 Phase B completion receipt

This receipt is append-only. It records the evidence boundary at the start of the
Site 69 baseline-recovery path required by the v64 Phase B release contract. It
does **not** assert that Phase B is complete, approved, mergeable, or deployable.

## 2026-09-03T10:20:11.332Z — baseline-recovery initiation

### Scope and starting Git state

- Recovery branch: `codex/v62-site69-baseline-recovery`.
- Recovery worktree: clean, based on
  `c088200138332cd212b87e266746ea85b53a2f77` with tree
  `2d4b43d4c5a24c5440275ee679963b74cc605810`, tracking `origin/main`.
- Read-only Phase B audit worktree: detached and clean at
  `2f6e545b70a39c3fda4aa3b71ca380799e7c52a8` with tree
  `b78787e1f5e94d85a14e6b01bfe5ff4c5a223071`.
- Pull request #43 remained open and draft at that same head and tree. Its base
  was `c088200138332cd212b87e266746ea85b53a2f77`.
- `origin` fetch/push URL:
  `https://github.com/GenesisSocietyEngine/Genesis-AI-Juris.git`.
- The primary user worktree was not used for recovery edits. Its pre-existing
  modifications to `Cargo.toml` and `docs/development/CURRENT_PROGRESS.md` were
  preserved. The untracked `.worktrees/` path contains the isolated audit and
  recovery worktrees created for this operation.

### Site 69 observation and recovered source identity

- Sites project: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`, active and
  public; custom domain `studio.falcon-merlin.com` was active with active SSL.
- Latest saved Site version: `69`.
- Saved source commit: `6019e47346a2bf719a09dc1d874a2fc807f99598`.
- Saved source tree: `e415361e9a39fc823d625f80c883398b18914e6e`.
- Saved source archive digest:
  `sha256:3dcfe92950c2e5e0f99d7f638f0f66633397c5c25e62ac9e065cc8e27255d555`
  (`320` files, `25,825,280` bytes).
- Live runtime marker observed at `2026-09-03T07:53:14.507Z` returned HTTP
  `200`, `deploymentVersion=69`,
  `webCommit=6019e47346a2bf719a09dc1d874a2fc807f99598`, and script version
  `0b8eda40-a900-4523-bfb3-992f9f74e7d1`.
- Recovered source checkout was detached and clean at the saved source commit.
  No credential, token, or signed asset URL was persisted.
- The available Sites interface did not expose historical deployment records.
  An immutable historical deployment ID/status receipt linking the public
  runtime to Site 69 therefore remains unavailable.

### Ancestry and migration hard stop

- The Site 69 source root commit
  `86111ee6244d2f78d9c552b56cfb3e3e583268f6` and GitHub root commit
  `4f42c11b422be41704f8b72e417e83feed1674f3` are unrelated. `git merge-base`
  between `origin/main` and the saved Site source returned no merge base.
- The release contract therefore requires a separate baseline-recovery pull
  request. Phase B work must not be rebased, merged, registered, or deployed in
  this recovery operation.
- The recovered immutable Drizzle history contains registered migrations
  `0011` through `0018`. In particular, its already-applied
  `0016_polite_sentinels.sql` differs from pull request #43's unregistered
  `0016_tenant_control_plane.sql`.
- Production `0016` SQL SHA-256:
  `c8d5993aea87a39072c627fdf594b488a18304c7b170f5a2e9c52c729fd42748`.
- Unregistered Phase B candidate normalized SQL SHA-256:
  `0b5e55ec85217916c4cfcb7318bf386d8b016ce955d4b8a6e49c6bce5b1c6e03`.
- The Phase B candidate cannot retain migration number `0016`. Any later
  approved tenant-control-plane migration must be forward-only and
  collision-free after the recovered immutable head (`0018`), with new schema,
  snapshot, journal, compatibility, rollback, review, and exact-head evidence.

### Mandatory-read and toolchain record

- The exact pull-request head was audited read-only. The complete progress
  ledger; all v64 architecture files; all three frozen schemas; full Drizzle
  schema, SQL, snapshots, and journal; tenant/authentication/OIDC foundations;
  Phase B web and Flutter tests; Flutter organisation context; all release
  workflows; and hosting configuration were read in full.
- Git: `2.55.0.windows.3`.
- GitHub CLI: `2.96.0`.
- Rust: `rustc 1.97.1`; Cargo: `1.97.1`.
- Java: OpenJDK `21.0.10` from the Android Studio runtime.
- `node` and `npm` were not present on `PATH` at initiation.
- Direct Flutter and Dart version probes did not complete and were terminated;
  no version is claimed by this entry.

### Safety state

- No production database, storage, domain, Site version, deployment, branch,
  pull-request thread, approval, or confidential-mode state was mutated before
  this entry.
- No Site version may be saved and no deployment may be started from this
  recovery branch. The recovered baseline may be reviewed and merged only
  through its dedicated pull request and does not authorize a release.
- Pull request #43 remains draft. Its production adapters, hosted-web gates,
  exact-head security/privacy review, immutable deployment receipt, contract
  conflicts, and B0–B9 acceptance remain unresolved.

## 2026-09-03T10:51:03.340Z - exact baseline import and verification

### Recovery commit provenance

- Recovery merge commit:
  `44c40883a3c4f1c13757ac2a03005780ca5a42f7`.
- First parent (the required pre-edit receipt):
  `0729cd13062afec13b2741a153e459324c17df91`.
- Second parent (the exact saved Site source):
  `6019e47346a2bf719a09dc1d874a2fc807f99598`.
- `HEAD:apps/juris-web` and the saved Site source root are the same Git tree:
  `e415361e9a39fc823d625f80c883398b18914e6e`.
- The tree contains `373` tracked paths and preserves all blob identities and
  modes, including four executable scripts. There is no recovery-merge change
  outside `apps/juris-web`; `git diff --check` passed.
- The source's own exact-checkout verifier passed before and after all web
  gates with raw tracked-byte SHA-256
  `3d5207a0d4e0b88e5fab1760095c5659f4334e31c30e1374f4e9a178da634f15`.

### Canonical immutable migration hashes

These SHA-256 values are over the exact LF bytes stored in the saved Site 69
Git tree, not a host-converted working copy:

- `drizzle/0011_operational_events.sql`:
  `0b556f390a83eec0dccd6dc76d12340a3083620b79e34ea1fa0cd4e83711e6c7`.
- `drizzle/0012_sleepy_magma_core.sql`:
  `f7287a42b2afb176de4f892fe476d6242dffb62e6d336484fbae55c077a0fe8c`.
- `drizzle/0013_sleepy_magma_guards_a.sql`:
  `18332d50e4b12c729187280a3dc397c35ef95e3daacc7a33419bfe327338022e`.
- `drizzle/0014_sleepy_magma_guards_b.sql`:
  `0eb85af54bea36fc6bd57319e4d0ae9761154fb497ab741dcb5830086da0c37b`.
- `drizzle/0015_sleepy_magma_guards_c.sql`:
  `82f696cc99ed5fd5b921d064cf7a4fc14b3ce77f06375c1c8b8aa631417429e5`.
- `drizzle/0016_polite_sentinels.sql`:
  `50a12891dbc6376d0dadf0b8008ad39815f7c5255204f745c3a2687f1e549c83`.
- `drizzle/0017_perfect_marvex.sql`:
  `0c98f442f7652b859d90b0ad7e070a762b18686357e013e807933d08ab2f4036`.
- `drizzle/0018_low_calypso.sql`:
  `5e4c6cfed12d3e4e59be200829473630d665e71ad2289fb8a46f572a30653f84`.
- `drizzle/meta/0011_snapshot.json`:
  `1b8c402a12eaf85bec3ed91b2c0e6f67606c630fcb5400c04e6aad64b25bc096`.
- `drizzle/meta/0012_snapshot.json`:
  `2b3b06d685ac2b685a5fcc778a89c0ac1b9fc7d6c08a49bd3fc955e1ac850077`.
- `drizzle/meta/0013_snapshot.json`:
  `1386270c72349407c35eb2f215ad0c05b47a1bf2b949ef4d2de4c1d9243a46ca`.
- `drizzle/meta/0014_snapshot.json`:
  `7d5eb459839a9cf29fa141bdc4b99b56f250a6c97d8178c05ca27d42a7cee8b4`.
- `drizzle/meta/0015_snapshot.json`:
  `00b16cd0c60210e458e4781e56446e3b4a2fa81c624cd1087ba91dc6683f0ab5`.
- `drizzle/meta/0016_snapshot.json`:
  `eab3ea213949697fff163ebcbb5816ecffe92365b3ff43b483a85ff33c1f74de`.
- `drizzle/meta/0017_snapshot.json`:
  `e7c49630218c2803f166c85decebb2d2e2a27693f88d2d66341ae7b9046d2dd9`.
- `drizzle/meta/0018_snapshot.json`:
  `2bc294e56636a5fff773c85aaa8c192870d8661f5dd032b14b68a34ea44aeafa`.
- `drizzle/meta/_journal.json`:
  `02bb7a530efdc3f3da03979d52d5afaa9628fcf22454eb9d6aefbe65515bc680`.
- `db/schema.ts`:
  `5861203afc9688b73e13fd77d60c132cefa47bcb74694b25bf0d5e471715d077`.
- `.openai/hosting.json`:
  `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`.

Correction to the initiation entry: its
`c8d5993aea87a39072c627fdf594b488a18304c7b170f5a2e9c52c729fd42748`
value was the SHA-256 of a Windows CRLF-converted working copy of production
`0016`; it is retained above as historical measurement context but is not the
canonical source hash. The canonical Git-tree hash is `50a12891...` as listed
in this entry.

### Verification results

- Portable Node `v22.14.0` / npm `10.9.2` was downloaded from the official Node
  archive and its published SHA-256
  `55b639295920b219bb2acbcfa00f90393a2789095b7323f79475c9f34795f217`
  was verified before execution.
- Exactly one deterministic `npm ci` completed from the lockfile (`530`
  packages). The repository's Linux-only install wrapper could not be used on
  Windows because it requires `flock`; the fallback and platform limitation are
  explicit evidence, not an equivalence claim.
- Strict TypeScript: passed.
- ESLint over exact source bytes: passed.
- Verified production build: passed. Its locked mobile contract covered `18`
  deterministic routes with bundle digest
  `18144245b2eb11345a96d86a18ead0804ceef7d26aa3492ad67c6924ebbbe012`.
- Full web test suite: `496` passed, `0` failed, `0` skipped.
- PDF verification: `47` PDFs, `702` pages, and `702` rendered PNGs passed.
  Visual-baseline parity covered `55` PNGs with digest
  `fbcc9a03d8a26b7076aa2504ac1adf28c28a4196806c9e2849bb6a6aba12f8bb`.
- Production dependency audit: `0` vulnerabilities.
- Final verified production build: passed.

An initial test attempt on a globally configured `core.autocrlf=true` checkout
reported three failures because the host had converted required LF-only source
and migration bytes to CRLF. No source was changed. The clean detached checkout
was reconstructed from the exact Git tree with conversion disabled, its raw
tracked-byte verifier passed, and the complete suite then passed as recorded
above.

### Remaining release boundary

- The all-in-one v62 release script was not claimed: it additionally requires
  the exact mobile checkout, completing Flutter/Dart commands, an Android
  emulator smoke test, and locked hosted workflow evidence. Those are not
  prerequisites for this source-only baseline-recovery pull request.
- The repository has no hosted web workflow. Hosted Rust, Flutter, Android, and
  iOS checks must be observed on the exact pushed recovery head.
- This evidence does not cure the missing historical deployment receipt and
  does not authorize Phase B registration, merge of pull request #43, a Site
  save/deploy, production data mutation, or confidential activation.
