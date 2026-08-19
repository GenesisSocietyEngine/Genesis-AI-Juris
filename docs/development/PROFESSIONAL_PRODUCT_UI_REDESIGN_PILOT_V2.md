# Professional Product UI Redesign Pilot v2

## Status and local boundary

This document is the architecture contract for the local Professional Product
UI Redesign Pilot v2. The pilot is based on navigation acceptance commit
`cfc9e692cc412fe11e2dd02cd693d75520b0a37f` (`PILOT_BASE`) and is developed
only on `feat/professional-product-ui-redesign-pilot-v2`.

The retained parent branch
`feat/gameplay-atmosphere-audio-navigation-v1` remains fixed at `PILOT_BASE`.
This pilot authorizes no push, pull request, merge, tag, release, version bump,
publication, GitHub authentication, audio implementation, or full-surface
rollout. The application version remains `0.6.0+13`.

The protected file `docs/development/CURRENT_PROGRESS.zip` remains untracked
and untouched at 47,579 bytes with SHA-256
`2e5f03f003a7d227cb4ce765e338a8f335d92879862e53bd1c27d65e116de3b6`.

## 1. Visual thesis and commercial product goal

The pilot translates the approved visual direction into an original GENESIS
product language:

- prestige legal thriller;
- living case file;
- credible institutional simulation;
- professional legal-intelligence workstation.

The result should feel expensive without luxury ornament, cinematic without
theatre, institutional without generic dashboard chrome, and game-like
without fabricated scores or arbitrary badges. Editorial hierarchy should
make the player's current case, institutional state, genuine attention, and
next available action clear in the first viewport.

The product uses typography, rules, paper or desk layers, disciplined density,
and precise state labels before adding elevation or containers. Long-form
legal material remains readable. Operational material becomes denser only
where the projected content requires it.

The pilot must remain recognizably GENESIS in both light and dark treatments:
Literata editorial headings, IBM Plex Sans reading and controls, IBM Plex Mono
metadata, warm OFFICE paper, deep AFTER HOURS navy, restrained brass, and the
existing GENESIS cyan as a focus or circuitry accent.

## 2. Approved reference translation and non-copy boundary

Lovable is an approved composition reference only. The pilot may translate
its editorial hierarchy, warm-versus-night continuity, compact real-state
ledger, message hierarchy, and adaptive navigation principle.

The implementation must not import, embed, port, or copy Lovable HTML, CSS,
React, routes, component names, exact pixels, exact colours, generated assets,
placeholder metrics, or web-only navigation. It must not create Character
Sheet or another route absent from the canonical Flutter product. No
third-party portrait, evidence photograph, official seal, licensed artwork,
runtime font, or network image is added.

The implementation is built from existing Flutter primitives and the bundled
licensed fonts. Every visible word or value comes from existing product chrome
or an already player-visible projection.

## 3. Authority and deterministic boundaries

Rust remains the sole authority for:

- case identity, scenario content, localization, sort order, and playability;
- clocks, deadlines, lifecycle, Pressure, countermoves, and outcomes;
- facts, evidence, messages, remedies, traces, and action availability;
- action legality and dispatch;
- saves, migration, replay, fingerprints, digests, and canonical paths;
- bridge commands, C ABI version, native integration, and exported symbols.

Flutter is presentation and interaction only. It may arrange immutable
player-visible projections, retain route/selection/focus state, select a
semantic theme from an explicit projected clock, and calculate presentation
counts from the exact collection it renders. It may not synthesize, infer, or
persist a gameplay fact.

The pilot specifically does not invent Billable, Fatigue, Client Trust,
Budget Used, suspicion, severity, evidence quality, recommendations, facts,
messages, deadlines, actions, or outcomes. Existing general snapshot fields
outside the mappings in Section 9 are not promoted into new pilot metrics.
Unknown, missing, or future projection data uses an honest neutral or absent
presentation.

The following invariants are byte- or identity-stable across `PILOT_BASE` and
the final pilot:

