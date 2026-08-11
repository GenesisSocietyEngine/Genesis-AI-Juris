# Gameplay Atmosphere, Audio Environment & Catalogue Navigation v1

## Status and exact local boundary

This document is the implementation contract for a presentation-only local
iteration based exactly on reviewed GreenFire checkpoint
`6bd3d656d6f35450cfedd4b4cd8ca9ccf46239bd` (`ATMOSPHERE_BASE`). Work occurs
only on local branch `feat/gameplay-atmosphere-audio-navigation-v1`.

The source recovery branch
`feat/greenfire-living-case-visual-slice-v1` remains fixed at that reviewed
commit. Published base and merge base remain
`39b856320ed5dc397562068706c4cea7d703899c`. This contract authorizes no push,
pull request, merge, tag, release, version bump, APK publication, branch
deletion, workflow edit, or repository-setting change.

## Authority boundary and exclusions

Rust remains the sole authority for case/scenario identity, game time,
deadlines, available actions, action application, Pressure, countermoves,
lifecycle, outcomes, facts, evidence, messages, remedies, saves, migration,
replay, fingerprints, canonical digests, bridge protocol, and C ABI.

Flutter may only arrange existing player-visible projections, derive a
presentation count from the exact collection it displays, select decorative
treatments, play local audio after the equivalent visual state is projected,
and persist non-authoritative sound preferences outside the game save.

This iteration must not change `crates/**`, `content/**`, canonical traces,
authoritative mobile-bundle bytes or generation, localization overlays with
authored case/legal copy, save or migration code, bridge commands, FFI/C ABI,
native production logic, workflows, or release/version files. It must not
invent a map, incident location, authority emblem, evidence, fact,
correspondence, person, advice, deadline, consequence, branch, or outcome.
Abstract industrial geometry and audio texture are decorative only.

## Evidence-led UI diagnosis

The reviewed native evidence is:

- `greenfire-living-case-android-selected.png`: compact index with fixed-width
  neighbour cards clipped by the viewport;
- `greenfire-living-case-android-start.png`: selected GreenFire hero and sole
  `Start case` launch control;
- `greenfire-living-case-android-launched.png`: four rendered Inbox tiles with
  `ACTION REQUIRED`, an attention summary of four, and a separate `Actions · 1`
  gameplay control;
- `greenfire-living-case-android-workspace.png`: specialized Crisis Desk with
  an honest inactive Pressure projection but a near-viewport-height empty
  pressure surface;
- `greenfire-living-case-android-dossier.png`: specialized player-visible
  opening Dossier material.

These observations identify presentation problems only. Counts and state must
continue to come from current projections, never from screenshot constants.

## Catalogue reconnaissance

`CaseCatalogLayout` owns the exact responsive breakpoint: compact below 700
logical pixels and wide at or above 700. `CaseCatalogScreen` owns one stable
`_selectedCaseId`; it derives the selected definition from the current
filtered authoritative list. Filtering preserves the selected ID when visible
and otherwise chooses the first visible definition. Locale changes and resize
rebuild presentation without replacing that ID. `CinematicCasePanel.onStart`
is the only launch boundary and forwards the exact selected definition,
locale, and complete bundle through `CaseStartCallback`.

The current compact `CaseIndex` is a stateless horizontal
`SingleChildScrollView` containing 248-logical-pixel items. At phone width the
next and previous cards are therefore clipped. A player reaches the first or
fifth item by horizontal drag or by tapping/focusing a visible fragment. Items
support tap, semantic tap, Enter/Space activation, and directional focus, but
there are no explicit previous/next controls, position progress, snap, direct
all-case chooser, or first/last boundary announcement. Horizontal and outer
vertical scroll axes differ, but the nested gesture region remains ambiguous
to discover.

The current wide index expands all items inside the outer page scroll. It has
selection text/geometry as well as colour and supports directional focus, but
it is not a separately bounded scroll region, has no visible scrollbar, and
does not explicitly handle Home/End.

## Catalogue navigation state machines

### Compact (< 700)

The authoritative UI state remains only `selectedCaseId`. A `PageController`
and page index are derived view state reconciled by stable ID.

1. Build one full-width bounded page for each filtered case.
2. Previous/next selects exactly one adjacent stable ID; first/last disables
   the corresponding 48-pixel control.
3. A horizontal page gesture snaps once and commits the visible page's stable
   ID without launching.
4. A programmatic ID change jumps or performs the centralized finite
   selection transition; `onPageChanged` ignores the matching reconciliation
   and cannot loop.
5. `Browse all cases` opens an accessible modal list of the same filtered,
   ordered definitions. Direct selection closes the sheet, selects the exact
   ID, synchronizes the page, and requests focus on the selected hero heading.
6. Ordinary swipe/button selection does not steal focus. Reduced-motion or
   accessible-navigation media jumps without animation.
