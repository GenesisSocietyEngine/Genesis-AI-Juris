# Desert Water Case v1

## Status and authority

This document is the specification-first contract for the production scenario
Desert Water. The player acts for the affected residents; Caldera Compression
& Cooling Inc. is the opposing industrial operator.

The implementation branch is `feat/desert-water-case`. It is rebased on the
Failed ERP PR #14 merge commit
`3cfa3066b64f36b92f3a77a30ec4a070e74860ed`; PR #14 published exact head
`0aa393096f1e9be4458070d3d53d739c1f8483c0`. The original unpublished Desert
head is retained locally as
`backup/desert-water-pre-failed-erp` ->
`44e565b22c52a4c3a3e69b2c137353b7771fcf77`.

The rebased Desert implementation commits are `57caf237`, `6d510738`,
`14ed61ce`, and `6a5006e4`. Two narrow follow-ups complete local validation:

- `d7a52d836f4f51b9c510af38513bcb2722cbd6a2` corrects generic validator
  analysis so an unambiguous terminal event retains its own condition guard;
  ambiguous terminal chains remain conservatively rejected;
- `de7ac065d095a0e268e14961b4b74edd754cf52e` makes Android Gradle tasks track
  transitive Rust workspace sources/manifests and the native build script, and
  aligns Desert integration assertions with the shared 08:00 presentation
  baseline.

Neither follow-up changes scenario content, runtime execution, persistence,
digest, bridge, FFI, or ABI contracts. The branch remains local and
unpublished.

This document is both the specification-first contract and the current local
integration handoff. Desert Water is implemented as declarative
`ScenarioDefinition` v1 content using the existing authoritative Rust runtime,
Matter Lifecycle v1, Dossier Projection v1, command-log persistence, JSON
bridge, and three-symbol native ABI. The fingerprint, generated five-case
bundle, combined Rust/Flutter totals, APK, and Android API 37 acceptance below
are measured results. The checkpoint has reached its local-review stop.

The case is:

- catalogue position 5 with `sort_order: 50`;
- the fifth authoritative Rust production scenario;
- a fictional, expert-level United States environmental-litigation matter;
- playable only after all local acceptance gates in this document pass.

Generic production code must not branch on any Desert Water case, stage,
action, fact, evidence, deadline, event, Inbox, task, flag, or outcome ID.

## Existing catalogue compatibility baseline

All four existing catalogue entries remain in their current relative order.
Their identities, adapters, fingerprints, traces, and public titles must not be
rewritten while adding Desert Water.

| Position | Catalogue/runtime identity | Caption | EN / RU topic | Fingerprint | Existing canonical traces |
|---:|---|---|---|---|---|
| 1 / sort 10 | case and scenario `be_commercial_failed_erp_001`; adapter `rust_scenario_v1` | Asteron Systems NV v. Northbridge Consulting BV | Failed ERP Implementation / Неудачное внедрение ERP | `ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8` | `settlement_64500` at minute 570; `judgment_preserved_after_cassation` at minute 8640; remittal returns open at minute 10080 |
| 2 / sort 20 | case and scenario `be_commercial_logistics_001`; adapter `rust_scenario_v1` | Velmont Logistics SA v. Orbis Retail Belgium NV | Unpaid Logistics Invoices / Неоплаченные логистические счета | `1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8` | `negotiated_recovery` at minute 270; `judgment_recovery` at minute 480 |
| 3 / sort 30 | case and scenario `greenfire_first_72_hours`; adapter `rust_scenario_v1` | Port Haven Environmental Authority v. GreenFire Industrial Solutions B.V. | The First 72 Hours / Первые 72 часа | `b585c95424169d72ac28a5d925a972e34464809a88b6a69216b88f5c65f82261` | `protected_crisis_position` at minute 4440; `compromised_crisis_position` at minute 4590 |
| 4 / sort 40 | case `nl_food_safety_goldenshell_001`; scenario `goldenshell_recall_at_dawn`; adapter `rust_scenario_v1` | GoldenShell Producers Cooperative U.A. v. MiteGuard Services V.O.F. | Contaminated Egg Supply Chain / Загрязнение цепочки поставок яиц | `7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4` | `coordinated_claim_position` at minute 4545; `fragmented_claim_position` at minute 4710 |

All four pre-existing catalogue entries are authoritative Rust scenarios. The
Failed-ERP-only pre-Desert mobile bundle was 479,920 bytes with SHA-256
`afe93194de58761fe534a1b818968bc7a2b5bd931eba597ab03a06561733baf1`.
Adding Desert Water intentionally changes that digest. The deterministic
combined five-case bundle is 620,529 bytes with SHA-256
`645bcd25b9cfa915ce9d0e3b0558e480325e5a45bfc20d7eb69144aba52cb985`.
The final Desert Water fingerprint is
`056bfa737932a81005fb8d9a78246593d1c1908308543d4bf9c5811d73201e8d`.

## Fictional premise and disclaimer

Every person, organization, place, facility, document, measurement, court,
regulator, and event in this scenario is fictional. The scenario is inspired
only by a general legal pattern of groundwater contamination litigation. It is
not a recreation of the Hinkley/PG&E litigation or the film *Erin Brockovich*.
It must not copy film dialogue, character likenesses, identifiable scenes, or
purport to state facts about a real dispute.

The simulation is not legal, medical, scientific, regulatory, or emergency
advice. Detection of chromium does not itself prove source or liability;
exposure does not itself prove individual medical causation; defensible
sampling requires chain of custody; hydrological attribution, alternative
sources, corporate notice, regulatory records, limitation, preservation, and
appeal are separate authoritative issues.

The player represents residents of the fictional Sundial Mesa community. The
residents suspect that hexavalent chromium from a cooling and compressor
facility operated by Caldera Compression & Cooling Inc. reached residential
wells. Counsel must preserve plant material, commission defensible sampling,
build a source and knowledge chain, protect limitation, prepare expert
evidence, file a claim, and preserve a remedy after an adverse judgment.

## Canonical catalogue and scenario identity

| Field | Exact value |
|---|---|
| `case_id` | `us_environmental_desert_water_001` |
| scenario `metadata.id` | `desert_water_groundwater_claim` |
| canonical fingerprint | `056bfa737932a81005fb8d9a78246593d1c1908308543d4bf9c5811d73201e8d` |
| caption | Sundial Mesa Residents Association v. Caldera Compression & Cooling Inc. |
| EN topic | Desert Water |
| RU topic | Вода пустыни |
| EN short title | Desert Water |
| RU short title | Вода пустыни |
| jurisdiction | `US` |
| jurisdiction pack version | `0.1.0`; metadata only, with no new jurisdiction mechanics |
| practice area | `environmental_litigation` |
| difficulty | `expert` |
| player client ID | `sundial_mesa_residents_association` |
| player role | claimant residents' counsel |
| sort order | `50` |
| seed | `20260804` |
| runtime adapter | `rust_scenario_v1` |
| scenario schema version | `1.0` |
| content version | `0.1.0` |
| clock | `{ "mode": "foreground" }` |

EN synopsis:

> Residents of Sundial Mesa suspect that hexavalent chromium from Caldera's
> cooling and compressor facility reached their wells. Counsel must preserve
> records, build a defensible sampling and hydrological chain, distinguish
> exposure from individual medical causation, protect filing deadlines, and
> keep an adverse judgment open for appeal before explicitly closing the
> matter.

RU synopsis:

> Жители Сандиал-Месы подозревают, что шестивалентный хром с объекта Caldera,
> использующего системы охлаждения и компрессоры, попал в их скважины. Юрист
> должен сохранить документы, выстроить надёжную цепочку отбора проб и
> гидрогеологического подтверждения источника, отделить факт воздействия от
> индивидуальной медицинской причинности, соблюсти сроки подачи и сохранить
> право на апелляцию после неблагоприятного решения до явного закрытия дела.

The spelling `Sundial Mesa` and all corporate names remain stable proper names
in both locales. The production RU copy must use a consistent transliteration
where a translated grammatical form is required.

Legal issues, in display order:

1. groundwater contamination and source attribution;
2. defensible sampling and chain of custody;
3. facility use, disposal records, and corporate notice;
4. exposure chronology versus individual medical causation;
5. preservation, limitation, claim-filing, and appeal deadlines;
6. first-instance judgment, appellate remedy, and explicit closure.

## Parties and actors

Exactly nine actors are authored with existing `ActorRole` values.