- generated authoritative mobile bundle;
- every scenario fingerprint;
- canonical minutes, outcomes, traces, and digests;
- save/load/migration/replay behaviour;
- action availability and dispatch;
- bridge surface and C ABI version;
- exact three exported symbols in each established Android ABI;
- five-case order, stable IDs, filters, and playability.

## 4. Semantic theme ownership: OFFICE and AFTER HOURS

One semantic visual model owns both treatments. Widgets consume roles, never
branch on raw colours or locale.

### 4.1 OFFICE

OFFICE expresses daylight institutional work:

- warm mineral canvas;
- elevated paper and file layers;
- dark ink and restrained muted ink;
- quiet rule lines;
- restrained brass and GENESIS cyan punctuation;
- low noise suitable for catalogue and dossier reading.

### 4.2 AFTER HOURS

AFTER HOURS expresses the same information architecture on a night desk:

- deep navy canvas and desk surfaces;
- warm light ink;
- stronger but controlled edge separation;
- restrained brass and cyan punctuation;
- no uncontrolled glow or gradient beneath reading text.

### 4.3 Selection and injection

Catalogue and surfaces without a reliable projected time retain the existing
deterministic dark application treatment, represented as AFTER HOURS. OFFICE
golden/review states are injected explicitly. Gameplay resolves an automatic
mode only from the global player-visible `GameSnapshot.timeLabel`, through one
strict presentation-boundary parser matching exactly `HH:mm`, hours 00-23,
and minutes 00-59. OFFICE is 08:00 inclusive through 18:00 exclusive; all
other valid times are AFTER HOURS. `DossierProcedureView.clockMinutes` is
elapsed scenario time and is explicitly not a visual-mode source. Missing,
malformed, or non-clock labels fall back to the existing AFTER HOURS
treatment. Locale, wall clock, animation time, case ID, action state, and
painter state cannot select a theme.

Tests and golden harnesses inject the semantic theme mode directly. Theme
changes do not recreate a repository, modify a projection, dispatch an action,
advance time, or affect saves and replay. The pilot adds no persisted theme
preference.

High contrast is a semantic override of the active mode, not a third unrelated
theme. It increases boundary/focus distinction while preserving text and icon
state communication.

## 5. Three density layers

All layers share the same tokens and theme ownership.

### 5.1 Executive

Used by Case Library, selected case overview, GreenFire identity, and outcome
overview. It provides one editorial title, sparse high-value metadata, one
dominant state, and one primary action.

### 5.2 Working

Used by Inbox, Dossier, communications, facts, evidence, deadlines, and
documents. It provides predictable reading rhythm, source/time/status
hierarchy, paper rules, wrapping content, and restrained surfaces.

### 5.3 Analytical

Used by projected Pressure, deadlines, response matrices, and trace metadata.
It provides aligned values, monospaced labels, explicit state text, and real
thresholds only when projected. It never draws a fake chart or recommendation.

Density is a typed semantic choice (`compact` or `comfortable`) resolved by
surface and available width. It does not reduce interactive targets or text
scale.

## 6. Responsive shell and Option B navigation

The shell owns one immutable destination model containing stable ID, localized
label, inactive/selected icon, semantic purpose, and canonical callback. The
model preserves the existing destination order and routes. Compact and wide
widgets render that same list; separate route lists are forbidden.

### 6.1 Compact, below 700 logical pixels

- retain the canonical bottom navigation;
- keep destination labels short and complete;
- show case/screen identity in the content header, not inside the bottom bar;
- keep back behaviour on the existing route stack;
- move pause, speed, save/load, and related secondary controls into one
  explicit session-controls surface;
- keep one visually dominant gameplay action;
- keep every target at least 48 logical pixels.

### 6.2 Wide, at or above 700 logical pixels

- replace the bottom bar with a persistent bounded rail/sidebar;
- render the same destinations, order, selected state, semantics, and
  callbacks;
- keep case identity and projected session state in a stable header region;
- use remaining width editorially without stretching phone cards;
- preserve the selected stable destination across resize.

