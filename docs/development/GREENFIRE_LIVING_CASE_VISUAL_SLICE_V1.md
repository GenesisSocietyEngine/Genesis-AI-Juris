# GreenFire Living Case Visual Slice v1

## Status and authority boundary

This contract defines a presentation-only visual slice for the current
`greenfire_first_72_hours` case. Its base is final publication commit
`39b856320ed5dc397562068706c4cea7d703899c`.

The authoritative Rust runtime, current and retained scenario content,
localization overlays, canonical traces, generated mobile bundle, saves,
bridge protocol, C ABI, native integration, app version, and the five-case
catalogue remain unchanged. Flutter may compose only fields already present in
the player-visible catalogue or runtime projections. Missing data is hidden or
rendered neutrally; it is never reconstructed from legal text.

## Visual thesis

GreenFire is an institutional crisis desk under visible time pressure: deep
navy and near-black surroundings, restrained metallic gold, neutral evidence
paper, the existing industrial-haze greens, and a controlled ember signal.
Hierarchy, typography, geometry, and finite state transitions provide drama.
No portrait, real authority emblem, third-party game asset, continuous ticker,
or fabricated evidence is permitted.

## Existing launch and session route

1. `CaseCatalogScreen` invokes its existing `CaseStartCallback` once.
2. `JurisApp._startCase` calls `CaseRuntimeFactory.create` once with the selected
   `MobileCaseDefinition`, locale, bridge client, save store, and full content
   inventory.
3. One `HomeShell` owns that repository until reset, load, or catalogue exit.
4. All action confirmation continues through `ActionPickerSheet`; only its
   returned stable action ID reaches `GameRuntimeRepository.applyAction`.
5. Dossier and Training Debrief remain read-only projections opened from the
   existing shell. Save/load and historical content resolution stay in the
   repository.

## Projection inventory

| Required visual | Existing player-visible source | Stable identity | Safe fallback |
|---|---|---|---|
| case title, topic, jurisdiction, role | `MobileCaseDefinition` plus `LocalizedCaseText` | `caseId`, `scenarioId` | generic `HomeShell` |
| current case time and status | `GameSnapshot.dayLabel`, `timeLabel`, `stage`, `matterLifecycle`, `isClosed` | selected case context | hide unavailable secondary label |
| Pressure source and deadline | `ActivePressureView` | `pressureId`, `sourceActorId` | inactive neutral panel |
| controlled/risky response framing | available `GameActionView` values correlated by strict visual manifest | exact action IDs | ordinary `ActionPickerSheet` treatment |
| regulator request material | visible `InboxItemView` plus currently active Pressure actor | message ID and exposed actor ID | neutral message treatment |
| deadline/countermove reveal | visible `DossierDeadlineView` or `DeadlineView` status | exact deadline ID | hide reveal treatment |
| visible facts and evidence | `DossierProjectionView.facts/evidence` | projected fact/evidence IDs | empty-state paper surface |
| visible remedies | `DossierDeadlineView.remedies` | projected action IDs | no remedy control |
| terminal outcome | `TrainingDebriefView` | `resolvedOutcomeId` | generic debrief |
| current versus retained content | repository-created case definition | authoritative content resolution | no F1-only treatment without projection |

Inbox rows expose sender display text but no actor/channel ID. A regulator seal
may therefore be shown only while an active Pressure projection explicitly
exposes the configured regulator actor and the configured request is visible.
Otherwise the message remains neutral. This is also the safe replacement rule
for golden `GF-08`.

## Strict presentation identities

The Living Case visual manifest may name only these already-authored stable IDs:

- case: `greenfire_first_72_hours`;
- Pressure: `regulator_document_request_pressure`;
- regulator actor: `port_haven_environment_authority`;
- request: `regulator_document_request`;
- deadline: `initial_regulatory_response_deadline`;
- controlled response: `submit_initial_regulatory_response`;
- disclosed-risk response: `release_unreviewed_documents`;
- outcomes: `protected_crisis_position` and
  `compromised_crisis_position`.

