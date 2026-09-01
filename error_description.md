# GENESIS: JURIS — Pilot V2 Resume Blocker and Required Instruction Correction

## Purpose

This document is the handoff for revising the instruction set titled
`Complete Pilot V2 and Produce the Genuine Demo Video`.

Work stopped at a mandatory hard boundary because the Phase 7 APK export
requirement conflicts with the repository's protected, established C ABI.
No Rust, bridge, ABI, APK, native, FFmpeg, or video change was made.

## Exact blocker

The latest instruction requires every packaged ABI to export exactly:

```text
juris_mobile_bridge_create_session
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
```

The repository's established ABI version 1 exports exactly:

```text
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
```

`juris_mobile_bridge_create_session` does not exist as an exported symbol in
the repository.

Authoritative evidence:

- `crates/juris-mobile-ffi/src/lib.rs:51-52` exports
  `juris_mobile_bridge_execute`.
- `crates/juris-mobile-ffi/src/lib.rs:98-99` exports
  `juris_mobile_bridge_string_free`.
- `crates/juris-mobile-ffi/src/lib.rs:109-112` exports
  `juris_mobile_bridge_abi_version`, returning ABI version `1`.
- `crates/juris-mobile-ffi/src/lib.rs:902-908` has a fail-closed test asserting
  those exact three symbols.
- `apps/juris-mobile/lib/data/native_scenario_bridge_client.dart:24-32`
  resolves those same three names.
- `docs/releases/RELEASE_NOTES_v0.6.0-alpha.1.md:30-32` records the same
  established ABI.
- `docs/development/PROFESSIONAL_PRODUCT_UI_REDESIGN_PILOT_V2.md:87-97`
  requires the bridge surface, ABI version, and exact three established
  exports to remain identity-stable.

## Why execution cannot continue under the current wording

There are only three ways to satisfy the current Phase 7 text, and all are
forbidden:

1. Rename `juris_mobile_bridge_abi_version` to
   `juris_mobile_bridge_create_session`. This changes the established C ABI,
   breaks the current Dart client lookup, and violates the pilot contract.
2. Add `juris_mobile_bridge_create_session` while retaining the established
   symbols. This creates a forbidden fourth `juris_mobile_*` export.
3. Report the current APK as compliant with the requested list. This would
   fabricate acceptance evidence.

The work order itself says to stop if bridge protocol or ABI would have to
change. That stop condition is met.

## Required instruction correction

Replace the Phase 7 block:

```text
juris_mobile_bridge_create_session
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
```

with:

```text
juris_mobile_bridge_abi_version
juris_mobile_bridge_execute
juris_mobile_bridge_string_free
```

Add this clarification immediately after it:

> This is an audit of the existing ABI version 1 surface, not authorization to
> modify Rust, the bridge protocol, client lookup names, or exported symbols.
> Every established Android ABI must contain exactly these three exports and
> no fourth `juris_mobile_*` export.

All other bridge/ABI prohibitions should remain unchanged.

## Accepted progress before the stop

Direct-toolchain recovery remains accepted:

- bundled Dart 3.12.2: healthy;
- direct formatter and idempotence: pass;
- recovered Russian scenario test: 1/1;
- save/load test: 1/1;
- complete `rust_scenario_repository_test.dart`: 36/36;
- Phase 2 confirmation test: 1/1;
- complete `widget_test.dart`: 30/30;
- focused Operations/Inbox matrix before the latest audit corrections: 17/17.

Living Dossier Family 5 progress:

- explicit authoritative `snapshot.matterTitle` handoff added;
- indexed, rule-based Working/Analytical dossier implemented;
- procedure/status/lifecycle/closure/scenario-time fields presented;
- exact facts, evidence descriptions, fact cross-references, deadlines,
  remedies, judicial state, and outcome presentation added;
- no communications group or evidence-source field invented;
- compact/wide, RU 200%, high-contrast, selection semantics, honest empty
  states, 48-pixel remedy target, and exact route-return coverage added;
- focused Dossier suite: 6/6 passed;
- whole-app analysis reported `No issues found` before the final Family 4
  authority patch.

Family 4 corrections applied immediately before the ABI stop:

- Operations now consumes strict `viewModel.visibleRequest` instead of choosing
  the first Inbox attention row;
- the extra remaining-minutes KPI was removed;
- viewport-relative trailing padding was replaced with named spacing plus the
  system inset;
- the now-unused `remaining(...)` presentation string was removed.

Those last two Family 4 files have not yet been formatted, analyzed, or tested
because execution stopped as soon as the ABI contradiction was confirmed.
Current repository-wide `git diff --check` passes.

## Exact repository state at stop

- Branch: `feat/professional-product-ui-redesign-pilot-v2`
- HEAD: `8001acdb581a69681dc2d821880770601574ffea`
- Staged paths: none
- New local commits 4–7: none
- Modified tracked paths: 14
- Preserved untracked paths:
  - `apps/juris-mobile/lib/widgets/juris_action_dock.dart`
  - `apps/juris-mobile/test/failures/` with 36 diagnostic PNGs
  - `docs/development/CURRENT_PROGRESS.zip`

Protected ZIP identity remains:

- 47,579 bytes
- SHA-256
  `2E5F03F003A7D227CB4CE765E338A8F335D92879862E53BD1C27D65E116DE3B6`

No push, pull, PR, merge, tag, release, publication, SDK modification, APK
installation, emulator launch, FFmpeg installation, or video production
occurred.

## Resume instruction

After correcting the Phase 7 export list, resume from the current worktree.
Do not restart or discard accepted recovery or Dossier work. The next actions
are:

1. format and verify the two latest Family 4 source corrections;
2. strengthen and run the focused Family 4 tests, requiring 17/17;
3. rerun the focused Dossier suite, requiring 6/6;
4. implement historical immutable golden identity guards without changing any
   historical PNG byte;
5. create and inspect the new Pilot V2 golden profile;
6. continue full Flutter, commit-family, export, Rust, APK, native, genuine
   gameplay, FFmpeg, video, gallery, and checkpoint gates in the original
   required order.

Do not authorize an ABI workaround. The revised instruction should correct the
symbol name and preserve the existing ABI.