7. Filter reconciliation preserves a still-visible ID or selects the first
   visible case. Locale and 699/700 resize preserve the ID. Empty filters keep
   the established empty state.
8. Tile tap, swipe, buttons, modal selection, focus, details, and animation
   never invoke `CaseStartCallback`; only `Start case` invokes it once.

The selector exposes localized `Case X of Y`, title, jurisdiction,
playability, and selected state; explicit previous/next semantics; a visible
position and decorative progress; 48-pixel targets; and a fixed bounded
height that remains reachable at 200% text within the outer page scroll.

### Wide (>= 700)

The same selected stable ID drives a bounded vertical list. A visible
scrollbar and controller keep all filtered cases reachable. Arrow Up/Down
moves by stable neighbouring ID, Home/End reaches boundaries, and Enter/Space
selects without launching. Selection uses icon/text/border geometry as well as
colour. Direct-list selection and hero stay synchronized across locale,
filter, and 699/700 resize.

## Inbox attention and gameplay-decision diagnosis

There are three visible numbers with two distinct meanings:

| Surface | Current source | Meaning | Destination / zero state |
|---|---|---|---|
| Inbox summary | `GameSnapshot.unhandledRequiredMessages` | count of `snapshot.inbox` items whose status is `InboxStatus.actionRequired` | informational summary in Inbox; currently renders zero explicitly |
| compact Inbox badge and wide matter monogram | the same getter | attention-required Inbox items | selecting Inbox opens the rendered Inbox; badge label hidden at zero |
| floating `Actions · N` | `snapshot.actions.length` | currently available authoritative gameplay decisions | opens `ActionPickerSheet`; hidden when zero |

`InboxScreen` currently creates its displayed list by pairing every projected
Inbox item with insertion order, sorting newest-first by parsed received time,
then later insertion, and rendering every result. It applies no filter or
deduplication. `_InboxMessageCard` shows exactly one red localized
`StatusBadge.inbox` note precisely when the same item status is
`InboxStatus.actionRequired`. Thus the reviewed opening state is truthfully
4 attention items, 4 red tiles, and 1 separate available gameplay action. The
problem is ambiguous naming, not an authority mismatch.

One immutable presentation adapter will now own the final ordered displayed
entries. Each entry exposes the original `InboxItemView` and an explicit
`requiresAttention` boolean derived only from its projected status. It exposes
`attentionRequiredCount` by counting that final displayed list. Inbox summary,
compact badge, wide monogram, and tile status consume the same adapter. No
widget-tree query, localized-string parsing, action counting, unread alias,
pre-filter count, or authority recomputation is permitted.

The gameplay control retains `snapshot.actions.length`, opens the same
`ActionPickerSheet`, and is relabelled through presentation localization as
compact `Decisions · N` / `Решения · N` with semantic label `Available
decisions: N` / `Доступно решений: N`. Stable action confirmation and dispatch
remain unchanged.

At zero, the Inbox uses a calm localized no-attention summary without a red
count, badges are hidden, and the available-decisions control remains hidden
when the authoritative action list is empty.

## GreenFire composition and source matrix

| Proposed component | Exact player-visible source or classification |
|---|---|
| case spine/title/topic/jurisdiction/role | `MobileCaseDefinition` plus `LocalizedCaseText` |
| authoritative time | `GameSnapshot.dayLabel` and `timeLabel` |
| matter status | `stage`, `matterLifecycle`, `isClosed` |
| Pressure status/source/time | strict `LivingCaseViewModel.activePressure` and `deadline` |
| projected responses | `LivingCaseViewModel.responseActions`, already filtered against `snapshot.actions` and manifest IDs |
| attention status/brief | exact displayed Inbox presentation adapter |
| visible material count | `dossier.facts.length + dossier.evidence.length + dossier.deadlines.length`, only when Dossier projection exists |
| request material | strict actor-correlated `LivingCaseViewModel.visibleRequest` |
| Dossier material and selection | existing `DossierProjectionView` and screen-local selection |
| available decisions | `GameSnapshot.actions` |
| terminal treatment | strict existing projected Training Debrief outcome mapping |
| industrial silhouettes, grid/site-plan geometry, haze, ember glow, paper edges, registration marks, bounded seeded texture | decorative only, resolved treatment/palette/seed inputs |

The inactive pressure surface becomes a compact, explicit status component
inside a content-driven operational board. Active/missed Pressure remains
prominent but sizes to useful content. A compact operational rail shows only
the fields above. `What needs attention` opens the existing Inbox destination
without marking messages read or creating an action. Material previews route
to the existing Dossier. The first compact viewport must show case identity,
time/institutional state, Pressure state, attention state, and truthful next
navigation choices.