Focus order follows visual order. Keyboard and d-pad input is scoped to the
navigation surface. Keys outside it do not change routes. EN/RU and 200%
labels remain reachable at 699 and 700 logical pixels. System back remains
unchanged.

## 7. Shared token contract

### 7.1 Typography

Semantic roles replace per-widget font declarations:

| Role | Family | Purpose |
| --- | --- | --- |
| `caseDisplay` | Literata | dominant case title |
| `screenDisplay` | Literata | screen or file identity |
| `sectionTitle` | Literata | major section heading |
| `documentTitle` | Literata | document/evidence title |
| `bodyReading` | IBM Plex Sans | long legal reading |
| `bodyCompact` | IBM Plex Sans | dense supporting content |
| `controlLabel` | IBM Plex Sans | buttons and destinations |
| `metadata` | IBM Plex Mono | IDs, source/type, short values |
| `timestamp` | IBM Plex Mono | projected date/time |
| `statusStamp` | IBM Plex Mono | explicit state stamp |
| `caption` | IBM Plex Sans | restrained explanatory copy |

Roles inherit the active semantic ink colour and retain Flutter's user text
scaler. Required title, status, source, and navigation text is never hidden,
shrunk with `FittedBox`, or capped to evade overflow.

### 7.2 Colour roles

Typed token values begin with this contrast-tested direction and may be
adjusted only as semantic tokens:

| Role | OFFICE | AFTER HOURS |
| --- | --- | --- |
| canvas | `#F2EFE7` | `#091321` |
| base surface | `#FBF9F4` | `#102033` |
| elevated surface | warm raised paper | `#162A40` |
| ink | `#17202B` | `#EEE7D8` |
| muted ink | `#5F6871` | `#AAB4C0` |
| rule | `#C9C3B5` | `#35485C` |
| brass | `#8C6722` | `#C6A455` |
| cyan | existing GENESIS cyan role | existing GENESIS cyan role |
| danger | reserved for projected danger/attention | same meaning |
| success | reserved for projected success/completion | same meaning |
| focus | high-contrast focus role | high-contrast focus role |

State is never colour-only. Selection uses label/icon/border geometry;
attention uses an explicit localized stamp; focus uses a visible outline.
Brass cannot make every surface appear selected.

`JurisSurfaces` is the sole owner of these literals. OFFICE starts with
elevated paper `#FFFFFF`, restrained cyan `#006C7A`, danger `#A33A32`, success
`#2F6B4F`, and focus `#005F73`. AFTER HOURS starts with the existing cyan
`#70D3E2`, danger `#FFB4AB`, success `#8BD3A8`, and focus `#D8E8FA`.
High-contrast OFFICE substitutes darker brass/cyan/focus boundaries
(`#6B4900`, `#005A68`, `#003B49`); high-contrast AFTER HOURS uses the existing
`#F3D994` gold and `#A6F4FF` cyan with the light focus role. Contrast tests may
adjust values only inside `JurisSurfaces`; widgets never contain these colour
literals.

### 7.3 Geometry, density, and motion

- spacing retains named `hairline/xs/sm/md/lg/xl/xxl/display` values
  2/4/8/12/16/24/32/48, with compact/wide screen gutters 16/32;
- density `compact` uses 12-logical-pixel content insets and 8-pixel section
  rhythm; density `comfortable` uses 16-pixel content insets and 12-pixel
  section rhythm, all resolved through spacing roles;
- border roles remain hairline/standard/emphasis/focus at 0.5/1/2/2;
- radius roles remain small/medium/large/panel at 8/12/16/20; pill 999 is
  reserved for compact controls and truthful stamps, never general cards;
- elevation roles remain flat/raised/overlay at 0/1/6; document layers are
  flat and there is at most one dominant raised surface per compact viewport;
- interactive targets remain at least 48x48 logical pixels;
- immediate feedback is finite, selection/reveal motion is bounded by the
  existing 120/220/340 ms policy;