| Stable actor ID | Role | EN name | RU name/function |
|---|---|---|---|
| `player_lawyer` | `player` | Player | Игрок; юрист жителей |
| `sundial_mesa_residents_association` | `client` | Sundial Mesa Residents Association | Ассоциация жителей Сандиал-Месы; клиент-истец |
| `caldera_compression_and_cooling` | `opposing_party` | Caldera Compression & Cooling Inc. | Caldera Compression & Cooling Inc.; промышленный ответчик |
| `caldera_environmental_counsel` | `opposing_counsel` | Caldera Environmental Counsel | Юрист Caldera по экологическим вопросам |
| `arroyo_state_water_quality_board` | `other` | Arroyo State Water Quality Board | Совет штата Арройо по качеству воды; вымышленный регулятор |
| `arroyo_county_superior_court` | `court` | Arroyo County Superior Court | Высший суд округа Арройо; вымышленный суд |
| `dr_nia_okafor` | `expert` | Dr Nia Okafor | Доктор Ниа Окафор; независимый гидрогеолог |
| `dr_lena_ortiz` | `witness` | Dr Lena Ortiz | Доктор Лена Ортис; местный врач и свидетель хронологии воздействия |
| `caldera_operations_manager` | `witness` | Marcus Vale | Маркус Вейл; руководитель эксплуатации Caldera |

Actor descriptions are localized in the source inventory even though the
current mobile scenario overlay does not render an actor section. IDs, roles,
and order never change with locale.

## Eight procedural stages

`resolved` is the only terminal stage. Every action appears in the
`exit_actions` of every stage in which its explicit `stage_is` condition can
make it available. Stage titles are fully localized.

| Order | Stable stage ID | `StageKind` | EN title | RU title | Declared actions |
|---:|---|---|---|---|---|
| 1 | `community_intake` | `standard` | Community intake | Приём обращения жителей | `accept_residents_mandate` |
| 2 | `urgent_preservation` | `standard` | Urgent preservation | Срочное сохранение доказательств | `interview_affected_residents`; `map_wells_and_exposure_periods`; `demand_plant_record_preservation`; `commission_defensible_sampling`; `rely_on_unverified_samples`; `obtain_regulatory_records`; `prepare_incomplete_claim`; `acknowledge_time_bar_and_close` |
| 3 | `environmental_investigation` | `standard` | Environmental investigation | Экологическое расследование | `obtain_cooling_and_disposal_records`; `retain_independent_hydrogeologist`; `review_hydrological_source_assessment`; `test_alternative_source_defence`; `investigate_corporate_notice`; `protect_limitation_period`; `prepare_expert_evidence`; `prepare_incomplete_claim`; `acknowledge_time_bar_and_close` |
| 4 | `claim_preparation` | `hearing_preparation` | Claim preparation | Подготовка иска | `file_evidence_backed_claim`; `file_underdeveloped_claim`; `acknowledge_time_bar_and_close` |
| 5 | `first_instance_hearing` | `hearing` | First-instance hearing | Рассмотрение в первой инстанции | `receive_supported_first_instance_judgment`; `receive_adverse_first_instance_judgment` |
| 6 | `post_judgment_remedies` | `post_judgment` | Post-judgment remedies | Средства защиты после решения | `preserve_source_issue_for_appeal`; `file_appeal`; `waive_appeal_and_close`; `close_after_appeal_expiry` |
| 7 | `appeal` | `appeal` | Appeal | Апелляция | `receive_favorable_appeal_judgment`; `receive_adverse_appeal_judgment`; `close_after_adverse_appeal` |
| 8 | `resolved` | `resolved` | Matter resolved | Дело завершено | none; `terminal: true` |

No runtime code may infer lifecycle from these IDs or titles. Lifecycle is
derived only from `StageKind` and terminality.

## Ten authoritative facts

The first two facts are visible at minute 0. The other eight start as
`unknown` and are absent from the nested Dossier until a declarative effect
changes their authoritative status.

| Stable fact ID | Initial status | EN statement | RU statement |
|---|---|---|---|
| `community_reports_shared_exposure` | `alleged` | Residents report a shared pattern of well-water exposure and related symptoms. | Жители сообщают об общей картине воздействия воды из скважин и связанных симптомов. |
| `medical_causation_requires_individual_proof` | `admitted` | Individual medical causation requires proof beyond community exposure alone. | Индивидуальная медицинская причинность требует доказательств помимо одного лишь воздействия на сообщество. |
| `chromium_detected_in_residential_wells` | `unknown` | Testing detected hexavalent chromium in identified residential wells. | Исследование выявило шестивалентный хром в указанных жилых скважинах. |
| `sampling_chain_is_defensible` | `unknown` | The sampling chain of custody is sufficiently documented and defensible. | Цепочка хранения и передачи проб достаточно документирована и может быть защищена в процессе. |
| `facility_used_chromium_treatment` | `unknown` | Caldera used chromium-based treatment in facility cooling operations. | Caldera применяла обработку на основе хрома в системе охлаждения объекта. |
| `groundwater_plume_links_facility_to_wells` | `unknown` | The groundwater plume links the Caldera facility to the affected wells. | Шлейф загрязнения грунтовых вод связывает объект Caldera с затронутыми скважинами. |
| `operator_received_prior_contamination_notice` | `unknown` | Caldera received notice of possible contamination before the residents' claim. | Caldera получила уведомление о возможном загрязнении до предъявления требования жителями. |
| `no_alternative_source_explains_plume` | `unknown` | No tested alternative source adequately explains the observed plume. | Ни один проверенный альтернативный источник не объясняет наблюдаемый шлейф в достаточной степени. |
| `exposure_periods_match_affected_wells` | `unknown` | Reported exposure periods correspond to use of the affected wells. | Заявленные периоды воздействия соответствуют использованию затронутых скважин. |
| `limitation_period_is_protected` | `unknown` | The residents took an authoritative step protecting the limitation period. | Жители совершили надлежащее действие для защиты срока исковой давности. |

## Thirteen evidence items

Only `public_facility_permit` and `community_well_register` are initially
available. Every non-null English description has a non-empty RU translation.
Evidence relationships in the Dossier are restricted to facts already visible
in that same projection.

| Stable evidence ID | Kind | Initial | EN / RU title | Principal relationship |
|---|---|---:|---|---|
| `public_facility_permit` | `contract` | yes | Public facility permit / Публичное разрешение на эксплуатацию объекта | facility identity and permitted cooling activity; does not itself prove chromium use |
| `community_well_register` | `document` | yes | Community well register / Реестр скважин сообщества | `community_reports_shared_exposure` |
| `resident_exposure_interviews` | `witness_statement` | no | Resident exposure interviews / Интервью с жителями о воздействии | `community_reports_shared_exposure`; `exposure_periods_match_affected_wells` |
| `well_exposure_timeline` | `document` | no | Well and exposure timeline / Хронология скважин и воздействия | `exposure_periods_match_affected_wells` |
| `sampling_chain_record` | `document` | no | Sampling chain-of-custody record / Документ о цепочке хранения проб | `sampling_chain_is_defensible` |
| `independent_lab_results` | `expert_report` | no | Independent laboratory results / Результаты независимой лаборатории | `chromium_detected_in_residential_wells`; does not itself prove source |
| `regulatory_monitoring_records` | `system_record` | no | Regulatory monitoring records / Записи регуляторного мониторинга | `facility_used_chromium_treatment`; `operator_received_prior_contamination_notice` |
| `cooling_treatment_logs` | `system_record` | no | Cooling-treatment logs / Журналы обработки системы охлаждения | `facility_used_chromium_treatment` |
| `disposal_and_compressor_records` | `document` | no | Disposal and compressor records / Документы об утилизации и работе компрессоров | `groundwater_plume_links_facility_to_wells` |
| `hydrogeology_source_assessment` | `expert_report` | no | Hydrogeological source assessment / Гидрогеологическое заключение об источнике | `groundwater_plume_links_facility_to_wells`; visible only after task review |
| `alternative_source_assessment` | `expert_report` | no | Alternative-source assessment / Заключение об альтернативных источниках | `no_alternative_source_explains_plume` |
| `internal_notice_correspondence` | `email` | no | Internal contamination-notice correspondence / Внутренняя переписка об уведомлении о загрязнении | `operator_received_prior_contamination_notice` |
| `limitation_protection_filing` | `document` | no | Limitation-protection filing / Документ о защите срока исковой давности | `limitation_period_is_protected` |

Production descriptions must state the limited probative purpose shown in the
last column and must not overstate medical causation.

## Visibility and Dossier matrix

