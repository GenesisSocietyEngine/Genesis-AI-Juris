use std::collections::BTreeSet;

use juris_engine::{ScenarioCommand, ScenarioSession};
use juris_scenario_schema::{Effect, FactStatus, ScenarioDefinition};

const FAILED_ERP: &str = include_str!("../../../content/cases/failed_erp.scenario.json");
const LOGISTICS: &str =
    include_str!("../../../content/cases/unpaid_logistics_invoices.scenario.json");
const GREENFIRE: &str =
    include_str!("../../../content/cases/greenfire_first_72_hours.scenario.json");
const GOLDENSHELL: &str =
    include_str!("../../../content/cases/goldenshell_recall_at_dawn.scenario.json");
const DESERT_WATER: &str =
    include_str!("../../../content/cases/desert_water_groundwater_claim.scenario.json");

const FAILED_ERP_SETTLEMENT: &str =
    include_str!("../../../content/traces/failed_erp_settlement.commands.json");
const FAILED_ERP_PREPARED: &str =
    include_str!("../../../content/traces/failed_erp_prepared_litigation.commands.json");
const FAILED_ERP_REMITTAL: &str =
    include_str!("../../../content/traces/failed_erp_remittal.commands.json");
const GREENFIRE_PROTECTED: &str =
    include_str!("../../../content/traces/greenfire_protected.commands.json");
const GREENFIRE_COMPROMISED: &str =
    include_str!("../../../content/traces/greenfire_compromised.commands.json");
const GOLDENSHELL_COORDINATED: &str =
    include_str!("../../../content/traces/goldenshell_coordinated.commands.json");
const GOLDENSHELL_FRAGMENTED: &str =
    include_str!("../../../content/traces/goldenshell_fragmented.commands.json");
const DESERT_WATER_COORDINATED: &str =
    include_str!("../../../content/traces/desert_water_coordinated.commands.json");
const DESERT_WATER_COMPROMISED: &str =
    include_str!("../../../content/traces/desert_water_compromised.commands.json");

const LOGISTICS_NEGOTIATED: &str = r#"[
  {"command":"dispatch","action_id":"audit_claim_file"},
  {"command":"dispatch","action_id":"issue_formal_demand"},
  {"command":"dispatch","action_id":"accept_negotiated_payment"}
]"#;
const LOGISTICS_JUDGMENT: &str = r#"[
  {"command":"dispatch","action_id":"audit_claim_file"},
  {"command":"dispatch","action_id":"issue_formal_demand"},
  {"command":"dispatch","action_id":"request_judgment"},
  {"command":"dispatch","action_id":"enforce_judgment"}
]"#;

struct CanonicalCase {
    name: &'static str,
    definition: &'static str,
    seed: u64,
    commands: &'static str,
    fingerprint: &'static str,
    outcome: Option<&'static str>,
    final_minutes: u64,
    digest: &'static str,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct PlayerVisibility {
    facts: BTreeSet<String>,
    evidence: BTreeSet<String>,
    deadlines: BTreeSet<String>,
    inbox: BTreeSet<String>,
}

impl PlayerVisibility {
    fn count(&self) -> usize {
        self.facts.len() + self.evidence.len() + self.deadlines.len() + self.inbox.len()
    }

    fn assert_monotonic_from(&self, previous: &Self, case_name: &str) {
        assert!(
            previous.facts.is_subset(&self.facts),
            "{case_name} hid a previously revealed fact"
        );
        assert!(
            previous.evidence.is_subset(&self.evidence),
            "{case_name} hid previously available evidence"
        );
        assert!(
            previous.deadlines.is_subset(&self.deadlines),
            "{case_name} hid a previously activated deadline"
        );
        assert!(
            previous.inbox.is_subset(&self.inbox),
            "{case_name} hid a previously created inbox item"
        );
    }

    fn extend_from(&mut self, other: &Self) {
        self.facts.extend(other.facts.iter().cloned());
        self.evidence.extend(other.evidence.iter().cloned());
        self.deadlines.extend(other.deadlines.iter().cloned());
        self.inbox.extend(other.inbox.iter().cloned());
    }

