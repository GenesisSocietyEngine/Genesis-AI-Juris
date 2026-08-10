# Visual Identity Foundation v1

Status: local implementation contract

Branch: `feat/visual-identity-catalogue-v1`

Visual base: `addc2849574e8f08529da0fd9b7a4b52b50484aa`

Visual-base tree: `36a25abfe8c0447ddff9522152b9d13c9b0869ee`

Scope: Visual Identity Foundation v1 followed by Case Catalogue Cinematic Redesign v1

Publication boundary: local checkpoint only

## 1. Purpose

This contract defines a presentation-only visual system for GENESIS: AI Juris and
its first production consumer: the five-case mobile catalogue. The visual thesis is:

> prestige legal thriller + living case file + institutional simulation

The result should read as a deliberate editorial case index rather than a generic
dashboard, a stack of equally weighted Material cards, or a streaming poster grid.
It preserves the existing deep navy, restrained metallic gold, neutral evidence
surfaces, and cyan circuitry accent. Per-case colours are bounded decorative accents;
they never become a second app brand or an authority signal.

The work is intentionally achievable with deterministic Flutter code. It does not
depend on portraits, photographs, external game assets, Figma, ImageGen, network
images, shaders, video, particles, 3D, or continuous ambient animation.

## 2. Non-goals

This iteration does not change:

- Rust scenario, clock, deadline, action, pressure, countermove, outcome, replay,
  persistence, disclosure, or scoring authority;
- case identity, scenario identity, content versions, fingerprints, canonical paths,
  final minutes, outcomes, digests, or retained-save resolution;
- the authoritative mobile case-bundle schema, exporter, generated bundle bytes,
  catalogue localization source, scenarios, overlays, identity files, or traces;
- the bridge command surface, C ABI version, or exported symbols;
- case launch routing, runtime factory selection, callback payload, or seed;
- app version, release, tag, signing, deployment, store, or native production assets;
- screen-specific gameplay, Dossier, Pressure UI, Training Debrief, or evidence
  document redesign; those screens may inherit the global body/font hierarchy, but
  their information architecture and authoritative data flow do not change;
- character art, sound, haptics, or the later Living Case Visual Slice.

This contract does not claim full WCAG certification. It defines precise automated
checks and review evidence for the implemented catalogue boundary.

## 3. Accepted base and immutable authority boundary

The accepted GreenFire product and publication merge is exact:

```text
VISUAL_BASE=addc2849574e8f08529da0fd9b7a4b52b50484aa
```

At that base, local `HEAD`, `main`, `origin/main`, and GitHub `main` were equal;
tracked work and the index were clean; and the only untracked path was the protected
`docs/development/CURRENT_PROGRESS.zip`.

The authoritative mobile bundle is version 5, 684,266 bytes, SHA-256
`e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a`.
It contains five current catalogue cases and one load-only GreenFire definition.
Visual work must leave those bytes exact.

Flutter may render only authoritative catalogue metadata already present in the
bundle and presentation treatments resolved from the separate visual manifest.
Presentation data cannot supply or reinterpret gameplay data, localized case copy,
hidden state, pressure state, difficulty, readiness, outcome, availability, player
role, actions, dispatch identity, deadlines, evidence, facts, resources, costs, or
scores.

The stable start path remains:

```text
CaseCatalogScreen
  -> CaseStartCallback(MobileCaseDefinition, locale, CaseCatalogBundle)
  -> JurisApp._startCase
  -> CaseRuntimeFactory.create
```

Selection, focus, hover, scrolling, painting, and animation are presentation-only.
They must never dispatch an action or mutate a game session.

## 4. Design-layer ownership

The visual system is one coherent extension of the existing Material 3 `JurisTheme`,
not a parallel theme implementation.

Ownership is divided as follows:

- `JurisTheme` owns the Material `ColorScheme`, global font families, component
  defaults, and registered typed theme extensions.
- immutable design-token extensions own semantic spacing, radii, borders, surfaces,
  typography, scrims, focus treatment, minimum target size, motion, and case-neutral
  art roles that Material does not express;
- the visual-manifest model and repository own parsing and presentation-safe lookup;
- reusable widgets and painters consume only typed theme tokens and a resolved
  immutable treatment;