Hidden entities are absent, not marked hidden. The nested Dossier must not
serialize their stable IDs, EN/RU display text, relationship edges, placeholder
rows, counts, or future outcome selection.

| Checkpoint | Authoritative position | Facts allowed | Evidence allowed | Mandatory absence |
|---|---|---|---|---|
| `DW-0` minute 0 | `community_intake`; active; no decision or outcome | `community_reports_shared_exposure`; `medical_causation_requires_individual_proof` | `community_well_register`; `public_facility_permit` | all other fact/evidence IDs and texts; private flags; future events; outcomes |
| `DW-1A` after `commission_defensible_sampling` | urgent preservation; sampling deadline completed | DW-0 plus `chromium_detected_in_residential_wells=proven`, `sampling_chain_is_defensible=proven` | DW-0 plus `independent_lab_results`, `sampling_chain_record` | all source, notice, limitation, and future-report items |
| `DW-1B` after `rely_on_unverified_samples` | urgent preservation; risky sampling choice | DW-0 plus `chromium_detected_in_residential_wells=alleged`, `sampling_chain_is_defensible=disputed` | DW-0 plus `independent_lab_results`; no chain record | source, notice, limitation, future report, and terminal outcome |
| `DW-2` after interviews and well mapping | investigation record developing | prior visible facts plus `exposure_periods_match_affected_wells` at its authored status | prior evidence plus `resident_exposure_interviews`, `well_exposure_timeline` | source and corporate-notice conclusions not yet revealed |
| `DW-3` task ready but unreviewed | `independent_hydrogeology_assessment=ready` | unchanged from preceding state | `hydrogeology_source_assessment` absent | report ID/title/description and report-derived relationship edges |
| `DW-4` after `review_hydrological_source_assessment` | claim preparation can proceed | `groundwater_plume_links_facility_to_wells` becomes visible at authored status | `hydrogeology_source_assessment` becomes available exactly once | no hidden corporate-notice or alternative-source item unless its own action ran |
| `DW-5` adverse first judgment | `lost`; `first_instance`; `post_judgment`; not closed | path-visible facts only | path-available evidence only | outcome absent; unperformed investigation absent |
| `DW-5R` adverse first judgment with appeal open | appeal deadline open and `file_appeal` immediately available | same as DW-5 | same as DW-5 | no closure or terminal outcome; Dossier status `recoverable` |
| `DW-6` appeal filed | lifecycle `appeal`; first-instance loss remains until later judgment | path-visible only | path-available only | completed appeal deadline exposes no deadline remedy |
| `DW-7A` favorable closure | `won`; decision instance `appeal`; closed | coordinated visible set | coordinated available set | only `credible_source_and_remedy` visible |
| `DW-7B` adverse appeal before closure | `lost`; decision instance `appeal`; lifecycle `appeal`; not closed | compromised visible set | compromised available set | no outcome until `close_after_adverse_appeal` |
| `DW-8` explicit compromised closure | closed | path-visible only | path-available only | only `compromised_claim_closed` visible |

The current generic top-level snapshot still enumerates definition-backed
fact/evidence state for aggregate presentation. Desert Water must use only the
nested authoritative Dossier for fact/evidence details. If any active screen
shows a hidden Desert entity or text from a legacy top-level array, stop and
open a separate generic Snapshot Visibility Hardening checkpoint; never add a
case-specific filter.

## Condition and effect rules

Only existing schema predicates and effects may be used: `stage_is`,
`flag_equals`, fact/evidence/deadline/task/Inbox predicates, judicial-result
predicates, and `all`/`any`/`not`; plus existing set-stage/flag/fact,
make-evidence, task, deadline, Inbox, judicial-result, event, and outcome
effects.

The content uses explicit mutual-exclusion flags including
`sampling_choice_made`, `claim_preparation_choice_made`, `claim_filed`,
`first_instance_decision_received`, `appeal_filed`, and
`appeal_decision_received`. It must not rely on an unsupported time predicate
or arbitrary expression.

Every judicial action applies `SetJudicialResult` while still in the stage that
owns the decision instance. It then records the hearing/appeal event and leaves
the stage. `ResolveOutcome` occurs only after `SetStage resolved` and is the
last substantive effect. An adverse judgment never resolves an outcome.

## Twenty-seven actions

All actions have a positive, non-zero EUR cost. EN/RU titles and descriptions
are both mandatory. The following time and cost matrix is exact.

| # | Stable action ID | Minutes | EUR | EN title / RU title |
|---:|---|---:|---:|---|
| 1 | `accept_residents_mandate` | 30 | 750 | Accept the residents' mandate / Принять поручение жителей |
| 2 | `interview_affected_residents` | 120 | 2400 | Interview affected residents / Опросить пострадавших жителей |
| 3 | `map_wells_and_exposure_periods` | 90 | 2200 | Map wells and exposure periods / Сопоставить скважины и периоды воздействия |
| 4 | `demand_plant_record_preservation` | 60 | 1600 | Demand preservation of plant records / Потребовать сохранения документов объекта |
| 5 | `commission_defensible_sampling` | 120 | 8500 | Commission defensible sampling / Организовать надлежащий отбор проб |
| 6 | `rely_on_unverified_samples` | 60 | 900 | Rely on unverified samples / Положиться на непроверенные пробы |
| 7 | `obtain_regulatory_records` | 90 | 1800 | Obtain regulatory records / Получить документы регулятора |
| 8 | `obtain_cooling_and_disposal_records` | 120 | 2800 | Obtain cooling and disposal records / Получить документы об охлаждении и утилизации |
| 9 | `retain_independent_hydrogeologist` | 45 | 9500 | Retain an independent hydrogeologist / Привлечь независимого гидрогеолога |
| 10 | `review_hydrological_source_assessment` | 120 | 3200 | Review the hydrological source assessment / Изучить гидрологическое заключение об источнике |
| 11 | `test_alternative_source_defence` | 90 | 4000 | Test the alternative-source defence / Проверить версию об альтернативном источнике |
| 12 | `investigate_corporate_notice` | 120 | 3500 | Investigate prior corporate notice / Проверить прежнее уведомление компании |
| 13 | `protect_limitation_period` | 60 | 1400 | Protect the limitation period / Защитить срок исковой давности |
| 14 | `prepare_expert_evidence` | 180 | 5500 | Prepare expert evidence / Подготовить экспертные доказательства |
| 15 | `prepare_incomplete_claim` | 60 | 1800 | Prepare an incomplete claim / Подготовить неполный иск |
| 16 | `file_evidence_backed_claim` | 180 | 4500 | File the evidence-backed claim / Подать иск, подкреплённый доказательствами |
| 17 | `file_underdeveloped_claim` | 120 | 3000 | File the underdeveloped claim / Подать недостаточно подготовленный иск |
| 18 | `receive_supported_first_instance_judgment` | 120 | 2500 | Receive a supported first-instance judgment / Получить обоснованное решение первой инстанции |
| 19 | `receive_adverse_first_instance_judgment` | 120 | 1800 | Receive an adverse first-instance judgment / Получить неблагоприятное решение первой инстанции |
| 20 | `preserve_source_issue_for_appeal` | 180 | 4200 | Preserve the source issue for appeal / Сохранить вопрос об источнике для апелляции |
| 21 | `file_appeal` | 120 | 5000 | File the appeal / Подать апелляцию |
| 22 | `waive_appeal_and_close` | 30 | 900 | Waive appeal and close / Отказаться от апелляции и закрыть дело |
| 23 | `receive_favorable_appeal_judgment` | 180 | 6500 | Receive a favorable appeal judgment / Получить благоприятное решение апелляции |
| 24 | `receive_adverse_appeal_judgment` | 180 | 6500 | Receive an adverse appeal judgment / Получить неблагоприятное решение апелляции |
| 25 | `close_after_adverse_appeal` | 30 | 1200 | Close after the adverse appeal / Закрыть дело после неблагоприятной апелляции |
| 26 | `close_after_appeal_expiry` | 30 | 900 | Close after appeal expiry / Закрыть дело после истечения срока апелляции |
| 27 | `acknowledge_time_bar_and_close` | 30 | 600 | Acknowledge the time bar and close / Признать пропуск срока и закрыть дело |

Every action description must explain its strategic consequence without
revealing unavailable effects. The RU overlay must contain all 27 titles and
all 27 descriptions; an omitted field would silently fall back to English and
is therefore a failed localization gate.

### Prerequisites and authoritative effects

The table uses concise names for existing schema conditions/effects; the JSON
uses their exact schema-v1 representations.