- `disableAnimations` or `accessibleNavigation` resolves transitions to zero
  or near-zero without removing content or focus.

There is no continuous ambient animation, pulse, shimmer, particle system, or
motion that gates authority.

## 8. Surface hierarchy

### 8.1 Case Library: Executive

The accepted explicit navigation contract remains intact. Compact order is
masthead, Previous/Next/current-total/Browse, one complete selected case,
identity and synopsis, real metadata, Start, and existing secondary action.
Wide uses a bounded case index and one dominant selected composition. Motif,
title, synopsis, and metadata share an editorial composition; the decorative
art region cannot consume most of the viewport without information.

All five cases, filters, stable IDs, order, fallback, localization, keyboard
selection, Browse, and launch separation remain unchanged.

### 8.2 GreenFire Operations: Executive plus Analytical

The first viewport presents GreenFire/current phase, projected day/time,
explicit dossier matter status when available, separate lifecycle/closure,
separate attention/global-decision/Pressure-response concepts, projected
Pressure or honest inactive state, the correlated visible-request entry, a
Dossier entry when that projection exists, and the existing response entry
point.

Inactive Pressure is a compact state, not a viewport-sized empty panel. Active
Pressure presents only its projected source, deadline, status, and available
response framing. It never recommends strategy. Red appears only for a real
urgent/action-required projection.

### 8.3 Inbox: Working

The screen consumes one `InboxPresentation` ordering and attention model. A
compact ledger summary precedes projected message entries. Sender/source and
time are metadata; subject is primary; excerpt is secondary; explicit status
is aligned consistently. Large text may move metadata to a second line but
keeps subject and required status complete.

The attention summary remains exactly equal to the complete displayed set of
red `ACTION REQUIRED` entries. Available gameplay decisions remain separate.

### 8.4 Dossier: Working plus Analytical

The file header presents case identity and projected phase. Anchored or indexed
sections separate visible procedure, facts, evidence, deadlines/remedies, and
other already projected groups. Rules, tabs, projected type/status metadata,
and paper layers create hierarchy without turning every entry into a rounded
card.

Only the exact `DossierProjectionView` lists and existing ordering/grouping are
shown. Missing groups use an honest empty state. The UI does not rank evidence,
infer credibility/authenticity, add conclusions, duplicate items, or reveal
hidden material. The current Dossier projection exposes no communications
collection and evidence exposes no source field. The pilot therefore adds no
Dossier communications group or evidence-source label, does not pull Inbox
messages into the file, and does not infer a source from IDs or fact links.
If the file header presents case identity, it receives the already selected
`MobileCaseDefinition`/localized text or `snapshot.matterTitle` explicitly;
the Dossier never reconstructs identity from its treatment or contents.

### 8.5 Deferred surfaces

Calendar, AI, Career, Training Debrief, settings, other case-specific states,
and release/store surfaces receive only safe shared tokens and shell behaviour.
Their information architecture is not redesigned in this pilot. If global
tokens regress them, the token is fixed or the surface is isolated.

## 9. Presentation projection mapping

Every visible field introduced or repositioned by the pilot has one explicit
source:

| Visible presentation | Exact source | Allowed derivation |
| --- | --- | --- |
| case title/topic/caption/synopsis | `MobileCaseDefinition` and `LocalizedCaseText` | locale fallback already defined by bundle |
| case jurisdiction/role/client/status/difficulty | existing case definition/localized presentation fields | formatting only |
| case order/current-total | filtered authoritative definitions and selected stable `caseId` | index within exact visible ordered list |
| case playability | `CaseRuntimeFactory.supports(definition)` | boolean presentation only |
| case visual treatment | `CaseVisualManifest.resolve(caseId)` | safe default treatment for missing entry |
| gameplay day/time/stage | `GameSnapshot.dayLabel`, `timeLabel`, `stage` | label composition only |
| dossier matter status | `GameSnapshot.dossier?.procedure.matterStatus` | explicit localized state label; absent when no dossier projection |
| matter lifecycle/closed state | `GameSnapshot.matterLifecycle`, `isClosed` | separate explicit localized lifecycle/closure labels |
| Inbox rows and attention | `InboxPresentation.from(snapshot.inbox)` | final displayed ordering and `requiresAttention` count only |
| global available decisions | `GameSnapshot.actions` | exact list length and existing action picker |
| Pressure state/source/deadline | strict `LivingCaseViewModel.activePressure` and correlated deadline/request projection | neutral inactive state when absent |
| Pressure responses | `LivingCaseViewModel.responseActions` correlated with `snapshot.actions` | exact scoped list/count; no recommendation or reordering |
| correlated visible request | `LivingCaseViewModel.visibleRequest` | exact projected sender/subject/body/time/status; absent when strict correlation fails |
| Dossier availability/material | `GameSnapshot.dossier` facts/evidence/deadlines | exact list presentation; optional material count is their exact sum |
| Dossier file identity | selected `MobileCaseDefinition`/`LocalizedCaseText` or `snapshot.matterTitle` passed explicitly | no reconstruction from treatment or IDs |
| Dossier phase/status | `DossierProjectionView.procedure` | localized labels only |
| facts | `DossierProjectionView.facts` | exact order/status; no quality score |
| evidence | `DossierProjectionView.evidence` | exact title/kind/description/explicit fact links; no source label |
| deadlines/remedies | `DossierProjectionView.deadlines` and nested remedies | exact projected status and action IDs; no dispatch outside existing path |
| outcome/debrief | existing `TrainingDebriefView` and outcome route | exact projected terminal mapping only |
| compact/wide destination selection | `HomeShell` presentation state and one destination model | stable index/ID across layout only |
| OFFICE/AFTER HOURS | explicit injected mode or strict `HH:mm` `GameSnapshot.timeLabel` parser | pure deterministic resolver with AFTER HOURS fallback; elapsed dossier minutes forbidden |
| pause/speed/save/load state | existing `HomeShell` presentation state and repository capability flags | regroup controls without behavioural change |

No widget parses localized copy, colour, case ID, motif, or screenshot geometry
to infer a gameplay state.

## 10. Count semantics

Three counts may be visible and have intentionally different meanings:

1. attention count: the number of final displayed Inbox entries whose exact
   projected status requires attention;
2. global decision count: the exact number of currently projected available
   `GameActionView` entries in `snapshot.actions`;
3. Pressure response count, only on the scoped Pressure surface: the exact
   `LivingCaseViewModel.responseActions.length` after its existing strict
   Pressure/manifest/action correlation.

Inbox summary, compact badge, wide navigation treatment, and red status stamps
consume the same `InboxPresentation`. The attention count equals the displayed
red set for initial, transitioned, zero-attention, EN/RU, compact, and wide
fixtures. The decision control uses only `snapshot.actions`, remains hidden at
zero where existing behaviour requires it, and opens the existing picker.
The Pressure response count never substitutes the global decision count and
never includes unrelated actions. No count is hard-coded or dispatches an
action.

## 11. Accessibility and localization

The pilot provides explicit EN/RU chrome for every new label. It preserves
content localization from the authoritative bundle/projection and never
derives copy from IDs.

Acceptance covers 360x800 EN 100% OFFICE, 360x800 RU 200% OFFICE, 412x915 EN
200% AFTER HOURS, 699 RU 200% OFFICE, 700 EN 200% AFTER HOURS, 800x1280 RU
OFFICE, and 1024x768 EN AFTER HOURS.

For each supported state:

- no Flutter layout exception or RenderFlex overflow;
- normal scrolling reaches all content and actions;
- selected, focused, required, inactive, and disabled state is not colour-only;
- names, roles, values, selected state, and button purposes are clear;
- focus order matches visual order and focus remains visible;
- high contrast remains legible;
- reduced motion retains all content and actions;
- every interactive target is at least 48 logical pixels;
- system back and canonical route callbacks remain unchanged.