Unknown keys, duplicate IDs, unknown treatment names, wrong schema versions,
or invalid colours fail the Living Case manifest load and select a neutral
non-Living fallback. Painters receive an already-resolved treatment and never
read IDs, clocks, locale, repositories, or runtime state.

## Presentation state matrix

| State | Projection condition | Presentation only |
|---|---|---|
| inactive | no active Pressure and configured deadline not missed | quiet institutional desk |
| request revealed | configured message visible and configured Pressure active | regulator source, request material, due time |
| active | configured Pressure active | clamped case-clock-to-due arc and remaining time |
| responses available | active Pressure lists projected action IDs | existing available actions, existing confirmation |
| completed | configured deadline is completed and Pressure absent | restrained completed treatment |
| missed/countermove | configured deadline is missed | final-frame breach treatment; no inferred consequence |
| unknown/future | unknown projection schema or identity | neutral generic treatment |
| terminal protected | exact debrief outcome ID | protected Outcome Dossier |
| terminal compromised | exact debrief outcome ID | compromised Outcome Dossier |
| historical F0 | no F1 Pressure projection | no Pressure, regulator, or countermove invention |

The deadline arc is display-only. It clamps the supplied values, handles
missing/equal/reversed/out-of-range inputs, never ticks continuously, and never
decides availability, lateness, success, failure, or outcome.

## Composition

- Compact: case spine, dominant live-state canvas, existing bottom navigation,
  and scrollable secondary material.
- Wide: existing bounded navigation rail, dominant live-state canvas, and a
  contextual visible-material pane at the established `700px` breakpoint.
- Opening: finite, non-persisted GreenFire composition after runtime creation;
  it dispatches no command and resolves immediately under reduced motion.
- Dossier: visible facts, evidence, deadlines, and remedies only, using neutral
  material surfaces and no seals on unknown sources.
- Communications: visible message content only; no mutation of read state,
  priority, order, reply availability, or content.
- Outcome: exact protected/compromised debrief projections, with existing
  replay/back navigation and no outcome recomputation.

## Accessibility and determinism

- EN and RU use existing catalogue/scenario localization only; feature chrome
  has explicit EN/RU resources and never derives copy from IDs.
- Every interactive target is at least 48 logical pixels.
- Standard/high-contrast palettes are resolved centrally.
- Reduced motion removes the opening/reveal transition and continuous motion is
  prohibited.
- Decorative painters are excluded from semantics; headings, states, source,
  deadline, actions, and controls remain ordered and labelled.
- Golden clocks, locale, DPR, text scale, contrast, motion, and viewport are
  pinned. Two clean renders must be byte-identical.

## Golden matrix

`GF-01` opening, `GF-02` request workspace, `GF-03` RU Pressure detail,
`GF-04` EN 200% actions, `GF-05` high-contrast missed reveal, `GF-06` RU
Dossier material, `GF-07` selected visible document, `GF-08` regulator request
with the safe actor-correlation rule, `GF-09` protected debrief, `GF-10` RU
high-contrast compromised debrief, `GF-11` 1024x768 workspace, `GF-12`
800x1280 Dossier/context, `GF-13` wide protected debrief, and `GF-14`
historical-F0/no-invented-Pressure fallback.

Existing six Foundation and six Catalogue goldens are immutable.

## Acceptance and exclusions

Acceptance requires strict manifest tests; adapter unit tests; compact/wide,
EN/RU, 200% text, high contrast, reduced motion, semantics, focus, target-size,
and no-overflow widget tests; exact existing action confirmation/dispatch;
save/load and F0 tests; 14 deterministic new goldens; existing 12 golden
comparison; full Flutter/Rust/bundle checks; and Android native visual evidence.

Excluded: Rust or scenario edits, localization-overlay edits, bundle generation
changes, save/bridge/FFI/native production changes, new legal content, new
scenario branches, new outcomes, portraits, sound, haptics, release/tag/version
work, redesign of the other four cases, push, or pull request.