- the catalogue owns selected `case_id`, filtering, locale presentation, responsive
  composition, and the unchanged launch callback;
- authoritative bundle models and repositories remain unaware of visual treatments.

No hard-coded font family is allowed outside the design layer. New repeated spacing,
colour, radius, border, duration, or curve values belong in tokens rather than local
`copyWith` fragments.

## 5. Typography provenance and semantic roles

Fonts are bundled locally and are never fetched at runtime. The `google_fonts`
package is not used. Application-owned Flutter aliases avoid legacy internal family
name mismatches.

| App alias / role | Exact upstream file | Upstream release and commit | Bytes | SHA-256 |
|---|---|---|---:|---|
| `JurisLiterata`, weight 600 | `Literata-SemiBold.ttf` | Literata 3.103, `0c2761b727a1b3a7cffd313c37f0f5163dfc7a63` | 329,068 | `ee8f9413ebc974e1c1cfc76f6bdb9d08ddaadc66eeddd7320a65f8c581284d6d` |
| `JurisPlexSans`, weight 400 | `IBMPlexSans-Regular.ttf` | IBM Plex Sans 1.1.0, `1da12f02587b630c07e92692d21492d722f53614` | 200,500 | `975dcda37d80f038dcd143c22e33ca2d97a0cc5a929aace1c749153b0fe1afa5` |
| `JurisPlexSans`, weight 600 | `IBMPlexSans-SemiBold.ttf` | IBM Plex Sans 1.1.0, `1da12f02587b630c07e92692d21492d722f53614` | 202,632 | `a20caf8286023a6a7a85e40b1d2a4ae9fc3e3b1f9eda8f4c542dd4986af67bb1` |
| `JurisPlexMono`, weight 500 | `IBMPlexMono-Medium.ttf` | IBM Plex Mono 2.5.0, `2f9ba1b25957d958db71a849e85d72e3ecfb845a` | 174,008 | `98fbd727aae340b236955879dabed4d991aac9e8e90b3b2a67ce4a59221cc97c` |

The immutable source URLs are the matching raw files at those commits:

- `https://raw.githubusercontent.com/googlefonts/literata/0c2761b727a1b3a7cffd313c37f0f5163dfc7a63/fonts/ttf/Literata-SemiBold.ttf`;
- `https://raw.githubusercontent.com/IBM/plex/1da12f02587b630c07e92692d21492d722f53614/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf`;
- `https://raw.githubusercontent.com/IBM/plex/1da12f02587b630c07e92692d21492d722f53614/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-SemiBold.ttf`;
- `https://raw.githubusercontent.com/IBM/plex/2f9ba1b25957d958db71a849e85d72e3ecfb845a/packages/plex-mono/fonts/complete/ttf/IBMPlexMono-Medium.ttf`.

Direct `cmap` inspection of every exact binary must cover the 173-character required
set: printable Basic Latin, the complete Russian alphabet including `Ё/ё`, NBSP,
guillemets, typographic quotes, en/em dash, bullet, ellipsis, and `№`.

Literata and IBM Plex are licensed under SIL Open Font License 1.1. Exact upstream
licence texts are retained next to the binaries and mapped in a third-party notice.
The pinned Literata `OFL.txt` SHA-256 is
`8742963604cd89dc81437811a850018fc03b2bfad686d7422c8235967c87614e`;
the pinned IBM Plex `LICENSE.txt` SHA-256 is
`7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da`.
Fonts remain unmodified. They are not sold by themselves and no author or IBM
endorsement is implied. Any future modified or subset IBM Plex build must be renamed
because `Plex` is a reserved font name.

The semantic type scale contains at least:

- `caseDisplay`: Literata 600, responsive compact/wide display sizes;
- `sectionTitle`: Literata 600 or Plex Sans 600 according to hierarchy;
- `bodyReading`: Plex Sans 400 with a generous line height;
- `bodyCompact`: Plex Sans 400;
- `controlLabel`: Plex Sans 600;
- `caseIndex`: Plex Mono 500 with restrained tracking;
- `metadata`: Plex Mono 500 or Plex Sans 600;
- `caption`: Plex Sans 400.