## 12. Golden and evidence versioning

Historical Foundation, Catalogue, GreenFire, navigation, and atmosphere PNGs
are immutable. They are never overwritten, renamed, deleted, or used as a
broad update target.

New baselines live at the unambiguous repository-relative versioned path
`apps/juris-mobile/test/goldens/visual_identity/professional_ui_pilot_v2/windows_x64_flutter_3_44_8_engine_0cd6107/`.
The suite owns the existing canonical renderer-profile child and uses the
prefix `professional_ui_pilot_v2_`. The minimum set is:

1. catalogue phone OFFICE EN;
2. catalogue phone OFFICE RU 200%;
3. catalogue tablet landscape AFTER HOURS EN;
4. GreenFire Operations phone inactive Pressure OFFICE;
5. GreenFire Operations phone active Pressure AFTER HOURS when an existing
   canonical fixture supports it;
6. Inbox phone with four action-required messages OFFICE EN;
7. Inbox phone RU 200% AFTER HOURS;
8. Dossier phone OFFICE EN;
9. Dossier tablet portrait AFTER HOURS RU;
10. responsive shell wide navigation;
11. representative high-contrast state;
12. representative reduced-motion state.

Each baseline renders in two fresh test processes from clean deterministic
state on the canonical Windows/Flutter 3.44.8 profile. The ordinary Flutter
decoded-pixel comparator remains exact with no tolerance. A guarded verifier
requires identical exact path, byte length, and SHA-256 sets across both
processes. Every image is visually inspected; pixel equality alone is
insufficient. If the active-Pressure fixture is absent, the absence is recorded
and the nearest already authoritative fixture is used without invented state.

The historical Catalogue and GreenFire golden tests currently render the live
widgets that this pilot intentionally redesigns. They cannot truthfully keep
comparing the redesigned renderer to v1 pixels. During the acceptance family,
those suites are migrated—not skipped—into active exact path/byte/SHA-256
identity verification for every historical PNG, while their behavioural and
authority assertions remain in structural/widget tests. Live pixel assertions
for redesigned surfaces exist only in the v2 suite. No v1 file, hash inventory,
test name, historical fixture, or comparator tolerance is changed to bless the
new design; no legacy runtime renderer is added to production.

Native evidence remains ignored build output with stable IDs:

- `UI2-CAT-PHONE-OFFICE-EN`;
- `UI2-CAT-PHONE-OFFICE-RU`;
- `UI2-OPS-PHONE-OFFICE-INACTIVE`;
- `UI2-OPS-PHONE-AFTER-HOURS`;
- `UI2-INBOX-PHONE-OFFICE`;
- `UI2-DOSSIER-PHONE-AFTER-HOURS`;
- `UI2-CAT-TABLET-WIDE`;
- `UI2-DOSSIER-TABLET-WIDE`.

The offline owner-review gallery lives only under ignored
`apps/juris-mobile/build/professional-ui-pilot-v2-review/` and uses no network
resources. It includes all v2 goldens, all native captures, before/after pairs
from existing accepted evidence where available, viewport/locale/theme/text
scale/state labels, evidence IDs, APK and commit identities, and a short
visual-intent note for each surface.

Native evidence is captured only after a fresh debug APK is built. The report
records the APK's exact path, bytes, and SHA-256; emulator model, Android/API,
and exact device resolution; and the public-UI-only navigation sequence used
for each capture. Tablet native capture receives one bounded attempt. If no
tablet profile is available, the exact blocker is recorded and deterministic
tablet goldens remain the review evidence; no image is fabricated.

## 13. Determinism and performance budget

- semantic theme resolution is pure and O(1);
- visual manifests and immutable projection adapters load once per repository
  or fixture, never per painter frame;
- destination models are single-source and bounded;
- lists and pagers remain lazy/bounded; no eager all-panel construction;
- no post-layout measurement/setState loop or unbounded intrinsic layout;
- no continuous design ticker after settling;
- finite transitions use centralized motion tokens and compare all painter
  inputs in `shouldRepaint`;