    fn visible_subset(&self, governed: &Self) -> Self {
        Self {
            facts: self.facts.intersection(&governed.facts).cloned().collect(),
            evidence: self
                .evidence
                .intersection(&governed.evidence)
                .cloned()
                .collect(),
            deadlines: self
                .deadlines
                .intersection(&governed.deadlines)
                .cloned()
                .collect(),
            inbox: self.inbox.intersection(&governed.inbox).cloned().collect(),
        }
    }

    fn difference(&self, other: &Self) -> Self {
        Self {
            facts: self.facts.difference(&other.facts).cloned().collect(),
            evidence: self.evidence.difference(&other.evidence).cloned().collect(),
            deadlines: self
                .deadlines
                .difference(&other.deadlines)
                .cloned()
                .collect(),
            inbox: self.inbox.difference(&other.inbox).cloned().collect(),
        }
    }

    fn assert_disjoint(&self, other: &Self, case_name: &str) {
        assert!(
            self.facts.is_disjoint(&other.facts),
            "{case_name} exposed an initially unknown fact"
        );
        assert!(
            self.evidence.is_disjoint(&other.evidence),
            "{case_name} exposed initially unavailable evidence"
        );
        assert!(
            self.deadlines.is_disjoint(&other.deadlines),
            "{case_name} exposed an inactive deadline"
        );
        assert!(
            self.inbox.is_disjoint(&other.inbox),
            "{case_name} exposed an event-created inbox item"
        );
    }
}

fn initially_hidden_visibility(definition: &ScenarioDefinition) -> PlayerVisibility {
    PlayerVisibility {
        facts: definition
            .facts
            .iter()
            .filter(|fact| fact.initial_status == FactStatus::Unknown)
            .map(|fact| fact.id.as_str().to_owned())
            .collect(),
        evidence: definition
            .evidence
            .iter()
            .filter(|evidence| !evidence.initially_available)
            .map(|evidence| evidence.id.as_str().to_owned())
            .collect(),
        deadlines: definition
            .deadlines
            .iter()
            .filter(|deadline| deadline.activation_event.is_some())
            .map(|deadline| deadline.id.as_str().to_owned())
            .collect(),
        inbox: definition
            .inbox_items
            .iter()
            .filter(|item| !item.initially_visible && item.created_by_event.is_some())
            .map(|item| item.id.as_str().to_owned())
            .collect(),
    }
}

fn governed_visibility(definition: &ScenarioDefinition) -> PlayerVisibility {
    let effects = definition
        .actions
        .iter()
        .flat_map(|action| action.effects.iter())
        .chain(
            definition
                .events
                .iter()
                .flat_map(|event| event.effects.iter()),
        )
        .chain(
            definition
                .deterministic_decisions
                .iter()
                .flat_map(|decision| &decision.branches)
                .flat_map(|branch| branch.effects.iter()),
        )
        .collect::<Vec<_>>();
    let revealed_fact_ids = effects
        .iter()
        .filter_map(|effect| match effect {
            Effect::SetFactStatus { fact, status } if *status != FactStatus::Unknown => {
                Some(fact.as_str().to_owned())
            }
            _ => None,
        })
        .collect::<BTreeSet<_>>();
    let revealed_evidence_ids = effects
        .iter()
        .filter_map(|effect| match effect {
            Effect::MakeEvidenceAvailable { evidence } => Some(evidence.as_str().to_owned()),
            _ => None,
        })
        .collect::<BTreeSet<_>>();

    PlayerVisibility {
        facts: definition
            .facts
            .iter()
            .filter(|fact| {
                fact.initial_status == FactStatus::Unknown
                    && revealed_fact_ids.contains(fact.id.as_str())
            })
            .map(|fact| fact.id.as_str().to_owned())
            .collect(),
        evidence: definition
            .evidence
            .iter()
            .filter(|evidence| {
                !evidence.initially_available
                    && revealed_evidence_ids.contains(evidence.id.as_str())
            })
            .map(|evidence| evidence.id.as_str().to_owned())
            .collect(),
        deadlines: definition
            .deadlines
            .iter()
            .filter(|deadline| deadline.activation_event.is_some())
            .map(|deadline| deadline.id.as_str().to_owned())
            .collect(),
        inbox: definition
            .inbox_items
            .iter()
            .filter(|item| !item.initially_visible && item.created_by_event.is_some())
            .map(|item| item.id.as_str().to_owned())
            .collect(),
    }
}

fn parse_definition(encoded: &str) -> ScenarioDefinition {
    serde_json::from_str(encoded).expect("production scenario must deserialize")
}