New painters consume only resolved immutable colours, bounded seed, and finite
decorative state. They compare every input in `shouldRepaint`, sit behind a
`RepaintBoundary` where composition is expensive, exclude decoration from
semantics, use no repository/raw JSON/ID/locale/clock, and never run a ticker,
wall-clock read, random-on-frame operation, unbounded blur, or shader trial.
Motion uses existing centralized 120/220/340 ms tokens and collapses to zero
for either `disableAnimations` or `accessibleNavigation`.

## Audio dependency and platform decision

No audio package, audio abstraction, or presentation-preference store exists
at the base. `HomeShell` is the existing gameplay lifecycle observer; it stops
and restarts only the authoritative live-clock timer. The app targets Flutter
3.44.8 / Dart 3.12.2 with package SDK constraint `>=3.6.0 <4.0.0`, Android's
Flutter-managed minimum SDK, and iOS 13.0. The repository contains Android and
iOS runners but no Windows or web runner directory. Widget and golden tests
run on Windows and must not instantiate platform audio.

The locked implementation will use:

- `just_audio` 0.10.6 (MIT/Apache-2.0 transitive licence set) for local asset
  loading, looping, volume, pause, and finite cues;
- `audio_session` 0.2.4 (MIT) for foreground game/media focus,
  interruptions, duck/pause, and noisy-device events, with microphone support
  disabled by default;
- `shared_preferences` 2.5.5 (BSD-3-Clause), using its current async API, for
  non-critical presentation preferences only.

These current stable releases require Dart 3.6 and Flutter 3.27 or newer and
therefore fit the pinned toolchain. `shared_preferences` documents Android
SDK 24+ and iOS 13+; the accepted runner's iOS target is exactly 13.0 and the
Flutter-managed Android target is compatible. No Windows audio implementation
is added; host tests inject a silent fake. No `audio_service`, background
playback, notification, recording, microphone, streaming, analytics, ads,
remote assets, Internet permission, or custom native code is allowed.

Official package records used for the version/licence decision:

- <https://pub.dev/packages/just_audio>;
- <https://pub.dev/packages/audio_session>;
- <https://pub.dev/packages/shared_preferences>.

## Deterministic original audio assets

A checked-in Dart generator will produce mono signed 16-bit PCM WAV files at a
fixed sample rate using integer/fixed-point operations, fixed seeds, fixed
headers, and no timestamps or host metadata. It will create two 24–36 second
crossfade-seamed ambient layers plus short case-selection, Dossier-open,
attention-reveal, decision-confirm, protected-outcome, and
compromised-outcome cues. Peak is at or below -3 dBFS, ambience is materially
quieter than cues, and total committed payload targets <= 6 MiB and may not
exceed 8 MiB without a stop.

A strict presentation-only manifest records path, purpose, duration, sample
rate, channels, bit depth, bytes, peak, and SHA-256. A provenance document
states that every sample is project-generated and includes no third-party
recording. Generator `--check` recreates all assets and the manifest in a
task-owned disposable directory, rejects missing/extra/changed outputs, and
byte-compares them to the checked-in set.

## Audio model, playback, and lifecycle

An injectable `AudioEnvironmentController` depends only on an abstract audio
port and abstract presentation-preference store. Production adapters use the
three locked packages; tests and goldens inject a silent fake port and
in-memory preferences.

Presentation states are limited to catalogue/no case, GreenFire inactive,
GreenFire active Pressure, GreenFire missed/countermove, exact terminal
protected, exact terminal compromised, and other/unknown silent fallback.
Catalogue has no ambient loop; a case-selection cue may follow user input.
Start/Continue is the first point for GreenFire ambience. Inactive plays quiet
room tone; active Pressure adds the restrained Pressure layer; missed uses no
inferred escalation; outcome stings follow only the exact already-projected
terminal outcome. Initial hydration selects ambience but suppresses transition
stings. Duplicate snapshots do not duplicate cues. Each transition sting is
at most once per in-memory transition, and generation tokens cancel stale
finite fades/cues after rapid changes.

Ambience and cue players use bounded async volume steps rather than a frame
timer. Playback/plugin/asset errors are caught and degrade to silence without
blocking runtime creation, navigation, action confirmation/dispatch,
save/load/reset, Dossier, or debrief. Audio never calls Rust, the bridge, save
store, action dispatch, or the simulation clock, and is never fingerprinted,
persisted in game saves, or replayed.

`JurisApp` owns and disposes one presentation audio environment across
catalogue/game transitions and observes lifecycle only for audio. `HomeShell`
retains its separate existing lifecycle ownership of the authoritative live
clock and forwards projected state and user cue events. This explicit split
prevents observer competition: app-root audio never advances game time, and
shell clock handling never controls audio internals. Inactive, paused, hidden,
detached, audio-focus interruption, and noisy-device events pause ambience and
cancel finite cues. Resume occurs only if the app is foreground, settings
still allow it, and playback was active before interruption; explicit mute
prevents automatic restart. Disposal cancels subscriptions and releases every
player.