| Action | Required availability | Authoritative effects |
|---|---|---|
| `accept_residents_mandate` | `stage=community_intake` | set `mandate_accepted`; resolve `community_intake_request`; trigger `mandate_accepted`; set stage `urgent_preservation` |
| `interview_affected_residents` | `stage=urgent_preservation`; not previously interviewed | make `resident_exposure_interviews` available; set `community_reports_shared_exposure=alleged`; reveal `exposure_periods_match_affected_wells=alleged`; set `residents_interviewed` |
| `map_wells_and_exposure_periods` | `stage=urgent_preservation`; residents interviewed; not previously mapped | make `well_exposure_timeline` available; set `exposure_periods_match_affected_wells=disputed`; set `well_timeline_mapped` |
| `demand_plant_record_preservation` | `stage=urgent_preservation`; `plant_record_preservation_deadline=open` | set `plant_preservation_demanded`; complete deadline; resolve warning; trigger `operator_preservation_response_received` |
| `commission_defensible_sampling` | `stage=urgent_preservation`; `sampling_chain_deadline=open`; `sampling_choice_made=false` | set sampling choice/defensible flags; complete deadline; resolve warning; make `sampling_chain_record` and `independent_lab_results` available; set chromium and chain facts `proven` |
| `rely_on_unverified_samples` | same stage/open deadline; `sampling_choice_made=false` | set sampling choice and `unverified_sampling_relied_on`; complete deadline; resolve warning; make only `independent_lab_results` available; set chromium `alleged`, chain `disputed` |
| `obtain_regulatory_records` | `stage=urgent_preservation`; mandate accepted; a sampling choice made | make `regulatory_monitoring_records` available; reveal facility use and prior notice as `alleged`; set `regulatory_records_obtained`; set stage `environmental_investigation` |
| `obtain_cooling_and_disposal_records` | `stage=environmental_investigation`; plant demand made | make `cooling_treatment_logs` and `disposal_and_compressor_records` available; set facility use `proven`; set `plant_records_obtained` |
| `retain_independent_hydrogeologist` | `stage=environmental_investigation`; task `not_started`; defensible sampling commissioned | set `hydrogeologist_retained`; start `independent_hydrogeology_assessment` |
| `review_hydrological_source_assessment` | `stage=environmental_investigation`; task `ready` | review task; resolve ready Inbox; make `hydrogeology_source_assessment` available; reveal plume link as `proven`; set `hydro_assessment_reviewed` |
| `test_alternative_source_defence` | `stage=environmental_investigation`; regulatory and plant records available | make `alternative_source_assessment` available; set no-alternative-source fact `proven`; resolve `operator_source_denial`; set `alternative_source_tested` |
| `investigate_corporate_notice` | `stage=environmental_investigation`; regulatory and plant records obtained | make `internal_notice_correspondence` available; set prior-notice fact `proven`; set `corporate_notice_investigated` |
| `protect_limitation_period` | `stage=environmental_investigation`; limitation deadline `open` | make `limitation_protection_filing` available; set limitation fact `proven`; complete deadline; resolve warning; set `limitation_period_protected` |
| `prepare_expert_evidence` | `stage=environmental_investigation`; hydro task reviewed; defensible sampling, well timeline, plant records, alternative-source test, and limitation protected | set `expert_evidence_prepared` and preparation choice; confirm only already revealed fact statuses; set stage `claim_preparation` |
| `prepare_incomplete_claim` | `stage` is urgent preservation or environmental investigation; limitation missed; no preparation choice | set `incomplete_claim_prepared` and preparation choice; set stage `claim_preparation`; reveal nothing new |
| `file_evidence_backed_claim` | `stage=claim_preparation`; expert evidence prepared; claim deadline `open`; `claim_filed=false` | set claim filed/evidence-backed flags; complete claim deadline; resolve claim-window Inbox; trigger `first_instance_hearing_scheduled` |
| `file_underdeveloped_claim` | `stage=claim_preparation`; incomplete claim prepared; (`limitation_protection_deadline=missed` OR `claim_filing_deadline=open`); `claim_filed=false` | set claim filed/underdeveloped flags; resolve the claim-window Inbox if present; trigger `first_instance_hearing_scheduled`; do not complete the protected claim deadline (it remains inactive on the canonical compromised path) |
| `receive_supported_first_instance_judgment` | `stage=first_instance_hearing`; evidence-backed claim and expert evidence; hydro task `reviewed`; all active deadlines closed; `first_instance_decision_received=false` | set `first_instance_decision_received=true` and `supported_first_instance_closure=true`; set judicial result `won` while still in hearing; trigger favorable hearing-closed event, whose direct effects close remaining required Inbox state, create the closure report, set stage `resolved`, and resolve `credible_source_and_remedy` last |
| `receive_adverse_first_instance_judgment` | `stage=first_instance_hearing`; claim filed; `first_instance_decision_received=false` | set `first_instance_decision_received=true` and `adverse_first_instance_received=true`; set judicial result `lost` while still in hearing; trigger adverse hearing-closed event, whose direct effects set stage `post_judgment_remedies`, activate the appeal deadline, and create the adverse-judgment Inbox; no outcome |
| `preserve_source_issue_for_appeal` | `stage=post_judgment_remedies`; first-instance loss; appeal deadline open | set `source_issue_preserved_for_appeal`; no stage/result/outcome change |
| `file_appeal` | `stage=post_judgment_remedies`; adverse first-instance flag and Rust-owned loss; appeal deadline `open`; `appeal_filed=false` | set `appeal_filed=true`; complete appeal deadline; resolve adverse-judgment Inbox; trigger `appeal_filed`; that event, not the action, creates the appeal-hearing Inbox and sets stage `appeal` |
| `waive_appeal_and_close` | `stage=post_judgment_remedies`; first-instance loss; appeal deadline `open` | complete appeal deadline; set `appeal_waived=true`; trigger `matter_closed`, whose direct effects terminalize the compromised path; preserve prior judicial result/instance |
| `receive_favorable_appeal_judgment` | `stage=appeal`; appeal filed; source issue preserved; expert evidence and source chain complete; `appeal_decision_received=false` | set `appeal_decision_received=true` and `favorable_appeal_closure=true`; set judicial result `won` while still in appeal; trigger favorable appeal event, whose direct effects close required Inbox state, create the closure report, set stage `resolved`, and resolve the credible outcome last |
| `receive_adverse_appeal_judgment` | `stage=appeal`; appeal filed; `appeal_decision_received=false` | set `appeal_decision_received=true` and `adverse_appeal_received=true`; set judicial result `lost` while still in appeal; resolve appeal-hearing Inbox; trigger adverse appeal event; remain in `appeal`; no outcome |
| `close_after_adverse_appeal` | `stage=appeal`; `adverse_appeal_received=true`; not closed | set `adverse_appeal_closed=true`; trigger `matter_closed`, whose direct effects terminalize the compromised path; preserve appeal decision instance |
| `close_after_appeal_expiry` | `stage=post_judgment_remedies`; appeal deadline `missed`; first-instance loss | set `appeal_expiry_closed=true`; trigger `matter_closed`, whose direct effects terminalize the compromised path |
| `acknowledge_time_bar_and_close` | `stage` urgent preservation, environmental investigation, or claim preparation; `claim_filed=false`; (`limitation_protection_deadline=missed` OR `claim_filing_deadline=missed`); each of the sampling, plant-preservation, and limitation deadlines is either `completed` or `missed` | set `time_bar_closed=true`; trigger `matter_closed`, whose direct effects terminalize the compromised path; do not fabricate a judicial result |

The two sampling actions, two preparation actions, filing actions, decision
actions, and closure actions are mutually exclusive through flags and their
conditions. Every terminal transition makes all still-active deadline/task and
action-required Inbox state non-actionable before resolving the outcome. A
terminal action or event must carry explicit closed-state guards and/or direct
closure effects sufficient for the static terminal validator; it must not rely
only on state established by an earlier command or on an implicit runtime
boundary. In particular, each terminalizing condition proves every
start-active deadline completed or missed (or the same transition closes it),
the dedicated favorable events directly resolve every action-required Inbox
item, while `matter_closed` owns the complete compromised terminal transition.
The conditional after-event task-expiry event gives the compromised static
chain an explicit task terminalization path while preserving already reviewed
work at runtime.

## Five deadlines

Authored `ScenarioTime.day` is zero-based and `minute_of_day` is always within
0–1439. Absolute minute is `day * 1440 + minute_of_day`.