fn parse_commands(encoded: &str) -> Vec<ScenarioCommand> {
    serde_json::from_str(encoded).expect("canonical trace must deserialize")
}

fn assert_player_projection(
    session: &ScenarioSession,
    definition: &ScenarioDefinition,
) -> PlayerVisibility {
    let snapshot = session.snapshot();
    let encoded = serde_json::to_string(&snapshot).unwrap();
    let value = serde_json::to_value(&snapshot).unwrap();
    let object = value.as_object().unwrap();

    assert!(!object.contains_key("actors"));
    assert!(!object.contains_key("async_tasks"));
    assert_eq!(
        object.contains_key("training_debrief"),
        snapshot.resolved_outcome.is_some()
    );
    assert!(snapshot.flags.is_empty());
    assert!(snapshot.fired_event_ids.is_empty());

    let visible_fact_ids = snapshot
        .facts
        .iter()
        .map(|fact| fact.id.as_str())
        .collect::<BTreeSet<_>>();
    let dossier_fact_ids = snapshot
        .dossier
        .facts
        .iter()
        .map(|fact| fact.id.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(visible_fact_ids, dossier_fact_ids);
    assert_eq!(visible_fact_ids.len(), snapshot.facts.len());
    assert!(snapshot.facts.iter().all(|fact| fact.status != "unknown"));
    assert_eq!(
        snapshot
            .facts
            .iter()
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>(),
        definition
            .facts
            .iter()
            .filter(|fact| visible_fact_ids.contains(fact.id.as_str()))
            .map(|fact| fact.id.as_str())
            .collect::<Vec<_>>()
    );

    let visible_evidence_ids = snapshot
        .evidence
        .iter()
        .map(|evidence| evidence.id.as_str())
        .collect::<BTreeSet<_>>();
    let dossier_evidence_ids = snapshot
        .dossier
        .evidence
        .iter()
        .map(|evidence| evidence.id.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(visible_evidence_ids, dossier_evidence_ids);
    assert_eq!(visible_evidence_ids.len(), snapshot.evidence.len());
    assert!(snapshot.evidence.iter().all(|evidence| evidence.available));
    assert_eq!(
        snapshot
            .evidence
            .iter()
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>(),
        definition
            .evidence
            .iter()
            .filter(|evidence| visible_evidence_ids.contains(evidence.id.as_str()))
            .map(|evidence| evidence.id.as_str())
            .collect::<Vec<_>>()
    );

    let visible_deadline_ids = snapshot
        .deadlines
        .iter()
        .map(|deadline| deadline.id.as_str())
        .collect::<BTreeSet<_>>();
    let dossier_deadline_ids = snapshot
        .dossier
        .deadlines
        .iter()
        .map(|deadline| deadline.id.as_str())
        .collect::<BTreeSet<_>>();
    assert_eq!(visible_deadline_ids, dossier_deadline_ids);
    assert_eq!(visible_deadline_ids.len(), snapshot.deadlines.len());
    assert!(snapshot
        .deadlines
        .iter()
        .all(|deadline| deadline.status.is_some()));
    assert_eq!(
        snapshot
            .deadlines
            .iter()
            .map(|deadline| deadline.id.as_str())
            .collect::<Vec<_>>(),
        definition
            .deadlines
            .iter()
            .filter(|deadline| visible_deadline_ids.contains(deadline.id.as_str()))
            .map(|deadline| deadline.id.as_str())
            .collect::<Vec<_>>()
    );

    let expected_inbox_ids = definition
        .inbox_items
        .iter()
        .filter(|item| {
            session
                .diagnostic_visible_inbox_ids()
                .contains(item.id.as_str())
        })
        .map(|item| item.id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        snapshot
            .inbox
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>(),
        expected_inbox_ids
    );
    assert!(snapshot.inbox.iter().all(|item| item.visible));
    assert_eq!(
        snapshot
            .inbox
            .iter()
            .map(|item| item.id.as_str())
            .collect::<BTreeSet<_>>()
            .len(),
        snapshot.inbox.len()
    );

    let available_action_ids = snapshot
        .available_actions
        .iter()
        .map(|action| action.id.as_str())
        .collect::<BTreeSet<_>>();
    for action_id in snapshot
        .deadlines
        .iter()
        .flat_map(|deadline| &deadline.completion_action_ids)
        .chain(
            snapshot
                .inbox
                .iter()
                .flat_map(|item| &item.resolution_action_ids),
        )
    {
        assert!(
            available_action_ids.contains(action_id.as_str()),
            "nested player reference `{action_id}` is not currently available"
        );
    }
    for deadline in &snapshot.dossier.deadlines {
        for remedy in &deadline.remedies {
            assert!(available_action_ids.contains(remedy.action_id.as_str()));
        }
    }
    for evidence in &snapshot.dossier.evidence {
        for fact_id in evidence
            .supports_fact_ids
            .iter()
            .chain(&evidence.contradicts_fact_ids)
        {
            assert!(visible_fact_ids.contains(fact_id.as_str()));
        }
    }

    let projected_actor_ids = snapshot
        .pressure_and_countermove
        .as_ref()
        .into_iter()
        .flat_map(|projection| &projection.active_pressures)
        .map(|pressure| {
            let authored = definition
                .pressure_windows
                .iter()
                .find(|window| window.id.as_str() == pressure.pressure_id.as_str())
                .expect("every projected pressure must be definition-authorized");
            assert_eq!(
                authored.source_actor_id.as_str(),
                pressure.source_actor_id.as_str()
            );
            pressure.source_actor_id.as_str()
        })
        .collect::<BTreeSet<_>>();

    for hidden_id in definition
        .facts
        .iter()
        .map(|fact| fact.id.as_str())
        .filter(|id| !visible_fact_ids.contains(id))
        .chain(
            definition
                .evidence
                .iter()
                .map(|evidence| evidence.id.as_str())
                .filter(|id| !visible_evidence_ids.contains(id)),
        )
        .chain(
            definition
                .deadlines
                .iter()
                .map(|deadline| deadline.id.as_str())
                .filter(|id| !visible_deadline_ids.contains(id)),
        )
        .chain(
            definition
                .inbox_items
                .iter()
                .map(|item| item.id.as_str())
                .filter(|id| !expected_inbox_ids.contains(id)),
        )
        .chain(
            definition
                .actors
                .iter()
                .map(|actor| actor.id.as_str())
                .filter(|id| !projected_actor_ids.contains(id)),
        )
        .chain(definition.async_tasks.iter().map(|task| task.id.as_str()))
    {
        assert!(
            !encoded.contains(&format!("\"{hidden_id}\"")),
            "player snapshot leaked hidden definition ID `{hidden_id}`"
        );
    }

    PlayerVisibility {
        facts: visible_fact_ids.into_iter().map(str::to_owned).collect(),
        evidence: visible_evidence_ids
            .into_iter()
            .map(str::to_owned)
            .collect(),
        deadlines: visible_deadline_ids
            .into_iter()
            .map(str::to_owned)
            .collect(),
        inbox: expected_inbox_ids.into_iter().map(str::to_owned).collect(),
    }
}

fn run_case(case: &CanonicalCase) -> (String, PlayerVisibility, PlayerVisibility) {
    let definition = parse_definition(case.definition);
    let commands = parse_commands(case.commands);
    let mut session = ScenarioSession::new(definition.clone(), case.seed)
        .unwrap_or_else(|error| panic!("{} must initialize: {error}", case.name));

    assert_eq!(session.scenario_fingerprint().unwrap(), case.fingerprint);
    assert!(session.snapshot().training_debrief.is_none());
    let initial_visibility = assert_player_projection(&session, &definition);
    let governed = governed_visibility(&definition);
    let permanently_hidden = initially_hidden_visibility(&definition).difference(&governed);
    governed.assert_disjoint(&initial_visibility, case.name);
    permanently_hidden.assert_disjoint(&initial_visibility, case.name);
    let mut revealed = PlayerVisibility::default();
    let total_reveal_governed = definition.facts.len()
        + definition.evidence.len()
        + definition.deadlines.len()
        + definition.inbox_items.len();
    let had_hidden_entities = initial_visibility.count() < total_reveal_governed;
    let mut visibility_grew = false;
    let mut previous_visibility = initial_visibility;

    for command in &commands {
        match command {
            ScenarioCommand::Dispatch { action_id } => {
                session.dispatch(action_id).unwrap_or_else(|error| {
                    panic!("{} action `{action_id}` must replay: {error}", case.name)
                });
            }
            ScenarioCommand::AdvanceTime { minutes } => {
                session.advance_time(*minutes).unwrap_or_else(|error| {
                    panic!("{} advance_time({minutes}) must replay: {error}", case.name)
                });
            }
        }
        let snapshot = session.snapshot();
        assert_eq!(
            snapshot.training_debrief.is_some(),
            snapshot.resolved_outcome.is_some(),
            "{} debrief eligibility drifted from resolved_outcome",
            case.name
        );
        let visibility = assert_player_projection(&session, &definition);
        visibility.assert_monotonic_from(&previous_visibility, case.name);
        permanently_hidden.assert_disjoint(&visibility, case.name);
        revealed.extend_from(&visibility.visible_subset(&governed));
        visibility_grew |= visibility.count() > previous_visibility.count();
        previous_visibility = visibility;
    }

    if had_hidden_entities {
        assert!(
            visibility_grew,
            "{} canonical path did not exercise an authoritative reveal",
            case.name
        );
    }

    let final_snapshot = session.snapshot();
    assert_eq!(
        final_snapshot.clock_minutes, case.final_minutes,
        "{}",
        case.name
    );
    assert_eq!(
        final_snapshot.resolved_outcome.as_deref(),
        case.outcome,
        "{}",
        case.name
    );
    match case.outcome {
        Some(outcome_id) => {
            let debrief = final_snapshot
                .training_debrief
                .as_ref()
                .unwrap_or_else(|| panic!("{} must expose a debrief", case.name));
            assert_eq!(debrief.resolved_outcome_id, outcome_id, "{}", case.name);
            assert_eq!(
                debrief.final_scenario_minute, case.final_minutes,
                "{}",
                case.name
            );
            let expected_actions = commands
                .iter()
                .filter_map(|command| match command {
                    ScenarioCommand::Dispatch { action_id } => Some(action_id.as_str()),
                    ScenarioCommand::AdvanceTime { .. } => None,
                })
                .collect::<Vec<_>>();
            assert_eq!(
                debrief
                    .executed_actions
                    .iter()
                    .map(|action| action.action_id.as_str())
                    .collect::<Vec<_>>(),
                expected_actions,
                "{}",
                case.name
            );
            assert_eq!(
                debrief
                    .executed_actions
                    .iter()
                    .map(|action| action.sequence)
                    .collect::<Vec<_>>(),
                (1..=u64::try_from(expected_actions.len()).unwrap()).collect::<Vec<_>>(),
                "{}",
                case.name
            );
            assert!(debrief
                .executed_actions
                .windows(2)
                .all(|pair| pair[0].completion_minute <= pair[1].completion_minute));
        }
        None => assert!(
            final_snapshot.training_debrief.is_none(),
            "{} must not expose a debrief without an outcome",
            case.name
        ),
    }
    assert_eq!(
        session.final_state_digest().unwrap(),
        case.digest,
        "{}",
        case.name
    );

    let saved = session.save_json().unwrap();
    let restored = ScenarioSession::from_save_json(definition, &saved).unwrap();
    assert_eq!(restored.command_log(), commands.as_slice(), "{}", case.name);
    assert_eq!(restored.snapshot(), final_snapshot, "{}", case.name);
    assert_eq!(
        restored.final_state_digest().unwrap(),
        case.digest,
        "{}",
        case.name
    );

    (case.fingerprint.to_owned(), governed, revealed)
}

fn run_focused_visibility_path(
    name: &str,
    definition: &str,
    seed: u64,
    actions: &[&str],
) -> (String, PlayerVisibility, PlayerVisibility) {
    let definition = parse_definition(definition);
    let mut session = ScenarioSession::new(definition.clone(), seed)
        .unwrap_or_else(|error| panic!("{name} must initialize: {error}"));
    let governed = governed_visibility(&definition);
    let permanently_hidden = initially_hidden_visibility(&definition).difference(&governed);
    let mut previous_visibility = assert_player_projection(&session, &definition);
    governed.assert_disjoint(&previous_visibility, name);
    permanently_hidden.assert_disjoint(&previous_visibility, name);
    let mut revealed = PlayerVisibility::default();

    for action_id in actions {
        session
            .dispatch(action_id)
            .unwrap_or_else(|error| panic!("{name} action `{action_id}` must execute: {error}"));
        let visibility = assert_player_projection(&session, &definition);
        visibility.assert_monotonic_from(&previous_visibility, name);
        permanently_hidden.assert_disjoint(&visibility, name);
        revealed.extend_from(&visibility.visible_subset(&governed));
        previous_visibility = visibility;
    }

    (session.scenario_fingerprint().unwrap(), governed, revealed)
}

fn merge_visibility_coverage(
    coverage: &mut std::collections::BTreeMap<String, (PlayerVisibility, PlayerVisibility)>,
    result: (String, PlayerVisibility, PlayerVisibility),
) {
    let (fingerprint, governed, revealed) = result;
    let entry = coverage
        .entry(fingerprint)
        .or_insert_with(|| (governed.clone(), PlayerVisibility::default()));
    assert_eq!(
        entry.0, governed,
        "scenario visibility contract changed by path"
    );
    entry.1.extend_from(&revealed);
}

#[test]
fn all_five_production_scenarios_keep_visibility_and_canonical_invariants() {
    let cases = [
        CanonicalCase {
            name: "Failed ERP settlement",
            definition: FAILED_ERP,
            seed: 20_260_724,
            commands: FAILED_ERP_SETTLEMENT,
            fingerprint: "ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8",
            outcome: Some("settlement_64500"),
            final_minutes: 570,
            digest: "fd77a45422e4abd7f141fc7b1db767524ebf48d9674bd25c21354fb7a2b8c029",
        },
        CanonicalCase {
            name: "Failed ERP prepared litigation",
            definition: FAILED_ERP,
            seed: 6,
            commands: FAILED_ERP_PREPARED,
            fingerprint: "ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8",
            outcome: Some("judgment_preserved_after_cassation"),
            final_minutes: 8_640,
            digest: "f25604fc0225d7ac5a7e98d192ce3b82114970158a3662aee7575b128430ca0c",
        },
        CanonicalCase {
            name: "Failed ERP remittal",
            definition: FAILED_ERP,
            seed: 28,
            commands: FAILED_ERP_REMITTAL,
            fingerprint: "ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8",
            outcome: None,
            final_minutes: 10_080,
            digest: "268f27867fd1f45a417c0e999819165bd79f76a74f3ab2e65ee075e193cbc34a",
        },
        CanonicalCase {
            name: "Logistics negotiated",
            definition: LOGISTICS,
            seed: 20_260_725,
            commands: LOGISTICS_NEGOTIATED,
            fingerprint: "1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8",
            outcome: Some("negotiated_recovery"),
            final_minutes: 270,
            digest: "139239e001417ae563e270128864a512e88c0ff535a498e15b000731b8ca5bfe",
        },
        CanonicalCase {
            name: "Logistics judgment",
            definition: LOGISTICS,
            seed: 20_260_725,
            commands: LOGISTICS_JUDGMENT,
            fingerprint: "1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8",
            outcome: Some("judgment_recovery"),
            final_minutes: 480,
            digest: "e25e1eeb36249c1b7da0fe7a947f29ed3363ce7dac0357a110951c49bb738ac3",
        },
        CanonicalCase {
            name: "GreenFire protected",
            definition: GREENFIRE,
            seed: 20_260_729,
            commands: GREENFIRE_PROTECTED,
            fingerprint: "173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438",
            outcome: Some("protected_crisis_position"),
            final_minutes: 4_440,
            digest: "524078c5a72296b9b6549b2dca88cf2d727d0b28cb7c69012500b320919cdd58",
        },
        CanonicalCase {
            name: "GreenFire compromised",
            definition: GREENFIRE,
            seed: 20_260_729,
            commands: GREENFIRE_COMPROMISED,
            fingerprint: "173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438",
            outcome: Some("compromised_crisis_position"),
            final_minutes: 4_590,
            digest: "3b9d4a3776d65678a0318730d3d366f9279d318c197300c792b10d89a14f8aec",
        },
        CanonicalCase {
            name: "GoldenShell coordinated",
            definition: GOLDENSHELL,
            seed: 20_260_730,
            commands: GOLDENSHELL_COORDINATED,
            fingerprint: "7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4",
            outcome: Some("coordinated_claim_position"),
            final_minutes: 4_545,
            digest: "72986eeb4a3a690b775ea86c6ac5c9da02027ef5a0ca03292736b5e805f8c53b",
        },
        CanonicalCase {
            name: "GoldenShell fragmented",
            definition: GOLDENSHELL,
            seed: 20_260_730,
            commands: GOLDENSHELL_FRAGMENTED,
            fingerprint: "7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4",
            outcome: Some("fragmented_claim_position"),
            final_minutes: 4_710,
            digest: "846c96ed8ba240bb392daead67e03bd4b9a7cbe1b23bdd6d412314e582c13503",
        },
        CanonicalCase {
            name: "Desert Water coordinated",
            definition: DESERT_WATER,
            seed: 20_260_804,
            commands: DESERT_WATER_COORDINATED,
            fingerprint: "636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af",
            outcome: Some("credible_source_and_remedy"),
            final_minutes: 3_180,
            digest: "432df44aa3f9039ea3970298a0c2dbfe111f0ddfbf76713c75c1cc92261e0e2d",
        },
        CanonicalCase {
            name: "Desert Water compromised",
            definition: DESERT_WATER,
            seed: 20_260_804,
            commands: DESERT_WATER_COMPROMISED,
            fingerprint: "636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af",
            outcome: Some("compromised_claim_closed"),
            final_minutes: 3_510,
            digest: "a8ce4971e6898c5e020697733288cae4fc142cdb28f599551c7bfa0405c141ce",
        },
    ];
    let mut coverage =
        std::collections::BTreeMap::<String, (PlayerVisibility, PlayerVisibility)>::new();
    for case in &cases {
        merge_visibility_coverage(&mut coverage, run_case(case));
    }

    let failed_erp_focused_paths: [(&str, &[&str]); 5] = [
        (
            "Failed ERP permanent inactivity and preservation miss",
            &["run-conflict-check", "rest", "rest", "rest", "rest"],
        ),
        (
            "Failed ERP hearing reschedule",
            &[
                "run-conflict-check",
                "request-documents",
                "reject-settlement",
                "commence-proceedings",
                "prepare-statement-of-claim",
                "prepare-evidence-bundle",
                "request-hearing-reschedule",
            ],
        ),
        (
            "Failed ERP settlement expiry and procedural default",
            &[
                "run-conflict-check",
                "request-documents",
                "rest",
                "rest",
                "commence-proceedings",
                "rest",
                "rest",
            ],
        ),
        (
            "Failed ERP expired appeal remedy",
            &[
                "run-conflict-check",
                "request-documents",
                "reject-settlement",
                "commence-proceedings",
                "prepare-statement-of-claim",
                "prepare-evidence-bundle",
                "wait-until-hearing",
                "attend-hearing",
                "rest",
                "inform-client-judgment",
                "prepare-appeal-advice",
                "seek-client-appeal-authorization",
                "rest",
                "rest",
                "rest",
                "rest",
            ],
        ),
        (
            "Failed ERP expired cassation remedy",
            &[
                "run-conflict-check",
                "request-documents",
                "reject-settlement",
                "commence-proceedings",
                "prepare-statement-of-claim",
                "prepare-evidence-bundle",
                "wait-until-hearing",
                "attend-hearing",
                "rest",
                "inform-client-judgment",
                "prepare-appeal-advice",
                "seek-client-appeal-authorization",
                "file-appeal",
                "await-appeal-decision",
                "assess-cassation-grounds",
                "seek-client-cassation-authorization",
                "rest",
                "rest",
                "rest",
                "rest",
            ],
        ),
    ];
    for (name, actions) in failed_erp_focused_paths {
        merge_visibility_coverage(
            &mut coverage,
            run_focused_visibility_path(name, FAILED_ERP, 0, actions),
        );
    }
    for (fingerprint, (governed, revealed)) in coverage {
        // Production authoring audit: the Failed ERP hearing-missed event has
        // no valid action-driven path that can cross its relative deadline
        // without completing attendance. Keep its Inbox item pinned absent
        // instead of weakening visibility checks for reachable entities.
        let known_unreachable =
            if fingerprint == "ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8" {
                PlayerVisibility {
                    inbox: BTreeSet::from(["hearing_missed_notice".to_owned()]),
                    ..PlayerVisibility::default()
                }
            } else {
                PlayerVisibility::default()
            };
        let expected_revealed = governed.difference(&known_unreachable);
        assert_eq!(
            revealed, expected_revealed,
            "canonical and focused production paths did not reveal every governed entity for {fingerprint}"
        );
    }
}