## Sound controls and preferences

The gameplay shell exposes one visible localized sound button. Its accessible
settings sheet provides master sound, ambience enabled, ambience volume,
interface cues enabled, and a short non-speech preview. Defaults are master
enabled, ambience enabled at 30%, and cues enabled at 50%. Playback still
begins only after user interaction. Muting is immediate, visible, announced,
and persists separately from the authoritative save. Missing or malformed
preferences fall back to defaults. Reduced motion does not alter audio.
Nothing essential is sound-only and no haptic is added.

## Accessibility contract

All new controls use explicit EN/RU chrome, 48-logical-pixel targets, stable
focus order, selected/disabled text or icon in addition to colour, and
localized semantic labels and values. Screen readers receive meaningful
navigation/count/sound state without decorative geometry or repeated audio
announcements. At 200% text, selectors, sheets, details, decisions, and Start
remain scrollable and reachable. High contrast never relies on gold/blue hue.
Reduced motion affects finite visual transitions only.

## Golden retention and migration

The six Foundation, six Catalogue v1, and fourteen Living Case v1 PNGs remain
immutable historical evidence and may not be overwritten or deleted.
Foundation remains active compare-only. New versioned paths will contain six
`NAV-01`–`NAV-06` navigation baselines and twelve `ATM-01`–`ATM-12`
atmosphere/settings baselines required by the execution instruction. Current
changed-view tests point only to the new v1 atmosphere/navigation paths.

Every new baseline is generated explicitly, inspected, then generated again
in a separate clean Flutter process. Both path/size/SHA-256 sets must match.
No broad blind golden update, permissive comparator, or deletion of historical
failure evidence is permitted. Goldens prove pixels only; controller tests and
native listening prove audio behavior.

## Test matrix

Focused tests must cover:

- immutable Inbox presentation ordering/attention state; 0, 1, 4, mixed,
  reordered/filtered, and resolved-transition states; EN/RU pluralization;
  summary/badge/red-tile equality; truthful attention 4 versus decisions 1;
  unchanged confirmation and stable-ID dispatch;
- compact first/middle/last buttons, swipe/snap, Browse all, disabled bounds,
  every filter/empty state, stable ID across locale and 699/700 resize,
  keyboard/controller/semantics/focus, 200% text, high contrast, reduced
  motion, target size, 360x800 and 412x915 overflow, and launch count 0 until
  exact Start count 1;
- inactive/active/missed/no-attention compact and wide Crisis Desk,
  Dossier stack/selection, EN/RU, 200% text, high contrast, reduced motion,
  F0 neutral fallback, and unchanged protected/compromised debrief routes;
- strict audio manifest and byte-identical generator; preferences/defaults/
  corrupt fallback; channel mute and volume; user-only catalogue cue;
  inactive/active/missed and exact outcome transitions; initial-load and
  duplicate suppression; rapid cancellation; lifecycle/focus/noisy/disposal;
  missing/corrupt asset and plugin failure; and zero calls into runtime,
  bridge, saves, or action dispatch.

Final acceptance additionally requires Dart format, Flutter analysis and full
suite, deterministic audio `--check`, historical hashes, two-process new
goldens, unchanged bundle `--check`, full locked Rust tests/invariants,
`git diff --check`, three-ABI debug APK, existing Android integration, exact
C ABI v1 three-export audit/no fourth export, unchanged app version and
forbidden-path audit, protected ZIP verification, Android screenshots, and
manual routed listening/mute/lifecycle evidence.

## Platform limitations and failure policy

Windows is a deterministic host/golden environment only and uses injected
silent audio; no desktop product runner is claimed. Web is not a repository
target. iOS 13 source/plugin integration and generated registration must remain
valid, but hosted iOS runtime listening is deferred to a separately authorized
publication workflow. Android emulator evidence is local owner review, not
physical-device, store, production, or accessibility certification.

Any authority change, historical golden mutation, bundle/fingerprint/save/ABI
drift, unsupported plugin/platform requirement, nondeterministic generator,
third-party/unclear audio, navigation-triggered launch, accessibility
regression, failed gate, unavailable/materially defective Android listening,
or need for publication is an immediate stop with preserved evidence.

## Final local-only stop

The completed work must form a linear local commit family above
`ATMOSPHERE_BASE`, leave the reviewed GreenFire recovery branch fixed, leave
the protected ZIP untouched and sole-untracked, create an ignored offline
owner-review gallery under
`apps/juris-mobile/build/atmosphere-audio-owner-review/`, and leave the Android
app foreground on the enriched GreenFire workspace. Publication requires a
new owner decision after this local checkpoint.