| Stable deadline ID | Day | Minute of day | Absolute | Activation | Completion action(s) | Miss event |
|---|---:|---:|---:|---|---|---|
| `sampling_chain_deadline` | 0 | 360 | 360 | active at start | `commission_defensible_sampling`; `rely_on_unverified_samples` | `sampling_chain_missed` |
| `plant_record_preservation_deadline` | 0 | 720 | 720 | active at start | `demand_plant_record_preservation` | `plant_record_preservation_missed` |
| `limitation_protection_deadline` | 1 | 0 | 1440 | active at start | `protect_limitation_period` | `limitation_protection_missed` |
| `claim_filing_deadline` | 3 | 0 | 4320 | activated only by `claim_window_opened`, whose condition requires limitation protection | `file_evidence_backed_claim` | `claim_filing_missed` |
| `appeal_deadline` | 5 | 0 | 7200 | activated by `adverse_first_instance_judgment_delivered` | `file_appeal` | `appeal_missed` |

`claim_window_opened` is scheduled for day 2, minute 0 (absolute minute 2880)
and fires only when `limitation_period_protected=true`. Thus the protected path
gets an open claim-filing deadline and Inbox instruction. On the compromised
path the same clock boundary is processed, but the event condition fails and
the inactive deadline is not falsely opened. The underdeveloped filing remains
representable after an already missed limitation deadline through its own
supported condition.

Each `*_missed` event is owned by its deadline, applies `MissDeadline` to that
same deadline, sets a same-purpose risk flag, and expires/resolves its warning
Inbox through the existing event relationship. Loss alone neither misses the
appeal deadline nor closes the matter.

The open `appeal_deadline` lists `file_appeal` as its executable completion
action, making the adverse first-instance Dossier `recoverable`.
`waive_appeal_and_close` explicitly completes the open deadline as part of
closure but is not advertised as the appellate remedy.

## Independent hydrogeology task

Exactly one asynchronous task is authored.

| Field | Exact value |
|---|---|
| ID | `independent_hydrogeology_assessment` |
| EN title | Independent hydrogeology assessment |
| RU title | Независимое гидрогеологическое исследование |
| start action | `retain_independent_hydrogeologist` |
| duration | 720 minutes |
| completion event | `hydrogeology_assessment_completed` |
| usable-until event | `matter_closed` |
| expiry event | `hydrogeology_assessment_expired` |
| review action | `review_hydrological_source_assessment` |

`retain_independent_hydrogeologist` explicitly applies `StartAsyncTask`.
At the due boundary, the `AsyncTaskCompleted` event explicitly applies
`MarkAsyncTaskReady` and creates `hydrogeology_assessment_ready`. Readiness
does not reveal the report or derived facts. Review requires `ready`, applies
`ReviewAsyncTask`, then reveals the report and intended source fact exactly
once. The event-owned `matter_closed` boundary queues
`hydrogeology_assessment_expired` for a task that is still not started, in
progress, or ready. That expiry event is also declaratively triggered
`after_event matter_closed` and has an `any` condition limited to those three
unfinished statuses. This makes task closure explicit to static transition
analysis without changing a reviewed task to expired at runtime. Duplicate
queueing is harmless because fired event IDs are processed once. No independent
Flutter state or second task clock exists.

## Events

The scenario uses these declarative events. Titles are localized; stable IDs,
triggers, conditions, and effects are locale-independent.

| Stable event ID | Kind/trigger | EN / RU title | Authoritative purpose |
|---|---|---|---|
| `mandate_accepted` | `generic`, by effect | Residents' mandate accepted / Поручение жителей принято | records the opening transition; no hidden disclosure |
| `operator_preservation_response_received` | `generic`, by effect | Operator responds to preservation demand / Оператор ответил на требование о сохранении | creates `operator_source_denial` |
| `claim_window_opened` | `at_time` day 2, 00:00; limitation-protected condition | Protected claim window opened / Открыто защищённое окно подачи иска | activates claim deadline and creates `claim_window_instruction` |
| `sampling_chain_missed` | `deadline_missed` | Sampling deadline missed / Пропущен срок надлежащего отбора проб | misses sampling deadline; sets risk flag |
| `plant_record_preservation_missed` | `deadline_missed` | Plant-record preservation deadline missed / Пропущен срок сохранения документов объекта | misses plant deadline; sets risk flag |
| `limitation_protection_missed` | `deadline_missed` | Limitation-protection deadline missed / Пропущен срок защиты исковой давности | misses limitation deadline; sets risk flag |
| `claim_filing_missed` | `deadline_missed` | Claim-filing deadline missed / Пропущен срок подачи иска | misses activated claim deadline; sets risk flag |
| `appeal_missed` | `deadline_missed` | Appeal deadline missed / Пропущен срок апелляции | misses appeal deadline; leaves matter open for explicit closure action |
| `hydrogeology_assessment_completed` | `async_task_completed` | Hydrogeology assessment ready / Гидрогеологическое исследование готово | marks task ready and creates ready Inbox; reveals no report |
| `hydrogeology_assessment_expired` | `after_event matter_closed`; task not-started/in-progress/ready condition | Hydrogeology assessment expired / Гидрогеологическое исследование утратило актуальность | expires unfinished task; no evidence reveal; reviewed work remains reviewed |
| `first_instance_hearing_scheduled` | `hearing_scheduled`, by effect | First-instance hearing scheduled / Назначено заседание первой инстанции | filing triggers this event; its direct effect sets stage `first_instance_hearing` |
| `favorable_first_instance_judgment_delivered` | `hearing_closed`, by effect | Favorable first-instance judgment delivered / Вынесено благоприятное решение первой инстанции | after the Rust-owned `won` result, its direct effects close required Inbox state, create the closure report, set stage `resolved`, and resolve the credible outcome last |
| `adverse_first_instance_judgment_delivered` | `hearing_closed`, by effect | Adverse first-instance judgment delivered / Вынесено неблагоприятное решение первой инстанции | after the Rust-owned `lost` result, its direct effects set stage `post_judgment_remedies`, activate the appeal deadline, and create the adverse-judgment Inbox |
| `appeal_filed` | `appeal`, by effect | Appeal filed / Апелляция подана | creates `appeal_hearing_instruction` and directly sets stage `appeal` |
| `favorable_appeal_judgment_delivered` | `appeal`, by effect | Favorable appeal judgment delivered / Вынесено благоприятное решение апелляции | after the Rust-owned appeal win, its direct effects close required Inbox state, create the closure report, set stage `resolved`, and resolve the credible outcome last |
| `adverse_appeal_judgment_delivered` | `appeal`, by effect | Adverse appeal judgment delivered / Вынесено неблагоприятное решение апелляции | records Rust-owned appeal loss; does not close |
| `matter_closed` | `matter_closed`, by effect; compromised closure-flag condition | Matter explicitly closed / Дело явно закрыто | owns the compromised terminal transition: resolves all action-required Inbox items, creates the closure report, sets stage `resolved`, and resolves `compromised_claim_closed` last; no hidden information |

Filing triggers a `HearingScheduled` event whose direct effects enter the
hearing. First-instance decision actions apply `SetJudicialResult` first, then
trigger a `HearingClosed` event whose direct effects leave the hearing. The
favorable hearing event owns its complete terminal transition, including
closed-state proof and final outcome resolution; the adverse event owns the
non-terminal remedies transition. `file_appeal` records and completes the
filing state, then its `appeal_filed` event owns creation of the appeal-hearing
Inbox and the stage transition into `appeal`. The favorable appeal event owns
its credible terminal transition. All four compromised closure actions only establish their
mutually exclusive closure flag (and complete an open appeal deadline where
applicable) before triggering `matter_closed`, so both authoritative runtime
and simulator process the closure/expiry event chain before the outcome becomes
terminal. Appeal judgment actions set the result while still in the appeal
stage so Rust captures `appeal`.

## Inbox contract

Exactly ten Inbox items are authored. Reading is never resolution. The first
four are initially visible. Subject and body are fully localized; bodies may
state only information visible at creation time.