EN and RU use the same hierarchy. Body copy is never all-caps or decorative. At 200%
text scaling, content grows and scrolls; text is not clipped or shrunk to fit.

## 6. Semantic design tokens

Typed theme extensions centralize:

- brand gold, navy, cyan accent, neutral evidence surfaces, safe case-accent use, and
  explicit high-contrast alternatives;
- spacing scale and responsive outer gutters;
- radii and border weights;
- elevation and surface policy;
- all typography roles;
- immediate, selection, and reveal motion durations and curves;
- content, modal, and cinematic scrims;
- visible keyboard/d-pad focus ring;
- minimum interactive extent of 48 logical pixels.

Material `ColorScheme` remains the source for semantic foreground/background roles.
Case accents may decorate lines, silhouettes, index marks, and non-text art, but normal
copy uses audited theme pairs. The system avoids excessive glow, glassmorphism,
nested-card hierarchy, gradients behind long text, and colour-only state.

## 7. Case Visual Manifest v1

### 7.1 Asset and schema

`assets/visual_identity/case_visual_manifest.v1.json` is a standalone presentation
asset. It is not generated into or parsed as part of the authoritative case bundle
and does not participate in fingerprints, save identity, replay, or Rust validation.

The immutable schema contains exactly:

- root `schema_version: 1`;
- one `default_treatment`;
- a `case_treatments` list keyed only by `case_id`;
- a finite `motif` enum;
- four semantic dark-cover palette roles;
- a bounded deterministic integer `art_seed`.

The initial palette roles are `background`, `surface`, `accent`, and `signal`; each is
an opaque six-digit RGB colour. Seeds are integers in the inclusive range 0–65,535.
The allowed motifs are `institutional_grid`, `systems_grid`, `freight_routes`,
`industrial_haze`, `supply_chain`, and `aquifer_contours`. The first is reserved for
the safe default treatment. V1 has no free-form composition object: geometry remains
code-owned until a concrete bounded field is justified and consumed. The parser uses
an exact key allow-list at every object level.

Strict parsing rejects:

- an unknown schema version or key;
- duplicate or empty case IDs;
- malformed or non-opaque colours;
- an unknown motif;
- invalid, non-integral, or out-of-range seed/composition values;
- any gameplay, localization, scenario, fingerprint, pressure, readiness, outcome,
  action, deadline, evidence, fact, resource, cost, or scoring field.

The manifest model has no dependency on `MobileCaseDefinition` or retained content
models. Lookup accepts only a string `case_id` and returns an immutable treatment.

### 7.2 Production-safe fallback

Strict parsing remains directly testable and diagnostic. Production loading catches a
missing or corrupt visual asset, emits a debug/test diagnostic, and returns a built-in
safe manifest containing the default treatment. A missing case entry or an unknown
future case ID resolves to that default. Visual failure never blocks the case library,
changes launchability, replaces the authoritative bundle, or mutates game state.

The manifest is loaded and parsed once by the presentation repository, not during
widget rebuilds or painter calls.

### 7.3 Exact v1 treatments

There is exactly one entry for each current catalogue case:

| Current `case_id` | Motif | Direction |
|---|---|---|
| `be_commercial_failed_erp_001` | `systems_grid` | cold office geometry, interrupted circuits, amber incident signal |
| `be_commercial_logistics_001` | `freight_routes` | night terminal routes, diagonal rain rules, industrial teal |
| `greenfire_first_72_hours` | `industrial_haze` | refinery silhouettes, controlled toxic green, emergency orange |
| `nl_food_safety_goldenshell_001` | `supply_chain` | crate and chain geometry, ochre gold, restrained recall red |
| `us_environmental_desert_water_001` | `aquifer_contours` | topographic groundwater contours, cyan evidence lines, sand accent |

Motif selection happens only in the manifest. Widgets and painters do not branch on a
case ID.

## 8. Deterministic reusable art primitives

The foundation provides small composable equivalents of:

- `CaseHeroArt`: generic deterministic motif painter;
- `DossierFrame`: institutional border, crop, and tab treatment;
- `CaseIndexMark`: case sequence and file-reference presentation;
- `JurisdictionStamp`: fictional text stamp, never an official seal;
- `CinematicScrim`: foreground contrast guarantee;
- `CaseTreatmentScope`: typed access to the already-resolved treatment.