- decorative layers are semantics-excluded and isolated by
  `RepaintBoundary` only when measurement justifies it;
- no runtime network font, image, analytics, or asset fetch;
- no new runtime bitmap dependency or unbounded cache;
- no audio package, asset, controller, player, or initialization path;
- no repeated layout exception, manifest parsing, or theme parsing on rebuild;
- case paging, route changes, and dossier scrolling receive emulator
  interaction inspection;
- performance evidence records emulator model, Android/API version, build mode,
  and exact interaction sequence; no FPS claim is made without a real profile
  measurement.

## 14. Pilot scope and full-rollout exclusions

Pilot implementation is limited to:

- shared semantic theme, typography, density, and Option B shell;
- accepted Case Library composition;
- GreenFire Operations and Inbox;
- GreenFire Dossier;
- focused accessibility, deterministic v2 golden, and local review evidence;
- factual checkpoint documentation after all gates pass.

Explicitly excluded are full redesign of Calendar, AI, Career, Training
Debrief, settings, all states of all other cases, audio/haptics, Rust/content,
bridge/FFI/native production changes, persistence/schema changes, workflows,
release/store work, versioning, publication, and remote operations.

## 15. Implementation, test, and commit boundaries

The non-empty commit families are ordered and never amended:

1. `docs(ui): define professional product redesign pilot`;
2. `refactor(mobile): add professional office and after-hours shell`;
3. `feat(mobile): apply editorial case library composition`;
4. `feat(mobile): redesign GreenFire operational workspace`;
5. `feat(mobile): redesign GreenFire living dossier`;
6. `test(mobile): add professional UI pilot acceptance`;
7. `docs: record professional UI pilot checkpoint`.

Each family receives focused tests, formatting of only intended paths,
`git diff --check`, explicit staging, and complete diff review. No broad
`git add .` or `git add -A` is used. A later correctness issue is a stop before
any fixup commit.

Final acceptance includes full Flutter tests/goldens, established Flutter
integration tests, locked Rust gates, authoring diagnostics, canonical
trace/fingerprint verification, deterministic mobile export twice,
`PILOT_BASE` byte comparison, Android build/native integration tests, exact
ABI/export audits, complete `PILOT_BASE..HEAD` review, native evidence, and the
offline gallery. Any failing gate is an immediate stop. Expectations,
fixtures, or baselines cannot be changed merely to bless a failure.

## 16. Owner acceptance procedure

The pilot stops locally with a clean tracked tree/index, the protected ZIP as
sole untracked path, a rebuilt installed APK, native evidence, deterministic
goldens, an offline gallery, and the factual checkpoint commit. The app remains
in the foreground on the most representative Catalogue or Operations state.

The review gallery identifies viewport, locale, semantic theme, text scale,
state, evidence ID, APK identity, and commit identity. The owner scores 1-5:

1. professional commercial quality;
2. distinctive GENESIS identity;
3. legal/institutional credibility;
4. clarity of situation and next action;
5. editorial hierarchy;
6. Catalogue navigation confidence;
7. Operations information density;
8. Inbox and Dossier scanability;
9. OFFICE/AFTER HOURS continuity;
10. compact usability;
11. tablet composition;
12. EN/RU typography;
13. accessibility at 200%;
14. restraint and absence of generic AI styling;
15. consistency without visual monotony.

The local review report also names the three strongest improvements, three
remaining weaknesses, any surface that still resembles a productivity app,
any decoration competing with legal content, and any projected field whose
meaning could be misunderstood.

The next decision is exactly one of:

- `APPROVE PROFESSIONAL UI PILOT V2 FOR FULL ROLLOUT`;
- `REQUEST TARGETED UI PILOT CORRECTIONS` with an evidence ID and exact
  correction;
- `REJECT UI PILOT DIRECTION` with an evidence ID and reason.

Approval does not authorize implementation. Full rollout, original audio,
publication, and hosted acceptance require a separate contract.