| Stable Inbox ID | Visibility | Required | EN / RU subject | Resolution/expiry |
|---|---|---:|---|---|
| `community_intake_request` | initial | yes | Residents request urgent representation / Жители просят о срочном представительстве | resolve by `accept_residents_mandate` |
| `sampling_chain_warning` | initial | yes | Sampling chain must be defensible / Цепочка отбора проб должна быть надёжной | resolve by either sampling choice; expire on `sampling_chain_missed` |
| `plant_record_preservation_warning` | initial | yes | Preserve plant records immediately / Немедленно сохранить документы объекта | resolve by preservation demand; expire on plant miss |
| `limitation_review_warning` | initial | yes | Review the limitation period / Проверить срок исковой давности | resolve by protection action; expire on limitation miss |
| `operator_source_denial` | `operator_preservation_response_received` | yes | Caldera denies being the groundwater source / Caldera отрицает связь с источником загрязнения | resolve by `test_alternative_source_defence` |
| `hydrogeology_assessment_ready` | task completion | yes | Hydrogeology assessment is ready / Гидрогеологическое исследование готово | resolve by report review; expire with task |
| `claim_window_instruction` | `claim_window_opened` | yes | Protected claim-filing window is open / Открыто защищённое окно подачи иска | resolve by evidence-backed filing; expire on claim miss |
| `adverse_judgment_notice` | adverse first judgment | yes | Adverse judgment: appeal remains available / Неблагоприятное решение: апелляция доступна | resolve by appeal or waiver; expire on appeal miss |
| `appeal_hearing_instruction` | `appeal_filed` | yes | Appeal record requires a source decision / Апелляционный материал требует решения по источнику | resolve by favorable or adverse appeal judgment |
| `matter_closure_report` | metadata `created_by_event=matter_closed`; also created directly by either favorable terminal event | no | Matter closure report / Отчёт о закрытии дела | informational; already resolved/non-required |

The closure-report item's metadata names `matter_closed` for the compromised
closure chain. The favorable first-instance and favorable-appeal events do not
trigger `matter_closed`; each creates the same report directly as part of its
own credible terminal transition. Thus every terminal path creates the report
exactly once, while only compromised closure is owned by `matter_closed`.

The full localization files contain a non-empty EN and RU body for every row.
`hydrogeology_assessment_ready` may say only that work is ready; it must not
name the hidden report ID, summarize its conclusion, or reveal source facts.

## Judicial result, lifecycle, remedies, and outcomes

Judicial result and matter lifecycle are independent.

| Transition | Result and Rust-owned instance | Following lifecycle | Dossier status/outcome |
|---|---|---|---|
| before judgment | none | active hearing | open; no outcome |
| `receive_supported_first_instance_judgment` | `won`, `first_instance` | closed | `credible_source_and_remedy` visible only after explicit combined closure effects |
| `receive_adverse_first_instance_judgment` | `lost`, `first_instance` | `post_judgment` | recoverable; appeal deadline open; no outcome |
| `preserve_source_issue_for_appeal` | unchanged loss/first instance | `post_judgment` | recoverable; no outcome |
| `file_appeal` | unchanged loss/first instance | `appeal` | open; appeal deadline completed; no outcome |
| `receive_favorable_appeal_judgment` | `won`, `appeal` | closed | credible outcome visible after closure |
| `receive_adverse_appeal_judgment` | `lost`, `appeal` | appeal and not closed | open; no outcome; closure action remains |
| waiver, expiry closure, or adverse-appeal closure | prior result and instance preserved | closed | compromised outcome becomes visible |
| `acknowledge_time_bar_and_close` | no fabricated judicial result | closed | compromised outcome becomes visible |

The supported first-instance and favorable appeal actions are deliberately
combined judgment-and-explicit-close commands within the fixed 27-action
inventory. In both, result ownership is recorded before the resolved-stage
transition. Adverse decisions are never combined with closure.

Exactly two outcomes are authored, both with terminal stage `resolved`.

| Stable outcome ID | Judicial meaning | EN / RU title | Mutually exclusive resolution condition |
|---|---|---|---|
| `credible_source_and_remedy` | won | Credible source and remedy / Доказанный источник и эффективная защита | `stage=resolved` and either `supported_first_instance_closure=true` or `favorable_appeal_closure=true` |
| `compromised_claim_closed` | lost or dismissed procedural position | Compromised claim closed / Ослабленный иск закрыт | `stage=resolved` and exactly one of `appeal_waived`, `appeal_expiry_closed`, `adverse_appeal_closed`, or `time_bar_closed` is true |

Outcome summaries are fully localized. The compromised outcome condition does
not require a fabricated judicial result for the time-bar branch. Mutual
exclusion is driven by explicit closure flags, and `ResolveOutcome` is last.

## Canonical deterministic paths

The two command files are:

- `content/traces/desert_water_coordinated.commands.json`;
- `content/traces/desert_water_compromised.commands.json`.

The following minutes are exact authored arithmetic targets. They become
verified results only after the final JSON is accepted by validator,
diagnostics, simulator, engine, bridge, and mobile tests. The implementation
must pin the simulator-produced minute; if boundary semantics produce a
different value, stop and reconcile code-free content/spec arithmetic instead
of silently claiming this target.

### Coordinated residents path — target minute 3180

| Step | Command | Minute |
|---:|---|---:|
| 1 | dispatch `accept_residents_mandate` | 30 |
| 2 | dispatch `commission_defensible_sampling` | 150 |
| 3 | dispatch `demand_plant_record_preservation` | 210 |
| 4 | dispatch `interview_affected_residents` | 330 |
| 5 | dispatch `map_wells_and_exposure_periods` | 420 |
| 6 | dispatch `obtain_regulatory_records` | 510 |
| 7 | dispatch `obtain_cooling_and_disposal_records` | 630 |
| 8 | dispatch `retain_independent_hydrogeologist` | 675 |
| 9 | dispatch `test_alternative_source_defence` | 765 |
| 10 | dispatch `investigate_corporate_notice` | 885 |
| 11 | dispatch `protect_limitation_period` | 945 |
| 12 | advance time 360 | 1305 |
| 13 | advance time 90 | 1395; hydro task reaches its 720-minute ready boundary |
| 14 | dispatch `review_hydrological_source_assessment` | 1515 |
| 15 | dispatch `prepare_expert_evidence` | 1695 |
| 16 | advance time 1185 | 2880; protected claim-window event fires |
| 17 | dispatch `file_evidence_backed_claim` | 3060 |
| 18 | dispatch `receive_supported_first_instance_judgment` | 3180 |

Target terminal state: outcome `credible_source_and_remedy`, judicial result
`won`, decision instance `first_instance`, lifecycle closed. Target action
spend is EUR 54,150. The canonical scenario fingerprint is
`056bfa737932a81005fb8d9a78246593d1c1908308543d4bf9c5811d73201e8d`;
the runtime-v2 final-state digest is
`8d9f9c5e39dcdb0dc6639d42844a3b9e5f8394702231f1d8eb0aede6be244240`.
The simulator signature contains exactly 24 ordered transitions and its
canonical fired-event set contains `mandate_accepted`,
`operator_preservation_response_received`,
`hydrogeology_assessment_completed`, `claim_window_opened`,
`first_instance_hearing_scheduled`, and
`favorable_first_instance_judgment_delivered`.

### Compromised residents path — target minute 3510

| Step | Command | Minute |
|---:|---|---:|
| 1 | dispatch `accept_residents_mandate` | 30 |
| 2 | dispatch `rely_on_unverified_samples` | 90 |
| 3 | dispatch `interview_affected_residents` | 210 |
| 4 | advance time 511 | 721; plant preservation deadline has crossed and missed |
| 5 | advance time 720 | 1441; limitation deadline has crossed and missed |
| 6 | advance time 1439 | 2880; scheduled claim-window boundary is processed but the protected event does not activate |
| 7 | dispatch `prepare_incomplete_claim` | 2940 |
| 8 | dispatch `file_underdeveloped_claim` | 3060 |
| 9 | dispatch `receive_adverse_first_instance_judgment` | 3180; lost but open/recoverable |
| 10 | dispatch `file_appeal` | 3300 |
| 11 | dispatch `receive_adverse_appeal_judgment` | 3480; appeal loss but still open |
| 12 | dispatch `close_after_adverse_appeal` | 3510 |

Target terminal state: outcome `compromised_claim_closed`, judicial result
`lost`, decision instance `appeal`, lifecycle closed. Target action spend is
EUR 23,350. At minute 3180, before filing the appeal, the Dossier must be
`recoverable`, expose the open appeal deadline and `file_appeal`, and expose no
outcome. At minute 3480 the adverse appeal still does not close the matter.
The runtime-v2 final-state digest is
`f5a08dc13bb49b879bc0e4929fbbbb08184cc4269c463eaa4ca8b1fad162c895`.
The simulator signature contains exactly 21 ordered transitions; its
canonical fired-event set includes the two missed deadlines, both adverse
judgments, `appeal_filed`, `matter_closed`, and
`hydrogeology_assessment_expired` in the exact order pinned by the simulator
test.

### Focused remedy and expiry paths