Painters receive immutable typed values only. Equal inputs produce equal paint
operations and pixels. No wall clock, runtime randomness, device ID, locale-dependent
geometry, game state, or mutable global affects art. `shouldRepaint` compares all
immutable visual inputs. Decorative custom paint is excluded from semantics. Expensive
layers use `RepaintBoundary` only where measurement or stable composition justifies it.

No widget or painter contains `if (caseId == ...)` or `switch (caseId)`. Motif dispatch
is generic over the finite enum.

## 9. Motion policy

Central motion tokens define approximately:

- immediate feedback: 120 ms;
- selection transition: 220 ms;
- deliberate reveal: 340 ms.

Curves are explicit and stable. There is no perpetual animation, ticker after settle,
shimmer, pulse, parallax, particle layer, or independently moving decoration.

If either `MediaQuery.disableAnimations` or `MediaQuery.accessibleNavigation` is true,
all design-layer durations resolve to zero and visual state changes immediately.
Animation completion never starts a case, dispatches an action, or acts as a
navigation/authority boundary.

## 10. Accessibility contract

The foundation and catalogue enforce:

- interactive targets at least 48x48 logical pixels;
- automated contrast checks for the actual normal-text, large-text, boundary, focus,
  and selected-state token pairs;
- a visible focus ring for keyboard and d-pad traversal;
- semantic grouping, labels, selected-state announcements, and explicit case context
  for Start Case and details actions;
- decorative art absent from the semantics tree;
- status conveyed through text and icon rather than colour alone;
- EN and RU at 100% and 200% text scale without overflow or unreachable actions;
- high-contrast media variants and reduced-motion behaviour;
- focus/traversal order matching visual order;
- no important action or state available only through a tooltip.

The locale control exposes its selected state and language names. Loading progress has
a label. Failure and retry remain usable and do not expose a raw production exception
as primary copy.

## 11. Cinematic catalogue composition

Selection is stored only as stable `case_id`. The existing authoritative order remains
`sort_order`, then `case_id`.

### 11.1 Compact

Below the documented wide breakpoint, the composition is:

1. an unframed GENESIS masthead with localized title/subtitle, language control, and
   fictional notice;
2. a horizontally scrollable and focusable case index;
3. one selected cinematic case panel;
4. hero art followed by editorial information and actions;
5. an explicit sequence mark such as `03 / 05`.

### 11.2 Wide and tablet

At 700 logical pixels and above, matching the app's existing navigation precedent, a
bounded vertical index occupies the left column and one selected treatment occupies
the main area. The panel combines art and text into one composition and never stretches
phone cards or creates five equal tiles. Portrait `800x1280` and landscape `1024x768`
are required acceptance viewports.

Within the selected panel, hierarchy is fixed: identity; localized topic; caption;
synopsis; status/difficulty and client/role metadata; primary Start Case action; then
secondary details. Art never implies outcome, severity, evidence quality, deadline,
or recommended strategy.

Filtering preserves selection while it remains visible; otherwise it chooses the first
visible case deterministically. Locale changes preserve selected `case_id`. Empty,
loading, bundle failure, and manifest fallback states remain accessible. Stable keys
cover the index, selected panel, start action, and details action.

## 12. Golden and screenshot policy

Flutter's own test stack is the default. Golden tests load the exact bundled fonts and
pin locale, brightness, high contrast, text scale, reduced-motion signals, logical
viewport, and device-pixel ratio. Baseline PNGs are committed with regeneration
instructions that record Flutter/Dart/engine and host metadata.

Foundation goldens cover:

1. semantic type and control tokens in EN;
2. semantic type and representative long text in RU;
3. every generic motif at identical geometry;
4. high-contrast and reduced-motion output where pixels differ.

Foundation unit tests separately prove exact token/type-role mapping; EN/RU loading
and representative glyph rendering from the bundled fonts; schema/version and key
allow-lists; rejection of forbidden gameplay fields, invalid colours, motifs, seeds,
and duplicate IDs; safe default lookup; deterministic painter inputs and
`shouldRepaint`; actual token-pair contrast; reduced-motion resolution; and the
absence of visual fields or assets from the authoritative bundle model.

Catalogue goldens cover exactly the required review matrix:

| Viewport | Locale | State |
|---|---|---|
| `360x800` | EN | first visible case selected |
| `360x800` | RU | representative long-title case selected |
| `412x915` | EN | GreenFire selected |
| `800x1280` | RU | selected case with complete index |
| `1024x768` | EN | selected case with complete index |
| compact | EN or RU | 200% text, reduced motion, actions reachable |

Each accepted baseline is generated twice from clean test state and the corresponding
PNG SHA-256 must be byte-identical. A changed baseline is inspected visually and
explained before update. Blind `--update-goldens`, permissive comparators, and hiding
instability are forbidden. Flutter's normal golden failure output must retain expected,
actual, and diff images for inspection.

Additional structural tests cover all five treatments, every filter, no results,
manifest fallback, load failure/retry, high contrast, keyboard focus traversal,
selected semantics, locale-preserved selection, exact launch callback data, and
details behaviour. They also prove five current entries once in authoritative order,
no load-only entry, the same initial stable ID in compact and wide layouts, EN/RU at
200% with reachable actions, and that no widget infers gameplay state from motif,
colour, localized copy, or case ID. Emulator screenshots are ignored review
artifacts, not duplicate committed goldens, and are reported with exact paths,
dimensions, sizes, and hashes.

## 13. Determinism and performance budget

Acceptance requires:

- manifest parsing once per repository load and never per rebuild;
- no network font or art request;
- no continuous animation or ticker after settling;
- immutable treatment and painter inputs with stable equality;
- bounded painter complexity and no unbounded cache growth;
- no avoidable full-screen repaint during selection;
- no layout overflow or repeated exception in catalogue logs;
- no obvious selection or scrolling frame drop in the available Android profile or
  closest supported mode.

Performance evidence records device/emulator, API, mode, action sequence, and observed
results. No FPS claim is made unless an actual profiling tool measures it.

## 14. Compatibility gates

The final local checkpoint must prove:

- Rust 1.78 locked workspace check, format, workspace check, Clippy with warnings
  denied, all Rust tests, production diagnostics, and canonical traces;
- deterministic mobile export and check twice, with bundle bytes equal to
  `VISUAL_BASE`;
- Dart formatting, Flutter analysis, all unit/widget/golden tests, and repeat-golden
  hashes;
- existing Android native integration tests on the available API 37 emulator;
- an ordinary three-ABI debug APK and exact C ABI v1 symbol audit in every ABI;
- unchanged scenario fingerprints, canonical outcomes/digests, retained GreenFire
  loading, current GreenFire pressure behaviour, save envelope, app version, protected
  ZIP/save, refs, ruleset, tag, and release;
- `git diff --check`, complete `VISUAL_BASE..HEAD` review, and a clean tracked/index
  state with only the protected ZIP untracked.

Hosted iOS is not claimed in this local phase. It is mandatory only in a separately
authorized publication phase.

## 15. Commit and publication boundary

Implementation proceeds through non-empty commits in this semantic order:

1. `docs: define visual identity foundation v1`
2. `feat(mobile): add licensed juris typography and design tokens`
3. `feat(mobile): add presentation-only case visual manifest`
4. `feat(mobile): add deterministic art motion and accessibility primitives`
5. `test(mobile): establish visual identity golden infrastructure`
6. `feat(mobile): redesign the case catalogue cinematically`
7. `test(mobile): accept cinematic catalogue across locales and viewports`
8. `docs: checkpoint visual identity and catalogue v1`

Focused tests and diff review follow every commit. `CURRENT_PROGRESS.md` changes only
after all required gates pass.

This authorization ends at a clean local visual-review checkpoint. It does not permit
a push, PR, merge, release, tag, version bump, branch cleanup, or publication. The next
owner decision is either targeted local visual correction or a separately authorized
Visual Identity + Cinematic Catalogue Publication & Remote Acceptance phase.

Any need to change authoritative content, Rust, bridge/FFI, persistence, gameplay,
native production assets, workflows, or release state is a stop condition rather than
permission to broaden this contract.