Tests also derive focused paths from the coordinated investigation state:

1. choose `receive_adverse_first_instance_judgment` instead of the supported
   judgment;
2. dispatch `preserve_source_issue_for_appeal`;
3. dispatch `file_appeal`;
4. dispatch `receive_favorable_appeal_judgment`;
5. assert `won`, instance `appeal`, credible outcome, and closure.

Separate focused tests prove:

- `waive_appeal_and_close` closes from an adverse-but-open first-instance
  state without changing the first-instance loss;
- crossing minute 7200 fires `appeal_missed`, after which
  `close_after_appeal_expiry` performs explicit closure;
- crossing the limitation boundary without protection permits
  `acknowledge_time_bar_and_close`, produces no fabricated judicial result,
  and resolves only the compromised outcome;
- dispatch and foreground time advancement after every closure return the
  existing `scenario_resolved` error and preserve the exact snapshot/Dossier.

## EN/RU localization inventory

The mobile exporter exact-set-validates stable IDs but permits missing fields
to fall back to canonical English. Desert Water therefore treats field
completeness as an explicit acceptance gate.

| Surface/section | Count | Required EN and RU fields |
|---|---:|---|
| catalogue card | 1 | `topic`, `short_title`, `synopsis`, player-client role, ordered legal issues; caption remains the stable identity caption |
| scenario metadata | 1 | `title`, `summary` |
| stages | 8 | `title` for every stable ID |
| actions | 27 | non-empty `title` and `description` for every stable ID |
| deadlines | 5 | `title` for every stable ID |
| Inbox items | 10 | non-empty `subject` and `body` for every stable ID |
| facts | 10 | `statement` for every stable ID |
| evidence | 13 | `title`; and `description` wherever canonical description is non-null |
| outcomes | 2 | `title` and `summary` for every stable ID |
| actors | 9 | localized name/description inventory retained for future surfaces; current stable IDs/roles unchanged |
| async task | 1 | localized title inventory retained; status remains authoritative enum |
| events | 17 | localized title inventory retained; IDs/triggers/effects unchanged |

Tests compare EN and RU authoritative tuples, including stage ID, clock,
lifecycle, closure, judicial result/instance, fact IDs/statuses, evidence IDs
and relations, deadline IDs/due times/statuses, remedy action IDs/cost/time, and
outcome ID. Only display strings may differ.

Selected initially hidden IDs and their EN and RU text must be absent from
Dossier mapping, Dossier widgets, Matter, Inbox, and Calendar. At minimum test:

- `groundwater_plume_links_facility_to_wells`;
- `operator_received_prior_contamination_notice`;
- `hydrogeology_source_assessment`;
- `internal_notice_correspondence`.

## Dossier checkpoints

At every checkpoint, arrays use the generic Dossier ordering: facts and
evidence by stable ID; deadlines by absolute due minute then ID; remedies by
action ID with duplicates removed.

| Checkpoint | Required projection |
|---|---|
| opening | stage `community_intake`, minute 0, active/open, no judicial result/outcome; exactly two visible fact IDs and two evidence IDs listed in DW-0 |
| after defensible sampling | sampling deadline completed; intended two facts and two evidence items added exactly once |
| hydro ready before review | task readiness may be visible in the wider snapshot, but Dossier report ID/text and derived source fact are absent |
| after hydro review | report and plume fact appear exactly once with visible-only relation edges |
| claim filing | `first_instance_hearing`; claim deadline completed only on the protected evidence-backed path |
| adverse first judgment | `lost`, `first_instance`, `post_judgment`, `is_closed=false`, outcome null, appeal deadline open, Dossier `recoverable`, remedy exactly `file_appeal` with EUR 5000 and 120 minutes |
| after save/reset/load | exact equality of stage, minute, Inbox, deadlines, lifecycle, evidence, actions, and complete Dossier; a second load remains exactly equal and all stable-ID sets remain duplicate-free |
| appeal filed | lifecycle `appeal`; appeal deadline completed; no deadline remedy; outcome null |
| adverse appeal | `lost`, `appeal`, still not closed, outcome null; explicit close action available |
| terminal closure | stage `resolved`, lifecycle/Dossier closed, no actions/remedies; exactly one authorized outcome visible |

Flutter localizes these Rust-projected stable IDs. It must not infer visibility,
truth, lifecycle, remedy, decision instance, or outcome from stage/action text.

## Persistence, bridge, and ABI invariants

Desert Water adds only a new scenario fingerprint and catalogue content. It
must not change:

- save `schema_id`: `genesis.ai-juris.command-log`;
- envelope `schema_version`: `1`;
- runtime marker: `scenario-runtime-v2`;
- the existing eight-field envelope shape;
- the v2 final-state digest projection;
- load failure atomicity;
- Dossier derivation from replayed state; Dossier is not serialized
  independently;
- C ABI version `1`;
- the exact native exports:
  `juris_mobile_bridge_execute`,
  `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`.

Existing Failed ERP, Logistics, GreenFire, and GoldenShell saves and canonical
replays must retain identical semantics and digests. Failed ERP uses the same
`scenario-runtime-v2` command-log contract; no supported legacy Dart save
format existed and no importer was added. No new export, persistence field,
compatibility marker, or scenario-specific bridge command is permitted.

## Required implementation artifacts

The four Desert implementation commits contain content, tests, generated
bundle output, and documentation following existing production templates:

- identity record for `us_environmental_desert_water_001`;
- `content/cases/desert_water_groundwater_claim.scenario.json`;
- RU scenario overlay with every stable-ID section and field listed above;
- catalogue/card EN/RU entry at sort 50;
- coordinated and compromised command files;
- diagnostics/simulator/engine/bridge/FFI tests using production content;
- generated `apps/juris-mobile/assets/case_catalog/mobile_case_bundle.json`;
- focused Flutter catalogue, localization, mapper/widget tests;
- production-native Android acceptance path.

`mobile_case_bundle.json` remains bundle version 4. The combined artifact is
620,529 bytes with SHA-256
`645bcd25b9cfa915ce9d0e3b0558e480325e5a45bfc20d7eb69144aba52cb985`.
No `apps/juris-mobile/lib/**`, engine, schema, persistence, bridge, or FFI
production change is part of Desert Water. The validator-only correction in
`d7a52d8` preserves conservative handling of ambiguous paths. The Android
build/test correction in `de7ac06` prevents a transitive Rust change from
leaving a stale ABI library in `jniLibs`; it changes no runtime semantics. If
declarative content cannot satisfy this document, stop and report the missing
generic capability before changing an engine or schema.

## Required tests and deterministic assertions

Rust/bridge/content tests must prove:

- schema parsing, validation, diagnostics, and authoring analysis are clean;
- Desert Water's stable fingerprint is deterministic and all four pre-existing
  Rust fingerprints, including Failed ERP, remain byte-exact;
- all four pre-existing catalogue identities, public EN/RU titles,
  catalogue-relative ordering, canonical traces where applicable, outcomes,
  final minutes, content, balance, costs, actions, and deadlines remain exact;
- both canonical paths produce the pinned outcomes, final minutes,
  transition/event order, decision instances, and final digests;
- identical seed and command log produce identical snapshots and Dossiers;
- initial unknown facts/evidence and selected EN/RU sentinel text/IDs are
  absent;
- each action reveals only its intended fact/evidence set;
- ready-but-unreviewed hydro work does not reveal the report;
- deadline activation, completion, exact boundary miss, and expiry are
  authoritative;
- adverse first judgment is lost but open/recoverable with the immediate Rust
  remedy `file_appeal`;
- favorable and adverse appeal decision instances are Rust-owned;
- adverse appeal remains open until explicit closure;
- terminal dispatch and time advancement are rejected;
- save/reset/load and repeated load restore exact, duplicate-free state;
- no Desert-specific generic runtime/Flutter inference exists;
- existing traces, fingerprints, save digests, runtime marker, and envelope
  remain exact;
- JSON bridge and FFI carry the additive existing Dossier without a new
  symbol;
- mobile bundle export is deterministic and pins the generated SHA-256
  `645bcd25b9cfa915ce9d0e3b0558e480325e5a45bfc20d7eb69144aba52cb985`.

Flutter tests must prove:

- bundle version 4, five exact ordered catalogue IDs, and Desert at index 4;
- Failed ERP retains its authoritative `rust_scenario_v1` adapter, Asteron
  claimant identity, fingerprint, canonical traces, and lifecycle matrix;
- Desert identity, scenario ID, sort, seed, foreground clock, readiness, and
  all-positive action costs are exact;
- RU overlay has the exact canonical stable-ID sets and every required field;
- catalogue renders EN `Desert Water` and RU `Вода пустыни`, with enabled start;
- an identical authoritative payload maps to identical EN/RU IDs, ordering,
  status, relations, remedies, lifecycle, and outcome state;
- hidden IDs are absent from mapped Dossier and hidden EN/RU text is absent
  from Dossier and all active player-facing widgets;
- no top-level fallback reconstructs Dossier truth;
- save/load remains locale-independent.

## Android API 37 acceptance

Use the repository-native integration harness with the real production bundle,
real `NativeScenarioBridgeClient`, and `ApplicationSupportGameSaveStore` on
Android 17 / API 37. Do not substitute a debug-only lifecycle fixture for the
Desert acceptance path.

The test must:

1. scroll to catalogue position 5 and select Desert Water through the
   production `CaseCatalogScreen` callback;
2. assert case `us_environmental_desert_water_001`, scenario
   `desert_water_groundwater_claim`, seed `20260804`, and foreground clock;
3. open the initial Dossier and assert its exact two fact IDs and two evidence
   IDs;
4. prove selected hidden fact/evidence IDs and EN/RU text are absent;
5. dispatch `commission_defensible_sampling` and prove only its intended
   authoritative reveal, once;
6. complete or cross a meaningful deadline and assert both snapshot and
   Dossier status/remedy;
7. follow production content to the adverse first-instance state at minute
   3180 and assert lost/first-instance/post-judgment/recoverable, no outcome,
   open appeal deadline, and remedy `file_appeal`;
8. save, reset the live session, load, and compare exact stage, minute, Inbox,
   deadlines, lifecycle, evidence, actions, and Dossier;
9. load again and prove exact equality and no duplicate stable IDs;
10. file appeal, receive the adverse appeal judgment, and prove it remains
    open;
11. explicitly close and assert `compromised_claim_closed`;
12. prove subsequent dispatch and one-minute foreground advance are rejected
    as `scenario_resolved` without changing the snapshot or Dossier.

Record emulator ID/model/API, screen size, seed, exact commands and minutes,
outcome ID, fingerprint, bundle SHA, and APK SHA. Capture catalogue and
ordinary production case-open screenshots. Lifecycle screenshots are optional
presentation evidence and never replace automated assertions.

Post-rebase combined acceptance result:

- emulator/AVD/device/API/ABI/resolution: AVD `Pixel`, device
  `emulator-5554`, model `sdk_gphone64_x86_64`, Android 17 / API 37, `x86_64`,
  1080x1920, with `boot_completed=1`;
- complete native integration total, including both Failed ERP and Desert
  Water: 7 passed, 0 failed in 5:42;
- the Failed ERP native path dispatched `run-conflict-check`,
  `request-documents`, and `future-settle`, then closed as `settlement_64500`
  at scenario minute 570;
- the production Desert path proved initial Dossier omission and the
  `commission_defensible_sampling` reveal, reset, reached lost-but-open first
  instance at minute 3180, survived save/reset/load and repeated load without
  duplicates, remained open after adverse appeal at minute 3480, explicitly
  closed as `compromised_claim_closed` at minute 3510, and rejected dispatch
  and one-minute foreground advance after closure without mutation;
- presentation evidence:
  `apps/juris-mobile/build/five-case-catalog-api37.png` and
  `apps/juris-mobile/build/desert-water-open-api37.png`; automated assertions,
  not screenshots, remain the authority for the complete lifecycle trace;
- no manual full-lifecycle screenshot replay was performed after the automated
  run, so the owner's intended ordinary session was not advanced;
- the last verified ordinary production-app PID was `17672`; at verification,
  ordinary `MainActivity` was foreground on the five-case catalogue and the
  emulator had not been closed.

## Validation gates

Before declaring local completion, run and record:

- `cargo +1.78.0 check --workspace --locked`;
- `cargo fmt --all -- --check`;
- current-toolchain `cargo check --workspace`;
- `cargo clippy --workspace --all-targets -- -D warnings`;
- `cargo test --workspace` with exact totals;
- scenario validator, diagnostics, and both deterministic trace commands;
- legacy fingerprint/trace/save-digest regression assertions;
- bridge and FFI tests;
- deterministic mobile bundle export and new SHA-256;
- Dart format check;
- `flutter analyze`;
- all Flutter tests with exact totals;
- debug APK build and SHA-256;
- full Android native integration plus focused Desert acceptance on API 37;
- `git diff --check`;
- ABI audit for `armeabi-v7a`, `arm64-v8a`, and `x86_64`, each with ABI
  version 1 and exactly the three exports above.

Final combined local measurements:

- deterministic five-case bundle: 620,529 bytes, SHA-256
  `645bcd25b9cfa915ce9d0e3b0558e480325e5a45bfc20d7eb69144aba52cb985`;
- generic terminal-event guard correction:
  `d7a52d836f4f51b9c510af38513bcb2722cbd6a2`;
- Rust 1.78 locked check, formatting, current workspace check, and Clippy with
  warnings denied passed; the full workspace ran 312 tests, all passed;
- focused Rust totals passed: engine 100, bridge 16, FFI 14, simulator 56,
  validator 49, diagnostics 28, and production catalogue integration 14;
  Failed ERP formula/economic parity remained 10/10 and the lifecycle harness
  remained 2/2 over 18 explicit paths;
- Dart format checked 49 files with 0 changes; Flutter analysis found no
  issues; the full unit/widget suite ran 133 tests, all passed;
- final debug APK:
  `apps/juris-mobile/build/app/outputs/flutter-apk/app-debug.apk`,
  187,596,640 bytes, SHA-256
  `689b95b0da9f47bbe385bad9312a74b7625ad23860c0ea63113882f1611e3053`;
- C ABI version remains 1. The exact stripped libraries packaged in the APK
  match the Gradle outputs, and `armeabi-v7a`, `arm64-v8a`, and `x86_64` each
  dynamically export exactly `juris_mobile_bridge_execute`,
  `juris_mobile_bridge_string_free`, and
  `juris_mobile_bridge_abi_version`;
- Android API 37 native integration ran 7 tests, all passed; the ordinary app
  then displayed all five cards in sort order, identified Asteron as Failed ERP
  claimant/player, opened Desert Water without bridge/asset/mapper error, and
  returned to the catalogue;
- `git diff --check` passed. The working tree is clean after the local
  documentation commit recorded by this handoff.

Separate-branch totals, APK hashes, and the earlier Desert-on-release bundle
hash are historical inputs and must not fill these combined-result fields.

Hosted iOS validation occurs only after later publication. A local Windows
checkpoint must not claim it.

Device-environment note: the API 37 AVD required one ADB server restart and a
bounded reconnect after a transient offline state. After repeated native runs,
Android also displayed one `system` ANR dialog; choosing `Wait` recovered the
ordinary app without a crash, data wipe, or skipped test. Slow AVD startup
remains an environmental risk. The complete 7/7 run and final ordinary-app
verification were performed after recovery.

## Explicit exclusions and stop conditions

This checkpoint does not add:

- Pressure & Countermove Runtime;
- Legal Theory;
- a class-member ledger;
- a damages or settlement-allocation calculator;
- an epidemiology or medical-causation simulator;
- an independent chronology or evidence state machine;
- an AI legal-advice feature;
- branding redesign or Suzerain-inspired UI;
- Snapshot Visibility Hardening inside this branch;
- a new save marker, digest field, bridge command, or C ABI export.

Stop and report rather than changing generic code if:

- schema v1 cannot express a required transition;
- a hidden Desert entity appears through an active player screen;
- an existing fingerprint, trace, or save digest changes;
- result/instance ordering cannot be represented without inference;
- exact target arithmetic disagrees with authoritative simulator boundary
  processing;
- ABI audit shows any fourth export.

The local review checkpoint has ended after implementation, deterministic
validation, Android API 37 evidence, and cumulative progress documentation.
Keep `feat/desert-water-case` unpublished and retain
`backup/desert-water-pre-failed-erp` at `44e565b22c52a4c3a3e69b2c137353b7771fcf77`.
Do not push, open a Desert Water PR, create another tag/release, modify or close
PR #4, or begin a later roadmap phase without explicit authorization.

The final local report must list all five catalogue positions with stable case
and scenario identities, EN/RU public titles, authoritative Rust fingerprints,
and canonical outcomes/final minutes where applicable.
It must show the old and new mobile-bundle SHA-256 values and explicitly prove
that the four pre-existing identities and their relative ordering did not
change.
